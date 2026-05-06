import React, { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import type { LoopPattern } from '../../types';

interface Props {
    value?: LoopPattern;
    onChange: (p: LoopPattern | undefined) => void;
}

// 4 pads × 16 pasos. Cada pad es un sonido sintetizado.
const PADS = [
    { id: 0, name: 'Kick',  emoji: '💗', color: 'bg-rose-400'    },
    { id: 1, name: 'Clap',  emoji: '✨', color: 'bg-pink-400'    },
    { id: 2, name: 'Vocal', emoji: '🌸', color: 'bg-fuchsia-400' },
    { id: 3, name: 'Pad',   emoji: '🌙', color: 'bg-violet-400'  },
];

const STEPS = 16;
const DEFAULT_BPM = 88;

const emptyPattern = (): LoopPattern => ({
    bpm: DEFAULT_BPM,
    steps: Array.from({ length: 4 }, () => Array(STEPS).fill(false)),
});

export const LoopStudio: React.FC<Props> = ({ value, onChange }) => {
    const [pattern, setPattern] = useState<LoopPattern>(value || emptyPattern());
    const [playing, setPlaying] = useState(false);
    const [currentStep, setCurrentStep] = useState(-1);
    const [flashKey, setFlashKey] = useState(0);

    const synthsRef = useRef<{
        kick?: Tone.MembraneSynth;
        clap?: Tone.NoiseSynth;
        vocal?: Tone.PolySynth;
        pad?: Tone.PolySynth;
        seq?: Tone.Sequence;
        reverb?: Tone.Reverb;
    } | null>(null);

    const patternRef = useRef(pattern);
    patternRef.current = pattern;

    // Init synths una sola vez
    useEffect(() => {
        const reverb = new Tone.Reverb({ decay: 2, wet: 0.25 }).toDestination();

        const kick = new Tone.MembraneSynth({
            pitchDecay: 0.04, octaves: 6,
            oscillator: { type: 'sine' },
            envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.4 },
            volume: -6,
        }).connect(reverb);

        const clap = new Tone.NoiseSynth({
            noise: { type: 'pink' },
            envelope: { attack: 0.005, decay: 0.18, sustain: 0, release: 0.15 },
            volume: -14,
        }).connect(reverb);

        const vocal = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.04, decay: 0.2, sustain: 0.3, release: 0.6 },
            volume: -16,
        }).connect(reverb);

        const pad = new Tone.PolySynth(Tone.AMSynth, {
            harmonicity: 1.2,
            envelope: { attack: 0.4, decay: 0.4, sustain: 0.5, release: 1.4 },
            volume: -22,
        }).connect(reverb);

        synthsRef.current = { kick, clap, vocal, pad, reverb };

        return () => {
            try { synthsRef.current?.seq?.dispose(); } catch {}
            try { kick.dispose(); clap.dispose(); vocal.dispose(); pad.dispose(); reverb.dispose(); } catch {}
            try { Tone.Transport.stop(); Tone.Transport.cancel(); } catch {}
            synthsRef.current = null;
        };
    }, []);

    // Mantener BPM sincronizado
    useEffect(() => {
        Tone.Transport.bpm.value = pattern.bpm;
    }, [pattern.bpm]);

    const toggleStep = (pad: number, step: number) => {
        const next: LoopPattern = {
            ...pattern,
            steps: pattern.steps.map((row, i) => i === pad ? row.map((s, j) => j === step ? !s : s) : row),
        };
        setPattern(next);
    };

    const startTransport = async () => {
        await Tone.start();
        const s = synthsRef.current;
        if (!s) return;

        try { s.seq?.dispose(); } catch {}

        const seq = new Tone.Sequence((time, stepIdx: number) => {
            const p = patternRef.current;
            if (p.steps[0][stepIdx]) s.kick?.triggerAttackRelease('C2', '8n', time);
            if (p.steps[1][stepIdx]) s.clap?.triggerAttackRelease('16n', time);
            if (p.steps[2][stepIdx]) s.vocal?.triggerAttackRelease(['F4', 'A4'], '8n', time, 0.6);
            if (p.steps[3][stepIdx]) s.pad?.triggerAttackRelease(['C3', 'E3', 'G3'], '2n', time, 0.4);

            Tone.Draw.schedule(() => {
                setCurrentStep(stepIdx);
                setFlashKey(k => k + 1);
            }, time);
        }, Array.from({ length: STEPS }, (_, i) => i), '16n');

        s.seq = seq;
        seq.start(0);
        Tone.Transport.start();
        setPlaying(true);
    };

    const stopTransport = () => {
        try {
            Tone.Transport.stop();
            Tone.Transport.cancel();
            synthsRef.current?.seq?.dispose();
            if (synthsRef.current) synthsRef.current.seq = undefined;
        } catch {}
        setPlaying(false);
        setCurrentStep(-1);
    };

    const togglePlay = () => playing ? stopTransport() : startTransport();

    const clearAll = () => {
        stopTransport();
        const cleared = emptyPattern();
        cleared.bpm = pattern.bpm;
        setPattern(cleared);
    };

    const setBpm = (bpm: number) => {
        setPattern(p => ({ ...p, bpm }));
    };

    const save = () => {
        stopTransport();
        const hasNotes = pattern.steps.some(row => row.some(s => s));
        onChange(hasNotes ? pattern : undefined);
    };

    const remove = () => {
        stopTransport();
        setPattern(emptyPattern());
        onChange(undefined);
    };

    const noteCount = pattern.steps.reduce((acc, row) => acc + row.filter(Boolean).length, 0);

    return (
        <div className="rounded-2xl bg-gradient-to-br from-fuchsia-50 to-rose-50 dark:from-[#2a1620] dark:to-[#1f1118] border border-fuchsia-100 dark:border-fuchsia-900/30 p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-fuchsia-500">graphic_eq</span>
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">Loop Studio</h3>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        BPM
                        <input
                            type="number"
                            min={60} max={160}
                            value={pattern.bpm}
                            onChange={e => setBpm(Math.max(60, Math.min(160, Number(e.target.value) || DEFAULT_BPM)))}
                            className="w-12 bg-white dark:bg-[#2d1820] border border-fuchsia-200 dark:border-fuchsia-900/30 rounded px-1 text-xs"
                        />
                    </label>
                </div>
            </div>

            {/* Grid de pads */}
            <div className="space-y-2">
                {PADS.map((pad) => (
                    <div key={pad.id} className="flex items-center gap-2">
                        <div className="w-14 flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                            <span className="text-base">{pad.emoji}</span>
                            <span>{pad.name}</span>
                        </div>
                        <div className="flex-1 grid grid-cols-16 gap-[3px]" style={{ gridTemplateColumns: `repeat(${STEPS}, minmax(0, 1fr))` }}>
                            {pattern.steps[pad.id].map((on, stepIdx) => {
                                const isCurrent = stepIdx === currentStep;
                                const beat = stepIdx % 4 === 0;
                                return (
                                    <button
                                        key={stepIdx}
                                        onClick={() => toggleStep(pad.id, stepIdx)}
                                        className={`aspect-square rounded transition-all
                                            ${on ? `${pad.color} shadow-sm` : beat ? 'bg-white/60 dark:bg-white/5' : 'bg-white/30 dark:bg-white/3'}
                                            ${on ? 'hover:opacity-90' : 'hover:bg-white/80 dark:hover:bg-white/10'}
                                            ${isCurrent ? 'ring-2 ring-pink-400' : ''}
                                        `}
                                        aria-label={`${pad.name} step ${stepIdx + 1}`}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between mt-4 gap-2">
                <div className="flex items-center gap-2">
                    <button
                        onClick={togglePlay}
                        className={`w-10 h-10 rounded-full text-white shadow-md flex items-center justify-center transition-all active:scale-95
                            ${playing ? 'bg-rose-500' : 'bg-fuchsia-500 hover:bg-fuchsia-600'}`}
                    >
                        <span className="material-symbols-outlined">{playing ? 'stop' : 'play_arrow'}</span>
                    </button>
                    <button
                        onClick={clearAll}
                        className="text-xs px-3 py-1.5 rounded-full bg-white/70 dark:bg-[#3a2028] text-slate-500 hover:bg-white"
                    >
                        Limpiar
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">{noteCount} notas</span>
                    <button
                        onClick={save}
                        disabled={noteCount === 0}
                        className="text-xs px-3 py-1.5 rounded-full bg-fuchsia-500 text-white font-bold disabled:opacity-40"
                    >
                        Guardar loop
                    </button>
                    {value && (
                        <button
                            onClick={remove}
                            className="text-[10px] text-rose-400 hover:underline"
                        >
                            Quitar
                        </button>
                    )}
                </div>
            </div>

            <span key={flashKey} className="hidden" />
        </div>
    );
};

interface PreviewProps {
    pattern: LoopPattern;
}

export const LoopPreview: React.FC<PreviewProps> = ({ pattern }) => {
    const noteCount = pattern.steps.reduce((acc, row) => acc + row.filter(Boolean).length, 0);
    return (
        <div className="rounded-xl bg-fuchsia-50 dark:bg-fuchsia-900/15 p-3 flex items-center gap-3">
            <span className="material-symbols-outlined text-fuchsia-500 text-2xl">graphic_eq</span>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Loop guardado</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{pattern.bpm} BPM · {noteCount} notas · 4 pads</p>
            </div>
            <div className="flex flex-col gap-[2px]">
                {pattern.steps.map((row, i) => (
                    <div key={i} className="flex gap-[1px]">
                        {row.map((on, j) => (
                            <div
                                key={j}
                                className={`w-[3px] h-[3px] rounded-[1px] ${on ? 'bg-fuchsia-500' : 'bg-fuchsia-200 dark:bg-fuchsia-900/30'}`}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};
