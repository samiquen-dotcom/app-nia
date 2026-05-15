// ─── Goals Logic ──────────────────────────────────────────────────────────────
// Las "metas conectadas" leen automáticamente los datos que la app ya recolecta
// (gym, agua, meditación, sueño, finanzas, ciclo) y calculan su progreso solas.
// Cero doble registro: la usuaria define el objetivo una vez y la barra se llena.

import type { Goal, GoalMetric, GymData, WellnessData, PeriodData, MonthStats } from '../types';

export interface GoalContext {
    gym: GymData | null;
    wellness: WellnessData | null;
    finance: { monthStats?: Record<string, MonthStats> } | null;
    period: PeriodData | null;
}

export interface GoalProgress {
    current: number;
    target: number;
    pct: number;          // 0-100 (clamp)
    label: string;        // ej. "8 / 12 días"
    done: boolean;
    overBudget?: boolean;  // solo para spending_cap
}

interface MetricConfig {
    label: string;        // nombre corto para el selector
    description: string;  // de dónde sale el dato
    icon: string;         // material symbol
    color: string;        // color base de Tailwind (sin prefijo)
    unit: string;         // "días", "sesiones", "noches", "$"
    inverse?: boolean;    // spending_cap: menos es mejor
    defaultTarget: number;
    titleFor: (target: number) => string; // título sugerido
}

export const GOAL_METRICS: Record<GoalMetric, MetricConfig> = {
    gym_days: {
        label: 'Días de gym',
        description: 'Cuenta los días que registres entrenamiento',
        icon: 'fitness_center',
        color: 'emerald',
        unit: 'días',
        defaultTarget: 12,
        titleFor: (t) => `Ir al gym ${t} veces este mes`,
    },
    water_days: {
        label: 'Días con meta de agua',
        description: 'Días que llegues a tu meta diaria de vasos',
        icon: 'water_drop',
        color: 'sky',
        unit: 'días',
        defaultTarget: 20,
        titleFor: (t) => `Cumplir mi meta de agua ${t} días`,
    },
    meditation_sessions: {
        label: 'Sesiones de meditación',
        description: 'Sesiones de respiración o pomodoro completadas',
        icon: 'self_improvement',
        color: 'teal',
        unit: 'sesiones',
        defaultTarget: 10,
        titleFor: (t) => `Meditar ${t} sesiones este mes`,
    },
    sleep_nights: {
        label: 'Noches durmiendo bien',
        description: 'Noches con 7h o más de sueño',
        icon: 'bedtime',
        color: 'violet',
        unit: 'noches',
        defaultTarget: 15,
        titleFor: (t) => `Dormir 7h+ durante ${t} noches`,
    },
    savings: {
        label: 'Ahorro del mes',
        description: 'Ingresos menos gastos del mes',
        icon: 'savings',
        color: 'green',
        unit: '$',
        defaultTarget: 500000,
        titleFor: (t) => `Ahorrar $${t.toLocaleString('es-CO')} este mes`,
    },
    spending_cap: {
        label: 'Tope de gasto',
        description: 'Mantener el gasto del mes por debajo de un tope',
        icon: 'shopping_cart_off',
        color: 'rose',
        unit: '$',
        inverse: true,
        defaultTarget: 1500000,
        titleFor: (t) => `Gastar menos de $${t.toLocaleString('es-CO')} este mes`,
    },
    cycle_logging: {
        label: 'Registro del ciclo',
        description: 'Días del mes con el ciclo registrado',
        icon: 'favorite',
        color: 'pink',
        unit: 'días',
        defaultTarget: 25,
        titleFor: (t) => `Registrar mi ciclo ${t} días`,
    },
};

/** Lista ordenada de métricas para el selector de "Nueva meta conectada". */
export const METRIC_LIST: GoalMetric[] = [
    'gym_days', 'water_days', 'meditation_sessions', 'sleep_nights',
    'savings', 'spending_cap', 'cycle_logging',
];

const fmtMoney = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

/** Cuenta cuántos elementos de `dates` (YYYY-MM-DD) caen en el mes `period` (YYYY-MM). */
const countInMonth = (dates: string[], period: string): number =>
    dates.filter(d => typeof d === 'string' && d.startsWith(period)).length;

/**
 * Calcula el progreso de una meta conectada leyendo el contexto de módulos.
 * Para metas manuales devuelve un progreso binario basado en `completed`.
 */
export function computeGoalProgress(goal: Goal, ctx: GoalContext): GoalProgress {
    // ─── Metas manuales ───────────────────────────────────────────────────
    if (goal.type === 'manual' || !goal.metric) {
        const done = !!goal.completed;
        return { current: done ? 1 : 0, target: 1, pct: done ? 100 : 0, label: done ? 'Completada' : 'Pendiente', done };
    }

    const target = goal.target ?? GOAL_METRICS[goal.metric].defaultTarget;
    const period = goal.period;
    let current = 0;

    switch (goal.metric) {
        case 'gym_days': {
            const dates = (ctx.gym?.history ?? []).map(h => h.date);
            // Días únicos (puede haber varias rutinas el mismo día)
            current = new Set(countInMonthDates(dates, period)).size;
            break;
        }
        case 'water_days': {
            const goalGlasses = ctx.wellness?.waterGoal ?? 8;
            current = (ctx.wellness?.days ?? [])
                .filter(d => d.date?.startsWith(period) && (d.glasses ?? 0) >= goalGlasses)
                .length;
            break;
        }
        case 'meditation_sessions': {
            current = (ctx.wellness?.timerSessions ?? [])
                .filter(s => s.completed && s.date?.startsWith(period))
                .length;
            break;
        }
        case 'sleep_nights': {
            current = (ctx.wellness?.days ?? [])
                .filter(d => d.date?.startsWith(period) && (d.sleepHours ?? 0) >= 7)
                .length;
            break;
        }
        case 'savings': {
            const stats = ctx.finance?.monthStats?.[period];
            current = stats ? (stats.income ?? 0) - (stats.expense ?? 0) : 0;
            break;
        }
        case 'spending_cap': {
            const stats = ctx.finance?.monthStats?.[period];
            current = stats?.expense ?? 0;
            break;
        }
        case 'cycle_logging': {
            const entries = ctx.period?.dailyEntries ?? {};
            current = countInMonth(Object.keys(entries), period);
            break;
        }
    }

    const cfg = GOAL_METRICS[goal.metric];

    // spending_cap es inverso: la barra muestra cuánto llevas gastado del tope.
    if (cfg.inverse) {
        const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
        const overBudget = current > target;
        return {
            current,
            target,
            pct,
            label: `${fmtMoney(current)} de ${fmtMoney(target)}`,
            done: !overBudget && current > 0, // "en buen camino" mientras no se pase
            overBudget,
        };
    }

    const safeCurrent = Math.max(0, current);
    const pct = target > 0 ? Math.min((safeCurrent / target) * 100, 100) : 0;
    const isMoney = cfg.unit === '$';
    const label = isMoney
        ? `${fmtMoney(safeCurrent)} / ${fmtMoney(target)}`
        : `${safeCurrent} / ${target} ${cfg.unit}`;

    return { current: safeCurrent, target, pct, label, done: safeCurrent >= target };
}

/** Helper interno: devuelve solo las fechas del mes (para Set de días únicos). */
function countInMonthDates(dates: string[], period: string): string[] {
    return dates.filter(d => typeof d === 'string' && d.startsWith(period));
}

/**
 * Ordena metas por urgencia para mostrarlas:
 * 1. Conectadas sin terminar, más cerca de la meta primero (más motivante).
 * 2. Manuales pendientes.
 * 3. Completadas al final.
 */
export function sortGoalsByUrgency(goals: Goal[], ctx: GoalContext): Goal[] {
    return [...goals].sort((a, b) => {
        const pa = computeGoalProgress(a, ctx);
        const pb = computeGoalProgress(b, ctx);
        if (pa.done !== pb.done) return pa.done ? 1 : -1;
        // Entre no completadas: las conectadas con más progreso van primero
        return pb.pct - pa.pct;
    });
}
