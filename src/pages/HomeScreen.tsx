import React, { useEffect, useState } from 'react';
import { MoodTracker } from '../components/MoodTracker';
import { useAuth } from '../context/AuthContext';
import { FirestoreService } from '../services/firestore';
import type { FinanceData, GymData, FoodData, GoalsData } from '../types';

const todayStr  = () => new Date().toISOString().split('T')[0];
const todayDate = () => new Date().toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });

interface DashboardData {
    calories:     number;
    gymDone:      boolean;
    gymStreak:    number;
    todaySpent:   number;
    goalsTotal:   number;
    goalsDone:    number;
}

const AFFIRMATIONS = [
    '"Soy capaz de lograr todo lo que me propongo con amor y paciencia." 🌸',
    '"Cada día soy más fuerte, más segura y más brillante." ✨',
    '"Mi bienestar es mi prioridad y lo cuido con cariño." 💕',
    '"Elijo la paz y el crecimiento en cada momento de mi día." 🌿',
    '"Soy suficiente, soy capaz, soy Nia." 💪',
];

export const HomeScreen: React.FC = () => {
    const [dateString, setDateString] = useState('');
    const [dashboard,  setDashboard]  = useState<DashboardData>({
        calories: 0, gymDone: false, gymStreak: 0, todaySpent: 0, goalsTotal: 0, goalsDone: 0,
    });
    const { user } = useAuth();
    const displayName = user?.displayName ? user.displayName.split(' ')[0] : 'Nia';
    const photoURL    = user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}&backgroundColor=ffd6e0`;

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
            FirestoreService.getFeatureData(user.uid, 'finance'),
            FirestoreService.getFeatureData(user.uid, 'gym'),
            FirestoreService.getFeatureData(user.uid, 'food'),
            FirestoreService.getFeatureData(user.uid, 'goals'),
        ]).then(([finRaw, gymRaw, foodRaw, goalsRaw]) => {
            const fin   = finRaw   as FinanceData  | null;
            const gym   = gymRaw   as GymData       | null;
            const food  = foodRaw  as FoodData      | null;
            const goals = goalsRaw as GoalsData     | null;

            // Today's calories from Food
            const todayFood = food?.days?.find(d => d.date === today);
            let calories = 0;
            if (todayFood) {
                Object.values(todayFood.meals).forEach(items =>
                    items.forEach(i => { calories += i.calories; })
                );
            }

            // Gym: did she work out today?
            const gymDone   = gym?.history?.some(h => h.date === today) ?? false;
            const gymStreak = gym?.streak ?? 0;

            // Finance: today's expenses (filter by dateISO for reliability)
            const todaySpent = fin?.transactions
                ?.filter(t => t.type === 'expense' && (t.dateISO === today || t.date === todayDateStr))
                .reduce((sum, t) => sum + t.amount, 0) ?? 0;

            // Goals completion
            const goalsTotal = goals?.goals?.length ?? 0;
            const goalsDone  = goals?.goals?.filter(g => g.completed).length ?? 0;

            setDashboard({ calories, gymDone, gymStreak, todaySpent, goalsTotal, goalsDone });
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
                    <div className="h-10 w-10 rounded-full bg-white p-1 shadow-sm overflow-hidden border-2 border-primary">
                        <img alt="Profile" className="h-full w-full object-cover rounded-full" src={photoURL} />
                    </div>
                </div>
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">Hola {displayName} ✨</h1>
            </header>

            {/* ── Mood Tracker ───────────────────────────────────────────────────── */}
            <MoodTracker />

            {/* ── Daily Affirmation ──────────────────────────────────────────────── */}
            <section className="px-6 py-2">
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

            {/* ── Summary Grid ───────────────────────────────────────────────────── */}
            <section className="px-6 py-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Resumen de hoy</h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">

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
