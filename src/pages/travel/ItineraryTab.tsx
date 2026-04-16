import React, { useState, useMemo } from 'react';
import type { Trip, ItineraryDay, ItineraryActivity, ActivityType, TravelExpense, ExpenseCategory } from '../../types';
import { generateId, ACTIVITY_TYPE_CONFIG, detectTimeConflicts, formatDuration, formatCurrency } from './utils';
import { ConfirmModal } from './ConfirmModal';

const ACTIVITY_TO_EXPENSE_CATEGORY: Record<ActivityType, ExpenseCategory> = {
    food: 'comida',
    tour: 'actividades',
    transport: 'transport',
    rest: 'alojamiento',
    meeting: 'otros',
    shopping: 'compras',
    event: 'actividades',
    other: 'otros',
};

export const ItineraryTab: React.FC<{
    trip: Trip;
    onUpdate: (trip: Trip) => void;
}> = ({ trip, onUpdate }) => {
    const [expandedDay, setExpandedDay] = useState<string | null>(null);
    const [editingActivity, setEditingActivity] = useState<{ dayId: string; activity: ItineraryActivity | null } | null>(null);
    const [confirmDeleteDay, setConfirmDeleteDay] = useState<string | null>(null);

    const itinerary = trip.itinerary || [];

    // Conflictos por día
    const conflictsByDay = useMemo(() => {
        const map: Record<string, Set<string>> = {};
        itinerary.forEach(day => {
            map[day.id] = detectTimeConflicts(day.activities);
        });
        return map;
    }, [itinerary]);

    const initializeDays = () => {
        if (!trip.startDate || !trip.endDate) return;

        const days: ItineraryDay[] = [];
        const start = new Date(trip.startDate + 'T00:00:00');
        const end = new Date(trip.endDate + 'T00:00:00');
        const currentDate = new Date(start);
        let dayNumber = 1;

        while (currentDate <= end) {
            const dateStr = currentDate.toISOString().split('T')[0];
            days.push({
                id: generateId(),
                date: dateStr,
                dayNumber,
                activities: [],
            });
            currentDate.setDate(currentDate.getDate() + 1);
            dayNumber++;
        }

        onUpdate({ ...trip, itinerary: days });
    };

    const toggleActivity = (dayId: string, activityId: string) => {
        onUpdate({
            ...trip,
            itinerary: itinerary.map(day =>
                day.id === dayId
                    ? { ...day, activities: day.activities.map(a => a.id === activityId ? { ...a, completed: !a.completed } : a) }
                    : day
            ),
        });
    };

    const deleteActivity = (dayId: string, activityId: string) => {
        onUpdate({
            ...trip,
            itinerary: itinerary.map(day =>
                day.id === dayId
                    ? { ...day, activities: day.activities.filter(a => a.id !== activityId) }
                    : day
            ),
        });
    };

    const saveActivity = (dayId: string, activity: ItineraryActivity) => {
        onUpdate({
            ...trip,
            itinerary: itinerary.map(day =>
                day.id === dayId
                    ? {
                        ...day,
                        activities: (day.activities.some(a => a.id === activity.id)
                            ? day.activities.map(a => a.id === activity.id ? activity : a)
                            : [...day.activities, activity]).sort((a, b) => a.time.localeCompare(b.time)),
                    }
                    : day
            ),
        });
        setEditingActivity(null);
    };

    const deleteDay = (dayId: string) => {
        onUpdate({ ...trip, itinerary: itinerary.filter(day => day.id !== dayId) });
        setConfirmDeleteDay(null);
    };

    /** Convierte una actividad con costo en un gasto del viaje */
    const convertToExpense = (dayId: string, activity: ItineraryActivity) => {
        if (!activity.estimatedCost) return;
        const expense: TravelExpense = {
            id: generateId(),
            category: ACTIVITY_TO_EXPENSE_CATEGORY[activity.type || 'other'],
            amount: activity.estimatedCost,
            currency: activity.currency || trip.baseCurrency,
            description: activity.description,
            dateISO: itinerary.find(d => d.id === dayId)?.date || trip.startDate,
            paidBy: 'me',
            linkedActivityId: activity.id,
        };
        onUpdate({
            ...trip,
            expenses: [...trip.expenses, expense],
            itinerary: itinerary.map(day =>
                day.id === dayId
                    ? { ...day, activities: day.activities.map(a => a.id === activity.id ? { ...a, linkedExpenseId: expense.id } : a) }
                    : day
            ),
        });
    };

    const totalActivities = itinerary.reduce((sum, day) => sum + day.activities.length, 0);
    const completedActivities = itinerary.reduce((sum, day) => sum + day.activities.filter(a => a.completed).length, 0);
    const percent = totalActivities > 0 ? (completedActivities / totalActivities) * 100 : 0;
    const totalEstimatedCost = itinerary.reduce((s, d) => s + d.activities.reduce((s2, a) => s2 + (a.estimatedCost || 0), 0), 0);

    return (
        <div className="space-y-3 sm:space-y-4">
            {itinerary.length === 0 && (
                <div className="text-center py-8">
                    <span className="material-symbols-outlined text-5xl sm:text-6xl text-slate-200 dark:text-slate-600 mb-3 sm:mb-4">calendar_month</span>
                    <p className="text-sm text-slate-400 dark:text-slate-500 font-medium mb-4">No hay itinerario creado</p>
                    <button
                        onClick={initializeDays}
                        disabled={!trip.startDate || !trip.endDate}
                        className="bg-gradient-to-r from-blue-400 to-indigo-500 text-white rounded-xl px-5 sm:px-6 py-3 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg transition-all"
                    >
                        Generar días automáticamente
                    </button>
                </div>
            )}

            {totalActivities > 0 && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 rounded-2xl p-4 border border-green-100 dark:border-green-900/20">
                    <div className="flex justify-between text-xs mb-2">
                        <span className="text-green-600 dark:text-green-300 font-bold">Actividades completadas</span>
                        <span className="text-green-500 font-bold">{completedActivities}/{totalActivities}</span>
                    </div>
                    <div className="h-2 bg-white/50 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                        <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all" style={{ width: `${percent}%` }} />
                    </div>
                    {totalEstimatedCost > 0 && (
                        <p className="text-[10px] text-green-600 dark:text-green-300">
                            💰 Costo estimado: <span className="font-bold">{formatCurrency(totalEstimatedCost, trip.baseCurrency)}</span>
                        </p>
                    )}
                </div>
            )}

            {itinerary.map(day => {
                const date = new Date(day.date + 'T00:00:00');
                const dateStr = date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
                const isExpanded = expandedDay === day.id || day.activities.length > 0;
                const conflicts = conflictsByDay[day.id] || new Set();
                const dayCost = day.activities.reduce((s, a) => s + (a.estimatedCost || 0), 0);

                return (
                    <div key={day.id} className="bg-slate-50 dark:bg-[#2d1820] rounded-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-slate-100 dark:border-[#5a2b35]/20">
                            <button
                                onClick={() => setExpandedDay(expandedDay === day.id ? null : day.id)}
                                className="flex-1 text-left"
                            >
                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                    Día {day.dayNumber}
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{dateStr}</p>
                                <div className="flex gap-1 mt-1 flex-wrap">
                                    {day.activities.length > 0 && (
                                        <span className="text-[9px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-bold">
                                            {day.activities.filter(a => a.completed).length}/{day.activities.length} hechas
                                        </span>
                                    )}
                                    {dayCost > 0 && (
                                        <span className="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-bold">
                                            {formatCurrency(dayCost, trip.baseCurrency)}
                                        </span>
                                    )}
                                    {conflicts.size > 0 && (
                                        <span className="text-[9px] bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300 px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                                            ⚠️ Conflictos
                                        </span>
                                    )}
                                </div>
                            </button>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setEditingActivity({ dayId: day.id, activity: null })}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                >
                                    <span className="material-symbols-outlined">add_circle</span>
                                </button>
                                <button
                                    onClick={() => setConfirmDeleteDay(day.id)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-400"
                                >
                                    <span className="material-symbols-outlined">delete</span>
                                </button>
                            </div>
                        </div>

                        {isExpanded && (
                            <div className="divide-y divide-slate-100 dark:divide-[#5a2b35]/20">
                                {day.activities.length === 0 ? (
                                    <button
                                        onClick={() => setEditingActivity({ dayId: day.id, activity: null })}
                                        className="w-full py-3 text-xs text-slate-400 hover:text-blue-400 transition-colors flex items-center justify-center gap-1"
                                    >
                                        <span className="material-symbols-outlined text-sm">add_circle</span>
                                        Agregar actividad
                                    </button>
                                ) : (
                                    day.activities.map(activity => (
                                        <ActivityRow
                                            key={activity.id}
                                            activity={activity}
                                            isConflict={conflicts.has(activity.id)}
                                            tripCurrency={trip.baseCurrency}
                                            onToggle={() => toggleActivity(day.id, activity.id)}
                                            onEdit={() => setEditingActivity({ dayId: day.id, activity })}
                                            onDelete={() => deleteActivity(day.id, activity.id)}
                                            onConvertToExpense={() => convertToExpense(day.id, activity)}
                                        />
                                    ))
                                )}
                            </div>
                        )}

                        {editingActivity?.dayId === day.id && (
                            <ActivityForm
                                initial={editingActivity.activity}
                                tripCurrency={trip.baseCurrency}
                                onSave={(a) => saveActivity(day.id, a)}
                                onCancel={() => setEditingActivity(null)}
                            />
                        )}
                    </div>
                );
            })}

            <ConfirmModal
                open={!!confirmDeleteDay}
                title="¿Eliminar este día?"
                message="Se borrarán todas las actividades de este día."
                variant="danger"
                confirmLabel="Eliminar día"
                icon="delete"
                onConfirm={() => confirmDeleteDay && deleteDay(confirmDeleteDay)}
                onCancel={() => setConfirmDeleteDay(null)}
            />
        </div>
    );
};

const ActivityRow: React.FC<{
    activity: ItineraryActivity;
    isConflict: boolean;
    tripCurrency?: string;
    onToggle: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onConvertToExpense: () => void;
}> = ({ activity, isConflict, tripCurrency, onToggle, onEdit, onDelete, onConvertToExpense }) => {
    const cfg = ACTIVITY_TYPE_CONFIG[activity.type || 'other'];

    return (
        <div className={`flex items-start gap-3 px-4 py-3 group ${isConflict ? 'bg-rose-50/50 dark:bg-rose-900/10' : ''}`}>
            <button
                onClick={onToggle}
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${activity.completed ? 'bg-green-400 border-green-400 text-white' : 'border-slate-300 dark:border-slate-600'}`}
            >
                {activity.completed && <span className="material-symbols-outlined text-xs">check</span>}
            </button>
            <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 flex flex-col items-center">
                        <span className="text-xs font-bold text-blue-500 dark:text-blue-400">{activity.time}</span>
                        {activity.duration && (
                            <span className="text-[9px] text-slate-400">{formatDuration(activity.duration)}</span>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                            <span className={`material-symbols-outlined text-sm ${cfg.color}`}>{cfg.icon}</span>
                            <p className={`text-sm flex-1 ${activity.completed ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                                {activity.description}
                            </p>
                        </div>
                        {activity.location && (
                            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">location_on</span>
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.location)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-blue-500 hover:underline"
                                >
                                    {activity.location}
                                </a>
                            </p>
                        )}
                        {activity.notes && (
                            <p className="text-xs text-slate-400 mt-0.5 italic">{activity.notes}</p>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                            {activity.estimatedCost != null && activity.estimatedCost > 0 && (
                                <span className="text-[10px] text-amber-500 font-bold">
                                    {formatCurrency(activity.estimatedCost, activity.currency || tripCurrency)}
                                </span>
                            )}
                            {activity.linkedExpenseId && (
                                <span className="text-[10px] text-green-500 flex items-center gap-0.5">
                                    <span className="material-symbols-outlined text-[10px]">link</span> Gasto registrado
                                </span>
                            )}
                            {isConflict && (
                                <span className="text-[10px] text-rose-500 font-bold">⚠️ Misma hora que otra</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex flex-col items-end gap-1">
                {activity.estimatedCost != null && activity.estimatedCost > 0 && !activity.linkedExpenseId && (
                    <button
                        onClick={onConvertToExpense}
                        className="text-[9px] text-amber-500 hover:text-amber-700 font-bold whitespace-nowrap"
                        title="Convertir en gasto"
                    >
                        💰 Gasto
                    </button>
                )}
                <button
                    onClick={onEdit}
                    className="text-slate-400 hover:text-blue-400 transition-all"
                >
                    <span className="material-symbols-outlined text-base">edit</span>
                </button>
                <button
                    onClick={onDelete}
                    className="text-slate-400 hover:text-rose-400 transition-all"
                >
                    <span className="material-symbols-outlined text-base">close</span>
                </button>
            </div>
        </div>
    );
};

const ActivityForm: React.FC<{
    initial: ItineraryActivity | null;
    tripCurrency?: string;
    onSave: (a: ItineraryActivity) => void;
    onCancel: () => void;
}> = ({ initial, tripCurrency, onSave, onCancel }) => {
    const [a, setA] = useState<ItineraryActivity>(initial || {
        id: generateId(),
        time: '09:00',
        description: '',
        completed: false,
        type: 'other',
        currency: tripCurrency,
    });

    const update = <K extends keyof ItineraryActivity>(key: K, value: ItineraryActivity[K]) => {
        setA(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        if (!a.description.trim()) return;
        onSave({ ...a, description: a.description.trim() });
    };

    return (
        <div className="p-4 bg-slate-100 dark:bg-[#3d2830] space-y-2">
            <div className="grid grid-cols-4 gap-1">
                {(Object.keys(ACTIVITY_TYPE_CONFIG) as ActivityType[]).map(t => (
                    <button
                        key={t}
                        onClick={() => update('type', t)}
                        className={`p-1.5 rounded-lg border-2 flex flex-col items-center gap-0.5 transition-all ${a.type === t ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-[#5a2b35]/30'}`}
                    >
                        <span className={`material-symbols-outlined text-sm ${ACTIVITY_TYPE_CONFIG[t].color}`}>{ACTIVITY_TYPE_CONFIG[t].icon}</span>
                        <span className="text-[8px] font-medium text-slate-600 dark:text-slate-300">{ACTIVITY_TYPE_CONFIG[t].label}</span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
                <input
                    type="time"
                    value={a.time}
                    onChange={e => update('time', e.target.value)}
                    className="bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-2 py-2 text-sm"
                />
                <input
                    type="number"
                    value={a.duration || ''}
                    onChange={e => update('duration', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="Duración (min)"
                    className="bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-2 py-2 text-sm"
                />
                <input
                    type="text"
                    value={a.location || ''}
                    onChange={e => update('location', e.target.value)}
                    placeholder="Lugar"
                    className="bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-2 py-2 text-sm"
                />
            </div>

            <input
                type="text"
                value={a.description}
                onChange={e => update('description', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="Descripción de la actividad..."
                className="w-full bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm"
                autoFocus
            />

            <div className="grid grid-cols-2 gap-2">
                <input
                    type="number"
                    value={a.estimatedCost || ''}
                    onChange={e => update('estimatedCost', e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="Costo estimado"
                    className="bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm"
                />
                <input
                    type="text"
                    value={a.notes || ''}
                    onChange={e => update('notes', e.target.value)}
                    placeholder="Notas (opcional)"
                    className="bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm"
                />
            </div>

            <div className="flex gap-2">
                <button
                    onClick={handleSave}
                    disabled={!a.description.trim()}
                    className="flex-1 bg-blue-400 text-white rounded-lg py-2 font-bold text-sm disabled:opacity-40"
                >
                    {initial ? 'Guardar' : 'Agregar'}
                </button>
                <button
                    onClick={onCancel}
                    className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg px-4 font-bold text-sm"
                >
                    Cancelar
                </button>
            </div>
        </div>
    );
};
