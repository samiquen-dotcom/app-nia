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

    const [selectedMonth, setSelectedMonth] = useState<string>('all');

    const weekDates = getWeekDates();
    const todayEntry = data.history.find(h => h.date === todayStr());

    // Calculate progress for current week
    const thisWeekWorkouts = weekDates.filter(date => data.history.some(h => h.date === date)).length;
    const progressPercent = Math.min((thisWeekWorkouts / data.goalDaysPerWeek) * 100, 100);

    // --- Statistics Calculations ---
    const availableMonths = Array.from(new Set(data.history.map(h => h.date.substring(0, 7)))).sort().reverse();

    const filteredHistory = selectedMonth === 'all'
        ? data.history
        : data.history.filter(h => h.date.startsWith(selectedMonth));

    const totalWorkouts = filteredHistory.length;

    // Calculate perfect weeks
    const getMonday = (dateStr: string) => {
        const d = new Date(dateStr);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff)).toISOString().split('T')[0];
    };

    const workoutsPerWeek = filteredHistory.reduce((acc, curr) => {
        const monday = getMonday(curr.date);
        acc[monday] = (acc[monday] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const perfectWeeks = Object.values(workoutsPerWeek).filter(count => count >= data.goalDaysPerWeek).length;

    // Calculate favorite routine
    const routineCounts = filteredHistory.reduce((acc, curr) => {
        acc[curr.workoutId] = (acc[curr.workoutId] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const favoriteRoutineId = Object.keys(routineCounts).sort((a, b) => routineCounts[b] - routineCounts[a])[0];
    const favoriteRoutine = data.customRoutines.find(r => r.id === favoriteRoutineId);
    const favoriteRoutineCount = favoriteRoutineId ? routineCounts[favoriteRoutineId] : 0;

    const formatMonth = (yyyy_mm: string) => {
        const [year, month] = yyyy_mm.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        const name = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        return name.charAt(0).toUpperCase() + name.slice(1);
    };
    // -------------------------------

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

            {/* Statistics Section */}
            <div className="mt-10 mb-4">
                <div className="flex justify-between items-end mb-4 pr-1">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 ml-1">Estadísticas</h3>
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-none outline-none py-1.5 pl-3 pr-8 rounded-full cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2024%24%24%22%20fill%3D%22none%22%20stroke%3D%22%2310b981%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_4px_center] bg-[length:16px_16px]"
                    >
                        <option value="all">Histórico completo</option>
                        {availableMonths.map(m => (
                            <option key={m} value={m}>{formatMonth(m)}</option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white dark:bg-[#2d1820] p-4 rounded-2xl shadow-sm border border-slate-50 dark:border-[#5a2b35]/30 flex flex-col items-center text-center">
                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 dark:bg-blue-900/20 dark:text-blue-400 flex items-center justify-center mb-2">
                            <span className="material-symbols-outlined">bolt</span>
                        </div>
                        <span className="text-2xl font-black text-slate-700 dark:text-slate-200">{totalWorkouts}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">Entrenamientos</span>
                    </div>

                    <div className="bg-white dark:bg-[#2d1820] p-4 rounded-2xl shadow-sm border border-slate-50 dark:border-[#5a2b35]/30 flex flex-col items-center text-center">
                        <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-500 dark:bg-orange-900/20 dark:text-orange-400 flex items-center justify-center mb-2">
                            <span className="material-symbols-outlined">emoji_events</span>
                        </div>
                        <span className="text-2xl font-black text-slate-700 dark:text-slate-200">{perfectWeeks}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">Semanas Perfectas</span>
                    </div>

                    <div className="col-span-2 bg-white dark:bg-[#2d1820] p-4 rounded-2xl shadow-sm border border-slate-50 dark:border-[#5a2b35]/30 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-500 dark:bg-purple-900/20 dark:text-purple-400 flex items-center justify-center text-2xl">
                                {favoriteRoutine?.icon || '⭐'}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase font-bold text-slate-400">Rutina Favorita</span>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{favoriteRoutine?.label || 'Ninguna'}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-xl font-black text-slate-700 dark:text-slate-200">{favoriteRoutineCount}</span>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Veces</span>
                        </div>
                    </div>
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
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block ml-1">Emoji</label>
                                <div className="flex justify-center">
                                    <input
                                        type="text"
                                        value={newRoutineEmoji}
                                        onChange={(e) => {
                                            // Only allow a few characters max, expecting just one or two emojis
                                            const val = e.target.value.substring(0, 4);
                                            setNewRoutineEmoji(val || '💪');
                                        }}
                                        onClick={() => {
                                            // Clear default if it's the default, to make it easier to type a new one
                                            if (newRoutineEmoji === '💪') setNewRoutineEmoji('');
                                        }}
                                        className="w-16 h-16 text-3xl text-center bg-white dark:bg-[#1a0d10] border-2 border-emerald-100 dark:border-emerald-900/50 rounded-2xl shadow-sm focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:opacity-30"
                                        placeholder="💪"
                                    />
                                </div>
                                <p className="text-[10px] text-center text-slate-400 mt-2">Usa tu teclado para elegir un emoji</p>
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
