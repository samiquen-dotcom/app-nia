import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFeatureData } from '../hooks/useFeatureData';
import type { PeriodData } from '../types';
import { calculatePhase, getPredictions, todayStr } from '../utils/cycleLogic';

export const CycleWidget: React.FC = () => {
    const navigate = useNavigate();
    const { data } = useFeatureData<PeriodData>('period', {
        cycleStartDate: '',
        cycleLength: 28,
        periodLength: 5,
        symptomsLog: {},
        dailyEntries: {}
    });

    let phase = data.cycleStartDate ? calculatePhase(data.cycleStartDate, data.cycleLength, data.periodLength) : null;
    const predictions = data.cycleStartDate ? getPredictions(data.cycleStartDate, data.cycleLength) : { nextPeriod: null, fertileWindow: null };
    // Override phase if manually active
    if (data.isPeriodActive && phase && phase.name !== 'Menstrual') {
        phase = { ...phase, name: 'Menstrual', desc: 'Periodo activo', color: 'text-rose-500', bg: 'bg-rose-100', icon: '🩸', gymAdvice: 'Yoga restaurativo o paseo ligero.' };
    }

    const today = new Date();

    // Calculate days until next period
    let daysUntil = 0;
    if (predictions.nextPeriod) {
        const next = new Date(predictions.nextPeriod);
        const timeDiff = next.getTime() - today.getTime();
        daysUntil = Math.ceil(timeDiff / (1000 * 3600 * 24));
    }

    const isPeriod = data.isPeriodActive === true;

    if (!data.cycleStartDate) {
        return (
            <div
                onClick={() => navigate('/period')}
                className="bg-gradient-to-br from-pink-100 to-rose-100 dark:from-[#3a2028] dark:to-[#2d1820] rounded-3xl p-6 shadow-sm border border-pink-200 dark:border-[#5a2b35] relative overflow-hidden cursor-pointer group hover:shadow-md transition-all"
            >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/40 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-1">Tu Ciclo 🌸</h3>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                            Configura tu calendario para recibir predicciones.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-rose-400 bg-white/50 dark:bg-black/20 p-2 rounded-full group-hover:scale-110 transition-transform">
                        settings
                    </span>
                </div>
            </div>
        );
    }

    // Check for missing entries since cycle start
    let targetLogDate = todayStr();
    let isDayMissing = false;
    let missingLabel = 'Registrar';

    if (isPeriod && data.cycleStartDate) {
        const start = new Date(data.cycleStartDate + 'T00:00:00'); // Ensure time normalization
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        // Iterate from start date to today
        const maxDays = 40; // Safety break
        for (let i = 0; i < maxDays; i++) {
            const current = new Date(start);
            current.setDate(start.getDate() + i);

            if (current > now) break; // Don't check future days

            const dStr = current.toISOString().split('T')[0];
            if (!data.dailyEntries?.[dStr]) {
                targetLogDate = dStr;
                isDayMissing = true;

                // Format label
                if (dStr === todayStr()) {
                    missingLabel = 'Registrar hoy';
                } else {
                    const diff = Math.ceil((now.getTime() - current.getTime()) / (1000 * 3600 * 24));
                    missingLabel = diff === 1 ? 'Registrar ayer' : `Falta el ${current.getDate()}`;
                }
                break;
            }
        }
    }

    return (
        <div
            onClick={() => navigate('/period')}
            className={`
                rounded-3xl p-6 shadow-sm border relative overflow-hidden cursor-pointer group hover:shadow-md transition-all
                ${isPeriod
                    ? (isDayMissing
                        ? 'bg-gradient-to-br from-rose-500 to-pink-600 text-white border-rose-400' // Urgent
                        : 'bg-gradient-to-br from-rose-100 to-pink-100 dark:from-[#3a2028] dark:to-[#2d1820] text-rose-900 dark:text-rose-100 border-rose-200 dark:border-[#5a2b35]') // Calm/Done
                    : 'bg-white dark:bg-[#2d1820] border-slate-50 dark:border-[#5a2b35]/30'
                }
            `}
        >
            {/* Background Decor */}
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2
                ${isPeriod
                    ? (isDayMissing ? 'bg-white/20' : 'bg-white/40 dark:bg-white/5')
                    : 'bg-pink-100/50 dark:bg-pink-900/10'}
            `}></div>

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide
                        ${isPeriod
                            ? (isDayMissing ? 'bg-white/20 text-white backdrop-blur-sm' : 'bg-white/50 text-rose-600 dark:bg-black/20 dark:text-rose-300')
                            : 'bg-rose-50 dark:bg-rose-900/20 text-rose-500 dark:text-rose-300'
                        }
                    `}>
                        {phase?.icon} {phase?.name}
                    </span>
                    <span className={`material-symbols-outlined text-sm ${isPeriod && isDayMissing ? 'text-white/80' : 'text-slate-300 dark:text-slate-500'}`}>
                        chevron_right
                    </span>
                </div>

                <div className="flex items-end justify-between">
                    <div>
                        {isPeriod ? (
                            isDayMissing ? (
                                // High urgency: Show big number and missing status
                                <>
                                    <p className="text-sm font-medium opacity-90 mb-0.5">Día del periodo</p>
                                    <h3 className="text-4xl font-black">{phase?.day}</h3>
                                </>
                            ) : (
                                // Low urgency: Show calm status, smaller text
                                <div className="flex flex-col justify-center h-full">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <span className="text-2xl">✨</span> Día {phase?.day}
                                    </h3>
                                    <p className="text-xs opacity-90 font-medium">Todo en orden hoy.</p>
                                </div>
                            )
                        ) : (
                            // Not period: Prediction mode
                            <>
                                <p className="text-xs text-slate-400 font-bold uppercase mb-1">Próximo periodo</p>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">
                                    {daysUntil === 0 ? '¡Hoy!' : daysUntil === 1 ? 'Mañana' : `En ${daysUntil} días`}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Día {phase?.day} del ciclo
                                </p>
                            </>
                        )}
                    </div>

                    {isPeriod && isDayMissing && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate('/period', { state: { openLog: true, targetDate: targetLogDate } });
                            }}
                            className="bg-white text-rose-500 px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-rose-700/20 hover:scale-105 transition-transform animate-pulse"
                        >
                            {missingLabel}
                        </button>
                    )}

                    {/* Removed redundant "Todo al día" badge since main text handles it */}
                </div>
            </div>
        </div>
    );
};
