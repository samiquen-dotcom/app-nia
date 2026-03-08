import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useFeatureData } from '../hooks/useFeatureData';
import type { PeriodData } from '../types';
import { calculatePhase, getPredictions, todayStr, getCycleRegularity, generateCycleInsights } from '../utils/cycleLogic';
import { CycleDayModal } from '../components/CycleDayModal';

export const PeriodScreen: React.FC = () => {
    const { data } = useFeatureData<PeriodData>('period', {
        cycleStartDate: '',
        cycleLength: 28,
        periodLength: 5,
        symptomsLog: {},
        dailyEntries: {}
    });

    const [showDailyModal, setShowDailyModal] = useState(false);
    const [logDate, setLogDate] = useState(todayStr());
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [selectedStatsMonth, setSelectedStatsMonth] = useState<string>('all');

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const location = useLocation();

    useEffect(() => {
        if (location.state && (location.state as any).openLog) {
            const target = (location.state as any).targetDate || today;
            setLogDate(target);
            setIsReadOnly(false);
            setShowDailyModal(true);
        }
    }, [location, today]);

    // Calcular periodActive dinámicamente:
    let periodActive = false;
    const allLoggedDates = Object.keys(data.dailyEntries || {}).filter(d => data.dailyEntries![d].hasBled !== undefined).sort();
    if (allLoggedDates.length > 0) {
        const lastDate = allLoggedDates[allLoggedDates.length - 1];
        periodActive = data.dailyEntries![lastDate].hasBled === true;
    }

    let phase = data.cycleStartDate ? calculatePhase(data.cycleStartDate, data.cycleLength, data.periodLength) : null;
    if (periodActive && phase && phase.name !== 'Menstrual') {
        phase = { ...phase, name: 'Menstrual', desc: 'Periodo activo', color: 'text-rose-500', bg: 'bg-rose-100', icon: '🩸', gymAdvice: 'Yoga restaurativo o paseo ligero.' };
    }

    const predictions = data.cycleStartDate ? getPredictions(data.cycleStartDate, data.cycleLength) : { nextPeriod: null, fertileWindow: null };

    const onDayClick = (dStr: string) => {
        setLogDate(dStr);
        setIsReadOnly(dStr !== today); // Past days default to Read-Only overview
        setShowDailyModal(true);
    };

    // Calendar logic
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;

    const getDayContent = (day: number) => {
        const dStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const entry = data.dailyEntries?.[dStr];
        return { entry, dStr };
    };

    // --- Statistics Calculations ---
    const dailyEntriesArr = Object.values(data.dailyEntries || {});
    const availableStatsMonths = Array.from(new Set(dailyEntriesArr.map(e => e.date.substring(0, 7)))).sort().reverse();

    const filteredEntries = selectedStatsMonth === 'all'
        ? dailyEntriesArr
        : dailyEntriesArr.filter(e => e.date.startsWith(selectedStatsMonth));

    const totalLoggedDays = filteredEntries.length;

    const moodCounts = filteredEntries.reduce((acc, curr) => {
        if (curr.moodLabel && curr.moodEmoji) {
            const key = `${curr.moodEmoji}|${curr.moodLabel}`;
            acc[key] = (acc[key] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);
    const topMoodKey = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topMood = topMoodKey ? topMoodKey.split('|') : null; // [emoji, label]

    const symptomCounts = filteredEntries.reduce((acc, curr) => {
        if (curr.symptoms && curr.symptoms.length > 0) {
            curr.symptoms.forEach(s => {
                acc[s] = (acc[s] || 0) + 1;
            });
        }
        return acc;
    }, {} as Record<string, number>);
    const topSymptom = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    // Pain calc
    const painEntries = filteredEntries.filter(e => e.painLevel !== undefined && e.painLevel > 0);
    const avgPain = painEntries.length > 0
        ? (painEntries.reduce((sum, e) => sum + e.painLevel!, 0) / painEntries.length).toFixed(1)
        : '0';

    const formatMonthName = (yyyy_mm: string) => {
        const [year, month] = yyyy_mm.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        const name = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        return name.charAt(0).toUpperCase() + name.slice(1);
    };
    // -------------------------------


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
                            <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-1 flex items-baseline gap-2">
                                Día {phase.day} <span className="text-xl font-bold text-slate-400 dark:text-slate-500">{periodActive ? 'de tu periodo' : 'de tu ciclo'}</span>
                            </h2>
                            <p className="text-slate-600 dark:text-slate-300 text-sm font-medium leading-relaxed mb-4">
                                {phase.desc}
                            </p>
                            <div className="bg-white/50 dark:bg-black/20 rounded-xl p-3 flex items-start gap-3 backdrop-blur-sm">
                                <span className="text-xl">💪</span>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Gym & Energía</p>
                                    <p className="text-xs text-slate-700 dark:text-slate-200 font-semibold">{phase.gymAdvice}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                                ¡Hola! 👋 Clickea un día del calendario para registrarte.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Intelligence / Predictions ──────────────────────────────────── */}
            {data.cycleStartDate && (
                <div className="px-6 mb-8">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 ml-1">Predicciones</h3>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                        <div className="flex-shrink-0 w-40 bg-white dark:bg-[#2d1820] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-[#5a2b35]/30">
                            <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center mb-2">
                                <span className="material-symbols-outlined text-sm">event</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Próximo periodo</p>
                            <p className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
                                {predictions.nextPeriod ? new Date(predictions.nextPeriod).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '--'}
                            </p>
                        </div>
                        <div className="flex-shrink-0 w-40 bg-white dark:bg-[#2d1820] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-[#5a2b35]/30">
                            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-500 flex items-center justify-center mb-2">
                                <span className="material-symbols-outlined text-sm">child_care</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Ventana Fértil</p>
                            <p className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
                                {predictions.fertileWindow ? `${new Date(predictions.fertileWindow.start).getDate()} - ${new Date(predictions.fertileWindow.end).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : '--'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Mis Patrones (Insights & Regularidad) ────────────────────────── */}
            {data.cycleStartDate && (
                <div className="px-6 mb-8">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 ml-1 flex items-center justify-between">
                        Patrones de tu ciclo ✨
                        {(() => {
                            const regularity = getCycleRegularity(data.cycleLength);
                            return <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${regularity.color}`}>Semáforo: {regularity.label}</span>;
                        })()}
                    </h3>
                    <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-[#2a2035] dark:to-[#1a0d10] p-5 rounded-[2rem] shadow-sm border border-indigo-100 dark:border-indigo-900/30">
                        <ul className="space-y-3">
                            {generateCycleInsights(data).map((insight, idx) => (
                                <li key={idx} className="flex gap-3 items-start animate-fade-in" style={{ animationDelay: `${idx * 150}ms` }}>
                                    <span className="text-indigo-400 mt-0.5 text-lg">✦</span>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-snug">{insight}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* ── Calendar Grid ───────────────────────────────────────────────── */}
            <div className="px-6 mb-8 max-w-lg mx-auto w-full">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 ml-1 text-center sm:text-left">Calendario</h3>
                <div className="bg-white dark:bg-[#2d1820] rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-100 dark:border-[#5a2b35]/30">
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
                            let bg = 'bg-transparent';
                            let text = 'text-slate-600 dark:text-slate-400';
                            let border = 'border-transparent';

                            if (isToday) {
                                border = 'border-slate-800 dark:border-slate-100';
                                text = 'font-bold text-slate-800 dark:text-slate-100';
                            }
                            if (entry) {
                                bg = 'bg-rose-100 dark:bg-rose-900/30';
                                text = 'text-rose-600 dark:text-rose-300 font-bold';
                                if (entry.hasBled) {
                                    bg = 'bg-rose-500';
                                    text = 'text-white font-bold';
                                }
                            }

                            return (
                                <div key={d} onClick={() => onDayClick(dStr)} className={`aspect-square rounded-full flex flex-col items-center justify-center text-xs border cursor-pointer relative ${bg} ${text} ${border}`}>
                                    <span>{d}</span>
                                    <div className="flex gap-0.5 mt-0.5">
                                        {entry?.flow === 'light' && <div className="w-1 h-1 bg-white rounded-full" />}
                                        {entry?.flow === 'medium' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                        {entry?.flow === 'heavy' && <div className="w-2 h-2 bg-white rounded-full" />}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Tus Estadísticas ───────────────────────────────────────────── */}
            <div className="px-6 mb-10 w-full">
                <div className="flex justify-between items-end mb-4 pr-1">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider ml-1">Tus Estadísticas</h3>
                    <select
                        value={selectedStatsMonth}
                        onChange={(e) => setSelectedStatsMonth(e.target.value)}
                        className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border-none outline-none py-1.5 pl-3 pr-8 rounded-full cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2024%24%24%22%20fill%3D%22none%22%20stroke%3D%22%23e11d48%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_4px_center] bg-[length:16px_16px]"
                    >
                        <option value="all">Histórico completo</option>
                        {availableStatsMonths.map(m => (
                            <option key={m} value={m}>{formatMonthName(m)}</option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white dark:bg-[#2d1820] p-4 rounded-3xl shadow-sm border border-slate-50 dark:border-[#5a2b35]/30 flex flex-col items-center text-center">
                        <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-500 dark:bg-indigo-900/20 dark:text-indigo-400 flex items-center justify-center mb-2">
                            <span className="material-symbols-outlined text-2xl">calendar_month</span>
                        </div>
                        <span className="text-3xl font-black text-slate-700 dark:text-slate-200">{totalLoggedDays}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">Días Medidos</span>
                    </div>

                    <div className="bg-white dark:bg-[#2d1820] p-4 rounded-3xl shadow-sm border border-slate-50 dark:border-[#5a2b35]/30 flex flex-col items-center text-center">
                        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 dark:bg-rose-900/20 dark:text-rose-400 flex items-center justify-center mb-2">
                            <span className="material-symbols-outlined text-2xl">healing</span>
                        </div>
                        <span className="text-3xl font-black text-slate-700 dark:text-slate-200">{avgPain}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">Dolor Prom. / 10</span>
                    </div>

                    <div className="col-span-2 bg-white dark:bg-[#2d1820] p-5 rounded-3xl shadow-sm border border-slate-50 dark:border-[#5a2b35]/30 flex items-center gap-4">
                        <div className="w-14 h-14 shrink-0 rounded-2xl bg-amber-50 text-amber-500 dark:bg-amber-900/20 dark:text-amber-400 flex items-center justify-center text-3xl shadow-sm">
                            {topMood ? topMood[0] : '😶'}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-slate-400">Estado de Ánimo Frecuente</span>
                            <span className="text-lg font-bold text-slate-700 dark:text-slate-200">{topMood ? topMood[1] : 'No registrado'}</span>
                        </div>
                    </div>

                    <div className="col-span-2 bg-white dark:bg-[#2d1820] p-5 rounded-3xl shadow-sm border border-slate-50 dark:border-[#5a2b35]/30 flex items-center gap-4">
                        <div className="w-14 h-14 shrink-0 rounded-2xl bg-fuchsia-50 text-fuchsia-500 dark:bg-fuchsia-900/20 dark:text-fuchsia-400 flex items-center justify-center text-3xl shadow-sm">
                            🤒
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-slate-400">Síntoma Principal</span>
                            <span className="text-lg font-bold text-slate-700 dark:text-slate-200">{topSymptom || 'Ninguno'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL UNIFICADO */}
            {showDailyModal && (
                <CycleDayModal
                    date={logDate}
                    initialMode={isReadOnly ? 'readonly' : 'edit'}
                    onClose={() => setShowDailyModal(false)}
                />
            )}
        </div>
    );
};
