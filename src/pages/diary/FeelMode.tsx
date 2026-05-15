import React, { useMemo, useState } from 'react';
import type { DiaryNote, NoteContext, VoiceClip, LoopPattern, AmbientType } from '../../types';
import { VoiceRecorder, VoiceClipPlayer } from './VoiceRecorder';
import { LoopStudio, LoopPreview } from './LoopStudio';
import { AmbientPlayer } from './AmbientPlayer';

interface Props {
    context: NoteContext;
    onSave: (note: Omit<DiaryNote, 'id' | 'createdAt'>) => Promise<void>;
    notes?: DiaryNote[]; // Para mostrar la biblioteca de loops ya guardados
}

export const FeelMode: React.FC<Props> = ({ context, onSave, notes = [] }) => {
    const [title, setTitle] = useState('');
    const [voiceClip, setVoiceClip] = useState<VoiceClip | null>(null);
    const [loopPattern, setLoopPattern] = useState<LoopPattern | undefined>(undefined);
    const [body, setBody] = useState('');
    const [ambient, setAmbient] = useState<AmbientType>(null);
    const [showStudio, setShowStudio] = useState(false);
    const [saving, setSaving] = useState(false);

    const canSave = !!(voiceClip || loopPattern || body.trim());

    // Biblioteca: notas previas que tienen loopPattern.
    const savedLoops = useMemo(
        () => notes
            .filter(n => n.loopPattern && Array.isArray(n.loopPattern.steps) && n.loopPattern.steps.length > 0)
            .slice(0, 8),
        [notes]
    );

    const handleSave = async () => {
        if (!canSave) return;
        setSaving(true);
        try {
            await onSave({
                type: 'voice',
                title: title.trim() || undefined,
                body: body.trim(),
                voiceClip: voiceClip || undefined,
                loopPattern,
                ambient,
                tags: [],
                context,
                updatedAt: Date.now(),
            });
            setVoiceClip(null);
            setLoopPattern(undefined);
            setBody('');
            setTitle('');
            setShowStudio(false);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-pink-50 dark:from-[#241420] dark:to-[#1f1118] border border-violet-100 dark:border-violet-900/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-violet-500 text-base">graphic_eq</span>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-violet-500/80">Sentir</span>
                </div>
                <p className="font-serif-diary text-base text-slate-700 dark:text-slate-100 leading-snug">
                    Hay cosas que se dicen mejor con la voz, o con un ritmo. Suelta acá lo que no sabe a palabras.
                </p>
            </div>

            {/* Voice recorder */}
            {!voiceClip ? (
                <VoiceRecorder onSave={setVoiceClip} />
            ) : (
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-violet-600 dark:text-violet-300 font-bold uppercase tracking-wider">
                        <span>Tu memo</span>
                        <button onClick={() => setVoiceClip(null)} className="text-rose-400 normal-case hover:underline">
                            Borrar y grabar de nuevo
                        </button>
                    </div>
                    <VoiceClipPlayer clip={voiceClip} />
                </div>
            )}

            {/* Loop Studio toggle */}
            {!showStudio && !loopPattern && (
                <button
                    onClick={() => setShowStudio(true)}
                    className="w-full rounded-2xl bg-fuchsia-50 dark:bg-fuchsia-900/15 border border-fuchsia-200 dark:border-fuchsia-900/30 p-4 hover:shadow-sm transition-shadow flex items-center gap-3 text-left"
                >
                    <span className="material-symbols-outlined text-fuchsia-500 text-3xl">queue_music</span>
                    <div>
                        <p className="font-bold text-slate-700 dark:text-slate-100 text-sm">Hacer un loop</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">4 pads, 16 pasos. Lo que estás sintiendo, en ritmo.</p>
                    </div>
                </button>
            )}

            {showStudio && !loopPattern && (
                <LoopStudio onChange={(p) => { setLoopPattern(p); if (p) setShowStudio(false); }} />
            )}

            {loopPattern && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-fuchsia-600 dark:text-fuchsia-300 font-bold uppercase tracking-wider">
                        <span>Tu loop</span>
                        <div className="flex gap-3 normal-case">
                            <button onClick={() => { setShowStudio(true); }} className="text-fuchsia-500 hover:underline">
                                Editar
                            </button>
                            <button onClick={() => setLoopPattern(undefined)} className="text-rose-400 hover:underline">
                                Quitar
                            </button>
                        </div>
                    </div>
                    {showStudio
                        ? <LoopStudio value={loopPattern} onChange={(p) => { setLoopPattern(p); setShowStudio(false); }} />
                        : <LoopPreview pattern={loopPattern} />
                    }
                </div>
            )}

            {/* Nota corta opcional */}
            <div className="rounded-2xl diary-paper border border-violet-100 dark:border-violet-900/30 p-4">
                <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Título (opcional)"
                    className="w-full bg-transparent outline-none text-lg font-bold text-slate-700 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 mb-2 font-serif-diary"
                />
                <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    rows={3}
                    placeholder="Una línea para acompañar el sonido (opcional)…"
                    className="diary-editor w-full bg-transparent outline-none resize-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 font-serif-diary text-base leading-relaxed"
                />
            </div>

            <AmbientPlayer value={ambient} onChange={setAmbient} />

            {/* Biblioteca de loops: notas previas con loop guardado */}
            {savedLoops.length > 0 && !showStudio && (
                <div className="rounded-2xl bg-fuchsia-50/50 dark:bg-fuchsia-900/10 border border-fuchsia-100 dark:border-fuchsia-900/30 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-[11px] uppercase font-extrabold text-fuchsia-500 tracking-wider">🎵 Mis loops guardados ({savedLoops.length})</p>
                        <span className="text-[10px] text-slate-400">Toca uno para usarlo aquí</span>
                    </div>
                    <div className="space-y-2">
                        {savedLoops.map(n => {
                            const dateLabel = new Date(n.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
                            const noteCount = n.loopPattern?.steps?.reduce((acc, row) => acc + (Array.isArray(row) ? row.filter(Boolean).length : 0), 0) ?? 0;
                            return (
                                <div key={n.id} className="flex items-center gap-2 bg-white/70 dark:bg-[#2a1620]/50 rounded-xl px-3 py-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{n.title || 'Sin título'}</p>
                                        <p className="text-[10px] text-slate-400">{n.loopPattern!.bpm} BPM · {noteCount} notas · {dateLabel}</p>
                                    </div>
                                    <button
                                        onClick={() => { setLoopPattern(n.loopPattern); setShowStudio(false); }}
                                        className="text-[10px] px-3 py-1.5 rounded-full bg-fuchsia-500 text-white font-bold shadow-sm active:scale-95"
                                    >
                                        Usar
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-3 italic">
                        💡 Los loops viven dentro de cada entrada. Para tener un nuevo loop guardado, crea una entrada con loop y guárdala.
                    </p>
                </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
                <button
                    onClick={handleSave}
                    disabled={!canSave || saving}
                    className="px-5 py-2.5 rounded-full bg-violet-500 hover:bg-violet-600 text-white font-bold text-sm shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    <span className="material-symbols-outlined text-base">save</span>
                    {saving ? 'Guardando…' : 'Guardar entrada'}
                </button>
            </div>
        </div>
    );
};
