import React, { useState, useEffect, useRef, useCallback } from 'react';
import Webcam from "react-webcam";
import { useFeatureData } from '../hooks/useFeatureData';
import type { FoodData, FoodItem } from '../types';
import { analyzeFoodImage } from '../services/geminiService';
import type { FoodAnalysisResult } from '../services/geminiService';

const MEAL_NAMES = ['Desayuno', 'Almuerzo', 'Cena', 'Snacks'] as const;
const todayStr = () => new Date().toISOString().split('T')[0];

const emptyMeals = (): Record<string, FoodItem[]> =>
    Object.fromEntries(MEAL_NAMES.map(m => [m, []]));

export const FoodScreen: React.FC = () => {
    const { data, save, loading } = useFeatureData<FoodData>('food', { days: [] });

    const [newItemName, setNewItemName] = useState('');
    const [newItemCal, setNewItemCal] = useState('');
    const [activeMeal, setActiveMeal] = useState<string | null>(null);
    const [migrated, setMigrated] = useState(false);

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showOptionsModal, setShowOptionsModal] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const webcamRef = useRef<Webcam>(null);

    // Estado para el Modal del Smart Scanner
    const [scannedResult, setScannedResult] = useState<FoodAnalysisResult | null>(null);
    const [selectedDestinationMeal, setSelectedDestinationMeal] = useState<string>(MEAL_NAMES[0]);

    const handleCameraClick = () => {
        console.log("Abriendo modal de opciones...");
        setShowOptionsModal(true);
    };

    const handleOpenGallery = () => {
        setShowOptionsModal(false);
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleOpenCamera = () => {
        setShowOptionsModal(false);
        setShowCamera(true);
    };

    const capturePhoto = useCallback(() => {
        if (!webcamRef.current) return;
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc) {
            setShowCamera(false);
            processImageBase64(imageSrc);
        }
    }, [webcamRef]);

    const processImageBase64 = async (base64data: string) => {
        setIsAnalyzing(true);
        setScannedResult(null);
        try {
            const result = await analyzeFoodImage(base64data);
            setScannedResult(result);
        } catch (error: any) {
            alert('Error analizando la imagen: ' + (error.message || 'Desconocido'));
        } finally {
            setIsAnalyzing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = () => {
            const base64data = reader.result as string;
            processImageBase64(base64data);
        };
        reader.onerror = () => {
            alert('Error leyendo el archivo');
        };
    };

    const saveScannedFood = () => {
        if (!scannedResult) return;
        const currentMeals = todayFood?.meals ?? emptyMeals();
        const meal = selectedDestinationMeal;

        const newEntry: FoodItem = {
            id: Date.now(),
            name: scannedResult.name,
            calories: scannedResult.calories,
            portion: scannedResult.portion,
            confidence: scannedResult.confidence,
            macros: scannedResult.macros,
            ingredients: scannedResult.ingredients
        };

        const updatedMeal = [...(currentMeals[meal] || []), newEntry];
        const updatedMeals = { ...currentMeals, [meal]: updatedMeal };
        const otherDays = data.days.filter(d => d.date !== today);

        save({ days: [{ date: today, meals: updatedMeals }, ...otherDays] });
        setScannedResult(null); // Cerrar el modal
        setActiveMeal(meal); // Abrir el acordeón para mostrarlo
    };

    const today = todayStr();
    const todayFood = data.days.find(d => d.date === today);
    const meals = todayFood?.meals ?? emptyMeals();

    const totalCalories = Object.values(meals)
        .flat()
        .reduce((sum, item) => sum + item.calories, 0);

    const CALORIE_GOAL = (data as any).preferences?.calorieGoal || 2000;
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

        const currentMeals = todayFood?.meals ?? emptyMeals();
        const updatedMeal = [...(currentMeals[meal] || []), { id: Date.now(), name: newItemName.trim(), calories: cal }];
        const updatedMeals = { ...currentMeals, [meal]: updatedMeal };
        const otherDays = data.days.filter(d => d.date !== today);

        save({ days: [{ date: today, meals: updatedMeals }, ...otherDays] });
        setNewItemName('');
        setNewItemCal('');
    };

    // ─── Remove food item ─────────────────────────────────────────────────────
    const removeFood = (meal: string, id: number) => {
        const currentMeals = todayFood?.meals ?? emptyMeals();
        const updatedMeal = (currentMeals[meal] || []).filter(i => i.id !== id);
        const updatedMeals = { ...currentMeals, [meal]: updatedMeal };
        const otherDays = data.days.filter(d => d.date !== today);
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
            {/* Botón Flotante Global para Escanear */}
            <div className="fixed bottom-24 right-6 z-[60]">
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        handleCameraClick();
                    }}
                    disabled={isAnalyzing}
                    className={`flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-4 rounded-full shadow-lg transition-transform ${isAnalyzing ? 'opacity-70 scale-95' : 'hover:-translate-y-1'}`}
                >
                    <span className={`material-symbols-outlined text-xl ${isAnalyzing ? 'animate-spin' : ''}`}>
                        {isAnalyzing ? 'progress_activity' : 'document_scanner'}
                    </span>
                    <span className="font-bold">{isAnalyzing ? 'Analizando...' : 'Escanear'}</span>
                </button>
            </div>

            {/* Input oculto para carga de imágenes IA */}
            <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
            />

            {/* Opciones Iniciales (Cámara o Galería) */}
            {showOptionsModal && (
                <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a0d10] w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
                        <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 text-center mb-2">Escanear Comida</h3>

                        <button
                            onClick={handleOpenCamera}
                            className="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 p-4 rounded-xl font-bold flex items-center gap-3 hover:bg-emerald-100 transition-colors"
                        >
                            <span className="material-symbols-outlined text-2xl">photo_camera</span>
                            Tomar Foto ahora
                        </button>

                        <button
                            onClick={handleOpenGallery}
                            className="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 p-4 rounded-xl font-bold flex items-center gap-3 hover:bg-indigo-100 transition-colors"
                        >
                            <span className="material-symbols-outlined text-2xl">imagesmode</span>
                            Subir desde Galería / Archivos
                        </button>

                        <button
                            onClick={() => setShowOptionsModal(false)}
                            className="p-3 text-slate-400 font-bold hover:text-slate-600 dark:hover:text-slate-200 mt-2"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Interfaz de Cámara en Vivo */}
            {showCamera && (
                <div className="fixed inset-0 z-[80] bg-black flex flex-col animate-in fade-in duration-200">
                    <div className="flex-1 relative flex items-center justify-center">
                        <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            videoConstraints={{ facingMode: "environment" }}
                            className="w-full h-full object-cover"
                        />
                        <button
                            onClick={() => setShowCamera(false)}
                            className="absolute top-6 left-6 w-12 h-12 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-md"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    <div className="h-32 bg-black flex items-center justify-center pb-8 shrink-0">
                        <button
                            onClick={capturePhoto}
                            className="w-20 h-20 bg-white rounded-full border-4 border-slate-300 active:scale-95 transition-transform"
                        >
                        </button>
                    </div>
                </div>
            )}

            {/* Modal Inteligente de Resultados */}
            {scannedResult && (
                <div className="fixed inset-0 z-[90] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a0d10] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Cabecera modal */}
                        <div className="p-6 pb-4 border-b border-slate-100 dark:border-[#5a2b35]/20 flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 leading-tight">
                                    {scannedResult.name}
                                </h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{scannedResult.portion}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <span className="text-2xl font-black text-emerald-500">{scannedResult.calories}</span>
                                <span className="text-xs text-slate-400 block font-bold uppercase tracking-wider">Kcal Totales</span>
                            </div>
                        </div>

                        {/* Cuerpo Scrolleable */}
                        <div className="p-6 overflow-y-auto">
                            {/* Nivel de Confianza */}
                            <div className="flex items-center gap-3 mb-6 bg-slate-50 dark:bg-[#2d1820]/50 p-3 rounded-2xl border border-slate-100 dark:border-[#5a2b35]/20">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white ${scannedResult.confidence >= 80 ? 'bg-emerald-400' : scannedResult.confidence >= 50 ? 'bg-orange-400' : 'bg-rose-400'}`}>
                                    {scannedResult.confidence}%
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-700 dark:text-slate-200">Confianza de IA</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {scannedResult.confidence >= 80 ? 'Análisis altamente preciso.' : 'Es una estimación visual.'}
                                    </div>
                                </div>
                            </div>

                            {/* Macros */}
                            <div className="mb-6">
                                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Macronutrientes</h4>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-2xl text-center border border-blue-100/50 dark:border-blue-900/30">
                                        <div className="text-lg font-black text-blue-600 dark:text-blue-400">{scannedResult.macros.protein}g</div>
                                        <div className="text-xs font-bold text-blue-500/70 dark:text-blue-400/70">Proteína</div>
                                    </div>
                                    <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-2xl text-center border border-orange-100/50 dark:border-orange-900/30">
                                        <div className="text-lg font-black text-orange-600 dark:text-orange-400">{scannedResult.macros.carbs}g</div>
                                        <div className="text-xs font-bold text-orange-500/70 dark:text-orange-400/70">Carbs</div>
                                    </div>
                                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-2xl text-center border border-yellow-100/50 dark:border-yellow-900/30">
                                        <div className="text-lg font-black text-yellow-600 dark:text-yellow-400">{scannedResult.macros.fats}g</div>
                                        <div className="text-xs font-bold text-yellow-500/70 dark:text-yellow-400/70">Grasas</div>
                                    </div>
                                </div>
                            </div>

                            {/* Ingredientes */}
                            {scannedResult.ingredients && scannedResult.ingredients.length > 0 && (
                                <div className="mb-6">
                                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Análisis de Ingredientes</h4>
                                    <div className="space-y-2">
                                        {scannedResult.ingredients.map((ing, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-white dark:bg-[#2d1820] p-3 rounded-xl border border-slate-100 dark:border-[#5a2b35]/30">
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{ing.name}</span>
                                                <span className="text-sm font-bold text-slate-400">{ing.calories} kcal</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Selector Destino */}
                            <div className="mb-2">
                                <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">¿A dónde lo guardamos?</label>
                                <select
                                    className="w-full bg-slate-50 dark:bg-[#2d1820] border border-slate-200 dark:border-[#5a2b35]/40 text-slate-700 dark:text-slate-200 p-3 rounded-xl font-medium focus:outline-none focus:border-indigo-400"
                                    value={selectedDestinationMeal}
                                    onChange={(e) => setSelectedDestinationMeal(e.target.value)}
                                >
                                    {MEAL_NAMES.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Pie del modal / Botones de acción */}
                        <div className="p-4 bg-slate-50 dark:bg-[#2d1820]/30 border-t border-slate-100 dark:border-[#5a2b35]/20 flex gap-3">
                            <button
                                onClick={() => setScannedResult(null)}
                                className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-[#5a2b35]/30 transition-colors"
                            >
                                Descartar
                            </button>
                            <button
                                onClick={saveScannedFood}
                                className="flex-[2] py-3 px-4 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20 transition-all active:scale-95"
                            >
                                Guardar Comida
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
