import React, { useState, useMemo, useEffect } from 'react';
import { useFeatureData } from '../hooks/useFeatureData';
import type { TravelData, Trip, TripStatus, TripType } from '../types';
import { TripCard } from './travel/TripCard';
import { TripFormModal } from './travel/TripFormModal';
import { TripDetailModal } from './travel/TripDetailModal';
import { TravelStatsDashboard } from './travel/TravelStatsDashboard';
import { TYPE_CONFIG, STATUS_CONFIG } from './travel/utils';

type SortMode = 'date' | 'recent' | 'budget' | 'alphabetical';

export const TravelScreen: React.FC = () => {
    const { data, save, loading, saving, error } = useFeatureData<TravelData>('travel', { trips: [] });
    const [showForm, setShowForm] = useState(false);
    const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
    const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
    const [showStats, setShowStats] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<TripStatus | 'all'>('all');
    const [typeFilter, setTypeFilter] = useState<TripType | 'all'>('all');
    const [sortMode, setSortMode] = useState<SortMode>('date');
    const [showFilters, setShowFilters] = useState(false);

    // Mantener selectedTrip sincronizado con data.trips para que las ediciones se reflejen
    useEffect(() => {
        if (selectedTrip) {
            const updated = data.trips.find(t => t.id === selectedTrip.id);
            if (updated && updated !== selectedTrip) {
                setSelectedTrip(updated);
            } else if (!updated) {
                setSelectedTrip(null);
            }
        }
    }, [data.trips, selectedTrip]);

    // Auto-update trip statuses based on dates
    useEffect(() => {
        if (loading || data.trips.length === 0) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let hasChanges = false;
        const updatedTrips = data.trips.map(trip => {
            if (trip.status === 'cancelled') return trip;
            if (trip.status === 'completed') return trip;

            const startDate = new Date(trip.startDate + 'T00:00:00');
            const endDate = new Date(trip.endDate + 'T23:59:59');

            let newStatus: TripStatus = trip.status;

            if (trip.status === 'planned' && today >= startDate) {
                newStatus = 'active';
                hasChanges = true;
            }

            if ((trip.status === 'active' || newStatus === 'active') && today > endDate) {
                newStatus = 'completed';
                hasChanges = true;
            }

            return newStatus !== trip.status ? { ...trip, status: newStatus } : trip;
        });

        if (hasChanges) {
            save({ trips: updatedTrips });
        }
    }, [data.trips, loading, save]);

    const filteredAndSorted = useMemo(() => {
        let result = [...data.trips];
        // Search
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(t =>
                t.destination.toLowerCase().includes(q) ||
                (t.notes || '').toLowerCase().includes(q) ||
                (t.destinations || []).some(d => d.name.toLowerCase().includes(q))
            );
        }
        // Status filter
        if (statusFilter !== 'all') {
            result = result.filter(t => t.status === statusFilter);
        }
        // Type filter
        if (typeFilter !== 'all') {
            result = result.filter(t => t.type === typeFilter);
        }
        // Sort
        switch (sortMode) {
            case 'date':
                result.sort((a, b) => {
                    const order: Record<TripStatus, number> = { active: 0, planned: 1, completed: 2, cancelled: 3 };
                    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
                    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
                });
                break;
            case 'recent':
                result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                break;
            case 'budget':
                result.sort((a, b) => (b.budget || 0) - (a.budget || 0));
                break;
            case 'alphabetical':
                result.sort((a, b) => a.destination.localeCompare(b.destination));
                break;
        }
        return result;
    }, [data.trips, search, statusFilter, typeFilter, sortMode]);

    const activeCount = data.trips.filter(t => t.status === 'active' || t.status === 'planned').length;
    const hasFilters = statusFilter !== 'all' || typeFilter !== 'all' || sortMode !== 'date' || search.trim() !== '';

    return (
        <div className="p-6 pt-12 pb-24">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Mis Viajes ✈️</h1>
                    {activeCount > 0 && (
                        <p className="text-xs text-slate-400 mt-1">
                            {activeCount} viaje{activeCount > 1 ? 's' : ''} próxim{activeCount > 1 ? 'os' : 'o'}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {data.trips.length > 0 && (
                        <button
                            onClick={() => setShowStats(!showStats)}
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg hover:shadow-xl transition-all ${showStats
                                ? 'bg-gradient-to-br from-blue-400 to-indigo-500 text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                }`}
                        >
                            <span className="material-symbols-outlined text-xl">{showStats ? 'flight' : 'bar_chart'}</span>
                        </button>
                    )}
                    <button
                        onClick={() => setShowForm(true)}
                        className="w-10 h-10 bg-gradient-to-br from-pink-400 to-rose-500 text-white rounded-2xl flex items-center justify-center shadow-lg hover:shadow-xl transition-all"
                    >
                        <span className="material-symbols-outlined text-xl">add</span>
                    </button>
                </div>
            </div>

            {/* Search + Filters */}
            {data.trips.length > 1 && !showStats && (
                <div className="mb-4 space-y-2">
                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar viaje..."
                                className="w-full bg-slate-50 dark:bg-[#2d1820] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-xl pl-10 pr-3 py-2 text-sm focus:outline-none focus:border-pink-400"
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <span className="material-symbols-outlined text-base">close</span>
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${hasFilters || showFilters ? 'bg-pink-400 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}
                        >
                            <span className="material-symbols-outlined text-base">tune</span>
                        </button>
                    </div>

                    {showFilters && (
                        <div className="bg-slate-50 dark:bg-[#2d1820] rounded-2xl p-3 space-y-3">
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 mb-1">Estado</p>
                                <div className="flex gap-1.5 overflow-x-auto pb-1">
                                    <FilterPill active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>Todos</FilterPill>
                                    {(Object.keys(STATUS_CONFIG) as TripStatus[]).map(s => (
                                        <FilterPill key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
                                            {STATUS_CONFIG[s].label}
                                        </FilterPill>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 mb-1">Tipo</p>
                                <div className="flex gap-1.5 overflow-x-auto pb-1">
                                    <FilterPill active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>Todos</FilterPill>
                                    {(Object.keys(TYPE_CONFIG) as TripType[]).map(t => (
                                        <FilterPill key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
                                            {TYPE_CONFIG[t].label}
                                        </FilterPill>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 mb-1">Ordenar</p>
                                <div className="flex gap-1.5 overflow-x-auto pb-1">
                                    {([
                                        { k: 'date', label: 'Por fecha' },
                                        { k: 'recent', label: 'Recientes' },
                                        { k: 'budget', label: 'Presupuesto' },
                                        { k: 'alphabetical', label: 'A-Z' },
                                    ] as Array<{ k: SortMode; label: string }>).map(s => (
                                        <FilterPill key={s.k} active={sortMode === s.k} onClick={() => setSortMode(s.k)}>
                                            {s.label}
                                        </FilterPill>
                                    ))}
                                </div>
                            </div>
                            {hasFilters && (
                                <button
                                    onClick={() => { setStatusFilter('all'); setTypeFilter('all'); setSortMode('date'); setSearch(''); }}
                                    className="w-full text-xs text-pink-500 font-bold py-1"
                                >
                                    Limpiar filtros
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Error Banner */}
            {error && (
                <div className="mb-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl px-4 py-3 flex items-center gap-3">
                    <span className="material-symbols-outlined text-rose-500 text-xl flex-shrink-0">error</span>
                    <p className="text-xs text-rose-600 dark:text-rose-300 font-medium flex-1">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="text-xs font-bold text-rose-600 dark:text-rose-300 hover:text-rose-700 dark:hover:text-rose-200 transition-colors"
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {/* Stats */}
            {showStats && (
                <div className="mb-6">
                    <TravelStatsDashboard trips={data.trips} />
                </div>
            )}

            {/* Lista */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <span className="material-symbols-outlined text-4xl text-slate-300 animate-spin">progress_activity</span>
                </div>
            ) : data.trips.length === 0 ? (
                <div className="text-center py-16">
                    <span className="material-symbols-outlined text-6xl text-slate-200 dark:text-slate-600 mb-4">flight</span>
                    <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">No tienes viajes aún</p>
                    <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">¡Crea tu primer viaje!</p>
                </div>
            ) : filteredAndSorted.length === 0 ? (
                <div className="text-center py-12">
                    <span className="material-symbols-outlined text-5xl text-slate-200 dark:text-slate-600 mb-3">search_off</span>
                    <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">Ningún viaje encontrado</p>
                    <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">Prueba cambiando los filtros</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredAndSorted.map(trip => (
                        <TripCard
                            key={trip.id}
                            trip={trip}
                            onTap={() => setSelectedTrip(trip)}
                        />
                    ))}
                </div>
            )}

            {/* Modal: Form */}
            {(showForm || editingTrip) && (
                <TripFormModal
                    onClose={() => { setShowForm(false); setEditingTrip(null); }}
                    onSave={(trip) => {
                        if (editingTrip) {
                            save({ trips: data.trips.map(t => t.id === trip.id ? trip : t) });
                            setEditingTrip(null);
                        } else {
                            save({ trips: [...data.trips, trip] });
                            setShowForm(false);
                        }
                    }}
                    editTrip={editingTrip}
                    isSaving={saving}
                />
            )}

            {/* Modal: Detail */}
            {selectedTrip && (
                <TripDetailModal
                    trip={selectedTrip}
                    onClose={() => setSelectedTrip(null)}
                    onUpdate={(updatedTrip) => {
                        save({ trips: data.trips.map(t => t.id === updatedTrip.id ? updatedTrip : t) });
                        setSelectedTrip(updatedTrip);
                    }}
                    onDelete={() => {
                        save({ trips: data.trips.filter(t => t.id !== selectedTrip.id) });
                        setSelectedTrip(null);
                    }}
                    onEdit={() => {
                        setEditingTrip(selectedTrip);
                        setSelectedTrip(null);
                    }}
                    isSaving={saving}
                    templates={data.packingTemplates || []}
                    onSaveTemplate={(template) => {
                        save({
                            packingTemplates: [...(data.packingTemplates || []), template]
                        });
                    }}
                />
            )}
        </div>
    );
};

const FilterPill: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${active ? 'bg-pink-400 text-white' : 'bg-white dark:bg-[#1a0d10] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-[#5a2b35]/40'}`}
    >
        {children}
    </button>
);
