import React, { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import type { AmbientType } from '../../types';

interface Props {
    value: AmbientType;
    onChange: (v: AmbientType) => void;
    /** Volumen en dB. Default -18. */
    volumeDb?: number;
}

const AMBIENTS: { id: Exclude<AmbientType, null>; label: string; icon: string; color: string }[] = [
    { id: 'rain', label: 'Lluvia',  icon: 'rainy_light', color: 'from-sky-200 to-pink-200' },
    { id: 'cafe', label: 'Café',    icon: 'local_cafe',  color: 'from-amber-200 to-rose-200' },
    { id: 'wind', label: 'Viento',  icon: 'air',         color: 'from-violet-200 to-pink-200' },
];

/**
 * Reproduce ambientes sintetizados con Tone.js — sin audio externo.
 * - Lluvia: noise rosa filtrado.
 * - Café: noise marrón + leve LFO (rumor humano).
 * - Viento: noise blanco filtrado pasa-bajos modulado.
 */
export const AmbientPlayer: React.FC<Props> = ({ value, onChange, volumeDb = -18 }) => {
    const nodesRef = useRef<{ source?: Tone.Noise; filter?: Tone.Filter; lfo?: Tone.LFO; volume?: Tone.Volume } | null>(null);

    const stop = () => {
        const n = nodesRef.current;
        if (!n) return;
        try { n.lfo?.stop(); n.lfo?.dispose(); } catch {}
        try { n.source?.stop(); n.source?.dispose(); } catch {}
        try { n.filter?.dispose(); } catch {}
        try { n.volume?.dispose(); } catch {}
        nodesRef.current = null;
    };

    useEffect(() => {
        return () => stop();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        let cancelled = false;
        stop();
        if (!value) return;

        (async () => {
            await Tone.start();
            if (cancelled) return;

            const volume = new Tone.Volume(volumeDb).toDestination();
            let source: Tone.Noise;
            let filter: Tone.Filter;
            let lfo: Tone.LFO | undefined;

            if (value === 'rain') {
                source = new Tone.Noise('pink');
                filter = new Tone.Filter(2400, 'lowpass');
                source.connect(filter);
                filter.connect(volume);
                source.start();
            } else if (value === 'cafe') {
                source = new Tone.Noise('brown');
                filter = new Tone.Filter(1200, 'lowpass');
                source.connect(filter);
                filter.connect(volume);
                source.start();
                lfo = new Tone.LFO(0.15, 800, 1500).start();
                lfo.connect(filter.frequency);
            } else { // wind
                source = new Tone.Noise('white');
                filter = new Tone.Filter(600, 'lowpass');
                source.connect(filter);
                filter.connect(volume);
                source.start();
                lfo = new Tone.LFO(0.08, 300, 900).start();
                lfo.connect(filter.frequency);
            }

            nodesRef.current = { source, filter, lfo, volume };
        })();

        return () => { cancelled = true; };
    }, [value, volumeDb]);

    const [hint, setHint] = useState(false);

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">Ambiente</span>
            <div className="flex gap-2 flex-wrap">
                {AMBIENTS.map(a => (
                    <button
                        key={a.id}
                        onClick={() => {
                            onChange(value === a.id ? null : a.id);
                            setHint(true);
                            setTimeout(() => setHint(false), 1500);
                        }}
                        className={`text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-1 transition-all
                            ${value === a.id
                                ? `bg-gradient-to-br ${a.color} text-slate-700 shadow-sm scale-105`
                                : 'bg-slate-100 dark:bg-[#3a2028] text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#4a2832]'
                            }`}
                    >
                        <span className="material-symbols-outlined text-base leading-none">{a.icon}</span>
                        {a.label}
                    </button>
                ))}
                {value && (
                    <button
                        onClick={() => onChange(null)}
                        className="text-xs px-2 py-1.5 rounded-full text-slate-400 hover:text-rose-400"
                        title="Apagar ambiente"
                    >
                        <span className="material-symbols-outlined text-base leading-none">stop_circle</span>
                    </button>
                )}
            </div>
            {hint && value && (
                <span className="text-[10px] text-slate-400 italic">Sonando…</span>
            )}
        </div>
    );
};
