import React, { useMemo, useState } from 'react';
import type { GymRoutine, GymSession, SessionExercise, ExerciseSet } from '../../types';
import { getLastExercise, lastEntrySummary } from '../../utils/gymLogic';

interface Props {
    routine: GymRoutine;
    date: string;
    session: GymSession;          // sesión ya registrada (al menos { date, workoutId })
    history: GymSession[];        // para mostrar "la última vez…"
    onSave: (session: GymSession) => void;
    onClose: () => void;
}

/** Modal de registro detallado: series/reps/peso por ejercicio + duración + notas. */
export const SessionDetailModal: React.FC<Props> = ({ routine, date, session, history, onSave, onClose }) => {
    const exercises = routine.exercises ?? [];

    // Estado inicial: lo que ya tenga la sesión, o una serie vacía por ejercicio.
    const [sessionExercises, setSessionExercises] = useState<SessionExercise[]>(() => {
        return exercises.map(ex => {
            const existing = session.exercises?.find(e => e.exerciseId === ex.id);
            if (existing) return existing;
            // Pre-llenar con la última vez (si hay)
            const last = getLastExercise(history, ex.id, date);
            const seedSets: ExerciseSet[] = last
                ? last.entry.sets.map(s => ({ ...s }))
                : [{}];
            return { exerciseId: ex.id, name: ex.name, kind: ex.kind, sets: seedSets };
        });
    });

    const [durationMin, setDurationMin] = useState<string>(session.durationMin?.toString() ?? '');
    const [notes, setNotes] = useState(session.notes ?? '');

    const lastByExercise = useMemo(() => {
        const map: Record<string, string> = {};
        for (const ex of exercises) {
            const last = getLastExercise(history, ex.id, date);
            if (last) map[ex.id] = `Última vez (${last.date.slice(5)}): ${lastEntrySummary(last.entry)}`;
        }
        return map;
    }, [exercises, history, date]);

    const updateSet = (exIdx: number, setIdx: number, field: keyof ExerciseSet, value: string) => {
        const num = value === '' ? undefined : Number(value);
        setSessionExercises(prev => prev.map((se, i) => {
            if (i !== exIdx) return se;
            const sets = se.sets.map((s, j) => j === setIdx ? { ...s, [field]: num } : s);
            return { ...se, sets };
        }));
    };

    const addSet = (exIdx: number) => {
        setSessionExercises(prev => prev.map((se, i) => {
            if (i !== exIdx) return se;
            // Copiar la última serie como punto de partida
            const lastSet = se.sets[se.sets.length - 1] ?? {};
            return { ...se, sets: [...se.sets, { ...lastSet }] };
        }));
    };

    const removeSet = (exIdx: number, setIdx: number) => {
        setSessionExercises(prev => prev.map((se, i) => {
            if (i !== exIdx) return se;
            const sets = se.sets.filter((_, j) => j !== setIdx);
            return { ...se, sets: sets.length ? sets : [{}] };
        }));
    };

    const handleSave = () => {
        // Solo guardar ejercicios con al menos una serie con datos.
        const cleaned: SessionExercise[] = sessionExercises
            .map(se => ({
                ...se,
                sets: se.sets.filter(s =>
                    s.reps !== undefined || s.weight !== undefined ||
                    s.durationMin !== undefined || s.distanceKm !== undefined
                ),
            }))
            .filter(se => se.sets.length > 0);

        onSave({
            ...session,
            date,
            workoutId: routine.id,
            exercises: cleaned.length > 0 ? cleaned : undefined,
            durationMin: durationMin ? Number(durationMin) : undefined,
            notes: notes.trim() || undefined,
        });
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in" onClick={onClose}>
            <div
                className="bg-white dark:bg-[#231218] w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto scrollbar-hide"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{routine.icon}</span>
                    <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{routine.label}</h2>
                </div>
                <p className="text-xs text-slate-400 mb-5">
                    {new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>

                {exercises.length === 0 ? (
                    <div className="bg-slate-50 dark:bg-[#1a0d10] rounded-2xl p-5 text-center mb-5">
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Esta rutina no tiene ejercicios.</p>
                        <p className="text-xs text-slate-400">Edítala y agrega ejercicios para registrar series y ver tu progresión.</p>
                    </div>
                ) : (
                    <div className="space-y-4 mb-5">
                        {sessionExercises.map((se, exIdx) => (
                            <div key={se.exerciseId} className="rounded-2xl border border-slate-100 dark:border-[#5a2b35]/30 p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">{se.name}</h3>
                                    <span className="text-[10px] uppercase font-bold text-emerald-500">
                                        {se.kind === 'cardio' ? 'Cardio' : se.kind === 'strength' ? 'Fuerza' : 'Otro'}
                                    </span>
                                </div>
                                {lastByExercise[se.exerciseId] && (
                                    <p className="text-[10px] text-slate-400 mb-2">{lastByExercise[se.exerciseId]}</p>
                                )}

                                {/* Header de columnas */}
                                <div className="flex items-center gap-2 mb-1 px-1">
                                    <span className="w-6 text-[10px] font-bold text-slate-400">#</span>
                                    {se.kind === 'cardio' ? (
                                        <>
                                            <span className="flex-1 text-[10px] font-bold text-slate-400 text-center">Min</span>
                                            <span className="flex-1 text-[10px] font-bold text-slate-400 text-center">Km</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="flex-1 text-[10px] font-bold text-slate-400 text-center">Reps</span>
                                            <span className="flex-1 text-[10px] font-bold text-slate-400 text-center">Peso (kg)</span>
                                        </>
                                    )}
                                    <span className="w-7" />
                                </div>

                                {/* Series */}
                                <div className="space-y-1.5">
                                    {se.sets.map((set, setIdx) => (
                                        <div key={setIdx} className="flex items-center gap-2">
                                            <span className="w-6 text-xs font-bold text-slate-400 text-center">{setIdx + 1}</span>
                                            {se.kind === 'cardio' ? (
                                                <>
                                                    <input
                                                        type="number" inputMode="numeric" min="0"
                                                        value={set.durationMin ?? ''}
                                                        onChange={e => updateSet(exIdx, setIdx, 'durationMin', e.target.value)}
                                                        className="flex-1 min-w-0 bg-slate-50 dark:bg-[#1a0d10] border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-emerald-400 dark:text-slate-200"
                                                        placeholder="0"
                                                    />
                                                    <input
                                                        type="number" inputMode="decimal" min="0" step="0.1"
                                                        value={set.distanceKm ?? ''}
                                                        onChange={e => updateSet(exIdx, setIdx, 'distanceKm', e.target.value)}
                                                        className="flex-1 min-w-0 bg-slate-50 dark:bg-[#1a0d10] border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-emerald-400 dark:text-slate-200"
                                                        placeholder="0"
                                                    />
                                                </>
                                            ) : (
                                                <>
                                                    <input
                                                        type="number" inputMode="numeric" min="0"
                                                        value={set.reps ?? ''}
                                                        onChange={e => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                                                        className="flex-1 min-w-0 bg-slate-50 dark:bg-[#1a0d10] border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-emerald-400 dark:text-slate-200"
                                                        placeholder="0"
                                                    />
                                                    <input
                                                        type="number" inputMode="decimal" min="0" step="0.5"
                                                        value={set.weight ?? ''}
                                                        onChange={e => updateSet(exIdx, setIdx, 'weight', e.target.value)}
                                                        className="flex-1 min-w-0 bg-slate-50 dark:bg-[#1a0d10] border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-emerald-400 dark:text-slate-200"
                                                        placeholder="0"
                                                    />
                                                </>
                                            )}
                                            <button
                                                onClick={() => removeSet(exIdx, setIdx)}
                                                className="w-7 h-7 flex-shrink-0 flex items-center justify-center text-slate-300 hover:text-rose-400 transition-colors"
                                                aria-label="Quitar serie"
                                            >
                                                <span className="material-symbols-outlined text-base">remove_circle</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => addSet(exIdx)}
                                    className="mt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline"
                                >
                                    <span className="material-symbols-outlined text-sm">add</span>
                                    Agregar serie
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Duración + notas */}
                <div className="flex gap-3 mb-3">
                    <div className="flex-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 block">Duración (min)</label>
                        <input
                            type="number" inputMode="numeric" min="0"
                            value={durationMin}
                            onChange={e => setDurationMin(e.target.value)}
                            placeholder="Opcional"
                            className="w-full bg-slate-50 dark:bg-[#1a0d10] border-2 border-transparent focus:border-emerald-400 rounded-xl px-3 py-2 text-sm focus:outline-none dark:text-slate-200"
                        />
                    </div>
                </div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 block">Notas</label>
                <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    placeholder="¿Cómo te sentiste? ¿Algo que recordar?"
                    className="w-full bg-slate-50 dark:bg-[#1a0d10] border-2 border-transparent focus:border-emerald-400 rounded-xl px-3 py-2 text-sm focus:outline-none resize-none mb-5 dark:text-slate-200"
                />

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-[#3a2028] text-slate-600 dark:text-slate-300 font-bold"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold shadow-lg active:scale-95 transition-all"
                    >
                        Guardar sesión
                    </button>
                </div>
            </div>
        </div>
    );
};
