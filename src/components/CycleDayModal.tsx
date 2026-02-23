import React, { useState, useEffect } from 'react';
import { useFeatureData } from '../hooks/useFeatureData';
import type { PeriodData } from '../types';
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

const MOODS = [
    { emoji: '🌸', label: 'Calm' },
    { emoji: '🌿', label: 'Fresh' },
    { emoji: '🌙', label: 'Tired' },
    { emoji: '🌧', label: 'Sad' },
    { emoji: '🔥', label: 'Hype' },
];

interface CycleDayModalProps {
    date: string;
    onClose: () => void;
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

    const [isReadOnly, setIsReadOnly] = useState(initialMode === 'readonly');
    const [step, setStep] = useState<1 | 2>(requireWizard ? 1 : 2);

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
    }, [date, data.dailyEntries, requireWizard]);

    const handleNextPhase1 = async () => {
        if (!moodLabel || hasBled === null) return;

        if (hasBled === false) {
            // Save immediately
            await saveEntry(false);
            onClose();
        } else {
            setStep(2);
        }
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

    const handleSavePhase2 = async () => {
        await saveEntry(true);
        onClose();
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
        <div className="fixed inset-0 z-[60] flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity animate-in fade-in" onClick={onClose} />

            <div className="relative w-full max-w-md bg-white dark:bg-[#231218] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-y-auto max-h-[90vh] animate-in slide-in-from-bottom flex flex-col">
                <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
                    <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />
                </div>

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
                            <button onClick={onClose} className="w-full py-4 rounded-2xl font-bold text-slate-600 bg-slate-100 dark:bg-[#3a2028] mt-4">
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
                                        <label className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 block">¿Cómo te sentiste {prefix ? prefix.toLowerCase() : 'ese día'}?</label>
                                        <div className="flex justify-between items-center gap-1 overflow-x-auto scrollbar-hide py-2">
                                            {MOODS.map((mood) => (
                                                <button
                                                    key={mood.label}
                                                    onClick={() => { setMoodEmoji(mood.emoji); setMoodLabel(mood.label); }}
                                                    className={`group flex flex-col items-center justify-center gap-1 min-w-[60px] h-[72px] rounded-xl transition-all active:scale-95 border-2 ${moodLabel === mood.label ? 'border-primary bg-primary/10 shadow-sm scale-105' : 'border-transparent hover:bg-slate-50 dark:hover:bg-white/5'}`}
                                                >
                                                    <span className="text-2xl drop-shadow-sm">{mood.emoji}</span>
                                                    <span className={`text-[10px] font-bold ${moodLabel === mood.label ? 'text-primary' : 'text-slate-400'}`}>{mood.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Bleeding Question */}
                                    <div className="bg-rose-50 dark:bg-rose-900/10 p-5 rounded-3xl border border-rose-100 dark:border-rose-900/30">
                                        <label className="text-sm font-bold text-rose-900 dark:text-rose-100 mb-4 block text-center">
                                            ¿Tuviste sangrado {prefix ? prefix.toLowerCase() : 'ese día'}? 🩸
                                        </label>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setHasBled(true)}
                                                className={`flex-1 py-4 rounded-2xl font-bold text-lg transition-all border-2 ${hasBled === true ? 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-200 dark:shadow-rose-900/50 scale-105' : 'bg-white dark:bg-black/20 border-rose-100 dark:border-rose-900/30 text-rose-400 hover:bg-rose-50'}`}
                                            >
                                                Sí
                                            </button>
                                            <button
                                                onClick={() => setHasBled(false)}
                                                className={`flex-1 py-4 rounded-2xl font-bold text-lg transition-all border-2 ${hasBled === false ? 'bg-slate-800 dark:bg-slate-200 border-slate-800 dark:border-slate-200 text-white dark:text-slate-900 shadow-lg scale-105' : 'bg-white dark:bg-black/20 border-slate-200 dark:border-slate-800 text-slate-400 hover:bg-slate-50'}`}
                                            >
                                                No
                                            </button>
                                        </div>
                                    </div>

                                    <div className="pt-4 flex gap-3">
                                        <button onClick={onClose} className="flex-1 py-4 rounded-2xl font-bold text-slate-500 bg-slate-100 dark:bg-[#3a2028]">
                                            Posponer
                                        </button>
                                        <button
                                            onClick={handleNextPhase1}
                                            disabled={!moodLabel || hasBled === null}
                                            className="flex-1 py-4 rounded-2xl font-bold text-white bg-slate-900 dark:bg-pink-500 disabled:opacity-50 transition-opacity"
                                        >
                                            {hasBled ? 'Continuar ➡️' : 'Guardar ✅'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {step === 2 && (
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
                                        <button onClick={() => setStep(1)} className="flex-1 py-4 rounded-2xl font-bold border-2 border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-50 transition-colors">
                                            Atrás
                                        </button>
                                        <button onClick={handleSavePhase2} className="flex-[2] py-4 rounded-2xl font-bold text-white bg-slate-900 dark:bg-pink-500 shadow-lg active:scale-95 transition-transform">
                                            Guardar ✅
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
