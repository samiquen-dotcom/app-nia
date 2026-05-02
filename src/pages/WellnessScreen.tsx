import React, { useState, useEffect, useMemo } from 'react';
import { useFeatureData } from '../hooks/useFeatureData';
import type { WellnessData, MoodData, CustomMood, CustomHabit, TimerSession, PeriodData, MoodEntry } from '../types';
import { todayStr, toLocalDateStr } from '../utils/dateHelpers';
import { calculatePhase } from '../utils/cycleLogic';

// ─── Constants ────────────────────────────────────────────────────────────────
const WATER_GOAL = 8;

// Hábitos seed: si no existen customHabits aún, se inicializa con estos.
const DEFAULT_HABITS: CustomHabit[] = [
    { id: 'read',      emoji: '📖', label: 'Leer 10 páginas', isDefault: true },
    { id: 'skincare',  emoji: '💆‍♀️', label: 'Skincare',       isDefault: true },
    { id: 'meditate',  emoji: '🧘‍♀️', label: 'Meditar',        isDefault: true },
    { id: 'gratitude', emoji: '🙏', label: 'Agradecer',       isDefault: true },
];

const DEFAULT_MOODS: CustomMood[] = [
    { id: 'calm',  emoji: '🌸', label: 'Calm' },
    { id: 'fresh', emoji: '🌿', label: 'Fresh' },
    { id: 'tired', emoji: '🌙', label: 'Tired' },
    { id: 'sad',   emoji: '🌧', label: 'Sad' },
    { id: 'hype',  emoji: '🔥', label: 'Hype' },
];

const DEFAULT_MOOD_IDS = new Set(DEFAULT_MOODS.map(m => m.id));

// Chips de duración del timer (en segundos)
const TIMER_DURATIONS: { label: string; seconds: number }[] = [
    { label: '3m', seconds: 180 },
    { label: '5m', seconds: 300 },
    { label: '10m', seconds: 600 },
    { label: '15m', seconds: 900 },
    { label: '25m', seconds: 1500 },
];

// Patrón 4-7-8 para respiración guiada
type BreathPhase = 'inhale' | 'hold' | 'exhale';
const BREATH_PATTERN: { phase: BreathPhase; seconds: number; label: string }[] = [
    { phase: 'inhale', seconds: 4, label: 'Inhala' },
    { phase: 'hold',   seconds: 7, label: 'Mantén' },
    { phase: 'exhale', seconds: 8, label: 'Exhala' },
];

const sendNotif = (body: string) => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('App Nia 🌸', { body, icon: '/favicon.ico' });
    }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Verifica si un hábito está marcado en un día. Acepta IDs (formato nuevo) y labels (formato viejo) por compatibilidad. */
const isHabitDoneOn = (day: { habits?: string[] } | undefined, habit: CustomHabit): boolean => {
    if (!day?.habits) return false;
    return day.habits.includes(habit.id) || day.habits.includes(habit.label);
};

/** Calcula la racha de días consecutivos completando un hábito (incluyendo o no hoy). */
const computeStreak = (days: WellnessData['days'], habit: CustomHabit, today: string): number => {
    const byDate = new Map(days.map(d => [d.date, d]));
    let streak = 0;
    const cursor = new Date(today + 'T00:00:00');
    // Si hoy NO está marcado, empezamos a contar desde ayer (la racha sigue viva hasta el final del día)
    if (!isHabitDoneOn(byDate.get(today), habit)) {
        cursor.setDate(cursor.getDate() - 1);
    }
    for (let i = 0; i < 365; i++) {
        const dStr = toLocalDateStr(cursor);
        if (isHabitDoneOn(byDate.get(dStr), habit)) {
            streak++;
            cursor.setDate(cursor.getDate() - 1);
        } else {
            break;
        }
    }
    return streak;
};

/** Devuelve los últimos N días en formato YYYY-MM-DD (más antiguo primero). */
const lastNDays = (n: number, ref: Date = new Date()): string[] => {
    return Array.from({ length: n }, (_, i) => {
        const d = new Date(ref);
        d.setDate(ref.getDate() - (n - 1 - i));
        return toLocalDateStr(d);
    });
};

/** Tip dinámico según la fase del ciclo. Devuelve null si no hay fase. */
const getCyclePhaseTip = (phaseName: string | null): { headline: string; emoji: string } | null => {
    if (!phaseName) return null;
    switch (phaseName) {
        case 'Menstrual':
            return { headline: 'Hoy prioriza descanso e hidratación. Tu cuerpo está trabajando duro.', emoji: '🩸' };
        case 'Folicular':
            return { headline: 'Energía subiendo: buen momento para crear nuevos hábitos y meditar.', emoji: '🌱' };
        case 'Ovulación':
            return { headline: 'Día perfecto para meditación de gratitud y conectar con otras personas.', emoji: '✨' };
        case 'Lútea':
            return { headline: 'Intenta dormir 30 min más esta semana. Bajar el ritmo es parte del proceso.', emoji: '🍂' };
        default:
            return null;
    }
};

// ─── Component ────────────────────────────────────────────────────────────────

export const WellnessScreen: React.FC = () => {
    const { data, save } = useFeatureData<WellnessData>('wellness', {
        days: [],
        customHabits: DEFAULT_HABITS,
        timerSessions: [],
    });
    const { data: moodData, save: saveMood } = useFeatureData<MoodData>('mood', {
        entries: [],
        customMoods: DEFAULT_MOODS,
    });
    const { data: periodData } = useFeatureData<PeriodData>('period', {
        cycleStartDate: '',
        cycleLength: 28,
        periodLength: 5,
        symptomsLog: {},
        dailyEntries: {},
    });

    // Migración: si customHabits llega vacío/undefined, sembrar defaults
    useEffect(() => {
        if (!data.customHabits || data.customHabits.length === 0) {
            save({ customHabits: DEFAULT_HABITS });
        }
    }, [data.customHabits]);

    const today = todayStr();
    const todayData = data.days.find(d => d.date === today) ?? { date: today, glasses: 0, habits: [] as string[], sleepHours: undefined, moodId: undefined };
    const customHabits = data.customHabits ?? DEFAULT_HABITS;
    const visibleHabits = customHabits.filter(h => !h.archived);

    // Mood del día (fuente de verdad: MoodData.entries)
    const todayMoodEntry = moodData.entries.find(e => e.date === today);

    // Fase del ciclo (para tip)
    const phase = periodData.cycleStartDate
        ? calculatePhase(periodData.cycleStartDate, periodData.cycleLength || 28, periodData.periodLength || 5)
        : null;
    const cycleTip = getCyclePhaseTip(phase?.name ?? null);

    // ─── Modal states ─────────────────────────────────────────────────────────
    const [isCreatingMood, setIsCreatingMood] = useState(false);
    const [newMoodEmoji, setNewMoodEmoji] = useState('✨');
    const [newMoodLabel, setNewMoodLabel] = useState('');

    const [isEditingHabits, setIsEditingHabits] = useState(false);
    const [habitDraftEmoji, setHabitDraftEmoji] = useState('✨');
    const [habitDraftLabel, setHabitDraftLabel] = useState('');

    // ─── Timer state ─────────────────────────────────────────────────────────
    const [timerActive, setTimerActive] = useState(false);
    const [mode, setMode] = useState<'breathing' | 'pomodoro'>('breathing');
    const [timerDurationSec, setTimerDurationSec] = useState(300); // 5 min default
    const [timeLeft, setTimeLeft] = useState(300);
    // Para respiración guiada: índice del paso actual y segundos restantes en el paso
    const [breathStepIdx, setBreathStepIdx] = useState(0);
    const [breathStepLeft, setBreathStepLeft] = useState(BREATH_PATTERN[0].seconds);

    const [notifGranted, setNotifGranted] = useState(typeof Notification !== 'undefined' && Notification.permission === 'granted');

    // ─── Timer tick ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!timerActive) return;
        if (timeLeft === 0) {
            // Sesión completada → persistir
            const session: TimerSession = {
                date: today,
                type: mode,
                durationSec: timerDurationSec,
                completed: true,
                timestamp: Date.now(),
            };
            const recent = (data.timerSessions ?? []).slice(0, 59);
            save({ timerSessions: [session, ...recent] });
            sendNotif(mode === 'breathing' ? '¡Sesión de respiración completada! 🌿' : '¡Pomodoro completado! Toma un descanso. ☕');
            setTimerActive(false);
            return;
        }
        const id = setInterval(() => {
            setTimeLeft(t => t - 1);
            if (mode === 'breathing') {
                setBreathStepLeft(prev => {
                    if (prev <= 1) {
                        // Avanza al siguiente paso del patrón 4-7-8
                        setBreathStepIdx(i => {
                            const next = (i + 1) % BREATH_PATTERN.length;
                            return next;
                        });
                        return BREATH_PATTERN[(breathStepIdx + 1) % BREATH_PATTERN.length].seconds;
                    }
                    return prev - 1;
                });
            }
        }, 1000);
        return () => clearInterval(id);
    }, [timerActive, timeLeft, mode, breathStepIdx]);

    const setTimerMode = (m: 'breathing' | 'pomodoro') => {
        setMode(m);
        setTimerActive(false);
        const defaultDuration = m === 'breathing' ? 300 : 1500;
        setTimerDurationSec(defaultDuration);
        setTimeLeft(defaultDuration);
        setBreathStepIdx(0);
        setBreathStepLeft(BREATH_PATTERN[0].seconds);
    };

    const setDuration = (seconds: number) => {
        setTimerActive(false);
        setTimerDurationSec(seconds);
        setTimeLeft(seconds);
        setBreathStepIdx(0);
        setBreathStepLeft(BREATH_PATTERN[0].seconds);
    };

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    // ─── Persistence helpers ──────────────────────────────────────────────────
    const updateToday = (updates: Partial<typeof todayData>) => {
        const updated = { ...todayData, ...updates };
        const otherDays = data.days.filter(d => d.date !== today);
        return save({ days: [updated, ...otherDays] });
    };

    const setGlasses = (n: number) => updateToday({ glasses: n });
    const setSleepHours = (h: number) => updateToday({ sleepHours: h });

    /** Toggle de hábito por ID. Limpia entradas legacy con label. */
    const toggleHabit = (habit: CustomHabit) => {
        const wasDone = isHabitDoneOn(todayData, habit);
        // Quitar tanto el ID nuevo como el label viejo (si existe), luego agregar el ID si toca
        const cleaned = todayData.habits.filter(h => h !== habit.id && h !== habit.label);
        const habits = wasDone ? cleaned : [...cleaned, habit.id];
        updateToday({ habits });
        if (!wasDone) sendNotif(`¡Hábito completado: ${habit.label}! 🎉`);
    };

    // ─── Habits CRUD ──────────────────────────────────────────────────────────
    const addHabit = () => {
        if (!habitDraftLabel.trim()) return;
        const newHabit: CustomHabit = {
            id: `h_${Date.now()}`,
            emoji: habitDraftEmoji || '✨',
            label: habitDraftLabel.trim(),
        };
        save({ customHabits: [...customHabits, newHabit] });
        setHabitDraftLabel('');
        setHabitDraftEmoji('✨');
    };

    const deleteHabit = (habit: CustomHabit) => {
        // Defaults se archivan (recuperables); custom se borran de verdad
        if (habit.isDefault) {
            save({ customHabits: customHabits.map(h => h.id === habit.id ? { ...h, archived: true } : h) });
        } else {
            save({ customHabits: customHabits.filter(h => h.id !== habit.id) });
        }
    };

    const restoreDefaultHabits = () => {
        // Vuelve a activar los defaults archivados; agrega los que falten
        const existingIds = new Set(customHabits.map(h => h.id));
        const merged = [
            ...customHabits.map(h => h.isDefault ? { ...h, archived: false } : h),
            ...DEFAULT_HABITS.filter(d => !existingIds.has(d.id)),
        ];
        save({ customHabits: merged });
    };

    // ─── Moods CRUD ───────────────────────────────────────────────────────────
    const handleAddMood = () => {
        if (!newMoodLabel.trim()) return;
        const newMood: CustomMood = {
            id: `m_${Date.now()}`,
            emoji: newMoodEmoji || '✨',
            label: newMoodLabel.trim(),
        };
        saveMood({ customMoods: [...moodData.customMoods, newMood] });
        setIsCreatingMood(false);
        setNewMoodLabel('');
        setNewMoodEmoji('✨');
    };

    const handleDeleteMood = (id: string) => {
        // Bloquea borrar defaults para no perder los originales
        if (DEFAULT_MOOD_IDS.has(id)) return;
        saveMood({ customMoods: moodData.customMoods.filter(m => m.id !== id) });
    };

    const restoreDefaultMoods = () => {
        const existingIds = new Set(moodData.customMoods.map(m => m.id));
        const missing = DEFAULT_MOODS.filter(d => !existingIds.has(d.id));
        if (missing.length === 0) return;
        saveMood({ customMoods: [...moodData.customMoods, ...missing] });
    };

    /** Registra el mood del día. Si ya hay uno, lo reemplaza. */
    const registerMood = (mood: CustomMood) => {
        const entry: MoodEntry = {
            date: today,
            mood: mood.label,
            emoji: mood.emoji,
            timestamp: Date.now(),
        };
        const others = moodData.entries.filter(e => e.date !== today);
        saveMood({ entries: [entry, ...others] });
        // Compat: también actualizamos moodId en WellnessDay
        updateToday({ moodId: mood.id });
    };

    const clearTodayMood = () => {
        const others = moodData.entries.filter(e => e.date !== today);
        saveMood({ entries: others });
        updateToday({ moodId: undefined });
    };

    // ─── Notifications ────────────────────────────────────────────────────────
    const requestNotif = async () => {
        const perm = await Notification.requestPermission();
        setNotifGranted(perm === 'granted');
        if (perm === 'granted') sendNotif('¡Notificaciones activadas! Te avisaré cuando completes hábitos o termines sesiones 🌸');
    };

    // ─── Derived: 7-day trend & timer summary ─────────────────────────────────
    const last7 = useMemo(() => lastNDays(7), []);

    const last7Wellness = useMemo(() => {
        return last7.map(date => data.days.find(d => d.date === date) ?? { date, glasses: 0, habits: [], sleepHours: undefined, moodId: undefined });
    }, [last7, data.days]);

    const last7Moods = useMemo(() => {
        return last7.map(date => moodData.entries.find(e => e.date === date) ?? null);
    }, [last7, moodData.entries]);

    const weekTimerStats = useMemo(() => {
        const sessions = data.timerSessions ?? [];
        const weekSet = new Set(last7);
        const filtered = sessions.filter(s => s.completed && weekSet.has(s.date));
        const breathingMin = Math.round(filtered.filter(s => s.type === 'breathing').reduce((acc, s) => acc + s.durationSec, 0) / 60);
        const pomodoroMin = Math.round(filtered.filter(s => s.type === 'pomodoro').reduce((acc, s) => acc + s.durationSec, 0) / 60);
        return { breathingMin, pomodoroMin, total: filtered.length };
    }, [data.timerSessions, last7]);

    // Animación de respiración: scale del círculo según fase 4-7-8
    const currentBreathStep = BREATH_PATTERN[breathStepIdx];
    const breathScale = mode === 'breathing' && timerActive
        ? currentBreathStep.phase === 'inhale' ? 1.25 : currentBreathStep.phase === 'hold' ? 1.25 : 0.85
        : 1;

    return (
        <div className="p-6 pt-12 pb-24">
            {/* ── Header ───────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Tu bienestar, Nia 🌷</h1>
                <button
                    onClick={requestNotif}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors
                        ${notifGranted
                            ? 'bg-green-100 text-green-600'
                            : 'bg-slate-100 dark:bg-[#2d1820] text-slate-500 dark:text-slate-300 hover:bg-primary/20'}`}
                >
                    <span className="material-symbols-outlined text-sm">notifications</span>
                    {notifGranted ? 'Activas ✓' : 'Activar avisos'}
                </button>
            </div>

            {/* ── Cycle Phase Tip ─────────────────────────────────────────────── */}
            {cycleTip && (
                <div className="bg-gradient-to-r from-pink-50 to-purple-50 dark:from-[#3a2028] dark:to-[#2a2035] rounded-2xl p-3 mb-6 flex items-start gap-3 border border-pink-100 dark:border-purple-900/40">
                    <div className="text-2xl flex-shrink-0">{cycleTip.emoji}</div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase font-black text-purple-400 tracking-wider mb-0.5">Fase {phase?.name ?? ''} · tip de hoy</p>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-snug">{cycleTip.headline}</p>
                    </div>
                </div>
            )}

            {/* ── Mood del día ─────────────────────────────────────────────────── */}
            <div className="bg-white dark:bg-[#2d1820] rounded-2xl p-4 shadow-sm border border-indigo-50 dark:border-[#5a2b35]/30 mb-6">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200">¿Cómo te sientes hoy?</h3>
                    {todayMoodEntry && (
                        <button onClick={clearTodayMood} className="text-[10px] font-bold text-slate-400 hover:text-rose-400 transition-colors">
                            Limpiar
                        </button>
                    )}
                </div>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                    {moodData.customMoods.map(mood => {
                        const selected = todayMoodEntry?.mood === mood.label;
                        return (
                            <button
                                key={mood.id}
                                onClick={() => registerMood(mood)}
                                className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] h-[72px] rounded-xl transition-all active:scale-95 flex-shrink-0
                                    ${selected ? 'bg-indigo-100 dark:bg-indigo-900/40 ring-2 ring-indigo-400 shadow-sm' : 'bg-slate-50 dark:bg-black/20 hover:bg-indigo-50'}`}
                            >
                                <span className={`text-2xl transition-transform ${selected ? 'scale-110' : ''}`}>{mood.emoji}</span>
                                <span className={`text-[10px] font-bold ${selected ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {mood.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
                {todayMoodEntry && (
                    <p className="text-[11px] text-indigo-400 font-medium mt-2 text-center">
                        Hoy te sientes {todayMoodEntry.emoji} <span className="font-bold">{todayMoodEntry.mood}</span>
                    </p>
                )}
            </div>

            {/* ── Water Tracker ─────────────────────────────────────────────────── */}
            <div className="bg-white dark:bg-[#2d1820] rounded-2xl p-4 shadow-sm border border-blue-50 dark:border-[#5a2b35]/30 mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200">Hidratación</h3>
                    <span className="text-xs font-bold text-blue-400">{todayData.glasses}/{WATER_GOAL} vasos</span>
                </div>
                <div className="flex justify-between gap-1">
                    {Array.from({ length: WATER_GOAL }).map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setGlasses(todayData.glasses === i + 1 ? i : i + 1)}
                            className={`flex-1 h-10 rounded-b-xl rounded-t-sm transition-all ${i < todayData.glasses ? 'bg-blue-400 shadow-sm' : 'bg-blue-50 dark:bg-[#0a1a2a] translate-y-1'}`}
                        />
                    ))}
                </div>
                {todayData.glasses >= WATER_GOAL && (
                    <p className="text-xs text-blue-400 font-bold text-center mt-3">¡Meta de agua alcanzada! 💧</p>
                )}
            </div>

            {/* ── Sleep Tracker ─────────────────────────────────────────────────── */}
            <div className="bg-white dark:bg-[#2d1820] rounded-2xl p-4 shadow-sm border border-violet-50 dark:border-[#5a2b35]/30 mb-6">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200">Sueño anoche</h3>
                    {todayData.sleepHours !== undefined && (
                        <span className={`text-xs font-bold ${todayData.sleepHours >= 7 ? 'text-emerald-500' : todayData.sleepHours >= 6 ? 'text-amber-500' : 'text-rose-500'}`}>
                            {todayData.sleepHours}h
                        </span>
                    )}
                </div>
                <div className="grid grid-cols-6 gap-2">
                    {[5, 6, 7, 8, 9, 10].map(h => {
                        const selected = todayData.sleepHours === h;
                        // Clases estáticas (Tailwind no purga las que vea como literales)
                        const selectedClass = h >= 7
                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 ring-2 ring-emerald-300'
                            : h >= 6
                                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300 ring-2 ring-amber-300'
                                : 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300 ring-2 ring-rose-300';
                        return (
                            <button
                                key={h}
                                onClick={() => setSleepHours(selected ? -1 : h)}
                                className={`py-2 rounded-xl font-bold text-xs transition-all
                                    ${selected ? selectedClass : 'bg-slate-50 dark:bg-black/20 text-slate-500 dark:text-slate-400 hover:bg-violet-50'}`}
                            >
                                {h}h
                            </button>
                        );
                    })}
                </div>
                {todayData.sleepHours !== undefined && todayData.sleepHours >= 0 && (
                    <p className="text-[11px] text-violet-400 font-medium mt-2 text-center">
                        {todayData.sleepHours >= 8 ? '¡Excelente descanso! 🌙' : todayData.sleepHours >= 7 ? 'Buen sueño 💜' : todayData.sleepHours >= 6 ? 'Dormiste poco, intenta acostarte antes' : 'Pocas horas de sueño. Cuídate hoy 🛌'}
                    </p>
                )}
            </div>

            {/* ── Habits con racha + edición ───────────────────────────────────── */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200">
                        Hábitos de hoy
                        <span className="text-xs text-slate-400 font-normal ml-2">{todayData.habits.length}/{visibleHabits.length} completados</span>
                    </h3>
                    <button
                        onClick={() => setIsEditingHabits(true)}
                        className="text-xs font-bold text-indigo-500 flex items-center gap-1 hover:underline"
                    >
                        <span className="material-symbols-outlined text-sm">edit</span>
                        Editar
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {visibleHabits.map(h => {
                        const done = isHabitDoneOn(todayData, h);
                        const streak = computeStreak(data.days, h, today);
                        return (
                            <button
                                key={h.id}
                                onClick={() => toggleHabit(h)}
                                className={`p-3 rounded-xl flex items-center gap-2 transition-colors text-left relative
                                    ${done
                                        ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                                        : 'bg-white dark:bg-[#2d1820] border border-slate-100 dark:border-[#5a2b35]/30 text-slate-500 dark:text-slate-300'}`}
                            >
                                <span className="text-xl flex-shrink-0">{h.emoji}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{h.label}</p>
                                    {streak > 0 && (
                                        <p className={`text-[10px] font-bold ${done ? 'text-purple-500' : 'text-amber-500'}`}>
                                            🔥 {streak} {streak === 1 ? 'día' : 'días'}
                                        </p>
                                    )}
                                </div>
                                <div className={`w-5 h-5 rounded flex items-center justify-center border flex-shrink-0
                                    ${done ? 'border-purple-500 bg-purple-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}
                                >
                                    {done && <span className="material-symbols-outlined text-xs">check</span>}
                                </div>
                            </button>
                        );
                    })}
                </div>
                {visibleHabits.length === 0 && (
                    <p className="text-center text-sm text-slate-400 py-4">No hay hábitos. Toca <span className="font-bold text-indigo-500">Editar</span> para agregar uno.</p>
                )}
            </div>

            {/* ── Timer (Respiración 4-7-8 + Pomodoro) ─────────────────────────── */}
            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-[#0d2b2b] dark:to-[#0a2233] rounded-3xl p-6 mb-6 text-center border border-teal-100 dark:border-teal-900/40">
                {/* Mode tabs */}
                <div className="flex justify-center gap-2 mb-4">
                    <button
                        onClick={() => setTimerMode('breathing')}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${mode === 'breathing' ? 'bg-teal-500 text-white shadow-md' : 'text-teal-400 bg-white/50 dark:bg-white/10'}`}
                    >
                        Respiración 4-7-8
                    </button>
                    <button
                        onClick={() => setTimerMode('pomodoro')}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${mode === 'pomodoro' ? 'bg-cyan-500 text-white shadow-md' : 'text-cyan-400 bg-white/50 dark:bg-white/10'}`}
                    >
                        Pomodoro
                    </button>
                </div>

                {/* Duration chips */}
                <div className="flex justify-center gap-1.5 mb-4 flex-wrap">
                    {TIMER_DURATIONS.map(d => (
                        <button
                            key={d.seconds}
                            onClick={() => setDuration(d.seconds)}
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-colors
                                ${timerDurationSec === d.seconds ? 'bg-teal-600 text-white' : 'bg-white/60 dark:bg-white/5 text-teal-500'}`}
                        >
                            {d.label}
                        </button>
                    ))}
                </div>

                {/* Breathing animated circle / Pomodoro static circle */}
                <div className="relative w-48 h-48 mx-auto flex items-center justify-center mb-4">
                    <div
                        className={`absolute inset-0 rounded-full border-4 transition-transform ease-in-out
                            ${mode === 'breathing'
                                ? currentBreathStep.phase === 'inhale' ? 'border-emerald-300 dark:border-emerald-600' : currentBreathStep.phase === 'hold' ? 'border-amber-300 dark:border-amber-600' : 'border-sky-300 dark:border-sky-600'
                                : 'border-teal-200/50 dark:border-teal-700/40'}`}
                        style={{
                            transform: `scale(${breathScale})`,
                            transitionDuration: timerActive && mode === 'breathing' ? `${currentBreathStep.seconds}s` : '0.3s',
                        }}
                    ></div>
                    <div className="text-center">
                        <div className="text-5xl font-extrabold text-teal-600 dark:text-teal-300 font-mono tracking-wider">
                            {formatTime(timeLeft)}
                        </div>
                        {mode === 'breathing' && timerActive && (
                            <p className="text-xs font-bold text-teal-500 mt-1">{currentBreathStep.label} · {breathStepLeft}s</p>
                        )}
                    </div>
                </div>

                {/* Controls */}
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={() => setTimerActive(a => !a)}
                        className="bg-white dark:bg-teal-900/60 text-teal-600 dark:text-teal-300 w-16 h-16 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
                    >
                        <span className="material-symbols-outlined text-3xl">{timerActive ? 'pause' : 'play_arrow'}</span>
                    </button>
                    <button
                        onClick={() => { setTimerActive(false); setTimeLeft(timerDurationSec); setBreathStepIdx(0); setBreathStepLeft(BREATH_PATTERN[0].seconds); }}
                        className="bg-white/80 dark:bg-teal-900/40 text-slate-400 w-12 h-12 rounded-full flex items-center justify-center self-center hover:scale-110 transition-transform"
                    >
                        <span className="material-symbols-outlined text-xl">replay</span>
                    </button>
                </div>

                <p className="text-teal-400 text-sm mt-4 font-medium">
                    {!timerActive
                        ? 'Lista para empezar'
                        : mode === 'breathing'
                            ? 'Respira siguiendo el círculo'
                            : '¡Enfócate, Nia!'}
                </p>

                {/* Weekly summary */}
                {(weekTimerStats.breathingMin > 0 || weekTimerStats.pomodoroMin > 0) && (
                    <div className="mt-4 pt-3 border-t border-teal-200/40 dark:border-teal-800/40 flex justify-around text-[10px]">
                        <div>
                            <p className="text-slate-400 font-medium">Respiración (7d)</p>
                            <p className="text-teal-600 dark:text-teal-300 font-bold text-sm">{weekTimerStats.breathingMin} min</p>
                        </div>
                        <div>
                            <p className="text-slate-400 font-medium">Pomodoro (7d)</p>
                            <p className="text-cyan-600 dark:text-cyan-300 font-bold text-sm">{weekTimerStats.pomodoroMin} min</p>
                        </div>
                        <div>
                            <p className="text-slate-400 font-medium">Sesiones</p>
                            <p className="text-slate-600 dark:text-slate-300 font-bold text-sm">{weekTimerStats.total}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* ── 7-Day Trends ─────────────────────────────────────────────────── */}
            <div className="bg-white dark:bg-[#2d1820] rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-[#5a2b35]/30 mb-6">
                <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3">Últimos 7 días</h3>

                {/* Water bars */}
                <div className="mb-4">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>💧 Agua</span>
                        <span>Meta {WATER_GOAL}</span>
                    </div>
                    <div className="flex justify-between gap-1 h-12">
                        {last7Wellness.map(d => {
                            const pct = Math.min((d.glasses / WATER_GOAL) * 100, 100);
                            return (
                                <div key={d.date} className="flex-1 bg-blue-50 dark:bg-black/20 rounded-md relative overflow-hidden">
                                    <div
                                        className="absolute bottom-0 left-0 right-0 bg-blue-400 transition-all"
                                        style={{ height: `${pct}%` }}
                                    ></div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Sleep bars */}
                <div className="mb-4">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>🌙 Sueño</span>
                        <span>Meta 8h</span>
                    </div>
                    <div className="flex justify-between gap-1 h-12">
                        {last7Wellness.map(d => {
                            const h = d.sleepHours ?? 0;
                            const pct = Math.min((h / 10) * 100, 100);
                            const tone = h >= 7 ? 'bg-emerald-400' : h >= 6 ? 'bg-amber-400' : h > 0 ? 'bg-rose-400' : 'bg-transparent';
                            return (
                                <div key={d.date} className="flex-1 bg-violet-50 dark:bg-black/20 rounded-md relative overflow-hidden">
                                    <div
                                        className={`absolute bottom-0 left-0 right-0 ${tone} transition-all`}
                                        style={{ height: `${pct}%` }}
                                    ></div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Mood emojis row */}
                <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>💭 Mood</span>
                    </div>
                    <div className="flex justify-between gap-1">
                        {last7Moods.map((m, i) => (
                            <div key={last7[i]} className="flex-1 h-10 bg-slate-50 dark:bg-black/20 rounded-md flex items-center justify-center text-xl">
                                {m ? m.emoji : <span className="text-slate-300 text-xs">·</span>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Day labels */}
                <div className="flex justify-between gap-1 mt-1">
                    {last7.map(date => {
                        const day = new Date(date + 'T00:00:00').getDay();
                        const labels = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
                        return (
                            <span key={date} className="flex-1 text-center text-[10px] text-slate-400 font-bold">
                                {labels[day]}
                            </span>
                        );
                    })}
                </div>
            </div>

            {/* ── Custom Moods management ──────────────────────────────────────── */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200">Mis Emociones</h3>
                    <button
                        onClick={restoreDefaultMoods}
                        className="text-[10px] font-bold text-slate-400 hover:text-indigo-500 transition-colors"
                    >
                        Restaurar defaults
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {moodData.customMoods?.map(mood => {
                        const isProtected = DEFAULT_MOOD_IDS.has(mood.id);
                        return (
                            <div key={mood.id} className="bg-white dark:bg-[#2d1820] border border-slate-100 dark:border-[#5a2b35]/30 p-3 rounded-2xl flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="text-xl bg-slate-50 dark:bg-black/20 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">{mood.emoji}</span>
                                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300 truncate">{mood.label}</span>
                                </div>
                                {!isProtected && (
                                    <button
                                        onClick={() => handleDeleteMood(mood.id)}
                                        className="w-6 h-6 rounded-full flex items-center justify-center text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/40 transition-colors flex-shrink-0"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">close</span>
                                    </button>
                                )}
                                {isProtected && (
                                    <span className="text-[9px] font-bold text-indigo-300">default</span>
                                )}
                            </div>
                        );
                    })}
                    <button
                        onClick={() => setIsCreatingMood(true)}
                        className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/40 p-3 rounded-2xl flex items-center justify-center gap-2 text-indigo-500 hover:bg-indigo-100 transition-colors border-dashed"
                    >
                        <span className="material-symbols-outlined text-sm">add</span>
                        <span className="text-sm font-bold">Nueva emoción</span>
                    </button>
                </div>
            </div>

            {/* ── Create Mood Modal ─────────────────────────────────────────────── */}
            {isCreatingMood && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCreatingMood(false)}></div>
                    <div className="relative bg-white dark:bg-[#231218] p-6 rounded-3xl w-full max-w-sm shadow-2xl animate-in zoom-in-95">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 text-center">Nueva Emoción</h3>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block ml-1">Emoji</label>
                                <div className="flex justify-center">
                                    <input
                                        type="text"
                                        value={newMoodEmoji}
                                        onChange={(e) => {
                                            const val = e.target.value.substring(0, 4);
                                            setNewMoodEmoji(val || '✨');
                                        }}
                                        onClick={() => { if (newMoodEmoji === '✨') setNewMoodEmoji(''); }}
                                        className="w-16 h-16 text-3xl text-center bg-white dark:bg-[#1a0d10] border-2 border-indigo-100 dark:border-indigo-900/50 rounded-2xl shadow-sm focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:opacity-30"
                                        placeholder="✨"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block ml-1">Nombre</label>
                                <input
                                    type="text"
                                    value={newMoodLabel}
                                    onChange={(e) => setNewMoodLabel(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-[#1a0d10] border-2 border-slate-100 dark:border-[#5a2b35]/30 rounded-2xl px-4 py-3 text-slate-700 dark:text-slate-200 font-bold focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all placeholder:font-medium"
                                    placeholder="Ej: Ansiosa, Feliz..."
                                    autoFocus
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddMood(); }}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsCreatingMood(false)}
                                className="flex-1 px-4 py-3 rounded-2xl font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAddMood}
                                disabled={!newMoodLabel.trim()}
                                className="flex-1 px-4 py-3 rounded-2xl font-bold text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-500/20"
                            >
                                Crear
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Edit Habits Modal ─────────────────────────────────────────────── */}
            {isEditingHabits && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsEditingHabits(false)}></div>
                    <div className="relative bg-white dark:bg-[#231218] p-6 rounded-3xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Editar hábitos</h3>
                            <button onClick={restoreDefaultHabits} className="text-[10px] font-bold text-slate-400 hover:text-indigo-500">Restaurar defaults</button>
                        </div>

                        {/* Lista de hábitos existentes */}
                        <div className="space-y-2 mb-4">
                            {customHabits.filter(h => !h.archived).map(h => (
                                <div key={h.id} className="bg-slate-50 dark:bg-[#1a0d10] p-2.5 rounded-xl flex items-center gap-2">
                                    <span className="text-xl">{h.emoji}</span>
                                    <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{h.label}</span>
                                    {h.isDefault && <span className="text-[9px] font-bold text-indigo-300">default</span>}
                                    <button
                                        onClick={() => deleteHabit(h)}
                                        className="w-6 h-6 rounded-full flex items-center justify-center text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/40 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">close</span>
                                    </button>
                                </div>
                            ))}
                            {customHabits.filter(h => !h.archived).length === 0 && (
                                <p className="text-center text-xs text-slate-400 py-3">No hay hábitos. Agrega uno abajo.</p>
                            )}
                        </div>

                        {/* Formulario nuevo hábito */}
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-2xl mb-4">
                            <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-2">Nuevo hábito</label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="text"
                                    value={habitDraftEmoji}
                                    onChange={(e) => setHabitDraftEmoji(e.target.value.substring(0, 4) || '✨')}
                                    onClick={() => { if (habitDraftEmoji === '✨') setHabitDraftEmoji(''); }}
                                    className="w-12 h-12 text-2xl text-center bg-white dark:bg-[#1a0d10] border-2 border-indigo-100 dark:border-indigo-900/50 rounded-xl outline-none focus:border-indigo-500"
                                />
                                <input
                                    type="text"
                                    value={habitDraftLabel}
                                    onChange={(e) => setHabitDraftLabel(e.target.value)}
                                    placeholder="Ej: Tomar vitaminas"
                                    onKeyDown={(e) => { if (e.key === 'Enter') addHabit(); }}
                                    className="flex-1 h-12 px-3 bg-white dark:bg-[#1a0d10] border-2 border-indigo-100 dark:border-indigo-900/50 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500"
                                />
                                <button
                                    onClick={addHabit}
                                    disabled={!habitDraftLabel.trim()}
                                    className="w-12 h-12 rounded-xl bg-indigo-500 text-white flex items-center justify-center disabled:opacity-50 hover:bg-indigo-600 transition-colors"
                                >
                                    <span className="material-symbols-outlined">add</span>
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={() => setIsEditingHabits(false)}
                            className="w-full px-4 py-3 rounded-2xl font-bold text-white bg-indigo-500 hover:bg-indigo-600 transition-colors"
                        >
                            Listo
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
