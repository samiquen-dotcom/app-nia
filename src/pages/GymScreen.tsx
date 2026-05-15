import React, { useState } from 'react';
import { useFeatureData } from '../hooks/useFeatureData';
import type { GymData, GymRoutine, GymSession, BodyMeasurement } from '../types';
import { todayStr, getCurrentWeekDates } from '../utils/dateHelpers';
import { sessionSummary, isPersonalRecord } from '../utils/gymLogic';
import { RoutineEditorModal } from './gym/RoutineEditorModal';
import { SessionDetailModal } from './gym/SessionDetailModal';
import { MeasurementsCard } from './gym/MeasurementsCard';

const WEEK_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const DEFAULT_ROUTINES: GymRoutine[] = [
    { id: 'cardio', icon: '🏃‍♀️', label: 'Cardio', exercises: [] },
    { id: 'weights', icon: '🏋️‍♀️', label: 'Pesas', exercises: [] },
    { id: 'yoga', icon: '🧘‍♀️', label: 'Yoga', exercises: [] },
];

export const GymScreen: React.FC = () => {
    const { data, save } = useFeatureData<GymData>('gym', {
        goalDaysPerWeek: 5,
        streak: 0,
        history: [],
        customRoutines: DEFAULT_ROUTINES,
        measurements: [],
    });

    const [isEditingGoal, setIsEditingGoal] = useState(false);
    const [tempGoal, setTempGoal] = useState(data.goalDaysPerWeek);
    const [selectedMonth, setSelectedMonth] = useState<string>('all');

    // Modales
    const [routineEditor, setRoutineEditor] = useState<{ open: boolean; routine?: GymRoutine }>({ open: false });
    const [detailModal, setDetailModal] = useState<{ routine: GymRoutine; session: GymSession } | null>(null);
    const [prToast, setPrToast] = useState<string | null>(null);

    const weekDates = getCurrentWeekDates();
    const today = todayStr();
    const history = data.history ?? [];
    const routines = data.customRoutines ?? [];

    // Progreso semanal
    const thisWeekWorkouts = weekDates.filter(date => history.some(h => h.date === date)).length;
    const progressPercent = Math.min((thisWeekWorkouts / data.goalDaysPerWeek) * 100, 100);

    // ─── Estadísticas ─────────────────────────────────────────────────────────
    const availableMonths = Array.from(new Set(history.map(h => h.date.substring(0, 7)))).sort().reverse();
    const filteredHistory = selectedMonth === 'all' ? history : history.filter(h => h.date.startsWith(selectedMonth));
    const totalWorkouts = filteredHistory.length;

    const getMonday = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00');
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    };
    const uniqueWorkoutDates = Array.from(new Set(filteredHistory.map(h => h.date)));
    const workoutsPerWeek = uniqueWorkoutDates.reduce((acc, date) => {
        const monday = getMonday(date);
        acc[monday] = (acc[monday] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const perfectWeeks = Object.values(workoutsPerWeek).filter(c => c >= data.goalDaysPerWeek).length;

    const routineCounts = filteredHistory.reduce((acc, curr) => {
        acc[curr.workoutId] = (acc[curr.workoutId] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const favoriteRoutineId = Object.keys(routineCounts).sort((a, b) => routineCounts[b] - routineCounts[a])[0];
    const favoriteRoutine = routines.find(r => r.id === favoriteRoutineId);
    const favoriteRoutineCount = favoriteRoutineId ? routineCounts[favoriteRoutineId] : 0;

    // Última sesión con detalle (para mostrar progresión en stats)
    const lastDetailed = [...history]
        .filter(h => h.exercises && h.exercises.length > 0)
        .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    const lastDetailedRoutine = lastDetailed ? routines.find(r => r.id === lastDetailed.workoutId) : null;

    const formatMonth = (yyyy_mm: string) => {
        const [year, month] = yyyy_mm.split('-');
        const name = new Date(parseInt(year), parseInt(month) - 1, 1)
            .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        return name.charAt(0).toUpperCase() + name.slice(1);
    };

    // ─── Acciones ─────────────────────────────────────────────────────────────
    const handleSaveGoal = () => {
        save({ ...data, goalDaysPerWeek: tempGoal });
        setIsEditingGoal(false);
    };

    const saveRoutine = (routine: GymRoutine) => {
        const exists = routines.some(r => r.id === routine.id);
        const next = exists
            ? routines.map(r => r.id === routine.id ? routine : r)
            : [...routines, routine];
        save({ ...data, customRoutines: next });
        setRoutineEditor({ open: false });
    };

    const deleteRoutine = (id: string) => {
        if (!window.confirm('¿Eliminar esta rutina? El historial de sesiones se conserva.')) return;
        save({ ...data, customRoutines: routines.filter(r => r.id !== id) });
    };

    // Quick log: marca/desmarca una rutina para hoy
    const toggleQuickLog = (routineId: string) => {
        const logged = history.some(h => h.date === today && h.workoutId === routineId);
        const next = logged
            ? history.filter(h => !(h.date === today && h.workoutId === routineId))
            : [...history, { date: today, workoutId: routineId }];
        save({ ...data, history: next });
    };

    // Guardar detalle de una sesión (reemplaza la sesión existente por date+workoutId)
    const saveSessionDetail = (session: GymSession) => {
        // Detectar PRs para celebrar
        const prNames: string[] = [];
        for (const ex of session.exercises ?? []) {
            if (isPersonalRecord(history, ex.exerciseId, ex.kind, ex.sets, session.date)) {
                prNames.push(ex.name);
            }
        }
        const next = history.some(h => h.date === session.date && h.workoutId === session.workoutId)
            ? history.map(h => (h.date === session.date && h.workoutId === session.workoutId) ? session : h)
            : [...history, session];
        save({ ...data, history: next });
        setDetailModal(null);
        if (prNames.length > 0) {
            setPrToast(`🏆 ¡Récord personal en ${prNames.join(', ')}!`);
            setTimeout(() => setPrToast(null), 3500);
        }
    };

    const saveMeasurements = (next: BodyMeasurement[]) => {
        save({ ...data, measurements: next });
    };

    return (
        <div className="p-6 pt-12 pb-24">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">¡A moverse, Nia! 💪</h1>

            {/* PR toast */}
            {prToast && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[80] bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-sm px-5 py-3 rounded-full shadow-xl animate-in slide-in-from-top-4">
                    {prToast}
                </div>
            )}

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
                    <div className="h-3 w-full bg-black/20 rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-white rounded-full transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }} />
                    </div>
                    <p className="text-sm mt-4 text-emerald-100 font-medium">
                        {thisWeekWorkouts === 0 ? '¡Arranca la semana con energía!' :
                            thisWeekWorkouts >= data.goalDaysPerWeek ? '¡Meta semanal cumplida! Eres imparable 🔥' :
                                '¡Sigue así, vas por buen camino! ✨'}
                    </p>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12 pointer-events-none" />
            </div>

            {/* Goal Editor Modal */}
            {isEditingGoal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsEditingGoal(false)} />
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

            {/* Weekly Tracker */}
            <div className="mb-10">
                <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3 ml-1">Esta semana</h3>
                <div className="flex justify-between bg-white dark:bg-[#2d1820] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-[#5a2b35]/30">
                    {weekDates.map((date, i) => {
                        const entries = history.filter(h => h.date === date);
                        const hasWorkout = entries.length > 0;
                        const hasDetail = entries.some(e => e.exercises && e.exercises.length > 0);
                        const isToday = date === today;
                        const icons = entries.map(h => routines.find(r => r.id === h.workoutId)?.icon || '💪');
                        return (
                            <div key={date} className="flex flex-col items-center gap-2 relative">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm transition-all relative
                                    ${isToday ? 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-[#1a0d10]' : ''}
                                    ${hasWorkout
                                        ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                        : 'bg-slate-50 dark:bg-[#3a2028] text-slate-300 border border-slate-100 dark:border-white/5'}`}
                                >
                                    {hasWorkout && (
                                        <div className={icons.length > 1 ? 'text-xs flex -space-x-1' : ''}>
                                            {icons.slice(0, 2).map((icon, idx) => <span key={idx}>{icon}</span>)}
                                            {icons.length > 2 && <span className="text-[8px] font-black self-end ml-0.5">+</span>}
                                        </div>
                                    )}
                                    {hasDetail && (
                                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-400 rounded-full border-2 border-white dark:border-[#2d1820]" title="Sesión con detalle" />
                                    )}
                                </div>
                                <span className={`text-[10px] font-medium uppercase ${isToday ? 'text-emerald-500 font-bold' : 'text-slate-400'}`}>
                                    {WEEK_LABELS[i]}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Mis Rutinas */}
            <div>
                <div className="flex justify-between items-end mb-4 pr-1">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 ml-1">Mis Rutinas</h3>
                    <button onClick={() => setRoutineEditor({ open: true })} className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-colors">
                        + Nueva
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {routines.map(routine => {
                        const session = history.find(h => h.date === today && h.workoutId === routine.id);
                        const isLoggedToday = !!session;
                        const exCount = routine.exercises?.length ?? 0;
                        const hasDetail = !!(session?.exercises && session.exercises.length > 0);

                        return (
                            <div key={routine.id} className={`p-4 rounded-2xl border transition-all ${isLoggedToday ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800' : 'bg-white border-slate-100 dark:bg-[#2d1820] dark:border-[#5a2b35]/30'}`}>
                                <div className="flex items-center justify-between">
                                    <button
                                        onClick={() => toggleQuickLog(routine.id)}
                                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-[#3a2028] flex items-center justify-center text-xl shadow-sm border border-slate-100 dark:border-white/5 flex-shrink-0">
                                            {routine.icon}
                                        </div>
                                        <div className="min-w-0">
                                            <span className={`font-bold text-sm block truncate ${isLoggedToday ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                                {routine.label}
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                                {exCount > 0 ? `${exCount} ejercicios` : 'Etiqueta rápida'}
                                                {hasDetail && ' · ✓ con detalle'}
                                            </span>
                                        </div>
                                    </button>
                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                        <button
                                            onClick={() => toggleQuickLog(routine.id)}
                                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isLoggedToday ? 'text-emerald-500 bg-white dark:bg-emerald-950 shadow-sm' : 'text-slate-300 hover:bg-slate-50 dark:hover:bg-[#3a2028]'}`}
                                            aria-label={isLoggedToday ? 'Quitar registro de hoy' : 'Registrar hoy'}
                                        >
                                            <span className="material-symbols-outlined text-sm">{isLoggedToday ? 'check_circle' : 'add_circle'}</span>
                                        </button>
                                        <button
                                            onClick={() => setRoutineEditor({ open: true, routine })}
                                            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-emerald-500 hover:bg-slate-50 dark:hover:bg-[#3a2028] transition-colors"
                                            aria-label="Editar rutina"
                                        >
                                            <span className="material-symbols-outlined text-sm">edit</span>
                                        </button>
                                        <button onClick={() => deleteRoutine(routine.id)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" aria-label="Eliminar rutina">
                                            <span className="material-symbols-outlined text-sm">delete</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Botón de detalle: solo si está registrada hoy */}
                                {isLoggedToday && (
                                    <button
                                        onClick={() => setDetailModal({ routine, session: session! })}
                                        className="mt-3 w-full text-xs font-bold py-2 rounded-xl bg-white dark:bg-[#1a0d10] border border-emerald-200 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1 active:scale-95 transition-all"
                                    >
                                        <span className="material-symbols-outlined text-sm">{hasDetail ? 'edit_note' : 'add_notes'}</span>
                                        {hasDetail ? 'Ver / editar detalle' : 'Agregar detalle (series, peso…)'}
                                    </button>
                                )}
                            </div>
                        );
                    })}

                    {routines.length === 0 && (
                        <div className="col-span-full p-6 bg-slate-50 dark:bg-[#2d1820] rounded-2xl text-center border border-dashed border-slate-200 dark:border-white/10">
                            <p className="text-slate-400 text-sm mb-2">Aún no tienes rutinas creadas.</p>
                            <button onClick={() => setRoutineEditor({ open: true })} className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">+ Crear mi primera rutina</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Medidas corporales */}
            <MeasurementsCard measurements={data.measurements ?? []} onSave={saveMeasurements} />

            {/* Estadísticas */}
            <div className="mt-10 mb-4">
                <div className="flex justify-between items-end mb-4 pr-1">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 ml-1">Estadísticas</h3>
                    <select
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                        className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-none outline-none py-1.5 pl-3 pr-3 rounded-full cursor-pointer"
                    >
                        <option value="all">Histórico completo</option>
                        {availableMonths.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
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

                    {/* Última sesión con detalle */}
                    {lastDetailed && lastDetailedRoutine && (
                        <div className="col-span-2 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/15 dark:to-teal-900/15 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                            <p className="text-[10px] uppercase font-bold text-emerald-500 mb-1">Última sesión registrada con detalle</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                {sessionSummary(lastDetailed, lastDetailedRoutine.label)}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                                {new Date(lastDetailed.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modales */}
            {routineEditor.open && (
                <RoutineEditorModal
                    routine={routineEditor.routine}
                    onSave={saveRoutine}
                    onClose={() => setRoutineEditor({ open: false })}
                />
            )}
            {detailModal && (
                <SessionDetailModal
                    routine={detailModal.routine}
                    date={today}
                    session={detailModal.session}
                    history={history}
                    onSave={saveSessionDetail}
                    onClose={() => setDetailModal(null)}
                />
            )}
        </div>
    );
};
