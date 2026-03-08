import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFeatureData } from '../hooks/useFeatureData';
import { useAuth } from '../context/AuthContext';
import { FirestoreService } from '../services/firestore';
import type { FinanceData, FinanceAccount, Transaction, CustomCategory } from '../types';

// ─── Visual config for accounts ───────────────────────────────────────────────
const ACCOUNT_META: Record<string, { gradient: string; textColor: string; badge: string; emoji: string }> = {
    nequi: { gradient: 'from-violet-200 to-purple-300', textColor: 'text-purple-900', badge: 'bg-white/50 text-purple-900', emoji: '💜' },
    efectivo: { gradient: 'from-emerald-200 to-green-300', textColor: 'text-emerald-900', badge: 'bg-white/50 text-emerald-900', emoji: '💵' },
    daviplata: { gradient: 'from-fuchsia-200 to-pink-300', textColor: 'text-pink-900', badge: 'bg-white/50 text-pink-900', emoji: '🟣' },
    davivienda: { gradient: 'from-rose-200 to-red-300', textColor: 'text-rose-900', badge: 'bg-white/50 text-rose-900', emoji: '🔴' },
    bancolombia: { gradient: 'from-yellow-100 to-amber-200', textColor: 'text-amber-900', badge: 'bg-white/50 text-amber-900', emoji: '💛' },
    bolsillo: { gradient: 'from-sky-200 to-cyan-300', textColor: 'text-sky-900', badge: 'bg-white/50 text-sky-900', emoji: '👖' },
};

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
const todayStr = () => new Date().toISOString().split('T')[0];

const fmt = (n: number) => {
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
    return `${sign}$${abs.toFixed(0)}`;
};

const getCurrentMonth = () => new Date().toISOString().slice(0, 7); // YYYY-MM

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

    const [txType, setTxType] = useState<'income' | 'expense'>('expense');
    const [txAmount, setTxAmount] = useState('');
    const [txAccount, setTxAccount] = useState('');
    const [txCat, setTxCat] = useState('');
    const [txCatEmoji, setTxCatEmoji] = useState('');
    const [txDesc, setTxDesc] = useState('');
    const [txError, setTxError] = useState('');

    const [newCatLabel, setNewCatLabel] = useState('');
    const [newCatEmoji, setNewCatEmoji] = useState('');

    // ─── Computed ───────────────────────────────────────────────────────────────
    // Using persisted balances from data.accounts
    const total = accounts.reduce((s, a) => s + (a.balance ?? a.initialBalance), 0);

    const thisMonth = getCurrentMonth();
    const currentMonthStats = data.monthStats?.[thisMonth] || { income: 0, expense: 0, categories: {} };

    const monthIn = currentMonthStats.income;
    const monthOut = currentMonthStats.expense;

    const catStats = useMemo(() => {
        const cats = currentMonthStats.categories || {};
        return Object.entries(cats)
            .map(([label, v]) => ({ label, ...v }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);
    }, [currentMonthStats]);

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

    const selectCat = (emoji: string, label: string) => {
        setTxCat(label); setTxCatEmoji(emoji);
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
                    <span className="text-[10px] text-slate-400">saldo actual</span>
                </div>
                <div className="grid grid-cols-2 gap-3 px-6 sm:grid-cols-3 md:grid-cols-5">
                    {accounts.map(acc => {
                        const meta = ACCOUNT_META[acc.id];
                        return (
                            <div
                                key={acc.id}
                                className={`bg-gradient-to-br ${meta.gradient} rounded-2xl p-4 shadow-lg transition-all hover:scale-105`}
                            >
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
            </div>

            {/* ── Category Stats ──────────────────────────────────────────────── */}
            {catStats.length > 0 && (
                <div className="mx-6 mb-5 bg-white dark:bg-[#2d1820] rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-[#5a2b35]/30">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm mb-3">En qué gasté este mes</h3>
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
                    </div>
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
                            const accMeta = ACCOUNT_META[t.accountId];
                            return (
                                <div
                                    key={t.id}
                                    className="bg-white dark:bg-[#2d1820] rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm border border-slate-50 dark:border-[#5a2b35]/20 group hover:shadow-md transition-all"
                                >
                                    {/* Category emoji bubble */}
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-xl ${t.type === 'expense' ? 'bg-rose-50 dark:bg-rose-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
                                        {t.emoji || (t.type === 'expense' ? '💸' : '💰')}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">{t.category}</p>
                                            {accMeta && (
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${accMeta.badge}`}>
                                                    {accMeta.emoji} {accounts.find(a => a.id === t.accountId)?.name ?? t.accountId}
                                                </span>
                                            )}
                                        </div>
                                        {t.description && (
                                            <p className="text-xs text-slate-400 truncate">{t.description}</p>
                                        )}
                                        <p className="text-[10px] text-slate-400">{t.date}</p>
                                    </div>

                                    {/* Amount + delete */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className={`font-extrabold text-sm ${t.type === 'expense' ? 'text-rose-500' : 'text-emerald-500'}`}>
                                            {t.type === 'expense' ? '-' : '+'}{fmt(t.amount)}
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
                                        const meta = ACCOUNT_META[acc.id];
                                        const selected = txAccount === acc.id;
                                        return (
                                            <button
                                                key={acc.id}
                                                onClick={() => setTxAccount(acc.id)}
                                                className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-2xl border-2 transition-all ${selected ? `border-violet-400 bg-violet-50 dark:bg-violet-900/30 scale-105` : 'border-slate-100 dark:border-[#5a2b35]/30 bg-white dark:bg-[#2d1820]'}`}
                                            >
                                                <span className="text-xl">{meta.emoji}</span>
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

            {/* ── Delete Confirm Modal ─────────────────────────────────────────── */}
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
                            <button onClick={deleteTransaction} className="flex-1 bg-rose-500 text-white py-3 rounded-2xl font-bold text-sm hover:bg-rose-600 transition-colors">
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
