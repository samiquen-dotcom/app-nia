import React, { useMemo } from 'react';
import type { Trip } from '../../types';
import { TYPE_CONFIG, TRIP_COLOR_CONFIG, formatDate, formatCurrency, totalExpensesInBase, convertCurrency } from './utils';

const EXPENSE_CAT_LABELS: Record<string, { label: string; icon: string; color: string }> = {
    transport: { label: 'Transporte', icon: 'directions_bus', color: 'text-blue-500' },
    alojamiento: { label: 'Alojamiento', icon: 'hotel', color: 'text-purple-500' },
    comida: { label: 'Comida', icon: 'restaurant', color: 'text-orange-500' },
    actividades: { label: 'Actividades', icon: 'sports_esports', color: 'text-green-500' },
    compras: { label: 'Compras', icon: 'shopping_bag', color: 'text-pink-500' },
    salud: { label: 'Salud', icon: 'medical_services', color: 'text-red-500' },
    propinas: { label: 'Propinas', icon: 'volunteer_activism', color: 'text-amber-500' },
    otros: { label: 'Otros', icon: 'more_horiz', color: 'text-slate-500' },
};

export const TravelStatsDashboard: React.FC<{ trips: Trip[] }> = ({ trips }) => {
    const stats = useMemo(() => {
        const totalTrips = trips.length;
        const activeTrips = trips.filter(t => t.status === 'active').length;
        const plannedTrips = trips.filter(t => t.status === 'planned').length;
        const completedTrips = trips.filter(t => t.status === 'completed').length;
        const cancelledTrips = trips.filter(t => t.status === 'cancelled').length;

        // Total budget & expenses (en COP — moneda de referencia para sumar entre viajes con monedas distintas)
        const totalBudget = trips.reduce((sum, t) => sum + convertCurrency(t.budget, t.baseCurrency || 'COP', 'COP'), 0);
        const totalExpenses = trips.reduce((sum, t) => {
            const tripTotal = totalExpensesInBase(t);
            return sum + convertCurrency(tripTotal, t.baseCurrency || 'COP', 'COP');
        }, 0);
        const remaining = totalBudget - totalExpenses;

        // By type
        const byType: Record<string, number> = {};
        trips.forEach(t => {
            byType[t.type] = (byType[t.type] || 0) + 1;
        });

        // By status
        const byStatus: Record<string, number> = {
            active: activeTrips,
            planned: plannedTrips,
            completed: completedTrips,
            cancelled: cancelledTrips,
        };

        // Most visited types
        const sortedTypes = Object.entries(byType)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // Total days traveled
        const totalDays = trips
            .filter(t => t.status === 'completed' || t.status === 'active')
            .reduce((sum, t) => {
                const start = new Date(t.startDate);
                const end = new Date(t.endDate);
                const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                return sum + Math.max(days, 0);
            }, 0);

        // Upcoming trips (next 30 days)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const thirtyDaysFromNow = new Date(today);
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        const upcomingTrips = trips
            .filter(t => {
                const start = new Date(t.startDate + 'T00:00:00');
                return t.status === 'planned' && start >= today && start <= thirtyDaysFromNow;
            })
            .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
            .slice(0, 3);

        // Expense categories breakdown (todo convertido a COP)
        const expenseByCategory: Record<string, number> = {};
        trips.forEach(t => {
            const tripBase = t.baseCurrency || 'COP';
            t.expenses.forEach(e => {
                const inBase = e.amountInBase != null ? e.amountInBase : convertCurrency(e.amount, e.currency || tripBase, tripBase);
                const inCop = convertCurrency(inBase, tripBase, 'COP');
                expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + inCop;
            });
        });

        const sortedExpenseCats = Object.entries(expenseByCategory)
            .sort((a, b) => b[1] - a[1]);

        return {
            totalTrips,
            activeTrips,
            plannedTrips,
            completedTrips,
            cancelledTrips,
            totalBudget,
            totalExpenses,
            remaining,
            sortedTypes,
            byStatus,
            totalDays,
            upcomingTrips,
            sortedExpenseCats,
        };
    }, [trips]);

    if (trips.length === 0) {
        return (
            <div className="text-center py-16">
                <span className="material-symbols-outlined text-6xl text-slate-200 dark:text-slate-600 mb-4">bar_chart</span>
                <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">No hay datos para mostrar</p>
                <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">Crea tu primer viaje para ver estadísticas</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Main stats */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/10 dark:to-rose-900/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-pink-100 dark:border-pink-900/20">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                        <span className="material-symbols-outlined text-pink-400 text-lg sm:text-xl">flight</span>
                        <span className="text-[10px] sm:text-xs text-pink-600 dark:text-pink-300 font-medium">Total Viajes</span>
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold text-pink-600 dark:text-pink-300">{stats.totalTrips}</p>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-blue-100 dark:border-blue-900/20">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                        <span className="material-symbols-outlined text-blue-400 text-lg sm:text-xl">calendar_today</span>
                        <span className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-300 font-medium">Días Viajados</span>
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-300">{stats.totalDays}</p>
                </div>
            </div>

            {/* Budget overview */}
            {stats.totalBudget > 0 && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 rounded-2xl p-4 border border-green-100 dark:border-green-900/20">
                    <h4 className="text-xs font-bold text-green-600 dark:text-green-300 mb-3 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
                        Resumen de Presupuesto
                    </h4>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600 dark:text-slate-300">Presupuesto total</span>
                            <span className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(stats.totalBudget, 'COP')}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600 dark:text-slate-300">Gastado</span>
                            <span className="font-bold text-rose-600 dark:text-rose-300">{formatCurrency(stats.totalExpenses, 'COP')}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600 dark:text-slate-300">Restante</span>
                            <span className={`font-bold ${stats.remaining >= 0 ? 'text-green-600 dark:text-green-300' : 'text-rose-600 dark:text-rose-300'}`}>
                                {formatCurrency(Math.abs(stats.remaining), 'COP')}
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-400 italic">Totales aproximados convertidos a COP</p>
                        {stats.totalBudget > 0 && (
                            <div className="mt-2">
                                <div className="h-2 bg-white/50 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-rose-400 to-pink-500 rounded-full transition-all"
                                        style={{ width: `${Math.min((stats.totalExpenses / stats.totalBudget) * 100, 100)}%` }}
                                    />
                                </div>
                                <p className="text-xs text-slate-400 mt-1 text-center">
                                    {Math.round((stats.totalExpenses / stats.totalBudget) * 100)}% gastado
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* By type */}
            {stats.sortedTypes.length > 0 && (
                <div className="bg-slate-50 dark:bg-[#2d1820] rounded-2xl p-4">
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">pie_chart</span>
                        Tipos de Viaje
                    </h4>
                    <div className="space-y-2">
                        {stats.sortedTypes.map(([type, count]) => {
                            const typeConfig = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG];
                            const percent = Math.round((count / stats.totalTrips) * 100);

                            return (
                                <div key={type} className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                                            <span className="material-symbols-outlined text-sm text-pink-400">{typeConfig?.icon || 'travel_explore'}</span>
                                            {typeConfig?.label || type}
                                        </span>
                                        <span className="font-bold text-slate-700 dark:text-slate-200">{count} ({percent}%)</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-pink-400 to-rose-500 rounded-full" style={{ width: `${percent}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Expense categories */}
            {stats.sortedExpenseCats.length > 0 && (
                <div className="bg-slate-50 dark:bg-[#2d1820] rounded-2xl p-4">
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">receipt_long</span>
                        Gastos por Categoría
                    </h4>
                    <div className="space-y-2">
                        {stats.sortedExpenseCats.slice(0, 8).map(([cat, amount]) => {
                            const catConfig = EXPENSE_CAT_LABELS[cat] || { label: cat, icon: 'more_horiz', color: 'text-slate-500' };
                            const percent = stats.totalExpenses > 0 ? Math.round((amount / stats.totalExpenses) * 100) : 0;

                            return (
                                <div key={cat} className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className={`flex items-center gap-1 ${catConfig.color}`}>
                                            <span className="material-symbols-outlined text-sm">{catConfig.icon}</span>
                                            {catConfig.label}
                                        </span>
                                        <span className="font-bold text-slate-700 dark:text-slate-200">{formatCurrency(amount, 'COP')} ({percent}%)</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${catConfig.color.replace('text-', 'bg-')}`} style={{ width: `${percent}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Upcoming trips */}
            {stats.upcomingTrips.length > 0 && (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 rounded-2xl p-4 border border-amber-100 dark:border-amber-900/20">
                    <h4 className="text-xs font-bold text-amber-600 dark:text-amber-300 mb-3 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">upcoming</span>
                        Próximos Viajes
                    </h4>
                    <div className="space-y-2">
                        {stats.upcomingTrips.map(trip => {
                            const daysUntil = Math.ceil((new Date(trip.startDate + 'T00:00:00').getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                            const colorConfig = TRIP_COLOR_CONFIG[trip.color || 'pink'];

                            return (
                                <div key={trip.id} className="bg-white/50 dark:bg-slate-800/50 rounded-xl p-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${colorConfig.gradient}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{trip.destination}</p>
                                            <p className="text-xs text-slate-400">{formatDate(trip.startDate)} → {formatDate(trip.endDate)}</p>
                                        </div>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${colorConfig.bg} ${colorConfig.accent}`}>
                                            {daysUntil === 0 ? '¡Hoy!' : `${daysUntil}d`}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
