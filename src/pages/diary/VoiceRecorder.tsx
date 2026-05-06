import React, { useEffect, useRef, useState } from 'react';
import type { VoiceClip } from '../../types';
import { formatDuration } from './diaryHelpers';

interface Props {
    onSave: (clip: VoiceClip) => void;
    /** Tope (ms). Por defecto 90 s. */
    maxDurationMs?: number;
}

// Tipos para SpeechRecognition (no están en TS lib por defecto)
type SpeechRecognitionLike = {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    onresult: (e: any) => void;
    onerror: (e: any) => void;
};

const getSpeechRecognition = (): (new () => SpeechRecognitionLike) | null => {
    const w = window as any;
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

export const VoiceRecorder: React.FC<Props> = ({ onSave, maxDurationMs = 90_000 }) => {
    const [recording, setRecording] = useState(false);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [enableTranscript, setEnableTranscript] = useState(true);

    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const startTimeRef = useRef<number>(0);
    const tickRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const waveformRef = useRef<number[]>([]);
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const transcriptRef = useRef<string>('');
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const cleanup = () => {
        if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
        try { recorderRef.current?.stop(); } catch {}
        recorderRef.current = null;
        try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
        streamRef.current = null;
        try { audioCtxRef.current?.close(); } catch {}
        audioCtxRef.current = null;
        analyserRef.current = null;
        try { recognitionRef.current?.stop(); } catch {}
        recognitionRef.current = null;
    };

    useEffect(() => () => cleanup(), []);

    const drawWaveform = () => {
        const canvas = canvasRef.current;
        const analyser = analyserRef.current;
        if (!canvas || !analyser) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
        const h = canvas.height = canvas.clientHeight * (window.devicePixelRatio || 1);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteTimeDomainData(buf);

        // sample 32 bins for waveform memory
        const stride = Math.floor(buf.length / 32) || 1;
        let peak = 0;
        for (let i = 0; i < buf.length; i += stride) {
            peak = Math.max(peak, Math.abs(buf[i] - 128) / 128);
        }
        waveformRef.current.push(Math.min(1, peak));
        if (waveformRef.current.length > 64) waveformRef.current.shift();

        ctx.clearRect(0, 0, w, h);
        const wf = waveformRef.current;
        const barW = w / Math.max(wf.length, 1);
        ctx.fillStyle = '#ec4899';
        for (let i = 0; i < wf.length; i++) {
            const barH = wf[i] * h * 0.9;
            ctx.fillRect(i * barW, (h - barH) / 2, barW * 0.6, barH);
        }
    };

    const startRecording = async () => {
        setError(null);
        waveformRef.current = [];
        transcriptRef.current = '';
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const recorder = new MediaRecorder(stream);
            recorderRef.current = recorder;
            chunksRef.current = [];
            recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            recorder.start();

            // Análisis para forma de onda
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioCtxRef.current = audioCtx;
            const src = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            src.connect(analyser);
            analyserRef.current = analyser;

            // Speech recognition (opcional)
            if (enableTranscript) {
                const SR = getSpeechRecognition();
                if (SR) {
                    const r = new SR();
                    r.continuous = true;
                    r.interimResults = false;
                    r.lang = 'es-ES';
                    r.onresult = (e: any) => {
                        for (let i = e.resultIndex; i < e.results.length; i++) {
                            if (e.results[i].isFinal) {
                                transcriptRef.current += (transcriptRef.current ? ' ' : '') + e.results[i][0].transcript.trim();
                            }
                        }
                    };
                    r.onerror = () => { /* silent */ };
                    try { r.start(); recognitionRef.current = r; } catch {}
                }
            }

            startTimeRef.current = Date.now();
            setRecording(true);
            setElapsedMs(0);

            tickRef.current = window.setInterval(() => {
                const ms = Date.now() - startTimeRef.current;
                setElapsedMs(ms);
                drawWaveform();
                if (ms >= maxDurationMs) stopRecording();
            }, 80);
        } catch (e: any) {
            setError('No pude acceder al micrófono. Revisa los permisos.');
            console.error(e);
        }
    };

    const stopRecording = () => {
        if (!recorderRef.current) return;
        const recorder = recorderRef.current;
        const durationMs = Date.now() - startTimeRef.current;

        recorder.onstop = async () => {
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

            // Reject if too small (clicked record/stop too fast)
            if (blob.size < 1000) {
                setError('La grabación fue muy corta. Intenta de nuevo.');
                cleanup();
                setRecording(false);
                setElapsedMs(0);
                return;
            }

            const dataUrl = await blobToDataUrl(blob);
            const wf = waveformRef.current.slice(-32);
            // Pad to 32
            while (wf.length < 32) wf.unshift(0);

            onSave({
                dataUrl,
                durationMs,
                transcript: transcriptRef.current || undefined,
                waveform: wf,
            });

            cleanup();
            setRecording(false);
            setElapsedMs(0);
        };
        recorder.stop();
    };

    const cancel = () => {
        cleanup();
        setRecording(false);
        setElapsedMs(0);
        chunksRef.current = [];
    };

    return (
        <div className="rounded-2xl bg-white dark:bg-[#2d1820] border border-slate-100 dark:border-[#5a2b35]/30 p-4">
            {!recording ? (
                <div className="flex flex-col items-center gap-3">
                    <button
                        onClick={startRecording}
                        className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-lg flex items-center justify-center transition-all active:scale-95"
                        title="Grabar memo de voz"
                    >
                        <span className="material-symbols-outlined text-3xl">mic</span>
                    </button>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Toca para empezar a grabar</p>
                    <label className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={enableTranscript}
                            onChange={e => setEnableTranscript(e.target.checked)}
                            className="accent-rose-400"
                        />
                        Transcribir mientras hablo (si tu navegador lo soporta)
                    </label>
                    {error && <p className="text-xs text-rose-500">{error}</p>}
                </div>
            ) : (
                <div className="flex flex-col items-center gap-3">
                    <div className="w-full h-16 rounded-xl bg-rose-50 dark:bg-rose-900/20 overflow-hidden">
                        <canvas ref={canvasRef} className="w-full h-full" />
                    </div>
                    <div className="flex items-center gap-3 text-sm font-mono text-rose-500">
                        <span className="w-2 h-2 rounded-full bg-rose-500 diary-pulse-rec" />
                        {formatDuration(elapsedMs)} <span className="text-slate-400 text-xs">/ {formatDuration(maxDurationMs)}</span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={cancel}
                            className="px-4 py-2 rounded-full text-xs font-bold bg-slate-100 dark:bg-[#3a2028] text-slate-500"
                        >Cancelar</button>
                        <button
                            onClick={stopRecording}
                            className="px-4 py-2 rounded-full text-xs font-bold bg-rose-500 text-white"
                        >Guardar memo</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
});

interface PlayerProps {
    clip: VoiceClip;
    compact?: boolean;
}

export const VoiceClipPlayer: React.FC<PlayerProps> = ({ clip, compact }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);

    const toggle = () => {
        const a = audioRef.current;
        if (!a) return;
        if (playing) { a.pause(); }
        else { a.play(); }
    };

    return (
        <div className={`flex items-center gap-3 ${compact ? '' : 'p-3 rounded-xl bg-violet-50 dark:bg-violet-900/15'}`}>
            <button
                onClick={toggle}
                className="w-10 h-10 rounded-full bg-violet-500 hover:bg-violet-600 text-white flex items-center justify-center flex-shrink-0"
            >
                <span className="material-symbols-outlined text-xl">{playing ? 'pause' : 'play_arrow'}</span>
            </button>
            <div className="flex-1 min-w-0">
                <div className="flex items-end gap-[2px] h-7">
                    {(clip.waveform || []).map((v, i) => {
                        const active = i / (clip.waveform!.length) <= progress;
                        return (
                            <div
                                key={i}
                                className={`flex-1 rounded-sm transition-colors ${active ? 'bg-violet-500' : 'bg-violet-200 dark:bg-violet-900/40'}`}
                                style={{ height: `${Math.max(8, v * 100)}%` }}
                            />
                        );
                    })}
                </div>
                <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-slate-400 font-mono">{formatDuration(clip.durationMs)}</span>
                    {clip.transcript && (
                        <span className="text-[10px] text-violet-500 font-bold">📝 transcrito</span>
                    )}
                </div>
            </div>
            <audio
                ref={audioRef}
                src={clip.dataUrl}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => { setPlaying(false); setProgress(0); }}
                onTimeUpdate={e => {
                    const t = e.currentTarget;
                    setProgress(t.currentTime / (t.duration || 1));
                }}
            />
        </div>
    );
};
