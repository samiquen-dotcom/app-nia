import React, { useState, useMemo } from 'react';
import type { Trip, TripType, TripColor, TripDestination } from '../../types';
import { generateId, generateDefaultPacking, TYPE_CONFIG, TRIP_COLOR_CONFIG, tripDurationDays } from './utils';
import { COUNTRIES, COMMON_CURRENCIES, getCountryByName } from './countries';

const TRANSPORT_OPTIONS: Array<{ key: NonNullable<Trip['transportToDestination']>; label: string; icon: string }> = [
    { key: 'plane', label: 'Avión', icon: 'flight' },
    { key: 'car', label: 'Auto', icon: 'directions_car' },
    { key: 'bus', label: 'Bus', icon: 'directions_bus' },
    { key: 'train', label: 'Tren', icon: 'train' },
    { key: 'boat', label: 'Barco', icon: 'directions_boat' },
    { key: 'other', label: 'Otro', icon: 'commute' },
];

export const TripFormModal: React.FC<{
    onClose: () => void;
    onSave: (trip: Trip) => void;
    editTrip?: Trip | null;
    isSaving?: boolean;
}> = ({ onClose, onSave, editTrip, isSaving = false }) => {
    const [destination, setDestination] = useState(editTrip?.destination || '');
    const [countryCode, setCountryCode] = useState(editTrip?.countryCode || '');
    const [type, setType] = useState<TripType>(editTrip?.type || 'other');
    const [color, setColor] = useState<TripColor>(editTrip?.color || 'pink');
    const [startDate, setStartDate] = useState(editTrip?.startDate || '');
    const [endDate, setEndDate] = useState(editTrip?.endDate || '');
    const [budget, setBudget] = useState(editTrip?.budget ? String(editTrip.budget) : '');
    const [baseCurrency, setBaseCurrency] = useState(editTrip?.baseCurrency || 'COP');
    const [transport, setTransport] = useState<Trip['transportToDestination']>(editTrip?.transportToDestination);
    const [notes, setNotes] = useState(editTrip?.notes || '');
    const [destinations, setDestinations] = useState<TripDestination[]>(editTrip?.destinations || []);
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [countrySearch, setCountrySearch] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showAdvanced, setShowAdvanced] = useState(false);

    const filteredCountries = useMemo(() => {
        const q = countrySearch.toLowerCase().trim();
        if (!q) return COUNTRIES;
        return COUNTRIES.filter(c =>
            c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q
        );
    }, [countrySearch]);

    const validate = (): Record<string, string> => {
        const e: Record<string, string> = {};
        if (!destination.trim()) e.destination = 'Pon el destino del viaje';
        if (!startDate) e.startDate = 'Falta la fecha de inicio';
        if (!endDate) e.endDate = 'Falta la fecha de fin';
        if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
            e.endDate = 'La fecha fin debe ser posterior a la inicio';
        }
        if (budget && parseFloat(budget) < 0) e.budget = 'El presupuesto no puede ser negativo';
        if (startDate) {
            const start = new Date(startDate);
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const yearAhead = new Date(); yearAhead.setFullYear(today.getFullYear() + 5);
            if (start < new Date('2000-01-01')) e.startDate = 'Fecha demasiado antigua';
            if (start > yearAhead) e.startDate = 'Fecha demasiado lejana (>5 años)';
        }
        // Validar destinations chain
        if (destinations.length > 0) {
            const sortedDests = [...destinations].sort((a, b) => a.startDate.localeCompare(b.startDate));
            for (const d of sortedDests) {
                if (startDate && d.startDate < startDate) {
                    e.destinations = `${d.name}: empieza antes que el viaje`;
                    break;
                }
                if (endDate && d.endDate > endDate) {
                    e.destinations = `${d.name}: termina después que el viaje`;
                    break;
                }
                if (d.endDate < d.startDate) {
                    e.destinations = `${d.name}: fechas inválidas`;
                    break;
                }
            }
        }
        return e;
    };

    const handleSave = () => {
        const e = validate();
        setErrors(e);
        if (Object.keys(e).length > 0) return;

        const duration = tripDurationDays({ startDate, endDate });

        if (editTrip) {
            const updatedTrip: Trip = {
                ...editTrip,
                destination: destination.trim(),
                countryCode: countryCode || undefined,
                type,
                color,
                startDate,
                endDate,
                budget: parseFloat(budget) || 0,
                baseCurrency,
                notes: notes.trim(),
                destinations: destinations.length > 0 ? destinations : undefined,
                transportToDestination: transport,
            };
            onSave(updatedTrip);
        } else {
            // Auto-detect country from destination if not selected
            const autoCountry = countryCode || getCountryByName(destination)?.code;
            const detectedCurrency = autoCountry
                ? COUNTRIES.find(c => c.code === autoCountry)?.currency
                : undefined;

            const trip: Trip = {
                id: generateId(),
                destination: destination.trim(),
                countryCode: autoCountry || undefined,
                type,
                color,
                status: 'planned',
                startDate,
                endDate,
                budget: parseFloat(budget) || 0,
                baseCurrency,
                notes: notes.trim(),
                packingList: generateDefaultPacking(type, duration),
                expenses: [],
                createdAt: Date.now(),
                destinations: destinations.length > 0 ? destinations : undefined,
                transportToDestination: transport,
                companions: [{ id: 'me', name: 'Yo', isMe: true, color: 'pink' }],
            };
            // Si el destino tiene moneda local distinta a la base, lo notamos en notas
            if (detectedCurrency && detectedCurrency !== baseCurrency) {
                trip.notes = trip.notes
                    ? `${trip.notes}\n\nMoneda local: ${detectedCurrency}`
                    : `Moneda local: ${detectedCurrency}`;
            }
            onSave(trip);
        }
    };

    const addDestination = () => {
        setDestinations([
            ...destinations,
            {
                id: generateId(),
                name: '',
                startDate: startDate || '',
                endDate: endDate || '',
            },
        ]);
    };

    const updateDestination = (id: string, patch: Partial<TripDestination>) => {
        setDestinations(destinations.map(d => d.id === id ? { ...d, ...patch } : d));
    };

    const removeDestination = (id: string) => {
        setDestinations(destinations.filter(d => d.id !== id));
    };

    const formIsValid = !destination.trim() || !startDate || !endDate || isSaving;

    const selectedCountry = COUNTRIES.find(c => c.code === countryCode);

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative w-full sm:max-w-lg max-h-[95vh] sm:max-h-[90vh] flex flex-col bg-white dark:bg-[#1a0d10] rounded-t-3xl sm:rounded-3xl shadow-2xl">
                {/* Header */}
                <div className="flex-shrink-0 bg-white dark:bg-[#1a0d10] px-6 pt-6 pb-4 border-b border-slate-100 dark:border-[#5a2b35]/30">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                            {editTrip ? 'Editar Viaje ✏️' : 'Nuevo Viaje 🌍'}
                        </h2>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>

                {/* Form */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Destino + país */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 block">Destino *</label>
                        <input
                            type="text"
                            value={destination}
                            onChange={e => { setDestination(e.target.value); setErrors({ ...errors, destination: '' }); }}
                            placeholder="Ej: Cancún, México"
                            className={`w-full bg-slate-50 dark:bg-[#2d1820] dark:text-slate-200 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-pink-400 ${errors.destination ? 'border-rose-400' : 'border-slate-200 dark:border-[#5a2b35]/40'}`}
                        />
                        {errors.destination && <p className="text-xs text-rose-500 mt-1">{errors.destination}</p>}

                        <button
                            type="button"
                            onClick={() => setShowCountryPicker(!showCountryPicker)}
                            className="mt-2 w-full flex items-center justify-between text-xs bg-slate-50 dark:bg-[#2d1820] border border-slate-200 dark:border-[#5a2b35]/40 rounded-xl px-3 py-2 hover:border-pink-300 transition-colors"
                        >
                            <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                <span className="material-symbols-outlined text-sm">flag</span>
                                {selectedCountry ? `${selectedCountry.flag} ${selectedCountry.name}` : 'País del destino (opcional)'}
                            </span>
                            <span className="material-symbols-outlined text-sm text-slate-400">{showCountryPicker ? 'expand_less' : 'expand_more'}</span>
                        </button>

                        {showCountryPicker && (
                            <div className="mt-2 bg-slate-50 dark:bg-[#2d1820] rounded-xl p-2 border border-slate-200 dark:border-[#5a2b35]/40">
                                <input
                                    type="text"
                                    value={countrySearch}
                                    onChange={e => setCountrySearch(e.target.value)}
                                    placeholder="Buscar país..."
                                    className="w-full bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-xs mb-2"
                                />
                                <div className="max-h-48 overflow-y-auto space-y-1">
                                    {filteredCountries.map(c => (
                                        <button
                                            key={c.code}
                                            type="button"
                                            onClick={() => {
                                                setCountryCode(c.code);
                                                setBaseCurrency(c.currency);
                                                setShowCountryPicker(false);
                                                setCountrySearch('');
                                            }}
                                            className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 ${countryCode === c.code ? 'bg-pink-50 dark:bg-pink-900/20 text-pink-600' : 'hover:bg-white dark:hover:bg-[#3d2830] text-slate-600 dark:text-slate-300'}`}
                                        >
                                            <span>{c.flag}</span>
                                            <span className="flex-1">{c.name}</span>
                                            <span className="text-[10px] text-slate-400">{c.currency}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Tipo de viaje */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 block">Tipo de viaje</label>
                        <div className="grid grid-cols-4 gap-2">
                            {(Object.keys(TYPE_CONFIG) as TripType[]).map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setType(t)}
                                    className={`p-2 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${type === t ? 'border-pink-400 bg-pink-50 dark:bg-pink-900/20' : 'border-slate-200 dark:border-[#5a2b35]/30'}`}
                                >
                                    <span className="material-symbols-outlined text-lg text-pink-400">{TYPE_CONFIG[t].icon}</span>
                                    <span className="text-[9px] font-medium text-slate-600 dark:text-slate-300">{TYPE_CONFIG[t].label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Fechas */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 block">Fecha inicio *</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => { setStartDate(e.target.value); setErrors({ ...errors, startDate: '', endDate: '' }); }}
                                className={`w-full bg-slate-50 dark:bg-[#2d1820] dark:text-slate-200 border rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-pink-400 ${errors.startDate ? 'border-rose-400' : 'border-slate-200 dark:border-[#5a2b35]/40'}`}
                            />
                            {errors.startDate && <p className="text-xs text-rose-500 mt-1">{errors.startDate}</p>}
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 block">Fecha fin *</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => { setEndDate(e.target.value); setErrors({ ...errors, endDate: '' }); }}
                                min={startDate}
                                className={`w-full bg-slate-50 dark:bg-[#2d1820] dark:text-slate-200 border rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-pink-400 ${errors.endDate ? 'border-rose-400' : 'border-slate-200 dark:border-[#5a2b35]/40'}`}
                            />
                            {errors.endDate && <p className="text-xs text-rose-500 mt-1">{errors.endDate}</p>}
                        </div>
                    </div>
                    {startDate && endDate && !errors.endDate && (
                        <div className="text-xs text-slate-400 -mt-2 flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">schedule</span>
                            {tripDurationDays({ startDate, endDate })} días de viaje
                        </div>
                    )}

                    {/* Presupuesto + moneda */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 block">Presupuesto</label>
                            <input
                                type="number"
                                value={budget}
                                onChange={e => { setBudget(e.target.value); setErrors({ ...errors, budget: '' }); }}
                                placeholder="0"
                                min="0"
                                className={`w-full bg-slate-50 dark:bg-[#2d1820] dark:text-slate-200 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-pink-400 ${errors.budget ? 'border-rose-400' : 'border-slate-200 dark:border-[#5a2b35]/40'}`}
                            />
                            {errors.budget && <p className="text-xs text-rose-500 mt-1">{errors.budget}</p>}
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 block">Moneda</label>
                            <select
                                value={baseCurrency}
                                onChange={e => setBaseCurrency(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-[#2d1820] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-xl px-2 py-3 text-sm focus:outline-none focus:border-pink-400"
                            >
                                {COMMON_CURRENCIES.map(c => (
                                    <option key={c.code} value={c.code}>{c.code}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Avanzado: color, transporte, multi-destino */}
                    <button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="w-full flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 py-2"
                    >
                        <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">tune</span>
                            Opciones avanzadas
                        </span>
                        <span className="material-symbols-outlined text-sm">{showAdvanced ? 'expand_less' : 'expand_more'}</span>
                    </button>

                    {showAdvanced && (
                        <div className="space-y-5 border-l-2 border-pink-100 dark:border-pink-900/30 pl-3">
                            {/* Color */}
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 block">Color del viaje</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {(Object.keys(TRIP_COLOR_CONFIG) as TripColor[]).map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setColor(c)}
                                            className={`p-2 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${color === c ? 'border-pink-400 bg-pink-50 dark:bg-pink-900/20' : 'border-slate-200 dark:border-[#5a2b35]/30'}`}
                                        >
                                            <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${TRIP_COLOR_CONFIG[c].gradient}`} />
                                            <span className="text-[9px] font-medium text-slate-600 dark:text-slate-300">{TRIP_COLOR_CONFIG[c].label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Transporte */}
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 block">Transporte principal</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {TRANSPORT_OPTIONS.map(t => (
                                        <button
                                            key={t.key}
                                            type="button"
                                            onClick={() => setTransport(transport === t.key ? undefined : t.key)}
                                            className={`p-2 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${transport === t.key ? 'border-pink-400 bg-pink-50 dark:bg-pink-900/20' : 'border-slate-200 dark:border-[#5a2b35]/30'}`}
                                        >
                                            <span className="material-symbols-outlined text-lg text-pink-400">{t.icon}</span>
                                            <span className="text-[9px] font-medium text-slate-600 dark:text-slate-300">{t.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Multi-destino */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Multi-destino (paradas)</label>
                                    <button
                                        type="button"
                                        onClick={addDestination}
                                        className="text-xs text-pink-500 font-bold flex items-center gap-1"
                                    >
                                        <span className="material-symbols-outlined text-sm">add</span>
                                        Agregar
                                    </button>
                                </div>
                                {errors.destinations && <p className="text-xs text-rose-500 mb-2">{errors.destinations}</p>}
                                {destinations.length === 0 ? (
                                    <p className="text-xs text-slate-400">Si tu viaje tiene varias ciudades, agrégalas aquí.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {destinations.map((d, idx) => (
                                            <div key={d.id} className="bg-slate-50 dark:bg-[#2d1820] rounded-xl p-3 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-pink-500">#{idx + 1}</span>
                                                    <input
                                                        type="text"
                                                        value={d.name}
                                                        onChange={e => updateDestination(d.id, { name: e.target.value })}
                                                        placeholder="Nombre de la parada"
                                                        className="flex-1 bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-2 py-1.5 text-xs"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeDestination(d.id)}
                                                        className="text-slate-400 hover:text-rose-500"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">close</span>
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input
                                                        type="date"
                                                        value={d.startDate}
                                                        min={startDate}
                                                        max={endDate}
                                                        onChange={e => updateDestination(d.id, { startDate: e.target.value })}
                                                        className="bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-2 py-1.5 text-xs"
                                                    />
                                                    <input
                                                        type="date"
                                                        value={d.endDate}
                                                        min={d.startDate || startDate}
                                                        max={endDate}
                                                        onChange={e => updateDestination(d.id, { endDate: e.target.value })}
                                                        className="bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-2 py-1.5 text-xs"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Notas */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 block">Notas</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Notas adicionales..."
                            rows={3}
                            className="w-full bg-slate-50 dark:bg-[#2d1820] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-pink-400 resize-none"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 bg-white dark:bg-[#1a0d10] px-6 pb-28 sm:pb-6 pt-2 border-t border-slate-100 dark:border-[#5a2b35]/30">
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={formIsValid}
                        className="w-full bg-gradient-to-r from-pink-400 to-rose-500 text-white rounded-2xl py-4 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                                Guardando...
                            </>
                        ) : (
                            editTrip ? 'Guardar Cambios ✏️' : 'Crear Viaje ✈️'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
