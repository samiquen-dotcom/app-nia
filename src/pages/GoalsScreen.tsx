import React, { useEffect, useMemo, useState } from 'react';
import { useFeatureData } from '../hooks/useFeatureData';
import { useAuth } from '../context/AuthContext';
import { FirestoreService, Features } from '../services/firestore';
import { getCurrentMonthKey } from '../utils/dateHelpers';
import {
    GOAL_METRICS, METRIC_LIST, computeGoalProgress, sortGoalsByUrgency,
    type GoalContext,
} from '../utils/goalsLogic';
import type {
    Goal, GoalsData, GoalMetric, GoalItem, WishlistItem,
    GymData, WellnessData, PeriodData, FinanceData,
} from '../types';

// Mapa de color base → clases estáticas (Tailwind no purga las que ve como literales)
const COLOR_CLASSES: Record<string, { bar: string; bg: string; text: string; ring: string }> = {
    emerald: { bar: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-300', ring: 'ring-emerald-300' },
    sky:     { bar: 'bg-sky-500',     bg: 'bg-sky-50 dark:bg-sky-900/20',         text: 'text-sky-600 dark:text-sky-300',         ring: 'ring-sky-300' },
    teal:    { bar: 'bg-teal-500',    bg: 'bg-teal-50 dark:bg-teal-900/20',       text: 'text-teal-600 dark:text-teal-300',       ring: 'ring-teal-300' },
    violet:  { bar: 'bg-violet-500',  bg: 'bg-violet-50 dark:bg-violet-900/20',   text: 'text-violet-600 dark:text-violet-300',   ring: 'ring-violet-300' },
    green:   { bar: 'bg-green-500',   bg: 'bg-green-50 dark:bg-green-900/20',     text: 'text-green-600 dark:text-green-300',     ring: 'ring-green-300' },
    rose:    { bar: 'bg-rose-500',    bg: 'bg-rose-50 dark:bg-rose-900/20',       text: 'text-rose-600 dark:text-rose-300',       ring: 'ring-rose-300' },
    pink:    { bar: 'bg-pink-500',    bg: 'bg-pink-50 dark:bg-pink-900/20',       text: 'text-pink-600 dark:text-pink-300',       ring: 'ring-pink-300' },
    slate:   { bar: 'bg-slate-400',   bg: 'bg-slate-50 dark:bg-slate-800/40',     text: 'text-slate-600 dark:text-slate-300',     ring: 'ring-slate-300' },
};

const monthLabel = (key: string) => {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
};

export const GoalsScreen: React.FC = () => {
    const { user } = useAuth();
    const { data, save } = useFeatureData<GoalsData>('goals', { goals: [], wishlist: [], media: [] });
    const currentPeriod = getCurrentMonthKey();

    // ─── Contexto de módulos (read-only, para metas conectadas) ──────────────
    const [ctx, setCtx] = useState<GoalContext>({ gym: null, wellness: null, finance: null, period: null });
    const [ctxLoading, setCtxLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        Promise.all([
            FirestoreService.getFeatureData(user.uid, Features.GYM),
            FirestoreService.getFeatureData(user.uid, Features.WELLNESS),
            FirestoreService.getFeatureData(user.uid, Features.FINANCE),
            FirestoreService.getFeatureData(user.uid, Features.PERIOD),
        ]).then(([gym, wellness, finance, period]) => {
            if (cancelled) return;
            setCtx({
                gym: gym as GymData | null,
                wellness: wellness as WellnessData | null,
                finance: finance as FinanceData | null,
                period: period as PeriodData | null,
            });
            setCtxLoading(false);
        }).catch(() => { if (!cancelled) setCtxLoading(false); });
        return () => { cancelled = true; };
    }, [user]);

    // ─── Migración de metas legacy (GoalItem → Goal) ─────────────────────────
    useEffect(() => {
        const raw = data.goals as unknown as (Goal | GoalItem)[];
        if (!raw || raw.length === 0) return;
        const needsMigration = raw.some(g => !(g as Goal).type);
        if (!needsMigration) return;
        const migrated: Goal[] = raw.map(g => {
            if ((g as Goal).type) return g as Goal;
            const legacy = g as GoalItem;
            return {
                id: `goal_${legacy.id}`,
                type: 'manual',
                title: legacy.text,
                completed: legacy.completed,
                period: currentPeriod,
                createdAt: typeof legacy.id === 'number' ? legacy.id : Date.now(),
            };
        });
        save({ goals: migrated });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.goals]);

    const goals: Goal[] = useMemo(
        () => (data.goals as unknown as (Goal | GoalItem)[]).filter(g => (g as Goal).type) as Goal[],
        [data.goals]
    );

    // Metas del mes actual
    const monthGoals = useMemo(() => goals.filter(g => g.period === currentPeriod), [goals, currentPeriod]);
    const sortedGoals = useMemo(() => sortGoalsByUrgency(monthGoals, ctx), [monthGoals, ctx]);

    const completedCount = useMemo(
        () => monthGoals.filter(g => computeGoalProgress(g, ctx).done).length,
        [monthGoals, ctx]
    );

    // ─── New goal modal ───────────────────────────────────────────────────────
    const [showNew, setShowNew] = useState(false);
    const [newType, setNewType] = useState<'connected' | 'manual'>('connected');
    const [newMetric, setNewMetric] = useState<GoalMetric>('gym_days');
    const [newTarget, setNewTarget] = useState<number>(GOAL_METRICS.gym_days.defaultTarget);
    const [newTitle, setNewTitle] = useState('');
    const [newDeadline, setNewDeadline] = useState('');

    const openNew = () => {
        setNewType('connected');
        setNewMetric('gym_days');
        setNewTarget(GOAL_METRICS.gym_days.defaultTarget);
        setNewTitle('');
        setNewDeadline('');
        setShowNew(true);
    };

    const pickMetric = (m: GoalMetric) => {
        setNewMetric(m);
        setNewTarget(GOAL_METRICS[m].defaultTarget);
    };

    const createGoal = () => {
        let goal: Goal;
        if (newType === 'connected') {
            const cfg = GOAL_METRICS[newMetric];
            goal = {
                id: `goal_${Date.now()}`,
                type: 'connected',
                title: newTitle.trim() || cfg.titleFor(newTarget),
                metric: newMetric,
                target: newTarget,
                period: currentPeriod,
                createdAt: Date.now(),
            };
        } else {
            if (!newTitle.trim()) return;
            goal = {
                id: `goal_${Date.now()}`,
                type: 'manual',
                title: newTitle.trim(),
                completed: false,
                deadline: newDeadline || undefined,
                period: currentPeriod,
                createdAt: Date.now(),
            };
        }
        save({ goals: [...goals, goal] });
        setShowNew(false);
    };

    const toggleManual = (id: string) => {
        save({ goals: goals.map(g => g.id === id ? { ...g, completed: !g.completed } : g) });
    };
    const deleteGoal = (id: string) => save({ goals: goals.filter(g => g.id !== id) });

    // ─── Wishlist ─────────────────────────────────────────────────────────────
    const wishlist = (data.wishlist ?? []) as WishlistItem[];
    const [newWish, setNewWish] = useState('');
    const [newWishPrice, setNewWishPrice] = useState('');
    const addWish = () => {
        if (!newWish.trim()) return;
        const item: WishlistItem = {
            id: Date.now(),
            text: newWish.trim(),
            completed: false,
            price: newWishPrice ? Number(newWishPrice) : undefined,
        };
        save({ wishlist: [...wishlist, item] });
        setNewWish('');
        setNewWishPrice('');
    };
    const deleteWish = (id: number) => save({ wishlist: wishlist.filter(w => w.id !== id) });

    return (
        <div className="p-6 pt-12 pb-24">
            {/* Header */}
            <div className="flex items-start justify-between mb-1">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Tus metas, Nia ⭐</h1>
                {monthGoals.length > 0 && (
                    <span className="text-xs text-slate-500 dark:text-slate-300 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1 rounded-full font-bold flex-shrink-0">
                        {completedCount}/{monthGoals.length} logradas
                    </span>
                )}
            </div>
            <p className="text-sm text-slate-400 dark:text-slate-500 mb-6 capitalize">{monthLabel(currentPeriod)}</p>

            {/* ── Metas del mes ───────────────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <span className="material-symbols-outlined text-yellow-400">emoji_events</span>
                    Metas del mes
                </h3>
                <button
                    onClick={openNew}
                    className="flex items-center gap-1 text-xs font-bold text-white bg-gradient-to-r from-yellow-400 to-amber-500 px-3 py-1.5 rounded-full shadow-sm active:scale-95 transition-all"
                >
                    <span className="material-symbols-outlined text-base">add</span>
                    Nueva meta
                </button>
            </div>

            {monthGoals.length === 0 ? (
                <div className="bg-white dark:bg-[#2d1820] rounded-2xl border border-slate-100 dark:border-[#5a2b35]/30 p-6 text-center mb-8">
                    <p className="text-4xl mb-2">🎯</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1 font-medium">Aún no tienes metas para este mes</p>
                    <p className="text-xs text-slate-400 mb-4">
                        Las metas conectadas se llenan solas con lo que ya registras (gym, agua, ahorro…).
                    </p>
                    <button
                        onClick={openNew}
                        className="px-5 py-2.5 rounded-full bg-yellow-400 text-white font-bold text-sm shadow-md active:scale-95"
                    >
                        + Crear mi primera meta
                    </button>
                </div>
            ) : (
                <div className="space-y-3 mb-8">
                    {sortedGoals.map(goal => (
                        <GoalCard
                            key={goal.id}
                            goal={goal}
                            ctx={ctx}
                            ctxLoading={ctxLoading}
                            onToggleManual={toggleManual}
                            onDelete={deleteGoal}
                        />
                    ))}
                </div>
            )}

            {/* ── Wishlist ────────────────────────────────────────────────────── */}
            <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-pink-400">favorite</span>
                Wishlist
            </h3>
            <div className="bg-white dark:bg-[#2d1820] rounded-2xl shadow-sm border border-slate-100 dark:border-[#5a2b35]/30 overflow-hidden">
                <div className="p-4 space-y-3">
                    {wishlist.map(w => (
                        <div key={w.id} className="flex items-center gap-3 group">
                            <span className="material-symbols-outlined text-pink-300 text-sm flex-shrink-0">shopping_bag</span>
                            <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">{w.text}</span>
                            {w.price ? (
                                <span className="text-xs font-bold text-pink-500 bg-pink-50 dark:bg-pink-900/20 px-2 py-0.5 rounded-full flex-shrink-0">
                                    ${w.price.toLocaleString('es-CO')}
                                </span>
                            ) : null}
                            <button onClick={() => deleteWish(w.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-400 transition-opacity flex-shrink-0">
                                <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                        </div>
                    ))}
                    {wishlist.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-2">Agrega tus deseos aquí 🛍️</p>
                    )}
                    <div className="bg-slate-50 dark:bg-[#1a0d10] -mx-4 -mb-4 mt-3 p-3 flex gap-2">
                        <input
                            value={newWish}
                            onChange={e => setNewWish(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addWish()}
                            placeholder="Deseo..."
                            className="flex-1 min-w-0 bg-white dark:bg-[#2d1820] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pink-400"
                        />
                        <input
                            value={newWishPrice}
                            onChange={e => setNewWishPrice(e.target.value.replace(/[^0-9]/g, ''))}
                            onKeyDown={e => e.key === 'Enter' && addWish()}
                            placeholder="$ (opcional)"
                            inputMode="numeric"
                            className="w-24 flex-shrink-0 bg-white dark:bg-[#2d1820] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-xl px-2 py-2 text-sm focus:outline-none focus:border-pink-400"
                        />
                        <button onClick={addWish} className="bg-pink-400 text-white rounded-xl px-3 font-bold text-lg leading-none flex-shrink-0">+</button>
                    </div>
                </div>
            </div>

            {/* ── New goal modal ──────────────────────────────────────────────── */}
            {showNew && (
                <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in" onClick={() => setShowNew(false)}>
                    <div
                        className="bg-white dark:bg-[#231218] w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide"
                        onClick={e => e.stopPropagation()}
                    >
                        <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mb-4">Nueva meta</h2>

                        {/* Type toggle */}
                        <div className="flex gap-2 mb-5">
                            <button
                                onClick={() => setNewType('connected')}
                                className={`flex-1 py-3 rounded-2xl border-2 text-sm font-bold transition-all ${newType === 'connected'
                                    ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
                                    : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}
                            >
                                ✨ Conectada
                                <span className="block text-[10px] font-medium opacity-70 mt-0.5">Se llena sola</span>
                            </button>
                            <button
                                onClick={() => setNewType('manual')}
                                className={`flex-1 py-3 rounded-2xl border-2 text-sm font-bold transition-all ${newType === 'manual'
                                    ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
                                    : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}
                            >
                                ✍️ Manual
                                <span className="block text-[10px] font-medium opacity-70 mt-0.5">La marcas tú</span>
                            </button>
                        </div>

                        {newType === 'connected' ? (
                            <>
                                {/* Metric picker */}
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">¿Qué quieres lograr?</label>
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    {METRIC_LIST.map(m => {
                                        const cfg = GOAL_METRICS[m];
                                        const c = COLOR_CLASSES[cfg.color] ?? COLOR_CLASSES.slate;
                                        const selected = newMetric === m;
                                        return (
                                            <button
                                                key={m}
                                                onClick={() => pickMetric(m)}
                                                className={`flex items-start gap-2 p-3 rounded-2xl border-2 text-left transition-all ${selected ? `border-current ${c.text} ${c.bg}` : 'border-slate-100 dark:border-slate-800 text-slate-500'}`}
                                            >
                                                <span className="material-symbols-outlined text-xl flex-shrink-0">{cfg.icon}</span>
                                                <span className="min-w-0">
                                                    <span className="block text-xs font-bold leading-tight">{cfg.label}</span>
                                                    <span className="block text-[10px] opacity-70 leading-tight mt-0.5">{cfg.description}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Target */}
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">
                                    Objetivo ({GOAL_METRICS[newMetric].unit === '$' ? 'monto' : GOAL_METRICS[newMetric].unit})
                                </label>
                                <input
                                    type="number"
                                    value={newTarget}
                                    onChange={e => setNewTarget(Math.max(1, Number(e.target.value) || 1))}
                                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-[#1a0d10] border-2 border-transparent focus:border-yellow-400 text-slate-800 dark:text-slate-100 focus:outline-none mb-2 font-bold"
                                />
                                <p className="text-xs text-slate-400 mb-4 italic">{GOAL_METRICS[newMetric].titleFor(newTarget)}</p>

                                {/* Optional custom title */}
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">Título personalizado (opcional)</label>
                                <input
                                    type="text"
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    placeholder={GOAL_METRICS[newMetric].titleFor(newTarget)}
                                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-[#1a0d10] border-2 border-transparent focus:border-yellow-400 text-slate-800 dark:text-slate-100 focus:outline-none mb-5"
                                />
                            </>
                        ) : (
                            <>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">¿Qué quieres lograr?</label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    placeholder="Ej: Terminar el curso de inglés"
                                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-[#1a0d10] border-2 border-transparent focus:border-yellow-400 text-slate-800 dark:text-slate-100 focus:outline-none mb-4"
                                />
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">Fecha límite (opcional)</label>
                                <input
                                    type="date"
                                    value={newDeadline}
                                    onChange={e => setNewDeadline(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-[#1a0d10] border-2 border-transparent focus:border-yellow-400 text-slate-800 dark:text-slate-100 focus:outline-none mb-5"
                                />
                            </>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowNew(false)}
                                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-[#3a2028] text-slate-600 dark:text-slate-300 font-bold"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={createGoal}
                                disabled={newType === 'manual' && !newTitle.trim()}
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 text-white font-bold shadow-lg disabled:opacity-40 active:scale-95 transition-all"
                            >
                                Crear meta
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Goal card ────────────────────────────────────────────────────────────────
const GoalCard: React.FC<{
    goal: Goal;
    ctx: GoalContext;
    ctxLoading: boolean;
    onToggleManual: (id: string) => void;
    onDelete: (id: string) => void;
}> = ({ goal, ctx, ctxLoading, onToggleManual, onDelete }) => {
    const progress = computeGoalProgress(goal, ctx);
    const isConnected = goal.type === 'connected' && !!goal.metric;
    const cfg = isConnected ? GOAL_METRICS[goal.metric!] : null;
    const c = COLOR_CLASSES[cfg?.color ?? 'slate'] ?? COLOR_CLASSES.slate;

    return (
        <div className={`relative rounded-2xl border bg-white dark:bg-[#2d1820] shadow-sm p-4 transition-all group ${progress.done ? 'border-emerald-200 dark:border-emerald-900/40' : 'border-slate-100 dark:border-[#5a2b35]/30'}`}>
            <div className="flex items-start gap-3">
                {/* Icon / checkbox */}
                {isConnected ? (
                    <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${c.bg} ${c.text}`}>
                        <span className="material-symbols-outlined text-xl">{progress.done ? 'check_circle' : cfg!.icon}</span>
                    </div>
                ) : (
                    <button
                        onClick={() => onToggleManual(goal.id)}
                        className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center border-2 transition-all ${progress.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200 dark:border-slate-600 text-transparent hover:border-yellow-400'}`}
                        aria-label={progress.done ? 'Marcar como pendiente' : 'Marcar como completada'}
                    >
                        <span className="material-symbols-outlined text-xl">check</span>
                    </button>
                )}

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <p className={`font-bold text-sm text-slate-800 dark:text-slate-100 ${progress.done && !isConnected ? 'line-through text-slate-400' : ''}`}>
                            {goal.title}
                        </p>
                        <button
                            onClick={() => onDelete(goal.id)}
                            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-400 transition-opacity flex-shrink-0"
                            aria-label="Eliminar meta"
                        >
                            <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                    </div>

                    {isConnected ? (
                        <>
                            {/* Progress bar */}
                            <div className="mt-2 w-full bg-slate-100 dark:bg-black/30 h-2 rounded-full overflow-hidden">
                                <div
                                    className={`h-2 rounded-full transition-all duration-500 ${progress.overBudget ? 'bg-rose-500' : c.bar}`}
                                    style={{ width: `${progress.pct}%` }}
                                />
                            </div>
                            <div className="flex items-center justify-between mt-1.5">
                                <span className={`text-xs font-bold ${progress.overBudget ? 'text-rose-500' : c.text}`}>
                                    {ctxLoading ? 'Calculando…' : progress.label}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                    {progress.overBudget
                                        ? '⚠️ Pasaste el tope'
                                        : progress.done
                                            ? '¡Lograda! 🎉'
                                            : `${Math.round(progress.pct)}%`}
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[11px]">bolt</span>
                                Automática · {cfg!.description.toLowerCase()}
                            </p>
                        </>
                    ) : (
                        goal.deadline && (
                            <p className="text-[11px] text-slate-400 mt-1">
                                📅 Fecha límite: {new Date(goal.deadline + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                            </p>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};
