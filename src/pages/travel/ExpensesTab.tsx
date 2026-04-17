import React, { useState, useMemo, useEffect } from 'react';
import type { Trip, TravelExpense, ExpenseCategory, FinanceAccount, FinanceData, Transaction } from '../../types';
import { generateId, formatDate, formatCurrency, convertCurrency, totalExpensesInBase, calculateSplitShare } from './utils';
import { COMMON_CURRENCIES } from './countries';
import { ConfirmModal } from './ConfirmModal';
import { useAuth } from '../../context/AuthContext';
import { FirestoreService, Features } from '../../services/firestore';

const EXPENSE_CATEGORIES: Array<{ key: ExpenseCategory; label: string; icon: string; color: string; emoji: string }> = [
    { key: 'transport', label: 'Transporte', icon: 'directions_bus', color: 'text-blue-500', emoji: '🚌' },
    { key: 'alojamiento', label: 'Alojamiento', icon: 'hotel', color: 'text-purple-500', emoji: '🏨' },
    { key: 'comida', label: 'Comida', icon: 'restaurant', color: 'text-orange-500', emoji: '🍽️' },
    { key: 'actividades', label: 'Actividades', icon: 'sports_esports', color: 'text-green-500', emoji: '🎢' },
    { key: 'compras', label: 'Compras', icon: 'shopping_bag', color: 'text-pink-500', emoji: '🛍️' },
    { key: 'salud', label: 'Salud', icon: 'medical_services', color: 'text-red-500', emoji: '💊' },
    { key: 'propinas', label: 'Propinas', icon: 'volunteer_activism', color: 'text-amber-500', emoji: '💰' },
    { key: 'otros', label: 'Otros', icon: 'more_horiz', color: 'text-slate-500', emoji: '📌' },
];

export const ExpensesTab: React.FC<{
    trip: Trip;
    onUpdate: (trip: Trip) => void;
}> = ({ trip, onUpdate }) => {
    const { user } = useAuth();
    const [showAdd, setShowAdd] = useState(false);
    const [editingExpense, setEditingExpense] = useState<TravelExpense | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [financeAccounts, setFinanceAccounts] = useState<FinanceAccount[]>([]);
    const [showAccountPicker, setShowAccountPicker] = useState<TravelExpense | null>(null);
    const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Cargar cuentas de Finance una vez
    useEffect(() => {
        if (!user) return;
        FirestoreService.getFeatureData(user.uid, Features.FINANCE).then(data => {
            if (data && (data as FinanceData).accounts) {
                setFinanceAccounts((data as FinanceData).accounts);
            }
        });
    }, [user]);

    const baseCurrency = trip.baseCurrency || 'COP';
    const companions = trip.companions || [];
    const totalSpent = totalExpensesInBase(trip);
    const remaining = trip.budget - totalSpent;

    const byCategory = useMemo(() => {
        const cats: Record<string, number> = {};
        trip.expenses.forEach(e => {
            const inBase = e.amountInBase != null ? e.amountInBase : convertCurrency(e.amount, e.currency || baseCurrency, baseCurrency, trip.customRates);
            cats[e.category] = (cats[e.category] || 0) + inBase;
        });
        return cats;
    }, [trip.expenses, baseCurrency, trip.customRates]);

    // Split: deudas entre companions
    const splitBalances = useMemo(() => {
        const balances: Record<string, number> = {}; // companionId -> saldo en baseCurrency
        companions.forEach(c => { balances[c.id] = 0; });

        trip.expenses.forEach(e => {
            if (!e.splitWith || e.splitWith.length === 0) return;
            const inBase = e.amountInBase != null ? e.amountInBase : convertCurrency(e.amount, e.currency || baseCurrency, baseCurrency, trip.customRates);
            const share = inBase / e.splitWith.length;
            const payer = e.paidBy || 'me';
            // El que pagó pone +monto, los demás del split deben share
            balances[payer] = (balances[payer] || 0) + inBase;
            e.splitWith.forEach(c => {
                balances[c] = (balances[c] || 0) - share;
            });
        });

        return balances;
    }, [trip.expenses, companions, baseCurrency]);

    const saveExpense = (expense: TravelExpense) => {
        // Calcula amountInBase si la moneda difiere usando tasas custom del viaje
        const expenseWithBase: TravelExpense = expense.currency && expense.currency !== baseCurrency
            ? { ...expense, amountInBase: convertCurrency(expense.amount, expense.currency, baseCurrency, trip.customRates) }
            : { ...expense, amountInBase: undefined };

        const exists = trip.expenses.some(e => e.id === expense.id);
        const updated = exists
            ? trip.expenses.map(e => e.id === expense.id ? expenseWithBase : e)
            : [...trip.expenses, expenseWithBase];
        onUpdate({ ...trip, expenses: updated });
        setEditingExpense(null);
        setShowAdd(false);
    };

    const deleteExpense = (id: string) => {
        onUpdate({ ...trip, expenses: trip.expenses.filter(e => e.id !== id) });
        setConfirmDelete(null);
    };

    const syncToFinance = async (expense: TravelExpense, accountId: string) => {
        if (!user) return;
        try {
            const account = financeAccounts.find(a => a.id === accountId);
            const amountInBase = expense.amountInBase != null ? expense.amountInBase : convertCurrency(expense.amount, expense.currency || baseCurrency, baseCurrency, trip.customRates);
            const cat = EXPENSE_CATEGORIES.find(c => c.key === expense.category);

            const tx: Transaction = {
                id: Date.now(),
                type: 'expense',
                accountId,
                amount: amountInBase,
                category: `Viaje: ${trip.destination}`,
                emoji: cat?.emoji || '✈️',
                description: `${cat?.label || 'Gasto'} · ${expense.description || trip.destination}`,
                dateISO: expense.dateISO,
                date: expense.dateISO,
                sourceType: 'travel',
                sourceTripId: trip.id,
                sourceExpenseId: expense.id,
            };

            await FirestoreService.addTransaction(user.uid, tx);

            // Marcar gasto como sincronizado
            const updatedExpense: TravelExpense = {
                ...expense,
                syncedToFinance: true,
                financeAccountId: accountId,
                financeTxId: tx.id,
            };
            onUpdate({ ...trip, expenses: trip.expenses.map(e => e.id === expense.id ? updatedExpense : e) });
            setSyncMessage({ type: 'success', text: `Sincronizado a ${account?.name || 'cuenta'}` });
            setShowAccountPicker(null);
            setTimeout(() => setSyncMessage(null), 3000);
        } catch (e) {
            console.error(e);
            setSyncMessage({ type: 'error', text: 'Error al sincronizar con Finanzas' });
            setTimeout(() => setSyncMessage(null), 3000);
        }
    };

    const sortedExpenses = useMemo(() =>
        [...trip.expenses].sort((a, b) => (b.dateISO || '').localeCompare(a.dateISO || ''))
    , [trip.expenses]);

    return (
        <div className="space-y-3 sm:space-y-4">
            {/* Sync notification */}
            {syncMessage && (
                <div className={`rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-2 ${syncMessage.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-300'}`}>
                    <span className="material-symbols-outlined text-sm">{syncMessage.type === 'success' ? 'check_circle' : 'error'}</span>
                    {syncMessage.text}
                </div>
            )}

            {/* Budget summary */}
            {trip.budget > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="bg-slate-50 dark:bg-[#2d1820] rounded-xl p-2 sm:p-3 text-center">
                        <p className="text-[10px] text-slate-400 font-medium">Presupuesto</p>
                        <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">{formatCurrency(trip.budget, baseCurrency)}</p>
                    </div>
                    <div className="bg-rose-50 dark:bg-rose-900/10 rounded-xl p-2 sm:p-3 text-center">
                        <p className="text-[10px] text-rose-400 font-medium">Gastado</p>
                        <p className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-300">{formatCurrency(totalSpent, baseCurrency)}</p>
                    </div>
                    <div className={`rounded-xl p-2 sm:p-3 text-center ${remaining >= 0 ? 'bg-green-50 dark:bg-green-900/10' : 'bg-rose-50 dark:bg-rose-900/10'}`}>
                        <p className={`text-[10px] font-medium ${remaining >= 0 ? 'text-green-400' : 'text-rose-400'}`}>{remaining >= 0 ? 'Restante' : 'Pasado'}</p>
                        <p className={`text-xs sm:text-sm font-bold ${remaining >= 0 ? 'text-green-600 dark:text-green-300' : 'text-rose-600 dark:text-rose-300'}`}>
                            {formatCurrency(Math.abs(remaining), baseCurrency)}
                        </p>
                    </div>
                </div>
            )}

            {/* Categorías */}
            {Object.keys(byCategory).length > 0 && (
                <div className="bg-slate-50 dark:bg-[#2d1820] rounded-2xl p-4 space-y-2">
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400">Por categoría</h4>
                    {EXPENSE_CATEGORIES.map(cat => {
                        const amount = byCategory[cat.key] || 0;
                        if (amount === 0) return null;
                        const percent = totalSpent > 0 ? (amount / totalSpent) * 100 : 0;
                        return (
                            <div key={cat.key} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                                        <span className={`material-symbols-outlined text-sm ${cat.color}`}>{cat.icon}</span>
                                        {cat.label}
                                    </span>
                                    <span className="font-bold text-slate-700 dark:text-slate-200">{formatCurrency(amount, baseCurrency)}</span>
                                </div>
                                <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${cat.color.replace('text-', 'bg-')}`} style={{ width: `${percent}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Split balances */}
            {companions.length > 1 && Object.values(splitBalances).some(v => Math.abs(v) > 0.01) && (
                <div className="bg-purple-50 dark:bg-purple-900/10 rounded-2xl p-4 border border-purple-100 dark:border-purple-900/20">
                    <h4 className="text-xs font-bold text-purple-600 dark:text-purple-300 mb-2 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">balance</span>
                        Balances entre acompañantes
                    </h4>
                    <div className="space-y-1.5">
                        {companions.map(c => {
                            const bal = splitBalances[c.id] || 0;
                            return (
                                <div key={c.id} className="flex items-center justify-between text-xs">
                                    <span className="text-slate-700 dark:text-slate-200">
                                        {c.emoji || '👤'} {c.name}{c.isMe && ' (yo)'}
                                    </span>
                                    <span className={`font-bold ${bal > 0 ? 'text-green-600 dark:text-green-400' : bal < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                                        {bal > 0 ? '+' : ''}{formatCurrency(bal, baseCurrency)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-[10px] text-purple-400 mt-2">Positivo = le deben · Negativo = debe</p>
                </div>
            )}

            {/* Lista de gastos */}
            {sortedExpenses.length > 0 && (
                <div className="bg-slate-50 dark:bg-[#2d1820] rounded-xl overflow-hidden">
                    {sortedExpenses.map(expense => {
                        const cat = EXPENSE_CATEGORIES.find(c => c.key === expense.category) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
                        const payer = companions.find(c => c.id === expense.paidBy);
                        const isMultiCurrency = expense.currency && expense.currency !== baseCurrency;
                        const splitShare = expense.splitWith && expense.splitWith.length > 0 ? calculateSplitShare(expense) : null;

                        return (
                            <div key={expense.id} className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 dark:border-[#5a2b35]/20 last:border-0 group">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cat.color.replace('text-', 'bg-').replace('500', '100')} dark:bg-slate-700`}>
                                    <span className={`material-symbols-outlined text-sm ${cat.color}`}>{cat.icon}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                                        {expense.description || cat.label}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 flex-wrap">
                                        <span>{formatDate(expense.dateISO)}</span>
                                        {payer && !payer.isMe && <span className="text-pink-500">· Pagó {payer.emoji} {payer.name}</span>}
                                        {splitShare && <span className="text-purple-500">· Split: {formatCurrency(splitShare, expense.currency || baseCurrency)} c/u</span>}
                                        {expense.syncedToFinance && (
                                            <span className="text-green-500 flex items-center gap-0.5">
                                                <span className="material-symbols-outlined text-[10px]">check_circle</span> En Finanzas
                                            </span>
                                        )}
                                        {expense.linkedActivityId && (
                                            <span className="text-blue-500 flex items-center gap-0.5">
                                                <span className="material-symbols-outlined text-[10px]">link</span> Itinerario
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                        -{formatCurrency(expense.amount, expense.currency || baseCurrency)}
                                    </span>
                                    {isMultiCurrency && expense.amountInBase && (
                                        <span className="text-[10px] text-slate-400">
                                            ≈ {formatCurrency(expense.amountInBase, baseCurrency)}
                                        </span>
                                    )}
                                    <div className="flex items-center gap-2 mt-1">
                                        {!expense.syncedToFinance && financeAccounts.length > 0 && (
                                            <button
                                                onClick={() => setShowAccountPicker(expense)}
                                                className="text-base text-green-500 hover:text-green-700 transition-colors"
                                                title="Sincronizar con Finanzas"
                                            >
                                                💳
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setEditingExpense(expense)}
                                            className="text-slate-400 hover:text-pink-500 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-base">edit</span>
                                        </button>
                                        <button
                                            onClick={() => setConfirmDelete(expense.id)}
                                            className="text-slate-400 hover:text-rose-400 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-base">delete</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {trip.expenses.length === 0 && (
                <p className="text-center text-xs text-slate-400 py-8">No hay gastos registrados</p>
            )}

            {/* Botón agregar */}
            <button
                onClick={() => { setEditingExpense(null); setShowAdd(true); }}
                className="w-full border-2 border-dashed border-slate-200 dark:border-[#5a2b35]/30 rounded-xl py-3 text-sm text-slate-400 hover:text-pink-400 hover:border-pink-300 transition-colors flex items-center justify-center gap-1"
            >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                Agregar gasto
            </button>

            {/* Form */}
            {(showAdd || editingExpense) && (
                <ExpenseForm
                    initial={editingExpense}
                    tripCurrency={baseCurrency}
                    customRates={trip.customRates}
                    companions={companions}
                    onSave={saveExpense}
                    onCancel={() => { setShowAdd(false); setEditingExpense(null); }}
                />
            )}

            {/* Account picker for sync */}
            {showAccountPicker && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-black/50">
                    <div className="bg-white dark:bg-[#2d1820] w-full max-w-sm rounded-2xl p-5 shadow-2xl">
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">Sincronizar a Finanzas</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">¿De qué cuenta sale este gasto?</p>
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
                        <button
                            onClick={() => setShowAccountPicker(null)}
                            className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            <ConfirmModal
                open={!!confirmDelete}
                title="¿Eliminar gasto?"
                message="Esta acción no se puede deshacer. Si estaba sincronizado en Finanzas, esa transacción quedará."
                variant="danger"
                confirmLabel="Eliminar"
                icon="delete"
                onConfirm={() => confirmDelete && deleteExpense(confirmDelete)}
                onCancel={() => setConfirmDelete(null)}
            />
        </div>
    );
};

const ExpenseForm: React.FC<{
    initial: TravelExpense | null;
    tripCurrency: string;
    customRates?: Record<string, number>;
    companions: Trip['companions'];
    onSave: (e: TravelExpense) => void;
    onCancel: () => void;
}> = ({ initial, tripCurrency, customRates, companions, onSave, onCancel }) => {
    const [e, setE] = useState<TravelExpense>(initial || {
        id: generateId(),
        category: 'comida',
        amount: 0,
        description: '',
        dateISO: new Date().toISOString().split('T')[0],
        currency: tripCurrency,
        paidBy: 'me',
        splitWith: (companions || []).map(c => c.id),
    });
    const [showSplit, setShowSplit] = useState(!!initial?.splitWith && initial.splitWith.length > 0);

    const update = <K extends keyof TravelExpense>(key: K, value: TravelExpense[K]) => {
        setE(prev => ({ ...prev, [key]: value }));
    };

    const toggleSplitMember = (id: string) => {
        const current = e.splitWith || [];
        if (current.includes(id)) {
            update('splitWith', current.filter(x => x !== id));
        } else {
            update('splitWith', [...current, id]);
        }
    };

    const handleSave = () => {
        if (!e.amount || e.amount <= 0) return;
        const cleaned: TravelExpense = {
            ...e,
            description: e.description.trim(),
            splitWith: showSplit && (e.splitWith?.length || 0) > 1 ? e.splitWith : undefined,
        };
        onSave(cleaned);
    };

    return (
        <div className="bg-slate-50 dark:bg-[#2d1820] rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-4 gap-1">
                {EXPENSE_CATEGORIES.map(cat => (
                    <button
                        key={cat.key}
                        onClick={() => update('category', cat.key)}
                        className={`p-1.5 rounded-lg border-2 flex flex-col items-center gap-0.5 transition-all ${e.category === cat.key ? 'border-pink-400 bg-pink-50 dark:bg-pink-900/20' : 'border-slate-200 dark:border-[#5a2b35]/30'}`}
                    >
                        <span className={`material-symbols-outlined text-sm ${cat.color}`}>{cat.icon}</span>
                        <span className="text-[8px] font-medium text-slate-600 dark:text-slate-300">{cat.label}</span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                    <input
                        type="number"
                        value={e.amount || ''}
                        onChange={ev => update('amount', parseFloat(ev.target.value) || 0)}
                        placeholder="Monto"
                        min={0}
                        className="w-full bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm"
                        autoFocus
                    />
                </div>
                <select
                    value={e.currency || tripCurrency}
                    onChange={ev => update('currency', ev.target.value)}
                    className="bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-2 py-2 text-sm"
                >
                    {COMMON_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                </select>
            </div>

            {e.currency && e.currency !== tripCurrency && (
                <p className="text-[10px] text-slate-400 italic">
                    ≈ {formatCurrency(convertCurrency(e.amount, e.currency, tripCurrency, customRates), tripCurrency)} (estimado)
                </p>
            )}

            <input
                type="text"
                value={e.description}
                onChange={ev => update('description', ev.target.value)}
                placeholder="Descripción (opcional)"
                className="w-full bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm"
            />

            <input
                type="date"
                value={e.dateISO}
                onChange={ev => update('dateISO', ev.target.value)}
                className="w-full bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm"
            />

            {/* Pagado por */}
            {(companions || []).length > 1 && (
                <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Pagado por</label>
                    <div className="grid grid-cols-3 gap-1">
                        {(companions || []).map(c => (
                            <button
                                key={c.id}
                                onClick={() => update('paidBy', c.id)}
                                className={`py-1.5 rounded-lg text-xs transition-all ${e.paidBy === c.id ? 'bg-pink-400 text-white font-bold' : 'bg-white dark:bg-[#1a0d10] text-slate-500'}`}
                            >
                                {c.emoji} {c.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Split */}
            {(companions || []).length > 1 && (
                <div>
                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer mb-2">
                        <input
                            type="checkbox"
                            checked={showSplit}
                            onChange={ev => setShowSplit(ev.target.checked)}
                            className="w-4 h-4 accent-purple-500"
                        />
                        Dividir gasto entre acompañantes
                    </label>
                    {showSplit && (
                        <div className="grid grid-cols-3 gap-1">
                            {(companions || []).map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => toggleSplitMember(c.id)}
                                    className={`py-1.5 rounded-lg text-xs transition-all ${(e.splitWith || []).includes(c.id) ? 'bg-purple-400 text-white font-bold' : 'bg-white dark:bg-[#1a0d10] text-slate-500'}`}
                                >
                                    {c.emoji} {c.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="flex gap-2">
                <button
                    onClick={handleSave}
                    disabled={!e.amount || e.amount <= 0}
                    className="flex-1 bg-pink-400 text-white rounded-lg py-2 font-bold text-sm disabled:opacity-40"
                >
                    {initial ? 'Guardar' : 'Agregar gasto'}
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
