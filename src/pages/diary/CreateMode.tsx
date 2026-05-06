import React, { useMemo, useState } from 'react';
import type { DiaryNote, NoteContext, AmbientType } from '../../types';
import { AmbientPlayer } from './AmbientPlayer';
import { buildSelfLetterTemplate, countSyllables } from './dailyPrompts';

interface Props {
    context: NoteContext;
    onSave: (note: Omit<DiaryNote, 'id' | 'createdAt'>) => Promise<void>;
}

type SubMode = 'letter' | 'self-letter' | 'poem';

const SUB_MODES: { id: SubMode; label: string; icon: string; desc: string; color: string }[] = [
    { id: 'letter',      label: 'Carta al futuro', icon: 'mail',          desc: 'Sella algo, ábrelo en la fecha que elijas.', color: 'amber' },
    { id: 'self-letter', label: 'Carta para mí',   icon: 'favorite',      desc: 'Plantilla con tu contexto del momento.',     color: 'rose' },
    { id: 'poem',        label: 'Poema / letra',   icon: 'format_quote',  desc: 'Modo escritura con conteo de sílabas.',       color: 'fuchsia' },
];

export const CreateMode: React.FC<Props> = ({ context, onSave }) => {
    const [subMode, setSubMode] = useState<SubMode>('letter');

    return (
        <div className="space-y-4">
            <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-rose-50 dark:from-[#2a1d12] dark:to-[#221219] border border-amber-100 dark:border-amber-900/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-amber-500 text-base">brush</span>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-amber-600/80">Crear</span>
                </div>
                <p className="font-serif-diary text-base text-slate-700 dark:text-slate-100 leading-snug">
                    Cosas que vale la pena guardar y volver a leer.
                </p>
            </div>

            {/* Sub-mode picker */}
            <div className="grid grid-cols-3 gap-2">
                {SUB_MODES.map(m => {
                    const active = subMode === m.id;
                    return (
                        <button
                            key={m.id}
                            onClick={() => setSubMode(m.id)}
                            className={`p-3 rounded-2xl border transition-all text-left
                                ${active
                                    ? `bg-${m.color}-100 dark:bg-${m.color}-900/30 border-${m.color}-300 dark:border-${m.color}-700/40 shadow-sm`
                                    : 'bg-white dark:bg-[#2d1820] border-slate-100 dark:border-[#5a2b35]/30 hover:border-slate-200'}`}
                        >
                            <span className={`material-symbols-outlined text-lg ${active ? `text-${m.color}-500` : 'text-slate-400'}`}>{m.icon}</span>
                            <p className={`text-xs font-bold mt-1 ${active ? `text-${m.color}-700 dark:text-${m.color}-200` : 'text-slate-600 dark:text-slate-300'}`}>{m.label}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{m.desc}</p>
                        </button>
                    );
                })}
            </div>

            {subMode === 'letter' && <SealedLetterForm context={context} onSave={onSave} />}
            {subMode === 'self-letter' && <SelfLetterForm context={context} onSave={onSave} />}
            {subMode === 'poem' && <PoemForm context={context} onSave={onSave} />}
        </div>
    );
};

// ─── Carta sellada ────────────────────────────────────────────────────────────

const minDateAfterToday = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
};

const SealedLetterForm: React.FC<Props> = ({ context, onSave }) => {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [unlockDate, setUnlockDate] = useState(minDateAfterToday(30));
    const [ambient, setAmbient] = useState<AmbientType>(null);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!body.trim()) return;
        setSaving(true);
        try {
            await onSave({
                type: 'letter',
                title: title.trim() || 'Carta sellada',
                body: body.trim(),
                unlockDate,
                isLocked: true,
                ambient,
                tags: ['carta'],
                context,
            });
            setBody('');
            setTitle('');
            alert('Carta sellada hasta el ' + new Date(unlockDate + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-3">
            <div className="rounded-2xl diary-paper border border-amber-100 dark:border-amber-900/20 p-5 shadow-sm relative overflow-hidden">
                <div className="absolute top-3 right-3 text-amber-300 dark:text-amber-700/40 text-3xl pointer-events-none">
                    <span className="material-symbols-outlined" style={{ fontSize: 56 }}>mail</span>
                </div>
                <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Para mí del futuro…"
                    className="w-full bg-transparent outline-none text-lg font-bold text-slate-700 dark:text-slate-100 placeholder:text-slate-300 mb-3 font-serif-diary"
                />
                <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    rows={10}
                    placeholder="Querida yo del futuro,&#10;&#10;Cuando leas esto…"
                    className="diary-editor w-full bg-transparent outline-none resize-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400 font-serif-diary text-[18px] leading-relaxed"
                />
            </div>

            <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-900/30 p-4 flex items-center gap-3">
                <span className="material-symbols-outlined text-amber-500">lock_clock</span>
                <div className="flex-1">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Abrir el</p>
                    <input
                        type="date"
                        value={unlockDate}
                        min={minDateAfterToday(1)}
                        onChange={e => setUnlockDate(e.target.value)}
                        className="bg-transparent outline-none text-sm font-bold text-amber-700 dark:text-amber-200 mt-1"
                    />
                </div>
                <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Faltan</p>
                    <p className="text-sm font-bold text-amber-600 dark:text-amber-300">
                        {Math.max(0, Math.round((new Date(unlockDate + 'T00:00:00').getTime() - Date.now()) / 86_400_000))} días
                    </p>
                </div>
            </div>

            <AmbientPlayer value={ambient} onChange={setAmbient} />

            <div className="flex items-center justify-end">
                <button
                    onClick={handleSave}
                    disabled={!body.trim() || saving}
                    className="px-5 py-2.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md disabled:opacity-40 flex items-center gap-2"
                >
                    <span className="material-symbols-outlined text-base">lock</span>
                    {saving ? 'Sellando…' : 'Sellar carta'}
                </button>
            </div>
        </div>
    );
};

// ─── Carta para mí (presente) ────────────────────────────────────────────────

const SelfLetterForm: React.FC<Props> = ({ context, onSave }) => {
    const initialBody = useMemo(() => buildSelfLetterTemplate({
        phase: context.cyclePhase,
        moodLabel: context.moodLabel,
        energy: context.energy,
    }), [context.cyclePhase, context.moodLabel, context.energy]);

    const [body, setBody] = useState(initialBody);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!body.trim()) return;
        setSaving(true);
        try {
            await onSave({
                type: 'letter',
                title: 'Carta para mí',
                body: body.trim(),
                tags: ['carta', 'yo'],
                context,
            });
            setBody(initialBody);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-3">
            <div className="rounded-2xl diary-paper border border-rose-100 dark:border-rose-900/20 p-5 shadow-sm">
                <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    rows={18}
                    className="diary-editor w-full bg-transparent outline-none resize-none text-slate-700 dark:text-slate-200 font-serif-diary text-[17px] leading-relaxed"
                />
            </div>
            <div className="flex items-center justify-between gap-2">
                <button
                    onClick={() => setBody(initialBody)}
                    className="text-xs text-slate-400 hover:text-rose-500 underline"
                >
                    Restaurar plantilla
                </button>
                <button
                    onClick={handleSave}
                    disabled={!body.trim() || saving}
                    className="px-5 py-2.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm shadow-md disabled:opacity-40"
                >
                    {saving ? 'Guardando…' : 'Guardar carta'}
                </button>
            </div>
        </div>
    );
};

// ─── Poema / Letras ──────────────────────────────────────────────────────────

const PoemForm: React.FC<Props> = ({ context, onSave }) => {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [saving, setSaving] = useState(false);
    const [showSyllables, setShowSyllables] = useState(true);

    const lines = body.split('\n');

    const handleSave = async () => {
        if (!body.trim()) return;
        setSaving(true);
        try {
            await onSave({
                type: 'poem',
                title: title.trim() || undefined,
                body,
                tags: ['poema'],
                context,
            });
            setBody('');
            setTitle('');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-3">
            <div className="rounded-2xl diary-paper border border-fuchsia-100 dark:border-fuchsia-900/20 p-5 shadow-sm">
                <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Título"
                    className="w-full bg-transparent outline-none text-xl font-bold text-slate-700 dark:text-slate-100 placeholder:text-slate-300 mb-3 font-serif-diary text-center"
                />
                <div className="grid grid-cols-[1fr_auto] gap-2 items-start">
                    <textarea
                        value={body}
                        onChange={e => setBody(e.target.value)}
                        rows={Math.max(10, lines.length + 2)}
                        placeholder={'Verso uno…\nVerso dos…\n\nNueva estrofa…'}
                        className="diary-editor bg-transparent outline-none resize-none text-slate-700 dark:text-slate-200 font-serif-diary text-[18px] leading-[2] text-center"
                        style={{ width: '100%' }}
                    />
                    {showSyllables && (
                        <div className="flex flex-col items-end gap-0 pt-[2px] text-[11px] text-fuchsia-400 font-mono leading-[2] select-none">
                            {lines.map((line, i) => (
                                <span key={i} className="h-[2em] flex items-center">
                                    {line.trim() ? countSyllables(line) : ''}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between">
                <label className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showSyllables}
                        onChange={e => setShowSyllables(e.target.checked)}
                        className="accent-fuchsia-400"
                    />
                    Mostrar conteo de sílabas
                </label>
                <button
                    onClick={handleSave}
                    disabled={!body.trim() || saving}
                    className="px-5 py-2.5 rounded-full bg-fuchsia-500 hover:bg-fuchsia-600 text-white font-bold text-sm shadow-md disabled:opacity-40"
                >
                    {saving ? 'Guardando…' : 'Guardar poema'}
                </button>
            </div>
        </div>
    );
};
