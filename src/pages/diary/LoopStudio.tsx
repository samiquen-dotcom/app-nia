import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as Tone from 'tone';
import type { LoopPattern } from '../../types';

interface Props {
    value?: LoopPattern;
    onChange: (p: LoopPattern | undefined) => void;
}

// 8 pads × 32 pasos. Cada pad es un sonido sintetizado.
const PADS = [
    { id: 0, name: 'Kick',  emoji: '💗', color: 'bg-rose-500',     dim: 'bg-rose-200 dark:bg-rose-900/30' },
    { id: 1, name: 'Snare', emoji: '⚡', color: 'bg-pink-500',     dim: 'bg-pink-200 dark:bg-pink-900/30' },
    { id: 2, name: 'Hat',   emoji: '✨', color: 'bg-amber-400',    dim: 'bg-amber-200 dark:bg-amber-900/30' },
    { id: 3, name: 'Clap',  emoji: '👏', color: 'bg-orange-400',   dim: 'bg-orange-200 dark:bg-orange-900/30' },
    { id: 4, name: 'Bass',  emoji: '🌊', color: 'bg-indigo-500',   dim: 'bg-indigo-200 dark:bg-indigo-900/30' },
    { id: 5, name: 'Pad',   emoji: '🌙', color: 'bg-violet-400',   dim: 'bg-violet-200 dark:bg-violet-900/30' },
    { id: 6, name: 'Bell',  emoji: '🔔', color: 'bg-fuchsia-400',  dim: 'bg-fuchsia-200 dark:bg-fuchsia-900/30' },
    { id: 7, name: 'Vocal', emoji: '🌸', color: 'bg-purple-400',   dim: 'bg-purple-200 dark:bg-purple-900/30' },
];

const PADS_COUNT = PADS.length; // 8
const STEPS = 32;
const DEFAULT_BPM = 88;

// ─── Presets profesionales ───────────────────────────────────────────────────
type PresetSpec = {
    name: string;
    emoji: string;
    desc: string;
    bpm: number;
    swing?: number;
    reverbWet?: number;
    pattern: number[][];
};
const PRESETS: PresetSpec[] = [
    {
        name: 'Lo-fi Calma', emoji: '☕', desc: 'Para escribir de noche',
        bpm: 78, swing: 0.18, reverbWet: 0.4,
        pattern: [
            [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
            [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
            [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
            [1,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
            [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,0,0],
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
        ],
    },
    {
        name: 'Pop Ligero', emoji: '🌸', desc: 'Día con energía suave',
        bpm: 100, swing: 0, reverbWet: 0.18,
        pattern: [
            [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
            [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
            [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
            [0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0],
            [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
            [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
            [0,0,0,0, 0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1, 0,0,0,0],
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
        ],
    },
    {
        name: 'Trap Soft', emoji: '💜', desc: 'Lento, hi-hats rápidos',
        bpm: 72, swing: 0, reverbWet: 0.3,
        pattern: [
            [1,0,0,0, 0,0,0,0, 0,0,0,1, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
            [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
            [1,0,1,0, 1,1,1,0, 1,0,1,0, 1,0,1,1, 1,0,1,0, 1,0,1,0, 1,0,1,0, 1,1,1,0],
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
            [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
            [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
        ],
    },
    {
        name: 'Cumbia Chill', emoji: '🌊', desc: 'Patrón latino suave',
        bpm: 92, swing: 0, reverbWet: 0.22,
        pattern: [
            [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
            [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
            [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0],
            [1,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
            [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
            [0,0,0,1, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,0, 0,0,0,0],
            [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
        ],
    },
    {
        name: 'House Rosa', emoji: '🪩', desc: 'Bombo en cada beat',
        bpm: 118, swing: 0, reverbWet: 0.2,
        pattern: [
            [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
            [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
            [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0],
            [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0],
        ],
    },
    {
        name: 'Reggaetón Soft', emoji: '🌺', desc: 'Dembow gentil',
        bpm: 90, swing: 0, reverbWet: 0.2,
        pattern: [
            [1,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0],
            [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
            [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
            [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
            [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
            [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0],
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
        ],
    },
    {
        name: 'Bolero Lento', emoji: '🌹', desc: 'Sentimental, cadencia 3/4 feel',
        bpm: 64, swing: 0.1, reverbWet: 0.45,
        pattern: [
            [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0],
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
            [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
            [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
            [0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0],
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
        ],
    },
    {
        name: 'Indie Soñador', emoji: '🌙', desc: 'Espacioso con campanas',
        bpm: 84, swing: 0.1, reverbWet: 0.5,
        pattern: [
            [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
            [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
            [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1],
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
            [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
            [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,0,1, 0,0,0,0, 1,0,0,0, 0,0,0,0],
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0],
        ],
    },
];

const emptyPattern = (): LoopPattern => ({
    bpm: DEFAULT_BPM,
    steps: Array.from({ length: PADS_COUNT }, () => Array(STEPS).fill(false)),
    volumes: Array(PADS_COUNT).fill(0.8),
    mutes: Array(PADS_COUNT).fill(false),
    swing: 0,
    reverbWet: 0.25,
    masterDb: -3,
});

/**
 * Normaliza un patrón viejo (4 pads × 16 pasos) o incompleto al formato actual
 * (8 pads × 32 pasos). Mantiene compatibilidad sin romper loops guardados.
 */
const normalize = (input?: LoopPattern): LoopPattern => {
    const base = emptyPattern();
    if (!input) return base;
    const result: LoopPattern = {
        bpm: input.bpm || base.bpm,
        steps: base.steps.map((row, padIdx) => {
            const src = input.steps?.[padIdx];
            if (!src) return row;
            return row.map((_, stepIdx) => Boolean(src[stepIdx]));
        }),
        volumes: base.volumes!.map((v, i) => input.volumes?.[i] ?? v),
        mutes: base.mutes!.map((m, i) => input.mutes?.[i] ?? m),
        swing: input.swing ?? base.swing,
        reverbWet: input.reverbWet ?? base.reverbWet,
        masterDb: input.masterDb ?? base.masterDb,
    };
    return result;
};

const fromPreset = (p: PresetSpec): LoopPattern => ({
    ...emptyPattern(),
    bpm: p.bpm,
    swing: p.swing ?? 0,
    reverbWet: p.reverbWet ?? 0.25,
    steps: p.pattern.map(row => row.map(v => v === 1)),
});

type PanelView = null | 'mixer' | 'master' | 'presets';

export const LoopStudio: React.FC<Props> = ({ value, onChange }) => {
    const [pattern, setPattern] = useState<LoopPattern>(() => normalize(value));
    const [playing, setPlaying] = useState(false);
    const [currentStep, setCurrentStep] = useState(-1);
    const [panel, setPanel] = useState<PanelView>(null);

    const synthsRef = useRef<{
        kick?: Tone.MembraneSynth;
        snare?: Tone.NoiseSynth;
        snareBody?: Tone.MembraneSynth;
        hat?: Tone.MetalSynth;
        clap?: Tone.NoiseSynth;
        bass?: Tone.MonoSynth;
        pad?: Tone.PolySynth;
        bell?: Tone.MetalSynth;
        vocal?: Tone.PolySynth;
        channels?: Tone.Channel[];
        reverb?: Tone.Reverb;
        master?: Tone.Volume;
        seq?: Tone.Sequence;
    } | null>(null);

    const patternRef = useRef(pattern);
    patternRef.current = pattern;

    // ─── Inicialización de synths ────────────────────────────────────────────
    useEffect(() => {
        const master = new Tone.Volume(pattern.masterDb ?? -3).toDestination();
        const reverb = new Tone.Reverb({ decay: 2.4, wet: pattern.reverbWet ?? 0.25 }).connect(master);

        // Channel por pad para ruteo de volumen independiente
        const channels: Tone.Channel[] = Array.from({ length: PADS_COUNT }, (_, i) => {
            const ch = new Tone.Channel({ volume: gainToDb(pattern.volumes?.[i] ?? 0.8), mute: pattern.mutes?.[i] ?? false });
            ch.connect(reverb);
            return ch;
        });

        const kick = new Tone.MembraneSynth({
            pitchDecay: 0.04, octaves: 6,
            oscillator: { type: 'sine' },
            envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.4 },
        }).connect(channels[0]);

        const snare = new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.18 },
            volume: -8,
        }).connect(channels[1]);
        const snareBody = new Tone.MembraneSynth({
            pitchDecay: 0.02, octaves: 4,
            envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.05 },
            volume: -16,
        }).connect(channels[1]);

        const hat = new Tone.MetalSynth({
            envelope: { attack: 0.001, decay: 0.08, release: 0.04 },
            harmonicity: 5.1, modulationIndex: 32,
            resonance: 4000, octaves: 1.5,
            volume: -24,
        }).connect(channels[2]);

        const clap = new Tone.NoiseSynth({
            noise: { type: 'pink' },
            envelope: { attack: 0.005, decay: 0.18, sustain: 0, release: 0.15 },
            volume: -10,
        }).connect(channels[3]);

        const bass = new Tone.MonoSynth({
            oscillator: { type: 'sawtooth' },
            envelope: { attack: 0.01, decay: 0.4, sustain: 0.4, release: 0.6 },
            filter: { Q: 2, type: 'lowpass', rolloff: -24 },
            filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.6, baseFrequency: 200, octaves: 2.5 },
            volume: -10,
        }).connect(channels[4]);

        const pad = new Tone.PolySynth(Tone.AMSynth, {
            harmonicity: 1.2,
            envelope: { attack: 0.4, decay: 0.4, sustain: 0.5, release: 1.4 },
            volume: -16,
        }).connect(channels[5]);

        const bell = new Tone.MetalSynth({
            envelope: { attack: 0.001, decay: 1.2, release: 0.6 },
            harmonicity: 8, modulationIndex: 22,
            resonance: 8000, octaves: 0.8,
            volume: -22,
        }).connect(channels[6]);

        const vocal = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.04, decay: 0.2, sustain: 0.3, release: 0.6 },
            volume: -14,
        }).connect(channels[7]);

        synthsRef.current = { kick, snare, snareBody, hat, clap, bass, pad, bell, vocal, channels, reverb, master };

        return () => {
            try { synthsRef.current?.seq?.dispose(); } catch {}
            try {
                kick.dispose(); snare.dispose(); snareBody.dispose(); hat.dispose();
                clap.dispose(); bass.dispose(); pad.dispose(); bell.dispose(); vocal.dispose();
                channels.forEach(c => c.dispose());
                reverb.dispose(); master.dispose();
            } catch {}
            try { Tone.Transport.stop(); Tone.Transport.cancel(); } catch {}
            synthsRef.current = null;
        };
        // Deliberate one-time init: sliders mutate channels via separate effects.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─── Sliders → synths ────────────────────────────────────────────────────
    useEffect(() => { Tone.Transport.bpm.value = pattern.bpm; }, [pattern.bpm]);
    useEffect(() => { Tone.Transport.swing = pattern.swing ?? 0; Tone.Transport.swingSubdivision = '16n'; }, [pattern.swing]);
    useEffect(() => {
        const s = synthsRef.current;
        if (!s) return;
        if (s.reverb) s.reverb.wet.value = pattern.reverbWet ?? 0.25;
        if (s.master) s.master.volume.value = pattern.masterDb ?? -3;
    }, [pattern.reverbWet, pattern.masterDb]);
    useEffect(() => {
        const s = synthsRef.current;
        if (!s?.channels) return;
        for (let i = 0; i < PADS_COUNT; i++) {
            const v = pattern.volumes?.[i] ?? 0.8;
            const m = pattern.mutes?.[i] ?? false;
            s.channels[i].volume.value = gainToDb(v);
            s.channels[i].mute = m;
        }
    }, [pattern.volumes, pattern.mutes]);

    // ─── Acciones de patrón ──────────────────────────────────────────────────
    const toggleStep = (pad: number, step: number) => {
        setPattern(p => ({
            ...p,
            steps: p.steps.map((row, i) => i === pad ? row.map((s, j) => j === step ? !s : s) : row),
        }));
    };

    const toggleMute = (pad: number) => {
        setPattern(p => ({
            ...p,
            mutes: (p.mutes || Array(PADS_COUNT).fill(false)).map((m, i) => i === pad ? !m : m),
        }));
    };

    const setVolume = (pad: number, v: number) => {
        setPattern(p => ({
            ...p,
            volumes: (p.volumes || Array(PADS_COUNT).fill(0.8)).map((vol, i) => i === pad ? v : vol),
        }));
    };

    const startTransport = async () => {
        await Tone.start();
        const s = synthsRef.current;
        if (!s) return;

        try { s.seq?.dispose(); } catch {}

        const seq = new Tone.Sequence((time, stepIdx: number) => {
            const p = patternRef.current;
            if (p.steps[0]?.[stepIdx] && s.kick)       s.kick.triggerAttackRelease('C2', '8n', time);
            if (p.steps[1]?.[stepIdx] && s.snare)    { s.snare.triggerAttackRelease('16n', time); s.snareBody?.triggerAttackRelease('200', '16n', time, 0.6); }
            if (p.steps[2]?.[stepIdx] && s.hat)        s.hat.triggerAttackRelease('32n', time, 0.5);
            if (p.steps[3]?.[stepIdx] && s.clap)       s.clap.triggerAttackRelease('16n', time);
            if (p.steps[4]?.[stepIdx] && s.bass)       s.bass.triggerAttackRelease('A1', '4n', time);
            if (p.steps[5]?.[stepIdx] && s.pad)        s.pad.triggerAttackRelease(['C3', 'E3', 'G3'], '2n', time, 0.4);
            if (p.steps[6]?.[stepIdx] && s.bell)       s.bell.triggerAttackRelease('1024', '8n', time, 0.5);
            if (p.steps[7]?.[stepIdx] && s.vocal)      s.vocal.triggerAttackRelease(['F4', 'A4'], '8n', time, 0.6);

            Tone.Draw.schedule(() => setCurrentStep(stepIdx), time);
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
        setPattern(p => ({ ...emptyPattern(), bpm: p.bpm, masterDb: p.masterDb, reverbWet: p.reverbWet, swing: p.swing, volumes: p.volumes, mutes: p.mutes }));
    };

    const loadPreset = (preset: PresetSpec) => {
        stopTransport();
        const next = fromPreset(preset);
        // El preset trae bpm, patrón, swing y reverb de su personalidad.
        // Volúmenes, mutes y master los conserva del usuario.
        setPattern(p => ({ ...next, volumes: p.volumes, mutes: p.mutes, masterDb: p.masterDb }));
        setPanel(null);
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

    const noteCount = useMemo(() => pattern.steps.reduce((acc, row) => acc + row.filter(Boolean).length, 0), [pattern.steps]);

    return (
        <div className="rounded-2xl bg-gradient-to-br from-fuchsia-50 to-rose-50 dark:from-[#2a1620] dark:to-[#1f1118] border border-fuchsia-100 dark:border-fuchsia-900/30 p-3">
            {/* ── Header con BPM + acciones de panel ─────────────────────── */}
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-fuchsia-500">graphic_eq</span>
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">Loop Studio</h3>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                    <label className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 bg-white/60 dark:bg-[#2d1820] rounded-full px-2 py-1">
                        BPM
                        <input
                            type="number"
                            min={60} max={160}
                            value={pattern.bpm}
                            onChange={e => setPattern(p => ({ ...p, bpm: Math.max(60, Math.min(160, Number(e.target.value) || DEFAULT_BPM)) }))}
                            className="w-10 bg-transparent outline-none text-xs font-bold text-fuchsia-600 dark:text-fuchsia-300 text-center"
                        />
                    </label>
                    <PanelToggle icon="tune"      label="Mezcla"   active={panel === 'mixer'}   onClick={() => setPanel(panel === 'mixer' ? null : 'mixer')} />
                    <PanelToggle icon="settings"  label="Master"   active={panel === 'master'}  onClick={() => setPanel(panel === 'master' ? null : 'master')} />
                    <PanelToggle icon="library_music" label="Presets" active={panel === 'presets'} onClick={() => setPanel(panel === 'presets' ? null : 'presets')} />
                </div>
            </div>

            {/* ── Panel desplegable ──────────────────────────────────────── */}
            {panel === 'master' && (
                <MasterPanel
                    pattern={pattern}
                    onSwing={(v) => setPattern(p => ({ ...p, swing: v }))}
                    onReverb={(v) => setPattern(p => ({ ...p, reverbWet: v }))}
                    onMaster={(v) => setPattern(p => ({ ...p, masterDb: v }))}
                />
            )}

            {panel === 'presets' && (
                <PresetsPanel onPick={loadPreset} />
            )}

            {/* ── Grid de pads × pasos (con scroll horizontal en mobile) ── */}
            <div className="overflow-x-auto -mx-1 px-1">
                <div className="space-y-1" style={{ minWidth: 360 }}>
                    {/* Marca de compás (cada 4 pasos) */}
                    <div className="flex items-center gap-1 sticky top-0">
                        <div className="w-12 flex-shrink-0" />
                        <div className="flex-1 grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${STEPS}, minmax(0, 1fr))` }}>
                            {Array.from({ length: STEPS }).map((_, i) => (
                                <div key={i} className={`text-[8px] text-center font-mono ${i % 4 === 0 ? 'text-fuchsia-400 font-bold' : 'text-slate-300 dark:text-slate-600'}`}>
                                    {i % 4 === 0 ? Math.floor(i / 4) + 1 : '·'}
                                </div>
                            ))}
                        </div>
                    </div>
                    {PADS.map((pad) => {
                        const muted = pattern.mutes?.[pad.id] ?? false;
                        return (
                            <div key={pad.id} className="flex items-center gap-1">
                                <button
                                    onClick={() => toggleMute(pad.id)}
                                    className={`w-12 flex-shrink-0 flex items-center gap-1 px-1.5 py-1 rounded-md text-left transition-opacity
                                        ${muted ? 'opacity-30' : 'opacity-100'}
                                        hover:bg-white/50 dark:hover:bg-white/5`}
                                    title={muted ? 'Activar' : 'Mutear'}
                                >
                                    <span className="text-sm leading-none">{pad.emoji}</span>
                                    <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase">{pad.name}</span>
                                </button>
                                <div className="flex-1 grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${STEPS}, minmax(0, 1fr))` }}>
                                    {pattern.steps[pad.id].map((on, stepIdx) => {
                                        const isCurrent = stepIdx === currentStep;
                                        const beat = stepIdx % 4 === 0;
                                        const halfBar = stepIdx === STEPS / 2;
                                        return (
                                            <button
                                                key={stepIdx}
                                                onClick={() => toggleStep(pad.id, stepIdx)}
                                                className={`aspect-square min-h-[18px] rounded-sm transition-all
                                                    ${on ? `${pad.color} shadow-sm` : beat ? `${pad.dim}` : 'bg-white/40 dark:bg-white/5'}
                                                    ${muted && on ? 'opacity-40' : ''}
                                                    ${isCurrent ? 'ring-2 ring-pink-400 ring-offset-1 ring-offset-rose-50 dark:ring-offset-[#2a1620]' : ''}
                                                    ${halfBar ? 'border-l border-fuchsia-300/40' : ''}
                                                    hover:opacity-90
                                                `}
                                                aria-label={`${pad.name} step ${stepIdx + 1}`}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Mixer panel (debajo del grid) ─────────────────────────── */}
            {panel === 'mixer' && (
                <MixerPanel
                    pattern={pattern}
                    onVolume={setVolume}
                    onMute={toggleMute}
                />
            )}

            {/* ── Footer: transporte + guardar ─────────────────────────── */}
            <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
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
                    <span className="text-[10px] text-slate-400">{noteCount} notas · {STEPS / 16} compases</span>
                    <button
                        onClick={save}
                        disabled={noteCount === 0}
                        className="text-xs px-3 py-1.5 rounded-full bg-fuchsia-500 text-white font-bold disabled:opacity-40 shadow-sm"
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
        </div>
    );
};

// ─── Sub-paneles ─────────────────────────────────────────────────────────────

const PanelToggle: React.FC<{ icon: string; label: string; active: boolean; onClick: () => void }> = ({ icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1 transition-all
            ${active ? 'bg-fuchsia-500 text-white shadow-sm' : 'bg-white/70 dark:bg-[#2d1820] text-slate-500 dark:text-slate-400 hover:bg-white'}`}
    >
        <span className="material-symbols-outlined text-sm">{icon}</span>
        {label}
    </button>
);

const MixerPanel: React.FC<{
    pattern: LoopPattern;
    onVolume: (pad: number, v: number) => void;
    onMute: (pad: number) => void;
}> = ({ pattern, onVolume, onMute }) => (
    <div className="mt-2 mb-2 p-3 rounded-xl bg-white/70 dark:bg-[#1f1118]/80 border border-fuchsia-200/50 dark:border-fuchsia-900/30">
        <p className="text-[10px] uppercase tracking-wider font-bold text-fuchsia-500/80 mb-2">Mezcla</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            {PADS.map(pad => {
                const v = pattern.volumes?.[pad.id] ?? 0.8;
                const m = pattern.mutes?.[pad.id] ?? false;
                return (
                    <div key={pad.id} className="flex items-center gap-2">
                        <button
                            onClick={() => onMute(pad.id)}
                            className={`w-7 h-7 rounded-md flex items-center justify-center transition-opacity ${m ? 'opacity-30' : ''} hover:bg-slate-100 dark:hover:bg-[#3a2028]`}
                            title={m ? 'Activar' : 'Mutear'}
                        >
                            <span className="text-base">{pad.emoji}</span>
                        </button>
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 w-10">{pad.name}</span>
                        <input
                            type="range"
                            min={0} max={1} step={0.05}
                            value={v}
                            onChange={e => onVolume(pad.id, Number(e.target.value))}
                            className="flex-1 accent-fuchsia-500 h-1"
                            aria-label={`Volumen ${pad.name}`}
                        />
                        <span className="text-[9px] font-mono text-slate-400 w-7 text-right">{Math.round(v * 100)}%</span>
                    </div>
                );
            })}
        </div>
    </div>
);

const MasterPanel: React.FC<{
    pattern: LoopPattern;
    onSwing: (v: number) => void;
    onReverb: (v: number) => void;
    onMaster: (v: number) => void;
}> = ({ pattern, onSwing, onReverb, onMaster }) => (
    <div className="mt-2 mb-2 p-3 rounded-xl bg-white/70 dark:bg-[#1f1118]/80 border border-fuchsia-200/50 dark:border-fuchsia-900/30 space-y-2">
        <p className="text-[10px] uppercase tracking-wider font-bold text-fuchsia-500/80 mb-1">Master</p>
        <SliderRow
            label="Swing"  hint="Feel humano"
            value={pattern.swing ?? 0} min={0} max={0.3} step={0.02}
            onChange={onSwing}
            display={(v) => `${Math.round((v / 0.3) * 100)}%`}
        />
        <SliderRow
            label="Reverb" hint="Espacio del sonido"
            value={pattern.reverbWet ?? 0.25} min={0} max={0.7} step={0.02}
            onChange={onReverb}
            display={(v) => `${Math.round(v * 100)}%`}
        />
        <SliderRow
            label="Volumen" hint="Master"
            value={pattern.masterDb ?? -3} min={-30} max={6} step={1}
            onChange={onMaster}
            display={(v) => `${v >= 0 ? '+' : ''}${v} dB`}
        />
    </div>
);

const SliderRow: React.FC<{
    label: string; hint?: string;
    value: number; min: number; max: number; step: number;
    onChange: (v: number) => void;
    display: (v: number) => string;
}> = ({ label, hint, value, min, max, step, onChange, display }) => (
    <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 w-16">{label}</span>
        <input
            type="range" min={min} max={max} step={step} value={value}
            onChange={e => onChange(Number(e.target.value))}
            className="flex-1 accent-fuchsia-500 h-1"
        />
        <span className="text-[10px] font-mono text-slate-500 w-14 text-right">{display(value)}</span>
        {hint && <span className="text-[9px] text-slate-400 hidden sm:inline italic">{hint}</span>}
    </div>
);

const PresetsPanel: React.FC<{ onPick: (p: PresetSpec) => void }> = ({ onPick }) => (
    <div className="mt-2 mb-2 p-3 rounded-xl bg-white/70 dark:bg-[#1f1118]/80 border border-fuchsia-200/50 dark:border-fuchsia-900/30">
        <p className="text-[10px] uppercase tracking-wider font-bold text-fuchsia-500/80 mb-2">Presets — empieza con uno</p>
        <div className="grid grid-cols-2 gap-2">
            {PRESETS.map(p => (
                <button
                    key={p.name}
                    onClick={() => onPick(p)}
                    className="p-2.5 rounded-xl bg-gradient-to-br from-fuchsia-100 to-rose-100 dark:from-fuchsia-900/20 dark:to-rose-900/20 hover:shadow-sm hover:scale-[1.02] transition-all text-left"
                >
                    <div className="flex items-center justify-between">
                        <div className="text-xl">{p.emoji}</div>
                        <div className="text-[9px] font-mono text-fuchsia-500 bg-white/60 dark:bg-[#2d1820]/60 px-1.5 py-0.5 rounded-full">{p.bpm}</div>
                    </div>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-1">{p.name}</div>
                    <div className="text-[9px] text-slate-500 dark:text-slate-400 italic leading-tight mt-0.5">{p.desc}</div>
                </button>
            ))}
        </div>
        <p className="text-[9px] text-slate-400 mt-3 italic text-center">Reemplaza tu patrón. Mezcla y volumen master se conservan.</p>
    </div>
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convierte 0..1 en dB con curva logarítmica natural. */
const gainToDb = (g: number): number => {
    if (g <= 0.001) return -60;
    return 20 * Math.log10(g);
};

// ─── Preview compacto (en la tarjeta de la nota guardada) ───────────────────

interface PreviewProps {
    pattern: LoopPattern;
}

export const LoopPreview: React.FC<PreviewProps> = ({ pattern }) => {
    const normalized = useMemo(() => normalize(pattern), [pattern]);
    const noteCount = normalized.steps.reduce((acc, row) => acc + row.filter(Boolean).length, 0);
    const bars = STEPS / 16;
    return (
        <div className="rounded-xl bg-fuchsia-50 dark:bg-fuchsia-900/15 p-3 flex items-center gap-3">
            <span className="material-symbols-outlined text-fuchsia-500 text-2xl">graphic_eq</span>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Loop guardado</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {normalized.bpm} BPM · {noteCount} notas · {bars} {bars === 1 ? 'compás' : 'compases'}
                </p>
            </div>
            <div className="flex flex-col gap-[1px]">
                {normalized.steps.map((row, i) => (
                    <div key={i} className="flex gap-[1px]">
                        {row.filter((_, j) => j % 2 === 0).map((on, j) => (
                            <div
                                key={j}
                                className={`w-[2px] h-[2px] rounded-[1px] ${on ? 'bg-fuchsia-500' : 'bg-fuchsia-200 dark:bg-fuchsia-900/30'}`}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};
