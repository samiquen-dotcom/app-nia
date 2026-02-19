import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FirestoreService } from '../services/firestore';
import { Features } from '../services/firestore';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface Debt {
    id: string;
    title: string;
    amount: number;
    type: 'unique' | 'recurring';
    frequency?: 'weekly' | 'biweekly' | 'monthly';
    dueDate: string; // ISO date string YYYY-MM-DD
}

interface DebtsData {
    items: Debt[];
}

export const DebtsScreen: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [debts, setDebts] = useState<Debt[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingDebt, setEditingDebt] = useState<Debt | null>(null);

    // Form State
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<'unique' | 'recurring'>('unique');
    const [frequency, setFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('monthly');
    const [dueDate, setDueDate] = useState('');

    useEffect(() => {
        if (!user) return;
        loadDebts();
    }, [user]);

    const loadDebts = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = await FirestoreService.getFeatureData(user.uid, Features.DEBTS);
            if (data && (data as DebtsData).items) {
                // Sort by due date
                const items = (data as DebtsData).items;
                items.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
                setDebts(items);
            } else {
                setDebts([]);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!user) return;

        const t = title.trim();
        if (!t) { alert('Falta el título'); return; }

        const amt = parseFloat(amount);
        if (!amount || isNaN(amt) || amt <= 0) { alert('Monto inválido'); return; }

        if (!dueDate) { alert('Falta la fecha'); return; }

        try {
            // Create proper object without undefined fields
            const newDebt: Debt = {
                id: editingDebt ? editingDebt.id : Date.now().toString(),
                title: t,
                amount: amt,
                type,
                frequency: type === 'recurring' ? frequency : undefined,
                dueDate
            };

            // Sanitize for Firestore
            // We create a cleaner copy to save, removing undefined keys
            const debtToSave = { ...newDebt };
            if (debtToSave.type === 'unique') {
                delete debtToSave.frequency;
            }

            let updatedDebts = [...debts];
            if (editingDebt) {
                updatedDebts = updatedDebts.map(d => d.id === editingDebt.id ? newDebt : d);
            } else {
                updatedDebts.push(newDebt);
            }
            updatedDebts.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

            // 1. Update UI immediately
            setDebts(updatedDebts);
            closeModal();

            // 2. Save to Cloud
            // Map the whole array to ensure no undefined fields in any item
            const itemsToSave = updatedDebts.map(d => {
                const copy = { ...d };
                if (copy.type === 'unique') delete copy.frequency;
                return copy;
            });

            const ref = doc(db, `users/${user.uid}/features`, 'debts');
            await setDoc(ref, { items: itemsToSave }, { merge: true });

        } catch (e) {
            console.error("Error saving debt:", e);
            alert("Error al guardar: " + e);
            loadDebts();
        }
    };

    const handlePay = async (debt: Debt) => {
        if (!user) return;

        // Removed confirm to ensure UX responsiveness
        // if (!confirm(`¿Marcar "${debt.title}" como pagada?`)) return;

        try {
            let updatedDebts = [...debts];

            if (debt.type === 'unique') {
                // Remove if unique
                updatedDebts = updatedDebts.filter(d => d.id !== debt.id);
            } else {
                // Update date if recurring
                const parts = debt.dueDate.split('-');
                if (parts.length !== 3) {
                    alert("Error en formato de fecha. Edita la deuda primero.");
                    return;
                }
                const [y, m, d] = parts.map(Number);
                const current = new Date(y, m - 1, d); // Month is 0-indexed
                const next = new Date(current);

                // Add frequency logic
                if (debt.frequency === 'weekly') {
                    next.setDate(current.getDate() + 7);
                } else if (debt.frequency === 'biweekly') {
                    next.setDate(current.getDate() + 15);
                } else if (debt.frequency === 'monthly') {
                    next.setMonth(current.getMonth() + 1);
                } else {
                    // Default to monthly if missing
                    next.setMonth(current.getMonth() + 1);
                }

                // Format back to YYYY-MM-DD manually
                const nextY = next.getFullYear();
                const nextM = String(next.getMonth() + 1).padStart(2, '0');
                const nextD = String(next.getDate()).padStart(2, '0');
                const nextIso = `${nextY}-${nextM}-${nextD}`;

                updatedDebts = updatedDebts.map(d =>
                    d.id === debt.id ? { ...d, dueDate: nextIso } : d
                );
            }

            // Sort
            updatedDebts.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

            // Update local state immediately for instant feedback
            setDebts(updatedDebts);

            // Save to Firestore
            const ref = doc(db, `users/${user.uid}/features`, 'debts');
            await setDoc(ref, { items: updatedDebts }, { merge: true });

        } catch (e) {
            console.error("Error paying debt:", e);
            alert("Hubo un error al guardar. Recargando...");
            loadDebts();
        }
    };

    const openModal = (debt?: Debt) => {
        if (debt) {
            setEditingDebt(debt);
            setTitle(debt.title);
            setAmount(debt.amount.toString());
            setType(debt.type);
            setFrequency(debt.frequency || 'monthly');
            setDueDate(debt.dueDate);
        } else {
            setEditingDebt(null);
            setTitle('');
            setAmount('');
            setType('unique');
            setFrequency('monthly');
            setDueDate(new Date().toISOString().split('T')[0]);
        }
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingDebt(null);
    };

    const fmt = (n: number) => n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

    const getDaysUntil = (dateStr: string) => {

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        // adjust target timezone if needed, simple diff for now
        // Assuming dateStr is local YYYY-MM-DD
        const targetLocal = new Date(dateStr + 'T00:00:00');
        const diffTime = targetLocal.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return `Venció hace ${Math.abs(diffDays)} días`;
        if (diffDays === 0) return '¡Vence hoy!';
        if (diffDays === 1) return 'Mañana';
        return `En ${diffDays} días`;
    };

    const isOverdue = (dateStr: string) => {
        const target = new Date(dateStr + 'T23:59:59');
        return target < new Date();
    };

    return (
        <div className="pb-24 min-h-screen bg-slate-50 dark:bg-[#1a0d10]">
            {/* Header */}
            <header className="px-6 pt-12 pb-6 flex items-center justify-between bg-white dark:bg-[#231218] sticky top-0 z-10 shadow-sm rounded-b-3xl">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/finance')}
                        className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#3a2028] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">Deudas 🐰</h1>
                </div>
                <button
                    onClick={() => openModal()}
                    className="bg-gradient-to-r from-pink-400 to-rose-400 text-white px-4 py-2 rounded-2xl font-bold shadow-lg shadow-pink-200 dark:shadow-none hover:scale-105 transition-transform flex items-center gap-2"
                >
                    <span className="material-symbols-outlined text-lg">add</span>
                    Nueva
                </button>
            </header>

            <div className="px-6 py-6 space-y-4">
                {loading ? (
                    <div className="text-center py-20 text-slate-400">Cargando...</div>
                ) : debts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
                        <span className="text-6xl mb-4">🎉</span>
                        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">¡Libre de deudas!</h3>
                        <p className="text-sm text-slate-400 max-w-[200px]">No tienes pagos pendientes por ahora. ¡Disfruta!</p>
                    </div>
                ) : (
                    debts.map(debt => {
                        const overdue = isOverdue(debt.dueDate);
                        return (
                            <div key={debt.id} className={`bg-white dark:bg-[#231218] p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-[#5a2b35]/30 flex flex-col gap-3 relative overflow-hidden group hover:shadow-md transition-shadow ${overdue ? 'border-l-4 border-l-rose-400' : 'border-l-4 border-l-emerald-400'}`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{debt.title}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${debt.type === 'recurring' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                                                {debt.type === 'recurring' ? (debt.frequency === 'weekly' ? 'Semanal' : debt.frequency === 'biweekly' ? 'Quincenal' : 'Mensual') : 'Único'}
                                            </span>
                                            <span className={`text-xs font-bold flex items-center gap-1 ${overdue ? 'text-rose-500' : 'text-slate-400'}`}>
                                                <span className="material-symbols-outlined text-sm">event</span>
                                                {getDaysUntil(debt.dueDate)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{fmt(debt.amount)}</div>
                                        <p className="text-[10px] text-slate-400">{new Date(debt.dueDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 mt-2 pt-3 border-t border-slate-50 dark:border-white/5">
                                    <button
                                        onClick={() => openModal(debt)}
                                        className="flex-1 py-2 rounded-xl bg-slate-50 dark:bg-[#3a2028] text-slate-500 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 transition-colors"
                                    >
                                        Editar
                                    </button>
                                    <button
                                        onClick={() => handlePay(debt)}
                                        className="flex-1 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1"
                                    >
                                        <span className="material-symbols-outlined text-sm">check_circle</span>
                                        {debt.type === 'recurring' ? 'Ya pagué' : 'Pagado'}
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" onClick={closeModal}>
                    <div className="bg-white dark:bg-[#2d1820] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
                                {editingDebt ? 'Editar deuda' : 'Nueva deuda ✨'}
                            </h2>
                            <button onClick={closeModal} className="text-slate-400 hover:text-rose-500">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 block">Título</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="Ej: Tarjeta de crédito..."
                                    className="w-full bg-slate-50 dark:bg-[#1a0d10] border border-slate-200 dark:border-[#5a2b35]/50 rounded-2xl px-4 py-3 focus:outline-none focus:border-pink-400 dark:text-slate-100"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 block">Monto</label>
                                <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#1a0d10] border border-slate-200 dark:border-[#5a2b35]/50 rounded-2xl px-4 py-3 focus-within:border-pink-400">
                                    <span className="text-slate-400 font-bold">$</span>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        placeholder="0"
                                        className="flex-1 bg-transparent focus:outline-none font-bold text-slate-800 dark:text-slate-100"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 block">Tipo</label>
                                    <div className="flex bg-slate-100 dark:bg-[#1a0d10] rounded-xl p-1">
                                        <button
                                            onClick={() => setType('unique')}
                                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${type === 'unique' ? 'bg-white dark:bg-[#3a2028] shadow-sm text-pink-500' : 'text-slate-400'}`}
                                        >
                                            Único
                                        </button>
                                        <button
                                            onClick={() => setType('recurring')}
                                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${type === 'recurring' ? 'bg-white dark:bg-[#3a2028] shadow-sm text-purple-500' : 'text-slate-400'}`}
                                        >
                                            Repetitivo
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {type === 'recurring' && (
                                <div className="animate-in fade-in slide-in-from-top-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 block">Frecuencia</label>
                                    <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
                                        {[
                                            { id: 'weekly', label: 'Semanal' },
                                            { id: 'biweekly', label: 'Quincenal' },
                                            { id: 'monthly', label: 'Mensual' }
                                        ].map(f => (
                                            <button
                                                key={f.id}
                                                onClick={() => setFrequency(f.id as any)}
                                                className={`px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all whitespace-nowrap ${frequency === f.id ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300' : 'border-slate-100 dark:border-[#5a2b35]/30 bg-white dark:bg-[#1a0d10] text-slate-400'}`}
                                            >
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 block">Próximo pago</label>
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={e => setDueDate(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-[#1a0d10] border border-slate-200 dark:border-[#5a2b35]/50 rounded-2xl px-4 py-3 focus:outline-none focus:border-pink-400 dark:text-slate-100 font-bold"
                                />
                            </div>

                            <button
                                onClick={handleSave}
                                className="w-full py-4 mt-4 bg-slate-900 dark:bg-pink-500 text-white rounded-2xl font-extrabold text-base shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
                            >
                                {editingDebt ? 'Guardar cambios' : 'Crear deuda'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
