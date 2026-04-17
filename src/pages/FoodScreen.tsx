import React, { useState, useRef, useCallback, useMemo } from 'react';
import Webcam from "react-webcam";
import { useFeatureData } from '../hooks/useFeatureData';
import type { FoodData, FoodItem } from '../types';
import { analyzeFoodImage, analyzeFoodText, correctFoodAnalysis } from '../services/geminiService';
import type { FoodAnalysisResult } from '../services/geminiService';

const todayStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const formatDate = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// Helper para obtener nombre legible de fecha
const getFriendlyDateName = (dateStr: string): string => {
    const today = todayStr();
    const yesterday = formatDate(new Date(Date.now() - 86400000));
    const tomorrow = formatDate(new Date(Date.now() + 86400000));

    if (dateStr === today) return 'Hoy';
    if (dateStr === yesterday) return 'Ayer';
    if (dateStr === tomorrow) return 'Mañana';

    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
};

// Helper para obtener últimos 7 días
const getLast7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(formatDate(d));
    }
    return days;
};

export const FoodScreen: React.FC = () => {
    const { data, save, loading } = useFeatureData<FoodData>('food', { days: [] });

    // Estado para navegación por calendario
    const [selectedDate, setSelectedDate] = useState(todayStr());
    const isToday = selectedDate === todayStr();

    // Estado para registro de comida
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [registerMethod, setRegisterMethod] = useState<'photo' | 'text' | null>(null);

    // Estado para cámara
    const [showCamera, setShowCamera] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [lastImageBase64, setLastImageBase64] = useState<string | null>(null);

    // Estado para texto manual
    const [foodDescription, setFoodDescription] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const webcamRef = useRef<Webcam>(null);

    // Estado para el Modal del Smart Scanner
    const [scannedResult, setScannedResult] = useState<FoodAnalysisResult | null>(null);

    // Estado para corrección con IA
    const [showCorrectionModal, setShowCorrectionModal] = useState(false);
    const [correctionText, setCorrectionText] = useState('');
    const [isCorrecting, setIsCorrecting] = useState(false);

    // Estado para editar item
    const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
    const [editingItem, setEditingItem] = useState<{ item: FoodItem } | null>(null);
    type IngredientDraft = { name: string; calories: string };
    const [editForm, setEditForm] = useState<{
        name: string;
        calories: string;
        protein: string;
        carbs: string;
        fats: string;
        ingredients: IngredientDraft[];
    }>({ name: '', calories: '', protein: '', carbs: '', fats: '', ingredients: [] });

    // Estado para mover comida a otro día
    const [movingItem, setMovingItem] = useState<{ item: FoodItem } | null>(null);
    const [showMoveModal, setShowMoveModal] = useState(false);

    // ─── Navegación por calendario ─────────────────────────────────────────────
    const goToPreviousDay = () => {
        const prev = new Date(selectedDate);
        prev.setDate(prev.getDate() - 1);
        setSelectedDate(formatDate(prev));
    };

    const goToNextDay = () => {
        const next = new Date(selectedDate);
        next.setDate(next.getDate() + 1);
        if (next <= new Date()) {
            setSelectedDate(formatDate(next));
        }
    };

    const goToToday = () => {
        setSelectedDate(todayStr());
    };

    // ─── Handlers de registro ────────────────────────────────────────────────────
    const handleOpenRegisterModal = () => {
        setShowRegisterModal(true);
        setRegisterMethod(null);
        setFoodDescription('');
    };

    const handleSelectPhoto = () => {
        setRegisterMethod('photo');
        setShowRegisterModal(false);
        setShowOptionsModal(true);
    };

    const handleSelectText = () => {
        setRegisterMethod('text');
        setShowRegisterModal(false);
    };

    // ─── Handlers de cámara ────────────────────────────────────────────────────
    const [showOptionsModal, setShowOptionsModal] = useState(false);

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

    // ─── Procesamiento de imagen con IA ────────────────────────────────────────
    const processImageBase64 = async (base64data: string) => {
        setIsAnalyzing(true);
        setIsSaving(true);
        setScannedResult(null);
        setAnalysisError(null);
        setLastImageBase64(base64data);

        try {
            const result = await analyzeFoodImage(base64data);
            setScannedResult(result);
        } catch (error: any) {
            setAnalysisError(error.message || 'Error analizando la imagen');
        } finally {
            setIsAnalyzing(false);
            setIsSaving(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const retryAnalysis = async () => {
        if (lastImageBase64) {
            await processImageBase64(lastImageBase64);
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
            setAnalysisError('Error leyendo el archivo');
        };
    };

    // ─── Procesamiento de texto con IA ─────────────────────────────────────────
    const handleTextAnalysis = async () => {
        if (!foodDescription.trim()) return;

        setIsAnalyzing(true);
        setIsSaving(true);
        setScannedResult(null);
        setAnalysisError(null);

        try {
            const result = await analyzeFoodText(foodDescription);
            setScannedResult(result);
        } catch (error: any) {
            setAnalysisError(error.message || 'Error analizando el texto');
        } finally {
            setIsAnalyzing(false);
            setIsSaving(false);
        }
    };

    // ─── Guardar comida escaneada/analizada ────────────────────────────────────
    const saveScannedFood = () => {
        if (!scannedResult) return;

        const currentDay = data.days.find(d => d.date === selectedDate);
        const currentItems = currentDay?.items ?? [];

        const newEntry: FoodItem = {
            id: Date.now(),
            name: scannedResult.name,
            calories: scannedResult.calories,
            portion: scannedResult.portion,
            confidence: scannedResult.confidence,
            macros: scannedResult.macros,
            ingredients: scannedResult.ingredients
        };

        const updatedItems = [...currentItems, newEntry];
        const otherDays = data.days.filter(d => d.date !== selectedDate);
        save({ days: [{ date: selectedDate, items: updatedItems }, ...otherDays] });

        setScannedResult(null);
        setFoodDescription('');
        setShowRegisterModal(false);
    };

    // ─── Corrección con IA ───────────────────────────────────────────────────
    const handleCorrection = async () => {
        if (!correctionText.trim() || !scannedResult) return;

        setIsCorrecting(true);
        try {
            const correctedResult = await correctFoodAnalysis(
                scannedResult,
                correctionText,
                lastImageBase64 || undefined
            );
            setScannedResult(correctedResult);
            setShowCorrectionModal(false);
            setCorrectionText('');
        } catch (error: any) {
            setAnalysisError(error.message || 'Error corrigiendo el análisis');
            setShowCorrectionModal(false);
        } finally {
            setIsCorrecting(false);
        }
    };

    const openCorrectionModal = () => {
        setCorrectionText('');
        setShowCorrectionModal(true);
    };

    // ─── Cálculos de totales ───────────────────────────────────────────────────
    const todayFood = data.days.find(d => d.date === selectedDate);
    const todayItems = todayFood?.items ?? [];

    const totalCalories = todayItems.reduce((sum, item) => sum + item.calories, 0);

    // Cálculo real de macros totales
    const totalMacros = todayItems.reduce((acc, item) => ({
        protein: acc.protein + (item.macros?.protein || 0),
        carbs: acc.carbs + (item.macros?.carbs || 0),
        fats: acc.fats + (item.macros?.fats || 0)
    }), { protein: 0, carbs: 0, fats: 0 });

    const CALORIE_GOAL = (data as any).preferences?.calorieGoal || 2000;
    const percentage = Math.min((totalCalories / CALORIE_GOAL) * 100, 100);

    // ─── Estadísticas semanales ────────────────────────────────────────────────
    const weeklyStats = useMemo(() => {
        const last7Days = getLast7Days();
        return last7Days.map(date => {
            const day = data.days.find(d => d.date === date);
            const calories = day?.items?.reduce((sum, item) => sum + item.calories, 0) || 0;
            return { date, calories };
        });
    }, [data.days]);

    const avgCalories = Math.round(weeklyStats.reduce((sum, d) => sum + d.calories, 0) / 7);

    // ─── Eliminar comida ───────────────────────────────────────────────────────
    const removeFood = (id: number) => {
        const currentDay = data.days.find(d => d.date === selectedDate);
        const updatedItems = (currentDay?.items ?? []).filter(i => i.id !== id);
        const otherDays = data.days.filter(d => d.date !== selectedDate);
        save({ days: [{ date: selectedDate, items: updatedItems }, ...otherDays] });
        setExpandedItemId(null);
    };

    // ─── Editar comida ─────────────────────────────────────────────────────────
    const openEditModal = (item: FoodItem) => {
        setEditingItem({ item });
        setEditForm({
            name: item.name,
            calories: String(item.calories),
            protein: String(item.macros?.protein || ''),
            carbs: String(item.macros?.carbs || ''),
            fats: String(item.macros?.fats || ''),
            ingredients: (item.ingredients ?? []).map(i => ({
                name: i.name,
                calories: String(i.calories),
            })),
        });
    };

    // Recalcula el total de calorías a partir de la suma de ingredientes.
    const sumIngredients = (ings: IngredientDraft[]) =>
        String(ings.reduce((s, i) => s + (parseInt(i.calories) || 0), 0));

    const addIngredient = () => {
        setEditForm(prev => {
            const newIngredients = [...prev.ingredients, { name: '', calories: '' }];
            return { ...prev, ingredients: newIngredients, calories: sumIngredients(newIngredients) };
        });
    };

    const updateIngredient = (idx: number, field: 'name' | 'calories', value: string) => {
        setEditForm(prev => {
            const newIngredients = prev.ingredients.map((ing, i) => i === idx ? { ...ing, [field]: value } : ing);
            return { ...prev, ingredients: newIngredients, calories: sumIngredients(newIngredients) };
        });
    };

    const removeIngredient = (idx: number) => {
        setEditForm(prev => {
            const newIngredients = prev.ingredients.filter((_, i) => i !== idx);
            return { ...prev, ingredients: newIngredients, calories: sumIngredients(newIngredients) };
        });
    };

    // ─── Mover comida a otro día ───────────────────────────────────────────────
    const openMoveModal = (item: FoodItem) => {
        setMovingItem({ item });
        setShowMoveModal(true);
    };

    const moveItemToDate = (targetDate: string) => {
        if (!movingItem) return;

        // Obtener items del día origen (selectedDate)
        const currentDay = data.days.find(d => d.date === selectedDate);
        const currentItems = currentDay?.items ?? [];

        // Obtener items del día destino
        const targetDay = data.days.find(d => d.date === targetDate);
        const targetItems = targetDay?.items ?? [];

        // Filtrar item del día origen
        const updatedCurrentItems = currentItems.filter(i => i.id !== movingItem.item.id);

        // Agregar item al día destino (con nuevo ID para evitar duplicados)
        const movedItem = { ...movingItem.item, id: Date.now() };
        const updatedTargetItems = [...targetItems, movedItem];

        // Construir nuevo array de días
        let newDays = data.days.filter(d => d.date !== selectedDate && d.date !== targetDate);

        if (updatedCurrentItems.length > 0) {
            newDays = [{ date: selectedDate, items: updatedCurrentItems }, ...newDays];
        }

        newDays = [{ date: targetDate, items: updatedTargetItems }, ...newDays];

        save({ days: newDays });

        setShowMoveModal(false);
        setMovingItem(null);
        setExpandedItemId(null);
    };

    const saveEdit = () => {
        if (!editingItem || !editForm.name.trim() || !editForm.calories) return;

        const cal = parseInt(editForm.calories);
        if (isNaN(cal) || cal <= 0) return;

        const currentDay = data.days.find(d => d.date === selectedDate);
        const currentItems = currentDay?.items ?? [];

        const protein = parseInt(editForm.protein) || 0;
        const carbs = parseInt(editForm.carbs) || 0;
        const fats = parseInt(editForm.fats) || 0;
        const hasMacros = protein > 0 || carbs > 0 || fats > 0;

        // Ingredientes: conservar solo los que tienen nombre no vacío, kcal numéricas >= 0
        const cleanIngredients = editForm.ingredients
            .map(i => ({ name: i.name.trim(), calories: parseInt(i.calories) || 0 }))
            .filter(i => i.name.length > 0);

        const updatedItems = currentItems.map(item => {
            if (item.id === editingItem.item.id) {
                return {
                    ...item,
                    name: editForm.name.trim(),
                    calories: cal,
                    ingredients: cleanIngredients.length > 0 ? cleanIngredients : undefined,
                    ...(hasMacros ? {
                        macros: { protein, carbs, fats },
                        portion: item.portion || 'Porción editada',
                        confidence: item.confidence || 100
                    } : { macros: undefined, portion: undefined, confidence: undefined })
                };
            }
            return item;
        });

        const otherDays = data.days.filter(d => d.date !== selectedDate);
        save({ days: [{ date: selectedDate, items: updatedItems }, ...otherDays] });

        setEditingItem(null);
    };

    // Coherencia: suma de kcal de ingredientes vs calorías totales editadas
    const ingredientsSum = editForm.ingredients.reduce((s, i) => s + (parseInt(i.calories) || 0), 0);
    const editedTotal = parseInt(editForm.calories) || 0;
    const ingredientsMismatch =
        editForm.ingredients.length > 0 &&
        editedTotal > 0 &&
        Math.abs(ingredientsSum - editedTotal) > editedTotal * 0.15;

    // ─── UI: Loading ───────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0f0508]">
                <div className="text-center">
                    <span className="material-symbols-outlined text-4xl text-emerald-500 animate-spin">progress_activity</span>
                    <p className="text-slate-500 dark:text-slate-400 mt-4 font-medium">Cargando comidas...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 pt-12 pb-24 max-w-3xl mx-auto">
            {/* ── Header con navegación de calendario ─────────────────────────── */}
            <div className="flex items-center justify-between mb-6">
                <button
                    onClick={goToPreviousDay}
                    className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#2d1820] transition-colors"
                    aria-label="Día anterior"
                >
                    <span className="material-symbols-outlined text-slate-600 dark:text-slate-300">chevron_left</span>
                </button>

                <div className="text-center">
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">
                        {getFriendlyDateName(selectedDate)} 🍑
                    </h1>
                    {!isToday && (
                        <button
                            onClick={goToToday}
                            className="text-xs text-emerald-500 font-bold hover:text-emerald-600 mt-1"
                        >
                            Volver a hoy
                        </button>
                    )}
                </div>

                <button
                    onClick={goToNextDay}
                    disabled={selectedDate === todayStr()}
                    className={`p-2 rounded-xl transition-colors ${selectedDate === todayStr()
                            ? 'opacity-30 cursor-not-allowed'
                            : 'hover:bg-slate-100 dark:hover:bg-[#2d1820]'
                        }`}
                    aria-label="Día siguiente"
                >
                    <span className="material-symbols-outlined text-slate-600 dark:text-slate-300">chevron_right</span>
                </button>
            </div>

            {/* ── Calorie Ring ─────────────────────────────────────────────────── */}
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

                {/* Macros totales reales */}
                <div className="flex gap-2 sm:gap-3 mt-4 flex-wrap justify-center">
                    <div className="px-3 py-1.5 bg-orange-100 text-orange-600 rounded-full text-xs font-bold flex items-center gap-1">
                        <span>Carbs</span>
                        <span className="opacity-70">{totalMacros.carbs}g</span>
                    </div>
                    <div className="px-3 py-1.5 bg-blue-100 text-blue-600 rounded-full text-xs font-bold flex items-center gap-1">
                        <span>Proteína</span>
                        <span className="opacity-70">{totalMacros.protein}g</span>
                    </div>
                    <div className="px-3 py-1.5 bg-yellow-100 text-yellow-600 rounded-full text-xs font-bold flex items-center gap-1">
                        <span>Grasas</span>
                        <span className="opacity-70">{totalMacros.fats}g</span>
                    </div>
                </div>
            </div>

            {/* ── Estadísticas Semanales ─────────────────────────────────────── */}
            <div className="bg-white dark:bg-[#2d1820] rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-[#5a2b35]/30 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Esta Semana</h2>
                    <span className="text-xs text-slate-400 font-medium">Promedio: {avgCalories} kcal/día</span>
                </div>
                <div className="flex items-end justify-between gap-2 h-32">
                    {weeklyStats.map((day) => {
                        const height = Math.min((day.calories / CALORIE_GOAL) * 100, 100);
                        const isToday = day.date === todayStr();
                        const isSelected = day.date === selectedDate;
                        const dayName = new Date(day.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short' });

                        return (
                            <button
                                key={day.date}
                                onClick={() => setSelectedDate(day.date)}
                                className={`flex-1 flex flex-col items-center gap-1 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-60 hover:opacity-80'}`}
                            >
                                <div className="relative w-full flex justify-center">
                                    <div
                                        className={`w-full max-w-[24px] rounded-t-lg transition-all ${isToday ? 'bg-emerald-400' : day.calories > CALORIE_GOAL ? 'bg-rose-400' : 'bg-indigo-400'
                                            }`}
                                        style={{ height: `${Math.max(height, 8)}px`, minHeight: '8px' }}
                                    />
                                </div>
                                <span className={`text-xs font-medium ${isToday ? 'text-emerald-500' : 'text-slate-400'}`}>
                                    {dayName.replace('.', '')}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Lista de Comidas del Día ───────────────────────────────────── */}
            <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">
                    {todayItems.length === 0 ? 'Sin comidas registradas' : `${todayItems.length} comida${todayItems.length !== 1 ? 's' : ''} registrada${todayItems.length !== 1 ? 's' : ''}`}
                </h2>

                <div className="space-y-3">
                    {todayItems.map(item => (
                        <div
                            key={item.id}
                            className={`bg-white dark:bg-[#2d1820] rounded-2xl shadow-sm border transition-all overflow-hidden ${expandedItemId === item.id
                                    ? 'border-emerald-400 dark:border-emerald-500/50'
                                    : 'border-slate-100 dark:border-[#5a2b35]/30'
                                }`}
                        >
                            {/* Item principal (colapsado) */}
                            <button
                                onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                                className="w-full flex justify-between items-center p-4 text-left"
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.macros ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500' : 'bg-slate-100 dark:bg-[#3a2028] text-slate-400'
                                        }`}>
                                        <span className="material-symbols-outlined text-lg">
                                            {item.macros ? 'restaurant' : 'restaurant_menu'}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="font-bold text-slate-700 dark:text-slate-200 block truncate">
                                            {item.name}
                                        </span>
                                        {item.portion && (
                                            <span className="text-xs text-slate-400">{item.portion}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <span className="text-lg font-black text-slate-800 dark:text-slate-100">
                                        {item.calories}
                                    </span>
                                    <span className="text-xs text-slate-400 font-bold">kcal</span>
                                    <span className={`material-symbols-outlined text-slate-300 transition-transform ${expandedItemId === item.id ? 'rotate-180' : ''
                                        }`}>
                                        expand_more
                                    </span>
                                </div>
                            </button>

                            {/* Detalles expandidos */}
                            {expandedItemId === item.id && (
                                <div className="px-4 pb-4 bg-slate-50/50 dark:bg-[#1a0d10]/50 border-t border-slate-100 dark:border-[#5a2b35]/20">
                                    {/* Macros */}
                                    {item.macros && (
                                        <div className="grid grid-cols-3 gap-2 mt-4 mb-4">
                                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl text-center border border-blue-100/50 dark:border-blue-900/30">
                                                <div className="text-lg font-black text-blue-600 dark:text-blue-400">{item.macros.protein}g</div>
                                                <div className="text-xs font-bold text-blue-500/70 dark:text-blue-400/70">Proteína</div>
                                            </div>
                                            <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-xl text-center border border-orange-100/50 dark:border-orange-900/30">
                                                <div className="text-lg font-black text-orange-600 dark:text-orange-400">{item.macros.carbs}g</div>
                                                <div className="text-xs font-bold text-orange-500/70 dark:text-orange-400/70">Carbs</div>
                                            </div>
                                            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-xl text-center border border-yellow-100/50 dark:border-yellow-900/30">
                                                <div className="text-lg font-black text-yellow-600 dark:text-yellow-400">{item.macros.fats}g</div>
                                                <div className="text-xs font-bold text-yellow-500/70 dark:text-yellow-400/70">Grasas</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Ingredientes */}
                                    {item.ingredients && item.ingredients.length > 0 && (
                                        <div className="mb-4">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Ingredientes</h4>
                                            <div className="space-y-1">
                                                {item.ingredients.map((ing, idx) => (
                                                    <div key={idx} className="flex justify-between text-sm">
                                                        <span className="text-slate-600 dark:text-slate-300">{ing.name}</span>
                                                        <span className="text-slate-400 font-medium">{ing.calories} kcal</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Confianza IA */}
                                    {item.confidence !== undefined && (
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${item.confidence >= 80 ? 'bg-emerald-400' : item.confidence >= 50 ? 'bg-orange-400' : 'bg-rose-400'
                                                }`}>
                                                {item.confidence}%
                                            </div>
                                            <span className="text-xs text-slate-400">Confianza del análisis</span>
                                        </div>
                                    )}

                                    {/* Acciones */}
                                    <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-[#5a2b35]/30">
                                        <button
                                            onClick={() => openEditModal(item)}
                                            className="flex-1 py-2.5 px-4 rounded-xl font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-sm">edit</span>
                                            Editar
                                        </button>
                                        <button
                                            onClick={() => openMoveModal(item)}
                                            className="flex-1 py-2.5 px-4 rounded-xl font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-sm">drive_file_move</span>
                                            Mover
                                        </button>
                                        <button
                                            onClick={() => removeFood(item.id)}
                                            className="flex-1 py-2.5 px-4 rounded-xl font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-sm">delete</span>
                                            Eliminar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Botón Flotante Registrar Comida ───────────────────────────── */}
            <div className="fixed bottom-28 sm:bottom-32 left-1/2 transform -translate-x-1/2 z-[60]">
                <button
                    onClick={handleOpenRegisterModal}
                    className="flex items-center gap-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-6 py-4 rounded-full shadow-lg shadow-emerald-500/30 transition-all hover:-translate-y-1 active:scale-95"
                >
                    <span className="material-symbols-outlined text-xl">add_circle</span>
                    <span className="font-bold text-base">Registrar Comida</span>
                </button>
            </div>

            {/* Input oculto para galería */}
            <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
            />

            {/* ── Modal de Registro (Foto o Texto) ───────────────────────────── */}
            {showRegisterModal && (
                <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a0d10] w-full max-w-sm rounded-3xl p-6 shadow-2xl">
                        <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 text-center mb-6">
                            ¿Cómo querés registrar tu comida?
                        </h3>

                        <button
                            onClick={handleSelectPhoto}
                            className="w-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 p-4 rounded-xl font-bold flex items-center gap-3 hover:bg-indigo-100 transition-colors mb-3"
                        >
                            <span className="material-symbols-outlined text-2xl">photo_camera</span>
                            <div className="text-left">
                                <div className="font-bold">Tomar o subir foto</div>
                                <div className="text-xs opacity-70">La IA analizará la imagen</div>
                            </div>
                        </button>

                        <button
                            onClick={handleSelectText}
                            className="w-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 p-4 rounded-xl font-bold flex items-center gap-3 hover:bg-emerald-100 transition-colors"
                        >
                            <span className="material-symbols-outlined text-2xl">text_fields</span>
                            <div className="text-left">
                                <div className="font-bold">Describir con texto</div>
                                <div className="text-xs opacity-70">Ej: "2 huevos fritos con pan"</div>
                            </div>
                        </button>

                        <button
                            onClick={() => setShowRegisterModal(false)}
                            className="w-full p-3 text-slate-400 font-bold hover:text-slate-600 dark:hover:text-slate-200 mt-4 transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* ── Modal de Texto (Describir comida) ──────────────────────────── */}
            {registerMethod === 'text' && (
                <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a0d10] w-full max-w-md rounded-3xl p-6 shadow-2xl">
                        <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-4">
                            Describí qué comiste
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            Sé lo más detallado posible. La IA calculará las calorías y nutrientes.
                        </p>

                        <textarea
                            className="w-full bg-slate-50 dark:bg-[#2d1820] border border-slate-200 dark:border-[#5a2b35]/40 rounded-2xl p-4 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-400 transition-colors resize-none"
                            rows={4}
                            placeholder='Ej: "Desayuné 2 huevos revueltos con una rebanada de pan integral, un vaso de jugo de naranja y un café con leche"'
                            value={foodDescription}
                            onChange={(e) => setFoodDescription(e.target.value)}
                        />

                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={() => { setRegisterMethod(null); setFoodDescription(''); }}
                                className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#2d1820] transition-colors"
                            >
                                Volver
                            </button>
                            <button
                                onClick={handleTextAnalysis}
                                disabled={!foodDescription.trim() || isAnalyzing}
                                className={`flex-1 py-3 px-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${!foodDescription.trim() || isAnalyzing
                                        ? 'bg-slate-300 dark:bg-[#3a2028] cursor-not-allowed'
                                        : 'bg-emerald-500 hover:bg-emerald-600'
                                    }`}
                            >
                                {isAnalyzing ? (
                                    <>
                                        <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                                        Analizando...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-sm">auto_awesome</span>
                                        Analizar
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal de Opciones de Cámara ───────────────────────────────── */}
            {showOptionsModal && (
                <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a0d10] w-full max-w-sm rounded-3xl p-6 shadow-2xl">
                        <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 text-center mb-2">Escanear Comida</h3>

                        <button
                            onClick={handleOpenCamera}
                            className="w-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 p-4 rounded-xl font-bold flex items-center gap-3 hover:bg-emerald-100 transition-colors mb-3"
                        >
                            <span className="material-symbols-outlined text-2xl">photo_camera</span>
                            Tomar Foto ahora
                        </button>

                        <button
                            onClick={handleOpenGallery}
                            className="w-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 p-4 rounded-xl font-bold flex items-center gap-3 hover:bg-indigo-100 transition-colors"
                        >
                            <span className="material-symbols-outlined text-2xl">imagesmode</span>
                            Subir desde Galería
                        </button>

                        <button
                            onClick={() => { setShowOptionsModal(false); setRegisterMethod(null); setShowRegisterModal(true); }}
                            className="w-full p-3 text-slate-400 font-bold hover:text-slate-600 dark:hover:text-slate-200 mt-4 transition-colors"
                        >
                            Volver
                        </button>
                    </div>
                </div>
            )}

            {/* ── Cámara en Vivo ─────────────────────────────────────────────── */}
            {showCamera && (
                <div className="fixed inset-0 z-[90] bg-black flex flex-col animate-in fade-in duration-200">
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
                            className="absolute top-6 left-6 w-12 h-12 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-md hover:bg-black/70 transition-colors"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    <div className="h-32 bg-black flex items-center justify-center pb-8 shrink-0">
                        <button
                            onClick={capturePhoto}
                            className="w-20 h-20 bg-white rounded-full border-4 border-slate-300 active:scale-95 transition-transform"
                            aria-label="Capturar foto"
                        />
                    </div>
                </div>
            )}

            {/* ── Modal de Error de Análisis ─────────────────────────────────── */}
            {analysisError && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a0d10] w-full max-w-sm rounded-3xl p-6 shadow-2xl">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-outlined text-rose-500 text-3xl">error</span>
                            </div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">Error en el Análisis</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">{analysisError}</p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setAnalysisError(null); setRegisterMethod(null); }}
                                    className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#2d1820] transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={retryAnalysis}
                                    className="flex-1 py-3 px-4 rounded-xl font-bold bg-indigo-500 hover:bg-indigo-600 text-white transition-colors"
                                >
                                    Reintentar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal de Carga "Analizando..." ─────────────────────────────── */}
            {isSaving && (
                <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a0d10] w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center">
                        <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="material-symbols-outlined text-emerald-500 text-4xl animate-spin">progress_activity</span>
                        </div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">
                            Analizando tu comida...
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                            La IA está calculando calorías y nutrientes
                        </p>
                        <div className="flex items-center justify-center gap-2 text-emerald-500">
                            <span className="material-symbols-outlined text-sm">auto_awesome</span>
                            <span className="text-xs font-bold">Procesando con Gemini AI</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal de Resultados del Escaneo/Texto ─────────────────────── */}
            {scannedResult && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a0d10] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Cabecera */}
                        <div className="p-6 pb-4 border-b border-slate-100 dark:border-[#5a2b35]/20 flex justify-between items-start">
                            <div className="min-w-0 flex-1">
                                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 leading-tight truncate">
                                    {scannedResult.name}
                                </h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{scannedResult.portion}</p>
                            </div>
                            <div className="text-right flex-shrink-0 ml-4">
                                <span className="text-2xl font-black text-emerald-500">{scannedResult.calories}</span>
                                <span className="text-xs text-slate-400 block font-bold uppercase tracking-wider">Kcal</span>
                            </div>
                        </div>

                        {/* Cuerpo scrolleable */}
                        <div className="p-6 overflow-y-auto">
                            {/* Confianza */}
                            <div className="flex items-center gap-3 mb-6 bg-slate-50 dark:bg-[#2d1820]/50 p-3 rounded-2xl border border-slate-100 dark:border-[#5a2b35]/20">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xs text-white flex-shrink-0 ${scannedResult.confidence >= 80 ? 'bg-emerald-400' : scannedResult.confidence >= 50 ? 'bg-orange-400' : 'bg-rose-400'
                                    }`}>
                                    {scannedResult.confidence}%
                                </div>
                                <div className="min-w-0">
                                    <div className="text-sm font-bold text-slate-700 dark:text-slate-200">Confianza de IA</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
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
                                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Ingredientes Detectados</h4>
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {scannedResult.ingredients.map((ing, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-white dark:bg-[#2d1820] p-3 rounded-xl border border-slate-100 dark:border-[#5a2b35]/30">
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{ing.name}</span>
                                                <span className="text-sm font-bold text-slate-400 flex-shrink-0 ml-2">{ing.calories} kcal</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer con acciones */}
                        <div className="p-4 bg-slate-50 dark:bg-[#2d1820]/30 border-t border-slate-100 dark:border-[#5a2b35]/20">
                            {/* Botón Corregir con IA */}
                            <button
                                onClick={openCorrectionModal}
                                className="w-full mb-3 py-2.5 px-4 rounded-xl font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-sm">edit_note</span>
                                Corregir con IA
                            </button>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setScannedResult(null); setFoodDescription(''); setRegisterMethod(null); }}
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
                </div>
            )}

            {/* ── Modal de Corrección con IA ─────────────────────────────────── */}
            {showCorrectionModal && (
                <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a0d10] w-full max-w-md rounded-3xl p-6 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-indigo-500 text-xl">edit_note</span>
                            </div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                                Corregir con IA
                            </h3>
                        </div>

                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            Contale a la IA qué necesita corregir. Por ejemplo:
                        </p>

                        <div className="bg-slate-50 dark:bg-[#2d1820]/50 rounded-xl p-3 mb-4">
                            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                                <li>• "Es pan integral, no blanco"</li>
                                <li>• "La porción es más pequeña, es para una persona"</li>
                                <li>• "No tiene queso, es sin lácteos"</li>
                                <li>• "Es pollo a la plancha, no frito"</li>
                            </ul>
                        </div>

                        <textarea
                            className="w-full bg-slate-50 dark:bg-[#2d1820] border border-slate-200 dark:border-[#5a2b35]/40 rounded-2xl p-4 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-400 transition-colors resize-none"
                            rows={4}
                            placeholder="Ej: El arroz es integral, no blanco. Y la porción de pollo es más pequeña..."
                            value={correctionText}
                            onChange={(e) => setCorrectionText(e.target.value)}
                        />

                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={() => { setShowCorrectionModal(false); setCorrectionText(''); }}
                                className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#2d1820] transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCorrection}
                                disabled={!correctionText.trim() || isCorrecting}
                                className={`flex-1 py-3 px-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${!correctionText.trim() || isCorrecting
                                        ? 'bg-slate-300 dark:bg-[#3a2028] cursor-not-allowed'
                                        : 'bg-indigo-500 hover:bg-indigo-600'
                                    }`}
                            >
                                {isCorrecting ? (
                                    <>
                                        <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                                        Corrigiendo...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-sm">auto_awesome</span>
                                        Corregir
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal de Edición ───────────────────────────────────────────── */}
            {editingItem && (
                <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a0d10] w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-3xl p-6 shadow-2xl">
                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-4 text-center">Editar {editingItem.item.name}</h3>

                        <div className="space-y-3 mb-6">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Nombre</label>
                                <input
                                    className="w-full rounded-xl border border-slate-200 dark:border-[#5a2b35]/40 dark:bg-[#2d1820] dark:text-slate-200 px-3 py-2.5 focus:outline-none focus:border-emerald-400 transition-colors"
                                    value={editForm.name}
                                    onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Calorías (kcal)</label>
                                <input
                                    className="w-full rounded-xl border border-slate-200 dark:border-[#5a2b35]/40 dark:bg-[#2d1820] dark:text-slate-200 px-3 py-2.5 focus:outline-none focus:border-emerald-400 transition-colors"
                                    type="number"
                                    min="1"
                                    value={editForm.calories}
                                    onChange={e => setEditForm(prev => ({ ...prev, calories: e.target.value }))}
                                />
                            </div>

                            {/* Macros en edición */}
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Prot (g)</label>
                                    <input
                                        className="w-full rounded-xl border border-slate-200 dark:border-[#5a2b35]/40 dark:bg-[#2d1820] dark:text-slate-200 px-3 py-2 focus:outline-none focus:border-blue-400 transition-colors"
                                        type="number"
                                        min="0"
                                        value={editForm.protein}
                                        onChange={e => setEditForm(prev => ({ ...prev, protein: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Carb (g)</label>
                                    <input
                                        className="w-full rounded-xl border border-slate-200 dark:border-[#5a2b35]/40 dark:bg-[#2d1820] dark:text-slate-200 px-3 py-2 focus:outline-none focus:border-orange-400 transition-colors"
                                        type="number"
                                        min="0"
                                        value={editForm.carbs}
                                        onChange={e => setEditForm(prev => ({ ...prev, carbs: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Grasa (g)</label>
                                    <input
                                        className="w-full rounded-xl border border-slate-200 dark:border-[#5a2b35]/40 dark:bg-[#2d1820] dark:text-slate-200 px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors"
                                        type="number"
                                        min="0"
                                        value={editForm.fats}
                                        onChange={e => setEditForm(prev => ({ ...prev, fats: e.target.value }))}
                                    />
                                </div>
                            </div>

                            {/* Ingredientes editables */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ingredientes</label>
                                    <button
                                        onClick={addIngredient}
                                        type="button"
                                        className="text-xs font-bold text-emerald-500 hover:text-emerald-600 flex items-center gap-1"
                                    >
                                        <span className="material-symbols-outlined text-sm">add_circle</span>
                                        Añadir
                                    </button>
                                </div>

                                {editForm.ingredients.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic py-2">Sin ingredientes. Añadí alguno si querés detallar.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {editForm.ingredients.map((ing, idx) => (
                                            <div key={idx} className="flex gap-1.5 items-center">
                                                <input
                                                    className="flex-1 min-w-0 rounded-xl border border-slate-200 dark:border-[#5a2b35]/40 dark:bg-[#2d1820] dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400 transition-colors"
                                                    type="text"
                                                    placeholder="Nombre"
                                                    value={ing.name}
                                                    onChange={e => updateIngredient(idx, 'name', e.target.value)}
                                                />
                                                <input
                                                    className="w-20 rounded-xl border border-slate-200 dark:border-[#5a2b35]/40 dark:bg-[#2d1820] dark:text-slate-200 px-2 py-2 text-sm focus:outline-none focus:border-emerald-400 transition-colors"
                                                    type="number"
                                                    min="0"
                                                    placeholder="kcal"
                                                    value={ing.calories}
                                                    onChange={e => updateIngredient(idx, 'calories', e.target.value)}
                                                />
                                                <button
                                                    onClick={() => removeIngredient(idx)}
                                                    type="button"
                                                    className="w-8 h-8 flex-shrink-0 rounded-full text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center justify-center"
                                                    aria-label="Eliminar ingrediente"
                                                >
                                                    <span className="material-symbols-outlined text-base">close</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Aviso de coherencia */}
                                {ingredientsMismatch && (
                                    <div className="mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl px-3 py-2">
                                        <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium leading-snug">
                                            ⚠️ Los ingredientes suman <b>{ingredientsSum} kcal</b> pero el total es <b>{editedTotal} kcal</b>. Ajustalos para que cuadren.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setEditingItem(null)}
                                className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#2d1820] transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={saveEdit}
                                className="flex-1 py-3 px-4 rounded-xl font-bold bg-indigo-500 hover:bg-indigo-600 text-white transition-colors"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal para Mover Comida ───────────────────────────────────── */}
            {showMoveModal && movingItem && (
                <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a0d10] w-full max-w-sm rounded-3xl p-6 shadow-2xl">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-outlined text-amber-500 text-3xl">drive_file_move</span>
                            </div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-1">
                                Mover "{movingItem.item.name}"
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                ¿A qué día querés mover esta comida?
                            </p>
                        </div>

                        <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
                            {/* Últimos 7 días */}
                            {getLast7Days().map((date) => {
                                if (date === selectedDate) return null; // No mostrar el día actual
                                const isToday = date === todayStr();
                                const isYesterday = date === formatDate(new Date(Date.now() - 86400000));

                                return (
                                    <button
                                        key={date}
                                        onClick={() => moveItemToDate(date)}
                                        className="w-full py-4 px-4 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-[#2d1820] hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-400 border-2 border-transparent transition-all flex items-center justify-between"
                                    >
                                        <span className="flex items-center gap-3">
                                            <span className={`material-symbols-outlined ${isToday ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                {isToday ? 'today' : 'calendar_today'}
                                            </span>
                                            {isToday ? 'Hoy' : isYesterday ? 'Ayer' : getFriendlyDateName(date)}
                                        </span>
                                        <span className="text-xs text-slate-400">
                                            {date}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => { setShowMoveModal(false); setMovingItem(null); }}
                            className="w-full py-3 px-4 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#2d1820] transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
