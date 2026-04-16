import React, { useState, useMemo } from 'react';
import type { Trip, PreTripChecklistItem, ChecklistCategory } from '../../types';
import { generateId, DEFAULT_CHECKLIST_CATEGORIES, formatDate } from './utils';

const DEFAULT_TASKS: Array<{ task: string; category: string }> = [
    { task: 'Reservar hotel/alojamiento', category: 'booking' },
    { task: 'Confirmar reserva de vuelo', category: 'transport' },
    { task: 'Verificar pasaporte/visa', category: 'documents' },
    { task: 'Comprar seguro de viaje', category: 'documents' },
    { task: 'Vacunas/medicamentos necesarios', category: 'health' },
    { task: 'Reservar transporte local', category: 'transport' },
    { task: 'Activar roaming/comprar SIM', category: 'communication' },
    { task: 'Notificar al banco', category: 'finances' },
    { task: 'Cambiar dinero si es necesario', category: 'finances' },
    { task: 'Pedir cuidar casa/mascotas', category: 'home' },
    { task: 'Programar entrega de correo', category: 'home' },
    { task: 'Hacer copia digital de documentos', category: 'documents' },
    { task: 'Descargar mapas offline', category: 'communication' },
    { task: 'Confirmar transfer aeropuerto', category: 'transport' },
];

const ICON_OPTIONS = ['hotel', 'badge', 'medical_services', 'directions_car', 'phone', 'account_balance', 'home', 'pets', 'restaurant', 'fitness_center', 'work', 'family_restroom', 'school', 'event', 'more_horiz'];
const COLOR_OPTIONS: Array<{ name: string; class: string }> = [
    { name: 'Rosa', class: 'text-pink-500' },
    { name: 'Azul', class: 'text-blue-500' },
    { name: 'Verde', class: 'text-green-500' },
    { name: 'Púrpura', class: 'text-purple-500' },
    { name: 'Naranja', class: 'text-orange-500' },
    { name: 'Rojo', class: 'text-red-500' },
    { name: 'Teal', class: 'text-teal-500' },
    { name: 'Índigo', class: 'text-indigo-500' },
    { name: 'Slate', class: 'text-slate-500' },
];

type FilterMode = 'all' | 'pending' | 'done' | 'overdue';

export const PreTripChecklistTab: React.FC<{
    trip: Trip;
    onUpdate: (trip: Trip) => void;
}> = ({ trip, onUpdate }) => {
    const [showAdd, setShowAdd] = useState(false);
    const [editingItem, setEditingItem] = useState<PreTripChecklistItem | null>(null);
    const [showCategoryEditor, setShowCategoryEditor] = useState(false);
    const [filter, setFilter] = useState<FilterMode>('all');

    const checklist = trip.preTripChecklist || [];
    const allCategories: ChecklistCategory[] = useMemo(() => {
        const customs = trip.customChecklistCategories || [];
        return [...DEFAULT_CHECKLIST_CATEGORIES, ...customs.filter(c => !DEFAULT_CHECKLIST_CATEGORIES.some(d => d.key === c.key))];
    }, [trip.customChecklistCategories]);

    const today = new Date(); today.setHours(0, 0, 0, 0);

    const filteredChecklist = useMemo(() => {
        switch (filter) {
            case 'pending': return checklist.filter(i => !i.completed);
            case 'done': return checklist.filter(i => i.completed);
            case 'overdue': return checklist.filter(i => !i.completed && i.dueDate && new Date(i.dueDate + 'T00:00:00') < today);
            default: return checklist;
        }
    }, [checklist, filter, today]);

    const toggleTask = (id: string) => {
        onUpdate({ ...trip, preTripChecklist: checklist.map(i => i.id === id ? { ...i, completed: !i.completed } : i) });
    };

    const deleteTask = (id: string) => {
        onUpdate({ ...trip, preTripChecklist: checklist.filter(i => i.id !== id) });
    };

    const saveTask = (item: PreTripChecklistItem) => {
        const exists = checklist.some(i => i.id === item.id);
        const updated = exists ? checklist.map(i => i.id === item.id ? item : i) : [...checklist, item];
        onUpdate({ ...trip, preTripChecklist: updated });
        setEditingItem(null);
        setShowAdd(false);
    };

    const addDefaultTasks = () => {
        const existingTasks = checklist.map(i => i.task);
        const newTasks = DEFAULT_TASKS
            .filter(dt => !existingTasks.includes(dt.task))
            .map(dt => ({ id: generateId(), task: dt.task, category: dt.category, completed: false }));
        onUpdate({ ...trip, preTripChecklist: [...checklist, ...newTasks] });
    };

    const addCategory = (category: ChecklistCategory) => {
        const existing = trip.customChecklistCategories || [];
        if ([...DEFAULT_CHECKLIST_CATEGORIES, ...existing].some(c => c.key === category.key)) return;
        onUpdate({ ...trip, customChecklistCategories: [...existing, category] });
    };

    const completedCount = checklist.filter(i => i.completed).length;
    const totalCount = checklist.length;
    const percent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
    const overdueCount = checklist.filter(i => !i.completed && i.dueDate && new Date(i.dueDate + 'T00:00:00') < today).length;

    const byCategory = useMemo(() => {
        const cats: Record<string, PreTripChecklistItem[]> = {};
        filteredChecklist.forEach(item => {
            if (!cats[item.category]) cats[item.category] = [];
            cats[item.category].push(item);
        });
        return cats;
    }, [filteredChecklist]);

    return (
        <div className="space-y-3 sm:space-y-4">
            {/* Progress */}
            {totalCount > 0 && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-blue-100 dark:border-blue-900/20">
                    <div className="flex justify-between text-xs mb-2">
                        <span className="text-blue-600 dark:text-blue-300 font-bold">Progreso del checklist</span>
                        <span className="text-blue-500 font-bold">{completedCount}/{totalCount}</span>
                    </div>
                    <div className="h-2 bg-white/50 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                        <div className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full transition-all" style={{ width: `${percent}%` }} />
                    </div>
                    {overdueCount > 0 && (
                        <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1">
                            ⚠️ {overdueCount} tarea{overdueCount > 1 ? 's vencidas' : ' vencida'}
                        </p>
                    )}
                </div>
            )}

            {/* Filtros */}
            {totalCount > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {([
                        { k: 'all', label: 'Todo', count: totalCount },
                        { k: 'pending', label: 'Pendiente', count: totalCount - completedCount },
                        { k: 'overdue', label: '⚠️ Vencidas', count: overdueCount },
                        { k: 'done', label: 'Hechas', count: completedCount },
                    ] as Array<{ k: FilterMode; label: string; count: number }>).map(f => (
                        <button
                            key={f.k}
                            onClick={() => setFilter(f.k)}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold ${filter === f.k ? 'bg-blue-400 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}
                        >
                            {f.label} {f.count > 0 && <span className="opacity-70">({f.count})</span>}
                        </button>
                    ))}
                </div>
            )}

            {/* Acciones */}
            <div className="flex gap-2">
                <button
                    onClick={addDefaultTasks}
                    disabled={DEFAULT_TASKS.every(dt => checklist.some(i => i.task === dt.task))}
                    className="flex-1 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300 rounded-xl py-2 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-40"
                >
                    <span className="material-symbols-outlined text-sm">add_circle</span>
                    Sugeridas
                </button>
                <button
                    onClick={() => setShowCategoryEditor(true)}
                    className="bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 rounded-xl px-3 py-2 text-xs font-bold flex items-center justify-center gap-1"
                >
                    <span className="material-symbols-outlined text-sm">tune</span>
                    Categorías
                </button>
            </div>

            {/* Categorías agrupadas */}
            {Object.entries(byCategory).map(([catKey, items]) => {
                const cat = allCategories.find(c => c.key === catKey) || { key: catKey, label: catKey, icon: 'label', color: 'text-slate-500' };
                const done = items.filter(i => i.completed).length;
                return (
                    <div key={catKey}>
                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                            <span className={`material-symbols-outlined text-sm ${cat.color}`}>{cat.icon}</span>
                            {cat.label}
                            <span className="text-slate-300">({done}/{items.length})</span>
                        </h4>
                        <div className="bg-slate-50 dark:bg-[#2d1820] rounded-xl overflow-hidden">
                            {items.map(item => {
                                const isOverdue = !item.completed && item.dueDate && new Date(item.dueDate + 'T00:00:00') < today;
                                return (
                                    <div key={item.id} className="flex items-start gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-100 dark:border-[#5a2b35]/20 last:border-0 group">
                                        <button
                                            onClick={() => toggleTask(item.id)}
                                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${item.completed ? 'bg-blue-400 border-blue-400 text-white' : 'border-slate-300 dark:border-slate-600'}`}
                                        >
                                            {item.completed && <span className="material-symbols-outlined text-xs">check</span>}
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1 flex-wrap">
                                                <span className={`text-sm flex-1 ${item.completed ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                                                    {item.task}
                                                </span>
                                                {item.priority === 'high' && <span className="text-[10px] bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300 px-1.5 rounded-full font-bold">!</span>}
                                            </div>
                                            {(item.dueDate || item.notes) && (
                                                <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                                                    {item.dueDate && (
                                                        <span className={isOverdue ? 'text-rose-500 font-bold' : 'text-slate-400'}>
                                                            {isOverdue ? '⚠️ Venció: ' : 'Vence: '}{formatDate(item.dueDate)}
                                                        </span>
                                                    )}
                                                    {item.notes && <span className="text-slate-400 italic truncate">{item.notes}</span>}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setEditingItem(item)}
                                                className="text-slate-400 hover:text-blue-500"
                                            >
                                                <span className="material-symbols-outlined text-base">edit</span>
                                            </button>
                                            <button
                                                onClick={() => deleteTask(item.id)}
                                                className="text-slate-400 hover:text-rose-400"
                                            >
                                                <span className="material-symbols-outlined text-base">close</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}

            {totalCount === 0 && (
                <p className="text-center text-xs text-slate-400 py-8">No hay tareas en el checklist</p>
            )}
            {totalCount > 0 && filteredChecklist.length === 0 && (
                <p className="text-center text-xs text-slate-400 py-4">Nada en este filtro</p>
            )}

            {/* Add */}
            <button
                onClick={() => { setEditingItem(null); setShowAdd(true); }}
                className="w-full border-2 border-dashed border-slate-200 dark:border-[#5a2b35]/30 rounded-xl py-3 text-sm text-slate-400 hover:text-blue-400 hover:border-blue-300 transition-colors flex items-center justify-center gap-1"
            >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                Agregar tarea
            </button>

            {(showAdd || editingItem) && (
                <ChecklistItemForm
                    initial={editingItem}
                    categories={allCategories}
                    onSave={saveTask}
                    onCancel={() => { setShowAdd(false); setEditingItem(null); }}
                />
            )}

            {showCategoryEditor && (
                <CategoryEditor
                    existing={allCategories}
                    onAdd={addCategory}
                    onClose={() => setShowCategoryEditor(false)}
                />
            )}
        </div>
    );
};

const ChecklistItemForm: React.FC<{
    initial: PreTripChecklistItem | null;
    categories: ChecklistCategory[];
    onSave: (item: PreTripChecklistItem) => void;
    onCancel: () => void;
}> = ({ initial, categories, onSave, onCancel }) => {
    const [item, setItem] = useState<PreTripChecklistItem>(initial || {
        id: generateId(),
        task: '',
        category: categories[0]?.key || 'other',
        completed: false,
        priority: 'medium',
    });

    const update = <K extends keyof PreTripChecklistItem>(key: K, value: PreTripChecklistItem[K]) => {
        setItem(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        if (!item.task.trim()) return;
        onSave({ ...item, task: item.task.trim() });
    };

    return (
        <div className="bg-slate-50 dark:bg-[#2d1820] rounded-xl p-4 space-y-3">
            <input
                type="text"
                value={item.task}
                onChange={e => update('task', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="Nueva tarea..."
                className="w-full bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm"
                autoFocus
            />
            <div className="grid grid-cols-2 gap-2">
                <select
                    value={item.category}
                    onChange={e => update('category', e.target.value)}
                    className="bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm"
                >
                    {categories.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
                <input
                    type="date"
                    value={item.dueDate || ''}
                    onChange={e => update('dueDate', e.target.value || undefined)}
                    className="bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm"
                />
            </div>
            <div>
                <label className="text-[10px] font-bold text-slate-500 mb-1 block">Prioridad</label>
                <div className="grid grid-cols-3 gap-1">
                    {(['low', 'medium', 'high'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => update('priority', p)}
                            className={`py-1.5 rounded-lg text-xs font-bold ${item.priority === p ? (p === 'high' ? 'bg-rose-400 text-white' : p === 'medium' ? 'bg-amber-400 text-white' : 'bg-slate-400 text-white') : 'bg-white dark:bg-[#1a0d10] text-slate-400'}`}
                        >
                            {p === 'high' ? 'Alta' : p === 'medium' ? 'Media' : 'Baja'}
                        </button>
                    ))}
                </div>
            </div>
            <input
                type="text"
                value={item.notes || ''}
                onChange={e => update('notes', e.target.value)}
                placeholder="Notas (opcional)"
                className="w-full bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-xs"
            />
            <div className="flex gap-2">
                <button onClick={handleSave} disabled={!item.task.trim()} className="flex-1 bg-blue-400 text-white rounded-lg py-2 font-bold text-sm disabled:opacity-40">
                    {initial ? 'Guardar' : 'Agregar'}
                </button>
                <button onClick={onCancel} className="bg-slate-200 dark:bg-slate-700 rounded-lg px-4 font-bold text-sm">Cancelar</button>
            </div>
        </div>
    );
};

const CategoryEditor: React.FC<{
    existing: ChecklistCategory[];
    onAdd: (cat: ChecklistCategory) => void;
    onClose: () => void;
}> = ({ existing, onAdd, onClose }) => {
    const [label, setLabel] = useState('');
    const [icon, setIcon] = useState('label');
    const [color, setColor] = useState('text-pink-500');

    const submit = () => {
        if (!label.trim()) return;
        const key = label.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
        if (existing.some(e => e.key === key)) return;
        onAdd({ key, label: label.trim(), icon, color });
        setLabel('');
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-black/50">
            <div className="bg-white dark:bg-[#2d1820] w-full max-w-sm rounded-2xl p-5 shadow-2xl space-y-3">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Nueva categoría de checklist</h3>
                <input
                    type="text"
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    placeholder="Nombre (ej: Mascotas)"
                    className="w-full bg-slate-50 dark:bg-[#1a0d10] border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm"
                    autoFocus
                />
                <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Ícono</label>
                    <div className="grid grid-cols-5 gap-1">
                        {ICON_OPTIONS.map(i => (
                            <button
                                key={i}
                                onClick={() => setIcon(i)}
                                className={`p-2 rounded-lg ${icon === i ? `bg-pink-50 dark:bg-pink-900/20 ${color}` : 'bg-slate-50 dark:bg-[#1a0d10] text-slate-400'}`}
                            >
                                <span className="material-symbols-outlined text-base">{i}</span>
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Color</label>
                    <div className="grid grid-cols-9 gap-1">
                        {COLOR_OPTIONS.map(c => (
                            <button
                                key={c.class}
                                onClick={() => setColor(c.class)}
                                className={`p-2 rounded-lg ${color === c.class ? 'ring-2 ring-pink-400 bg-pink-50 dark:bg-pink-900/20' : 'bg-slate-50 dark:bg-[#1a0d10]'}`}
                                title={c.name}
                            >
                                <span className={`material-symbols-outlined text-sm ${c.class}`}>circle</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-2">
                    <button onClick={submit} disabled={!label.trim()} className="flex-1 bg-purple-400 text-white rounded-lg py-2 font-bold text-sm disabled:opacity-40">Crear</button>
                    <button onClick={onClose} className="bg-slate-200 dark:bg-slate-700 rounded-lg px-4 font-bold text-sm">Cerrar</button>
                </div>
            </div>
        </div>
    );
};
