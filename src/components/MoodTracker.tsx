import React, { useState } from 'react';
import { useFeatureData } from '../hooks/useFeatureData';
import type { MoodData, MoodEntry } from '../types';

const moods = [
    { emoji: '🌸', label: 'Calm',  color: 'bg-pink-100 text-pink-500' },
    { emoji: '🌿', label: 'Fresh', color: 'bg-green-100 text-green-500' },
    { emoji: '🌙', label: 'Tired', color: 'bg-indigo-100 text-indigo-500' },
    { emoji: '🌧', label: 'Sad',   color: 'bg-blue-100 text-blue-500' },
    { emoji: '🔥', label: 'Hype',  color: 'bg-orange-100 text-orange-500' },
];

const todayStr = () => new Date().toISOString().split('T')[0];

export const MoodTracker: React.FC = () => {
    const { data, save } = useFeatureData<MoodData>('mood', { entries: [] });
    const [showHistory, setShowHistory] = useState(false);

    const todayEntry = data.entries.find(e => e.date === todayStr());
    const selectedMood = todayEntry?.mood ?? null;

    const handleSelect = async (mood: typeof moods[0]) => {
        const entry: MoodEntry = {
            date: todayStr(),
            mood: mood.label,
            emoji: mood.emoji,
            timestamp: Date.now(),
        };
        const withoutToday = data.entries.filter(e => e.date !== todayStr());
        await save({ entries: [entry, ...withoutToday] });
    };

    const recent = data.entries.slice(0, 7);

    return (
        <section className="px-6 py-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">¿Cómo te sientes hoy, Nia?</h3>
                {data.entries.length > 0 && (
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="text-xs text-accent font-bold flex items-center gap-1 hover:text-primary transition-colors"
                    >
                        <span className="material-symbols-outlined text-sm">history</span>
                        Historial
                    </button>
                )}
            </div>

            <div className="bg-white dark:bg-[#2d1820] rounded-2xl p-2 shadow-sm border border-primary/20 dark:border-[#5a2b35]/40 flex justify-between items-center gap-1 overflow-x-auto scrollbar-hide">
                {moods.map((mood) => (
                    <button
                        key={mood.label}
                        onClick={() => handleSelect(mood)}
                        className={`
                            group flex flex-col items-center justify-center gap-1 min-w-[60px] h-[72px] rounded-xl transition-all active:scale-95
                            ${selectedMood === mood.label ? 'bg-primary shadow-sm' : 'hover:bg-primary/20'}
                        `}
                    >
                        <span className={`text-2xl transition-transform duration-300 ${selectedMood === mood.label ? 'scale-125' : 'group-hover:scale-110'}`}>
                            {mood.emoji}
                        </span>
                        <span className={`text-[10px] font-bold ${selectedMood === mood.label ? 'text-text-main' : 'text-accent'}`}>
                            {mood.label}
                        </span>
                    </button>
                ))}
            </div>

            {showHistory && recent.length > 0 && (
                <div className="mt-3 bg-white dark:bg-[#2d1820] rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-[#5a2b35]/30">
                    <p className="text-xs font-bold text-slate-400 mb-3">Últimos {recent.length} días</p>
                    <div className="flex gap-4 overflow-x-auto scrollbar-hide">
                        {recent.map(e => (
                            <div key={e.date} className="flex flex-col items-center gap-1 min-w-[44px]">
                                <span className="text-2xl">{e.emoji}</span>
                                <span className="text-[9px] text-slate-400 font-medium">{e.date.slice(5)}</span>
                                <span className="text-[8px] text-accent">{e.mood}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
};
