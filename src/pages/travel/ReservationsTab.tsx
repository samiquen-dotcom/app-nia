import React, { useState, useEffect } from 'react';
import type { Trip, Reservation, ReservationType, ItineraryActivity, ActivityType, FinanceAccount, FinanceData, Transaction } from '../../types';
import { generateId, RESERVATION_TYPE_CONFIG, formatCurrency, formatDate, convertCurrency } from './utils';
import { COMMON_CURRENCIES } from './countries';
import { ConfirmModal } from './ConfirmModal';
import { useAuth } from '../../context/AuthContext';
import { FirestoreService, Features } from '../../services/firestore';

const RESERVATION_TO_ACTIVITY_TYPE: Record<ReservationType, ActivityType> = {
    flight: 'transport',
    hotel: 'rest',
    car: 'transport',
    transfer: 'transport',
    tour: 'tour',
    restaurant: 'food',
    event: 'event',
    insurance: 'other',
    other: 'other',
};

export const ReservationsTab: React.FC<{
    trip: Trip;
    onUpdate: (trip: Trip) => void;
}> = ({ trip, onUpdate }) => {
    const { user } = useAuth();
    const [editing, setEditing] = useState<Reservation | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [financeAccounts, setFinanceAccounts] = useState<FinanceAccount[]>([]);
    const [showAccountPicker, setShowAccountPicker] = useState<Reservation | null>(null);
    const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const reservations = trip.reservations || [];
    const baseCurrency = trip.baseCurrency || 'COP';

    useEffect(() => {
        if (!user) return;
        FirestoreService.getFeatureData(user.uid, Features.FINANCE).then(data => {
            if (data && (data as FinanceData).accounts) {
                setFinanceAccounts((data as FinanceData).accounts);
            }
        });
    }, [user]);

    const sorted = [...reservations].sort((a, b) => {
        const aDate = a.startDate || '9999-99';
        const bDate = b.startDate || '9999-99';
        return aDate.localeCompare(bDate);
    });

    /**
     * Si la reserva tiene fecha + hora y un día del itinerario que coincide, agrega o
     * actualiza la actividad vinculada a esa reserva.
     */
    const syncReservationToItinerary = (resv: Reservation, currentItinerary?: Trip['itinerary']) => {
        const itinerary = currentItinerary || trip.itinerary || [];
        if (itinerary.length === 0 || !resv.startDate) return itinerary;

        // Determinar la hora más relevante
        const time = resv.departureTime || resv.checkInTime || '12:00';
        const day = itinerary.find(d => d.date === resv.startDate);
        if (!day) return itinerary; // No hay día en el itinerario

        const cfg = RESERVATION_TYPE_CONFIG[resv.type];
        const description = `${cfg.label}: ${resv.title}`;

        // Buscar actividad ya vinculada
        const existingIdx = day.activities.findIndex(a => a.linkedReservationId === resv.id);
        const updatedActivity: ItineraryActivity = {
            id: existingIdx >= 0 ? day.activities[existingIdx].id : generateId(),
            time,
            description,
            location: resv.address || resv.departureAirport || undefined,
            completed: existingIdx >= 0 ? day.activities[existingIdx].completed : false,
            type: RESERVATION_TO_ACTIVITY_TYPE[resv.type],
            estimatedCost: resv.cost,
            currency: resv.currency,
            linkedReservationId: resv.id,
            notes: resv.confirmationCode ? `Cód: ${resv.confirmationCode}` : undefined,
        };

        return itinerary.map(d => {
            if (d.id !== day.id) return d;
            const newActivities = existingIdx >= 0
                ? d.activities.map((a, i) => i === existingIdx ? updatedActivity : a)
                : [...d.activities, updatedActivity];
            return { ...d, activities: newActivities.sort((a, b) => a.time.localeCompare(b.time)) };
        });
    };

    const removeReservationFromItinerary = (resvId: string) => {
        const itinerary = trip.itinerary || [];
        if (itinerary.length === 0) return itinerary;
        return itinerary.map(d => ({
            ...d,
            activities: d.activities.filter(a => a.linkedReservationId !== resvId),
        }));
    };

    const saveReservation = (r: Reservation) => {
        const exists = reservations.some(x => x.id === r.id);
        const updated = exists
            ? reservations.map(x => x.id === r.id ? r : x)
            : [...reservations, r];
        const newItinerary = syncReservationToItinerary(r);
        onUpdate({ ...trip, reservations: updated, itinerary: newItinerary });
        setEditing(null);
        setShowForm(false);
    };

    const deleteReservation = (id: string) => {
        const newItinerary = removeReservationFromItinerary(id);
        onUpdate({
            ...trip,
            reservations: reservations.filter(r => r.id !== id),
            itinerary: newItinerary,
        });
        setConfirmDelete(null);
    };

    const togglePaid = (r: Reservation) => {
        // Si hay costo y se va a marcar como paid Y no está sync, ofrecer sync a Finance
        if (!r.paid && r.cost && r.cost > 0 && !r.syncedToFinance && financeAccounts.length > 0) {
            setShowAccountPicker({ ...r, paid: true });
            return;
        }
        saveReservation({ ...r, paid: !r.paid });
    };

    const syncToFinance = async (r: Reservation, accountId: string) => {
        if (!user || !r.cost) return;
        try {
            const account = financeAccounts.find(a => a.id === accountId);
            const amountInBase = (r.currency && r.currency !== baseCurrency)
                ? convertCurrency(r.cost, r.currency, baseCurrency)
                : r.cost;
            const cfg = RESERVATION_TYPE_CONFIG[r.type];

            const tx: Transaction = {
                id: Date.now(),
                type: 'expense',
                accountId,
                amount: amountInBase,
                category: `Viaje: ${trip.destination}`,
                emoji: '📌',
                description: `${cfg.label}: ${r.title}`,
                dateISO: r.startDate || trip.startDate,
                date: r.startDate || trip.startDate,
                sourceType: 'travel',
                sourceTripId: trip.id,
                sourceExpenseId: r.id,
            };

            await FirestoreService.addTransaction(user.uid, tx);

            const updated: Reservation = {
                ...r,
                paid: true,
                syncedToFinance: true,
            };
            saveReservation(updated);
            setSyncMessage({ type: 'success', text: `Pagado desde ${account?.name || 'cuenta'}` });
            setShowAccountPicker(null);
            setTimeout(() => setSyncMessage(null), 3000);
        } catch (e) {
            console.error(e);
            setSyncMessage({ type: 'error', text: 'Error al sincronizar con Finanzas' });
            setTimeout(() => setSyncMessage(null), 3000);
        }
    };

    const totalCost = reservations.reduce((sum, r) => sum + (r.cost || 0), 0);
    const paidCount = reservations.filter(r => r.paid).length;

    return (
        <div className="space-y-3 sm:space-y-4">
            {/* Sync notification */}
            {syncMessage && (
                <div className={`rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-2 ${syncMessage.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-300'}`}>
                    <span className="material-symbols-outlined text-sm">{syncMessage.type === 'success' ? 'check_circle' : 'error'}</span>
                    {syncMessage.text}
                </div>
            )}

            {/* Resumen */}
            {reservations.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-slate-50 dark:bg-[#2d1820] rounded-xl p-3 text-center">
                        <p className="text-[10px] text-slate-400 font-medium">Reservas</p>
                        <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{reservations.length}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-green-500 font-medium">Pagadas</p>
                        <p className="text-lg font-bold text-green-600 dark:text-green-300">{paidCount}/{reservations.length}</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-blue-500 font-medium">Total</p>
                        <p className="text-sm font-bold text-blue-600 dark:text-blue-300">{formatCurrency(totalCost, trip.baseCurrency)}</p>
                    </div>
                </div>
            )}

            {/* Lista */}
            {sorted.length === 0 ? (
                <div className="text-center py-12">
                    <span className="material-symbols-outlined text-5xl text-slate-200 dark:text-slate-600 mb-3">bookmark_border</span>
                    <p className="text-sm text-slate-400 dark:text-slate-500 font-medium mb-1">No tienes reservas registradas</p>
                    <p className="text-xs text-slate-300 dark:text-slate-600">Vuelos, hoteles, tours, autos…</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {sorted.map(r => (
                        <ReservationCard
                            key={r.id}
                            reservation={r}
                            onEdit={() => setEditing(r)}
                            onDelete={() => setConfirmDelete(r.id)}
                            onTogglePaid={() => togglePaid(r)}
                        />
                    ))}
                </div>
            )}

            {/* Botón agregar */}
            <button
                onClick={() => { setEditing(null); setShowForm(true); }}
                className="w-full border-2 border-dashed border-slate-200 dark:border-[#5a2b35]/30 rounded-xl py-3 text-sm text-slate-400 hover:text-pink-400 hover:border-pink-300 transition-colors flex items-center justify-center gap-1"
            >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                Agregar reserva
            </button>

            {/* Form */}
            {(showForm || editing) && (
                <ReservationForm
                    initial={editing}
                    tripCurrency={trip.baseCurrency}
                    onSave={saveReservation}
                    onCancel={() => { setEditing(null); setShowForm(false); }}
                />
            )}

            {/* Account picker for Finance sync */}
            {showAccountPicker && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-black/50">
                    <div className="bg-white dark:bg-[#2d1820] w-full max-w-sm rounded-2xl p-5 shadow-2xl">
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">Marcar como pagada</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">¿De qué cuenta sale {formatCurrency(showAccountPicker.cost || 0, showAccountPicker.currency || baseCurrency)}? También se registrará en Finanzas.</p>
                        <div className="space-y-1 max-h-72 overflow-y-auto mb-3">
                            {financeAccounts.map(acc => (
                                <button
                                    key={acc.id}
                                    onClick={() => syncToFinance(showAccountPicker, acc.id)}
                                    className="w-full flex items-center justify-between text-left bg-slate-50 dark:bg-[#1a0d10] hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-xl px-3 py-2.5"
                                >
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{acc.name}</span>
                                    <span className="text-xs text-slate-400">{formatCurrency(acc.balance ?? acc.initialBalance ?? 0, baseCurrency)}</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => { saveReservation({ ...showAccountPicker, paid: true }); setShowAccountPicker(null); }}
                                className="flex-1 py-2 rounded-xl bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-300 font-bold text-xs"
                            >
                                Solo marcar pagada
                            </button>
                            <button
                                onClick={() => setShowAccountPicker(null)}
                                className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                open={!!confirmDelete}
                title="¿Eliminar reserva?"
                message="Si está vinculada a una actividad del itinerario, también se eliminará."
                variant="danger"
                confirmLabel="Eliminar"
                icon="delete"
                onConfirm={() => confirmDelete && deleteReservation(confirmDelete)}
                onCancel={() => setConfirmDelete(null)}
            />
        </div>
    );
};

const ReservationCard: React.FC<{
    reservation: Reservation;
    onEdit: () => void;
    onDelete: () => void;
    onTogglePaid: () => void;
}> = ({ reservation, onEdit, onDelete, onTogglePaid }) => {
    const cfg = RESERVATION_TYPE_CONFIG[reservation.type];

    return (
        <div className="bg-slate-50 dark:bg-[#2d1820] rounded-2xl overflow-hidden">
            <div className={`h-1 bg-gradient-to-r ${cfg.gradient}`} />
            <div className="p-3">
                <div className="flex items-start gap-2 mb-2">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.color.replace('text-', 'bg-').replace('500', '100')} dark:bg-slate-700`}>
                        <span className={`material-symbols-outlined text-base ${cfg.color}`}>{cfg.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{reservation.title}</p>
                        <p className="text-[10px] text-slate-400">
                            {cfg.label}{reservation.provider ? ` · ${reservation.provider}` : ''}
                        </p>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={onEdit}
                            className="text-slate-400 hover:text-pink-500 p-1"
                        >
                            <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button
                            onClick={onDelete}
                            className="text-slate-400 hover:text-rose-500 p-1"
                        >
                            <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                    </div>
                </div>

                {/* Detalles tipo-específicos */}
                {reservation.type === 'flight' && (
                    <div className="bg-white dark:bg-[#1a0d10] rounded-xl p-2 mb-2 text-xs space-y-1">
                        {(reservation.departureAirport || reservation.arrivalAirport) && (
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col items-center">
                                    <span className="font-bold text-slate-700 dark:text-slate-200">{reservation.departureAirport || '—'}</span>
                                    {reservation.departureTime && <span className="text-[10px] text-slate-400">{reservation.departureTime}</span>}
                                </div>
                                <span className="material-symbols-outlined text-slate-400">flight</span>
                                <div className="flex flex-col items-center">
                                    <span className="font-bold text-slate-700 dark:text-slate-200">{reservation.arrivalAirport || '—'}</span>
                                    {reservation.arrivalTime && <span className="text-[10px] text-slate-400">{reservation.arrivalTime}</span>}
                                </div>
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
                            {reservation.airline && <span>✈️ {reservation.airline}</span>}
                            {reservation.flightNumber && <span>#{reservation.flightNumber}</span>}
                            {reservation.seat && <span>💺 {reservation.seat}</span>}
                            {reservation.departureTerminal && <span>T: {reservation.departureTerminal}</span>}
                            {reservation.departureGate && <span>G: {reservation.departureGate}</span>}
                        </div>
                    </div>
                )}

                {reservation.type === 'hotel' && (reservation.checkInTime || reservation.checkOutTime || reservation.address) && (
                    <div className="bg-white dark:bg-[#1a0d10] rounded-xl p-2 mb-2 text-xs space-y-1">
                        {reservation.address && (
                            <p className="text-slate-600 dark:text-slate-300 flex items-start gap-1">
                                <span className="material-symbols-outlined text-xs mt-0.5">location_on</span>
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(reservation.address)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 hover:text-blue-500 hover:underline"
                                >
                                    {reservation.address}
                                </a>
                            </p>
                        )}
                        <div className="flex gap-3 text-[10px] text-slate-500">
                            {reservation.checkInTime && <span>🛎️ Check-in: {reservation.checkInTime}</span>}
                            {reservation.checkOutTime && <span>🚪 Check-out: {reservation.checkOutTime}</span>}
                            {reservation.roomNumber && <span>🏨 Hab: {reservation.roomNumber}</span>}
                        </div>
                    </div>
                )}

                {/* Footer común */}
                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                        {reservation.startDate && (
                            <span className="text-slate-500 flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">calendar_today</span>
                                {formatDate(reservation.startDate)}
                                {reservation.endDate && reservation.endDate !== reservation.startDate && ` → ${formatDate(reservation.endDate)}`}
                            </span>
                        )}
                        {reservation.confirmationCode && (
                            <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-600 dark:text-slate-300">
                                {reservation.confirmationCode}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {reservation.cost != null && reservation.cost > 0 && (
                            <span className="font-bold text-slate-700 dark:text-slate-200">
                                {formatCurrency(reservation.cost, reservation.currency)}
                            </span>
                        )}
                        <button
                            onClick={onTogglePaid}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${reservation.paid ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}
                        >
                            {reservation.paid ? (reservation.syncedToFinance ? '✓ Pagada en Finanzas' : '✓ Pagada') : 'Sin pagar'}
                        </button>
                    </div>
                </div>

                {reservation.contact && (
                    <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">call</span>
                        {reservation.contact}
                    </p>
                )}
                {reservation.referenceUrl && (
                    <a
                        href={reservation.referenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-500 hover:underline mt-1 flex items-center gap-1"
                    >
                        <span className="material-symbols-outlined text-xs">link</span>
                        Ver reserva online
                    </a>
                )}
                {reservation.notes && (
                    <p className="text-[10px] text-slate-400 mt-1 italic">{reservation.notes}</p>
                )}
            </div>
        </div>
    );
};

const ReservationForm: React.FC<{
    initial: Reservation | null;
    tripCurrency?: string;
    onSave: (r: Reservation) => void;
    onCancel: () => void;
}> = ({ initial, tripCurrency, onSave, onCancel }) => {
    const [r, setR] = useState<Reservation>(initial || {
        id: generateId(),
        type: 'flight',
        title: '',
        currency: tripCurrency || 'COP',
    });

    const update = <K extends keyof Reservation>(key: K, value: Reservation[K]) => {
        setR(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        if (!r.title.trim()) return;
        onSave({ ...r, title: r.title.trim() });
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
            <div className="relative w-full sm:max-w-md max-h-[100vh] sm:max-h-[90vh] flex flex-col bg-white dark:bg-[#1a0d10] rounded-t-3xl sm:rounded-3xl shadow-2xl">
                <div className="flex-shrink-0 px-5 pt-5 pb-3 border-b border-slate-100 dark:border-[#5a2b35]/30 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                        {initial ? 'Editar reserva' : 'Nueva reserva'}
                    </h3>
                    <button onClick={onCancel} className="text-slate-400">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">Tipo</label>
                        <div className="grid grid-cols-3 gap-1.5">
                            {(Object.keys(RESERVATION_TYPE_CONFIG) as ReservationType[]).map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => update('type', t)}
                                    className={`p-2 rounded-lg border-2 flex flex-col items-center gap-0.5 transition-all ${r.type === t ? 'border-pink-400 bg-pink-50 dark:bg-pink-900/20' : 'border-slate-200 dark:border-[#5a2b35]/30'}`}
                                >
                                    <span className={`material-symbols-outlined text-base ${RESERVATION_TYPE_CONFIG[t].color}`}>{RESERVATION_TYPE_CONFIG[t].icon}</span>
                                    <span className="text-[9px] font-medium text-slate-600 dark:text-slate-300">{RESERVATION_TYPE_CONFIG[t].label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <Input label="Título *" value={r.title} onChange={v => update('title', v)} placeholder="Ej: Avianca Bogotá → Cancún" />
                    <div className="grid grid-cols-2 gap-2">
                        <Input label="Proveedor" value={r.provider || ''} onChange={v => update('provider', v)} placeholder="Avianca, Hotel Riu..." />
                        <Input label="Código de reserva (PNR)" value={r.confirmationCode || ''} onChange={v => update('confirmationCode', v)} placeholder="ABC123" />
                    </div>

                    {r.type === 'flight' && (
                        <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-xl p-3 space-y-2">
                            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Detalles del vuelo</p>
                            <div className="grid grid-cols-2 gap-2">
                                <Input label="Aerolínea" value={r.airline || ''} onChange={v => update('airline', v)} placeholder="Avianca" />
                                <Input label="Nº de vuelo" value={r.flightNumber || ''} onChange={v => update('flightNumber', v)} placeholder="AV245" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Input label="Salida (aeropuerto)" value={r.departureAirport || ''} onChange={v => update('departureAirport', v)} placeholder="BOG" />
                                <Input label="Hora salida" value={r.departureTime || ''} onChange={v => update('departureTime', v)} type="time" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Input label="Llegada (aeropuerto)" value={r.arrivalAirport || ''} onChange={v => update('arrivalAirport', v)} placeholder="CUN" />
                                <Input label="Hora llegada" value={r.arrivalTime || ''} onChange={v => update('arrivalTime', v)} type="time" />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <Input label="Terminal" value={r.departureTerminal || ''} onChange={v => update('departureTerminal', v)} placeholder="T2" />
                                <Input label="Puerta" value={r.departureGate || ''} onChange={v => update('departureGate', v)} placeholder="G15" />
                                <Input label="Asiento" value={r.seat || ''} onChange={v => update('seat', v)} placeholder="14A" />
                            </div>
                        </div>
                    )}

                    {r.type === 'hotel' && (
                        <div className="bg-purple-50/50 dark:bg-purple-900/10 rounded-xl p-3 space-y-2">
                            <p className="text-[10px] font-bold text-purple-500 uppercase tracking-wider">Detalles del hotel</p>
                            <Input label="Dirección" value={r.address || ''} onChange={v => update('address', v)} placeholder="Calle..." />
                            <div className="grid grid-cols-2 gap-2">
                                <Input label="Check-in" value={r.checkInTime || ''} onChange={v => update('checkInTime', v)} type="time" />
                                <Input label="Check-out" value={r.checkOutTime || ''} onChange={v => update('checkOutTime', v)} type="time" />
                            </div>
                            <Input label="Número habitación" value={r.roomNumber || ''} onChange={v => update('roomNumber', v)} placeholder="Hab 305" />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                        <Input label={r.type === 'hotel' ? 'Check-in (fecha)' : 'Fecha inicio'} value={r.startDate || ''} onChange={v => update('startDate', v)} type="date" />
                        <Input label={r.type === 'hotel' ? 'Check-out (fecha)' : 'Fecha fin'} value={r.endDate || ''} onChange={v => update('endDate', v)} type="date" />
                    </div>

                    {r.startDate && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2 text-[10px] text-blue-600 dark:text-blue-300">
                            💡 Si el itinerario tiene este día, esta reserva aparecerá automáticamente como actividad
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                            <Input label="Costo" value={r.cost?.toString() || ''} onChange={v => update('cost', parseFloat(v) || undefined)} type="number" placeholder="0" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">Moneda</label>
                            <select
                                value={r.currency || 'COP'}
                                onChange={e => update('currency', e.target.value)}
                                className="w-full bg-slate-50 dark:bg-[#2d1820] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-2 py-2 text-sm"
                            >
                                {COMMON_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                            </select>
                        </div>
                    </div>

                    <Input label="Contacto (teléfono / email)" value={r.contact || ''} onChange={v => update('contact', v)} placeholder="+52 998 123 4567" />
                    <Input label="Link a reserva online" value={r.referenceUrl || ''} onChange={v => update('referenceUrl', v)} placeholder="https://..." />

                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">Notas</label>
                        <textarea
                            value={r.notes || ''}
                            onChange={e => update('notes', e.target.value)}
                            rows={2}
                            className="w-full bg-slate-50 dark:bg-[#2d1820] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-xl px-3 py-2 text-sm resize-none"
                            placeholder="Detalles extra..."
                        />
                    </div>

                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={!!r.paid}
                            onChange={e => update('paid', e.target.checked)}
                            className="w-4 h-4 accent-pink-500"
                        />
                        Ya está pagada
                    </label>
                </div>

                <div className="flex-shrink-0 px-5 pb-28 sm:pb-5 pt-2 flex gap-2 border-t border-slate-100 dark:border-[#5a2b35]/30">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!r.title.trim()}
                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-400 to-rose-500 text-white font-bold text-sm disabled:opacity-40"
                    >
                        Guardar
                    </button>
                </div>
            </div>
        </div>
    );
};

const Input: React.FC<{
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
    placeholder?: string;
}> = ({ label, value, onChange, type = 'text', placeholder }) => (
    <div>
        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">{label}</label>
        <input
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-slate-50 dark:bg-[#2d1820] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-400"
        />
    </div>
);
