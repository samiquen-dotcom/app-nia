import React, { useState, useEffect, useMemo } from 'react';
import type { Trip, PackingTemplate, PeriodData } from '../../types';
import { STATUS_CONFIG, formatDate, generatePeriodPackingItems, tripDateList } from './utils';
import { TripInfoTab } from './TripInfoTab';
import { PackingTab } from './PackingTab';
import { ExpensesTab } from './ExpensesTab';
import { PreTripChecklistTab } from './PreTripChecklistTab';
import { ItineraryTab } from './ItineraryTab';
import { ReservationsTab } from './ReservationsTab';
import { JournalTab } from './JournalTab';
import { TodayTab } from './TodayTab';
import { ConfirmModal } from './ConfirmModal';
import { useAuth } from '../../context/AuthContext';
import { FirestoreService, Features } from '../../services/firestore';
import { getPredictions } from '../../utils/cycleLogic';
import { printTripItinerary } from './printItinerary';

type TabKey = 'today' | 'info' | 'reservations' | 'packing' | 'itinerary' | 'expenses' | 'checklist' | 'journal';

const TABS_BASE: Array<{ key: TabKey; label: string; icon: string; activeOnly?: boolean }> = [
    { key: 'today', label: 'Hoy', icon: 'today', activeOnly: true },
    { key: 'info', label: 'Info', icon: 'info' },
    { key: 'reservations', label: 'Reservas', icon: 'bookmark' },
    { key: 'checklist', label: 'Pre-viaje', icon: 'task_alt' },
    { key: 'packing', label: 'Equipaje', icon: 'luggage' },
    { key: 'itinerary', label: 'Itinerario', icon: 'calendar_month' },
    { key: 'expenses', label: 'Gastos', icon: 'receipt_long' },
    { key: 'journal', label: 'Diario', icon: 'auto_stories' },
];

interface PeriodAlert {
    overlaps: boolean;
    daysInPeriod: string[]; // YYYY-MM-DD que caen en periodo previsto
}

export const TripDetailModal: React.FC<{
    trip: Trip;
    onClose: () => void;
    onUpdate: (trip: Trip) => void;
    onDelete: () => void;
    onEdit: () => void;
    isSaving?: boolean;
    templates?: PackingTemplate[];
    onSaveTemplate?: (template: PackingTemplate) => void;
}> = ({ trip, onClose, onUpdate, onDelete, onEdit, isSaving = false, templates = [], onSaveTemplate }) => {
    const { user } = useAuth();
    const isActive = trip.status === 'active';
    const TABS = useMemo(() => TABS_BASE.filter(t => !t.activeOnly || isActive), [isActive]);
    const [tab, setTab] = useState<TabKey>(isActive ? 'today' : 'info');
    const [confirmDeleteTrip, setConfirmDeleteTrip] = useState(false);
    const [periodAlert, setPeriodAlert] = useState<PeriodAlert | null>(null);
    const [periodAlertDismissed, setPeriodAlertDismissed] = useState(false);
    const [showAddPeriodItems, setShowAddPeriodItems] = useState(false);

    const status = STATUS_CONFIG[trip.status];

    // Detectar si el periodo cae durante el viaje
    useEffect(() => {
        if (!user || trip.status === 'completed' || trip.status === 'cancelled') return;
        FirestoreService.getFeatureData(user.uid, Features.PERIOD).then(raw => {
            const period = raw as PeriodData | null;
            if (!period?.cycleStartDate) return;

            const cycleLen = period.cycleLength || 28;
            const periodLen = period.periodLength || 5;
            const tripDays = tripDateList(trip);
            if (tripDays.length === 0) return;

            // Para cada día del viaje, calcular si cae en una ventana menstrual
            const tripStart = new Date(trip.startDate + 'T00:00:00');
            const cycleStart = new Date(period.cycleStartDate + 'T00:00:00');

            // Encontrar ciclos relevantes (los próximos 6 ciclos cubren cualquier viaje razonable)
            const daysSinceStart = Math.floor((tripStart.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24));
            const startCycle = Math.max(0, Math.floor(daysSinceStart / cycleLen) - 1);
            const endCycle = startCycle + 4;

            const periodWindows: Array<{ start: Date; end: Date }> = [];
            for (let i = startCycle; i <= endCycle; i++) {
                const wStart = new Date(cycleStart);
                wStart.setDate(cycleStart.getDate() + i * cycleLen);
                const wEnd = new Date(wStart);
                wEnd.setDate(wStart.getDate() + periodLen - 1);
                periodWindows.push({ start: wStart, end: wEnd });
            }

            const overlapping: string[] = [];
            tripDays.forEach(d => {
                const date = new Date(d + 'T00:00:00');
                if (periodWindows.some(w => date >= w.start && date <= w.end)) {
                    overlapping.push(d);
                }
            });

            // También verificar si cae justo antes/después (sensibilidad lútea/folicular)
            const _ = getPredictions(period.cycleStartDate, cycleLen);
            void _;

            if (overlapping.length > 0) {
                setPeriodAlert({ overlaps: true, daysInPeriod: overlapping });
            }
        });
    }, [user, trip.id, trip.startDate, trip.endDate, trip.status]);

    const addPeriodItems = () => {
        const newItems = generatePeriodPackingItems();
        // Evitar duplicar si ya hay items autoSuggested period
        const existing = trip.packingList.some(i => i.autoSuggested && i.suggestionSource === 'period');
        if (existing) return;
        onUpdate({ ...trip, packingList: [...trip.packingList, ...newItems] });
        setShowAddPeriodItems(false);
        setPeriodAlertDismissed(true);
        setTab('packing');
    };

    const handlePrint = () => {
        printTripItinerary(trip);
    };

    const showPeriodBanner = periodAlert?.overlaps && !periodAlertDismissed;
    const hasPeriodItems = useMemo(() => trip.packingList.some(i => i.autoSuggested && i.suggestionSource === 'period'), [trip.packingList]);

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative w-full sm:max-w-2xl max-h-[100vh] sm:max-h-[90vh] flex flex-col bg-white dark:bg-[#1a0d10] rounded-t-3xl sm:rounded-3xl shadow-2xl">
                {/* Header */}
                <div className="flex-shrink-0 bg-white dark:bg-[#1a0d10] px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-slate-100 dark:border-[#5a2b35]/30">
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <div className="flex items-center gap-2">
                            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                <span className="material-symbols-outlined text-xl">arrow_back</span>
                            </button>
                            <button
                                onClick={onEdit}
                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-pink-50 dark:hover:bg-pink-900/20 hover:text-pink-500 transition-colors"
                            >
                                <span className="material-symbols-outlined text-xl">edit</span>
                            </button>
                            <button
                                onClick={handlePrint}
                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-500 transition-colors"
                                title="Imprimir / Exportar PDF"
                            >
                                <span className="material-symbols-outlined text-xl">print</span>
                            </button>
                        </div>
                        <button
                            onClick={() => setConfirmDeleteTrip(true)}
                            disabled={isSaving}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            {isSaving ? (
                                <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
                            ) : (
                                <span className="material-symbols-outlined text-xl">delete</span>
                            )}
                        </button>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                        <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 line-clamp-2 flex-1">{trip.destination}</h2>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 flex-shrink-0 ${status.bg} ${status.color}`}>
                            <span className="material-symbols-outlined text-xs">{status.icon}</span>
                            <span className="hidden sm:inline">{status.label}</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                        <span className="material-symbols-outlined text-xs">calendar_today</span>
                        <span>{formatDate(trip.startDate)} → {formatDate(trip.endDate)}</span>
                    </div>
                </div>

                {/* Period alert */}
                {showPeriodBanner && !hasPeriodItems && (
                    <div className="flex-shrink-0 mx-4 sm:mx-6 mt-3 bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 border border-rose-200 dark:border-rose-800/40 rounded-2xl p-3">
                        <div className="flex items-start gap-2">
                            <span className="text-xl flex-shrink-0">🩸</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-rose-600 dark:text-rose-300">
                                    Tu menstruación cae durante el viaje
                                </p>
                                <p className="text-[10px] text-rose-500 dark:text-rose-400 mt-0.5">
                                    Aprox. {periodAlert.daysInPeriod.length} día{periodAlert.daysInPeriod.length > 1 ? 's' : ''} entre {formatDate(periodAlert.daysInPeriod[0])} y {formatDate(periodAlert.daysInPeriod[periodAlert.daysInPeriod.length - 1])}
                                </p>
                            </div>
                            <div className="flex flex-col gap-1">
                                <button
                                    onClick={() => setShowAddPeriodItems(true)}
                                    className="bg-rose-500 text-white text-[10px] px-2 py-1 rounded-full font-bold whitespace-nowrap"
                                >
                                    Agregar items
                                </button>
                                <button
                                    onClick={() => setPeriodAlertDismissed(true)}
                                    className="text-[10px] text-rose-400 hover:text-rose-600"
                                >
                                    Descartar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex-shrink-0 px-4 sm:px-6 py-3 sm:py-4">
                    <div className="flex gap-1.5 overflow-x-auto sm:overflow-visible scrollbar-hide -mx-1 px-1 sm:w-full">
                        {TABS.map(t => (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                className={`flex-shrink-0 sm:flex-shrink min-w-[4.5rem] sm:min-w-0 py-2 px-2 sm:px-3 rounded-lg text-[10px] sm:text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 transition-all flex-1 sm:basis-0 ${tab === t.key
                                    ? 'bg-white dark:bg-[#3d2830] text-pink-500 shadow-sm ring-1 ring-pink-200 dark:ring-pink-800'
                                    : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-base sm:text-sm">{t.icon}</span>
                                <span className="truncate">{t.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-28 sm:pb-4">
                    {tab === 'today' && <TodayTab trip={trip} onUpdate={onUpdate} onJumpToTab={(t) => setTab(t as TabKey)} />}
                    {tab === 'info' && <TripInfoTab trip={trip} onUpdate={onUpdate} isSaving={isSaving} />}
                    {tab === 'reservations' && <ReservationsTab trip={trip} onUpdate={onUpdate} />}
                    {tab === 'packing' && <PackingTab trip={trip} onUpdate={onUpdate} templates={templates} onSaveTemplate={onSaveTemplate} />}
                    {tab === 'itinerary' && <ItineraryTab trip={trip} onUpdate={onUpdate} />}
                    {tab === 'expenses' && <ExpensesTab trip={trip} onUpdate={onUpdate} />}
                    {tab === 'checklist' && <PreTripChecklistTab trip={trip} onUpdate={onUpdate} />}
                    {tab === 'journal' && <JournalTab trip={trip} onUpdate={onUpdate} />}
                </div>
            </div>

            {/* Confirms */}
            <ConfirmModal
                open={confirmDeleteTrip}
                title="¿Eliminar este viaje?"
                message="Se borrará todo: reservas, equipaje, gastos, itinerario y diario. No se puede deshacer."
                variant="danger"
                confirmLabel="Sí, eliminar"
                icon="delete_forever"
                onConfirm={() => { onDelete(); setConfirmDeleteTrip(false); }}
                onCancel={() => setConfirmDeleteTrip(false)}
            />

            <ConfirmModal
                open={showAddPeriodItems}
                title="¿Agregar items de menstruación?"
                message="Se agregarán al equipaje:\n· Tampones / Toallas / Copa\n· Analgésico\n· Ropa interior extra\n· Bolsa térmica"
                confirmLabel="Sí, agregar"
                icon="medical_services"
                onConfirm={addPeriodItems}
                onCancel={() => setShowAddPeriodItems(false)}
            />
        </div>
    );
};
