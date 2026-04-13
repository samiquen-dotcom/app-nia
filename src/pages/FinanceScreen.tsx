import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFeatureData } from '../hooks/useFeatureData';
import { useAuth } from '../context/AuthContext';
import { FirestoreService } from '../services/firestore';
import type { FinanceData, FinanceAccount, Transaction, CustomCategory, TransferTransaction } from '../types';

// ─── Visual config for accounts ───────────────────────────────────────────────
const ACCOUNT_META: Record<string, { gradient: string; textColor: string; badge: string; emoji: string }> = {
    nequi: { gradient: 'from-violet-200 to-purple-300', textColor: 'text-purple-900', badge: 'bg-white/50 text-purple-900', emoji: '💜' },
    efectivo: { gradient: 'from-emerald-200 to-green-300', textColor: 'text-emerald-900', badge: 'bg-white/50 text-emerald-900', emoji: '💵' },
    daviplata: { gradient: 'from-fuchsia-200 to-pink-300', textColor: 'text-pink-900', badge: 'bg-white/50 text-pink-900', emoji: '🟣' },
    davivienda: { gradient: 'from-rose-200 to-red-300', textColor: 'text-rose-900', badge: 'bg-white/50 text-rose-900', emoji: '🔴' },
    bancolombia: { gradient: 'from-yellow-100 to-amber-200', textColor: 'text-amber-900', badge: 'bg-white/50 text-amber-900', emoji: '💛' },
    bolsillo: { gradient: 'from-sky-200 to-cyan-300', textColor: 'text-sky-900', badge: 'bg-white/50 text-sky-900', emoji: '👖' },
};

const ACCOUNT_COLORS = [
    { id: 'slate', gradient: 'from-slate-200 to-gray-300', textColor: 'text-gray-900', badge: 'bg-white/50 text-gray-900', colorCode: 'bg-slate-400' },
    { id: 'indigo', gradient: 'from-indigo-200 to-blue-300', textColor: 'text-blue-900', badge: 'bg-white/50 text-blue-900', colorCode: 'bg-indigo-400' },
    { id: 'fuchsia', gradient: 'from-fuchsia-200 to-pink-300', textColor: 'text-pink-900', badge: 'bg-white/50 text-pink-900', colorCode: 'bg-fuchsia-400' },
    { id: 'emerald', gradient: 'from-emerald-200 to-teal-300', textColor: 'text-teal-900', badge: 'bg-white/50 text-teal-900', colorCode: 'bg-emerald-400' },
    { id: 'amber', gradient: 'from-amber-100 to-yellow-300', textColor: 'text-amber-900', badge: 'bg-white/50 text-amber-900', colorCode: 'bg-amber-400' },
    { id: 'rose', gradient: 'from-rose-200 to-red-300', textColor: 'text-rose-900', badge: 'bg-white/50 text-rose-900', colorCode: 'bg-rose-400' },
    { id: 'cyan', gradient: 'from-cyan-200 to-sky-300', textColor: 'text-sky-900', badge: 'bg-white/50 text-sky-900', colorCode: 'bg-cyan-400' },
    { id: 'violet', gradient: 'from-violet-200 to-purple-300', textColor: 'text-purple-900', badge: 'bg-white/50 text-purple-900', colorCode: 'bg-violet-400' },
    { id: 'lime', gradient: 'from-lime-200 to-green-300', textColor: 'text-green-900', badge: 'bg-white/50 text-green-900', colorCode: 'bg-lime-400' },
    { id: 'orange', gradient: 'from-orange-200 to-orange-300', textColor: 'text-orange-900', badge: 'bg-white/50 text-orange-900', colorCode: 'bg-orange-400' },
    { id: 'teal', gradient: 'from-teal-200 to-emerald-300', textColor: 'text-emerald-900', badge: 'bg-white/50 text-emerald-900', colorCode: 'bg-teal-400' },
    { id: 'black', gradient: 'from-gray-700 to-black', textColor: 'text-white', badge: 'bg-black/50 text-white', colorCode: 'bg-black' },
];

const DEFAULT_ACCOUNTS: FinanceAccount[] = [
    { id: 'nequi', name: 'Nequi', initialBalance: 0, balance: 0 },
    { id: 'efectivo', name: 'Efectivo', initialBalance: 0, balance: 0 },
    { id: 'daviplata', name: 'Daviplata', initialBalance: 0, balance: 0 },
    { id: 'davivienda', name: 'Davivienda', initialBalance: 0, balance: 0 },
    { id: 'bancolombia', name: 'Bancolombia', initialBalance: 0, balance: 0 },
    { id: 'bolsillo', name: 'Bolsillo', initialBalance: 0, balance: 0 },
];

const EXPENSE_CATS: CustomCategory[] = [
    { emoji: '🍔', label: 'Comida' }, { emoji: '🚌', label: 'Transporte' },
    { emoji: '👗', label: 'Ropa' }, { emoji: '💊', label: 'Salud' },
    { emoji: '🎬', label: 'Ocio' }, { emoji: '💄', label: 'Belleza' },
    { emoji: '🏠', label: 'Hogar' }, { emoji: '📚', label: 'Educación' },
    { emoji: '📱', label: 'Tecnología' }, { emoji: '✈️', label: 'Viajes' },
    { emoji: '🐾', label: 'Mascotas' }, { emoji: '🎁', label: 'Regalos' },
];

const INCOME_CATS: CustomCategory[] = [
    { emoji: '💼', label: 'Sueldo' }, { emoji: '💻', label: 'Freelance' },
    { emoji: '🎁', label: 'Regalo' }, { emoji: '📈', label: 'Inversión' },
    { emoji: '🛍️', label: 'Venta' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const todayStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const fmt = (n: number) => {
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
    return `${sign}$${abs.toFixed(0)}`;
};

const getCurrentMonth = () => new Date().toISOString().slice(0, 7); // YYYY-MM

// Formatear nombre del mes para mostrar (ej: "2025-03" → "Marzo 2025")
const formatMonthName = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
};

const exportCSV = (transactions: Transaction[], accounts: FinanceAccount[]) => {
    const header = 'Tipo,Cuenta,Categoría,Descripción,Monto,Fecha\n';
    const rows = transactions.map(t => {
        const accName = accounts.find(a => a.id === t.accountId)?.name ?? t.accountId;
        return `${t.type === 'income' ? 'Ingreso' : 'Gasto'},"${accName}","${t.category}","${t.description || ''}",${t.amount.toFixed(0)},${t.dateISO}`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `finanzas_nia_${todayStr()}.csv` });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// ─── Component ────────────────────────────────────────────────────────────────
export const FinanceScreen: React.FC = () => {
    const { user } = useAuth();
    const { data, save, setData } = useFeatureData<FinanceData>('finance', {
        accounts: DEFAULT_ACCOUNTS,
        transactions: [],
        customCategories: [],
        monthStats: {}
    });

    const accounts = useMemo(() => {
        const current = data.accounts || [];
        if (current.length === 0) return DEFAULT_ACCOUNTS;

        // Merge missing defaults
        const merged = [...current];
        DEFAULT_ACCOUNTS.forEach(def => {
            if (!merged.find(a => a.id === def.id)) {
                merged.push(def);
            }
        });
        return merged;
    }, [data.accounts]);
    const customCats = data.customCategories ?? [];

    // Pagination data
    const [txList, setTxList] = useState<Transaction[]>([]);
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [loadingTx, setLoadingTx] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    // Initial load
    useEffect(() => {
        if (!user) return;
        setLoadingTx(true);
        FirestoreService.getTransactions(user.uid, null, 10).then(res => {
            setTxList(res.transactions);
            setLastDoc(res.lastDoc);
            setHasMore(res.transactions.length === 10);
            setLoadingTx(false);
        });
    }, [user]);

    // Migration of legacy data
    useEffect(() => {
        if (!user || !data) return;
        const legacyTxs = data.transactions;
        if (legacyTxs && legacyTxs.length > 0) {
            FirestoreService.migrateLegacyData(user.uid, legacyTxs, data.accounts)
                .then(async () => {
                    const updated = await FirestoreService.getFeatureData(user.uid, 'finance');
                    if (updated) setData(updated as FinanceData);

                    // Refresh list
                    const res = await FirestoreService.getTransactions(user.uid, null, 10);
                    setTxList(res.transactions);
                    setLastDoc(res.lastDoc);
                });
        }
    }, [data, user]); // Run when data loads

    const loadMore = async () => {
        if (!user || !lastDoc) return;
        setLoadingTx(true);
        const res = await FirestoreService.getTransactions(user.uid, lastDoc, 10);
        setTxList(prev => [...prev, ...res.transactions]);
        setLastDoc(res.lastDoc);
        setHasMore(res.transactions.length === 10);
        setLoadingTx(false);
    };

    // ── Form state ─────────────────────────────────────────────────────────────
    const [showAdd, setShowAdd] = useState(false);
    const [showDelModal, setShowDelModal] = useState<number | null>(null);
    const [showAddCat, setShowAddCat] = useState(false);
    const [showTransfer, setShowTransfer] = useState(false);
    const [showAddAccount, setShowAddAccount] = useState(false);

    const [txType, setTxType] = useState<'income' | 'expense'>('expense');
    const [txAmount, setTxAmount] = useState('');
    const [txAccount, setTxAccount] = useState('');
    const [txCat, setTxCat] = useState('');
    const [txCatEmoji, setTxCatEmoji] = useState('');
    const [txDesc, setTxDesc] = useState('');
    const [txError, setTxError] = useState('');

    const [newCatLabel, setNewCatLabel] = useState('');
    const [newCatEmoji, setNewCatEmoji] = useState('');

    // Transfer state
    const [trFromAccount, setTrFromAccount] = useState('');
    const [trToAccount, setTrToAccount] = useState('');
    const [trAmount, setTrAmount] = useState('');
    const [trDesc, setTrDesc] = useState('');
    const [trError, setTrError] = useState('');

    // Add account state
    const [newAccountName, setNewAccountName] = useState('');
    const [newAccountEmoji, setNewAccountEmoji] = useState('💳');
    const [newAccountBalance, setNewAccountBalance] = useState('');
    const [newAccountColor, setNewAccountColor] = useState('slate');
    const [isAddingAccount, setIsAddingAccount] = useState(false);
    const [isManagingAccounts, setIsManagingAccounts] = useState(false);
    const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

    // ─── Computed ───────────────────────────────────────────────────────────────
    // Using persisted balances from data.accounts
    const total = accounts.reduce((s, a) => s + (a.balance ?? a.initialBalance), 0);

    const thisMonth = getCurrentMonth();

    // Selector de meses
    const [selectedMonth, setSelectedMonth] = useState(thisMonth);
    const [showAllCats, setShowAllCats] = useState(false);

    // Resetear "ver más" cuando cambia el mes
    useEffect(() => {
        setShowAllCats(false);
    }, [selectedMonth]);

    // Obtener todos los meses con datos disponibles
    const availableMonths = useMemo(() => {
        const months = Object.keys(data.monthStats || {}).sort().reverse();
        // Asegurar que el mes actual esté incluido
        if (!months.includes(thisMonth)) {
            months.unshift(thisMonth);
        }
        return months;
    }, [data.monthStats, thisMonth]);

    const currentMonthStats = data.monthStats?.[selectedMonth] || { income: 0, expense: 0, categories: {} };

    const monthIn = currentMonthStats.income;
    const monthOut = currentMonthStats.expense;

    // Toggle para ver stats de gastos o ingresos
    const [showIncomeStats, setShowIncomeStats] = useState(false);

    const catStats = useMemo(() => {
        const cats = currentMonthStats.categories || {};
        const sorted = Object.entries(cats)
            .map(([label, v]) => ({ label, ...v }))
            .sort((a, b) => b.total - a.total);
        return showAllCats ? sorted : sorted.slice(0, 5);
    }, [currentMonthStats, showAllCats]);

    // Stats de ingresos por categoría (basado en monthStats, igual que gastos)
    // Fallback: si incomeCategories está vacío (datos antiguos), calcula desde txList
    const incomeCatStats = useMemo(() => {
        const incomeCats = currentMonthStats.incomeCategories || {};

        // Si hay datos nuevos en incomeCategories, úsalos
        if (Object.keys(incomeCats).length > 0) {
            return Object.entries(incomeCats)
                .map(([label, v]) => ({ label, ...v }))
                .sort((a, b) => b.total - a.total)
                .slice(0, showAllCats ? undefined : 5);
        }

        // Fallback: datos antiguos - calcular desde txList
        const incomeByCategory: Record<string, { total: number; emoji: string }> = {};
        txList
            .filter(t => t.type === 'income')
            .forEach(t => {
                if (!incomeByCategory[t.category]) {
                    incomeByCategory[t.category] = { total: 0, emoji: t.emoji || '💰' };
                }
                incomeByCategory[t.category].total += t.amount;
                incomeByCategory[t.category].emoji = t.emoji || '💰';
            });

        return Object.entries(incomeByCategory)
            .map(([label, v]) => ({ label, ...v }))
            .sort((a, b) => b.total - a.total)
            .slice(0, showAllCats ? undefined : 5);
    }, [currentMonthStats, txList, showAllCats]);

    const totalExpenseCats = Object.keys(currentMonthStats.categories || {}).length;
    // totalIncomeCats: usa incomeCategories si existe, sino calcula fallback desde txList
    const totalIncomeCats = useMemo(() => {
        const incomeCats = currentMonthStats.incomeCategories || {};
        if (Object.keys(incomeCats).length > 0) return Object.keys(incomeCats).length;
        // Fallback
        const cats = new Set<string>();
        txList.filter(t => t.type === 'income').forEach(t => cats.add(t.category));
        return cats.size;
    }, [currentMonthStats, txList]);

    const allCats = txType === 'expense'
        ? [...EXPENSE_CATS, ...customCats]
        : [...INCOME_CATS, ...customCats];

    // ─── Handlers ──────────────────────────────────────────────────────────────
    const openAdd = (type: 'income' | 'expense') => {
        setTxType(type);
        setTxAmount(''); setTxAccount(''); setTxCat(''); setTxCatEmoji('');
        setTxDesc(''); setTxError('');
        setShowAdd(true);
    };

    const openTransfer = () => {
        setTrFromAccount(''); setTrToAccount(''); setTrAmount('');
        setTrDesc(''); setTrError('');
        setShowTransfer(true);
    };

    const [isSaving, setIsSaving] = useState(false);

    const saveTransaction = async () => {
        if (!user || isSaving) return;
        setTxError('');
        const val = parseFloat(txAmount);
        if (!txAmount || isNaN(val) || val <= 0) { setTxError('Ingresa un monto válido.'); return; }
        if (!txAccount) { setTxError('Selecciona la cuenta.'); return; }
        if (!txCat) { setTxError('Selecciona una categoría.'); return; }

        setIsSaving(true);
        try {
            const now = new Date();
            const tx: Transaction = {
                id: Date.now(),
                type: txType,
                accountId: txAccount,
                amount: val,
                category: txCat,
                emoji: txCatEmoji,
                description: txDesc.trim(),
                dateISO: todayStr(),
                date: now.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
            };

            await FirestoreService.addTransaction(user.uid, tx);
            setTxList(prev => [tx, ...prev]);

            // Refresh main data to update balances immediately
            const updatedData = await FirestoreService.getFeatureData(user.uid, 'finance');
            if (updatedData) setData(updatedData as FinanceData);

            setShowAdd(false);
        } catch (e) {
            setTxError('Error al guardar. Intenta de nuevo.');
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const deleteTransaction = async () => {
        if (showDelModal === null || !user) return;
        const txToDelete = txList.find(t => t.id === showDelModal);
        if (!txToDelete) { setShowDelModal(null); return; }

        await FirestoreService.deleteTransaction(user.uid, txToDelete);
        setTxList(prev => prev.filter(t => t.id !== showDelModal));
        const updatedData = await FirestoreService.getFeatureData(user.uid, 'finance');
        if (updatedData) setData(updatedData as FinanceData);
        setShowDelModal(null);
    };

    const saveTransfer = async () => {
        if (!user || isSaving) return;
        setTrError('');
        const val = parseFloat(trAmount);
        if (!trAmount || isNaN(val) || val <= 0) { setTrError('Ingresa un monto válido.'); return; }
        if (!trFromAccount) { setTrError('Selecciona la cuenta de origen.'); return; }
        if (!trToAccount) { setTrError('Selecciona la cuenta de destino.'); return; }
        if (trFromAccount === trToAccount) { setTrError('Las cuentas deben ser diferentes.'); return; }

        // Permitir saldo negativo (útil para tarjetas de crédito o sobregiros)

        setIsSaving(true);
        try {
            const now = new Date();
            const transfer: TransferTransaction = {
                id: Date.now(),
                type: 'transfer',
                fromAccountId: trFromAccount,
                toAccountId: trToAccount,
                amount: val,
                description: trDesc.trim(),
                dateISO: todayStr(),
                date: now.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
            };

            await FirestoreService.addTransfer(user.uid, transfer);

            // Refresh main data to update balances immediately
            const updatedData = await FirestoreService.getFeatureData(user.uid, 'finance');
            if (updatedData) setData(updatedData as FinanceData);

            // Refresh transactions list
            const res = await FirestoreService.getTransactions(user.uid, null, 10);
            setTxList(res.transactions);
            setLastDoc(res.lastDoc);

            setShowTransfer(false);
        } catch (e) {
            setTrError('Error al guardar. Intenta de nuevo.');
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const deleteTransfer = async () => {
        if (showDelModal === null || !user) return;
        const transferToDelete = txList.find(t => t.id === showDelModal && t.type === 'transfer');
        if (!transferToDelete) { setShowDelModal(null); return; }

        await FirestoreService.deleteTransfer(user.uid, {
            id: transferToDelete.id,
            type: 'transfer',
            fromAccountId: transferToDelete.fromAccountId!,
            toAccountId: transferToDelete.toAccountId!,
            amount: transferToDelete.amount
        });
        setTxList(prev => prev.filter(t => t.id !== showDelModal));
        const updatedData = await FirestoreService.getFeatureData(user.uid, 'finance');
        if (updatedData) setData(updatedData as FinanceData);
        setShowDelModal(null);
    };

    const addCustomCategory = async () => {
        if (!newCatLabel.trim() || !newCatEmoji.trim()) return;
        const cat: CustomCategory = { emoji: newCatEmoji.trim(), label: newCatLabel.trim() };
        await save({ customCategories: [...customCats, cat] });
        setShowAddCat(false); setNewCatLabel(''); setNewCatEmoji('');
    };

    const deleteCustomCategory = async (label: string) => {
        if (confirm('¿Eliminar categoría?')) {
            await save({ customCategories: customCats.filter(c => c.label !== label) });
        }
    };

    // ── Add/Edit Account Functions ───────────────────────────────────────────────
    const openEditAccount = (acc: FinanceAccount) => {
        setEditingAccountId(acc.id);
        setNewAccountName(acc.name);
        setNewAccountEmoji(acc.emoji || '💳');
        setNewAccountBalance(''); // No se edita el balance inicial aquí
        setNewAccountColor(acc.color || 'slate');
        setShowAddAccount(true);
    };

    const saveCustomAccount = async () => {
        if (!newAccountName.trim() || isAddingAccount) return;

        setIsAddingAccount(true);

        try {
            if (editingAccountId) {
                // Modificar cuenta existente
                const updatedAccounts = accounts.map(acc => {
                    if (acc.id === editingAccountId) {
                        return {
                            ...acc,
                            name: newAccountName.trim(),
                            emoji: newAccountEmoji,
                            color: newAccountColor
                        };
                    }
                    return acc;
                });
                await save({ accounts: updatedAccounts });
                alert(`✅ Cuenta actualizada exitosamente`);
            } else {
                // Crear nueva
                const newAccount: FinanceAccount = {
                    id: `custom_${Date.now()}`,
                    name: newAccountName.trim(),
                    initialBalance: parseFloat(newAccountBalance) || 0,
                    balance: parseFloat(newAccountBalance) || 0,
                    emoji: newAccountEmoji,
                    color: newAccountColor
                };
                await save({ accounts: [...accounts, newAccount] });
                alert(`✅ Cuenta "${newAccount.name}" agregada exitosamente`);
            }
            setShowAddAccount(false);
            setNewAccountName('');
            setNewAccountEmoji('💳');
            setNewAccountBalance('');
            setNewAccountColor('slate');
            setEditingAccountId(null);
        } catch (error) {
            alert('❌ Error al guardar la cuenta. Intentá de nuevo.');
            console.error(error);
        } finally {
            setIsAddingAccount(false);
        }
    };

    const deleteCustomAccount = async (accountId: string) => {
        if (confirm('¿Eliminar esta cuenta? Se eliminarán también los movimientos asociados.')) {
            await save({ accounts: accounts.filter(a => a.id !== accountId) });
            alert('✅ Cuenta eliminada');
        }
    };

    const selectCat = (emoji: string, label: string) => {
        setTxCat(label); setTxCatEmoji(emoji);
    };

    const getAccountMeta = (accId: string) => {
        const acc = accounts.find(a => a.id === accId);
        if (!acc) return null;
        if (!accId.startsWith('custom_')) return ACCOUNT_META[accId] || { gradient: 'from-slate-200 to-gray-300', textColor: 'text-gray-900', badge: 'bg-white/50 text-gray-900', emoji: '💳' };

        const colorObj = ACCOUNT_COLORS.find(c => c.id === acc.color) || ACCOUNT_COLORS[0];
        return {
            gradient: colorObj.gradient,
            textColor: colorObj.textColor,
            badge: colorObj.badge,
            emoji: acc.emoji || '💳'
        };
    };

    const navigate = useNavigate();

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="pb-32 dark:bg-[#1a0d10]">

            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div className="px-6 pt-12 pb-2 flex items-center justify-between">
                <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">Finanzas 💛</h1>
                <div className="flex gap-2">
                    {/* Debts Button */}
                    <button onClick={() => navigate('/debts')} className="w-9 h-9 rounded-full bg-white dark:bg-[#2d1820] border border-slate-100 dark:border-[#5a2b35]/30 shadow-sm flex items-center justify-center hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-base text-pink-400">receipt_long</span>
                    </button>

                    {txList.length > 0 && (
                        <button onClick={() => exportCSV(txList, accounts)}
                            className="w-9 h-9 rounded-full bg-white dark:bg-[#2d1820] border border-slate-100 dark:border-[#5a2b35]/30 shadow-sm flex items-center justify-center hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined text-base text-slate-500 dark:text-slate-300">download</span>
                        </button>
                    )}
                </div>
            </div>

            {/* ── Total Balance Card ───────────────────────────────────────────── */}
            <div className="mx-6 mb-4">
                <div className="bg-gradient-to-br from-[#E0C3FC] to-[#8EC5FC] rounded-3xl p-6 shadow-xl relative overflow-hidden">
                    <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/30 rounded-full blur-2xl"></div>
                    <div className="absolute -left-4 -bottom-8 w-32 h-32 bg-white/30 rounded-full blur-2xl"></div>
                    <div className="relative z-10">
                        <p className="text-indigo-900/70 text-sm font-bold mb-1 uppercase tracking-wider">Balance total</p>
                        <h2 className="text-5xl font-extrabold tracking-tight mb-3 text-indigo-950">
                            {fmt(total)}
                        </h2>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-1.5 bg-white/40 px-3 py-1.5 rounded-xl backdrop-blur-sm">
                                <div className="w-6 h-6 rounded-full bg-emerald-400 flex items-center justify-center shadow-sm">
                                    <span className="material-symbols-outlined text-xs text-white">arrow_upward</span>
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-indigo-900/60 uppercase">Ingresos</p>
                                    <p className="text-sm font-bold text-emerald-700">{fmt(monthIn)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 bg-white/40 px-3 py-1.5 rounded-xl backdrop-blur-sm">
                                <div className="w-6 h-6 rounded-full bg-rose-400 flex items-center justify-center shadow-sm">
                                    <span className="material-symbols-outlined text-xs text-white">arrow_downward</span>
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-indigo-900/60 uppercase">Gastos</p>
                                    <p className="text-sm font-bold text-rose-700">{fmt(monthOut)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Accounts Horizontal Scroll ──────────────────────────────────── */}
            <div className="mb-5">
                <div className="px-6 mb-2 flex items-center justify-between">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">Mis cuentas</h3>
                    <span className="text-[10px] text-slate-400 hidden sm:inline">saldo actual</span>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setIsManagingAccounts(!isManagingAccounts)}
                            className={`text-[10px] font-bold flex items-center gap-1 transition-colors ${isManagingAccounts ? 'text-rose-500 hover:text-rose-600' : 'text-slate-400 hover:text-slate-500'}`}
                        >
                            <span className="material-symbols-outlined text-xs">{isManagingAccounts ? 'close' : 'settings'}</span>
                            {isManagingAccounts ? 'Listo' : 'Administrar'}
                        </button>
                        <button
                            onClick={() => {
                                setEditingAccountId(null);
                                setNewAccountName('');
                                setNewAccountEmoji('💳');
                                setNewAccountBalance('');
                                setNewAccountColor('slate');
                                setShowAddAccount(true);
                            }}
                            className="text-[10px] text-emerald-500 font-bold flex items-center gap-1 hover:text-emerald-600"
                        >
                            <span className="material-symbols-outlined text-xs">add_circle</span>
                            Agregar
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3 px-6 sm:grid-cols-3 md:grid-cols-5">
                    {accounts.map(acc => {
                        const isCustom = acc.id.startsWith('custom_');
                        let meta = ACCOUNT_META[acc.id] || { gradient: 'from-slate-200 to-gray-300', textColor: 'text-gray-900', badge: 'bg-white/50 text-gray-900', emoji: '💳' };
                        if (isCustom) {
                            const colorObj = ACCOUNT_COLORS.find(c => c.id === acc.color) || ACCOUNT_COLORS[0];
                            meta = {
                                gradient: colorObj.gradient,
                                textColor: colorObj.textColor,
                                badge: colorObj.badge,
                                emoji: acc.emoji || '💳'
                            };
                        }

                        return (
                            <div
                                key={acc.id}
                                className={`bg-gradient-to-br ${meta.gradient} rounded-2xl p-4 shadow-lg transition-all hover:scale-105 relative ${isManagingAccounts && isCustom ? 'animate-pulse ring-2 ring-rose-400' : ''}`}
                            >
                                {isManagingAccounts && isCustom && (
                                    <>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteCustomAccount(acc.id); }}
                                            className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform z-10"
                                            title="Eliminar cuenta"
                                        >
                                            <span className="material-symbols-outlined text-xs">delete</span>
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); openEditAccount(acc); }}
                                            className="absolute -top-2 right-6 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform z-10"
                                            title="Editar cuenta"
                                        >
                                            <span className="material-symbols-outlined text-xs" style={{ fontSize: '11px' }}>edit</span>
                                        </button>
                                    </>
                                )}
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xl">{meta.emoji}</span>
                                </div>
                                <p className={`text-xs font-bold ${meta.textColor} opacity-80 mb-0.5`}>{acc.name}</p>
                                <p className={`text-lg font-extrabold ${meta.textColor} leading-tight truncate`}>{fmt(acc.balance ?? acc.initialBalance)}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Quick Add Buttons ───────────────────────────────────────────── */}
            <div className="px-6 mb-5 flex gap-3">
                <button
                    onClick={() => openAdd('expense')}
                    className="flex-1 bg-rose-200 border-2 border-rose-300 rounded-2xl py-3 flex items-center justify-center gap-2 shadow-[2px_2px_0_#f43f5e] active:translate-y-[2px] active:shadow-none transition-all hover:bg-rose-100"
                >
                    <span className="w-8 h-8 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-sm">
                        <span className="material-symbols-outlined text-sm font-bold">arrow_downward</span>
                    </span>
                    <span className="font-extrabold text-rose-800 text-sm">Gasto</span>
                </button>
                <button
                    onClick={() => openAdd('income')}
                    className="flex-1 bg-emerald-200 border-2 border-emerald-300 rounded-2xl py-3 flex items-center justify-center gap-2 shadow-[2px_2px_0_#10b981] active:translate-y-[2px] active:shadow-none transition-all hover:bg-emerald-100"
                >
                    <span className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-sm">
                        <span className="material-symbols-outlined text-sm font-bold">arrow_upward</span>
                    </span>
                    <span className="font-extrabold text-emerald-800 text-sm">Ingreso</span>
                </button>
                <button
                    onClick={openTransfer}
                    className="flex-1 bg-blue-200 border-2 border-blue-300 rounded-2xl py-3 flex items-center justify-center gap-2 shadow-[2px_2px_0_#3b82f6] active:translate-y-[2px] active:shadow-none transition-all hover:bg-blue-100"
                >
                    <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-sm">
                        <span className="material-symbols-outlined text-sm font-bold">swap_horiz</span>
                    </span>
                    <span className="font-extrabold text-blue-800 text-sm">Transferir</span>
                </button>
            </div>

            {/* ── Category Stats ──────────────────────────────────────────────── */}
            {(catStats.length > 0 || incomeCatStats.length > 0 || availableMonths.length > 0) && (
                <div className="mx-6 mb-5 bg-white dark:bg-[#2d1820] rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-[#5a2b35]/30">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                            {showIncomeStats ? '💰 En qué gané más' : '💸 En qué gasté más'}
                        </h3>
                        {/* Toggle */}
                        <div className="flex bg-slate-100 dark:bg-[#1a0d10] rounded-full p-1">
                            <button
                                onClick={() => setShowIncomeStats(false)}
                                className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${!showIncomeStats
                                    ? 'bg-rose-400 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                    }`}
                            >
                                Gastos
                            </button>
                            <button
                                onClick={() => setShowIncomeStats(true)}
                                className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${showIncomeStats
                                    ? 'bg-emerald-400 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                    }`}
                            >
                                Ingresos
                            </button>
                        </div>
                    </div>

                    {/* Selector de Mes */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between gap-2">
                            <button
                                onClick={() => {
                                    const idx = availableMonths.indexOf(selectedMonth);
                                    if (idx < availableMonths.length - 1) {
                                        setSelectedMonth(availableMonths[idx + 1]);
                                    }
                                }}
                                disabled={selectedMonth === availableMonths[availableMonths.length - 1]}
                                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#3a2028] flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-[#5a2b35] transition-colors"
                            >
                                <span className="material-symbols-outlined text-sm">chevron_left</span>
                            </button>

                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="bg-slate-100 dark:bg-[#3a2028] border-0 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
                            >
                                {availableMonths.map(month => (
                                    <option key={month} value={month}>
                                        {formatMonthName(month)}
                                    </option>
                                ))}
                            </select>

                            <button
                                onClick={() => {
                                    const idx = availableMonths.indexOf(selectedMonth);
                                    if (idx > 0) {
                                        setSelectedMonth(availableMonths[idx - 1]);
                                    }
                                }}
                                disabled={selectedMonth === availableMonths[0]}
                                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#3a2028] flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-[#5a2b35] transition-colors"
                            >
                                <span className="material-symbols-outlined text-sm">chevron_right</span>
                            </button>
                        </div>
                        {selectedMonth !== thisMonth && (
                            <button
                                onClick={() => setSelectedMonth(thisMonth)}
                                className="w-full mt-2 text-xs text-emerald-500 font-bold hover:text-emerald-600"
                            >
                                Volver al mes actual
                            </button>
                        )}
                    </div>

                    {showIncomeStats ? (
                        /* Income Stats */
                        incomeCatStats.length > 0 ? (
                            <div className="space-y-2.5">
                                {incomeCatStats.map((cat, i) => {
                                    const pct = monthIn > 0 ? (cat.total / monthIn) * 100 : 0;
                                    const barColors = ['bg-emerald-400', 'bg-cyan-400', 'bg-blue-400', 'bg-violet-400', 'bg-amber-400'];
                                    return (
                                        <div key={cat.label}>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5">
                                                    <span>{cat.emoji}</span> {cat.label}
                                                </span>
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{fmt(cat.total)}</span>
                                            </div>
                                            <div className="w-full bg-slate-100 dark:bg-[#3a2028] h-1.5 rounded-full overflow-hidden">
                                                <div
                                                    className={`${barColors[i % barColors.length]} h-full rounded-full transition-all duration-700`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                                {/* Botón Ver más/menos para ingresos */}
                                {(totalIncomeCats > 5) && (
                                    <button
                                        onClick={() => setShowAllCats(prev => !prev)}
                                        className="w-full mt-2 text-xs text-emerald-500 font-bold hover:text-emerald-600 transition-colors"
                                    >
                                        {showAllCats ? 'Ver menos' : `Ver más (${totalIncomeCats - 5} más)`}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <p className="text-center text-sm text-slate-400 py-4">Sin ingresos en {formatMonthName(selectedMonth)}</p>
                        )
                    ) : (
                        /* Expense Stats */
                        catStats.length > 0 ? (
                            <div className="space-y-2.5">
                                {catStats.map((cat, i) => {
                                    const pct = monthOut > 0 ? (cat.total / monthOut) * 100 : 0;
                                    const barColors = ['bg-rose-400', 'bg-purple-400', 'bg-blue-400', 'bg-amber-400', 'bg-emerald-400'];
                                    return (
                                        <div key={cat.label}>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5">
                                                    <span>{cat.emoji}</span> {cat.label}
                                                </span>
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{fmt(cat.total)}</span>
                                            </div>
                                            <div className="w-full bg-slate-100 dark:bg-[#3a2028] h-1.5 rounded-full overflow-hidden">
                                                <div
                                                    className={`${barColors[i % barColors.length]} h-full rounded-full transition-all duration-700`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                                {/* Botón Ver más/menos para gastos */}
                                {((showIncomeStats && totalIncomeCats > 5) || (!showIncomeStats && totalExpenseCats > 5)) && (
                                    <button
                                        onClick={() => setShowAllCats(prev => !prev)}
                                        className="w-full mt-2 text-xs text-emerald-500 font-bold hover:text-emerald-600 transition-colors"
                                    >
                                        {showAllCats ? 'Ver menos' : `Ver más (${(showIncomeStats ? totalIncomeCats : totalExpenseCats) - 5} más)`}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <p className="text-center text-sm text-slate-400 py-4">Sin gastos en {formatMonthName(selectedMonth)}</p>
                        )
                    )}
                </div>
            )}

            {/* ── Transactions List ───────────────────────────────────────────── */}
            <div className="px-6 mb-10">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200">Movimientos</h3>
                </div>

                {txList.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                        {loadingTx ? (
                            <span className="animate-pulse">Cargando movimientos...</span>
                        ) : (
                            <>
                                <span className="text-4xl block mb-2">💸</span>
                                <p className="text-sm">Sin movimientos recientes.</p>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {txList.map(t => {
                            const isTransfer = t.type === 'transfer';
                            const fromAccMeta = t.fromAccountId ? getAccountMeta(t.fromAccountId) : null;
                            const toAccMeta = t.toAccountId ? getAccountMeta(t.toAccountId) : null;
                            const accMeta = t.accountId ? getAccountMeta(t.accountId) : null;

                            return (
                                <div
                                    key={t.id}
                                    className="bg-white dark:bg-[#2d1820] rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm border border-slate-50 dark:border-[#5a2b35]/20 group hover:shadow-md transition-all"
                                >
                                    {/* Icon bubble */}
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-xl ${isTransfer
                                        ? 'bg-blue-50 dark:bg-blue-900/20'
                                        : t.type === 'expense'
                                            ? 'bg-rose-50 dark:bg-rose-900/20'
                                            : 'bg-emerald-50 dark:bg-emerald-900/20'
                                        }`}>
                                        {isTransfer ? '💸' : (t.emoji || (t.type === 'expense' ? '💸' : '💰'))}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                                                {isTransfer ? 'Transferencia' : t.category}
                                            </p>
                                            {isTransfer ? (
                                                <>
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${fromAccMeta?.badge}`}>
                                                        {fromAccMeta?.emoji} {accounts.find(a => a.id === t.fromAccountId)?.name}
                                                    </span>
                                                    <span className="material-symbols-outlined text-xs text-slate-400">arrow_forward</span>
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${toAccMeta?.badge}`}>
                                                        {toAccMeta?.emoji} {accounts.find(a => a.id === t.toAccountId)?.name}
                                                    </span>
                                                </>
                                            ) : (
                                                accMeta && (
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${accMeta.badge}`}>
                                                        {accMeta.emoji} {accounts.find(a => a.id === t.accountId)?.name ?? t.accountId}
                                                    </span>
                                                )
                                            )}
                                        </div>
                                        {t.description && (
                                            <p className="text-xs text-slate-400 truncate">{t.description}</p>
                                        )}
                                        <p className="text-[10px] text-slate-400">{t.date}</p>
                                    </div>

                                    {/* Amount + delete */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className={`font-extrabold text-sm ${isTransfer
                                            ? 'text-blue-500'
                                            : t.type === 'expense'
                                                ? 'text-rose-500'
                                                : 'text-emerald-500'
                                            }`}>
                                            {isTransfer ? '' : (t.type === 'expense' ? '-' : '+')}{fmt(t.amount)}
                                        </span>
                                        <button
                                            onClick={() => setShowDelModal(t.id)}
                                            className="text-slate-300 dark:text-slate-600 hover:text-rose-400 transition-all p-1"
                                        >
                                            <span className="material-symbols-outlined text-base">delete</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Load More Button */}
                        {hasMore && (
                            <button
                                onClick={loadMore}
                                disabled={loadingTx}
                                className="w-full py-3 mt-4 text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                            >
                                {loadingTx ? 'Cargando...' : 'Cargar 10 más'}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                MODALS
            ════════════════════════════════════════════════════════════════════ */}

            {/* ── Add Transaction Bottom Sheet ────────────────────────────────── */}
            {showAdd && (
                <div className="fixed top-0 left-0 right-0 bottom-0 z-[70] flex flex-col justify-end sm:justify-center items-center overflow-hidden">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={() => setShowAdd(false)} />
                    <div className="relative w-full max-w-md bg-white dark:bg-[#231218] rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom duration-300 pointer-events-auto">

                        {/* Top spacing to avoid cutout on some mobile browsers */}
                        <div className="pt-2 sm:pt-0" />

                        {/* Handle / Header */}
                        <div className="flex flex-col items-center pt-3 pb-1 border-b border-slate-50 dark:border-white/5">
                            <div className="w-10 h-1 flex-shrink-0 rounded-full bg-slate-200 dark:bg-slate-600 mb-2" />
                        </div>

                        <div className="px-5 sm:px-6 pb-24 sm:pb-8 overflow-y-auto overflow-x-hidden flex-1 scrollbar-hide">
                            {/* Title */}
                            <div className="flex items-center justify-between gap-2 mb-5">
                                <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 min-w-0 truncate">
                                    {txType === 'expense' ? '💸 Nuevo gasto' : '💰 Nuevo ingreso'}
                                </h2>
                                {/* Type toggle */}
                                <div className="flex gap-1 flex-shrink-0 bg-slate-100 dark:bg-[#2d1820] rounded-full p-1">
                                    <button
                                        onClick={() => { setTxType('expense'); setTxCat(''); setTxCatEmoji(''); }}
                                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${txType === 'expense' ? 'bg-rose-400 text-white shadow-sm' : 'text-slate-400'}`}
                                    >Gasto</button>
                                    <button
                                        onClick={() => { setTxType('income'); setTxCat(''); setTxCatEmoji(''); }}
                                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${txType === 'income' ? 'bg-emerald-400 text-white shadow-sm' : 'text-slate-400'}`}
                                    >Ingreso</button>
                                </div>
                            </div>

                            {/* Amount */}
                            <div className="mb-5">
                                <label htmlFor="tx-amount" className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">Monto</label>
                                <div className={`flex items-center gap-2 bg-slate-50 dark:bg-[#2d1820] rounded-2xl px-4 py-3 border-2 transition-colors ${txAmount ? (txType === 'expense' ? 'border-rose-300' : 'border-emerald-300') : 'border-transparent'}`}>
                                    <span className="text-2xl font-extrabold text-slate-400 flex-shrink-0">$</span>
                                    <input
                                        id="tx-amount"
                                        type="number"
                                        value={txAmount}
                                        onChange={e => { setTxAmount(e.target.value); setTxError(''); }}
                                        placeholder="0"
                                        min="0"
                                        autoFocus
                                        className="flex-1 w-full min-w-0 text-3xl font-extrabold text-slate-800 dark:text-slate-100 bg-transparent focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Account selector */}
                            <div className="mb-5">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">
                                    {txType === 'expense' ? '¿De dónde sale?' : '¿A qué cuenta entra?'}
                                </label>
                                <div className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide pb-1">
                                    {accounts.map(acc => {
                                        const meta = getAccountMeta(acc.id);
                                        const selected = txAccount === acc.id;
                                        return (
                                            <button
                                                key={acc.id}
                                                onClick={() => setTxAccount(acc.id)}
                                                className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-2xl border-2 transition-all ${selected ? `border-violet-400 bg-violet-50 dark:bg-violet-900/30 scale-105` : 'border-slate-100 dark:border-[#5a2b35]/30 bg-white dark:bg-[#2d1820]'}`}
                                            >
                                                <span className="text-xl">{meta?.emoji || '💳'}</span>
                                                <span className={`text-[10px] w-full min-w-0 truncate font-bold text-center ${selected ? 'text-violet-600 dark:text-violet-300' : 'text-slate-500 dark:text-slate-400'}`}>{acc.name}</span>
                                                <span className="text-[9px] text-slate-400 truncate">{fmt(acc.balance ?? acc.initialBalance)}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Category grid */}
                            <div className="mb-5">
                                <div className="flex items-center justify-between mb-2 gap-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Categoría</label>
                                    <button
                                        onClick={() => setShowAddCat(true)}
                                        className="text-[10px] text-accent font-bold flex flex-shrink-0 items-center gap-0.5 hover:text-primary"
                                    >
                                        <span className="material-symbols-outlined text-xs">add</span> Nueva
                                    </button>
                                </div>
                                <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 sm:gap-2">
                                    {allCats.map(cat => {
                                        const selected = txCat === cat.label;
                                        const isCustom = customCats.some(c => c.label === cat.label);
                                        return (
                                            <div key={cat.label} className="relative group min-w-0">
                                                <button
                                                    onClick={() => selectCat(cat.emoji, cat.label)}
                                                    className={`w-full flex flex-col items-center gap-1 p-1.5 sm:p-2 rounded-xl border-2 transition-all overflow-hidden ${selected ? 'border-primary bg-primary/20 scale-105' : 'border-slate-100 dark:border-[#5a2b35]/20 bg-white dark:bg-[#2d1820] hover:border-primary/40'}`}
                                                >
                                                    <span className="text-lg flex-shrink-0">{cat.emoji}</span>
                                                    <span className={`text-[9px] font-bold text-center leading-tight truncate w-full px-0.5 ${selected ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>{cat.label}</span>
                                                </button>
                                                {isCustom && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); deleteCustomCategory(cat.label); }}
                                                        className="absolute -top-1 -right-1 z-10 bg-rose-400 text-white w-4 h-4 flex-shrink-0 rounded-full flex items-center justify-center shadow-sm hover:scale-110"
                                                    >
                                                        <span className="material-symbols-outlined text-[10px]">close</span>
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Description */}
                            <div className="mb-5">
                                <label htmlFor="tx-desc" className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">Descripción (opcional)</label>
                                <input
                                    id="tx-desc"
                                    type="text"
                                    value={txDesc}
                                    onChange={e => setTxDesc(e.target.value)}
                                    placeholder="Ej: Almuerzo con amigas..."
                                    className="w-full bg-slate-50 dark:bg-[#2d1820] dark:text-slate-200 border border-slate-100 dark:border-[#5a2b35]/30 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
                                />
                            </div>

                            {txError && (
                                <div className="mb-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/30 rounded-xl px-4 py-2 flex-shrink-0">
                                    <p className="text-xs text-rose-500 font-bold">{txError}</p>
                                </div>
                            )}

                            {/* Save button */}
                            <div className="w-full flex-shrink-0">
                                <button
                                    onClick={saveTransaction}
                                    disabled={isSaving}
                                    className={`w-full py-4 rounded-2xl font-extrabold text-white text-base shadow-lg hover:scale-[1.02] active:scale-95 transition-all ${isSaving ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed' : (txType === 'expense' ? 'bg-gradient-to-r from-rose-400 to-pink-500' : 'bg-gradient-to-r from-emerald-400 to-teal-500')}`}
                                >
                                    {isSaving ? 'Guardando...' : (txType === 'expense' ? '💸 Guardar gasto' : '💰 Guardar ingreso')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Transfer Modal ──────────────────────────────────────────────── */}
            {showTransfer && (
                <div className="fixed top-0 left-0 right-0 bottom-0 z-[70] flex flex-col justify-end sm:justify-center items-center overflow-hidden">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={() => setShowTransfer(false)} />
                    <div className="relative w-full max-w-md bg-white dark:bg-[#231218] rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom duration-300 pointer-events-auto">
                        <div className="pt-2 sm:pt-0" />
                        <div className="flex flex-col items-center pt-3 pb-1 border-b border-slate-50 dark:border-white/5">
                            <div className="w-10 h-1 flex-shrink-0 rounded-full bg-slate-200 dark:bg-slate-600 mb-2" />
                        </div>

                        <div className="px-5 sm:px-6 pb-24 sm:pb-8 overflow-y-auto overflow-x-hidden flex-1 scrollbar-hide">
                            <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 mb-5">
                                💸 Transferir entre cuentas
                            </h2>

                            {/* Amount */}
                            <div className="mb-5">
                                <label htmlFor="tr-amount" className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">Monto a transferir</label>
                                <div className={`flex items-center gap-2 bg-slate-50 dark:bg-[#2d1820] rounded-2xl px-4 py-3 border-2 transition-colors ${trAmount ? 'border-blue-300' : 'border-transparent'}`}>
                                    <span className="text-2xl font-extrabold text-slate-400 flex-shrink-0">$</span>
                                    <input
                                        id="tr-amount"
                                        type="number"
                                        value={trAmount}
                                        onChange={e => { setTrAmount(e.target.value); setTrError(''); }}
                                        placeholder="0"
                                        min="0"
                                        autoFocus
                                        className="flex-1 w-full min-w-0 text-3xl font-extrabold text-slate-800 dark:text-slate-100 bg-transparent focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Account From selector */}
                            <div className="mb-5">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">
                                    📤 Cuenta de origen
                                </label>
                                <div className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide pb-1">
                                    {accounts.map(acc => {
                                        const meta = getAccountMeta(acc.id);
                                        const selected = trFromAccount === acc.id;
                                        const balance = acc.balance ?? acc.initialBalance ?? 0;
                                        return (
                                            <button
                                                key={acc.id}
                                                onClick={() => setTrFromAccount(acc.id)}
                                                disabled={trToAccount === acc.id}
                                                className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-2xl border-2 transition-all ${selected
                                                    ? `border-blue-400 bg-blue-50 dark:bg-blue-900/30 scale-105`
                                                    : trToAccount === acc.id
                                                        ? 'border-slate-100 dark:border-[#5a2b35]/30 bg-slate-100 dark:bg-[#2d1820] opacity-50 cursor-not-allowed'
                                                        : 'border-slate-100 dark:border-[#5a2b35]/30 bg-white dark:bg-[#2d1820]'
                                                    }`}
                                            >
                                                <span className="text-xl">{meta?.emoji || '💳'}</span>
                                                <span className={`text-[10px] w-full min-w-0 truncate font-bold text-center ${selected ? 'text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>{acc.name}</span>
                                                <span className="text-[9px] text-slate-400 truncate">{fmt(balance)}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Account To selector */}
                            <div className="mb-5">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">
                                    📥 Cuenta de destino
                                </label>
                                <div className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide pb-1">
                                    {accounts.map(acc => {
                                        const meta = getAccountMeta(acc.id);
                                        const selected = trToAccount === acc.id;
                                        const balance = acc.balance ?? acc.initialBalance ?? 0;
                                        return (
                                            <button
                                                key={acc.id}
                                                onClick={() => setTrToAccount(acc.id)}
                                                disabled={trFromAccount === acc.id}
                                                className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-2xl border-2 transition-all ${selected
                                                    ? `border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 scale-105`
                                                    : trFromAccount === acc.id
                                                        ? 'border-slate-100 dark:border-[#5a2b35]/30 bg-slate-100 dark:bg-[#2d1820] opacity-50 cursor-not-allowed'
                                                        : 'border-slate-100 dark:border-[#5a2b35]/30 bg-white dark:bg-[#2d1820]'
                                                    }`}
                                            >
                                                <span className="text-xl">{meta?.emoji || '💳'}</span>
                                                <span className={`text-[10px] w-full min-w-0 truncate font-bold text-center ${selected ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}`}>{acc.name}</span>
                                                <span className="text-[9px] text-slate-400 truncate">{fmt(balance)}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Description */}
                            <div className="mb-5">
                                <label htmlFor="tr-desc" className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">Descripción (opcional)</label>
                                <input
                                    id="tr-desc"
                                    type="text"
                                    value={trDesc}
                                    onChange={e => setTrDesc(e.target.value)}
                                    placeholder="Ej: Ahorro para viaje..."
                                    className="w-full bg-slate-50 dark:bg-[#2d1820] dark:text-slate-200 border border-slate-100 dark:border-[#5a2b35]/30 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400"
                                />
                            </div>

                            {trError && (
                                <div className="mb-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/30 rounded-xl px-4 py-2 flex-shrink-0">
                                    <p className="text-xs text-rose-500 font-bold">{trError}</p>
                                </div>
                            )}

                            {/* Transfer summary */}
                            {trFromAccount && trToAccount && trAmount && (
                                <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-xl px-4 py-3">
                                    <p className="text-xs text-blue-700 dark:text-blue-300 font-bold text-center">
                                        Transferir {fmt(parseFloat(trAmount))} de {accounts.find(a => a.id === trFromAccount)?.name} a {accounts.find(a => a.id === trToAccount)?.name}
                                    </p>
                                </div>
                            )}

                            {/* Save button */}
                            <div className="w-full flex-shrink-0">
                                <button
                                    onClick={saveTransfer}
                                    disabled={isSaving}
                                    className={`w-full py-4 rounded-2xl font-extrabold text-white text-base shadow-lg hover:scale-[1.02] active:scale-95 transition-all ${isSaving ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed' : 'bg-gradient-to-r from-blue-400 to-cyan-500'}`}
                                >
                                    {isSaving ? 'Guardando...' : '💸 Transferir dinero'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Add Category Modal ───────────────────────────────────────────── */}
            {showAddCat && (
                <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-6" onClick={() => setShowAddCat(false)}>
                    <div className="bg-white dark:bg-[#2d1820] rounded-3xl p-6 w-full max-w-xs shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h2 className="font-extrabold text-slate-800 dark:text-slate-100 text-lg mb-4 text-center">Nueva categoría ✨</h2>
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                value={newCatEmoji}
                                onChange={e => setNewCatEmoji(e.target.value)}
                                placeholder="🌟"
                                maxLength={2}
                                className="w-16 text-center text-2xl bg-slate-50 dark:bg-[#1a0d10] border border-slate-200 dark:border-[#5a2b35]/40 rounded-2xl p-3 focus:outline-none focus:border-primary"
                            />
                            <input
                                type="text"
                                value={newCatLabel}
                                onChange={e => setNewCatLabel(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addCustomCategory()}
                                placeholder="Nombre..."
                                className="flex-1 bg-slate-50 dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setShowAddCat(false)} className="flex-1 bg-slate-100 dark:bg-[#3a2028] text-slate-500 py-3 rounded-2xl font-bold text-sm">
                                Cancelar
                            </button>
                            <button onClick={addCustomCategory} className="flex-1 bg-gradient-to-r from-primary to-pink-400 text-slate-800 py-3 rounded-2xl font-bold text-sm shadow-md">
                                Crear
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Add Account Modal ───────────────────────────────────────────── */}
            {showAddAccount && (
                <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-6" onClick={() => setShowAddAccount(false)}>
                    <div className="bg-white dark:bg-[#2d1820] rounded-3xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h2 className="font-extrabold text-slate-800 dark:text-slate-100 text-lg mb-4 text-center">{editingAccountId ? 'Editar cuenta 💳' : 'Nueva cuenta 💳'}</h2>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">Nombre de la cuenta</label>
                                <input
                                    type="text"
                                    value={newAccountName}
                                    onChange={e => setNewAccountName(e.target.value)}
                                    placeholder="Ej: Tarjeta Visa, Ahorros, etc."
                                    className="w-full bg-slate-50 dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-400"
                                />
                            </div>

                            {!editingAccountId && (
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">Saldo inicial</label>
                                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#1a0d10] border border-slate-200 dark:border-[#5a2b35]/40 rounded-2xl px-4 py-3">
                                        <span className="text-slate-400 font-bold">$</span>
                                        <input
                                            type="number"
                                            value={newAccountBalance}
                                            onChange={e => setNewAccountBalance(e.target.value)}
                                            placeholder="0"
                                            className="flex-1 bg-transparent focus:outline-none font-bold text-slate-800 dark:text-slate-100"
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">Ícono (emoji)</label>
                                <input
                                    type="text"
                                    value={newAccountEmoji}
                                    onChange={e => setNewAccountEmoji(e.target.value)}
                                    placeholder="Escribí un emoji..."
                                    maxLength={4}
                                    className="w-full bg-slate-50 dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-2xl px-4 py-3 text-center text-2xl focus:outline-none focus:border-emerald-400 mb-3"
                                />
                                <div className="flex gap-2 flex-wrap justify-center mb-4">
                                    {['💳', '🏦', '💰', '💎', '📱', '💵', '🪙', '💷', '💶', '🏅', '🎯', '🔒'].map(emoji => (
                                        <button
                                            key={emoji}
                                            onClick={() => setNewAccountEmoji(emoji)}
                                            className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${newAccountEmoji === emoji
                                                ? 'bg-emerald-100 dark:bg-emerald-900/30 border-2 border-emerald-500 scale-110'
                                                : 'bg-slate-100 dark:bg-[#3a2028] border-2 border-transparent hover:scale-105'
                                                }`}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>

                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">Color de la tarjeta</label>
                                <div className="flex gap-2 flex-wrap justify-center">
                                    {ACCOUNT_COLORS.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => setNewAccountColor(c.id)}
                                            className={`w-8 h-8 rounded-full transition-all ${c.colorCode} ${newAccountColor === c.id
                                                ? 'ring-4 ring-emerald-400 scale-110 shadow-lg'
                                                : 'hover:scale-110 opacity-70 border-2 border-transparent hover:opacity-100'
                                                }`}
                                            title={c.id}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowAddAccount(false)}
                                disabled={isAddingAccount}
                                className="flex-1 bg-slate-100 dark:bg-[#3a2028] text-slate-500 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={saveCustomAccount}
                                disabled={!newAccountName.trim() || isAddingAccount}
                                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3 rounded-2xl font-bold text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isAddingAccount ? (
                                    <>
                                        <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                                        Guardando...
                                    </>
                                ) : (
                                    editingAccountId ? 'Guardar Cambios' : 'Agregar Cuenta'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Confirm Modal ─────���───────────────────────────────────── */}
            {showDelModal !== null && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={() => setShowDelModal(null)}>
                    <div className="bg-white dark:bg-[#2d1820] rounded-3xl p-6 w-full max-w-xs shadow-2xl text-center" onClick={e => e.stopPropagation()}>
                        <span className="material-symbols-outlined text-5xl text-rose-400 mb-3 block">delete_forever</span>
                        <h2 className="font-extrabold text-slate-800 dark:text-slate-100 text-lg mb-1">¿Eliminar movimiento?</h2>
                        <p className="text-sm text-slate-400 mb-5">Esta acción no se puede deshacer.</p>
                        <div className="flex gap-2">
                            <button onClick={() => setShowDelModal(null)} className="flex-1 bg-slate-100 dark:bg-[#3a2028] text-slate-500 dark:text-slate-300 py-3 rounded-2xl font-bold text-sm">
                                Cancelar
                            </button>
                            <button onClick={() => {
                                const isTransfer = txList.find(t => t.id === showDelModal && t.type === 'transfer');
                                if (isTransfer) {
                                    deleteTransfer();
                                } else {
                                    deleteTransaction();
                                }
                            }} className="flex-1 bg-rose-500 text-white py-3 rounded-2xl font-bold text-sm hover:bg-rose-600 transition-colors">
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
