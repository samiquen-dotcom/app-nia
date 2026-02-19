import React, { useState } from 'react';
import { useFeatureData } from '../hooks/useFeatureData';
import type { GoalsData, GoalItem, MediaItem } from '../types';

const STATUS_LABEL: Record<string, string> = {
    watching: 'Viendo 👀',
    finished: 'Terminado ✅',
    pending:  'Pendiente ⏳',
};
const STATUS_COLOR: Record<string, string> = {
    watching: 'bg-blue-100 text-blue-600',
    finished: 'bg-green-100 text-green-600',
    pending:  'bg-gray-100 text-gray-500',
};
const STATUS_CYCLE: Record<string, MediaItem['status']> = {
    watching: 'finished',
    finished: 'pending',
    pending:  'watching',
};

export const GoalsScreen: React.FC = () => {
    const { data, save } = useFeatureData<GoalsData>('goals', { goals: [], wishlist: [], media: [] });

    const [newGoal,  setNewGoal]  = useState('');
    const [newWish,  setNewWish]  = useState('');
    const [newMedia, setNewMedia] = useState('');

    // ─── Goals ────────────────────────────────────────────────────────────────
    const addGoal = () => {
        if (!newGoal.trim()) return;
        const updated: GoalItem[] = [...data.goals, { id: Date.now(), text: newGoal.trim(), completed: false }];
        save({ goals: updated });
        setNewGoal('');
    };
    const toggleGoal = (id: number) => {
        save({ goals: data.goals.map(g => g.id === id ? { ...g, completed: !g.completed } : g) });
    };
    const deleteGoal = (id: number) => save({ goals: data.goals.filter(g => g.id !== id) });

    // ─── Wishlist ─────────────────────────────────────────────────────────────
    const addWish = () => {
        if (!newWish.trim()) return;
        save({ wishlist: [...data.wishlist, { id: Date.now(), text: newWish.trim(), completed: false }] });
        setNewWish('');
    };
    const deleteWish = (id: number) => save({ wishlist: data.wishlist.filter(w => w.id !== id) });

    // ─── Media ────────────────────────────────────────────────────────────────
    const addMedia = () => {
        if (!newMedia.trim()) return;
        const item: MediaItem = { id: Date.now(), title: newMedia.trim(), type: 'other', status: 'watching' };
        save({ media: [...data.media, item] });
        setNewMedia('');
    };
    const cycleStatus = (id: number) => {
        save({ media: data.media.map(m => m.id === id ? { ...m, status: STATUS_CYCLE[m.status] } : m) });
    };
    const deleteMedia = (id: number) => save({ media: data.media.filter(m => m.id !== id) });

    const completedGoals = data.goals.filter(g => g.completed).length;

    return (
        <div className="p-6 pt-12 pb-24">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Tus metas, Nia ⭐</h1>
                {data.goals.length > 0 && (
                    <span className="text-xs text-slate-400 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1 rounded-full font-bold">
                        {completedGoals}/{data.goals.length} metas ✓
                    </span>
                )}
            </div>

            {/* ── Metas del Mes ─────────────────────────────────────────────────── */}
            <Section title="Metas del Mes" icon="emoji_events" iconColor="text-yellow-400">
                {data.goals.map(g => (
                    <div key={g.id} className="flex items-center gap-3 group">
                        <button
                            onClick={() => toggleGoal(g.id)}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0
                                ${g.completed ? 'bg-yellow-400 border-yellow-400 text-white' : 'border-slate-300 dark:border-slate-600'}`}
                        >
                            {g.completed && <span className="material-symbols-outlined text-sm">check</span>}
                        </button>
                        <span className={`flex-1 text-sm ${g.completed ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                            {g.text}
                        </span>
                        <button onClick={() => deleteGoal(g.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-400 transition-opacity">
                            <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                    </div>
                ))}
                {data.goals.length === 0 && <Empty text="¿Qué quieres lograr este mes, Nia? ✨" />}
                <AddRow
                    value={newGoal}
                    onChange={setNewGoal}
                    onAdd={addGoal}
                    placeholder="Nueva meta..."
                    btnColor="bg-yellow-400"
                />
            </Section>

            {/* ── Wishlist ──────────────────────────────────────────────────────── */}
            <Section title="Wishlist" icon="favorite" iconColor="text-pink-400">
                {data.wishlist.map(w => (
                    <div key={w.id} className="flex items-center gap-3 group">
                        <span className="material-symbols-outlined text-pink-300 text-sm flex-shrink-0">shopping_bag</span>
                        <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">{w.text}</span>
                        <button onClick={() => deleteWish(w.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-400 transition-opacity">
                            <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                    </div>
                ))}
                {data.wishlist.length === 0 && <Empty text="Agrega tus deseos aquí 🛍️" />}
                <AddRow
                    value={newWish}
                    onChange={setNewWish}
                    onAdd={addWish}
                    placeholder="Deseo..."
                    btnColor="bg-pink-400"
                    focusColor="focus:border-pink-400"
                />
            </Section>

            {/* ── Libros y Series ───────────────────────────────────────────────── */}
            <Section title="Libros y Series" icon="movie" iconColor="text-indigo-400" last>
                {data.media.map(m => (
                    <div key={m.id} className="flex items-center gap-3 group">
                        <div className="flex-1">
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{m.title}</p>
                            <button
                                onClick={() => cycleStatus(m.id)}
                                className={`text-[10px] px-2 py-0.5 rounded-full mt-1 ${STATUS_COLOR[m.status]}`}
                            >
                                {STATUS_LABEL[m.status]}
                            </button>
                        </div>
                        <button onClick={() => deleteMedia(m.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-400 transition-opacity">
                            <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                    </div>
                ))}
                {data.media.length === 0 && <Empty text="¿Qué estás viendo o leyendo, Nia? 🎬" />}
                <AddRow
                    value={newMedia}
                    onChange={setNewMedia}
                    onAdd={addMedia}
                    placeholder="Título..."
                    btnColor="bg-indigo-400"
                    focusColor="focus:border-indigo-400"
                />
            </Section>
        </div>
    );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Section: React.FC<{
    title: string; icon: string; iconColor: string;
    children: React.ReactNode; last?: boolean;
}> = ({ title, icon, iconColor, children, last }) => (
    <div className={last ? '' : 'mb-8'}>
        <h3 className={`font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2`}>
            <span className={`material-symbols-outlined ${iconColor}`}>{icon}</span>
            {title}
        </h3>
        <div className="bg-white dark:bg-[#2d1820] rounded-2xl shadow-sm border border-slate-100 dark:border-[#5a2b35]/30 overflow-hidden">
            <div className="p-4 space-y-3">{children}</div>
        </div>
    </div>
);

const Empty: React.FC<{ text: string }> = ({ text }) => (
    <p className="text-xs text-slate-400 text-center py-2">{text}</p>
);

const AddRow: React.FC<{
    value: string; onChange: (v: string) => void; onAdd: () => void;
    placeholder: string; btnColor: string; focusColor?: string;
}> = ({ value, onChange, onAdd, placeholder, btnColor, focusColor = 'focus:border-yellow-400' }) => (
    <div className="bg-slate-50 dark:bg-[#1a0d10] -mx-4 -mb-4 mt-3 p-3 flex gap-2">
        <input
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onAdd()}
            placeholder={placeholder}
            className={`flex-1 bg-white dark:bg-[#2d1820] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-xl px-3 py-2 text-sm focus:outline-none ${focusColor}`}
        />
        <button onClick={onAdd} className={`${btnColor} text-white rounded-xl px-3 font-bold text-lg leading-none`}>+</button>
    </div>
);
