import React from 'react';
import type { Trip } from '../../types';
import { STATUS_CONFIG, TYPE_CONFIG, TRIP_COLOR_CONFIG, formatDate, formatCurrency, totalExpensesInBase } from './utils';
import { getCountryByCode } from './countries';

export const TripCard: React.FC<{ trip: Trip; onTap: () => void }> = ({ trip, onTap }) => {
    const status = STATUS_CONFIG[trip.status];
    const type = TYPE_CONFIG[trip.type];
    const color = TRIP_COLOR_CONFIG[trip.color || 'pink'];
    const country = getCountryByCode(trip.countryCode);
    const daysUntil = Math.ceil((new Date(trip.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const totalExpenses = totalExpensesInBase(trip);
    const budgetPercent = trip.budget > 0 ? Math.min((totalExpenses / trip.budget) * 100, 100) : 0;
    const baseCurrency = trip.baseCurrency || 'COP';

    const packedCount = trip.packingList.filter(i => i.packed).length;
    const totalPacking = trip.packingList.length;
    const checklistDone = (trip.preTripChecklist || []).filter(i => i.completed).length;
    const totalChecklist = (trip.preTripChecklist || []).length;
    const reservationsCount = (trip.reservations || []).length;
    const companionsCount = (trip.companions || []).filter(c => !c.isMe).length;

    let countdownBadge: React.ReactNode = null;
    if (trip.status === 'active') {
        const daysLeft = Math.ceil((new Date(trip.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysLeft >= 0) {
            countdownBadge = (
                <span className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300 px-2 py-0.5 rounded-full font-bold">
                    {daysLeft === 0 ? 'Último día' : `${daysLeft} ${daysLeft === 1 ? 'día restante' : 'días restantes'}`}
                </span>
            );
        }
    } else if (trip.status === 'planned' && daysUntil > 0) {
        countdownBadge = (
            <span className={`${color.bg} ${color.accent} px-2 py-0.5 rounded-full font-bold`}>
                {daysUntil === 1 ? 'Mañana' : `En ${daysUntil} días`}
            </span>
        );
    } else if (trip.status === 'planned' && daysUntil === 0) {
        countdownBadge = (
            <span className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold animate-pulse">
                ¡Hoy!
            </span>
        );
    } else if (trip.status === 'completed') {
        const totalDays = Math.ceil((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        countdownBadge = (
            <span className="bg-slate-50 dark:bg-slate-700/20 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-bold">
                {totalDays} {totalDays === 1 ? 'día' : 'días'}
            </span>
        );
    }

    return (
        <button
            onClick={onTap}
            className="w-full bg-white dark:bg-[#2d1820] rounded-2xl shadow-sm border border-slate-100 dark:border-[#5a2b35]/30 overflow-hidden hover:shadow-md transition-all text-left"
        >
            <div className={`h-1 bg-gradient-to-r ${color.gradient}`} />

            <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <span className={`material-symbols-outlined text-lg ${color.accent}`}>{type.icon}</span>
                            <span className="truncate">{trip.destination}</span>
                            {country && <span className="text-base flex-shrink-0">{country.flag}</span>}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {type.label}
                            {companionsCount > 0 && <span className="ml-2">· 👥 {companionsCount + 1}</span>}
                            {reservationsCount > 0 && <span className="ml-2">· 📌 {reservationsCount}</span>}
                        </p>
                    </div>
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 flex-shrink-0 ${status.bg} ${status.color}`}>
                        <span className="material-symbols-outlined text-xs">{status.icon}</span>
                        {status.label}
                    </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-3 flex-wrap">
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">calendar_today</span>
                        {formatDate(trip.startDate)} → {formatDate(trip.endDate)}
                    </span>
                    {countdownBadge}
                </div>

                {/* Mini progress bars */}
                {(totalPacking > 0 || totalChecklist > 0) && trip.status !== 'completed' && (
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        {totalChecklist > 0 && (
                            <MiniProgress label="Pre-viaje" value={checklistDone} total={totalChecklist} color="bg-blue-400" />
                        )}
                        {totalPacking > 0 && (
                            <MiniProgress label="Equipaje" value={packedCount} total={totalPacking} color="bg-pink-400" />
                        )}
                    </div>
                )}

                {/* Budget */}
                {trip.budget > 0 && (
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500 dark:text-slate-400">
                                {formatCurrency(totalExpenses, baseCurrency)} / {formatCurrency(trip.budget, baseCurrency)}
                            </span>
                            <span className="text-slate-400">{Math.round(budgetPercent)}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${budgetPercent >= 90 ? 'bg-rose-500' : budgetPercent >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                style={{ width: `${budgetPercent}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </button>
    );
};

const MiniProgress: React.FC<{ label: string; value: number; total: number; color: string }> = ({ label, value, total, color }) => {
    const pct = total > 0 ? (value / total) * 100 : 0;
    return (
        <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                <span>{label}</span>
                <span>{value}/{total}</span>
            </div>
            <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
};
