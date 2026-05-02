import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CycleWidget } from '../components/CycleWidget';
import { CycleDayModal } from '../components/CycleDayModal';
import { useAuth } from '../context/AuthContext';
import { FirestoreService, Features } from '../services/firestore';
import { getPredictions, calculatePhase, getEnhancedBodyAlert, getDailyAffirmation, type EnhancedBodyAlert, type PhaseInfo } from '../utils/cycleLogic';
import { todayStr, getCurrentWeekDates, getCurrentMonthKey } from '../utils/dateHelpers';
import type { GymData, FoodData, GoalsData, PeriodData, DebtsData, Debt, WellnessData, Transaction, TravelData, Trip } from '../types';

interface DashboardData {
    calories: number;
    calorieGoal: number;       // Meta diaria de calorías (default 2000)
    gymDone: boolean;
    gymGoal: number;
    gymWeeklyCompleted: number;
    todaySpent: number;
    monthSpent: number;        // Gasto acumulado del mes (para contexto)
    goalsTotal: number;
    goalsDone: number;
    waterToday: number;
    periodStatus?: {
        isActive: boolean;
        isDayMissing: boolean;
        day: number;
        daysUntil: number;
    };
    bodyAlert?: EnhancedBodyAlert | null;
    phase?: PhaseInfo | null;     // Fase actual (para afirmación por fase)
    pendingReviewDate?: string | null;
    upcomingTrips: Trip[];
}

export const HomeScreen: React.FC = () => {
    const navigate = useNavigate();
    const [refresh, setRefresh] = useState(0);
    const [wizardPostponed, setWizardPostponed] = useState(false);

    const dateString = new Date().toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long'
    });
    const [dashboard, setDashboard] = useState<DashboardData>({
        calories: 0, calorieGoal: 2000, gymDone: false, gymGoal: 5, gymWeeklyCompleted: 0, todaySpent: 0, monthSpent: 0, goalsTotal: 0, goalsDone: 0, waterToday: 0, upcomingTrips: [],
    });
    const { user } = useAuth();
    const displayName = user?.displayName ? user.displayName.split(' ')[0] : 'Nia';
    const photoURL = user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}&backgroundColor=ffd6e0`;

    // Popup state
    const [pendingDebts, setPendingDebts] = useState<Debt[]>([]);
    const [showDebtModal, setShowDebtModal] = useState(false);

    // Afirmación por fase del ciclo (rota diariamente). Si no hay fase, usa lista genérica.
    const affirmation = getDailyAffirmation(dashboard.phase ?? null);



    useEffect(() => {
        if (!user) return;
        const today = todayStr();

        Promise.all([
            FirestoreService.getFeatureData(user.uid, Features.FINANCE),
            FirestoreService.getFeatureData(user.uid, Features.GYM),
            FirestoreService.getFeatureData(user.uid, Features.FOOD),
            FirestoreService.getFeatureData(user.uid, Features.GOALS),
            FirestoreService.getFeatureData(user.uid, Features.PERIOD),
            FirestoreService.getFeatureData(user.uid, Features.DEBTS),
            FirestoreService.getFeatureData(user.uid, Features.WELLNESS),
            FirestoreService.getFeatureData(user.uid, Features.TRAVEL),
            FirestoreService.getTransactions(user.uid, null, 50)
        ]).then(([_, gymRaw, foodRaw, goalsRaw, periodRaw, debtsRaw, wellnessRaw, travelRaw, txRes]) => {
            const gym = gymRaw as GymData | null;
            const food = foodRaw as FoodData | null;
            const goals = goalsRaw as GoalsData | null;
            const period = periodRaw as PeriodData | null;
            const debtsData = debtsRaw as DebtsData | null;
            const wellness = wellnessRaw as WellnessData | null;
            const travel = travelRaw as TravelData | null;
            const txData = txRes as { transactions: Transaction[] };

            // Upcoming trips (planned or active)
            const upcomingTrips = (travel?.trips || [])
                .filter(t => t.status === 'planned' || t.status === 'active')
                .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                .slice(0, 2); // Show max 2

            // Check for debts due today or overdue
            if (debtsData?.items) {
                const now = new Date();
                now.setHours(0, 0, 0, 0); // Start of today

                const upcoming = debtsData.items.filter(d => {
                    const due = new Date(d.dueDate + 'T00:00:00');
                    // Due today (same date) or in the past (overdue)
                    return due <= now;
                });

                if (upcoming.length > 0) {
                    setPendingDebts(upcoming);
                    const hasShown = sessionStorage.getItem('hasShownDebtPopup');
                    if (!hasShown) {
                        setShowDebtModal(true);
                        sessionStorage.setItem('hasShownDebtPopup', 'true');
                    }
                }
            }

            // Today's calories from Food + meta diaria (preferences.calorieGoal o default 2000)
            const todayFood = food?.days?.find(d => d.date === today);
            let calories = 0;
            if (todayFood) {
                calories = todayFood.items?.reduce((sum: number, item: any) => sum + item.calories, 0) || 0;
            }
            const calorieGoal = (food as any)?.preferences?.calorieGoal ?? 2000;

            // Gym: did she work out today? What's the weekly progress?
            const gymDone = gym?.history?.some(h => h.date === today) ?? false;
            const gymGoal = gym?.goalDaysPerWeek ?? 5;

            // Calculate weekly completed (usa util compartido)
            let gymWeeklyCompleted = 0;
            if (gym?.history) {
                const weekDates = getCurrentWeekDates();
                gymWeeklyCompleted = weekDates.filter(date => gym.history.some(h => h.date === date)).length;
            }

            // Finance: today's expenses + month accumulated (para contexto)
            const monthKey = getCurrentMonthKey(); // YYYY-MM
            const todaySpent = txData.transactions
                ?.filter(t => t.type === 'expense' && t.dateISO === today)
                .reduce((sum, t) => sum + t.amount, 0) ?? 0;
            const monthSpent = txData.transactions
                ?.filter(t => t.type === 'expense' && t.dateISO?.startsWith(monthKey))
                .reduce((sum, t) => sum + t.amount, 0) ?? 0;

            // Goals completion
            const goalsTotal = goals?.goals?.length ?? 0;
            const goalsDone = goals?.goals?.filter(g => g.completed).length ?? 0;

            // Wellness: today's water intake
            const todayWellness = wellness?.days?.find(d => d.date === today);
            const waterToday = todayWellness?.glasses ?? 0;

            // Cycle Status Logic
            let periodStatus = undefined;
            let phase: PhaseInfo | null = null;
            let pendingReviewDate = null;

            if (period) {
                // Determine mandatory popup missing dates
                const nowLocal = new Date();
                const hour = nowLocal.getHours();

                if (!wizardPostponed) {
                    for (let i = 5; i >= 0; i--) {
                        const checkD = new Date(nowLocal);
                        checkD.setDate(nowLocal.getDate() - i);
                        const dStr = `${checkD.getFullYear()}-${String(checkD.getMonth() + 1).padStart(2, '0')}-${String(checkD.getDate()).padStart(2, '0')}`;

                        if (i === 0 && hour < 22) continue; // Si es hoy y es antes de las 10 PM, lo saltamos

                        const entry = period.dailyEntries?.[dStr];
                        if (!entry || !entry.moodLabel || entry.hasBled === undefined) {
                            pendingReviewDate = dStr;
                            break; // Se detiene en el más antiguo
                        }
                    }
                }

                const isActive = period.isPeriodActive === true;
                let isDayMissing = false;
                let day = 0;
                let daysUntil = 28; // Default

                if (period.cycleStartDate) {
                    phase = calculatePhase(period.cycleStartDate, period.cycleLength || 28, period.periodLength || 5);

                    // Calculate days until next period
                    const predictions = getPredictions(period.cycleStartDate, period.cycleLength);
                    if (predictions.nextPeriod) {
                        const next = new Date(predictions.nextPeriod);
                        const now = new Date();
                        const timeDiff = next.getTime() - now.getTime();
                        daysUntil = Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)));
                    }

                    if (isActive) {
                        // Check missing logic (simplified from widget)
                        const start = new Date(period.cycleStartDate + 'T00:00:00');
                        const now = new Date();
                        now.setHours(0, 0, 0, 0);

                        // Calc current day number
                        day = Math.floor((now.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;

                        // Iterate to find missing
                        for (let i = 0; i < 40; i++) {
                            const current = new Date(start);
                            current.setDate(start.getDate() + i);
                            if (current > now) break;

                            const dStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
                            if (!period.dailyEntries?.[dStr]) {
                                isDayMissing = true;
                                break;
                            }
                        }
                    }
                }

                periodStatus = { isActive, isDayMissing, day, daysUntil };
            }

            // Enhanced Body Alert: combina fase del ciclo + dailyEntry de hoy (energía, dolor, síntomas).
            // Si no hay nada, devuelve un fallback que invita a registrar el ciclo.
            const todayEntry = period?.dailyEntries?.[today] ?? null;
            const bodyAlert = getEnhancedBodyAlert(phase, todayEntry);

            setDashboard({ calories, calorieGoal, gymDone, gymGoal, gymWeeklyCompleted, todaySpent, monthSpent, goalsTotal, goalsDone, waterToday, periodStatus, bodyAlert, phase, pendingReviewDate, upcomingTrips });

        });
    }, [user, refresh]);

    const goalsProgress = dashboard.goalsTotal > 0
        ? Math.round((dashboard.goalsDone / dashboard.goalsTotal) * 100)
        : 0;

    return (
        <div className="pb-12">
            {/* ── Header ─────────────────────────────────────────────────────────── */}
            <header className="px-6 pt-12 pb-4 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src="/LOGO NIA.png" alt="Logo Nia" className="w-10 h-10 object-contain drop-shadow-sm" />
                        <h2 className="text-accent text-sm font-extrabold tracking-wide uppercase capitalize">{dateString}</h2>
                    </div>

                    {/* Profile Menu - Navigate to Profile Screen */}
                    <div className="relative z-50">
                        <div
                            onClick={() => navigate('/profile')}
                            className="h-11 w-11 rounded-full shadow-sm overflow-hidden border-2 border-primary cursor-pointer active:scale-95 transition-transform"
                        >
                            <img alt="Profile" className="h-full w-full object-cover" src={photoURL} referrerPolicy="no-referrer" />
                        </div>
                    </div>
                </div>
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">Hola {displayName} ✨</h1>
            </header>

            {/* ── Mandatory Cycle Modal ──────────────────────────────────────────── */}
            {dashboard.pendingReviewDate && (
                <CycleDayModal
                    date={dashboard.pendingReviewDate}
                    requireWizard={true}
                    onClose={(saved) => {
                        if (saved) {
                            // After saving, we force a re-fetch so it pops up the NEXT missing day if any
                            setRefresh(r => r + 1);
                        } else {
                            // If postponed/cancelled, we hide it immediately for the session
                            setWizardPostponed(true);
                            setDashboard(prev => ({ ...prev, pendingReviewDate: null }));
                        }
                    }}
                />
            )}

            {/* ── Daily Affirmation ──────────────────────────────────────────────── */}
            <section className="px-6 py-2 pb-0">
                <div className="bg-gradient-to-br from-[#ffe5ec] to-[#fff0f3] dark:from-[#2d1820] dark:to-[#3a2028] rounded-2xl p-6 shadow-sm relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/40 rounded-full blur-2xl"></div>
                    <div className="relative z-10">
                        <span className="inline-block py-1 px-3 bg-white/60 dark:bg-white/10 backdrop-blur-sm rounded-full text-xs font-bold text-accent mb-2">
                            Afirmación del día
                        </span>
                        <p className="text-lg font-bold text-text-main dark:text-slate-200 italic">{affirmation}</p>
                    </div>
                </div>
            </section>

            {/* ── Tu Cuerpo Hoy (Enhanced Body Alert) ────────────────────────────── */}
            {dashboard.bodyAlert && (() => {
                const alert = dashboard.bodyAlert;
                // Paleta según severidad
                const palette = alert.severity === 'care'
                    ? { bg: 'from-rose-50 to-pink-50 dark:from-[#3a1820] dark:to-[#2d1820]', border: 'border-rose-100 dark:border-rose-900/40', icon: 'text-rose-500', label: 'text-rose-400', symbol: 'spa' }
                    : alert.severity === 'energy'
                    ? { bg: 'from-amber-50 to-orange-50 dark:from-[#3a2820] dark:to-[#2d1f15]', border: 'border-amber-100 dark:border-amber-900/40', icon: 'text-amber-500', label: 'text-amber-400', symbol: 'bolt' }
                    : { bg: 'from-indigo-50 to-purple-50 dark:from-[#2a2035] dark:to-[#332038]', border: 'border-indigo-100 dark:border-purple-900/40', icon: 'text-indigo-500', label: 'text-indigo-400', symbol: 'auto_awesome' };
                // Badge según fuente del insight (para que se note que es dinámico)
                const sourceBadge = alert.source === 'combined' ? '✦ Personalizado' : alert.source === 'entry' ? '✦ Según tu día' : alert.source === 'fallback' ? 'Empieza aquí' : null;
                return (
                    <section className="px-6 py-4 pb-0">
                        <button
                            onClick={() => navigate('/period')}
                            className={`w-full text-left bg-gradient-to-r ${palette.bg} rounded-3xl p-4 shadow-sm border ${palette.border} flex items-start gap-4 transition-all hover:shadow-md active:scale-[0.99] cursor-pointer`}
                        >
                            <div className={`w-12 h-12 flex-shrink-0 bg-white dark:bg-black/20 rounded-full shadow-sm ${palette.icon} flex items-center justify-center`}>
                                <span className="material-symbols-outlined text-xl">{palette.symbol}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-0.5">
                                    <p className={`text-[10px] uppercase font-black ${palette.label} tracking-wider`}>Tu Cuerpo Hoy</p>
                                    {sourceBadge && (
                                        <span className={`text-[9px] font-bold ${palette.label} bg-white/60 dark:bg-white/10 px-1.5 py-0.5 rounded-full`}>
                                            {sourceBadge}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-snug">
                                    {alert.headline}
                                </p>
                                {alert.detail && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug mt-1">
                                        {alert.detail}
                                    </p>
                                )}
                            </div>
                        </button>
                    </section>
                );
            })()}

            {/* ── Cycle Widget (Banner Mode) ─────────────────────────────────────── */}
            {/* Show only if Urgent: Active & Missing OR Inactive & <= 2 days */}
            {dashboard.periodStatus && (
                (dashboard.periodStatus.isActive && dashboard.periodStatus.isDayMissing) ||
                (!dashboard.periodStatus.isActive && dashboard.periodStatus.daysUntil <= 2)
            ) && (
                    <section className="px-6 py-4 pb-0">
                        <CycleWidget />
                    </section>
                )}

            {/* ── Debts Alert Modal ─────────────────────────────────────────────── */}
            {showDebtModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-[#2d1820] w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden">
                        {/* Decorative background blobs */}
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-rose-100 dark:bg-rose-900/20 rounded-full blur-2xl"></div>
                        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-100 dark:bg-indigo-900/20 rounded-full blur-2xl"></div>

                        <div className="relative z-10 flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/30 rounded-full flex items-center justify-center mb-4 animate-bounce">
                                <span className="text-4xl">💸</span>
                            </div>

                            <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mb-2">¡Ojo al piojo! 🐰</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 px-4">
                                Tienes <strong className="text-rose-500">{pendingDebts.length}</strong> {pendingDebts.length === 1 ? 'pago pendiente' : 'pagos pendientes'} para hoy o vencidos.
                            </p>

                            <div className="w-full space-y-3 mb-6 max-h-[40vh] overflow-y-auto pr-1">
                                {pendingDebts.map(debt => (
                                    <div key={debt.id} className="bg-slate-50 dark:bg-[#1a0d10] p-3 rounded-2xl flex items-center justify-between border border-slate-100 dark:border-[#5a2b35]/50">
                                        <div className="flex items-center gap-3 text-left">
                                            <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                            <div>
                                                <p className="font-bold text-sm text-slate-700 dark:text-slate-200">{debt.title}</p>
                                                <p className="text-[10px] text-rose-500 font-bold">
                                                    {new Date(debt.dueDate + 'T23:59:59') < new Date() ? '¡Vencido!' : 'Vence hoy'}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="font-extrabold text-slate-800 dark:text-slate-100">
                                            ${debt.amount.toLocaleString()}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => setShowDebtModal(false)}
                                    className="flex-1 py-3.5 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-sm"
                                >
                                    Más tarde
                                </button>
                                <button
                                    onClick={() => navigate('/debts')}
                                    className="flex-1 py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-rose-400 to-pink-500 shadow-lg shadow-rose-200 dark:shadow-none hover:scale-105 transition-transform text-sm"
                                >
                                    Ir a pagar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Summary Grid ───────────────────────────────────────────────────── */}
            <section className="px-6 py-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Resumen de hoy</h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">

                    {/* Debts Summary Card */}
                    {pendingDebts.length > 0 && (
                        <button
                            onClick={() => navigate('/debts')}
                            className="bg-white dark:bg-[#2d1820] p-4 rounded-3xl shadow-sm border border-rose-100 dark:border-rose-900/30 flex flex-col justify-between hover:shadow-md transition-shadow group text-left"
                        >
                            <div className="flex justify-between items-start w-full">
                                <div className="bg-rose-50 dark:bg-rose-900/20 p-2 rounded-full text-rose-500 group-hover:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-lg">payments</span>
                                </div>
                                <span className="text-xl font-bold text-slate-800 dark:text-slate-100">
                                    {pendingDebts.length}
                                </span>
                            </div>
                            <div>
                                <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">Deudas</p>
                                <p className="text-[10px] text-rose-500 font-bold">
                                    ¡Pendientes hoy!
                                </p>
                            </div>
                        </button>
                    )}

                    {/* Cycle Summary Card */}
                    {dashboard.periodStatus && (
                        <div
                            onClick={() => navigate('/period')}
                            className={`p-4 rounded-3xl shadow-sm flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group ${dashboard.periodStatus.isActive && dashboard.periodStatus.isDayMissing
                                ? 'bg-gradient-to-br from-rose-50 to-white dark:from-[#3a1520] dark:to-[#2d1820] border-2 border-rose-300 dark:border-rose-700'
                                : 'bg-gradient-to-br from-pink-50 to-white dark:from-[#3a2028] dark:to-[#2d1820] border border-pink-100 dark:border-[#5a2b35]'
                                }`}
                        >
                            <div className="flex justify-between items-start">
                                <div className={`p-2 rounded-full group-hover:scale-110 transition-transform ${dashboard.periodStatus.isDayMissing ? 'bg-rose-100 text-rose-500' : 'bg-pink-100 text-pink-500'
                                    }`}>
                                    <span className="material-symbols-outlined text-lg">{dashboard.periodStatus.isDayMissing ? 'warning' : 'water_drop'}</span>
                                </div>
                                <span className={`text-xs font-bold flex items-center gap-1 ${dashboard.periodStatus.isActive ? 'text-pink-400' : 'text-indigo-400'
                                    }`}>
                                    {dashboard.periodStatus.isActive ? `Día ${dashboard.periodStatus.day}` : `En ${dashboard.periodStatus.daysUntil}d`}
                                </span>
                            </div>
                            <div>
                                <p className="font-bold text-slate-700 dark:text-slate-200">Ciclo</p>
                                <p className="text-[10px] font-medium">
                                    {dashboard.periodStatus.isActive && dashboard.periodStatus.isDayMissing
                                        ? '⚠️ Registrar día'
                                        : dashboard.periodStatus.isActive
                                            ? 'Todo en orden ✨'
                                            : `Próximo en ${dashboard.periodStatus.daysUntil} días`}
                                </p>
                                <div className={`h-1.5 rounded-full mt-2 overflow-hidden ${dashboard.periodStatus.isDayMissing ? 'bg-rose-100' : 'bg-pink-100'
                                    }`}>
                                    <div
                                        className={`h-1.5 rounded-full transition-all ${dashboard.periodStatus.isDayMissing ? 'bg-rose-400 animate-pulse' : 'bg-pink-400'
                                            }`}
                                        style={{ width: dashboard.periodStatus.isActive ? '100%' : `${Math.max(0, 100 - (dashboard.periodStatus.daysUntil / 28) * 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Goals Card */}
                    <div className="bg-white dark:bg-[#2d1820] p-4 rounded-3xl shadow-sm border border-slate-50 dark:border-[#5a2b35]/30 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                            <div className="bg-rose-100 p-2 rounded-full text-rose-500">
                                <span className="material-symbols-outlined text-lg">check_circle</span>
                            </div>
                            <span className="text-xl font-bold text-slate-800 dark:text-slate-100">
                                {dashboard.goalsDone}<span className="text-sm text-slate-400 font-normal">/{dashboard.goalsTotal}</span>
                            </span>
                        </div>
                        <div>
                            <p className="font-bold text-slate-700 dark:text-slate-200">Metas</p>
                            <p className="text-[10px] text-rose-400 font-bold">
                                {dashboard.goalsTotal === 0 ? 'Agrega metas ✨' : goalsProgress === 100 ? '¡Todo listo! 🎉' : `${goalsProgress}% completado`}
                            </p>
                            <div className="w-full bg-rose-100 h-1.5 rounded-full mt-2">
                                <div className="bg-rose-400 h-1.5 rounded-full transition-all" style={{ width: `${goalsProgress}%` }}></div>
                            </div>
                        </div>
                    </div>

                    {/* Calories Card */}
                    {(() => {
                        const cal = dashboard.calories;
                        const goal = dashboard.calorieGoal;
                        const pct = goal > 0 ? Math.min((cal / goal) * 100, 100) : 0;
                        const remaining = Math.max(0, goal - cal);
                        const overshoot = cal > goal;
                        // Estado: vacío / en camino / cerca / completo / pasado
                        const statusLabel = cal === 0
                            ? 'Sin registros hoy'
                            : overshoot
                                ? `+${(cal - goal).toLocaleString()} sobre meta`
                                : pct >= 90
                                    ? '¡Casi en meta! 🎯'
                                    : `${remaining.toLocaleString()} kcal por consumir`;
                        const barColor = overshoot ? 'bg-amber-400' : pct >= 90 ? 'bg-emerald-400' : 'bg-cyan-400';
                        return (
                            <button
                                onClick={() => navigate('/food')}
                                className="bg-white dark:bg-[#2d1820] p-4 rounded-3xl shadow-sm border border-slate-50 dark:border-[#5a2b35]/30 flex flex-col justify-between hover:shadow-md transition-shadow text-left"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="bg-cyan-100 p-2 rounded-full text-cyan-600">
                                        <span className="material-symbols-outlined text-lg">nutrition</span>
                                    </div>
                                    <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/30 px-2 py-1 rounded-full border border-cyan-100 dark:border-cyan-800">
                                        {Math.round(pct)}%
                                    </span>
                                </div>
                                <div>
                                    <p className="font-bold text-slate-700 dark:text-slate-200">Calorías</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                        <span className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">{cal.toLocaleString()}</span>
                                        <span className="text-slate-400"> / {goal.toLocaleString()} kcal</span>
                                    </p>
                                    <p className={`text-[10px] font-bold mt-0.5 ${overshoot ? 'text-amber-500' : 'text-cyan-500'}`}>
                                        {statusLabel}
                                    </p>
                                    <div className="w-full bg-cyan-50 dark:bg-black/20 h-1.5 rounded-full mt-2 overflow-hidden">
                                        <div
                                            className={`${barColor} h-1.5 rounded-full transition-all`}
                                            style={{ width: `${pct}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </button>
                        );
                    })()}

                    {/* Gym Card */}
                    <div className="bg-white dark:bg-[#2d1820] p-4 rounded-3xl shadow-sm border border-slate-50 dark:border-[#5a2b35]/30 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start z-10">
                            <div className="bg-emerald-100 p-2 rounded-full text-emerald-600">
                                <span className="material-symbols-outlined text-lg">fitness_center</span>
                            </div>
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-full border border-emerald-100 dark:border-emerald-800">
                                {dashboard.gymWeeklyCompleted} / {dashboard.gymGoal}
                            </span>
                        </div>
                        <div className="z-10 mt-2">
                            <p className="font-bold text-slate-700 dark:text-slate-200">Gym</p>
                            <p className="text-[10px] text-slate-400 font-medium">
                                Esta semana: <span className="font-bold text-emerald-500">{dashboard.gymWeeklyCompleted >= dashboard.gymGoal ? '¡Meta! ✨' : 'En progreso'}</span>
                            </p>
                            <div className="w-full bg-emerald-50 dark:bg-black/20 h-1.5 rounded-full mt-2 overflow-hidden">
                                <div
                                    className="bg-emerald-400 h-1.5 rounded-full transition-all"
                                    style={{ width: `${Math.min((dashboard.gymWeeklyCompleted / dashboard.gymGoal) * 100, 100)}%` }}
                                ></div>
                            </div>
                        </div>
                        <div className="absolute -bottom-4 -right-4 bg-emerald-50 w-24 h-24 rounded-full opacity-50 z-0 group-hover:scale-110 transition-transform"></div>
                    </div>

                    {/* Finance Card — gasto del día con contexto del mes */}
                    {(() => {
                        const today = dashboard.todaySpent;
                        const month = dashboard.monthSpent;
                        // Promedio diario del mes hasta hoy (incluyendo hoy)
                        const dayOfMonth = new Date().getDate();
                        const dailyAvg = dayOfMonth > 0 ? Math.round(month / dayOfMonth) : 0;
                        // Proyección del mes (si sigues a este ritmo)
                        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
                        const projection = dailyAvg * daysInMonth;
                        // Comparación del día vs promedio
                        const isAboveAvg = dailyAvg > 0 && today > dailyAvg * 1.2;
                        const isBelowAvg = today === 0 || (dailyAvg > 0 && today < dailyAvg * 0.5);
                        const dotColor = today === 0 ? 'bg-emerald-400' : isAboveAvg ? 'bg-rose-400' : isBelowAvg ? 'bg-emerald-400' : 'bg-amber-400';
                        const subLabel = today === 0
                            ? 'Sin gastos hoy 🎉'
                            : isAboveAvg
                                ? 'Hoy vas sobre tu promedio'
                                : isBelowAvg
                                    ? 'Hoy vas bajo el promedio'
                                    : 'En línea con el mes';
                        return (
                            <button
                                onClick={() => navigate('/finance')}
                                className="bg-white dark:bg-[#2d1820] p-4 rounded-3xl shadow-sm border border-slate-50 dark:border-[#5a2b35]/30 flex flex-col justify-between hover:shadow-md transition-shadow text-left"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="bg-purple-100 p-2 rounded-full text-purple-500">
                                        <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
                                    </div>
                                    {dailyAvg > 0 && (
                                        <span className="text-[10px] font-bold text-purple-500 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded-full">
                                            ~${(dailyAvg / 1000).toFixed(0)}k/día
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <p className="font-bold text-slate-700 dark:text-slate-200">Gastado</p>
                                    <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                                        ${today.toLocaleString('es-CO')}
                                    </span>
                                    <div className="flex items-center gap-1 mt-1">
                                        <div className={`w-2 h-2 rounded-full ${dotColor}`}></div>
                                        <p className="text-[10px] text-slate-400 truncate">{subLabel}</p>
                                    </div>
                                    {month > 0 && (
                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                            Mes: <span className="font-bold text-slate-600 dark:text-slate-300">${month.toLocaleString('es-CO')}</span>
                                            {projection > 0 && <span className="text-slate-400"> · proy. ${(projection / 1000).toFixed(0)}k</span>}
                                        </p>
                                    )}
                                </div>
                            </button>
                        );
                    })()}

                    {/* Wellness / Water Card */}
                    <div className="bg-white dark:bg-[#2d1820] p-4 rounded-3xl shadow-sm border border-slate-50 dark:border-[#5a2b35]/30 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                            <div className="bg-sky-100 p-2 rounded-full text-sky-500">
                                <span className="material-symbols-outlined text-lg">water_drop</span>
                            </div>
                            <span className="text-xl font-bold text-slate-800 dark:text-slate-100">
                                💧{dashboard.waterToday}
                            </span>
                        </div>
                        <div>
                            <p className="font-bold text-slate-700 dark:text-slate-200">Agua</p>
                            <p className="text-[10px] text-sky-400 font-bold">
                                {dashboard.waterToday === 0 ? 'Empieza hoy 💧' : dashboard.waterToday >= 8 ? '¡Meta cumplida! 🎉' : `${dashboard.waterToday}/8 vasos`}
                            </p>
                            <div className="w-full bg-sky-100 h-1.5 rounded-full mt-2 overflow-hidden">
                                <div
                                    className="bg-sky-400 h-1.5 rounded-full transition-all"
                                    style={{ width: `${Math.min((dashboard.waterToday / 8) * 100, 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* Travel Card mejorado */}
                    {dashboard.upcomingTrips.length > 0 && (() => {
                        const nextTrip = dashboard.upcomingTrips[0];
                        const days = Math.ceil((new Date(nextTrip.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        const isActive = nextTrip.status === 'active';
                        const packed = nextTrip.packingList?.filter(i => i.packed).length || 0;
                        const totalPack = nextTrip.packingList?.length || 0;
                        const checklistDone = (nextTrip.preTripChecklist || []).filter(i => i.completed).length;
                        const totalCheck = (nextTrip.preTripChecklist || []).length;
                        const essentialPending = nextTrip.packingList?.filter(i => i.priority === 'essential' && !i.packed).length || 0;
                        const overdueChecklist = (nextTrip.preTripChecklist || []).filter(i => {
                            if (i.completed || !i.dueDate) return false;
                            const today = new Date(); today.setHours(0,0,0,0);
                            return new Date(i.dueDate + 'T00:00:00') < today;
                        }).length;
                        const daysLabel = isActive
                            ? '¡En curso! 🌴'
                            : days <= 0 ? '¡Hoy! 🎉' : days === 1 ? 'Mañana ✈️' : `En ${days} días`;

                        return (
                            <button
                                onClick={() => navigate('/travel')}
                                className="bg-gradient-to-br from-pink-50 to-rose-50 dark:from-[#3a2028] dark:to-[#2d1820] p-4 rounded-3xl shadow-sm border border-pink-100 dark:border-[#5a2b35]/30 flex flex-col justify-between hover:shadow-md transition-shadow group text-left col-span-2"
                            >
                                <div className="flex justify-between items-start w-full mb-2">
                                    <div className="bg-pink-100 dark:bg-pink-900/30 p-2 rounded-full text-pink-500 group-hover:scale-110 transition-transform">
                                        <span className="material-symbols-outlined text-lg">{isActive ? 'flight_takeoff' : 'flight'}</span>
                                    </div>
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300' : 'bg-pink-50 dark:bg-pink-900/20 text-pink-400'}`}>
                                        {daysLabel}
                                    </span>
                                </div>
                                <div>
                                    <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">{isActive ? '✨ Viaje activo' : 'Próximo viaje'}</p>
                                    <p className="text-base font-bold text-pink-500 mt-0.5">{nextTrip.destination}</p>

                                    {/* Mini progress bars */}
                                    {!isActive && (totalCheck > 0 || totalPack > 0) && (
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            {totalCheck > 0 && (
                                                <div>
                                                    <div className="flex justify-between text-[9px] text-slate-400">
                                                        <span>Pre-viaje</span>
                                                        <span>{checklistDone}/{totalCheck}</span>
                                                    </div>
                                                    <div className="h-1 bg-pink-100 dark:bg-pink-900/30 rounded-full overflow-hidden mt-0.5">
                                                        <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${(checklistDone / totalCheck) * 100}%` }} />
                                                    </div>
                                                </div>
                                            )}
                                            {totalPack > 0 && (
                                                <div>
                                                    <div className="flex justify-between text-[9px] text-slate-400">
                                                        <span>Equipaje</span>
                                                        <span>{packed}/{totalPack}</span>
                                                    </div>
                                                    <div className="h-1 bg-pink-100 dark:bg-pink-900/30 rounded-full overflow-hidden mt-0.5">
                                                        <div className="h-full bg-pink-400 rounded-full transition-all" style={{ width: `${(packed / totalPack) * 100}%` }} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Alertas */}
                                    {(essentialPending > 0 || overdueChecklist > 0) && !isActive && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {essentialPending > 0 && (
                                                <span className="text-[9px] bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300 px-1.5 py-0.5 rounded-full font-bold">
                                                    ⚠️ {essentialPending} esencial{essentialPending > 1 ? 'es' : ''}
                                                </span>
                                            )}
                                            {overdueChecklist > 0 && (
                                                <span className="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                                                    🔔 {overdueChecklist} vencida{overdueChecklist > 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </button>
                        );
                    })()}
                </div>
            </section>
        </div>
    );
};

