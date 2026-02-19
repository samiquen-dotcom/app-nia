import React, { useState, useEffect } from 'react';
import { useFeatureData } from '../hooks/useFeatureData';
import type { FoodData, FoodItem } from '../types';

const MEAL_NAMES  = ['Desayuno', 'Almuerzo', 'Cena', 'Snacks'] as const;
const CALORIE_GOAL = 2000;
const todayStr     = () => new Date().toISOString().split('T')[0];

const emptyMeals = (): Record<string, FoodItem[]> =>
    Object.fromEntries(MEAL_NAMES.map(m => [m, []]));

export const FoodScreen: React.FC = () => {
    const { data, save, loading } = useFeatureData<FoodData>('food', { days: [] });

    const [newItemName, setNewItemName] = useState('');
    const [newItemCal,  setNewItemCal]  = useState('');
    const [activeMeal,  setActiveMeal]  = useState<string | null>(null);
    const [migrated,    setMigrated]    = useState(false);

    const today     = todayStr();
    const todayFood = data.days.find(d => d.date === today);
    const meals     = todayFood?.meals ?? emptyMeals();

    const totalCalories = Object.values(meals)
        .flat()
        .reduce((sum, item) => sum + item.calories, 0);

    const percentage = Math.min((totalCalories / CALORIE_GOAL) * 100, 100);

    // ─── Migrate localStorage → Firestore once ────────────────────────────────
    useEffect(() => {
        if (loading || migrated) return;
        const saved = localStorage.getItem('nia_food');
        if (!saved) { setMigrated(true); return; }
        try {
            const parsed = JSON.parse(saved) as { meals: Record<string, FoodItem[]>; total: number };
            const existingDay = data.days.find(d => d.date === today);
            if (!existingDay && parsed.meals) {
                const otherDays = data.days.filter(d => d.date !== today);
                save({ days: [{ date: today, meals: parsed.meals }, ...otherDays] });
                localStorage.removeItem('nia_food');
            }
        } catch {
            localStorage.removeItem('nia_food');
        }
        setMigrated(true);
    }, [loading]);

    // ─── Add food item ────────────────────────────────────────────────────────
    const addFood = (meal: string) => {
        if (!newItemName.trim() || !newItemCal) return;
        const cal = parseInt(newItemCal);
        if (isNaN(cal) || cal <= 0) return;

        const currentMeals  = todayFood?.meals ?? emptyMeals();
        const updatedMeal   = [...(currentMeals[meal] || []), { id: Date.now(), name: newItemName.trim(), calories: cal }];
        const updatedMeals  = { ...currentMeals, [meal]: updatedMeal };
        const otherDays     = data.days.filter(d => d.date !== today);

        save({ days: [{ date: today, meals: updatedMeals }, ...otherDays] });
        setNewItemName('');
        setNewItemCal('');
    };

    // ─── Remove food item ─────────────────────────────────────────────────────
    const removeFood = (meal: string, id: number) => {
        const currentMeals = todayFood?.meals ?? emptyMeals();
        const updatedMeal  = (currentMeals[meal] || []).filter(i => i.id !== id);
        const updatedMeals = { ...currentMeals, [meal]: updatedMeal };
        const otherDays    = data.days.filter(d => d.date !== today);
        save({ days: [{ date: today, meals: updatedMeals }, ...otherDays] });
    };

    return (
        <div className="p-6 pt-12 pb-24">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">¿Qué comiste hoy, Nia? 🍑</h1>

            {/* ── Calorie Ring ──────────────────────────────────────────────────── */}
            <div className="bg-white dark:bg-[#2d1820] rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-[#5a2b35]/30 mb-6 flex flex-col items-center">
                <div className="relative w-40 h-40 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle
                            className="text-gray-100 dark:text-[#3a2028]"
                            cx="80" cy="80" fill="transparent" r="70"
                            stroke="currentColor" strokeWidth="12"
                        />
                        <circle
                            className={`transition-all duration-1000 ease-out ${percentage >= 100 ? 'text-rose-400' : 'text-emerald-400'}`}
                            cx="80" cy="80" fill="transparent" r="70"
                            stroke="currentColor"
                            strokeDasharray="440"
                            strokeDashoffset={440 - (440 * percentage) / 100}
                            strokeLinecap="round" strokeWidth="12"
                        />
                    </svg>
                    <div className="absolute text-center">
                        <span className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{totalCalories}</span>
                        <span className="text-xs text-slate-400 block">de {CALORIE_GOAL} kcal</span>
                    </div>
                </div>

                {percentage >= 100 && (
                    <p className="text-xs text-rose-500 font-bold mt-2">¡Meta calórica alcanzada! 🎯</p>
                )}

                <div className="flex gap-3 mt-4">
                    <div className="px-3 py-1 bg-orange-100 text-orange-600 rounded-full text-xs font-bold">Carbs</div>
                    <div className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-xs font-bold">Proteína</div>
                    <div className="px-3 py-1 bg-yellow-100 text-yellow-600 rounded-full text-xs font-bold">Grasas</div>
                </div>
            </div>

            {/* ── Meals Accordion ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MEAL_NAMES.map(meal => (
                    <div key={meal} className="bg-white dark:bg-[#2d1820] rounded-2xl shadow-sm border border-slate-100 dark:border-[#5a2b35]/30 overflow-hidden h-fit">

                        <button
                            onClick={() => setActiveMeal(activeMeal === meal ? null : meal)}
                            className="w-full flex justify-between items-center p-4"
                        >
                            <div className="flex items-center gap-3">
                                <div className="bg-emerald-50 dark:bg-emerald-900/30 p-2 rounded-xl text-emerald-500">
                                    <span className="material-symbols-outlined">restaurant</span>
                                </div>
                                <span className="font-bold text-slate-700 dark:text-slate-200">{meal}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400 font-bold">
                                    {(meals[meal] || []).reduce((acc, curr) => acc + curr.calories, 0)} kcal
                                </span>
                                <span className={`material-symbols-outlined text-slate-300 transition-transform ${activeMeal === meal ? 'rotate-180' : ''}`}>
                                    expand_more
                                </span>
                            </div>
                        </button>

                        {activeMeal === meal && (
                            <div className="p-4 pt-0 bg-slate-50/50 dark:bg-[#1a0d10]/50">
                                <div className="space-y-2 mb-4">
                                    {(meals[meal] || []).map(item => (
                                        <div key={item.id} className="flex justify-between items-center text-sm group">
                                            <span className="text-slate-600 dark:text-slate-300 flex-1">{item.name}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-400">{item.calories} kcal</span>
                                                <button
                                                    onClick={() => removeFood(meal, item.id)}
                                                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-400 transition-opacity"
                                                >
                                                    <span className="material-symbols-outlined text-base">close</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {(meals[meal] || []).length === 0 && (
                                        <p className="text-xs text-slate-400 text-center py-2">Nada registrado aún.</p>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <input
                                        className="flex-[2] rounded-xl border border-slate-200 dark:border-[#5a2b35]/40 dark:bg-[#2d1820] dark:text-slate-200 text-sm px-3 py-2 focus:outline-none focus:border-emerald-400"
                                        placeholder="Manzana..."
                                        value={newItemName}
                                        onChange={e => setNewItemName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addFood(meal)}
                                    />
                                    <input
                                        className="flex-1 rounded-xl border border-slate-200 dark:border-[#5a2b35]/40 dark:bg-[#2d1820] dark:text-slate-200 text-sm px-3 py-2 focus:outline-none focus:border-emerald-400"
                                        placeholder="Cal"
                                        type="number"
                                        min="1"
                                        value={newItemCal}
                                        onChange={e => setNewItemCal(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addFood(meal)}
                                    />
                                    <button
                                        onClick={() => addFood(meal)}
                                        className="bg-emerald-500 text-white rounded-xl px-3 flex items-center justify-center hover:bg-emerald-600 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-sm">add</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
