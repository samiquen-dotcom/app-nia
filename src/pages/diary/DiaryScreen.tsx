import React, { useEffect, useMemo, useState } from 'react';
import type { NoteContext, PeriodData, MoodData, WellnessData } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { FirestoreService, Features } from '../../services/firestore';
import { useDiaryNotes } from '../../hooks/useDiaryNotes';
import { buildCurrentContext } from './diaryHelpers';
import { ThinkMode } from './ThinkMode';
import { FeelMode } from './FeelMode';
import { CreateMode } from './CreateMode';
import { ConstellationView } from './ConstellationView';

type Mode = 'pensar' | 'sentir' | 'crear' | 'historia';

const MODES: { id: Mode; label: string; icon: string; color: string; tagline: string }[] = [
    { id: 'pensar',   label: 'Pensar',   icon: 'edit_note',     color: 'rose',    tagline: 'En palabras' },
    { id: 'sentir',   label: 'Sentir',   icon: 'graphic_eq',    color: 'violet',  tagline: 'En voz y ritmo' },
    { id: 'crear',    label: 'Crear',    icon: 'brush',         color: 'amber',   tagline: 'Cartas y poemas' },
    { id: 'historia', label: 'Historia', icon: 'auto_stories',  color: 'fuchsia', tagline: 'Tu archivo' },
];

const modeStyles: Record<string, { active: string; idle: string }> = {
    rose:    { active: 'bg-rose-500 text-white shadow-md',    idle: 'text-rose-400'    },
    violet:  { active: 'bg-violet-500 text-white shadow-md',  idle: 'text-violet-400'  },
    amber:   { active: 'bg-amber-500 text-white shadow-md',   idle: 'text-amber-400'   },
    fuchsia: { active: 'bg-fuchsia-500 text-white shadow-md', idle: 'text-fuchsia-400' },
};

export const DiaryScreen: React.FC = () => {
    const { user } = useAuth();
    const { notes, loading, error, addNote, deleteNote, togglePin, clearError } = useDiaryNotes();
    // Adaptador para los modos hijos: ellos no necesitan el DiaryNote que retorna el hook
    const handleSave = async (incoming: Parameters<typeof addNote>[0]): Promise<void> => {
        await addNote(incoming);
    };
    const [mode, setMode] = useState<Mode>('pensar');
    const [context, setContext] = useState<NoteContext>({});
    const [streak, setStreak] = useState<number>(0);

    // Cargar contexto actual (ciclo + ánimo + bienestar) en paralelo
    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        (async () => {
            const [period, mood, wellness] = await Promise.all([
                FirestoreService.getFeatureData(user.uid, Features.PERIOD) as Promise<PeriodData | null>,
                FirestoreService.getFeatureData(user.uid, Features.MOOD)   as Promise<MoodData | null>,
                FirestoreService.getFeatureData(user.uid, Features.WELLNESS) as Promise<WellnessData | null>,
            ]);
            if (cancelled) return;
            const ctx = await buildCurrentContext(period, mood, wellness);
            setContext(ctx);
        })();
        return () => { cancelled = true; };
    }, [user]);

    // Streak: días consecutivos con al menos una entrada (mirando las últimas 60)
    useEffect(() => {
        if (notes.length === 0) { setStreak(0); return; }
        const days = new Set(notes.map(n => new Date(n.createdAt).toISOString().slice(0, 10)));
        let count = 0;
        const cursor = new Date();
        while (count < 60) {
            const k = cursor.toISOString().slice(0, 10);
            if (days.has(k)) { count++; cursor.setDate(cursor.getDate() - 1); }
            else break;
        }
        setStreak(count);
    }, [notes]);

    const totalNotes = notes.length;
    const lockedLetters = useMemo(
        () => notes.filter(n => n.type === 'letter' && n.isLocked && n.unlockDate && n.unlockDate > new Date().toISOString().slice(0, 10)).length,
        [notes],
    );

    if (loading) {
        return (
            <div className="p-6 pt-12 pb-24">
                <p className="text-center text-slate-400 animate-pulse">Abriendo tu diario… 📖</p>
            </div>
        );
    }

    return (
        <div className="p-6 pt-12 pb-24">
            {/* Error banner */}
            {error && (
                <div className="mb-4 rounded-xl bg-rose-100 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-200 text-sm px-4 py-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">error</span>
                    <span className="flex-1">{error}</span>
                    <button onClick={clearError} className="text-rose-500 hover:text-rose-700 text-xs font-bold">×</button>
                </div>
            )}

            {/* Hero header */}
            <header className="mb-6">
                <div className="flex items-start justify-between mb-2">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-rose-400 text-2xl" style={{ filter: 'drop-shadow(0 0 8px rgba(244, 114, 182, 0.4))' }}>edit_note</span>
                            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Tu Diario</h1>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 italic font-serif-diary">Tu pensamiento, en orden.</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        {streak > 0 && (
                            <span className="text-[11px] bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300 px-3 py-1 rounded-full font-bold flex items-center gap-1">
                                🔥 {streak} {streak === 1 ? 'día' : 'días'}
                            </span>
                        )}
                        {totalNotes > 0 && (
                            <span className="text-[10px] text-slate-400">{totalNotes} {totalNotes === 1 ? 'entrada' : 'entradas'}</span>
                        )}
                    </div>
                </div>

                {/* Aviso de cartas selladas */}
                {lockedLetters > 0 && (
                    <div className="mt-3 rounded-2xl bg-gradient-to-br from-amber-50 to-rose-50 dark:from-amber-900/15 dark:to-rose-900/15 border border-amber-100 dark:border-amber-900/30 px-4 py-2.5 flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-500 text-base">lock_clock</span>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                            Tienes <strong className="text-amber-600 dark:text-amber-300">{lockedLetters}</strong> {lockedLetters === 1 ? 'carta sellada esperando' : 'cartas selladas esperando'} su día.
                        </p>
                    </div>
                )}
            </header>

            {/* Mode switcher */}
            <div className="grid grid-cols-4 gap-2 mb-6">
                {MODES.map(m => {
                    const isActive = mode === m.id;
                    const styles = modeStyles[m.color];
                    return (
                        <button
                            key={m.id}
                            onClick={() => setMode(m.id)}
                            className={`relative rounded-2xl p-3 flex flex-col items-center gap-1 transition-all
                                ${isActive
                                    ? `${styles.active} scale-[1.02]`
                                    : 'bg-white dark:bg-[#2d1820] border border-slate-100 dark:border-[#5a2b35]/30 hover:shadow-sm'}
                            `}
                        >
                            <span className={`material-symbols-outlined text-2xl ${isActive ? '' : styles.idle}`}>{m.icon}</span>
                            <span className={`text-[11px] font-bold ${isActive ? '' : 'text-slate-600 dark:text-slate-300'}`}>{m.label}</span>
                            {isActive && (
                                <span className="text-[9px] opacity-90 -mt-0.5">{m.tagline}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Active mode */}
            {mode === 'pensar' && <ThinkMode context={context} onSave={handleSave} />}
            {mode === 'sentir' && <FeelMode  context={context} onSave={handleSave} />}
            {mode === 'crear'  && <CreateMode context={context} onSave={handleSave} />}
            {mode === 'historia' && (
                <ConstellationView
                    notes={notes}
                    onDelete={deleteNote}
                    onTogglePin={togglePin}
                />
            )}

            {/* Footer-cita estética */}
            {mode !== 'historia' && (
                <div className="mt-8 text-center">
                    <p className="text-[11px] text-slate-300 dark:text-slate-600 italic font-serif-diary">
                        — escribir es la forma más íntima de escucharse —
                    </p>
                </div>
            )}
        </div>
    );
};
