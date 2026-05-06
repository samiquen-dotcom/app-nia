import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { DiaryNote, NoteContext, AmbientType } from '../../types';
import { renderLightMarkdown, TYPE_META } from './diaryHelpers';
import { getDailyPrompt } from './dailyPrompts';
import { AmbientPlayer } from './AmbientPlayer';
import type { PhaseType } from '../../utils/cycleLogic';

interface Props {
    context: NoteContext;
    onSave: (note: Omit<DiaryNote, 'id' | 'createdAt'>) => Promise<void>;
}

type SpeechRecognitionLike = {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    onresult: (e: any) => void;
    onerror: (e: any) => void;
    onend: () => void;
};

const getSpeechRecognition = (): (new () => SpeechRecognitionLike) | null => {
    const w = window as any;
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

export const ThinkMode: React.FC<Props> = ({ context, onSave }) => {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [tagInput, setTagInput] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [ambient, setAmbient] = useState<AmbientType>(null);
    const [serif, setSerif] = useState(true);
    const [focus, setFocus] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [saving, setSaving] = useState(false);
    const [savedFlash, setSavedFlash] = useState(false);

    const [dictating, setDictating] = useState(false);
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

    const prompt = useMemo(
        () => getDailyPrompt(
            (context.cyclePhase as PhaseType) || null,
            context.sleepHours,
            context.energy,
        ),
        [context.cyclePhase, context.sleepHours, context.energy],
    );

    const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;

    const insertAtCursor = (text: string) => {
        setBody(b => b + (b && !b.endsWith('\n') ? '\n' : '') + text);
    };

    const toggleDictate = () => {
        if (dictating) {
            try { recognitionRef.current?.stop(); } catch {}
            setDictating(false);
            return;
        }
        const SR = getSpeechRecognition();
        if (!SR) {
            alert('Tu navegador no soporta dictado por voz. Prueba Chrome o Edge.');
            return;
        }
        const r = new SR();
        r.continuous = true;
        r.interimResults = false;
        r.lang = 'es-ES';
        r.onresult = (e: any) => {
            for (let i = e.resultIndex; i < e.results.length; i++) {
                if (e.results[i].isFinal) {
                    const t = e.results[i][0].transcript.trim();
                    setBody(b => (b ? b + ' ' : '') + t);
                }
            }
        };
        r.onerror = () => { setDictating(false); };
        r.onend = () => { setDictating(false); };
        try { r.start(); recognitionRef.current = r; setDictating(true); } catch {}
    };

    useEffect(() => () => {
        try { recognitionRef.current?.stop(); } catch {}
    }, []);

    const addTag = () => {
        const t = tagInput.trim().toLowerCase().replace(/^#/, '');
        if (!t) return;
        if (!tags.includes(t)) setTags([...tags, t]);
        setTagInput('');
    };

    const usePrompt = () => {
        if (!body.includes(prompt)) {
            setBody(`> ${prompt}\n\n` + body);
        }
    };

    const handleSave = async () => {
        if (!body.trim()) return;
        setSaving(true);
        try {
            await onSave({
                type: 'thought',
                title: title.trim() || undefined,
                body: body.trim(),
                tags,
                ambient,
                context,
                updatedAt: Date.now(),
            });
            setBody('');
            setTitle('');
            setTags([]);
            setSavedFlash(true);
            setTimeout(() => setSavedFlash(false), 1800);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={`space-y-4 ${focus ? 'min-h-[80vh]' : ''}`}>
            {/* Prompt del día */}
            {!focus && (
                <button
                    onClick={usePrompt}
                    className="w-full text-left rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 dark:from-[#2a1620] dark:to-[#221219] border border-rose-100 dark:border-rose-900/30 p-4 hover:shadow-sm transition-shadow"
                >
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-rose-400 text-base">auto_awesome</span>
                        <span className="text-[10px] uppercase tracking-wider font-bold text-rose-500/80">Para hoy</span>
                        {context.cyclePhase && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-500 font-bold">
                                Fase {context.cyclePhase.toLowerCase()}
                            </span>
                        )}
                    </div>
                    <p className="font-serif-diary text-base text-slate-700 dark:text-slate-100 leading-snug">
                        "{prompt}"
                    </p>
                    <p className="text-[10px] text-slate-400 mt-2">Tócame para usar este prompt como inicio.</p>
                </button>
            )}

            {/* Editor */}
            <div className="rounded-2xl diary-paper border border-rose-100/70 dark:border-rose-900/30 overflow-hidden shadow-sm">
                {/* Toolbar superior */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-rose-100/50 dark:border-rose-900/20 bg-white/50 dark:bg-[#1a0d10]/50">
                    <div className="flex items-center gap-1">
                        <ToolbarBtn icon="format_bold"   onClick={() => insertAtCursor('**texto**')} />
                        <ToolbarBtn icon="format_italic" onClick={() => insertAtCursor('*texto*')} />
                        <ToolbarBtn icon="format_quote"  onClick={() => insertAtCursor('> ')} />
                        <ToolbarBtn icon="list"          onClick={() => insertAtCursor('- ')} />
                        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
                        <ToolbarBtn
                            icon={dictating ? 'mic' : 'mic_none'}
                            onClick={toggleDictate}
                            active={dictating}
                            title="Dictar (voz a texto)"
                        />
                        <ToolbarBtn
                            icon={serif ? 'text_fields' : 'edit'}
                            onClick={() => setSerif(s => !s)}
                            title="Cambiar tipografía"
                        />
                        <ToolbarBtn
                            icon={focus ? 'fullscreen_exit' : 'center_focus_strong'}
                            onClick={() => setFocus(f => !f)}
                            title="Modo enfoque"
                        />
                    </div>
                    <button
                        onClick={() => setShowPreview(p => !p)}
                        className="text-[10px] uppercase tracking-wider font-bold text-rose-400 hover:text-rose-500"
                    >
                        {showPreview ? 'Editar' : 'Vista previa'}
                    </button>
                </div>

                {/* Título opcional */}
                <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Título (opcional)"
                    className={`w-full bg-transparent px-5 pt-4 pb-2 outline-none text-lg font-bold text-slate-700 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 ${serif ? 'font-serif-diary' : ''}`}
                />

                {/* Textarea o preview */}
                {showPreview ? (
                    <div
                        className={`px-5 pb-4 min-h-[260px] text-slate-700 dark:text-slate-200 ${serif ? 'font-serif-diary text-[18px] leading-relaxed' : 'text-[15px] leading-relaxed'}`}
                        dangerouslySetInnerHTML={{ __html: renderLightMarkdown(body || '_(vacío)_') }}
                    />
                ) : (
                    <textarea
                        value={body}
                        onChange={e => setBody(e.target.value)}
                        placeholder={dictating ? 'Habla, te estoy escuchando…' : 'Escribe libre. **Negrita**, *cursiva*, > cita, - lista.'}
                        rows={focus ? 18 : 10}
                        className={`diary-editor w-full bg-transparent px-5 pb-5 outline-none resize-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 ${serif ? 'font-serif-diary text-[18px] leading-relaxed' : 'text-[15px] leading-relaxed'}`}
                    />
                )}

                {/* Footer del editor */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-rose-100/50 dark:border-rose-900/20 bg-white/40 dark:bg-[#1a0d10]/40 text-[10px] text-slate-400 dark:text-slate-500">
                    <div className="flex items-center gap-3">
                        <span>{wordCount} {wordCount === 1 ? 'palabra' : 'palabras'}</span>
                        {context.moodEmoji && (
                            <span title={`Ánimo: ${context.moodLabel}`}>{context.moodEmoji} {context.moodLabel}</span>
                        )}
                        {context.energy && (
                            <span className="capitalize">⚡ {context.energy}</span>
                        )}
                    </div>
                    {savedFlash && (
                        <span className="text-rose-500 font-bold">Guardado ✨</span>
                    )}
                </div>
            </div>

            {/* Tags + ambiente + guardar */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">Etiquetas</span>
                    {tags.map(t => (
                        <button
                            key={t}
                            onClick={() => setTags(tags.filter(x => x !== t))}
                            className="text-xs bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300 px-2.5 py-1 rounded-full font-bold flex items-center gap-1"
                        >
                            #{t} <span className="text-rose-400">×</span>
                        </button>
                    ))}
                    <input
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                        placeholder="añadir #etiqueta"
                        className="text-xs bg-slate-50 dark:bg-[#3a2028] border border-slate-200 dark:border-[#5a2b35]/40 rounded-full px-3 py-1 outline-none w-32 focus:border-rose-300"
                    />
                </div>

                <AmbientPlayer value={ambient} onChange={setAmbient} />

                <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                        onClick={handleSave}
                        disabled={!body.trim() || saving}
                        className="px-5 py-2.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-base">{TYPE_META.thought.icon}</span>
                        {saving ? 'Guardando…' : 'Guardar pensamiento'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ToolbarBtn: React.FC<{ icon: string; onClick: () => void; active?: boolean; title?: string }> = ({ icon, onClick, active, title }) => (
    <button
        type="button"
        onClick={onClick}
        title={title}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors
            ${active ? 'bg-rose-100 text-rose-500 dark:bg-rose-900/30 dark:text-rose-300' : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20'}`}
    >
        <span className="material-symbols-outlined text-lg">{icon}</span>
    </button>
);
