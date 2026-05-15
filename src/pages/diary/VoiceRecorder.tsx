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
    // Off por defecto: en Android Chrome, SpeechRecognition y MediaRecorder
    // chocan por acceso exclusivo al micrófono. La usuaria puede activarlo
    // explícitamente si su navegador lo soporta sin conflicto (Chrome Desktop).
    const [enableTranscript, setEnableTranscript] = useState(false);
    const [transcriptInfo, setTranscriptInfo] = useState<string | null>(null);

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

        const dpr = window.devicePixelRatio || 1;
        const w = canvas.width = canvas.clientWidth * dpr;
        const h = canvas.height = canvas.clientHeight * dpr;

        const freq = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(freq);

        const BARS = 32;
        const stride = Math.max(1, Math.floor(freq.length / BARS));
        const bars: number[] = [];
        for (let i = 0; i < BARS; i++) {
            let sum = 0;
            for (let j = 0; j < stride; j++) sum += freq[i * stride + j] || 0;
            // Amplificar 1.6x — voz normal queda visible. Cap a 1.
            bars.push(Math.min(1, (sum / stride / 255) * 1.6));
        }

        // Memoria del waveform final del clip: guardar peak por tick.
        const peak = bars.reduce((a, b) => Math.max(a, b), 0);
        waveformRef.current.push(peak);
        if (waveformRef.current.length > 96) waveformRef.current.shift();

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#ec4899';
        const barW = w / BARS;
        const minH = 3 * dpr; // siempre visible
        for (let i = 0; i < BARS; i++) {
            const barH = Math.max(minH, bars[i] * h * 0.85);
            ctx.fillRect(i * barW + barW * 0.2, (h - barH) / 2, barW * 0.6, barH);
        }
    };

    const startRecording = async () => {
        setError(null);
        setTranscriptInfo(null);
        waveformRef.current = [];
        transcriptRef.current = '';
        try {
            // Constraints con noise suppression / echo cancellation / AGC para
            // que la grabación en móvil suene como WhatsApp (no como una lata).
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100,
                    channelCount: 1,
                } as MediaTrackConstraints,
            });
            streamRef.current = stream;

            // Elegir el mejor mime type soportado por el navegador. iOS Safari
            // no soporta webm; cae a audio/mp4 (AAC). Pedimos un bitrate decente.
            const candidates = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/mp4;codecs=mp4a.40.2',
                'audio/mp4',
                'audio/ogg;codecs=opus',
            ];
            const supportedMime = candidates.find(t =>
                typeof MediaRecorder !== 'undefined' &&
                typeof (MediaRecorder as any).isTypeSupported === 'function' &&
                (MediaRecorder as any).isTypeSupported(t)
            );
            const recorder = supportedMime
                ? new MediaRecorder(stream, { mimeType: supportedMime, audioBitsPerSecond: 128_000 })
                : new MediaRecorder(stream);
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

            // Speech recognition (opcional). En Chrome Android choca con
            // MediaRecorder por acceso exclusivo al micrófono — capturamos el
            // error y avisamos suave en vez de gritar al sistema.
            if (enableTranscript) {
                const SR = getSpeechRecognition();
                if (!SR) {
                    setTranscriptInfo('Tu navegador no soporta transcripción.');
                } else {
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
                    r.onerror = (ev: any) => {
                        // Error típico en Android: "not-allowed" o "audio-capture"
                        // porque Chrome bloquea el mic cuando MediaRecorder lo tiene.
                        if (ev?.error === 'not-allowed' || ev?.error === 'audio-capture' || ev?.error === 'aborted') {
                            setTranscriptInfo('La transcripción no está disponible en este navegador mientras grabas.');
                        }
                        try { r.stop(); } catch {}
                        recognitionRef.current = null;
                    };
                    try {
                        r.start();
                        recognitionRef.current = r;
                    } catch {
                        setTranscriptInfo('No se pudo activar la transcripción.');
                    }
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
            // Usar el mime type real del recorder (puede ser audio/mp4 en iOS).
            const blobType = recorder.mimeType || chunksRef.current[0]?.type || 'audio/webm';
            const blob = new Blob(chunksRef.current, { type: blobType });

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
                    <details className="text-[10px] text-slate-400 dark:text-slate-500 select-none">
                        <summary className="cursor-pointer hover:text-rose-400">Opciones avanzadas</summary>
                        <label className="flex items-start gap-2 mt-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={enableTranscript}
                                onChange={e => setEnableTranscript(e.target.checked)}
                                className="accent-rose-400 mt-0.5"
                            />
                            <span className="text-left">
                                Intentar transcripción en vivo
                                <span className="block text-[9px] opacity-70 mt-0.5">Solo Chrome Desktop. En móvil suele chocar con la grabación.</span>
                            </span>
                        </label>
                    </details>
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
                    {transcriptInfo && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 italic text-center max-w-[260px]">
                            {transcriptInfo}
                        </p>
                    )}
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
