import React from 'react';
import { useFeatureData } from '../hooks/useFeatureData';
import type { GymData } from '../types';

const WORKOUTS = [
    { id: 'cardio',  icon: 'directions_run',   label: 'Cardio' },
    { id: 'weights', icon: 'fitness_center',   label: 'Pesas' },
    { id: 'yoga',    icon: 'self_improvement', label: 'Yoga' },
    { id: 'stretch', icon: 'accessibility_new', label: 'Estirar' },
];

const WEEK_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const todayStr = () => new Date().toISOString().split('T')[0];

const getWeekDates = (): string[] => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d.toISOString().split('T')[0];
    });
};

const calculateStreak = (history: { date: string }[]): number => {
    const dates = new Set(history.map(h => h.date));
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yestStr = yesterday.toISOString().split('T')[0];

    const start = dates.has(todayStr()) ? today : (dates.has(yestStr) ? yesterday : null);
    if (!start) return 0;

    let streak = 0;
    const check = new Date(start);
    while (dates.has(check.toISOString().split('T')[0])) {
        streak++;
        check.setDate(check.getDate() - 1);
    }
    return streak;
};

export const GymScreen: React.FC = () => {
    const { data, save } = useFeatureData<GymData>('gym', { streak: 0, history: [] });
    const weekDates = getWeekDates();
    const todayEntry = data.history.find(h => h.date === todayStr());

    const handleLog = async (workoutId: string) => {
        const today = todayStr();
        let newHistory = data.history.filter(h => h.date !== today);
        if (todayEntry?.workoutId !== workoutId) {
            newHistory = [{ date: today, workoutId }, ...newHistory];
        }
        await save({ history: newHistory, streak: calculateStreak(newHistory) });
    };

    return (
        <div className="p-6 pt-12 pb-24">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">¡A moverse, Nia! 💪</h1>

            {/* Streak Card */}
            <div className="bg-slate-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden mb-8">
                <div className="relative z-10 flex flex-col items-center text-center">
                    <span className="material-symbols-outlined text-4xl text-orange-400 mb-2 animate-bounce">local_fire_department</span>
                    <h2 className="text-5xl font-extrabold mb-1">{data.streak}</h2>
                    <p className="text-slate-400 font-medium">Días seguidos 🔥</p>
                    <p className="text-sm mt-3 text-orange-200 font-medium">
                        {data.streak === 0 ? '¡Empieza hoy tu racha, Nia!' : '¡Sigue así, Nia! Eres increíble.'}
                    </p>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12"></div>
            </div>

            {/* Weekly Tracker */}
            <div className="mb-8">
                <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3">Esta semana</h3>
                <div className="flex justify-between bg-white dark:bg-[#2d1820] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-[#5a2b35]/30">
                    {weekDates.map((date, i) => {
                        const hasWorkout = data.history.some(h => h.date === date);
                        const isToday    = date === todayStr();
                        return (
                            <div key={date} className="flex flex-col items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                                    ${isToday ? 'ring-2 ring-primary ring-offset-1' : ''}
                                    ${hasWorkout
                                        ? 'bg-green-100 text-green-600'
                                        : 'bg-slate-50 dark:bg-[#3a2028] text-slate-300'}`}
                                >
                                    {hasWorkout && <span className="material-symbols-outlined text-sm">check</span>}
                                </div>
                                <span className={`text-xs font-medium ${isToday ? 'text-primary font-bold' : 'text-slate-400'}`}>
                                    {WEEK_LABELS[i]}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Log Today */}
            <div>
                <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3">Registrar hoy</h3>
                <div className="grid grid-cols-2 gap-3">
                    {WORKOUTS.map(w => (
                        <button
                            key={w.id}
                            onClick={() => handleLog(w.id)}
                            className={`p-4 rounded-2xl flex items-center gap-3 transition-all
                                ${todayEntry?.workoutId === w.id
                                    ? 'bg-primary text-slate-800 ring-2 ring-primary ring-offset-2'
                                    : 'bg-white dark:bg-[#2d1820] hover:bg-slate-50 dark:hover:bg-[#3a2028] border border-slate-100 dark:border-[#5a2b35]/30'}`}
                        >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${todayEntry?.workoutId === w.id ? 'bg-white/50' : 'bg-slate-100 dark:bg-[#3a2028]'}`}>
                                <span className="material-symbols-outlined">{w.icon}</span>
                            </div>
                            <span className="font-bold text-sm">{w.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
