import React, { useState, useEffect } from 'react';
import { useFeatureData } from '../hooks/useFeatureData';
import type { WellnessData, MoodData, CustomMood } from '../types';

const HABITS = ['Leer 10 páginas', 'Skincare', 'Meditar', 'Agradecer'];
const WATER_GOAL = 8;
const todayStr = () => new Date().toISOString().split('T')[0];

const sendNotif = (body: string) => {
    if (Notification.permission === 'granted') {
        new Notification('App Nia 🌸', { body, icon: '/favicon.ico' });
    }
};

export const WellnessScreen: React.FC = () => {
    const { data, save } = useFeatureData<WellnessData>('wellness', { days: [] });
    const { data: moodData, save: saveMood } = useFeatureData<MoodData>('mood', {
        entries: [],
        customMoods: [
            { id: 'calm', emoji: '🌸', label: 'Calm' },
            { id: 'fresh', emoji: '🌿', label: 'Fresh' },
            { id: 'tired', emoji: '🌙', label: 'Tired' },
            { id: 'sad', emoji: '🌧', label: 'Sad' },
            { id: 'hype', emoji: '🔥', label: 'Hype' },
        ]
    });

    const [isCreatingMood, setIsCreatingMood] = useState(false);
    const [newMoodEmoji, setNewMoodEmoji] = useState('✨');
    const [newMoodLabel, setNewMoodLabel] = useState('');

    const [timerActive, setTimerActive] = useState(false);
    const [timeLeft, setTimeLeft] = useState(300);
    const [mode, setMode] = useState<'breathing' | 'pomodoro'>('breathing');
    const [notifGranted, setNotifGranted] = useState(Notification.permission === 'granted');

    const today = todayStr();
    const todayData = data.days.find(d => d.date === today) ?? { date: today, glasses: 0, habits: [] };

    // ─── Timer ────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!timerActive) return;
        if (timeLeft === 0) {
            setTimerActive(false);
            sendNotif(mode === 'breathing' ? '¡Sesión de respiración completada! 🌿' : '¡Pomodoro completado! Toma un descanso. ☕');
            return;
        }
        const id = setInterval(() => setTimeLeft(t => t - 1), 1000);
        return () => clearInterval(id);
    }, [timerActive, timeLeft, mode]);

    const setTimerMode = (m: 'breathing' | 'pomodoro') => {
        setMode(m);
        setTimerActive(false);
        setTimeLeft(m === 'breathing' ? 300 : 1500);
    };

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    // ─── Persistence helpers ──────────────────────────────────────────────────
    const updateToday = (updates: Partial<typeof todayData>) => {
        const updated = { ...todayData, ...updates };
        const otherDays = data.days.filter(d => d.date !== today);
        return save({ days: [updated, ...otherDays] });
    };

    const setGlasses = (n: number) => updateToday({ glasses: n });

    const toggleHabit = (h: string) => {
        const habits = todayData.habits.includes(h)
            ? todayData.habits.filter(i => i !== h)
            : [...todayData.habits, h];
        updateToday({ habits });
        if (!todayData.habits.includes(h)) sendNotif(`¡Hábito completado: ${h}! 🎉`);
    };

    // ─── Moods ────────────────────────────────────────────────────────────────
    const handleAddMood = () => {
        if (!newMoodLabel.trim()) return;
        const newMood: CustomMood = {
            id: Date.now().toString(),
            emoji: newMoodEmoji || '✨',
            label: newMoodLabel.trim()
        };
        saveMood({ customMoods: [...moodData.customMoods, newMood] });
        setIsCreatingMood(false);
        setNewMoodLabel('');
        setNewMoodEmoji('✨');
    };

    const handleDeleteMood = (id: string) => {
        saveMood({ customMoods: moodData.customMoods.filter(m => m.id !== id) });
    };

    // ─── Notifications ────────────────────────────────────────────────────────
    const requestNotif = async () => {
        const perm = await Notification.requestPermission();
        setNotifGranted(perm === 'granted');
        if (perm === 'granted') sendNotif('¡Notificaciones activadas! Te avisaré durante el día 🌸');
    };

    return (
        <div className="p-6 pt-12 pb-24">
            <div className="flex items-center justify-between mb-6">
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

            {/* ── Timer ─────────────────────────────────────────────────────────── */}
            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-[#0d2b2b] dark:to-[#0a2233] rounded-3xl p-6 mb-6 text-center border border-teal-100 dark:border-teal-900/40">
                <div className="flex justify-center gap-4 mb-6">
                    <button
                        onClick={() => setTimerMode('breathing')}
                        className={`px-4 py-1 rounded-full text-xs font-bold transition-colors ${mode === 'breathing' ? 'bg-teal-500 text-white shadow-md' : 'text-teal-400 bg-white/50 dark:bg-white/10'}`}
                    >
                        Respiración
                    </button>
                    <button
                        onClick={() => setTimerMode('pomodoro')}
                        className={`px-4 py-1 rounded-full text-xs font-bold transition-colors ${mode === 'pomodoro' ? 'bg-cyan-500 text-white shadow-md' : 'text-cyan-400 bg-white/50 dark:bg-white/10'}`}
                    >
                        Pomodoro
                    </button>
                </div>

                <div className="relative w-48 h-48 mx-auto flex items-center justify-center mb-6">
                    <div className={`absolute inset-0 rounded-full border-4 border-teal-200/50 dark:border-teal-700/40 ${timerActive ? 'animate-pulse' : ''}`}></div>
                    <div className="text-5xl font-extrabold text-teal-600 dark:text-teal-300 font-mono tracking-wider">
                        {formatTime(timeLeft)}
                    </div>
                </div>

                <div className="flex gap-3 justify-center">
                    <button
                        onClick={() => setTimerActive(a => !a)}
                        className="bg-white dark:bg-teal-900/60 text-teal-600 dark:text-teal-300 w-16 h-16 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
                    >
                        <span className="material-symbols-outlined text-3xl">{timerActive ? 'pause' : 'play_arrow'}</span>
                    </button>
                    <button
                        onClick={() => { setTimerActive(false); setTimeLeft(mode === 'breathing' ? 300 : 1500); }}
                        className="bg-white/80 dark:bg-teal-900/40 text-slate-400 w-12 h-12 rounded-full flex items-center justify-center self-center hover:scale-110 transition-transform"
                    >
                        <span className="material-symbols-outlined text-xl">replay</span>
                    </button>
                </div>

                <p className="text-teal-400 text-sm mt-4 font-medium">
                    {timerActive ? (mode === 'breathing' ? 'Inhala... Exhala...' : '¡Enfócate, Nia!') : 'Lista para empezar'}
                </p>
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

            {/* ── Habits ────────────────────────────────────────────────────────── */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200">Hábitos de hoy</h3>
                    <span className="text-xs text-slate-400">{todayData.habits.length}/{HABITS.length} completados</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {HABITS.map(h => (
                        <button
                            key={h}
                            onClick={() => toggleHabit(h)}
                            className={`p-3 rounded-xl flex items-center gap-3 transition-colors text-left
                                ${todayData.habits.includes(h)
                                    ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                                    : 'bg-white dark:bg-[#2d1820] border border-slate-100 dark:border-[#5a2b35]/30 text-slate-500 dark:text-slate-300'}`}
                        >
                            <div className={`w-5 h-5 rounded flex items-center justify-center border flex-shrink-0
                                ${todayData.habits.includes(h) ? 'border-purple-500 bg-purple-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}
                            >
                                {todayData.habits.includes(h) && <span className="material-symbols-outlined text-xs">check</span>}
                            </div>
                            <span className="text-sm font-medium">{h}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Custom Moods ──────────────────────────────────────────────────── */}
            <div className="mt-8">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200">Mis Emociones</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                    {moodData.customMoods?.map(mood => (
                        <div key={mood.id} className="bg-white dark:bg-[#2d1820] border border-slate-100 dark:border-[#5a2b35]/30 p-3 rounded-2xl flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-3">
                                <span className="text-xl bg-slate-50 dark:bg-black/20 w-8 h-8 rounded-full flex items-center justify-center">{mood.emoji}</span>
                                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{mood.label}</span>
                            </div>
                            {/* Allow deleting any mood, even defaults if user wants, or we could protect defaults. Let's allow complete freedom */}
                            <button
                                onClick={() => handleDeleteMood(mood.id)}
                                className="w-6 h-6 rounded-full flex items-center justify-center text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/40 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                        </div>
                    ))}
                    <button
                        onClick={() => setIsCreatingMood(true)}
                        className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/40 p-3 rounded-2xl flex items-center justify-center gap-2 text-indigo-500 hover:bg-indigo-100 transition-colors border-dashed"
                    >
                        <span className="material-symbols-outlined text-sm">add</span>
                        <span className="text-sm font-bold">Nueva emoción</span>
                    </button>
                </div>
            </div>

            {/* Create Mood Modal */}
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
                                        onClick={() => {
                                            if (newMoodEmoji === '✨') setNewMoodEmoji('');
                                        }}
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
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleAddMood();
                                    }}
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
        </div>
    );
};
