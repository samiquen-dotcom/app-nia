import React, { useState } from 'react';
import type { TripTemplate, Trip } from '../../types';
import { generateId, TYPE_CONFIG } from './utils';
import { DEFAULT_TRIP_TEMPLATES } from './defaultTripTemplates';
import { ConfirmModal } from './ConfirmModal';

interface Props {
    /** Templates personalizados del usuario (no incluye defaults) */
    userTemplates: TripTemplate[];
    /** Si viene un trip activo, ofrecemos "Guardar este viaje como template" */
    sourceTrip?: Trip;
    /** Cuando el usuario aplica un template, devolvemos los datos para crear viaje */
    onApplyTemplate?: (template: TripTemplate) => void;
    onSaveTemplate: (template: TripTemplate) => void;
    onDeleteTemplate: (templateId: string) => void;
    onClose: () => void;
    mode?: 'browse' | 'pick';   // 'pick' = aplica al cerrar; 'browse' = solo gestionar
}

export const TripTemplatesModal: React.FC<Props> = ({
    userTemplates,
    sourceTrip,
    onApplyTemplate,
    onSaveTemplate,
    onDeleteTemplate,
    onClose,
    mode = 'browse',
}) => {
    const [view, setView] = useState<'list' | 'save'>('list');
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [name, setName] = useState(sourceTrip ? `Mi ${sourceTrip.destination}` : '');
    const [description, setDescription] = useState('');
    const [includeItinerary, setIncludeItinerary] = useState(true);
    const [includeChecklist, setIncludeChecklist] = useState(true);
    const [includePacking, setIncludePacking] = useState(true);

    const handleSaveAsTemplate = () => {
        if (!sourceTrip || !name.trim()) return;

        const template: TripTemplate = {
            id: generateId(),
            name: name.trim(),
            description: description.trim(),
            type: sourceTrip.type,
            durationDays: Math.ceil((new Date(sourceTrip.endDate).getTime() - new Date(sourceTrip.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1,
            packingItems: includePacking
                ? sourceTrip.packingList.map(({ id, packed, purchased, ...rest }) => ({ ...rest, packed: false, purchased: false }))
                : [],
            checklistItems: includeChecklist
                ? (sourceTrip.preTripChecklist || []).map(({ id, completed, ...rest }) => ({ ...rest, completed: false }))
                : [],
            itineraryActivities: includeItinerary && sourceTrip.itinerary
                ? sourceTrip.itinerary.map(day => ({
                    dayNumber: day.dayNumber,
                    activities: day.activities.map(({ id, completed, linkedExpenseId, linkedReservationId, ...rest }) => ({
                        ...rest,
                        completed: false,
                    })),
                }))
                : undefined,
            createdAt: Date.now(),
        };
        onSaveTemplate(template);
        setView('list');
        setName('');
        setDescription('');
    };

    const applyAndClose = (template: TripTemplate) => {
        onApplyTemplate?.(template);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative w-full sm:max-w-lg max-h-[100vh] sm:max-h-[90vh] flex flex-col bg-white dark:bg-[#1a0d10] rounded-t-3xl sm:rounded-3xl shadow-2xl">
                {/* Header */}
                <div className="flex-shrink-0 px-5 pt-5 pb-3 border-b border-slate-100 dark:border-[#5a2b35]/30 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                            {view === 'save' ? 'Guardar como template' : mode === 'pick' ? 'Elige un template' : 'Templates de viaje'}
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                            {view === 'save' ? 'Reusa este viaje en futuros' : 'Plantillas listas para empezar rápido'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {view === 'list' ? (
                        <>
                            {/* Botón guardar como template (solo si hay sourceTrip) */}
                            {sourceTrip && (
                                <button
                                    onClick={() => setView('save')}
                                    className="w-full bg-gradient-to-r from-purple-400 to-fuchsia-500 text-white rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-base">save</span>
                                    Guardar este viaje como template
                                </button>
                            )}

                            {/* Defaults */}
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Templates incluidos</p>
                                <div className="space-y-2">
                                    {DEFAULT_TRIP_TEMPLATES.map(t => (
                                        <TemplateCard
                                            key={t.id}
                                            template={t}
                                            isDefault
                                            onApply={mode === 'pick' && onApplyTemplate ? () => applyAndClose(t) : undefined}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Custom */}
                            {userTemplates.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 mt-4">Mis templates</p>
                                    <div className="space-y-2">
                                        {userTemplates.map(t => (
                                            <TemplateCard
                                                key={t.id}
                                                template={t}
                                                onApply={mode === 'pick' && onApplyTemplate ? () => applyAndClose(t) : undefined}
                                                onDelete={() => setConfirmDelete(t.id)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">Nombre del template *</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Ej: Mis viajes a la costa"
                                    className="w-full bg-slate-50 dark:bg-[#2d1820] border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-400"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">Descripción</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Para qué viajes lo usarías..."
                                    rows={2}
                                    className="w-full bg-slate-50 dark:bg-[#2d1820] border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm resize-none"
                                />
                            </div>
                            {sourceTrip && (
                                <div className="bg-slate-50 dark:bg-[#2d1820] rounded-xl p-3 space-y-2">
                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Qué incluir</p>
                                    <Toggle label={`Equipaje (${sourceTrip.packingList.length} items)`} value={includePacking} onChange={setIncludePacking} disabled={sourceTrip.packingList.length === 0} />
                                    <Toggle label={`Checklist (${(sourceTrip.preTripChecklist || []).length} tareas)`} value={includeChecklist} onChange={setIncludeChecklist} disabled={(sourceTrip.preTripChecklist || []).length === 0} />
                                    <Toggle label={`Itinerario (${(sourceTrip.itinerary || []).reduce((s, d) => s + d.activities.length, 0)} actividades)`} value={includeItinerary} onChange={setIncludeItinerary} disabled={(sourceTrip.itinerary || []).length === 0} />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 px-5 pb-28 sm:pb-5 pt-2 flex gap-2 border-t border-slate-100 dark:border-[#5a2b35]/30">
                    {view === 'save' ? (
                        <>
                            <button
                                onClick={() => setView('list')}
                                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm"
                            >
                                Atrás
                            </button>
                            <button
                                onClick={handleSaveAsTemplate}
                                disabled={!name.trim()}
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-400 to-fuchsia-500 text-white font-bold text-sm disabled:opacity-40"
                            >
                                Guardar
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm"
                        >
                            Cerrar
                        </button>
                    )}
                </div>
            </div>

            <ConfirmModal
                open={!!confirmDelete}
                title="¿Eliminar template?"
                message="Solo se elimina el template, no afecta viajes existentes."
                variant="danger"
                confirmLabel="Eliminar"
                icon="delete"
                onConfirm={() => { if (confirmDelete) { onDeleteTemplate(confirmDelete); setConfirmDelete(null); } }}
                onCancel={() => setConfirmDelete(null)}
            />
        </div>
    );
};

const TemplateCard: React.FC<{
    template: TripTemplate;
    isDefault?: boolean;
    onApply?: () => void;
    onDelete?: () => void;
}> = ({ template, isDefault, onApply, onDelete }) => {
    const typeCfg = TYPE_CONFIG[template.type];
    const itineraryCount = template.itineraryActivities?.reduce((s, d) => s + d.activities.length, 0) || 0;

    return (
        <div className="bg-slate-50 dark:bg-[#2d1820] rounded-xl p-3 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-100 dark:bg-pink-900/30 text-pink-500 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined">{typeCfg.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{template.name}</p>
                        {isDefault && <span className="text-[9px] bg-slate-200 dark:bg-slate-700 text-slate-500 px-1.5 rounded-full font-bold">PREDISEÑADO</span>}
                    </div>
                    {template.description && <p className="text-[10px] text-slate-400 mt-0.5">{template.description}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-1.5 text-[10px]">
                        {template.durationDays && (
                            <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full font-bold">
                                📅 {template.durationDays}d
                            </span>
                        )}
                        {template.packingItems.length > 0 && (
                            <span className="bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-300 px-1.5 py-0.5 rounded-full font-bold">
                                🧳 {template.packingItems.length}
                            </span>
                        )}
                        {template.checklistItems.length > 0 && (
                            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-bold">
                                ✓ {template.checklistItems.length}
                            </span>
                        )}
                        {itineraryCount > 0 && (
                            <span className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300 px-1.5 py-0.5 rounded-full font-bold">
                                🗓 {itineraryCount}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    {onApply && (
                        <button
                            onClick={onApply}
                            className="bg-pink-400 hover:bg-pink-500 text-white text-[10px] px-2.5 py-1 rounded-full font-bold whitespace-nowrap"
                        >
                            Usar
                        </button>
                    )}
                    {onDelete && !isDefault && (
                        <button
                            onClick={onDelete}
                            className="text-slate-400 hover:text-rose-500 p-1"
                            title="Borrar"
                        >
                            <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const Toggle: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ label, value, onChange, disabled }) => (
    <label className={`flex items-center gap-2 text-sm cursor-pointer ${disabled ? 'opacity-40 cursor-not-allowed' : 'text-slate-600 dark:text-slate-300'}`}>
        <input
            type="checkbox"
            checked={value && !disabled}
            disabled={disabled}
            onChange={e => onChange(e.target.checked)}
            className="w-4 h-4 accent-purple-500"
        />
        {label}
    </label>
);
