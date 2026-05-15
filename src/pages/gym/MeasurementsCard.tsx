import React, { useMemo, useState } from 'react';
import type { BodyMeasurement } from '../../types';
import { todayStr } from '../../utils/dateHelpers';

interface Props {
    measurements: BodyMeasurement[];
    onSave: (next: BodyMeasurement[]) => void;
}

/** Sección de medidas corporales: peso + cintura/cadera con mini-gráfica de peso. */
export const MeasurementsCard: React.FC<Props> = ({ measurements, onSave }) => {
    const [showModal, setShowModal] = useState(false);
    const [weight, setWeight] = useState('');
    const [waist, setWaist] = useState('');
    const [hip, setHip] = useState('');
    const [notes, setNotes] = useState('');

    // Ordenadas del más antiguo al más reciente
    const sorted = useMemo(
        () => [...measurements].sort((a, b) => (a.date < b.date ? -1 : 1)),
        [measurements]
    );
    const latest = sorted[sorted.length - 1];
    const previous = sorted[sorted.length - 2];

    // Mini-gráfica de peso (últimos 8 registros con peso)
    const weightPoints = useMemo(
        () => sorted.filter(m => m.weight !== undefined).slice(-8),
        [sorted]
    );

    const weightDelta = latest?.weight !== undefined && previous?.weight !== undefined
        ? latest.weight - previous.weight
        : null;

    const openModal = () => {
        setWeight(latest?.weight?.toString() ?? '');
        setWaist('');
        setHip('');
        setNotes('');
        setShowModal(true);
    };

    const handleSave = () => {
        if (!weight && !waist && !hip) return;
        const today = todayStr();
        const entry: BodyMeasurement = {
            id: `bm_${Date.now()}`,
            date: today,
            weight: weight ? Number(weight) : undefined,
            waist: waist ? Number(waist) : undefined,
            hip: hip ? Number(hip) : undefined,
            notes: notes.trim() || undefined,
        };
        // Reemplazar si ya hay registro de hoy
        const next = [...measurements.filter(m => m.date !== today), entry];
        onSave(next);
        setShowModal(false);
    };

    const removeMeasurement = (id: string) => {
        onSave(measurements.filter(m => m.id !== id));
    };

    // Escala de la mini-gráfica
    const weights = weightPoints.map(m => m.weight!) as number[];
    const minW = weights.length ? Math.min(...weights) : 0;
    const maxW = weights.length ? Math.max(...weights) : 1;
    const range = maxW - minW || 1;

    return (
        <div className="mt-10">
            <div className="flex justify-between items-end mb-4 pr-1">
                <h3 className="font-bold text-slate-700 dark:text-slate-200 ml-1">Medidas corporales</h3>
                <button
                    onClick={openModal}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-colors"
                >
                    + Registrar
                </button>
            </div>

            <div className="bg-white dark:bg-[#2d1820] rounded-2xl shadow-sm border border-slate-100 dark:border-[#5a2b35]/30 p-4">
                {sorted.length === 0 ? (
                    <div className="text-center py-4">
                        <p className="text-3xl mb-1">⚖️</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Aún no registras tus medidas</p>
                        <p className="text-xs text-slate-400 mt-0.5">Registra tu peso cada tanto para ver si tu progreso va bien.</p>
                    </div>
                ) : (
                    <>
                        {/* Valor actual + delta */}
                        <div className="flex items-end justify-between mb-3">
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400">Peso actual</p>
                                <p className="text-3xl font-black text-slate-800 dark:text-slate-100">
                                    {latest?.weight !== undefined ? `${latest.weight}` : '—'}
                                    <span className="text-base text-slate-400 font-bold ml-1">kg</span>
                                </p>
                            </div>
                            {weightDelta !== null && (
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${weightDelta === 0
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                    : weightDelta < 0
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                                        : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'}`}>
                                    {weightDelta > 0 ? '+' : ''}{weightDelta.toFixed(1)} kg
                                </span>
                            )}
                        </div>

                        {/* Mini-gráfica de peso */}
                        {weightPoints.length >= 2 && (
                            <div className="flex items-end justify-between gap-1 h-16 mb-3">
                                {weightPoints.map(m => {
                                    const h = ((m.weight! - minW) / range) * 80 + 20; // 20-100%
                                    return (
                                        <div key={m.id} className="flex-1 flex flex-col items-center gap-1">
                                            <div
                                                className="w-full bg-emerald-400 dark:bg-emerald-500 rounded-t-md transition-all"
                                                style={{ height: `${h}%` }}
                                                title={`${m.weight} kg · ${m.date}`}
                                            />
                                            <span className="text-[8px] text-slate-400">{m.date.slice(8)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Cintura / cadera actuales */}
                        {(latest?.waist || latest?.hip) && (
                            <div className="flex gap-3 text-xs mb-3">
                                {latest.waist && (
                                    <span className="text-slate-500 dark:text-slate-400">
                                        Cintura: <strong className="text-slate-700 dark:text-slate-200">{latest.waist} cm</strong>
                                    </span>
                                )}
                                {latest.hip && (
                                    <span className="text-slate-500 dark:text-slate-400">
                                        Cadera: <strong className="text-slate-700 dark:text-slate-200">{latest.hip} cm</strong>
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Historial reciente */}
                        <div className="border-t border-slate-100 dark:border-[#5a2b35]/30 pt-2 space-y-1">
                            {[...sorted].reverse().slice(0, 4).map(m => (
                                <div key={m.id} className="flex items-center gap-2 text-xs group">
                                    <span className="text-slate-400 w-16 flex-shrink-0">{m.date.slice(5)}</span>
                                    <span className="flex-1 text-slate-600 dark:text-slate-300">
                                        {m.weight !== undefined ? `${m.weight} kg` : ''}
                                        {m.waist ? ` · ${m.waist}cm cintura` : ''}
                                        {m.hip ? ` · ${m.hip}cm cadera` : ''}
                                    </span>
                                    <button
                                        onClick={() => removeMeasurement(m.id)}
                                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-400 transition-opacity flex-shrink-0"
                                        aria-label="Eliminar"
                                    >
                                        <span className="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Modal de registro */}
            {showModal && (
                <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in" onClick={() => setShowModal(false)}>
                    <div
                        className="bg-white dark:bg-[#231218] w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mb-1">Registrar medidas</h2>
                        <p className="text-xs text-slate-400 mb-5">Llena lo que quieras — todo es opcional.</p>

                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 block">Peso (kg)</label>
                        <input
                            type="number" inputMode="decimal" min="0" step="0.1"
                            value={weight}
                            onChange={e => setWeight(e.target.value)}
                            autoFocus
                            className="w-full bg-slate-50 dark:bg-[#1a0d10] border-2 border-transparent focus:border-emerald-400 rounded-xl px-3 py-2.5 text-sm focus:outline-none mb-3 dark:text-slate-200"
                        />
                        <div className="flex gap-3 mb-3">
                            <div className="flex-1">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 block">Cintura (cm)</label>
                                <input
                                    type="number" inputMode="decimal" min="0" step="0.5"
                                    value={waist}
                                    onChange={e => setWaist(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-[#1a0d10] border-2 border-transparent focus:border-emerald-400 rounded-xl px-3 py-2.5 text-sm focus:outline-none dark:text-slate-200"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 block">Cadera (cm)</label>
                                <input
                                    type="number" inputMode="decimal" min="0" step="0.5"
                                    value={hip}
                                    onChange={e => setHip(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-[#1a0d10] border-2 border-transparent focus:border-emerald-400 rounded-xl px-3 py-2.5 text-sm focus:outline-none dark:text-slate-200"
                                />
                            </div>
                        </div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 block">Notas</label>
                        <input
                            type="text"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Opcional"
                            className="w-full bg-slate-50 dark:bg-[#1a0d10] border-2 border-transparent focus:border-emerald-400 rounded-xl px-3 py-2.5 text-sm focus:outline-none mb-5 dark:text-slate-200"
                        />

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-[#3a2028] text-slate-600 dark:text-slate-300 font-bold"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!weight && !waist && !hip}
                                className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold shadow-lg disabled:opacity-40 active:scale-95 transition-all"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
