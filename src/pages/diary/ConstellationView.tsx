import React, { useMemo, useState } from 'react';
import type { DiaryNote } from '../../types';
import { PHASE_COLORS, TYPE_META, formatDate, isUnlocked, daysUntil, renderLightMarkdown } from './diaryHelpers';
import { LoopPreview } from './LoopStudio';
import { VoiceClipPlayer } from './VoiceRecorder';

interface Props {
    notes: DiaryNote[];
    onDelete: (id: string) => Promise<void>;
    onTogglePin: (id: string) => Promise<void>;
}

type Filter = 'all' | 'thought' | 'voice' | 'letter' | 'poem';

export const ConstellationView: React.FC<Props> = ({ notes, onDelete, onTogglePin }) => {
    const [filter, setFilter] = useState<Filter>('all');
    const [search, setSearch] = useState('');
    const [openId, setOpenId] = useState<string | null>(null);

    const filtered = useMemo(() => {
        let list = [...notes].sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return b.createdAt - a.createdAt;
        });
        if (filter !== 'all') list = list.filter(n => n.type === filter);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(n =>
                (n.title || '').toLowerCase().includes(q) ||
                n.body.toLowerCase().includes(q) ||
                n.tags.some(t => t.includes(q)) ||
                (n.voiceClip?.transcript || '').toLowerCase().includes(q),
            );
        }
        return list;
    }, [notes, filter, search]);

    const opened = openId ? notes.find(n => n.id === openId) : null;

    if (notes.length === 0) {
        return (
            <div className="text-center py-16">
                <span className="material-symbols-outlined text-6xl text-rose-200 dark:text-rose-900/40">auto_stories</span>
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                    Tu diario está vacío. Empieza por una sola línea ✨
                </p>
            </div>
        );
    }

    return (
        <>
            {/* Filtros */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar en tu diario…"
                    className="flex-1 min-w-[140px] bg-white dark:bg-[#2d1820] border border-rose-100 dark:border-rose-900/30 rounded-full px-4 py-2 text-sm outline-none focus:border-rose-300 placeholder:text-slate-400"
                />
                <FilterChip label="Todo"        active={filter === 'all'}     onClick={() => setFilter('all')} />
                <FilterChip label="Pensar"      active={filter === 'thought'} onClick={() => setFilter('thought')} icon="edit_note" />
                <FilterChip label="Sentir"      active={filter === 'voice'}   onClick={() => setFilter('voice')}   icon="graphic_eq" />
                <FilterChip label="Cartas"      active={filter === 'letter'}  onClick={() => setFilter('letter')}  icon="mail" />
                <FilterChip label="Poemas"      active={filter === 'poem'}    onClick={() => setFilter('poem')}    icon="format_quote" />
            </div>

            {filtered.length === 0 && (
                <p className="text-center text-xs text-slate-400 py-8">No hay entradas que coincidan.</p>
            )}

            <div className="space-y-3">
                {filtered.map((n) => {
                    const phaseColor = n.context.cyclePhase ? PHASE_COLORS[n.context.cyclePhase] : null;
                    const meta = TYPE_META[n.type];
                    const unlocked = isUnlocked(n);
                    return (
                        <div
                            key={n.id}
                            className={`diary-fade-up rounded-2xl bg-white dark:bg-[#2d1820] border border-slate-100 dark:border-[#5a2b35]/30 shadow-sm overflow-hidden
                                ${n.pinned ? 'ring-2 ring-rose-200 dark:ring-rose-900/50' : ''}`}
                        >
                            <button
                                onClick={() => unlocked ? setOpenId(openId === n.id ? null : n.id) : null}
                                className="w-full text-left p-4 flex items-start gap-3"
                            >
                                <div className={`w-10 h-10 rounded-full ${meta.accent} flex items-center justify-center flex-shrink-0 ${phaseColor?.ring ? 'ring-2 ' + phaseColor.ring : ''}`}>
                                    <span className={`material-symbols-outlined ${meta.color}`}>{n.isLocked && !unlocked ? 'lock' : meta.icon}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{meta.label}</span>
                                        {n.context.moodEmoji && <span className="text-sm">{n.context.moodEmoji}</span>}
                                        {n.context.cyclePhase && phaseColor && (
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${phaseColor.bg} ${phaseColor.text}`}>
                                                {n.context.cyclePhase}
                                            </span>
                                        )}
                                        {n.pinned && <span className="material-symbols-outlined text-rose-400 text-base">push_pin</span>}
                                    </div>
                                    {n.title && <p className="font-bold text-slate-700 dark:text-slate-100 truncate font-serif-diary mt-1">{n.title}</p>}
                                    {n.isLocked && !unlocked ? (
                                        <p className="text-xs text-amber-600 dark:text-amber-300 mt-1 italic">
                                            Sellada · se abre en {daysUntil(n.unlockDate || '')} días ({n.unlockDate})
                                        </p>
                                    ) : (
                                        <p className="text-sm text-slate-500 dark:text-slate-300 mt-1 line-clamp-2 whitespace-pre-line">
                                            {n.body || (n.voiceClip ? '🎙️ Memo de voz' : n.loopPattern ? '🎶 Loop' : '')}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                        <span className="text-[10px] text-slate-400">{formatDate(n.createdAt)}</span>
                                        {n.tags.map(t => (
                                            <span key={t} className="text-[10px] text-rose-500 dark:text-rose-300">#{t}</span>
                                        ))}
                                    </div>
                                </div>
                            </button>

                            {opened?.id === n.id && unlocked && (
                                <div className="px-4 pb-4 border-t border-slate-100 dark:border-[#5a2b35]/20 pt-4 space-y-3">
                                    {n.body && (
                                        <div
                                            className="font-serif-diary text-[16px] leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap"
                                            dangerouslySetInnerHTML={{ __html: renderLightMarkdown(n.body) }}
                                        />
                                    )}
                                    {n.voiceClip && <VoiceClipPlayer clip={n.voiceClip} />}
                                    {n.loopPattern && <LoopPreview pattern={n.loopPattern} />}

                                    <div className="flex items-center gap-2 pt-1">
                                        <button
                                            onClick={() => onTogglePin(n.id)}
                                            className="text-[11px] px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-500 font-bold flex items-center gap-1"
                                        >
                                            <span className="material-symbols-outlined text-sm">{n.pinned ? 'keep_off' : 'push_pin'}</span>
                                            {n.pinned ? 'Quitar fijado' : 'Fijar'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (confirm('¿Borrar esta entrada? No se puede recuperar.')) {
                                                    onDelete(n.id);
                                                }
                                            }}
                                            className="text-[11px] px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-500 font-bold flex items-center gap-1 ml-auto"
                                        >
                                            <span className="material-symbols-outlined text-sm">delete</span>
                                            Borrar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </>
    );
};

const FilterChip: React.FC<{ label: string; active: boolean; onClick: () => void; icon?: string }> = ({ label, active, onClick, icon }) => (
    <button
        onClick={onClick}
        className={`text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-1 transition-colors
            ${active
                ? 'bg-rose-500 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-[#3a2028] text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#4a2832]'}`}
    >
        {icon && <span className="material-symbols-outlined text-base leading-none">{icon}</span>}
        {label}
    </button>
);
