import React, { useState } from 'react';
import { useFeatureData } from '../hooks/useFeatureData';
import type { GymData, GymRoutine } from '../types';

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

export const GymScreen: React.FC = () => {
    const { data, save } = useFeatureData<GymData>('gym', {
        goalDaysPerWeek: 5,
        streak: 0,
        history: [],
        customRoutines: [
            { id: 'cardio', icon: '🏃‍♀️', label: 'Cardio' },
            { id: 'weights', icon: '🏋️‍♀️', label: 'Pesas' },
            { id: 'yoga', icon: '🧘‍♀️', label: 'Yoga' }
        ]
    });

    const [isEditingGoal, setIsEditingGoal] = useState(false);
    const [tempGoal, setTempGoal] = useState(data.goalDaysPerWeek);

    const [isCreatingRoutine, setIsCreatingRoutine] = useState(false);
    const [newRoutineEmoji, setNewRoutineEmoji] = useState('💪');
    const [newRoutineName, setNewRoutineName] = useState('');

    const weekDates = getWeekDates();
    const todayEntry = data.history.find(h => h.date === todayStr());

    // Calculate progress for current week
    const thisWeekWorkouts = weekDates.filter(date => data.history.some(h => h.date === date)).length;
    const progressPercent = Math.min((thisWeekWorkouts / data.goalDaysPerWeek) * 100, 100);

    const handleSaveGoal = async () => {
        await save({ ...data, goalDaysPerWeek: tempGoal });
        setIsEditingGoal(false);
    };

    const handleCreateRoutine = async () => {
        if (!newRoutineName.trim()) return;
        const newRoutine: GymRoutine = {
            id: 'rtn_' + Date.now(),
            icon: newRoutineEmoji,
            label: newRoutineName.trim()
        };
        await save({ ...data, customRoutines: [...data.customRoutines, newRoutine] });
        setIsCreatingRoutine(false);
        setNewRoutineName('');
        setNewRoutineEmoji('💪');
    };

    const handleDeleteRoutine = async (id: string) => {
        if (window.confirm('¿Segura que quieres eliminar esta rutina?')) {
            await save({ ...data, customRoutines: data.customRoutines.filter(r => r.id !== id) });
        }
    };

    // Allows logging directly from here just in case they don't want to use the modal
    const handleLogToggle = async (date: string, workoutId: string) => {
        const isCurrentlyLogged = data.history.find(h => h.date === date)?.workoutId === workoutId;
        let newHistory = data.history.filter(h => h.date !== date);

        if (!isCurrentlyLogged) {
            newHistory.push({ date, workoutId });
        }

        await save({ ...data, history: newHistory });
    };

    return (
        <div className="p-6 pt-12 pb-24">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">¡A moverse, Nia! 💪</h1>

            {/* Goal Card */}
            <div className="bg-emerald-600 dark:bg-emerald-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden mb-8">
                <div className="relative z-10 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-emerald-200 font-bold uppercase tracking-wider text-xs">Progreso Semanal</p>
                            <h2 className="text-4xl font-black mt-1">
                                {thisWeekWorkouts} <span className="text-2xl text-emerald-300">/ {data.goalDaysPerWeek} días</span>
                            </h2>
                        </div>
                        <button onClick={() => { setIsEditingGoal(true); setTempGoal(data.goalDaysPerWeek); }} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors">
                            <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-3 w-full bg-black/20 rounded-full overflow-hidden mt-2">
                        <div
                            className="h-full bg-white rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>

                    <p className="text-sm mt-4 text-emerald-100 font-medium">
                        {thisWeekWorkouts === 0 ? '¡Arranca la semana con energía!' :
                            thisWeekWorkouts >= data.goalDaysPerWeek ? '¡Meta semanal cumplida! Eres imparable 🔥' :
                                '¡Sigue así, vas por buen camino! ✨'}
                    </p>
                </div>

                {/* Decorative blobs */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12 pointer-events-none"></div>
            </div>

            {/* Goal Editor Modal */}
            {isEditingGoal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsEditingGoal(false)}></div>
                    <div className="relative bg-white dark:bg-[#231218] p-6 rounded-3xl w-full max-w-sm shadow-2xl">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 text-center">Meta Semanal</h3>
                        <p className="text-sm text-slate-500 text-center mb-6">¿Cuántos días por semana quieres ir al Gym?</p>

                        <div className="flex items-center justify-center gap-4 mb-8">
                            <button onClick={() => setTempGoal(Math.max(1, tempGoal - 1))} className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#3a2028] text-xl font-bold hover:bg-slate-200 transition-colors">-</button>
                            <span className="text-4xl font-black text-emerald-500 w-16 text-center">{tempGoal}</span>
                            <button onClick={() => setTempGoal(Math.min(7, tempGoal + 1))} className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#3a2028] text-xl font-bold hover:bg-slate-200 transition-colors">+</button>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setIsEditingGoal(false)} className="flex-1 py-3 rounded-xl font-bold bg-slate-100 text-slate-600 dark:bg-[#3a2028] dark:text-slate-300">Cancelar</button>
                            <button onClick={handleSaveGoal} className="flex-1 py-3 rounded-xl font-bold bg-emerald-500 text-white shadow-lg active:scale-95 transition-transform">Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Weekly Tracker Calendar */}
            <div className="mb-10">
                <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3 ml-1">Esta semana</h3>
                <div className="flex justify-between bg-white dark:bg-[#2d1820] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-[#5a2b35]/30">
                    {weekDates.map((date, i) => {
                        const historyEntry = data.history.find(h => h.date === date);
                        const hasWorkout = !!historyEntry;
                        const isToday = date === todayStr();
                        const assignedRoutine = hasWorkout ? data.customRoutines.find(r => r.id === historyEntry.workoutId) : null;

                        return (
                            <div key={date} className="flex flex-col items-center gap-2 relative group">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm transition-all
                                    ${isToday ? 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-[#1a0d10]' : ''}
                                    ${hasWorkout
                                        ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                        : 'bg-slate-50 dark:bg-[#3a2028] text-slate-300 border border-slate-100 dark:border-white/5'}`}
                                >
                                    {hasWorkout ? (assignedRoutine?.icon || '💪') : ''}
                                </div>
                                <span className={`text-[10px] font-medium uppercase ${isToday ? 'text-emerald-500 font-bold' : 'text-slate-400'}`}>
                                    {WEEK_LABELS[i]}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Custom Routines Manager */}
            <div>
                <div className="flex justify-between items-end mb-4 pr-1">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 ml-1">Mis Rutinas</h3>
                    <button onClick={() => setIsCreatingRoutine(true)} className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-colors">
                        + Nueva
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.customRoutines.map(routine => {
                        const isLoggedToday = todayEntry?.workoutId === routine.id;

                        return (
                            <div key={routine.id} className={`p-4 rounded-2xl flex items-center justify-between border transition-all ${isLoggedToday ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800' : 'bg-white border-slate-100 dark:bg-[#2d1820] dark:border-[#5a2b35]/30'}`}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-[#3a2028] flex items-center justify-center text-xl shadow-sm border border-slate-100 dark:border-white/5">
                                        {routine.icon}
                                    </div>
                                    <span className={`font-bold text-sm ${isLoggedToday ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                        {routine.label}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {/* Quick log button from Gym screen directly */}
                                    <button
                                        onClick={() => handleLogToggle(todayStr(), routine.id)}
                                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isLoggedToday ? 'text-emerald-500 bg-white dark:bg-emerald-950 shadow-sm' : 'text-slate-300 hover:bg-slate-50 dark:hover:bg-[#3a2028]'}`}
                                    >
                                        <span className="material-symbols-outlined text-sm">{isLoggedToday ? 'check_circle' : 'add_circle'}</span>
                                    </button>
                                    <button onClick={() => handleDeleteRoutine(routine.id)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                        <span className="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {data.customRoutines.length === 0 && (
                        <div className="col-span-full p-6 bg-slate-50 dark:bg-[#2d1820] rounded-2xl text-center border border-dashed border-slate-200 dark:border-white/10">
                            <p className="text-slate-400 text-sm mb-2">Aún no tienes rutinas creadas.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Routine Modal */}
            {isCreatingRoutine && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCreatingRoutine(false)}></div>
                    <div className="relative bg-white dark:bg-[#231218] p-6 rounded-3xl w-full max-w-sm shadow-2xl animate-in zoom-in-95">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 text-center">Nueva Rutina</h3>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Emoji</label>
                                <div className="flex gap-2 justify-center bg-slate-50 dark:bg-[#3a2028] p-2 rounded-xl border border-slate-100 dark:border-white/5">
                                    {['💪', '🏋️‍♀️', '🏃‍♀️', '🧘‍♀️', '🍑', '🥊', '🏊‍♀️'].map(emoji => (
                                        <button
                                            key={emoji}
                                            onClick={() => setNewRoutineEmoji(emoji)}
                                            className={`w-10 h-10 rounded-lg text-xl transition-all ${newRoutineEmoji === emoji ? 'bg-white shadow-sm scale-110' : 'opacity-60 hover:opacity-100 hover:scale-105'}`}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block ml-1">Nombre</label>
                                <input
                                    type="text"
                                    value={newRoutineName}
                                    onChange={(e) => setNewRoutineName(e.target.value)}
                                    placeholder="Ej: Día de Pierna..."
                                    className="w-full bg-slate-50 dark:bg-[#3a2028] border border-slate-200 dark:border-white/10 p-4 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800 dark:text-slate-100"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setIsCreatingRoutine(false)} className="flex-1 py-4 rounded-xl font-bold bg-slate-100 text-slate-600 dark:bg-[#3a2028] dark:text-slate-300">Cancelar</button>
                            <button
                                onClick={handleCreateRoutine}
                                disabled={!newRoutineName.trim()}
                                className="flex-1 py-4 rounded-xl font-bold bg-emerald-500 text-white shadow-lg active:scale-95 transition-transform disabled:opacity-50"
                            >
                                Crear
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
