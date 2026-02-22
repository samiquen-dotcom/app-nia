
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { MoodTracker } from '../components/MoodTracker';
import { CycleWidget } from '../components/CycleWidget';
import { useAuth } from '../context/AuthContext';
import { FirestoreService, Features } from '../services/firestore';
import { auth } from '../firebase';
import { getPredictions } from '../utils/cycleLogic';
import { useTheme } from '../context/ThemeContext';
import type { FinanceData, GymData, FoodData, GoalsData, PeriodData, DebtsData, Debt } from '../types';

const todayStr = () => new Date().toISOString().split('T')[0];
const todayDate = () => new Date().toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });

interface DashboardData {
    calories: number;
    gymDone: boolean;
    gymStreak: number;
    todaySpent: number;
    goalsTotal: number;
    goalsDone: number;
    periodStatus?: {
        isActive: boolean;
        isDayMissing: boolean;
        day: number;
        daysUntil: number;
    };
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
    const [dateString, setDateString] = useState('');
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [dashboard, setDashboard] = useState<DashboardData>({
        calories: 0, gymDone: false, gymStreak: 0, todaySpent: 0, goalsTotal: 0, goalsDone: 0,
    });
    const { user } = useAuth();
    const { isDark, toggleTheme } = useTheme();
    const displayName = user?.displayName ? user.displayName.split(' ')[0] : 'Nia';
    const photoURL = user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}&backgroundColor=ffd6e0`;

    // Popup state
    const [pendingDebts, setPendingDebts] = useState<Debt[]>([]);
    const [showDebtModal, setShowDebtModal] = useState(false);

    // Pick a stable affirmation for today (changes daily)
    const affirmation = AFFIRMATIONS[new Date().getDate() % AFFIRMATIONS.length];

    useEffect(() => {
        const date = new Date();
        const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' };
        setDateString(date.toLocaleDateString('es-ES', options));
    }, []);

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
            FirestoreService.getFeatureData(user.uid, Features.DEBTS)
        ]).then(([finRaw, gymRaw, foodRaw, goalsRaw, periodRaw, debtsRaw]) => {
            const fin = finRaw as FinanceData | null;
            const gym = gymRaw as GymData | null;
            const food = foodRaw as FoodData | null;
            const goals = goalsRaw as GoalsData | null;
            const period = periodRaw as PeriodData | null;
            const debtsData = debtsRaw as DebtsData | null;

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
                Object.values(todayFood.meals).forEach((items: any[]) =>
                    items.forEach(i => { calories += i.calories; })
                );
            }

            // Gym: did she work out today?
            const gymDone = gym?.history?.some(h => h.date === today) ?? false;
            const gymStreak = gym?.streak ?? 0;

            // Finance: today's expenses (filter by dateISO for reliability)
            const todaySpent = fin?.transactions
                ?.filter(t => t.type === 'expense' && (t.dateISO === today || t.date === todayDateStr))
                .reduce((sum, t) => sum + t.amount, 0) ?? 0;

            // Goals completion
            const goalsTotal = goals?.goals?.length ?? 0;
            const goalsDone = goals?.goals?.filter(g => g.completed).length ?? 0;

            // Cycle Status Logic
            let periodStatus = undefined;
            if (period) {
                const isActive = period.isPeriodActive === true;
                let isDayMissing = false;
                let day = 0;
                let daysUntil = 28; // Default

                if (period.cycleStartDate) {
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

                            const dStr = current.toISOString().split('T')[0];
                            if (!period.dailyEntries?.[dStr]) {
                                isDayMissing = true;
                                break;
                            }
                        }
                    }
                }

                periodStatus = { isActive, isDayMissing, day, daysUntil };
            }

            setDashboard({ calories, gymDone, gymStreak, todaySpent, goalsTotal, goalsDone, periodStatus });
        });
    }, [user]);

    const goalsProgress = dashboard.goalsTotal > 0
        ? Math.round((dashboard.goalsDone / dashboard.goalsTotal) * 100)
        : 0;

    return (
        <div className="pb-12">
            {/* ── Header ─────────────────────────────────────────────────────────── */}
            <header className="px-6 pt-12 pb-4 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                    <h2 className="text-accent text-sm font-semibold tracking-wide uppercase capitalize">{dateString}</h2>

                    {/* Profile Menu */}
                    <div className="relative z-50">
                        <div
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                            className="h-11 w-11 rounded-full shadow-sm overflow-hidden border-2 border-primary cursor-pointer active:scale-95 transition-transform"
                        >
                            <img alt="Profile" className="h-full w-full object-cover" src={photoURL} referrerPolicy="no-referrer" />
                        </div>

                        {/* Dropdown */}
                        {showProfileMenu && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowProfileMenu(false)}
                                ></div>
                                <div className="absolute right-0 top-12 bg-white dark:bg-[#3a2028] shadow-xl rounded-2xl p-2 z-50 min-w-[160px] border border-pink-100 dark:border-[#5a2b35] animate-in fade-in zoom-in-95 duration-200">
                                    <div className="px-3 py-2 border-b border-pink-50 dark:border-white/10 mb-1">
                                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{displayName}</p>
                                        <p className="text-[10px] text-slate-400">Premium Member ✨</p>
                                    </div>
                                    <button
                                        onClick={toggleTheme}
                                        className="w-full text-left px-3 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl flex items-center gap-2 transition-colors mb-1"
                                    >
                                        <span className={`material-symbols-outlined text-lg ${isDark ? 'text-yellow-300' : 'text-slate-400'}`}>
                                            {isDark ? 'light_mode' : 'dark_mode'}
                                        </span>
                                        {isDark ? 'Modo Claro' : 'Modo Oscuro'}
                                    </button>
                                    <button
                                        onClick={() => signOut(auth)}
                                        className="w-full text-left px-3 py-2.5 text-sm text-rose-500 font-bold hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl flex items-center gap-2 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-lg">logout</span>
                                        Cerrar Sesión
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">Hola {displayName} ✨</h1>
            </header>

            {/* ── Mood Tracker ───────────────────────────────────────────────────── */}
            <MoodTracker />

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
                    {dashboard.periodStatus && dashboard.periodStatus.isActive && !dashboard.periodStatus.isDayMissing && (
                        <div
                            onClick={() => navigate('/period')}
                            className="bg-gradient-to-br from-pink-50 to-white dark:from-[#3a2028] dark:to-[#2d1820] p-4 rounded-3xl shadow-sm border border-pink-100 dark:border-[#5a2b35] flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group"
                        >
                            <div className="flex justify-between items-start">
                                <div className="bg-pink-100 p-2 rounded-full text-pink-500 group-hover:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-lg">water_drop</span>
                                </div>
                                <span className="text-xs font-bold text-pink-400 flex items-center gap-1">
                                    Día {dashboard.periodStatus.day}
                                </span>
                            </div>
                            <div>
                                <p className="font-bold text-slate-700 dark:text-slate-200">Ciclo</p>
                                <p className="text-[10px] text-slate-400 font-medium">
                                    Todo en orden ✨
                                </p>
                                <div className="w-full bg-pink-100 h-1.5 rounded-full mt-2 overflow-hidden">
                                    <div
                                        className="bg-pink-400 h-1.5 rounded-full"
                                        style={{ width: '100%' }}
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
                            <div className="bg-orange-100 p-2 rounded-full text-orange-500">
                                <span className="material-symbols-outlined text-lg">fitness_center</span>
                            </div>
                            {dashboard.gymStreak > 0 && (
                                <span className="text-xs font-bold text-orange-400 flex items-center gap-0.5">
                                    {dashboard.gymStreak}<span className="material-symbols-outlined text-sm">local_fire_department</span>
                                </span>
                            )}
                        </div>
                        <div className="z-10">
                            <p className="font-bold text-slate-700 dark:text-slate-200">Gym</p>
                            <p className="text-xs text-slate-400">
                                Hoy: <span className={`font-bold ${dashboard.gymDone ? 'text-green-500' : 'text-rose-400'}`}>
                                    {dashboard.gymDone ? 'Listo ✓' : 'Pendiente'}
                                </span>
                            </p>
                            <p className="text-[10px] text-orange-400 mt-1 font-bold">
                                {dashboard.gymDone ? '¡Bien hecho, Nia! 💪' : '¡Tú puedes, Nia! 💪'}
                            </p>
                        </div>
                        <div className="absolute -bottom-4 -right-4 bg-orange-50 w-24 h-24 rounded-full opacity-50 z-0 group-hover:scale-110 transition-transform"></div>
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
                </div>
            </section>
        </div>
    );
};

