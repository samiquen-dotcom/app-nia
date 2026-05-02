// ─── Date Helpers ─────────────────────────────────────────────────────────────
// Helpers compartidos de fechas para evitar duplicación entre Home, Gym, Period, etc.
// Todas las funciones usan hora LOCAL (no UTC) para evitar bugs de zona horaria.

/** Devuelve la fecha de hoy en formato YYYY-MM-DD (hora local). */
export const todayStr = (): string => {
    const now = new Date();
    return toLocalDateStr(now);
};

/** Convierte un Date a string YYYY-MM-DD usando hora local. */
export const toLocalDateStr = (d: Date): string => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Devuelve el lunes de la semana actual (00:00 hora local). Domingo cuenta como parte de la semana anterior. */
export const getMondayOfWeek = (ref: Date = new Date()): Date => {
    const d = new Date(ref);
    const currentDay = d.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    const diff = currentDay === 0 ? -6 : 1 - currentDay;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

/** Devuelve los 7 strings YYYY-MM-DD de la semana actual (lunes a domingo). */
export const getCurrentWeekDates = (ref: Date = new Date()): string[] => {
    const monday = getMondayOfWeek(ref);
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return toLocalDateStr(d);
    });
};

/** Devuelve la clave del mes actual en formato YYYY-MM. */
export const getCurrentMonthKey = (ref: Date = new Date()): string => {
    return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
};

/** Diferencia en días entre dos fechas YYYY-MM-DD (b - a). */
export const diffDays = (from: string, to: string): number => {
    const a = new Date(from + 'T00:00:00');
    const b = new Date(to + 'T00:00:00');
    return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
};
