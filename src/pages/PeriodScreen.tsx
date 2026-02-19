import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useFeatureData } from '../hooks/useFeatureData';
import type { PeriodData, DailyCycleEntry } from '../types';
import type { EnergyLevel } from '../utils/cycleLogic';
import { calculatePhase, ENERGY_LEVELS, getPredictions, todayStr } from '../utils/cycleLogic';

const SYMPTOMS = [
    { id: 'colicos', label: 'Cólicos', icon: '⚡' },
    { id: 'hinchazon', label: 'Hinchazón', icon: '🎈' },
    { id: 'dolor_cabeza', label: 'Dolor Cabeza', icon: '🤕' },
    { id: 'acne', label: 'Acné', icon: '🔴' },
    { id: 'antojos', label: 'Antojos', icon: '🍫' },
    { id: 'triste', label: 'Triste', icon: '😢' },
    { id: 'sensible', label: 'Sensible', icon: '🥺' },
];

export const PeriodScreen: React.FC = () => {
    const { data, save } = useFeatureData<PeriodData>('period', {
        cycleStartDate: '',
        cycleLength: 28,
        periodLength: 5,
        isPeriodActive: false,
        symptomsLog: {},
        dailyEntries: {}
    });

    // ─── State ────────────────────────────────────────────────────────────────
    const [showDailyModal, setShowDailyModal] = useState(false);

    // Daily Log State
    const [logDate, setLogDate] = useState(todayStr());
    const [flow_level, setFlowLevel] = useState<'light' | 'medium' | 'heavy' | undefined>();
    const [energy_level, setEnergyLevel] = useState<EnergyLevel | undefined>('estable');
    const [today_symptoms, setTodaySymptoms] = useState<string[]>([]);
    const [is_cramps, setIsCramps] = useState(false); // Smart question logic

    // Use local time for consistency with calendar grid
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Determine phase: If isPeriodActive is explicitly true, force Menstrual.
    // Otherwise, use standard calculation.
    let phase = data.cycleStartDate ? calculatePhase(data.cycleStartDate, data.cycleLength, data.periodLength) : null;

    // Override phase if manually active
    if (data.isPeriodActive && phase) {
        // Force days to be within menstrual phase appearance if needed, 
        // but calculatePhase usually does this based on dates.
        // We mainly need to ensure 'periodActive' logic below is correct.
        if (phase.name !== 'Menstrual') {
            // If calculation says we passed 'periodLength' but user hasn't ended it, 
            // effectively we are still in Menstrual.
            phase = { ...phase, name: 'Menstrual', desc: 'Periodo activo', color: 'text-rose-500', bg: 'bg-rose-100', icon: '🩸', gymAdvice: 'Yoga restaurativo o paseo ligero.' };
        }
    }

    const predictions = data.cycleStartDate ? getPredictions(data.cycleStartDate, data.cycleLength) : { nextPeriod: null, fertileWindow: null };

    // Check if period is truly active based on flag
    const periodActive = data.isPeriodActive === true;

    const currentEntry = data.dailyEntries?.[today];

    // ─── Effects & Logic ──────────────────────────────────────────────────────
    const location = useLocation();

    useEffect(() => {
        if (location.state && (location.state as any).openLog) {
            const target = (location.state as any).targetDate || today;
            setLogDate(target);
            setIsReadOnly(false); // Widget always implies intent to log/edit
            setShowDailyModal(true);
            // Clear state via replacement so it doesn't reopen is tricky with React Router without navigate, 
            // but for now this works. We rely on modal state.
        }
    }, [location]);

    // State for Modal Mode
    const [isReadOnly, setIsReadOnly] = useState(false);

    // ... (rest of state)

    useEffect(() => {
        if (showDailyModal) {
            // Load existing data if any
            const entry = data.dailyEntries?.[logDate];
            if (entry) {
                setFlowLevel(entry.flow);
                setEnergyLevel(entry.energy);
                setTodaySymptoms(entry.symptoms || []);
            } else {
                // Reset defaults
                setFlowLevel(undefined);
                setEnergyLevel('estable');
                setTodaySymptoms([]);
            }
        }
    }, [showDailyModal, logDate, data.dailyEntries]);

    // Update click handler in calendar
    const onDayClick = (dStr: string) => {
        const entry = data.dailyEntries?.[dStr];
        const isToday = dStr === today;

        // Strategy:
        // 1. If entry exists, open modal.
        //    - If NOT today, open as Read-Only Summary.
        //    - If TODAY, open as Edit Form.
        // 2. If NO entry but it's today and period active, open Edit Form.

        if (entry) {
            setLogDate(dStr);
            setIsReadOnly(!isToday); // Force read-only for past days
            setShowDailyModal(true);
        } else if (isToday && periodActive) {
            setLogDate(dStr);
            setIsReadOnly(false);
            setShowDailyModal(true);
        }
    };

    const handleStartPeriod = async () => {
        // One-tap start
        // Set state first for immediate UI feedback
        // Then call save
        await save({
            cycleStartDate: today,
            isPeriodActive: true
        });

        // Auto open log
        setLogDate(today);
        setTimeout(() => setShowDailyModal(true), 100);
    };

    const handleEndPeriod = async () => {
        // Calculate actual duration
        const start = new Date(data.cycleStartDate + 'T00:00:00');
        const end = new Date(today + 'T00:00:00');
        const duration = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;

        // Ensure duration is reasonable (e.g., at least 1 day, max 20)
        let validDuration = duration;
        if (validDuration < 1) validDuration = 1;
        if (validDuration > 20) validDuration = 20;

        await save({
            isPeriodActive: false,
            periodLength: validDuration // Update average/last length
        });
    };

    const saveDailyLog = async () => {
        const symptoms = [...today_symptoms];
        if (is_cramps && !symptoms.includes('colicos')) symptoms.push('colicos');

        const entry: DailyCycleEntry = {
            date: logDate,
            flow: flow_level,
            energy: energy_level,
            symptoms: symptoms
        };

        const updatedEntries = { ...data.dailyEntries, [logDate]: entry };

        // Also update legacy symptomsLog for compatibility if needed
        const updatedSymptomsLog = { ...data.symptomsLog, [logDate]: symptoms };

        await save({ dailyEntries: updatedEntries, symptomsLog: updatedSymptomsLog });
        setShowDailyModal(false);
    };



    const toggleSymptom = (label: string) => {
        setTodaySymptoms(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]);
    };

    const selectedEnergyConfig = ENERGY_LEVELS.find(e => e.id === energy_level);

    // ─── Render Helpers ───────────────────────────────────────────────────────

    // Calendar logic
    // Reuse 'now' from top scope
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;

    const getDayContent = (day: number) => {
        const dStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const entry = data.dailyEntries?.[dStr];

        if (predictions.nextPeriod) {
            // Simple prediction logic could go here
        }

        return { entry, dStr };
    };

    // Update click handler in calendar
    // (Logic moved to main body for state access)
    // using the one defined above instead.

    // We need to make sure the one I added in previous step (which replaced useEffect) is the only one. 
    // Wait, the previous step REPLACED the useEffect but did NOT add the `onDayClick` function *definition* there, it added state and useEffect logic.
    // The previous prompt said "Update onDayClick ... inside ReplacementContent: ... const onDayClick = ...".
    // So the previous step likely inserted `onDayClick` right after the effect. 
    // I need to REMOVE the original `onDayClick` which is further down around line 165.

    return (
        <div className="pb-24 dark:bg-[#1a0d10] min-h-screen">

            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div className="px-6 pt-12 pb-6 flex justify-between items-center bg-white dark:bg-[#231218] rounded-b-[2rem] shadow-sm mb-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        Tu Ciclo <span className="text-pink-400">🌸</span>
                    </h1>
                    <p className="text-xs text-slate-400 font-medium">
                        {today}
                    </p>
                </div>
            </div>

            {/* ── Main Phase Card ─────────────────────────────────────────────── */}
            <div className="px-6 mb-6">
                <div className={`relative rounded-[2rem] p-6 overflow-hidden shadow-xl transition-all ${phase ? phase.bg : 'bg-gradient-to-br from-pink-50 to-white dark:from-[#2d1820] dark:to-[#1a0d10]'}`}>

                    {/* Background decorations */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                    {phase ? (
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-2">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/60 dark:bg-black/20 backdrop-blur-sm ${phase.color}`}>
                                    {phase.icon} Fase {phase.name}
                                </span>
                                {periodActive && (
                                    <span className="animate-pulse w-3 h-3 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.6)]"></span>
                                )}
                            </div>

                            <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-1">
                                Día {phase.day}
                            </h2>
                            <p className="text-slate-600 dark:text-slate-300 text-sm font-medium leading-relaxed mb-4">
                                {phase.desc}
                            </p>

                            {/* Gym Advice Mini-Card */}
                            <div className="bg-white/50 dark:bg-black/20 rounded-xl p-3 flex items-start gap-3 backdrop-blur-sm">
                                <span className="text-xl">💪</span>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Gym & Energía</p>
                                    <p className="text-xs text-slate-700 dark:text-slate-200 font-semibold">
                                        {phase.gymAdvice}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                                ¡Hola! 👋 Registra el inicio de tu ciclo para que la magia comience.
                            </p>
                            <button
                                onClick={handleStartPeriod}
                                className="bg-gradient-to-r from-pink-400 to-rose-400 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-pink-200 dark:shadow-none hover:scale-105 transition-transform"
                            >
                                ¡Hoy empezó!
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Quick Actions ───────────────────────────────────────────────── */}
            <div className="px-6 mb-8 grid grid-cols-2 gap-3">

                {/* 1. START/END PERIOD BUTTONS */}
                {periodActive ? (
                    <button
                        onClick={handleEndPeriod}
                        className="col-span-2 bg-slate-900 dark:bg-slate-700 text-white py-4 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all"
                    >
                        <span className="material-symbols-outlined">stop_circle</span>
                        Ya terminó
                    </button>
                ) : (
                    // Only show Start if not active. 
                    // (Logic can be refined: if today is far from start date, show Start)
                    <button
                        onClick={handleStartPeriod}
                        className="col-span-2 bg-rose-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-rose-200 dark:shadow-none flex items-center justify-center gap-2 hover:bg-rose-600 active:scale-95 transition-all"
                    >
                        <span className="material-symbols-outlined">water_drop</span>
                        ¡Hoy empezó!
                    </button>
                )}

                {/* 2. LOG DAY BUTTON - ONLY IF ACTIVE */}
                {periodActive && (
                    <button
                        onClick={() => { setLogDate(todayStr()); setShowDailyModal(true); }}
                        className={`col-span-2 py-4 rounded-2xl font-bold border-2 flex items-center justify-center gap-2 transition-all
                            ${currentEntry
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800'
                                : 'bg-white border-pink-100 text-pink-500 hover:bg-pink-50 dark:bg-[#2d1820] dark:border-[#5a2b35] dark:text-pink-300'}`}
                    >
                        <span className="material-symbols-outlined">edit_note</span>
                        {currentEntry ? 'Editar registro de hoy' : 'Registrar día'}
                    </button>
                )}
            </div>

            {/* ── Intelligence / Predictions ──────────────────────────────────── */}
            {data.cycleStartDate && (
                <div className="px-6 mb-8">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 ml-1">Predicciones</h3>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                        {/* Next Period */}
                        <div className="flex-shrink-0 w-40 bg-white dark:bg-[#2d1820] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-[#5a2b35]/30">
                            <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center mb-2">
                                <span className="material-symbols-outlined text-sm">event</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Próximo periodo</p>
                            <p className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
                                {predictions.nextPeriod ? new Date(predictions.nextPeriod).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '--'}
                            </p>
                        </div>

                        {/* Fertile Window */}
                        <div className="flex-shrink-0 w-40 bg-white dark:bg-[#2d1820] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-[#5a2b35]/30">
                            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-500 flex items-center justify-center mb-2">
                                <span className="material-symbols-outlined text-sm">child_care</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Ventana Fértil</p>
                            <p className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
                                {predictions.fertileWindow ?
                                    `${new Date(predictions.fertileWindow.start).getDate()} - ${new Date(predictions.fertileWindow.end).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
                                    : '--'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Calendar Grid ───────────────────────────────────────────────── */}
            <div className="px-6 mb-8">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 ml-1">Calendario</h3>
                <div className="bg-white dark:bg-[#2d1820] rounded-3xl p-4 shadow-sm border border-slate-100 dark:border-[#5a2b35]/30">
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => (
                            <div key={d} className="text-center text-[10px] font-bold text-slate-300">{d}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: offset }).map((_, i) => <div key={`empty-${i}`} />)}
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                            const { entry, dStr } = getDayContent(d);
                            const isToday = dStr === today;

                            // Visuals
                            let bg = 'bg-transparent';
                            let text = 'text-slate-600 dark:text-slate-400';
                            let border = 'border-transparent';

                            if (isToday) {
                                border = 'border-slate-800 dark:border-slate-100';
                                text = 'font-bold text-slate-800 dark:text-slate-100';
                            }

                            if (entry) {
                                // Show visual indicator for any logged day
                                bg = 'bg-rose-100 dark:bg-rose-900/30';
                                text = 'text-rose-600 dark:text-rose-300 font-bold';
                            }

                            return (
                                <div
                                    key={d}
                                    onClick={() => onDayClick(dStr)}
                                    className={`aspect-square rounded-full flex flex-col items-center justify-center text-xs border cursor-pointer relative ${bg} ${text} ${border}`}
                                >
                                    <span>{d}</span>
                                    {/* Indicators */}
                                    <div className="flex gap-0.5 mt-0.5">
                                        {entry?.flow === 'light' && <div className="w-1 h-1 bg-rose-400 rounded-full" />}
                                        {entry?.flow === 'medium' && <div className="w-1.5 h-1.5 bg-rose-500 rounded-full" />}
                                        {entry?.flow === 'heavy' && <div className="w-2 h-2 bg-rose-600 rounded-full" />}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                MODAL: DAILY LOG
            ════════════════════════════════════════════════════════════════════ */}
            {showDailyModal && (
                <div className="fixed inset-0 z-[60] flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setShowDailyModal(false)} />

                    <div className="relative w-full max-w-md bg-white dark:bg-[#231218] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-y-auto max-h-[90vh] animate-slide-up">

                        {/* Drag Handle */}
                        <div className="flex justify-center pt-3 pb-1 sm:hidden">
                            <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />
                        </div>

                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    {isReadOnly ? 'Resumen del día 📅' : 'Registrar día 📝'}
                                    {isReadOnly && (
                                        <button
                                            onClick={() => setIsReadOnly(false)}
                                            className="ml-2 text-xs font-bold text-pink-500 bg-pink-50 px-3 py-1 rounded-full border border-pink-100"
                                        >
                                            Editar
                                        </button>
                                    )}
                                </h2>
                                <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-[#2d1820] text-xs font-bold text-slate-500">
                                    {new Date(logDate).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}
                                </span>
                            </div>

                            {/* ─── READ ONLY VIEW ─────────────────────────────── */}
                            {isReadOnly ? (
                                <div className="space-y-6">
                                    {/* Flow Summary */}
                                    <div className="bg-slate-50 dark:bg-[#2d1820] p-4 rounded-2xl flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-white dark:bg-[#3a2028] flex items-center justify-center text-xl shadow-sm">
                                            🩸
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-slate-400">Flujo</p>
                                            <p className="font-bold text-slate-700 dark:text-slate-200">
                                                {flow_level === 'light' ? 'Leve' : flow_level === 'medium' ? 'Medio' : flow_level === 'heavy' ? 'Abundante' : 'No registrado'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Energy Summary */}
                                    <div className="bg-slate-50 dark:bg-[#2d1820] p-4 rounded-2xl flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-white dark:bg-[#3a2028] flex items-center justify-center text-xl shadow-sm">
                                            {selectedEnergyConfig?.emoji || '⚡'}
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-slate-400">Energía</p>
                                            <p className="font-bold text-slate-700 dark:text-slate-200">
                                                {selectedEnergyConfig?.label || 'No registrada'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Symptoms Summary */}
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 ml-1">Síntomas</p>
                                        <div className="flex flex-wrap gap-2">
                                            {today_symptoms.length > 0 ? today_symptoms.map(sId => {
                                                const s = SYMPTOMS.find(sym => sym.id === sId);
                                                return (
                                                    <span key={sId} className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-bold border border-indigo-100 flex items-center gap-1">
                                                        {s?.icon} {s?.label || sId}
                                                    </span>
                                                );
                                            }) : (
                                                <p className="text-sm text-slate-400 italic pl-1">Ningún síntoma registrado.</p>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setShowDailyModal(false)}
                                        className="w-full py-4 rounded-2xl font-bold text-slate-600 bg-slate-100 dark:bg-[#3a2028] mt-4"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            ) : (
                                /* ─── EDIT FORM VIEW ─────────────────────────────── */
                                <>
                                    {/* 1. FLOW */}
                                    <div className="mb-8">
                                        {/* ... (Existing Flow UI) ... */}
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">Flujo Menstrual</label>
                                        <div className="flex gap-4 justify-between">
                                            <button
                                                onClick={() => setFlowLevel(flow_level === 'light' ? undefined : 'light')}
                                                className={`flex-1 overflow-visible py-3 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${flow_level === 'light' ? 'border-pink-300 bg-pink-50 dark:bg-pink-900/20' : 'border-slate-100 dark:border-[#5a2b35]/30'}`}
                                            >
                                                <div className="w-3 h-3 bg-rose-300 rounded-full shadow-sm" />
                                                <span className="text-[10px] font-bold text-slate-500">Leve</span>
                                            </button>
                                            <button
                                                onClick={() => setFlowLevel(flow_level === 'medium' ? undefined : 'medium')}
                                                className={`flex-1 py-3 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${flow_level === 'medium' ? 'border-rose-400 bg-rose-50 dark:bg-rose-900/20' : 'border-slate-100 dark:border-[#5a2b35]/30'}`}
                                            >
                                                <div className="flex gap-1"><div className="w-3 h-3 bg-rose-400 rounded-full shadow-sm" /><div className="w-3 h-3 bg-rose-400 rounded-full shadow-sm" /></div>
                                                <span className="text-[10px] font-bold text-slate-500">Medio</span>
                                            </button>
                                            <button
                                                onClick={() => setFlowLevel(flow_level === 'heavy' ? undefined : 'heavy')}
                                                className={`flex-1 py-3 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${flow_level === 'heavy' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-slate-100 dark:border-[#5a2b35]/30'}`}
                                            >
                                                <div className="flex gap-0.5"><div className="w-3 h-3 bg-red-500 rounded-full" /><div className="w-3 h-3 bg-red-500 rounded-full" /><div className="w-3 h-3 bg-red-500 rounded-full" /></div>
                                                <span className="text-[10px] font-bold text-slate-500">Fuerte</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* 2. ENERGY SLIDER */}
                                    <div className="mb-8 p-5 bg-slate-50 dark:bg-[#2d1820] rounded-3xl border border-slate-100 dark:border-[#5a2b35]/30">
                                        {/* ... (Existing Energy UI) ... */}
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex justify-between">
                                            <span>Nivel de Energía</span>
                                            <span>{selectedEnergyConfig?.emoji}</span>
                                        </label>

                                        {/* Current value display */}
                                        <div className="text-center mb-6">
                                            <h3 className={`text-lg font-black transition-colors ${selectedEnergyConfig?.color}`}>
                                                {selectedEnergyConfig?.label || 'Selecciona...'}
                                            </h3>
                                            <p className="text-xs text-slate-500 mt-1 h-4">{selectedEnergyConfig?.gym}</p>
                                        </div>

                                        {/* Slider Input */}
                                        <input
                                            type="range"
                                            min="0" max="4"
                                            step="1"
                                            value={ENERGY_LEVELS.findIndex(e => e.id === energy_level)}
                                            onChange={(e) => setEnergyLevel(ENERGY_LEVELS[parseInt(e.target.value)].id)}
                                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-800 dark:accent-pink-400"
                                        />
                                        <div className="flex justify-between mt-2 px-1">
                                            <span className="text-[10px] text-slate-400">Baja</span>
                                            <span className="text-[10px] text-slate-400">Alta</span>
                                        </div>

                                        {/* Smart Question: Cramps? */}
                                        {(energy_level === 'ahorro' || energy_level === 'poco') && (
                                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 animate-fade-in">
                                                <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">¿Es por cólicos? 😣</p>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setIsCramps(true)}
                                                        className={`px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all ${is_cramps ? 'bg-rose-400 border-rose-400 text-white' : 'border-slate-200'}`}
                                                    >Sí</button>
                                                    <button
                                                        onClick={() => setIsCramps(false)}
                                                        className={`px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all ${!is_cramps ? 'bg-slate-200 border-slate-200 text-slate-600' : 'border-slate-200 text-slate-400'}`}
                                                    >No</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* 3. SYMPTOMS */}
                                    <div className="mb-8">
                                        {/* ... (Existing Symptoms UI) ... */}
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">Síntomas</label>
                                        <div className="flex flex-wrap gap-2">
                                            {SYMPTOMS.map(sym => {
                                                const active = today_symptoms.includes(sym.id);
                                                return (
                                                    <button
                                                        key={sym.id}
                                                        onClick={() => toggleSymptom(sym.id)}
                                                        className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all
                                                            ${active
                                                                ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300 shadow-sm'
                                                                : 'bg-white dark:bg-[#2d1820] border-slate-100 dark:border-[#5a2b35]/30 text-slate-500'}`}
                                                    >
                                                        <span>{sym.icon}</span>
                                                        {sym.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* ACTION BUTTONS */}
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowDailyModal(false)}
                                            className="flex-1 py-4 rounded-2xl font-bold text-slate-500 bg-slate-100 dark:bg-[#3a2028] dark:text-slate-400"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={saveDailyLog}
                                            className="flex-1 py-4 rounded-2xl font-bold text-white bg-slate-900 dark:bg-pink-500 shadow-lg"
                                        >
                                            Guardar Registro
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
