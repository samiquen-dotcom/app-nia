import React, { useMemo, useState } from 'react';
import type { Trip, ItineraryActivity, Reservation, TravelExpense, ExpenseCategory, TripJournalEntry } from '../../types';
import { ACTIVITY_TYPE_CONFIG, RESERVATION_TYPE_CONFIG, formatCurrency, totalExpensesInBase, generateId, convertCurrency } from './utils';

const MOOD_QUICK = [
    { emoji: '🤩', label: 'Increíble' },
    { emoji: '😄', label: 'Feliz' },
    { emoji: '😊', label: 'Bien' },
    { emoji: '😐', label: 'Normal' },
    { emoji: '😔', label: 'Mal' },
    { emoji: '😴', label: 'Cansada' },
];

const QUICK_EXPENSE_CATS: Array<{ key: ExpenseCategory; label: string; icon: string; color: string }> = [
    { key: 'comida', label: 'Comida', icon: 'restaurant', color: 'text-orange-500' },
    { key: 'transport', label: 'Transporte', icon: 'directions_bus', color: 'text-blue-500' },
    { key: 'compras', label: 'Compras', icon: 'shopping_bag', color: 'text-pink-500' },
    { key: 'actividades', label: 'Actividades', icon: 'sports_esports', color: 'text-green-500' },
    { key: 'propinas', label: 'Propinas', icon: 'volunteer_activism', color: 'text-amber-500' },
    { key: 'otros', label: 'Otros', icon: 'more_horiz', color: 'text-slate-500' },
];

interface TodayTabProps {
    trip: Trip;
    onUpdate: (trip: Trip) => void;
    onJumpToTab?: (tab: string) => void;
}

export const TodayTab: React.FC<TodayTabProps> = ({ trip, onUpdate, onJumpToTab }) => {
    const [showQuickExpense, setShowQuickExpense] = useState(false);
    const [quickExpenseAmount, setQuickExpenseAmount] = useState('');
    const [quickExpenseCat, setQuickExpenseCat] = useState<ExpenseCategory>('comida');
    const [quickExpenseDesc, setQuickExpenseDesc] = useState('');
    const [showQuickJournal, setShowQuickJournal] = useState(false);
    const [quickHighlight, setQuickHighlight] = useState('');

    const todayStr = new Date().toISOString().split('T')[0];
    const baseCurrency = trip.baseCurrency || 'COP';

    // Día del viaje
    const dayInfo = useMemo(() => {
        const start = new Date(trip.startDate + 'T00:00:00');
        const today = new Date(todayStr + 'T00:00:00');
        const dayNumber = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const totalDays = Math.ceil((new Date(trip.endDate + 'T00:00:00').getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const daysLeft = Math.max(0, Math.ceil((new Date(trip.endDate + 'T23:59:59').getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
        return { dayNumber, totalDays, daysLeft };
    }, [trip.startDate, trip.endDate, todayStr]);

    // Día del itinerario hoy
    const todayItineraryDay = useMemo(() => {
        return (trip.itinerary || []).find(d => d.date === todayStr);
    }, [trip.itinerary, todayStr]);

    // Próxima actividad de hoy
    const nextActivity = useMemo<ItineraryActivity | null>(() => {
        if (!todayItineraryDay) return null;
        const now = new Date();
        const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        return todayItineraryDay.activities
            .filter(a => !a.completed && a.time >= nowHHMM)
            .sort((a, b) => a.time.localeCompare(b.time))[0] || null;
    }, [todayItineraryDay]);

    // Próxima reserva (hoy o mañana)
    const upcomingReservation = useMemo<Reservation | null>(() => {
        const reservations = trip.reservations || [];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        return reservations
            .filter(r => r.startDate && (r.startDate === todayStr || r.startDate === tomorrowStr))
            .sort((a, b) => {
                const aKey = `${a.startDate}T${a.departureTime || a.checkInTime || '12:00'}`;
                const bKey = `${b.startDate}T${b.departureTime || b.checkInTime || '12:00'}`;
                return aKey.localeCompare(bKey);
            })[0] || null;
    }, [trip.reservations, todayStr]);

    // Gastos de hoy
    const todayExpenses = useMemo<TravelExpense[]>(() => {
        return trip.expenses.filter(e => e.dateISO === todayStr);
    }, [trip.expenses, todayStr]);

    const todaySpent = useMemo(() => {
        return todayExpenses.reduce((sum, e) => {
            if (e.amountInBase != null) return sum + e.amountInBase;
            if ((e.currency || baseCurrency) === baseCurrency) return sum + e.amount;
            return sum + convertCurrency(e.amount, e.currency || baseCurrency, baseCurrency, trip.customRates);
        }, 0);
    }, [todayExpenses, baseCurrency]);

    const totalSpent = totalExpensesInBase(trip);
    const dailyBudget = trip.budget > 0 && dayInfo.totalDays > 0 ? trip.budget / dayInfo.totalDays : 0;
    const overDailyBudget = dailyBudget > 0 && todaySpent > dailyBudget;

    // Journal de hoy
    const todayJournal = useMemo<TripJournalEntry | undefined>(() => {
        return (trip.journal || []).find(e => e.date === todayStr);
    }, [trip.journal, todayStr]);

    const completedToday = todayItineraryDay
        ? todayItineraryDay.activities.filter(a => a.completed).length
        : 0;
    const totalToday = todayItineraryDay?.activities.length || 0;

    // Quick actions
    const addQuickExpense = () => {
        const amount = parseFloat(quickExpenseAmount);
        if (!amount || amount <= 0) return;
        const expense: TravelExpense = {
            id: generateId(),
            category: quickExpenseCat,
            amount,
            description: quickExpenseDesc.trim() || QUICK_EXPENSE_CATS.find(c => c.key === quickExpenseCat)?.label || 'Gasto',
            dateISO: todayStr,
            currency: baseCurrency,
            paidBy: 'me',
        };
        onUpdate({ ...trip, expenses: [...trip.expenses, expense] });
        setQuickExpenseAmount('');
        setQuickExpenseDesc('');
        setShowQuickExpense(false);
    };

    const setQuickMood = (emoji: string, label: string) => {
        const journal = trip.journal || [];
        const existing = journal.find(e => e.date === todayStr);
        const updated = existing
            ? journal.map(e => e.date === todayStr ? { ...e, moodEmoji: emoji, moodLabel: label } : e)
            : [...journal, { date: todayStr, moodEmoji: emoji, moodLabel: label }];
        onUpdate({ ...trip, journal: updated });
    };

    const saveQuickHighlight = () => {
        if (!quickHighlight.trim()) return;
        const journal = trip.journal || [];
        const existing = journal.find(e => e.date === todayStr);
        const updated = existing
            ? journal.map(e => e.date === todayStr ? { ...e, highlight: quickHighlight.trim() } : e)
            : [...journal, { date: todayStr, highlight: quickHighlight.trim() }];
        onUpdate({ ...trip, journal: updated });
        setQuickHighlight('');
        setShowQuickJournal(false);
    };

    const toggleActivity = (activityId: string) => {
        if (!todayItineraryDay) return;
        onUpdate({
            ...trip,
            itinerary: (trip.itinerary || []).map(day =>
                day.id === todayItineraryDay.id
                    ? { ...day, activities: day.activities.map(a => a.id === activityId ? { ...a, completed: !a.completed } : a) }
                    : day
            ),
        });
    };

    return (
        <div className="space-y-3 sm:space-y-4">
            {/* Hero del día */}
            <div className="bg-gradient-to-br from-pink-400 via-rose-400 to-pink-500 text-white rounded-2xl p-4 shadow-lg">
                <div className="flex items-start justify-between mb-2">
                    <div>
                        <p className="text-xs opacity-80">Día {dayInfo.dayNumber} de {dayInfo.totalDays}</p>
                        <p className="text-2xl font-bold">
                            {dayInfo.daysLeft === 0 ? 'Último día 🎈' : dayInfo.daysLeft === 1 ? 'Penúltimo día' : `Te quedan ${dayInfo.daysLeft} días`}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] opacity-80">Gastado hoy</p>
                        <p className={`text-lg font-bold ${overDailyBudget ? 'text-amber-200' : ''}`}>{formatCurrency(todaySpent, baseCurrency)}</p>
                    </div>
                </div>
                {dailyBudget > 0 && (
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] opacity-80">
                            <span>Presupuesto del día</span>
                            <span>{formatCurrency(dailyBudget, baseCurrency)}</span>
                        </div>
                        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                            <div
                                className={`h-full ${overDailyBudget ? 'bg-amber-300' : 'bg-white'} rounded-full transition-all`}
                                style={{ width: `${Math.min(100, (todaySpent / dailyBudget) * 100)}%` }}
                            />
                        </div>
                        {overDailyBudget && (
                            <p className="text-[10px] text-amber-200 font-bold">⚠️ Pasaste {formatCurrency(todaySpent - dailyBudget, baseCurrency)} del presupuesto diario</p>
                        )}
                    </div>
                )}
            </div>

            {/* Próxima actividad */}
            {nextActivity ? (
                <button
                    onClick={() => onJumpToTab?.('itinerary')}
                    className="w-full bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-4 text-left hover:shadow-md transition-shadow"
                >
                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">Próximo</p>
                    <div className="flex items-start gap-3">
                        <div className="w-12 text-center flex-shrink-0">
                            <p className="text-lg font-bold text-blue-600">{nextActivity.time}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                                <span className={`material-symbols-outlined text-sm ${ACTIVITY_TYPE_CONFIG[nextActivity.type || 'other'].color}`}>
                                    {ACTIVITY_TYPE_CONFIG[nextActivity.type || 'other'].icon}
                                </span>
                                <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">{nextActivity.description}</p>
                            </div>
                            {nextActivity.location && (
                                <p className="text-xs text-slate-500 mt-0.5">📍 {nextActivity.location}</p>
                            )}
                            {nextActivity.estimatedCost && (
                                <p className="text-xs text-amber-500 font-bold mt-0.5">💰 {formatCurrency(nextActivity.estimatedCost, nextActivity.currency || baseCurrency)}</p>
                            )}
                        </div>
                    </div>
                </button>
            ) : todayItineraryDay && totalToday > 0 ? (
                <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-2xl p-4 text-center">
                    <span className="text-3xl">🎉</span>
                    <p className="text-sm font-bold text-green-600 dark:text-green-300 mt-2">¡Día completo!</p>
                    <p className="text-xs text-green-500 mt-0.5">Todas las actividades de hoy hechas</p>
                </div>
            ) : null}

            {/* Próxima reserva */}
            {upcomingReservation && upcomingReservation.startDate && (
                <button
                    onClick={() => onJumpToTab?.('reservations')}
                    className="w-full bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 rounded-2xl p-3 text-left hover:shadow-md transition-shadow"
                >
                    <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-base ${RESERVATION_TYPE_CONFIG[upcomingReservation.type].color}`}>
                            {RESERVATION_TYPE_CONFIG[upcomingReservation.type].icon}
                        </span>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-purple-500 uppercase tracking-wider">
                                {upcomingReservation.startDate === todayStr ? 'Reserva hoy' : 'Reserva mañana'}
                            </p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{upcomingReservation.title}</p>
                            {upcomingReservation.confirmationCode && (
                                <p className="text-[10px] text-slate-400 font-mono">Cód: {upcomingReservation.confirmationCode}</p>
                            )}
                        </div>
                        {(upcomingReservation.departureTime || upcomingReservation.checkInTime) && (
                            <span className="text-sm font-bold text-purple-600">
                                {upcomingReservation.departureTime || upcomingReservation.checkInTime}
                            </span>
                        )}
                    </div>
                </button>
            )}

            {/* Mood rápido */}
            <div className="bg-slate-50 dark:bg-[#2d1820] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">sentiment_satisfied</span>
                        ¿Cómo te sientes hoy?
                    </p>
                    {todayJournal?.moodEmoji && (
                        <span className="text-xs text-pink-500 font-bold">{todayJournal.moodLabel}</span>
                    )}
                </div>
                <div className="grid grid-cols-6 gap-1">
                    {MOOD_QUICK.map(m => (
                        <button
                            key={m.emoji}
                            onClick={() => setQuickMood(m.emoji, m.label)}
                            className={`p-2 rounded-lg text-2xl transition-all ${todayJournal?.moodEmoji === m.emoji ? 'bg-pink-100 dark:bg-pink-900/30 ring-2 ring-pink-300 scale-110' : 'bg-white dark:bg-[#1a0d10]'}`}
                            title={m.label}
                        >
                            {m.emoji}
                        </button>
                    ))}
                </div>
            </div>

            {/* Highlight */}
            <div className="bg-slate-50 dark:bg-[#2d1820] rounded-2xl p-4">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                    Mejor momento del día
                </p>
                {todayJournal?.highlight && !showQuickJournal ? (
                    <div className="flex items-start gap-2">
                        <p className="flex-1 text-sm text-pink-500 italic">"{todayJournal.highlight}"</p>
                        <button
                            onClick={() => { setQuickHighlight(todayJournal.highlight || ''); setShowQuickJournal(true); }}
                            className="text-pink-400 hover:text-pink-600"
                        >
                            <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                    </div>
                ) : showQuickJournal ? (
                    <div className="space-y-2">
                        <input
                            type="text"
                            value={quickHighlight}
                            onChange={e => setQuickHighlight(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveQuickHighlight()}
                            placeholder="Aquel atardecer en..."
                            className="w-full bg-white dark:bg-[#1a0d10] border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <button onClick={saveQuickHighlight} disabled={!quickHighlight.trim()} className="flex-1 bg-pink-400 text-white rounded-lg py-1.5 text-xs font-bold disabled:opacity-40">
                                Guardar
                            </button>
                            <button onClick={() => { setShowQuickJournal(false); setQuickHighlight(''); }} className="bg-slate-200 dark:bg-slate-700 rounded-lg px-4 text-xs font-bold">
                                Cancelar
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowQuickJournal(true)}
                        className="w-full text-left text-xs text-slate-400 hover:text-pink-500 italic"
                    >
                        ✍️ Cuenta lo mejor que te pasó hoy...
                    </button>
                )}
            </div>

            {/* Quick gasto */}
            <div className="bg-slate-50 dark:bg-[#2d1820] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">payments</span>
                        Registrar un gasto rápido
                    </p>
                    {todayExpenses.length > 0 && (
                        <button
                            onClick={() => onJumpToTab?.('expenses')}
                            className="text-[10px] text-pink-500 font-bold"
                        >
                            Ver {todayExpenses.length}
                        </button>
                    )}
                </div>
                {showQuickExpense ? (
                    <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-1">
                            {QUICK_EXPENSE_CATS.map(c => (
                                <button
                                    key={c.key}
                                    onClick={() => setQuickExpenseCat(c.key)}
                                    className={`p-1.5 rounded-lg text-[10px] flex flex-col items-center gap-0.5 ${quickExpenseCat === c.key ? 'bg-pink-100 dark:bg-pink-900/30 ring-2 ring-pink-300' : 'bg-white dark:bg-[#1a0d10]'}`}
                                >
                                    <span className={`material-symbols-outlined text-base ${c.color}`}>{c.icon}</span>
                                    <span className="text-slate-600 dark:text-slate-300">{c.label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-1">
                            <input
                                type="number"
                                value={quickExpenseAmount}
                                onChange={e => setQuickExpenseAmount(e.target.value)}
                                placeholder="Monto"
                                className="flex-1 bg-white dark:bg-[#1a0d10] border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm"
                                autoFocus
                            />
                            <input
                                type="text"
                                value={quickExpenseDesc}
                                onChange={e => setQuickExpenseDesc(e.target.value)}
                                placeholder="Descripción"
                                className="flex-1 bg-white dark:bg-[#1a0d10] border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button onClick={addQuickExpense} disabled={!quickExpenseAmount || parseFloat(quickExpenseAmount) <= 0} className="flex-1 bg-pink-400 text-white rounded-lg py-1.5 text-xs font-bold disabled:opacity-40">
                                Agregar
                            </button>
                            <button onClick={() => { setShowQuickExpense(false); setQuickExpenseAmount(''); setQuickExpenseDesc(''); }} className="bg-slate-200 dark:bg-slate-700 rounded-lg px-4 text-xs font-bold">
                                Cancelar
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowQuickExpense(true)}
                        className="w-full bg-pink-400 hover:bg-pink-500 text-white rounded-lg py-2 text-xs font-bold flex items-center justify-center gap-1"
                    >
                        <span className="material-symbols-outlined text-base">add_circle</span>
                        Registrar gasto
                    </button>
                )}
            </div>

            {/* Lista de actividades de hoy completas */}
            {todayItineraryDay && totalToday > 0 && (
                <div className="bg-slate-50 dark:bg-[#2d1820] rounded-2xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center justify-between">
                            <span>Hoy en el itinerario</span>
                            <span className="text-blue-500">{completedToday}/{totalToday}</span>
                        </p>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-[#5a2b35]/20">
                        {todayItineraryDay.activities.map(a => {
                            const cfg = ACTIVITY_TYPE_CONFIG[a.type || 'other'];
                            return (
                                <div key={a.id} className="flex items-start gap-2 px-4 py-2">
                                    <button
                                        onClick={() => toggleActivity(a.id)}
                                        className={`w-5 h-5 mt-0.5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${a.completed ? 'bg-green-400 border-green-400 text-white' : 'border-slate-300 dark:border-slate-600'}`}
                                    >
                                        {a.completed && <span className="material-symbols-outlined text-xs">check</span>}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs font-bold text-blue-500">{a.time}</span>
                                            <span className={`material-symbols-outlined text-xs ${cfg.color}`}>{cfg.icon}</span>
                                            <span className={`text-sm ${a.completed ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                                                {a.description}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Stats compactos */}
            <div className="grid grid-cols-3 gap-2">
                <Stat label="Gastado total" value={formatCurrency(totalSpent, baseCurrency)} />
                {trip.budget > 0 && <Stat label="Restante" value={formatCurrency(Math.max(0, trip.budget - totalSpent), baseCurrency)} />}
                <Stat label="Días" value={`${dayInfo.dayNumber}/${dayInfo.totalDays}`} />
            </div>
        </div>
    );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="bg-slate-50 dark:bg-[#2d1820] rounded-xl p-3 text-center">
        <p className="text-[10px] text-slate-400 font-medium">{label}</p>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{value}</p>
    </div>
);
