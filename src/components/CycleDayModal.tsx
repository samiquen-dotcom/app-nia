import React, { useState, useEffect } from 'react';
import { useFeatureData } from '../hooks/useFeatureData';
import type { PeriodData, GymData, MoodData, CustomMood } from '../types';
import type { EnergyLevel } from '../utils/cycleLogic';
import { ENERGY_LEVELS } from '../utils/cycleLogic';

const SYMPTOMS = [
    { id: 'colicos', label: 'Cólicos', icon: '⚡' },
    { id: 'hinchazon', label: 'Hinchazón', icon: '🎈' },
    { id: 'dolor_cabeza', label: 'Dolor Cabeza', icon: '🤕' },
    { id: 'acne', label: 'Acné', icon: '🔴' },
    { id: 'antojos', label: 'Antojos', icon: '🍫' },
    { id: 'triste', label: 'Triste', icon: '😢' },
    { id: 'sensible', label: 'Sensible', icon: '🥺' },
];

interface CycleDayModalProps {
    date: string;
    onClose: (saved?: boolean) => void;
    initialMode?: 'readonly' | 'edit';
    requireWizard?: boolean; // If true, forces step 1 -> step 2
}

export const CycleDayModal: React.FC<CycleDayModalProps> = ({ date, onClose, initialMode = 'edit', requireWizard = false }) => {
    const { data, save } = useFeatureData<PeriodData>('period', {
        cycleStartDate: '',
        cycleLength: 28,
        periodLength: 5,
        symptomsLog: {},
        dailyEntries: {}
    });

    const { data: gymData, save: saveGym } = useFeatureData<GymData>('gym', {
        goalDaysPerWeek: 5,
        streak: 0,
        history: [],
        customRoutines: [
            { id: 'cardio', icon: '🏃‍♀️', label: 'Cardio' },
            { id: 'weights', icon: '🏋️‍♀️', label: 'Pesas' },
            { id: 'yoga', icon: '🧘‍♀️', label: 'Yoga' }
        ]
    });

    const { data: moodData, save: saveMood } = useFeatureData<MoodData>('mood', {
        entries: [],
        customMoods: [
            { id: 'calm', emoji: '🌸', label: 'Calm' },
            { id: 'fresh', emoji: '🌿', label: 'Fresh' },
            { id: 'tired', emoji: '🌙', label: 'Tired' },
            { id: 'sad', emoji: '🌧', label: 'Sad' },
            { id: 'hype', emoji: '🔥', label: 'Hype' },
        ]
    });

    const [isCreatingMood, setIsCreatingMood] = useState(false);
    const [newMoodEmoji, setNewMoodEmoji] = useState('✨');
    const [newMoodLabel, setNewMoodLabel] = useState('');

    const [isReadOnly, setIsReadOnly] = useState(initialMode === 'readonly');
    const [step, setStep] = useState<1 | 2 | 3 | 4>(requireWizard ? 1 : 1);

    // Temp Gym State
    const [wentToGym, setWentToGym] = useState<boolean | null>(null);
    const [selectedRoutineIds, setSelectedRoutineIds] = useState<string[]>([]);

    // Form State
    const [moodLabel, setMoodLabel] = useState<string>('');
    const [moodEmoji, setMoodEmoji] = useState<string>('');
    const [hasBled, setHasBled] = useState<boolean | null>(null);

    const [flow_level, setFlowLevel] = useState<'light' | 'medium' | 'heavy' | undefined>();
    const [energy_level, setEnergyLevel] = useState<EnergyLevel | undefined>('estable');
    const [today_symptoms, setTodaySymptoms] = useState<string[]>([]);
    const [pain_level, setPainLevel] = useState<number>(0);
    const [relief_methods, setReliefMethods] = useState<string[]>([]);

    useEffect(() => {
        const entry = data.dailyEntries?.[date];
        if (entry) {
            setMoodLabel(entry.moodLabel || '');
            setMoodEmoji(entry.moodEmoji || '');
            setHasBled(entry.hasBled ?? null);
            setFlowLevel(entry.flow);
            setEnergyLevel(entry.energy || 'estable');
            setTodaySymptoms(entry.symptoms || []);
            setPainLevel(entry.painLevel || 0);
            setReliefMethods(entry.reliefMethods || []);

            // Siempre iniciamos en el paso 1 al editar, para permitir cambiar el estado de ánimo o sangrado
            setStep(1);
        } else {
            setMoodLabel(''); setMoodEmoji(''); setHasBled(null);
            setFlowLevel(undefined); setEnergyLevel('estable');
            setTodaySymptoms([]); setPainLevel(0); setReliefMethods([]);
        }

        // Load Gym existing entry
        const existingGymEntries = gymData.history.filter((h: any) => h.date === date);
        if (existingGymEntries.length > 0) {
            setWentToGym(true);
            setSelectedRoutineIds(existingGymEntries.map((h: any) => h.workoutId));
        } else {
            setWentToGym(null);
            setSelectedRoutineIds([]);
        }
    }, [date, data.dailyEntries, gymData, requireWizard]);

    const handleQuickAddMood = () => {
        if (!newMoodLabel.trim()) return;
        const newMood: CustomMood = {
            id: Date.now().toString(),
            emoji: newMoodEmoji || '✨',
            label: newMoodLabel.trim()
        };
        saveMood({ customMoods: [...moodData.customMoods, newMood] });
        setMoodEmoji(newMood.emoji);
        setMoodLabel(newMood.label);
        setIsCreatingMood(false);
        setNewMoodLabel('');
        setNewMoodEmoji('✨');
    };

    const handleNextPhase1 = () => {
        if (!moodLabel) return;
        setStep(2);
    };

    const handleNextPhase2 = () => {
        if (hasBled === null) return;
        if (hasBled) {
            setStep(3); // Go to period details
        } else {
            setStep(4); // Skip to gym
        }
    };

    const handleNextPhase3 = () => {
        setStep(4); // Go to gym
    };

    const saveEntry = async (savingBled: boolean) => {
        const symptoms = [...today_symptoms];

        const entry: any = {
            date,
            hasBled: savingBled,
            moodLabel,
            moodEmoji,
            symptoms: savingBled ? symptoms : [],
            painLevel: savingBled ? pain_level : 0,
            reliefMethods: savingBled ? relief_methods : []
        };

        if (savingBled && flow_level) entry.flow = flow_level;
        if (savingBled && energy_level) entry.energy = energy_level;

        // Handle Gym update
        if (wentToGym === true && selectedRoutineIds.length > 0) {
            // Include routines in cycle entry for easy reading
            entry.gymRoutineIds = selectedRoutineIds;
            // Also save to Gym feature data
            const newHistory = gymData.history.filter((h: any) => h.date !== date);
            selectedRoutineIds.forEach(id => newHistory.push({ date, workoutId: id }));
            await saveGym({ ...gymData, history: newHistory });
        } else if (wentToGym === false) {
            // Remove from gym history if previously there
            const newHistory = gymData.history.filter((h: any) => h.date !== date);
            await saveGym({ ...gymData, history: newHistory });
        }

        const updatedEntries = { ...data.dailyEntries, [date]: entry };

        // Auto-update cycle start date if bleeding starts after a gap
        let newCycleStartDate = data.cycleStartDate;
        if (savingBled) {
            // Find last bleeding day before `date`
            const allDates = Object.keys(updatedEntries).sort();
            const pastDates = allDates.filter(d => d < date && updatedEntries[d].hasBled);
            const lastBleed = pastDates[pastDates.length - 1];

            // If no previous bleeding, or gap > 15 days, it's a NEW cycle!
            if (!lastBleed) {
                newCycleStartDate = date;
            } else {
                const diff = Math.floor((new Date(date).getTime() - new Date(lastBleed).getTime()) / 86400000);
                if (diff > 15) {
                    newCycleStartDate = date; // New cycle starts!
                }
            }
        }

        await save({ dailyEntries: updatedEntries, cycleStartDate: newCycleStartDate || '' });
    };

    const handleSavePhase4 = async () => {
        await saveEntry(hasBled || false);
        onClose(true);
    };

    const toggleSymptom = (label: string) => {
        setTodaySymptoms(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]);
    };

    const toggleReliefMethod = (method: string) => {
        setReliefMethods(prev => prev.includes(method) ? prev.filter(m => m !== method) : [...prev, method]);
    };

    const selectedEnergyConfig = ENERGY_LEVELS.find(e => e.id === energy_level);

    // Format date string
    const dObj = new Date(date + 'T12:00:00'); // Safe middle-of-day
    // Determine friendly name
    const nowLocal = new Date();
    const todayLocal = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate());
    const targetLocal = new Date(dObj.getFullYear(), dObj.getMonth(), dObj.getDate());
    const diffDays = Math.floor((todayLocal.getTime() - targetLocal.getTime()) / 86400000);

    let prefix = '';
    if (diffDays === 0) prefix = 'Hoy';
    else if (diffDays === 1) prefix = 'Ayer';
    else if (diffDays === 2) prefix = 'Antier';

    return (
        <div className="fixed inset-0 z-[60] flex flex-col justify-center items-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" onClick={() => onClose(false)} />

            <div className="relative w-full max-w-md mx-auto bg-white dark:bg-[#231218] rounded-[2rem] shadow-2xl overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-300 flex flex-col">

                <div className="p-6 flex-1 overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex flex-col gap-1">
                            {(!isReadOnly && prefix && prefix !== 'Hoy') && (
                                <span className="text-3xl font-black text-pink-500 drop-shadow-sm uppercase tracking-wider">{prefix}</span>
                            )}
                            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mt-1">
                                {isReadOnly ? 'Resumen del día 📅' : 'Registrar día 📝'}
                                {isReadOnly && (
                                    <button onClick={() => { setIsReadOnly(false); setStep(1); }} className="ml-2 text-xs font-bold text-pink-500 bg-pink-50 px-3 py-1 rounded-full border border-pink-100 hover:bg-pink-100 transition-colors">
                                        Editar
                                    </button>
                                )}
                            </h2>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-[#2d1820] text-[10px] font-bold text-slate-500">
                            {dObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                    </div>

                    {/* READ ONLY MODE */}
                    {isReadOnly ? (
                        <div className="space-y-6">
                            {/* Mood/Bleeding Summary */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-50 dark:bg-[#2d1820] p-4 rounded-2xl flex flex-col items-center justify-center gap-1 text-center">
                                    <span className="text-3xl">{moodEmoji || '➖'}</span>
                                    <p className="text-[10px] uppercase font-bold text-slate-400">{moodLabel || 'Sin registro'}</p>
                                </div>
                                <div className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-1 text-center ${hasBled ? 'bg-rose-50 dark:bg-rose-900/20' : 'bg-slate-50 dark:bg-[#2d1820]'}`}>
                                    <span className="text-3xl">{hasBled ? '🩸' : '🌱'}</span>
                                    <p className={`text-[10px] uppercase font-bold ${hasBled ? 'text-rose-500' : 'text-slate-400'}`}>
                                        {hasBled ? 'Con periodo' : 'Sin periodo'}
                                    </p>
                                </div>
                            </div>

                            {hasBled && (
                                <>
                                    <div className="bg-slate-50 dark:bg-[#2d1820] p-4 rounded-2xl flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-white dark:bg-[#3a2028] flex items-center justify-center text-xl shadow-sm">🩸</div>
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-slate-400">Flujo</p>
                                            <p className="font-bold text-slate-700 dark:text-slate-200">
                                                {flow_level === 'light' ? 'Leve' : flow_level === 'medium' ? 'Medio' : flow_level === 'heavy' ? 'Abundante' : 'No registrado'}
                                            </p>
                                        </div>
                                    </div>

                                    {pain_level > 0 && (
                                        <div className="bg-rose-50 dark:bg-rose-900/10 p-4 rounded-2xl flex flex-col gap-2 relative overflow-hidden border border-rose-100 dark:border-rose-900/20">
                                            <div className="absolute top-0 right-0 p-2 opacity-10 text-3xl">😣</div>
                                            <div>
                                                <p className="text-[10px] uppercase font-bold text-rose-400">Nivel de Dolor</p>
                                                <div className="flex items-end gap-1">
                                                    <span className="text-2xl font-black text-rose-500">{pain_level}</span>
                                                    <span className="text-xs font-bold text-rose-300 pb-1">/ 10</span>
                                                </div>
                                            </div>
                                            {relief_methods.length > 0 && (
                                                <div className="mt-2 pt-2 border-t border-rose-100 dark:border-rose-900/30">
                                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Lo que te alivió:</p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {relief_methods.map(m => (
                                                            <span key={m} className="px-2 py-0.5 rounded-md bg-white dark:bg-rose-900/40 text-[10px] font-bold text-rose-600 dark:text-rose-300 shadow-sm border border-rose-50 dark:border-rose-800/50 capitalize">{m}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="bg-slate-50 dark:bg-[#2d1820] p-4 rounded-2xl flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-white dark:bg-[#3a2028] flex items-center justify-center text-xl shadow-sm">{selectedEnergyConfig?.emoji || '⚡'}</div>
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-slate-400">Energía</p>
                                            <p className="font-bold text-slate-700 dark:text-slate-200">{selectedEnergyConfig?.label || 'No registrada'}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 ml-1">Síntomas</p>
                                        <div className="flex flex-wrap gap-2">
                                            {today_symptoms.length > 0 ? today_symptoms.map(sId => {
                                                const s = SYMPTOMS.find(sym => sym.id === sId);
                                                return <span key={sId} className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-bold border border-indigo-100 flex items-center gap-1">{s?.icon} {s?.label || sId}</span>
                                            }) : <p className="text-sm text-slate-400 italic pl-1">Ningún síntoma registrado.</p>}
                                        </div>
                                    </div>
                                </>
                            )}

                            {wentToGym && (
                                <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-2xl flex items-center gap-4 border border-emerald-100 dark:border-emerald-900/30">
                                    <div className="w-10 h-10 rounded-full bg-white dark:bg-[#3a2028] flex items-center justify-center text-xl shadow-sm">
                                        {selectedRoutineIds.length > 0 ? gymData.customRoutines.find((r: any) => r.id === selectedRoutineIds[0])?.icon : '🏋️'}
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">¡Fuiste al Gym!</p>
                                        <p className="font-bold text-slate-700 dark:text-slate-200">
                                            {selectedRoutineIds.length > 0 ? selectedRoutineIds.map(id => gymData.customRoutines.find((r: any) => r.id === id)?.label || '').filter(Boolean).join(', ') : 'Rutina completada'}
                                        </p>
                                    </div>
                                </div>
                            )}
                            <button onClick={() => onClose()} className="w-full py-4 rounded-2xl font-bold text-slate-600 bg-slate-100 dark:bg-[#3a2028] mt-4">
                                Cerrar
                            </button>
                        </div>
                    ) : (
                        /* EDIT MODE */
                        <div className="animate-in fade-in slide-in-from-right-4">
                            {step === 1 && (
                                <div className="space-y-8">
                                    {/* Mood */}
                                    <div>
                                        <label className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 block text-center">
                                            Paso 1: ¿Cómo te sentiste {prefix ? prefix.toLowerCase() : 'ese día'}?
                                        </label>
                                        <div className="flex gap-2 py-2 overflow-x-auto scrollbar-hide px-1">
                                            {moodData.customMoods?.map((mood: any) => (
                                                <button
                                                    key={mood.id}
                                                    onClick={() => { setMoodEmoji(mood.emoji); setMoodLabel(mood.label); }}
                                                    className={`group flex-shrink-0 w-[4.5rem] flex flex-col items-center justify-center gap-1 py-3 rounded-2xl transition-all active:scale-95 border-2 ${moodLabel === mood.label ? 'border-primary bg-primary/10 shadow-sm scale-110' : 'border-transparent bg-slate-50 dark:bg-white/5 hover:bg-slate-100 duration-200'}`}
                                                >
                                                    <span className={`text-3xl drop-shadow-sm transition-transform ${moodLabel === mood.label ? 'scale-110' : 'scale-100 grayscale-[0.3] opacity-60'}`}>{mood.emoji}</span>
                                                    <span className={`text-[10px] font-bold mt-1 max-w-full truncate px-1 ${moodLabel === mood.label ? 'text-primary' : 'text-slate-400'}`}>{mood.label}</span>
                                                </button>
                                            ))}
                                            <button
                                                onClick={() => setIsCreatingMood(true)}
                                                className="group flex-shrink-0 w-[4.5rem] flex flex-col items-center justify-center gap-1 py-3 rounded-2xl transition-all active:scale-95 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400"
                                            >
                                                <span className="material-symbols-outlined text-2xl mb-1">add</span>
                                                <span className="text-[10px] font-bold mt-1 max-w-full truncate px-1">Nueva</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Create Mood Modal */}
                                    {isCreatingMood && (
                                        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCreatingMood(false)}></div>
                                            <div className="relative bg-white dark:bg-[#231218] p-6 rounded-3xl w-full max-w-sm shadow-2xl animate-in zoom-in-95">
                                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 text-center">Nueva Emoción</h3>

                                                <div className="space-y-4 mb-6">
                                                    <div>
                                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block ml-1">Emoji</label>
                                                        <div className="flex justify-center">
                                                            <input
                                                                type="text"
                                                                value={newMoodEmoji}
                                                                onChange={(e) => {
                                                                    const val = e.target.value.substring(0, 4);
                                                                    setNewMoodEmoji(val || '✨');
                                                                }}
                                                                onClick={() => {
                                                                    if (newMoodEmoji === '✨') setNewMoodEmoji('');
                                                                }}
                                                                className="w-16 h-16 text-3xl text-center bg-white dark:bg-[#1a0d10] border-2 border-indigo-100 dark:border-indigo-900/50 rounded-2xl shadow-sm focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:opacity-30"
                                                                placeholder="✨"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block ml-1">Nombre</label>
                                                        <input
                                                            type="text"
                                                            value={newMoodLabel}
                                                            onChange={(e) => setNewMoodLabel(e.target.value)}
                                                            className="w-full bg-slate-50 dark:bg-[#1a0d10] border-2 border-slate-100 dark:border-[#5a2b35]/30 rounded-2xl px-4 py-3 text-slate-700 dark:text-slate-200 font-bold focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all placeholder:font-medium"
                                                            placeholder="Ej: Ansiosa, Feliz..."
                                                            autoFocus
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleQuickAddMood();
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={() => setIsCreatingMood(false)}
                                                        className="flex-1 px-4 py-3 rounded-2xl font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors"
                                                    >
                                                        Cancelar
                                                    </button>
                                                    <button
                                                        onClick={handleQuickAddMood}
                                                        disabled={!newMoodLabel.trim()}
                                                        className="flex-1 px-4 py-3 rounded-2xl font-bold text-white bg-pink-500 hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-pink-500/20"
                                                    >
                                                        Crear
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-4 flex gap-3">
                                        <button onClick={() => onClose(false)} className="flex-1 py-4 rounded-2xl font-bold text-slate-500 bg-slate-100 dark:bg-[#3a2028]">
                                            Posponer
                                        </button>
                                        <button
                                            onClick={handleNextPhase1}
                                            disabled={!moodLabel}
                                            className="flex-1 py-4 rounded-2xl font-bold text-white bg-slate-900 dark:bg-pink-500 disabled:opacity-50 transition-opacity"
                                        >
                                            Siguiente ➡️
                                        </button>
                                    </div>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-8 animate-in slide-in-from-right-8">
                                    {/* Bleeding Question */}
                                    <div>
                                        <label className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 block text-center">
                                            Paso 2: ¿Tuviste sangrado {prefix ? prefix.toLowerCase() : 'ese día'}? 🩸
                                        </label>
                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => setHasBled(true)}
                                                className={`flex-1 py-6 rounded-3xl font-bold text-xl transition-all border-2 flex flex-col items-center justify-center gap-2 ${hasBled === true ? 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-200 dark:shadow-rose-900/50 scale-105' : 'bg-white dark:bg-[#2d1820] border-rose-100 dark:border-rose-900/30 text-rose-400 hover:bg-rose-50'}`}
                                            >
                                                <span className="text-4xl text-white drop-shadow-sm">🩸</span>
                                                Sí
                                            </button>
                                            <button
                                                onClick={() => setHasBled(false)}
                                                className={`flex-1 py-6 rounded-3xl font-bold text-xl transition-all border-2 flex flex-col items-center justify-center gap-2 ${hasBled === false ? 'bg-slate-800 dark:bg-slate-200 border-slate-800 dark:border-slate-200 text-white dark:text-slate-900 shadow-lg scale-105' : 'bg-white dark:bg-[#2d1820] border-slate-200 dark:border-slate-800/30 text-slate-400 hover:bg-slate-50'}`}
                                            >
                                                <span className={`text-4xl drop-shadow-sm ${hasBled === false ? '' : 'grayscale opacity-50'}`}>🌱</span>
                                                No
                                            </button>
                                        </div>
                                    </div>

                                    <div className="pt-4 flex gap-3">
                                        <button onClick={() => setStep(1)} className="flex-1 py-4 rounded-2xl font-bold border-2 border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-50 transition-colors">
                                            Atrás
                                        </button>
                                        <button
                                            onClick={handleNextPhase2}
                                            disabled={hasBled === null}
                                            className="flex-[2] py-4 rounded-2xl font-bold text-white bg-slate-900 dark:bg-pink-500 disabled:opacity-50 transition-transform active:scale-95"
                                        >
                                            Siguiente ➡️
                                        </button>
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="space-y-8 animate-in slide-in-from-right-8">
                                    {/* 1. FLOW */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">Flujo Menstrual</label>
                                        <div className="flex gap-4 justify-between">
                                            <button onClick={() => setFlowLevel(flow_level === 'light' ? undefined : 'light')} className={`flex-1 overflow-visible py-3 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${flow_level === 'light' ? 'border-pink-300 bg-pink-50 dark:bg-pink-900/20' : 'border-slate-100 dark:border-[#5a2b35]/30'}`}>
                                                <div className="w-3 h-3 bg-rose-300 rounded-full shadow-sm" /><span className="text-[10px] font-bold text-slate-500">Leve</span>
                                            </button>
                                            <button onClick={() => setFlowLevel(flow_level === 'medium' ? undefined : 'medium')} className={`flex-1 py-3 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${flow_level === 'medium' ? 'border-rose-400 bg-rose-50 dark:bg-rose-900/20' : 'border-slate-100 dark:border-[#5a2b35]/30'}`}>
                                                <div className="flex gap-1"><div className="w-3 h-3 bg-rose-400 rounded-full" /><div className="w-3 h-3 bg-rose-400 rounded-full" /></div><span className="text-[10px] font-bold text-slate-500">Medio</span>
                                            </button>
                                            <button onClick={() => setFlowLevel(flow_level === 'heavy' ? undefined : 'heavy')} className={`flex-1 py-3 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${flow_level === 'heavy' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-slate-100 dark:border-[#5a2b35]/30'}`}>
                                                <div className="flex gap-0.5"><div className="w-3 h-3 bg-red-500 rounded-full" /><div className="w-3 h-3 bg-red-500 rounded-full" /><div className="w-3 h-3 bg-red-500 rounded-full" /></div><span className="text-[10px] font-bold text-slate-500">Fuerte</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* 2. PAIN */}
                                    <div className="p-5 bg-rose-50/50 dark:bg-rose-900/10 rounded-3xl border border-rose-100 dark:border-rose-900/30">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex justify-between">
                                            <span className="text-rose-400">¿Hubo dolor {prefix ? prefix.toLowerCase() : 'ese día'}? (0 - 10)</span>
                                            <span>😣</span>
                                        </label>
                                        <div className="text-center mb-4">
                                            <h3 className="text-3xl font-black text-rose-500">{pain_level}</h3>
                                            <p className="text-xs font-bold text-slate-400">{pain_level === 0 ? 'Sin dolor' : pain_level < 4 ? 'Leve' : pain_level < 7 ? 'Moderado' : 'Fuerte/Severo'}</p>
                                        </div>
                                        <input type="range" min="0" max="10" step="1" value={pain_level} onChange={(e) => setPainLevel(parseInt(e.target.value))} className="w-full h-2 bg-rose-200 dark:bg-rose-900 rounded-lg appearance-none cursor-pointer accent-rose-500 mb-6" />

                                        {pain_level > 0 && (
                                            <div className="animate-in fade-in pt-4 border-t border-rose-100 dark:border-rose-900/30">
                                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-3 tracking-widest text-center">¿Qué te ayudó a aliviarlo?</p>
                                                <div className="flex flex-wrap gap-2 justify-center">
                                                    {['ibuprofeno', 'medicina', 'calor', 'ejercicio', 'descanso', 'té'].map(method => {
                                                        const active = relief_methods.includes(method);
                                                        return <button key={method} onClick={() => toggleReliefMethod(method)} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all capitalize ${active ? 'bg-rose-100 border-rose-200 text-rose-600 dark:bg-rose-800/40 dark:border-rose-700 dark:text-rose-200' : 'bg-white dark:bg-black/20 border-slate-100 dark:border-white/10 text-slate-500'}`}>{method}</button>
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* 3. ENERGY */}
                                    <div className="p-5 bg-slate-50 dark:bg-[#2d1820] rounded-3xl border border-slate-100 dark:border-[#5a2b35]/30">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex justify-between">
                                            <span>Nivel de Energía</span><span>{selectedEnergyConfig?.emoji}</span>
                                        </label>
                                        <div className="text-center mb-6">
                                            <h3 className={`text-lg font-black transition-colors ${selectedEnergyConfig?.color}`}>{selectedEnergyConfig?.label || 'Selecciona...'}</h3>
                                            <p className="text-xs text-slate-500 mt-1 h-4">{selectedEnergyConfig?.gym}</p>
                                        </div>
                                        <input type="range" min="0" max="4" step="1" value={ENERGY_LEVELS.findIndex(e => e.id === energy_level)} onChange={(e) => setEnergyLevel(ENERGY_LEVELS[parseInt(e.target.value)].id)} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-800 dark:accent-pink-400" />
                                        <div className="flex justify-between mt-2 px-1"><span className="text-[10px] text-slate-400">Baja</span><span className="text-[10px] text-slate-400">Alta</span></div>
                                    </div>

                                    {/* 4. SYMPTOMS */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">Síntomas adicionales</label>
                                        <div className="flex flex-wrap gap-2">
                                            {SYMPTOMS.map(sym => {
                                                const active = today_symptoms.includes(sym.id);
                                                return <button key={sym.id} onClick={() => toggleSymptom(sym.id)} className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${active ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300' : 'bg-white dark:bg-[#2d1820] border-slate-100 dark:border-[#5a2b35]/30 text-slate-500'}`}><span>{sym.icon}</span>{sym.label}</button>
                                            })}
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <button onClick={() => setStep(2)} className="flex-1 py-4 rounded-2xl font-bold border-2 border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-50 transition-colors">
                                            Atrás
                                        </button>
                                        <button onClick={handleNextPhase3} className="flex-[2] py-4 rounded-2xl font-bold text-white bg-slate-900 dark:bg-pink-500 shadow-lg active:scale-95 transition-transform">
                                            Siguiente ➡️
                                        </button>
                                    </div>
                                </div>
                            )}

                            {step === 4 && (
                                <div className="space-y-8 animate-in slide-in-from-right-8">
                                    {/* Gym Question */}
                                    <div>
                                        <label className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 block text-center">
                                            Paso 4: ¿Fuiste al Gym {prefix ? prefix.toLowerCase() : 'ese día'}? 🏋️‍♀️
                                        </label>
                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => { setWentToGym(true); if (gymData.customRoutines.length > 0 && selectedRoutineIds.length === 0) setSelectedRoutineIds([gymData.customRoutines[0].id]); }}
                                                className={`flex-1 py-5 rounded-3xl font-bold text-xl transition-all border-2 flex flex-col items-center justify-center gap-2 ${wentToGym === true ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/50 scale-105' : 'bg-white dark:bg-[#2d1820] border-emerald-100 dark:border-emerald-900/30 text-emerald-500 hover:bg-emerald-50'}`}
                                            >
                                                <span className="text-4xl drop-shadow-sm border-transparent" style={{ textShadow: wentToGym === true ? 'none' : '0 0 0 white, 0 0 1px emerald' }}>💪</span>
                                                Sí
                                            </button>
                                            <button
                                                onClick={() => { setWentToGym(false); setSelectedRoutineIds([]); }}
                                                className={`flex-1 py-5 rounded-3xl font-bold text-xl transition-all border-2 flex flex-col items-center justify-center gap-2 ${wentToGym === false ? 'bg-slate-800 dark:bg-slate-200 border-slate-800 dark:border-slate-200 text-white dark:text-slate-900 shadow-lg scale-105' : 'bg-white dark:bg-[#2d1820] border-slate-200 dark:border-slate-800/30 text-slate-400 hover:bg-slate-50'}`}
                                            >
                                                <span className={`text-4xl drop-shadow-sm ${wentToGym === false ? '' : 'grayscale opacity-50'}`}>🛋️</span>
                                                No
                                            </button>
                                        </div>
                                    </div>

                                    {/* Routine Selection */}
                                    {wentToGym === true && (
                                        <div className="animate-in fade-in slide-in-from-bottom-2 p-5 bg-emerald-50 dark:bg-emerald-900/10 rounded-3xl border border-emerald-100 dark:border-emerald-900/30">
                                            <label className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-3 block text-center">
                                                ¿Qué rutina hiciste?
                                            </label>
                                            <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                                                {gymData.customRoutines.map((routine: any) => (
                                                    <button
                                                        key={routine.id}
                                                        onClick={() => setSelectedRoutineIds(prev => prev.includes(routine.id) ? prev.filter(r => r !== routine.id) : [...prev, routine.id])}
                                                        className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center gap-3 border ${selectedRoutineIds.includes(routine.id) ? 'bg-emerald-500 border-emerald-500 text-white shadow-md scale-[1.02]' : 'bg-white dark:bg-[#1a0d10] border-emerald-100 dark:border-emerald-800/50 text-slate-600 dark:text-slate-300 hover:border-emerald-300'}`}
                                                    >
                                                        <span className="text-xl bg-white/20 rounded-md p-1 h-8 w-8 flex items-center justify-center">{routine.icon}</span>
                                                        <span>{routine.label}</span>
                                                    </button>
                                                ))}
                                                {gymData.customRoutines.length === 0 && (
                                                    <p className="text-xs text-center text-slate-500 italic py-4">No tienes rutinas creadas. Puedes añadirlas en la pantalla de Gym.</p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-3">
                                        <button onClick={() => setStep(hasBled ? 3 : 2)} className="flex-1 py-4 rounded-2xl font-bold border-2 border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-50 transition-colors">
                                            Atrás
                                        </button>
                                        <button
                                            onClick={handleSavePhase4}
                                            disabled={wentToGym === null || (wentToGym === true && selectedRoutineIds.length === 0)}
                                            className="flex-[2] py-4 rounded-2xl font-bold text-white bg-slate-900 dark:bg-pink-500 disabled:opacity-50 shadow-lg active:scale-95 transition-transform"
                                        >
                                            Finalizar ✅
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
