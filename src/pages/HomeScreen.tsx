import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CycleWidget } from '../components/CycleWidget';
import { CycleDayModal } from '../components/CycleDayModal';
import { useAuth } from '../context/AuthContext';
import { FirestoreService, Features } from '../services/firestore';
import { getPredictions, calculatePhase, getPredictiveAlert } from '../utils/cycleLogic';
import type { FinanceData, GymData, FoodData, GoalsData, PeriodData, DebtsData, Debt, WellnessData } from '../types';

const todayStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const todayDate = () => new Date().toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });

interface DashboardData {
    calories: number;
    gymDone: boolean;
    gymGoal: number;
    gymWeeklyCompleted: number;
    todaySpent: number;
    goalsTotal: number;
    goalsDone: number;
    waterToday: number;
    periodStatus?: {
        isActive: boolean;
        isDayMissing: boolean;
        day: number;
        daysUntil: number;
    };
    predictiveAlert?: string | null;
    pendingReviewDate?: string | null;
}

const AFFIRMATIONS = [
    '"Soy capaz de lograr todo lo que me propongo con amor y paciencia." 🌸',
    '"Cada día soy más fuerte, más segura y más brillante." ✨',
    '"Mi bienestar es mi prioridad y lo cuido con cariño." 💕',
    '"Elijo la paz y el crecimiento en cada momento de mi día." 🌿',
    '"Soy suficiente, soy capaz, soy Nia." 💪',
];

export const HomeScreen: React.FC = () => {
    const navigate = useNavigate();
    const [refresh, setRefresh] = useState(0);
    const [wizardPostponed, setWizardPostponed] = useState(false);

    const dateString = new Date().toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long'
    });
    const [dashboard, setDashboard] = useState<DashboardData>({
        calories: 0, gymDone: false, gymGoal: 5, gymWeeklyCompleted: 0, todaySpent: 0, goalsTotal: 0, goalsDone: 0, waterToday: 0,
    });
    const { user } = useAuth();
    const displayName = user?.displayName ? user.displayName.split(' ')[0] : 'Nia';
    const photoURL = user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}&backgroundColor=ffd6e0`;

    // Popup state
    const [pendingDebts, setPendingDebts] = useState<Debt[]>([]);
    const [showDebtModal, setShowDebtModal] = useState(false);

    // Pick a stable affirmation for today (changes daily)
    const affirmation = AFFIRMATIONS[new Date().getDate() % AFFIRMATIONS.length];



    useEffect(() => {
        if (!user) return;
        const today = todayStr();
        const todayDateStr = todayDate();

        Promise.all([
            FirestoreService.getFeatureData(user.uid, Features.FINANCE),
            FirestoreService.getFeatureData(user.uid, Features.GYM),
            FirestoreService.getFeatureData(user.uid, Features.FOOD),
            FirestoreService.getFeatureData(user.uid, Features.GOALS),
            FirestoreService.getFeatureData(user.uid, Features.PERIOD),
            FirestoreService.getFeatureData(user.uid, Features.DEBTS),
            FirestoreService.getFeatureData(user.uid, Features.WELLNESS)
        ]).then(([finRaw, gymRaw, foodRaw, goalsRaw, periodRaw, debtsRaw, wellnessRaw]) => {
            const fin = finRaw as FinanceData | null;
            const gym = gymRaw as GymData | null;
            const food = foodRaw as FoodData | null;
            const goals = goalsRaw as GoalsData | null;
            const period = periodRaw as PeriodData | null;
            const debtsData = debtsRaw as DebtsData | null;
            const wellness = wellnessRaw as WellnessData | null;

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

            // Today's calories from Food
            const todayFood = food?.days?.find(d => d.date === today);
            let calories = 0;
            if (todayFood) {
                calories = todayFood.items?.reduce((sum: number, item: any) => sum + item.calories, 0) || 0;
            }

            // Gym: did she work out today? What's the weekly progress?
            const gymDone = gym?.history?.some(h => h.date === today) ?? false;
            const gymGoal = gym?.goalDaysPerWeek ?? 5;

            // Calculate weekly completed
            const currentDay = new Date().getDay();
            const diff = currentDay === 0 ? -6 : 1 - currentDay; // Adjust if Sunday
            const monday = new Date();
            monday.setDate(monday.getDate() + diff);
            monday.setHours(0, 0, 0, 0);

            let gymWeeklyCompleted = 0;
            if (gym?.history) {
                const weekDates = Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(monday);
                    d.setDate(monday.getDate() + i);
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                });
                gymWeeklyCompleted = weekDates.filter(date => gym.history.some(h => h.date === date)).length;
            }

            // Finance: today's expenses (filter by dateISO for reliability)
            const todaySpent = fin?.transactions
                ?.filter(t => t.type === 'expense' && t.dateISO === today)
                .reduce((sum, t) => sum + t.amount, 0) ?? 0;

            // Goals completion
            const goalsTotal = goals?.goals?.length ?? 0;
            const goalsDone = goals?.goals?.filter(g => g.completed).length ?? 0;

            // Wellness: today's water intake
            const todayWellness = wellness?.days?.find(d => d.date === today);
            const waterToday = todayWellness?.glasses ?? 0;

            // Cycle Status Logic
            let periodStatus = undefined;
            let predictiveAlert = null;
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
                    const phase = calculatePhase(period.cycleStartDate, period.cycleLength || 28, period.periodLength || 5);
                    predictiveAlert = getPredictiveAlert(phase);

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

            setDashboard({ calories, gymDone, gymGoal, gymWeeklyCompleted, todaySpent, goalsTotal, goalsDone, waterToday, periodStatus, predictiveAlert, pendingReviewDate });

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

            {/* ── Cycle Insight (Predictive Alert) ───────────────────────────────── */}
            {dashboard.predictiveAlert && (
                <section className="px-6 py-4 pb-0">
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-[#2a2035] dark:to-[#332038] rounded-3xl p-4 shadow-sm border border-indigo-100 dark:border-purple-900/40 flex items-start gap-4 transition-all">
                        <div className="w-12 h-12 flex-shrink-0 bg-white dark:bg-black/20 rounded-full shadow-sm text-indigo-500 flex items-center justify-center">
                            <span className="material-symbols-outlined text-xl">auto_awesome</span>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-black text-indigo-400 mb-0.5 tracking-wider">Tu Cuerpo Hoy</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-snug">
                                {dashboard.predictiveAlert}
                            </p>
                        </div>
                    </div>
                </section>
            )}

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
                    <div className="bg-white dark:bg-[#2d1820] p-4 rounded-3xl shadow-sm border border-slate-50 dark:border-[#5a2b35]/30 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                            <div className="bg-cyan-100 p-2 rounded-full text-cyan-600">
                                <span className="material-symbols-outlined text-lg">nutrition</span>
                            </div>
                        </div>
                        <div className="text-center">
                            <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{dashboard.calories}</span>
                            <p className="text-[10px] text-slate-400">kcal consumidas</p>
                            <p className="font-bold text-slate-700 dark:text-slate-200 mt-0.5">Calorías</p>
                        </div>
                    </div>

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

                    {/* Finance Card */}
                    <div className="bg-white dark:bg-[#2d1820] p-4 rounded-3xl shadow-sm border border-slate-50 dark:border-[#5a2b35]/30 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                            <div className="bg-purple-100 p-2 rounded-full text-purple-500">
                                <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
                            </div>
                        </div>
                        <div>
                            <p className="font-bold text-slate-700 dark:text-slate-200">Gastado</p>
                            <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                                ${dashboard.todaySpent.toFixed(2)}
                            </span>
                            <div className="flex items-center gap-1 mt-1">
                                <div className={`w-2 h-2 rounded-full ${dashboard.todaySpent > 0 ? 'bg-rose-400' : 'bg-emerald-400'}`}></div>
                                <p className="text-[10px] text-slate-400">
                                    {dashboard.todaySpent === 0 ? 'Sin gastos hoy' : 'Hoy'}
                                </p>
                            </div>
                        </div>
                    </div>

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
                </div>
            </section>
        </div>
    );
};

