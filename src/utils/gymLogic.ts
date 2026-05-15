// ─── Gym Logic ────────────────────────────────────────────────────────────────
// Helpers de progresión: comparar la sesión de hoy con la última, detectar
// récords personales y construir el historial de un ejercicio.

import type { GymSession, ExerciseSet, SessionExercise, ExerciseKind } from '../types';

/** Mejor peso levantado en un conjunto de series (ejercicios de fuerza). */
export const maxWeight = (sets: ExerciseSet[]): number =>
    sets.reduce((m, s) => Math.max(m, s.weight ?? 0), 0);

/** Volumen total de un ejercicio: suma de reps × peso de todas las series. */
export const totalVolume = (sets: ExerciseSet[]): number =>
    sets.reduce((sum, s) => sum + (s.reps ?? 0) * (s.weight ?? 0), 0);

/** Mejor distancia o duración (ejercicios de cardio). */
export const maxCardio = (sets: ExerciseSet[]): { distanceKm: number; durationMin: number } => ({
    distanceKm: sets.reduce((m, s) => Math.max(m, s.distanceKm ?? 0), 0),
    durationMin: sets.reduce((m, s) => Math.max(m, s.durationMin ?? 0), 0),
});

/**
 * Devuelve el registro más reciente de un ejercicio ANTES de `beforeDate`.
 * Útil para pre-llenar el formulario y mostrar "la última vez hiciste…".
 */
export function getLastExercise(
    history: GymSession[],
    exerciseId: string,
    beforeDate?: string,
): { date: string; entry: SessionExercise } | null {
    const candidates: { date: string; entry: SessionExercise }[] = [];
    for (const session of history) {
        if (beforeDate && session.date >= beforeDate) continue;
        for (const ex of session.exercises ?? []) {
            if (ex.exerciseId === exerciseId && ex.sets.length > 0) {
                candidates.push({ date: session.date, entry: ex });
            }
        }
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => (a.date < b.date ? 1 : -1));
    return candidates[0];
}

/** Historial completo de un ejercicio, ordenado del más antiguo al más reciente. */
export function getExerciseHistory(
    history: GymSession[],
    exerciseId: string,
): { date: string; entry: SessionExercise }[] {
    const out: { date: string; entry: SessionExercise }[] = [];
    for (const session of history) {
        for (const ex of session.exercises ?? []) {
            if (ex.exerciseId === exerciseId && ex.sets.length > 0) {
                out.push({ date: session.date, entry: ex });
            }
        }
    }
    return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * ¿El registro de hoy es un récord personal frente a todo lo anterior?
 * - Fuerza: mayor peso máximo O mayor volumen total.
 * - Cardio: mayor distancia O mayor duración.
 */
export function isPersonalRecord(
    history: GymSession[],
    exerciseId: string,
    kind: ExerciseKind,
    todaySets: ExerciseSet[],
    todayDate: string,
): boolean {
    const past = getExerciseHistory(history, exerciseId).filter(h => h.date < todayDate);
    if (past.length === 0) return false; // primer registro no cuenta como PR

    if (kind === 'cardio') {
        const todayBest = maxCardio(todaySets);
        const pastBestDist = Math.max(...past.map(h => maxCardio(h.entry.sets).distanceKm));
        const pastBestDur = Math.max(...past.map(h => maxCardio(h.entry.sets).durationMin));
        return todayBest.distanceKm > pastBestDist || todayBest.durationMin > pastBestDur;
    }

    const todayMaxW = maxWeight(todaySets);
    const todayVol = totalVolume(todaySets);
    const pastMaxW = Math.max(...past.map(h => maxWeight(h.entry.sets)));
    const pastVol = Math.max(...past.map(h => totalVolume(h.entry.sets)));
    return todayMaxW > pastMaxW || todayVol > pastVol;
}

/** Texto corto de "la última vez": "8 reps × 45kg" o "30 min · 5km". */
export function lastEntrySummary(entry: SessionExercise): string {
    if (entry.kind === 'cardio') {
        const c = maxCardio(entry.sets);
        const parts: string[] = [];
        if (c.durationMin) parts.push(`${c.durationMin} min`);
        if (c.distanceKm) parts.push(`${c.distanceKm} km`);
        return parts.join(' · ') || `${entry.sets.length} series`;
    }
    // fuerza: tomar la mejor serie
    const best = entry.sets.reduce((b, s) =>
        (s.weight ?? 0) > (b.weight ?? 0) ? s : b, entry.sets[0]);
    if (best?.weight) return `${best.reps ?? 0} reps × ${best.weight}kg`;
    if (best?.reps) return `${best.reps} reps`;
    return `${entry.sets.length} series`;
}

/** Resumen de toda la sesión: "Día de pierna · 4 ejercicios · 45 min". */
export function sessionSummary(session: GymSession, routineLabel: string): string {
    const parts = [routineLabel];
    const exCount = session.exercises?.length ?? 0;
    if (exCount > 0) parts.push(`${exCount} ${exCount === 1 ? 'ejercicio' : 'ejercicios'}`);
    if (session.durationMin) parts.push(`${session.durationMin} min`);
    return parts.join(' · ');
}
