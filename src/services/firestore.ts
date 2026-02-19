import { db } from '../firebase';
import {
    doc,
    setDoc,
    getDoc,
    Timestamp,
    collection,
    query,
    orderBy,
    limit,
    startAfter,
    getDocs,
    runTransaction,
    deleteField,
    writeBatch
} from 'firebase/firestore';
import type { Transaction as Trade, FinanceAccount, MonthStats } from '../types'; // Renamed to avoid collision with Firestore Transaction

const DEFAULT_ACCOUNTS: FinanceAccount[] = [
    { id: 'nequi', name: 'Nequi', initialBalance: 0, balance: 0 },
    { id: 'efectivo', name: 'Efectivo', initialBalance: 0, balance: 0 },
    { id: 'daviplata', name: 'Daviplata', initialBalance: 0, balance: 0 },
    { id: 'davivienda', name: 'Davivienda', initialBalance: 0, balance: 0 },
    { id: 'bancolombia', name: 'Bancolombia', initialBalance: 0, balance: 0 },
];

export const Features = {
    FINANCE: 'finance',
    GYM: 'gym',
    FOOD: 'food',
    WELLNESS: 'wellness',
    PERIOD: 'period',
    GOALS: 'goals',
    MOOD: 'mood',
};

const getUserDoc = (userId: string) => doc(db, 'users', userId);

export const FirestoreService = {
    // Inicializar usuario si es nuevo
    initUser: async (user: any) => {
        const userRef = getUserDoc(user.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
            await setDoc(userRef, {
                email: user.email,
                name: user.displayName,
                createdAt: Timestamp.now(),
            });
            console.log('User initialized in Firestore');
        }
    },

    // Guardar datos de una feature (ej. 'finance', 'gym')
    saveFeatureData: async (userId: string, feature: string, data: any) => {
        try {
            await setDoc(doc(db, `users/${userId}/features`, feature), data, { merge: true });
        } catch (e) {
            console.error(`Error saving ${feature}:`, e);
            throw e;
        }
    },

    // Obtener datos de una feature
    getFeatureData: async (userId: string, feature: string) => {
        try {
            const snap = await getDoc(doc(db, `users/${userId}/features`, feature));
            return snap.exists() ? snap.data() : null;
        } catch (e) {
            console.error(`Error getting ${feature}:`, e);
            return null;
        }
    },

    // ─── TRANSACTION METHODS ───

    // Obtener transacciones paginadas
    getTransactions: async (userId: string, lastVisible: any = null, pageSize: number = 10) => {
        try {
            const txRef = collection(db, `users/${userId}/features/${Features.FINANCE}/transactions`);
            let q = query(txRef, orderBy('id', 'desc'), limit(pageSize)); // id is num timestamp, so implies time order

            if (lastVisible) {
                q = query(txRef, orderBy('id', 'desc'), startAfter(lastVisible), limit(pageSize));
            }

            const snap = await getDocs(q);
            const transactions: Trade[] = [];
            snap.forEach(doc => transactions.push(doc.data() as Trade));

            return {
                transactions,
                lastDoc: snap.docs[snap.docs.length - 1]
            };
        } catch (e) {
            console.error("Error fetching transactions:", e);
            return { transactions: [], lastDoc: null };
        }
    },

    // Agregar transacción y actualizar balances atómicamente
    addTransaction: async (userId: string, tx: Trade) => {
        const financeRef = doc(db, `users/${userId}/features`, Features.FINANCE);
        const txCollectionRef = collection(financeRef, 'transactions');

        try {
            await runTransaction(db, async (transaction) => {
                // 1. Leer documento principal de finanzas
                const financeDoc = await transaction.get(financeRef);
                const financeData = financeDoc.exists() ? financeDoc.data() : { accounts: [], monthStats: {} };

                let accounts = (financeData.accounts && financeData.accounts.length > 0)
                    ? financeData.accounts as FinanceAccount[]
                    : JSON.parse(JSON.stringify(DEFAULT_ACCOUNTS)); // Clone deeply to avoid ref issues
                let monthStats = (financeData.monthStats || {}) as Record<string, MonthStats>;

                // 2. Calcular nuevo balance de cuenta
                const accountIndex = accounts.findIndex(a => a.id === tx.accountId);
                if (accountIndex >= 0) {
                    const acc = accounts[accountIndex];
                    const amount = tx.amount;
                    // Asegurar que balance existe, si no usar initialBalance (migración on-the-fly)
                    const currentBalance = acc.balance ?? acc.initialBalance ?? 0;

                    acc.balance = tx.type === 'income'
                        ? currentBalance + amount
                        : currentBalance - amount;
                }

                // 3. Actualizar estadísticas del mes
                const monthKey = tx.dateISO.slice(0, 7); // YYYY-MM
                if (!monthStats[monthKey]) {
                    monthStats[monthKey] = { income: 0, expense: 0, categories: {} };
                }

                if (tx.type === 'income') {
                    monthStats[monthKey].income += tx.amount;
                } else {
                    monthStats[monthKey].expense += tx.amount;
                    // Stats por categoría
                    const catStats = monthStats[monthKey].categories[tx.category] || { total: 0, emoji: tx.emoji };
                    catStats.total += tx.amount;
                    catStats.emoji = tx.emoji; // Update emoji just in case
                    monthStats[monthKey].categories[tx.category] = catStats;
                }

                // 4. Escribir actualizaciones
                // Crear nueva referencia de documento para la transacción
                const newTxRef = doc(txCollectionRef, String(tx.id));
                transaction.set(newTxRef, tx);

                // Actualizar documento principal con nuevos balances y stats
                // IMPORTANTE: No guardamos 'transactions', y si existe, lo borramos con deleteField()
                transaction.set(financeRef, {
                    accounts,
                    monthStats,
                    customCategories: financeData.customCategories || [],
                    transactions: deleteField()
                }, { merge: true });
            });
        } catch (e) {
            console.error("Error adding transaction:", e);
            throw e;
        }
    },

    // Eliminar transacción y revertir balances
    deleteTransaction: async (userId: string, tx: Trade) => {
        const financeRef = doc(db, `users/${userId}/features`, Features.FINANCE);
        const txRef = doc(db, `users/${userId}/features/${Features.FINANCE}/transactions`, String(tx.id));

        try {
            await runTransaction(db, async (transaction) => {
                const financeDoc = await transaction.get(financeRef);
                if (!financeDoc.exists()) throw "Finance doc missing";

                const financeData = financeDoc.data();
                let accounts = (financeData.accounts && financeData.accounts.length > 0)
                    ? financeData.accounts as FinanceAccount[]
                    : JSON.parse(JSON.stringify(DEFAULT_ACCOUNTS));
                let monthStats = (financeData.monthStats || {}) as Record<string, MonthStats>;

                // Revertir balance
                const accountIndex = accounts.findIndex(a => a.id === tx.accountId);
                if (accountIndex >= 0) {
                    const acc = accounts[accountIndex];
                    // Revert logic: if income was added, subtract it. If expense was subtracted, add it.
                    const currentBalance = acc.balance ?? acc.initialBalance ?? 0;
                    acc.balance = tx.type === 'income'
                        ? currentBalance - tx.amount
                        : currentBalance + tx.amount;
                }

                // Revertir stats mes
                const monthKey = tx.dateISO.slice(0, 7);
                if (monthStats[monthKey]) {
                    if (tx.type === 'income') {
                        monthStats[monthKey].income -= tx.amount;
                    } else {
                        monthStats[monthKey].expense -= tx.amount;
                        if (monthStats[monthKey].categories[tx.category]) {
                            monthStats[monthKey].categories[tx.category].total -= tx.amount;
                            if (monthStats[monthKey].categories[tx.category].total <= 0) {
                                delete monthStats[monthKey].categories[tx.category];
                            }
                        }
                    }
                }

                transaction.delete(txRef);
                transaction.set(financeRef, { accounts, monthStats }, { merge: true });
            });
        } catch (e) {
            console.error("Error deleting transaction:", e);
            throw e;
        }
    },

    // Migrar datos antiguos (array en doc principal) a nueva estructura
    // Call this if data.transactions exists and length > 0
    migrateLegacyData: async (userId: string, legacyTxs: Trade[], currentAccounts: FinanceAccount[]) => {
        if (!legacyTxs || legacyTxs.length === 0) return;

        const financeRef = doc(db, `users/${userId}/features`, Features.FINANCE);
        const txCollectionRef = collection(financeRef, 'transactions');

        const accounts = [...currentAccounts]; // clone
        const monthStats: Record<string, MonthStats> = {};

        // Empezar batch
        let batch = writeBatch(db);
        let opCount = 0;

        for (const tx of legacyTxs) {
            // 1. Add to subcollection
            const newTxRef = doc(txCollectionRef, String(tx.id));
            batch.set(newTxRef, tx);
            opCount++;

            // 2. Update balances locally
            const accIndex = accounts.findIndex(a => a.id === tx.accountId);
            if (accIndex >= 0) {
                const acc = accounts[accIndex];
                const currentBalance = acc.balance ?? acc.initialBalance ?? 0;
                acc.balance = tx.type === 'income' ? currentBalance + tx.amount : currentBalance - tx.amount;
            }

            // 3. Update stats locally
            const monthKey = tx.dateISO.slice(0, 7);
            if (!monthStats[monthKey]) monthStats[monthKey] = { income: 0, expense: 0, categories: {} };

            if (tx.type === 'income') {
                monthStats[monthKey].income += tx.amount;
            } else {
                monthStats[monthKey].expense += tx.amount;
                const catStats = monthStats[monthKey].categories[tx.category] || { total: 0, emoji: tx.emoji };
                catStats.total += tx.amount;
                catStats.emoji = tx.emoji;
                monthStats[monthKey].categories[tx.category] = catStats;
            }

            // Commit if batch full (limit 450)
            if (opCount >= 450) {
                await batch.commit();
                batch = writeBatch(db);
                opCount = 0;
            }
        }

        // Final commit with main doc update
        // We delete the legacy transactions array here
        batch.update(financeRef, {
            accounts,
            monthStats,
            transactions: deleteField(),
            customCategories: (await getDoc(financeRef)).data()?.customCategories || []
        });
        await batch.commit();
        console.log("Migration complete!");
    },

    // Recalcular todo desde cero (Fix de consistencia)
    recalculateFinances: async (userId: string) => {
        try {
            // 1. Resetear estado local
            // Usamos DEFAULT_ACCOUNTS para reiniciar balances a 0 pero mantenemos los IDs si hubiera nuevos
            // Para simplificar, reseteamos a los defaults puros con balance 0
            const accounts = JSON.parse(JSON.stringify(DEFAULT_ACCOUNTS));
            const monthStats: Record<string, MonthStats> = {};

            // 2. Traer TODAS las transacciones
            const txRef = collection(db, `users/${userId}/features/${Features.FINANCE}/transactions`);
            const snap = await getDocs(txRef);

            // 3. Re-procesar una por una
            snap.forEach(doc => {
                const tx = doc.data() as Trade;

                // Balance
                const accIndex = accounts.findIndex((a: any) => a.id === tx.accountId);
                if (accIndex >= 0) {
                    const acc = accounts[accIndex];
                    if (tx.type === 'income') acc.balance += tx.amount;
                    else acc.balance -= tx.amount;
                }

                // Stats
                const monthKey = tx.dateISO.slice(0, 7);
                if (!monthStats[monthKey]) monthStats[monthKey] = { income: 0, expense: 0, categories: {} };

                if (tx.type === 'income') {
                    monthStats[monthKey].income += tx.amount;
                } else {
                    monthStats[monthKey].expense += tx.amount;
                    const cat = tx.category;
                    const catStats = monthStats[monthKey].categories[cat] || { total: 0, emoji: tx.emoji };
                    catStats.total += tx.amount;
                    catStats.emoji = tx.emoji;
                    monthStats[monthKey].categories[cat] = catStats;
                }
            });

            // 4. Guardar corrección
            const financeRef = doc(db, `users/${userId}/features`, Features.FINANCE);
            await setDoc(financeRef, {
                accounts,
                monthStats
            }, { merge: true });

            return { accounts, monthStats };

        } catch (e) {
            console.error("Recalculate failed:", e);
            throw e;
        }
    },
};
