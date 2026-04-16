import React, { useState, useMemo } from 'react';
import type { Trip, PackingItem, PackingTemplate, PackingPriority, Companion } from '../../types';
import { generateId, PACKING_PRIORITY_CONFIG, totalPackedWeight, formatWeight } from './utils';
import { ConfirmModal } from './ConfirmModal';

const DEFAULT_CATEGORIES = ['Ropa', 'Calzado', 'Accesorios', 'Higiene', 'Higiene íntima', 'Electrónicos', 'Documentos', 'Medicamentos', 'Otros'];

type FilterMode = 'all' | 'pending' | 'packed' | 'toBuy' | 'essential';

export const PackingTab: React.FC<{
    trip: Trip;
    onUpdate: (trip: Trip) => void;
    templates?: PackingTemplate[];
    onSaveTemplate?: (template: PackingTemplate) => void;
}> = ({ trip, onUpdate, templates = [], onSaveTemplate }) => {
    const [showAdd, setShowAdd] = useState(false);
    const [editingItem, setEditingItem] = useState<PackingItem | null>(null);
    const [filter, setFilter] = useState<FilterMode>('all');
    const [showTemplates, setShowTemplates] = useState(false);
    const [showSaveTemplate, setShowSaveTemplate] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateDesc, setNewTemplateDesc] = useState('');
    const [confirmClear, setConfirmClear] = useState(false);
    const companions = trip.companions || [];

    const allCategories = useMemo(() => {
        const cats = new Set<string>(DEFAULT_CATEGORIES);
        trip.packingList.forEach(item => cats.add(item.category));
        (trip.customPackingCategories || []).forEach(c => cats.add(c));
        return Array.from(cats);
    }, [trip.packingList, trip.customPackingCategories]);

    const filteredItems = useMemo(() => {
        switch (filter) {
            case 'pending': return trip.packingList.filter(i => !i.packed);
            case 'packed': return trip.packingList.filter(i => i.packed);
            case 'toBuy': return trip.packingList.filter(i => i.needsToBuy && !i.purchased);
            case 'essential': return trip.packingList.filter(i => i.priority === 'essential');
            default: return trip.packingList;
        }
    }, [trip.packingList, filter]);

    const grouped = useMemo(() => {
        const cats: Record<string, { items: PackingItem[]; total: number; packed: number }> = {};
        filteredItems.forEach(item => {
            if (!cats[item.category]) cats[item.category] = { items: [], total: 0, packed: 0 };
            cats[item.category].items.push(item);
            cats[item.category].total++;
            if (item.packed) cats[item.category].packed++;
        });
        // Ordenar items por prioridad esencial > recomendado > opcional
        const priorityOrder: Record<PackingPriority, number> = { essential: 0, recommended: 1, optional: 2 };
        Object.values(cats).forEach(cat => {
            cat.items.sort((a, b) => {
                const pa = priorityOrder[a.priority || 'recommended'];
                const pb = priorityOrder[b.priority || 'recommended'];
                if (pa !== pb) return pa - pb;
                return a.name.localeCompare(b.name);
            });
        });
        return cats;
    }, [filteredItems]);

    const toggleItem = (itemId: string) => {
        onUpdate({
            ...trip,
            packingList: trip.packingList.map(i => i.id === itemId ? { ...i, packed: !i.packed } : i),
        });
    };

    const togglePurchased = (itemId: string) => {
        onUpdate({
            ...trip,
            packingList: trip.packingList.map(i => i.id === itemId ? { ...i, purchased: !i.purchased, needsToBuy: i.purchased ? i.needsToBuy : false } : i),
        });
    };

    const deleteItem = (itemId: string) => {
        onUpdate({
            ...trip,
            packingList: trip.packingList.filter(i => i.id !== itemId),
        });
    };

    const updateItem = (item: PackingItem) => {
        onUpdate({
            ...trip,
            packingList: trip.packingList.map(i => i.id === item.id ? item : i),
        });
        setEditingItem(null);
    };

    const addItem = (item: PackingItem) => {
        // Si es nueva categoría, persistirla
        const customCats = trip.customPackingCategories || [];
        const newCustom = !DEFAULT_CATEGORIES.includes(item.category) && !customCats.includes(item.category)
            ? [...customCats, item.category]
            : customCats;

        onUpdate({
            ...trip,
            packingList: [...trip.packingList, item],
            customPackingCategories: newCustom,
        });
        setShowAdd(false);
    };

    const clearPackedStatus = () => {
        onUpdate({
            ...trip,
            packingList: trip.packingList.map(i => ({ ...i, packed: false })),
        });
        setConfirmClear(false);
    };

    const saveCurrentAsTemplate = () => {
        if (!newTemplateName.trim() || trip.packingList.length === 0) return;
        const template: PackingTemplate = {
            id: generateId(),
            name: newTemplateName.trim(),
            description: newTemplateDesc.trim(),
            items: trip.packingList.map(({ id, ...item }) => item),
            createdAt: Date.now(),
        };
        onSaveTemplate?.(template);
        setNewTemplateName('');
        setNewTemplateDesc('');
        setShowSaveTemplate(false);
    };

    const loadTemplate = (template: PackingTemplate) => {
        const itemsWithIds = template.items.map(item => ({ ...item, id: generateId() }));
        onUpdate({
            ...trip,
            packingList: [...trip.packingList, ...itemsWithIds],
        });
        setShowTemplates(false);
    };

    const packedCount = trip.packingList.filter(i => i.packed).length;
    const totalCount = trip.packingList.length;
    const percent = totalCount > 0 ? (packedCount / totalCount) * 100 : 0;
    const toBuyCount = trip.packingList.filter(i => i.needsToBuy && !i.purchased).length;
    const essentialPending = trip.packingList.filter(i => i.priority === 'essential' && !i.packed).length;
    const weight = totalPackedWeight(trip);

    return (
        <div className="space-y-3 sm:space-y-4">
            {/* Progress */}
            {totalCount > 0 && (
                <div className="bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/10 dark:to-rose-900/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-pink-100 dark:border-pink-900/20">
                    <div className="flex justify-between text-xs mb-2">
                        <span className="text-pink-600 dark:text-pink-300 font-bold">Progreso de equipaje</span>
                        <span className="text-pink-500 font-bold">{packedCount}/{totalCount}</span>
                    </div>
                    <div className="h-2 bg-white/50 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                        <div className="h-full bg-gradient-to-r from-pink-400 to-rose-500 rounded-full transition-all" style={{ width: `${percent}%` }} />
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px]">
                        {essentialPending > 0 && (
                            <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300 px-2 py-0.5 rounded-full font-bold">
                                ⚠️ {essentialPending} esencial{essentialPending > 1 ? 'es' : ''} sin empacar
                            </span>
                        )}
                        {toBuyCount > 0 && (
                            <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">
                                🛒 {toBuyCount} por comprar
                            </span>
                        )}
                        {weight > 0 && (
                            <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold">
                                ⚖️ {formatWeight(weight)}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Filtros */}
            {totalCount > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {([
                        { k: 'all', label: 'Todo', count: totalCount },
                        { k: 'pending', label: 'Pendiente', count: totalCount - packedCount },
                        { k: 'packed', label: 'Empacado', count: packedCount },
                        { k: 'essential', label: 'Esencial', count: trip.packingList.filter(i => i.priority === 'essential').length },
                        { k: 'toBuy', label: '🛒 Comprar', count: toBuyCount },
                    ] as Array<{ k: FilterMode; label: string; count: number }>).map(f => (
                        <button
                            key={f.k}
                            onClick={() => setFilter(f.k)}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold ${filter === f.k ? 'bg-pink-400 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}
                        >
                            {f.label} {f.count > 0 && <span className="opacity-70">({f.count})</span>}
                        </button>
                    ))}
                </div>
            )}

            {/* Templates */}
            {onSaveTemplate && (
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowTemplates(true)}
                        disabled={templates.length === 0}
                        className="flex-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 rounded-xl py-2 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-40"
                    >
                        <span className="material-symbols-outlined text-sm">folder_open</span>
                        Templates
                        <span className="bg-blue-200 dark:bg-blue-800 text-[10px] px-1.5 rounded-full">{templates.length}</span>
                    </button>
                    <button
                        onClick={() => setShowSaveTemplate(true)}
                        disabled={trip.packingList.length === 0}
                        className="flex-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 rounded-xl py-2 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-40"
                    >
                        <span className="material-symbols-outlined text-sm">save</span>
                        Guardar
                    </button>
                    {packedCount > 0 && (
                        <button
                            onClick={() => setConfirmClear(true)}
                            className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl px-3 py-2 text-xs font-bold"
                            title="Reiniciar empacado"
                        >
                            <span className="material-symbols-outlined text-sm">restart_alt</span>
                        </button>
                    )}
                </div>
            )}

            {/* Categorías */}
            {Object.entries(grouped).map(([catName, cat]) => (
                <div key={catName}>
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">folder</span>
                        {catName}
                        <span className="text-slate-300">({cat.packed}/{cat.total})</span>
                    </h4>
                    <div className="bg-slate-50 dark:bg-[#2d1820] rounded-xl overflow-hidden">
                        {cat.items.map(item => (
                            <PackingItemRow
                                key={item.id}
                                item={item}
                                companions={companions}
                                onToggle={() => toggleItem(item.id)}
                                onTogglePurchased={() => togglePurchased(item.id)}
                                onEdit={() => setEditingItem(item)}
                                onDelete={() => deleteItem(item.id)}
                            />
                        ))}
                    </div>
                </div>
            ))}

            {totalCount === 0 && (
                <p className="text-center text-xs text-slate-400 py-8">No hay items en la lista de equipaje</p>
            )}
            {totalCount > 0 && filteredItems.length === 0 && (
                <p className="text-center text-xs text-slate-400 py-4">No hay items en este filtro</p>
            )}

            {/* Botón agregar */}
            <button
                onClick={() => setShowAdd(true)}
                className="w-full border-2 border-dashed border-slate-200 dark:border-[#5a2b35]/30 rounded-xl py-3 text-sm text-slate-400 hover:text-pink-400 hover:border-pink-300 transition-colors flex items-center justify-center gap-1"
            >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                Agregar item
            </button>

            {/* Form */}
            {(showAdd || editingItem) && (
                <PackingItemForm
                    initial={editingItem}
                    categories={allCategories}
                    companions={companions}
                    onSave={editingItem ? updateItem : addItem}
                    onCancel={() => { setShowAdd(false); setEditingItem(null); }}
                />
            )}

            {/* Modal templates */}
            {showTemplates && (
                <div className="bg-slate-50 dark:bg-[#2d1820] rounded-xl p-4 space-y-3 max-h-64 overflow-y-auto">
                    <h5 className="text-sm font-bold text-slate-700 dark:text-slate-200">Templates guardados</h5>
                    {templates.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4">No hay templates</p>
                    ) : (
                        <div className="space-y-2">
                            {templates.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => loadTemplate(t)}
                                    className="w-full bg-white dark:bg-[#1a0d10] rounded-lg p-3 text-left hover:bg-slate-100 dark:hover:bg-[#3d2830]"
                                >
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{t.name}</p>
                                    {t.description && <p className="text-xs text-slate-500 mt-1">{t.description}</p>}
                                    <p className="text-[10px] text-slate-400 mt-1">{t.items.length} items</p>
                                </button>
                            ))}
                        </div>
                    )}
                    <button onClick={() => setShowTemplates(false)} className="w-full bg-slate-200 dark:bg-slate-700 rounded-lg py-2 font-bold text-sm">Cerrar</button>
                </div>
            )}

            {/* Modal guardar template */}
            {showSaveTemplate && (
                <div className="bg-slate-50 dark:bg-[#2d1820] rounded-xl p-4 space-y-3">
                    <h5 className="text-sm font-bold text-slate-700 dark:text-slate-200">Guardar template</h5>
                    <input
                        type="text"
                        value={newTemplateName}
                        onChange={e => setNewTemplateName(e.target.value)}
                        placeholder="Nombre del template..."
                        className="w-full bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm"
                        autoFocus
                    />
                    <input
                        type="text"
                        value={newTemplateDesc}
                        onChange={e => setNewTemplateDesc(e.target.value)}
                        placeholder="Descripción (opcional)..."
                        className="w-full bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                        <button onClick={saveCurrentAsTemplate} disabled={!newTemplateName.trim()} className="flex-1 bg-purple-400 text-white rounded-lg py-2 font-bold text-sm disabled:opacity-40">Guardar</button>
                        <button onClick={() => { setShowSaveTemplate(false); setNewTemplateName(''); setNewTemplateDesc(''); }} className="bg-slate-200 dark:bg-slate-700 rounded-lg px-4 font-bold text-sm">Cancelar</button>
                    </div>
                </div>
            )}

            <ConfirmModal
                open={confirmClear}
                title="¿Reiniciar empacado?"
                message="Marca todos los items como NO empacados. La lista no se borra."
                confirmLabel="Reiniciar"
                icon="restart_alt"
                onConfirm={clearPackedStatus}
                onCancel={() => setConfirmClear(false)}
            />
        </div>
    );
};

const PackingItemRow: React.FC<{
    item: PackingItem;
    companions: Companion[];
    onToggle: () => void;
    onTogglePurchased: () => void;
    onEdit: () => void;
    onDelete: () => void;
}> = ({ item, companions, onToggle, onTogglePurchased, onEdit, onDelete }) => {
    const priorityCfg = PACKING_PRIORITY_CONFIG[item.priority || 'recommended'];
    const assignedCompanion = companions.find(c => c.id === item.assignedTo);

    return (
        <div className="flex items-start gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-100 dark:border-[#5a2b35]/20 last:border-0 group">
            <button
                onClick={onToggle}
                className={`w-5 h-5 mt-0.5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${item.packed ? 'bg-pink-400 border-pink-400 text-white' : 'border-slate-300 dark:border-slate-600'}`}
            >
                {item.packed && <span className="material-symbols-outlined text-xs">check</span>}
            </button>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-sm ${item.packed ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                        {item.name}
                    </span>
                    {(item.quantity || 1) > 1 && (
                        <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] px-1.5 rounded-full font-bold">
                            ×{item.quantity}
                        </span>
                    )}
                    {item.priority && item.priority !== 'recommended' && (
                        <span className={`w-1.5 h-1.5 rounded-full ${priorityCfg.dot}`} title={priorityCfg.label} />
                    )}
                    {item.autoSuggested && (
                        <span className="text-[10px] text-purple-500" title={`Sugerido por: ${item.suggestionSource}`}>
                            ✨
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 flex-wrap">
                    {item.weight && <span>⚖️ {((item.weight * (item.quantity || 1)) / 1000).toFixed(2)}kg</span>}
                    {assignedCompanion && (
                        <span className="text-pink-500 font-bold">
                            {assignedCompanion.emoji || '👤'} {assignedCompanion.name}
                        </span>
                    )}
                    {item.notes && <span className="italic truncate max-w-[120px]">{item.notes}</span>}
                </div>
            </div>
            <div className="flex items-center gap-1">
                {item.needsToBuy && (
                    <button
                        onClick={onTogglePurchased}
                        title={item.purchased ? 'Comprado' : 'Por comprar'}
                        className={`text-base p-1 rounded ${item.purchased ? 'text-green-500' : 'text-amber-500 animate-pulse'}`}
                    >
                        <span className="material-symbols-outlined text-base">{item.purchased ? 'shopping_bag' : 'shopping_cart'}</span>
                    </button>
                )}
                <button
                    onClick={onEdit}
                    className="text-slate-400 hover:text-pink-500 transition-all p-1"
                >
                    <span className="material-symbols-outlined text-base">edit</span>
                </button>
                <button
                    onClick={onDelete}
                    className="text-slate-400 hover:text-rose-400 transition-all p-1"
                >
                    <span className="material-symbols-outlined text-base">close</span>
                </button>
            </div>
        </div>
    );
};

const PackingItemForm: React.FC<{
    initial: PackingItem | null;
    categories: string[];
    companions: Companion[];
    onSave: (item: PackingItem) => void;
    onCancel: () => void;
}> = ({ initial, categories, companions, onSave, onCancel }) => {
    const [item, setItem] = useState<PackingItem>(initial || {
        id: generateId(),
        name: '',
        category: categories[0] || 'Ropa',
        packed: false,
        priority: 'recommended',
        quantity: 1,
    });
    const [newCategory, setNewCategory] = useState('');
    const [showNewCat, setShowNewCat] = useState(false);

    const update = <K extends keyof PackingItem>(key: K, value: PackingItem[K]) => {
        setItem(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        if (!item.name.trim()) return;
        onSave({ ...item, name: item.name.trim() });
    };

    const submitNewCat = () => {
        if (!newCategory.trim()) return;
        update('category', newCategory.trim());
        setShowNewCat(false);
        setNewCategory('');
    };

    return (
        <div className="bg-slate-50 dark:bg-[#2d1820] rounded-xl p-4 space-y-3">
            <input
                type="text"
                value={item.name}
                onChange={e => update('name', e.target.value)}
                placeholder="Nombre del item"
                autoFocus
                className="w-full bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm"
            />

            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Categoría</label>
                    <div className="flex gap-1">
                        <select
                            value={item.category}
                            onChange={e => update('category', e.target.value)}
                            className="flex-1 bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-2 py-2 text-sm"
                        >
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button onClick={() => setShowNewCat(!showNewCat)} className="bg-blue-400 text-white rounded-lg px-2" title="Nueva">
                            <span className="material-symbols-outlined text-sm">add</span>
                        </button>
                    </div>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Cantidad</label>
                    <input
                        type="number"
                        min={1}
                        value={item.quantity || 1}
                        onChange={e => update('quantity', Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-2 py-2 text-sm"
                    />
                </div>
            </div>

            {showNewCat && (
                <div className="flex gap-1">
                    <input
                        type="text"
                        value={newCategory}
                        onChange={e => setNewCategory(e.target.value)}
                        placeholder="Nueva categoría"
                        className="flex-1 bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-2 py-1.5 text-xs"
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && submitNewCat()}
                    />
                    <button onClick={submitNewCat} className="bg-blue-400 text-white rounded-lg px-3 text-xs font-bold">OK</button>
                </div>
            )}

            <div>
                <label className="text-[10px] font-bold text-slate-500 mb-1 block">Prioridad</label>
                <div className="grid grid-cols-3 gap-1">
                    {(Object.keys(PACKING_PRIORITY_CONFIG) as PackingPriority[]).map(p => (
                        <button
                            key={p}
                            onClick={() => update('priority', p)}
                            className={`py-1.5 rounded-lg text-xs font-bold transition-all ${item.priority === p ? `${PACKING_PRIORITY_CONFIG[p].bg} ${PACKING_PRIORITY_CONFIG[p].color}` : 'bg-white dark:bg-[#1a0d10] text-slate-400'}`}
                        >
                            {PACKING_PRIORITY_CONFIG[p].label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Peso (g, opcional)</label>
                    <input
                        type="number"
                        min={0}
                        value={item.weight || ''}
                        onChange={e => update('weight', e.target.value ? parseFloat(e.target.value) : undefined)}
                        className="w-full bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-2 py-2 text-sm"
                        placeholder="g/unidad"
                    />
                </div>
                {companions.length > 1 && (
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 mb-1 block">Lo lleva</label>
                        <select
                            value={item.assignedTo || ''}
                            onChange={e => update('assignedTo', e.target.value || undefined)}
                            className="w-full bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-2 py-2 text-sm"
                        >
                            <option value="">Sin asignar</option>
                            {companions.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                        </select>
                    </div>
                )}
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                <input
                    type="checkbox"
                    checked={!!item.needsToBuy}
                    onChange={e => update('needsToBuy', e.target.checked)}
                    className="w-4 h-4 accent-pink-500"
                />
                🛒 Hay que comprarlo antes del viaje
            </label>

            <input
                type="text"
                value={item.notes || ''}
                onChange={e => update('notes', e.target.value)}
                placeholder="Notas (opcional)"
                className="w-full bg-white dark:bg-[#1a0d10] dark:text-slate-200 border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-xs"
            />

            <div className="flex gap-2">
                <button
                    onClick={handleSave}
                    disabled={!item.name.trim()}
                    className="flex-1 bg-pink-400 text-white rounded-lg py-2 font-bold text-sm disabled:opacity-40"
                >
                    {initial ? 'Guardar' : 'Agregar'}
                </button>
                <button
                    onClick={onCancel}
                    className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg px-4 font-bold text-sm"
                >
                    Cancelar
                </button>
            </div>
        </div>
    );
};
