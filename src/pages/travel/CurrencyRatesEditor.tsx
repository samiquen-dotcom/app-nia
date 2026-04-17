import React, { useState, useMemo, useEffect } from 'react';
import type { Trip } from '../../types';
import { COMMON_CURRENCIES, DEFAULT_RATES_TO_COP, getCurrencyMeta } from './countries';
import { formatCurrency } from './utils';
import { fetchLiveRates, getCachedRatesTimestamp, formatRatesTimestamp } from './exchangeRatesApi';
import { ConfirmModal } from './ConfirmModal';

interface Props {
    trip: Trip;
    onSave: (customRates: Record<string, number>) => void;
    onClose: () => void;
}

/**
 * Editor de tasas de cambio del viaje. Permite ajustar manualmente la tasa
 * "1 unidad de la moneda = X COP" para que las conversiones sean precisas
 * con el cambio real del día.
 */
export const CurrencyRatesEditor: React.FC<Props> = ({ trip, onSave, onClose }) => {
    const baseCurrency = trip.baseCurrency || 'COP';

    // Detectar monedas relevantes: la base + las usadas en gastos/reservas
    const relevantCurrencies = useMemo(() => {
        const set = new Set<string>();
        set.add(baseCurrency);
        trip.expenses.forEach(e => { if (e.currency) set.add(e.currency); });
        (trip.reservations || []).forEach(r => { if (r.currency) set.add(r.currency); });
        // Si hay tasas custom ya definidas, incluirlas también
        Object.keys(trip.customRates || {}).forEach(c => set.add(c));
        return Array.from(set);
    }, [trip]);

    // Estado local: las tasas que el usuario está editando
    const [rates, setRates] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        relevantCurrencies.forEach(code => {
            const custom = trip.customRates?.[code];
            const def = DEFAULT_RATES_TO_COP[code];
            initial[code] = String(custom ?? def ?? 1);
        });
        return initial;
    });

    // Para agregar una moneda nueva al editor que no está en el viaje
    const [showAdd, setShowAdd] = useState(false);
    const [newCode, setNewCode] = useState('');

    // Estado de tasas en vivo
    const [liveRatesTs, setLiveRatesTs] = useState<number | null>(() => getCachedRatesTimestamp());
    const [liveLoading, setLiveLoading] = useState(false);
    const [liveError, setLiveError] = useState<string | null>(null);
    const [confirmOverwrite, setConfirmOverwrite] = useState(false);

    // Prefetch en background al abrir el editor (si el cache está expirado)
    useEffect(() => {
        fetchLiveRates(false).then(result => {
            if (result) setLiveRatesTs(result.fetchedAt);
        });
    }, []);

    // Detecta tasas que el usuario ya editó respecto a lo inicial (customRates || default)
    const hasUserEdits = useMemo(() => {
        return Object.entries(rates).some(([code, val]) => {
            if (code === baseCurrency) return false;
            const initial = trip.customRates?.[code] ?? DEFAULT_RATES_TO_COP[code];
            if (initial == null) return false;
            const num = parseFloat(val);
            if (isNaN(num)) return false;
            return Math.abs(num - initial) > 0.0001;
        });
    }, [rates, trip.customRates, baseCurrency]);

    const doApplyLiveRates = async () => {
        setLiveLoading(true);
        setLiveError(null);
        const result = await fetchLiveRates(true);
        setLiveLoading(false);
        if (!result) {
            setLiveError('No se pudo conectar. Revisa tu internet.');
            return;
        }
        setLiveRatesTs(result.fetchedAt);
        // Actualiza solo las monedas ya presentes en el editor (no sobreescribe base)
        setRates(prev => {
            const next = { ...prev };
            Object.keys(prev).forEach(code => {
                if (code === baseCurrency) return;
                const live = result.rates[code];
                if (typeof live === 'number' && live > 0) {
                    next[code] = String(Math.round(live * 100) / 100);
                }
            });
            return next;
        });
    };

    const applyLiveRates = () => {
        // Si el usuario ya editó tasas a mano, pedir confirmación antes de sobreescribir
        if (hasUserEdits) {
            setConfirmOverwrite(true);
            return;
        }
        void doApplyLiveRates();
    };

    const update = (code: string, value: string) => {
        setRates(prev => ({ ...prev, [code]: value }));
    };

    const remove = (code: string) => {
        const next = { ...rates };
        delete next[code];
        setRates(next);
    };

    const resetToDefault = (code: string) => {
        update(code, String(DEFAULT_RATES_TO_COP[code] ?? 1));
    };

    const addCurrency = () => {
        if (!newCode || rates[newCode]) {
            setNewCode('');
            setShowAdd(false);
            return;
        }
        update(newCode, String(DEFAULT_RATES_TO_COP[newCode] ?? 1));
        setNewCode('');
        setShowAdd(false);
    };

    const handleSave = () => {
        const parsed: Record<string, number> = {};
        Object.entries(rates).forEach(([code, val]) => {
            const num = parseFloat(val);
            if (!isNaN(num) && num > 0) parsed[code] = num;
        });
        onSave(parsed);
    };

    const availableToAdd = COMMON_CURRENCIES.filter(c => !rates[c.code]);

    return (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative w-full sm:max-w-md max-h-[100vh] sm:max-h-[90vh] flex flex-col bg-white dark:bg-[#1a0d10] rounded-t-3xl sm:rounded-3xl shadow-2xl">
                {/* Header */}
                <div className="flex-shrink-0 px-5 pt-5 pb-3 border-b border-slate-100 dark:border-[#5a2b35]/30 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Tasas de cambio</h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">1 unidad = X COP</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-300">
                        💡 Estas tasas son aproximadas. Puedes traerlas del día o ajustarlas manualmente.
                    </div>

                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3 flex items-center gap-3">
                        <span className="text-2xl flex-shrink-0">🌐</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-blue-700 dark:text-blue-300">Tasas en vivo</p>
                            {liveError ? (
                                <p className="text-[10px] text-rose-500 mt-0.5">{liveError}</p>
                            ) : liveRatesTs ? (
                                <p className="text-[10px] text-blue-500 dark:text-blue-400 mt-0.5">
                                    Actualizadas {formatRatesTimestamp(liveRatesTs)}
                                </p>
                            ) : (
                                <p className="text-[10px] text-slate-400 mt-0.5">open.er-api.com · gratis</p>
                            )}
                        </div>
                        <button
                            onClick={applyLiveRates}
                            disabled={liveLoading}
                            className="bg-blue-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap disabled:opacity-50 flex items-center gap-1"
                        >
                            <span className={`material-symbols-outlined text-xs ${liveLoading ? 'animate-spin' : ''}`}>
                                {liveLoading ? 'progress_activity' : 'refresh'}
                            </span>
                            {liveLoading ? 'Cargando…' : 'Usar tasas de hoy'}
                        </button>
                    </div>

                    {Object.entries(rates).map(([code, val]) => {
                        const meta = getCurrencyMeta(code);
                        const isBase = code === baseCurrency;
                        const numVal = parseFloat(val) || 0;
                        const def = DEFAULT_RATES_TO_COP[code];
                        const isDefault = def != null && Math.abs(numVal - def) < 0.0001;

                        return (
                            <div key={code} className="bg-slate-50 dark:bg-[#2d1820] rounded-xl p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xl">{meta.flag}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                            {code} {isBase && <span className="text-[10px] text-pink-500 ml-1">(moneda base)</span>}
                                        </p>
                                        <p className="text-[10px] text-slate-400">{meta.name}</p>
                                    </div>
                                    {!isBase && (
                                        <button
                                            onClick={() => remove(code)}
                                            className="text-slate-400 hover:text-rose-500"
                                            title="Quitar"
                                        >
                                            <span className="material-symbols-outlined text-base">close</span>
                                        </button>
                                    )}
                                </div>

                                {!isBase ? (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-slate-400 whitespace-nowrap">1 {code} =</span>
                                            <input
                                                type="number"
                                                step="any"
                                                value={val}
                                                onChange={e => update(code, e.target.value)}
                                                className="flex-1 bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-pink-400"
                                            />
                                            <span className="text-[10px] text-slate-400">COP</span>
                                        </div>
                                        <div className="flex items-center justify-between mt-2 text-[10px]">
                                            <span className="text-slate-400">
                                                Equivalencia: {formatCurrency(100, code)} ≈ {formatCurrency(numVal * 100, 'COP')}
                                            </span>
                                            {!isDefault && def != null && (
                                                <button
                                                    onClick={() => resetToDefault(code)}
                                                    className="text-pink-500 font-bold hover:underline"
                                                >
                                                    Restaurar ({def})
                                                </button>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-[10px] text-slate-400 italic">Tu moneda base no se convierte.</p>
                                )}
                            </div>
                        );
                    })}

                    {/* Agregar moneda */}
                    {!showAdd ? (
                        <button
                            onClick={() => setShowAdd(true)}
                            className="w-full border-2 border-dashed border-slate-200 dark:border-[#5a2b35]/30 rounded-xl py-2.5 text-xs text-slate-400 hover:text-pink-400 hover:border-pink-300 transition-colors flex items-center justify-center gap-1"
                        >
                            <span className="material-symbols-outlined text-sm">add_circle</span>
                            Agregar moneda
                        </button>
                    ) : (
                        <div className="bg-slate-50 dark:bg-[#2d1820] rounded-xl p-3 space-y-2">
                            <select
                                value={newCode}
                                onChange={e => setNewCode(e.target.value)}
                                className="w-full bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm"
                            >
                                <option value="">Selecciona una moneda</option>
                                {availableToAdd.map(c => (
                                    <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</option>
                                ))}
                            </select>
                            <div className="flex gap-2">
                                <button
                                    onClick={addCurrency}
                                    disabled={!newCode}
                                    className="flex-1 bg-pink-400 text-white rounded-lg py-1.5 text-xs font-bold disabled:opacity-40"
                                >
                                    Agregar
                                </button>
                                <button
                                    onClick={() => { setShowAdd(false); setNewCode(''); }}
                                    className="bg-slate-200 dark:bg-slate-700 rounded-lg px-4 text-xs font-bold"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 px-5 pb-28 sm:pb-5 pt-2 flex gap-2 border-t border-slate-100 dark:border-[#5a2b35]/30">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-400 to-rose-500 text-white font-bold text-sm"
                    >
                        Guardar tasas
                    </button>
                </div>
            </div>

            <ConfirmModal
                open={confirmOverwrite}
                title="¿Sobreescribir tasas editadas?"
                message="Ya ajustaste algunas tasas manualmente. Al usar las tasas de hoy se reemplazarán."
                confirmLabel="Sí, reemplazar"
                cancelLabel="Mantener"
                icon="sync"
                onConfirm={() => { setConfirmOverwrite(false); void doApplyLiveRates(); }}
                onCancel={() => setConfirmOverwrite(false)}
            />
        </div>
    );
};
