import React, { useState, useMemo } from 'react';
import type { Trip, TripStatus, Companion } from '../../types';
import { STATUS_CONFIG, generateId, tripDurationDays, formatDate, totalPackedWeight, formatWeight, totalExpensesInBase, formatCurrency } from './utils';
import { getCountryByCode, getCurrencyMeta } from './countries';
import { CurrencyRatesEditor } from './CurrencyRatesEditor';

const COMPANION_COLORS = ['pink', 'blue', 'green', 'purple', 'orange', 'teal', 'indigo', 'rose'];

const COMPANION_EMOJIS = ['👤', '👩', '👨', '🧑', '👶', '🧒', '🐶', '🐱', '👩‍❤️‍👨', '👯'];

const TRANSPORT_LABELS: Record<NonNullable<Trip['transportToDestination']>, { label: string; icon: string }> = {
    plane: { label: 'Avión', icon: 'flight' },
    car: { label: 'Auto', icon: 'directions_car' },
    bus: { label: 'Bus', icon: 'directions_bus' },
    train: { label: 'Tren', icon: 'train' },
    boat: { label: 'Barco', icon: 'directions_boat' },
    other: { label: 'Otro', icon: 'commute' },
};

export const TripInfoTab: React.FC<{ trip: Trip; onUpdate: (trip: Trip) => void; isSaving?: boolean }> = ({ trip, onUpdate, isSaving = false }) => {
    const [showAddCompanion, setShowAddCompanion] = useState(false);
    const [newCompanionName, setNewCompanionName] = useState('');
    const [newCompanionEmoji, setNewCompanionEmoji] = useState('👤');
    const [editingCompanion, setEditingCompanion] = useState<string | null>(null);
    const [showStatusPicker, setShowStatusPicker] = useState(false);
    const [showRatesEditor, setShowRatesEditor] = useState(false);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const startDate = new Date(trip.startDate + 'T00:00:00');
    const endDate = new Date(trip.endDate + 'T23:59:59');
    const daysUntil = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const totalDays = tripDurationDays(trip);
    const country = getCountryByCode(trip.countryCode);
    const status = STATUS_CONFIG[trip.status];

    // Métricas rápidas
    const packedCount = trip.packingList.filter(i => i.packed).length;
    const totalPacking = trip.packingList.length;
    const checklistDone = (trip.preTripChecklist || []).filter(i => i.completed).length;
    const totalChecklist = (trip.preTripChecklist || []).length;
    const totalActivities = (trip.itinerary || []).reduce((s, d) => s + d.activities.length, 0);
    const completedActivities = (trip.itinerary || []).reduce((s, d) => s + d.activities.filter(a => a.completed).length, 0);
    const totalReservations = (trip.reservations || []).length;
    const totalSpent = totalExpensesInBase(trip);
    const weight = totalPackedWeight(trip);

    const companions = trip.companions || [];
    const baseCurrency = trip.baseCurrency || 'COP';

    // ¿Hay multi-divisa? (gastos/reservas en moneda distinta a la base, o país con moneda distinta)
    const foreignCurrencies = useMemo(() => {
        const set = new Set<string>();
        trip.expenses.forEach(e => {
            if (e.currency && e.currency !== baseCurrency) set.add(e.currency);
        });
        (trip.reservations || []).forEach(r => {
            if (r.currency && r.currency !== baseCurrency) set.add(r.currency);
        });
        if (country && country.currency !== baseCurrency) set.add(country.currency);
        return Array.from(set);
    }, [trip.expenses, trip.reservations, country, baseCurrency]);

    const customRatesCount = Object.keys(trip.customRates || {}).length;

    // Cycle del status (no incluye cancelled — eso es manual desde picker)
    const cycleStatus = () => {
        const next: Record<TripStatus, TripStatus> = {
            planned: 'active',
            active: 'completed',
            completed: 'planned',
            cancelled: 'planned',
        };
        onUpdate({ ...trip, status: next[trip.status] });
    };

    const setStatus = (s: TripStatus) => {
        onUpdate({ ...trip, status: s });
        setShowStatusPicker(false);
    };

    const addCompanion = () => {
        if (!newCompanionName.trim()) return;
        const newC: Companion = {
            id: generateId(),
            name: newCompanionName.trim(),
            emoji: newCompanionEmoji,
            color: COMPANION_COLORS[companions.length % COMPANION_COLORS.length],
        };
        onUpdate({ ...trip, companions: [...companions, newC] });
        setNewCompanionName('');
        setNewCompanionEmoji('👤');
        setShowAddCompanion(false);
    };

    const removeCompanion = (id: string) => {
        if (id === 'me') return;
        onUpdate({ ...trip, companions: companions.filter(c => c.id !== id) });
    };

    const updateCompanion = (id: string, patch: Partial<Companion>) => {
        onUpdate({ ...trip, companions: companions.map(c => c.id === id ? { ...c, ...patch } : c) });
    };

    return (
        <div className="space-y-4">
            {/* Countdown / Banner */}
            {trip.status === 'planned' && daysUntil > 0 && (
                <div className="bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/10 dark:to-rose-900/10 rounded-2xl p-5 text-center border border-pink-100 dark:border-pink-900/20">
                    <span className="material-symbols-outlined text-4xl text-pink-400 mb-2">hourglass_top</span>
                    <p className="text-3xl font-bold text-pink-600 dark:text-pink-300">{daysUntil}</p>
                    <p className="text-xs text-pink-400 font-medium">{daysUntil === 1 ? 'día para salir' : 'días para salir'}</p>
                </div>
            )}
            {trip.status === 'active' && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 rounded-2xl p-5 text-center border border-green-100 dark:border-green-900/20">
                    <span className="material-symbols-outlined text-4xl text-green-500 mb-2">flight_takeoff</span>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-300">¡Disfrutando el viaje!</p>
                    <p className="text-xs text-green-500 font-medium mt-1">
                        {Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))} días restantes
                    </p>
                </div>
            )}

            {/* Resumen rápido */}
            <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 dark:bg-[#2d1820] rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">calendar_month</span> Duración
                    </p>
                    <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{totalDays} {totalDays === 1 ? 'día' : 'días'}</p>
                </div>
                <div className="bg-slate-50 dark:bg-[#2d1820] rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">account_balance_wallet</span> Gastado
                    </p>
                    <p className="text-lg font-bold text-slate-700 dark:text-slate-200">
                        {formatCurrency(totalSpent, trip.baseCurrency)}
                    </p>
                </div>
                {totalPacking > 0 && (
                    <div className="bg-slate-50 dark:bg-[#2d1820] rounded-xl p-3">
                        <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">luggage</span> Equipaje
                        </p>
                        <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{packedCount}/{totalPacking}</p>
                        {weight > 0 && <p className="text-[10px] text-slate-400">{formatWeight(weight)}</p>}
                    </div>
                )}
                {totalChecklist > 0 && (
                    <div className="bg-slate-50 dark:bg-[#2d1820] rounded-xl p-3">
                        <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">task_alt</span> Checklist
                        </p>
                        <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{checklistDone}/{totalChecklist}</p>
                    </div>
                )}
                {totalActivities > 0 && (
                    <div className="bg-slate-50 dark:bg-[#2d1820] rounded-xl p-3">
                        <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">calendar_month</span> Actividades
                        </p>
                        <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{completedActivities}/{totalActivities}</p>
                    </div>
                )}
                {totalReservations > 0 && (
                    <div className="bg-slate-50 dark:bg-[#2d1820] rounded-xl p-3">
                        <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">bookmark</span> Reservas
                        </p>
                        <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{totalReservations}</p>
                    </div>
                )}
            </div>

            {/* Tasas de cambio */}
            {(foreignCurrencies.length > 0 || customRatesCount > 0) && (
                <button
                    onClick={() => setShowRatesEditor(true)}
                    className="w-full bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10 rounded-2xl p-4 border border-amber-100 dark:border-amber-900/20 text-left hover:shadow-md transition-shadow"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center">
                            <span className="material-symbols-outlined">currency_exchange</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                                Tasas de cambio
                                {customRatesCount > 0 && (
                                    <span className="text-[10px] text-green-600 dark:text-green-400 ml-2">✓ Personalizadas</span>
                                )}
                            </p>
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                                Base: {baseCurrency} {getCurrencyMeta(baseCurrency).flag}
                                {foreignCurrencies.length > 0 && ` · Otras: ${foreignCurrencies.map(c => `${getCurrencyMeta(c).flag} ${c}`).join(', ')}`}
                            </p>
                        </div>
                        <span className="material-symbols-outlined text-amber-400 text-sm">tune</span>
                    </div>
                </button>
            )}

            {/* Transporte */}
            {trip.transportToDestination && TRANSPORT_LABELS[trip.transportToDestination] && (
                <div className="bg-slate-50 dark:bg-[#2d1820] rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-pink-100 dark:bg-pink-900/30 text-pink-500 flex items-center justify-center">
                        <span className="material-symbols-outlined">{TRANSPORT_LABELS[trip.transportToDestination].icon}</span>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-400 font-medium">Transporte principal</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{TRANSPORT_LABELS[trip.transportToDestination].label}</p>
                    </div>
                </div>
            )}

            {/* Multi-destino */}
            {trip.destinations && trip.destinations.length > 0 && (
                <div className="bg-slate-50 dark:bg-[#2d1820] rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-slate-400">route</span>
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Itinerario de paradas</span>
                    </div>
                    <div className="space-y-2">
                        {trip.destinations.map((d, idx) => (
                            <div key={d.id} className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                    {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{d.name}</p>
                                    <p className="text-[10px] text-slate-400">{formatDate(d.startDate)} → {formatDate(d.endDate)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Info del destino */}
            {country && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-2xl p-4 border border-blue-100 dark:border-blue-900/20">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">{country.flag}</span>
                        <div>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{country.name}</p>
                            <p className="text-[10px] text-slate-400">Información del destino</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <InfoRow icon="schedule" label="Zona horaria" value={`UTC${country.timezoneOffset >= 0 ? '+' : ''}${country.timezoneOffset}`} />
                        <InfoRow icon="payments" label="Moneda local" value={country.currency} />
                        <InfoRow icon="bolt" label="Voltaje" value={country.voltage} />
                        <InfoRow icon="power" label="Enchufe" value={`Tipo ${country.plugType}`} />
                        <InfoRow icon="translate" label="Idioma" value={country.language} />
                        <InfoRow icon="emergency" label="Emergencias" value={country.emergency} />
                        <InfoRow icon="directions_car" label="Conducción" value={country.drivingSide === 'left' ? 'Izquierda 🇬🇧' : 'Derecha'} />
                    </div>
                </div>
            )}

            {/* Companions */}
            <div className="bg-slate-50 dark:bg-[#2d1820] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400">groups</span>
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Acompañantes ({companions.length})</span>
                    </div>
                    <button
                        onClick={() => setShowAddCompanion(!showAddCompanion)}
                        className="text-xs text-pink-500 font-bold flex items-center gap-1"
                    >
                        <span className="material-symbols-outlined text-sm">add</span> Agregar
                    </button>
                </div>
                <div className="space-y-2">
                    {companions.map(c => (
                        <div key={c.id} className="flex items-center gap-2">
                            {editingCompanion === c.id ? (
                                <>
                                    <span className="text-xl">{c.emoji || '👤'}</span>
                                    <input
                                        type="text"
                                        value={c.name}
                                        onChange={e => updateCompanion(c.id, { name: e.target.value })}
                                        onBlur={() => setEditingCompanion(null)}
                                        onKeyDown={e => e.key === 'Enter' && setEditingCompanion(null)}
                                        className="flex-1 bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-pink-300 rounded-lg px-2 py-1 text-sm"
                                        autoFocus
                                    />
                                </>
                            ) : (
                                <>
                                    <span className="text-xl">{c.emoji || '👤'}</span>
                                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">
                                        {c.name} {c.isMe && <span className="text-[10px] text-pink-400 ml-1">(yo)</span>}
                                    </span>
                                    {!c.isMe && (
                                        <>
                                            <button
                                                onClick={() => setEditingCompanion(c.id)}
                                                className="text-slate-400 hover:text-pink-500"
                                            >
                                                <span className="material-symbols-outlined text-sm">edit</span>
                                            </button>
                                            <button
                                                onClick={() => removeCompanion(c.id)}
                                                className="text-slate-400 hover:text-rose-500"
                                            >
                                                <span className="material-symbols-outlined text-sm">close</span>
                                            </button>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    ))}
                </div>

                {showAddCompanion && (
                    <div className="mt-3 bg-white dark:bg-[#1a0d10] rounded-xl p-3 space-y-2">
                        <div className="flex gap-1 overflow-x-auto pb-1">
                            {COMPANION_EMOJIS.map(em => (
                                <button
                                    key={em}
                                    onClick={() => setNewCompanionEmoji(em)}
                                    className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-lg ${newCompanionEmoji === em ? 'bg-pink-100 dark:bg-pink-900/30' : 'bg-slate-50 dark:bg-[#2d1820]'}`}
                                >
                                    {em}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newCompanionName}
                                onChange={e => setNewCompanionName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addCompanion()}
                                placeholder="Nombre"
                                className="flex-1 bg-slate-50 dark:bg-[#2d1820] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm"
                                autoFocus
                            />
                            <button
                                onClick={addCompanion}
                                className="bg-pink-400 text-white rounded-lg px-4 font-bold text-sm"
                            >
                                Agregar
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Notas */}
            {trip.notes && (
                <div className="bg-slate-50 dark:bg-[#2d1820] rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-slate-400">sticky_note_2</span>
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Notas</span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{trip.notes}</p>
                </div>
            )}

            {/* Status picker */}
            <div className="bg-slate-50 dark:bg-[#2d1820] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400">{status.icon}</span>
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Estado del viaje</span>
                    </div>
                    <button
                        onClick={() => setShowStatusPicker(!showStatusPicker)}
                        className="text-xs text-pink-500 font-bold"
                    >
                        Cambiar
                    </button>
                </div>
                {showStatusPicker ? (
                    <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(STATUS_CONFIG) as TripStatus[]).map(s => (
                            <button
                                key={s}
                                onClick={() => setStatus(s)}
                                disabled={isSaving}
                                className={`p-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${trip.status === s ? `ring-2 ring-pink-400 ${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].color}` : `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].color} opacity-70 hover:opacity-100`}`}
                            >
                                <span className="material-symbols-outlined text-sm">{STATUS_CONFIG[s].icon}</span>
                                {STATUS_CONFIG[s].label}
                            </button>
                        ))}
                    </div>
                ) : (
                    <button
                        onClick={cycleStatus}
                        disabled={isSaving || trip.status === 'cancelled'}
                        className="w-full flex items-center justify-between disabled:opacity-50"
                    >
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${status.bg} ${status.color}`}>
                            {status.label}
                        </span>
                        {trip.status !== 'cancelled' && (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                Avanzar
                                <span className="material-symbols-outlined text-sm">arrow_forward</span>
                            </span>
                        )}
                    </button>
                )}
            </div>

            {/* Currency rates editor modal */}
            {showRatesEditor && (
                <CurrencyRatesEditor
                    trip={trip}
                    onSave={(customRates) => {
                        // Recalcular amountInBase de todos los gastos con la nueva tasa
                        const newExpenses = trip.expenses.map(e => {
                            if (!e.currency || e.currency === baseCurrency) return { ...e, amountInBase: undefined };
                            const rate = customRates[e.currency];
                            const baseRate = customRates[baseCurrency];
                            if (!rate || !baseRate) return e;
                            // 1 e.currency = rate COP. Convertir a baseCurrency: amount * rate / baseRate
                            return { ...e, amountInBase: (e.amount * rate) / baseRate };
                        });
                        onUpdate({ ...trip, customRates, expenses: newExpenses });
                        setShowRatesEditor(false);
                    }}
                    onClose={() => setShowRatesEditor(false)}
                />
            )}
        </div>
    );
};

const InfoRow: React.FC<{ icon: string; label: string; value: string }> = ({ icon, label, value }) => (
    <div className="bg-white/60 dark:bg-black/20 rounded-lg p-2">
        <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
            <span className="material-symbols-outlined text-xs">{icon}</span>
            {label}
        </div>
        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{value}</p>
    </div>
);
