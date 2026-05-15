import React, { useMemo, useState } from 'react';
import { useFeatureData } from '../hooks/useFeatureData';
import type { Note, NotePriority, NotesData } from '../types';

const PRIORITIES: { value: NotePriority; label: string; classes: string }[] = [
    { value: 'high', label: 'Alta', classes: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800' },
    { value: 'medium', label: 'Media', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
    { value: 'low', label: 'Baja', classes: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700' },
];

const priorityWeight: Record<NotePriority, number> = { high: 0, medium: 1, low: 2 };

type FilterMode = 'all' | 'pending' | 'done';

const formatDate = (ms: number) =>
    new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

export const NotesScreen: React.FC = () => {
    const { data, loading, save } = useFeatureData<NotesData>('notes', { items: [] });

    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Note | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<NotePriority>('medium');
    const [filter, setFilter] = useState<FilterMode>('pending');
    const [errorMsg, setErrorMsg] = useState('');

    const items = data.items || [];

    const filtered = useMemo(() => {
        const list = items.filter(n => {
            if (filter === 'pending') return !n.done;
            if (filter === 'done') return n.done;
            return true;
        });
        return list.slice().sort((a, b) => {
            if (a.done !== b.done) return a.done ? 1 : -1;
            if (priorityWeight[a.priority] !== priorityWeight[b.priority]) {
                return priorityWeight[a.priority] - priorityWeight[b.priority];
            }
            return b.createdAt - a.createdAt;
        });
    }, [items, filter]);

    const counts = useMemo(() => ({
        all: items.length,
        pending: items.filter(n => !n.done).length,
        done: items.filter(n => n.done).length,
    }), [items]);

    const openNew = () => {
        setEditing(null);
        setTitle('');
        setDescription('');
        setPriority('medium');
        setErrorMsg('');
        setShowModal(true);
    };

    const openEdit = (note: Note) => {
        setEditing(note);
        setTitle(note.title);
        setDescription(note.description || '');
        setPriority(note.priority);
        setErrorMsg('');
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditing(null);
        setErrorMsg('');
    };

    const handleSave = async () => {
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            setErrorMsg('El título es obligatorio.');
            return;
        }
        const now = Date.now();
        let updated: Note[];
        if (editing) {
            updated = items.map(n =>
                n.id === editing.id
                    ? { ...n, title: trimmedTitle, description: description.trim(), priority, updatedAt: now }
                    : n
            );
        } else {
            const newNote: Note = {
                id: `note_${now}_${Math.random().toString(36).slice(2, 8)}`,
                title: trimmedTitle,
                description: description.trim(),
                priority,
                done: false,
                createdAt: now,
                updatedAt: now,
            };
            updated = [newNote, ...items];
        }
        await save({ items: updated });
        closeModal();
    };

    const toggleDone = async (id: string) => {
        const updated = items.map(n =>
            n.id === id ? { ...n, done: !n.done, updatedAt: Date.now() } : n
        );
        await save({ items: updated });
    };

    const remove = async (id: string) => {
        if (!confirm('¿Eliminar esta nota?')) return;
        const updated = items.filter(n => n.id !== id);
        await save({ items: updated });
    };

    return (
        <div className="pb-12">
            {/* Header */}
            <header className="px-6 pt-12 pb-4 flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">Notas y arreglos 📝</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Tu bandeja personal de ideas y mejoras para la app.</p>
                </div>
                <button
                    onClick={openNew}
                    className="flex-shrink-0 flex items-center gap-2 bg-gradient-to-r from-primary to-accent text-white font-bold px-4 py-2.5 rounded-full shadow-md active:scale-95 transition-all"
                >
                    <span className="material-symbols-outlined text-lg">add</span>
                    <span className="hidden sm:inline">Nueva</span>
                </button>
            </header>

            {/* Filters */}
            <section className="px-6 pb-4">
                <div className="inline-flex gap-1 bg-slate-100 dark:bg-[#2d1820] rounded-full p-1">
                    {([
                        ['pending', `Pendientes (${counts.pending})`],
                        ['done', `Hechas (${counts.done})`],
                        ['all', `Todas (${counts.all})`],
                    ] as [FilterMode, string][]).map(([mode, label]) => (
                        <button
                            key={mode}
                            onClick={() => setFilter(mode)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${filter === mode
                                ? 'bg-white dark:bg-[#3a2028] text-primary shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-primary'
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </section>

            {/* List */}
            <section className="px-6">
                {loading ? (
                    <p className="text-center text-slate-400 py-12">Cargando...</p>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 px-4">
                        <p className="text-5xl mb-3">📝</p>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">
                            {filter === 'pending'
                                ? 'No tienes notas pendientes. ¡Anota lo siguiente que se te ocurra!'
                                : filter === 'done'
                                    ? 'Aún no has marcado notas como hechas.'
                                    : 'Aún no has creado ninguna nota.'}
                        </p>
                        {filter !== 'all' && (
                            <button
                                onClick={openNew}
                                className="mt-5 px-5 py-2.5 rounded-full bg-primary text-white font-bold text-sm shadow-md active:scale-95"
                            >
                                + Crear nota
                            </button>
                        )}
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {filtered.map(note => {
                            const pri = PRIORITIES.find(p => p.value === note.priority)!;
                            return (
                                <li
                                    key={note.id}
                                    className={`rounded-2xl border bg-white dark:bg-[#2d1820] shadow-sm p-4 transition-all ${note.done ? 'opacity-60 border-slate-100 dark:border-slate-800' : 'border-slate-100 dark:border-[#5a2b35]/30'}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <button
                                            onClick={() => toggleDone(note.id)}
                                            className={`flex-shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${note.done
                                                ? 'bg-emerald-500 border-emerald-500'
                                                : 'border-slate-300 dark:border-slate-600 hover:border-primary'
                                                }`}
                                            aria-label={note.done ? 'Marcar como pendiente' : 'Marcar como hecha'}
                                        >
                                            {note.done && (
                                                <span className="material-symbols-outlined text-white text-base">check</span>
                                            )}
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <h3 className={`font-bold text-slate-800 dark:text-slate-100 break-words ${note.done ? 'line-through' : ''}`}>
                                                    {note.title}
                                                </h3>
                                                <span className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${pri.classes}`}>
                                                    {pri.label}
                                                </span>
                                            </div>
                                            {note.description && (
                                                <p className={`text-sm text-slate-500 dark:text-slate-400 whitespace-pre-wrap break-words ${note.done ? 'line-through' : ''}`}>
                                                    {note.description}
                                                </p>
                                            )}
                                            <div className="mt-2 flex items-center justify-between gap-3">
                                                <span className="text-[11px] text-slate-400">
                                                    Creada {formatDate(note.createdAt)}
                                                    {note.updatedAt && note.updatedAt !== note.createdAt && ` · editada ${formatDate(note.updatedAt)}`}
                                                </span>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => openEdit(note)}
                                                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#3a2028] text-slate-400 hover:text-primary transition-colors"
                                                        aria-label="Editar"
                                                    >
                                                        <span className="material-symbols-outlined text-base">edit</span>
                                                    </button>
                                                    <button
                                                        onClick={() => remove(note.id)}
                                                        className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-500 transition-colors"
                                                        aria-label="Eliminar"
                                                    >
                                                        <span className="material-symbols-outlined text-base">delete</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            {/* Modal: New / Edit */}
            {showModal && (
                <div
                    className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
                    onClick={closeModal}
                >
                    <div
                        className="bg-white dark:bg-[#2d1820] w-full max-w-md lg:max-w-lg rounded-3xl p-6 shadow-2xl relative"
                        onClick={e => e.stopPropagation()}
                    >
                        <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mb-4">
                            {editing ? 'Editar nota' : 'Nueva nota'}
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">Título</label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={title}
                                    onChange={e => { setTitle(e.target.value); setErrorMsg(''); }}
                                    placeholder="Ej: Mejorar el modal de transferencias"
                                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-[#1a0d10] border-2 border-transparent focus:border-primary text-slate-800 dark:text-slate-100 focus:outline-none transition-colors"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">Descripción (opcional)</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Detalles, contexto, ideas..."
                                    rows={4}
                                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-[#1a0d10] border-2 border-transparent focus:border-primary text-slate-800 dark:text-slate-100 focus:outline-none transition-colors resize-none"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">Prioridad</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {PRIORITIES.map(p => (
                                        <button
                                            key={p.value}
                                            onClick={() => setPriority(p.value)}
                                            className={`py-2.5 rounded-2xl border-2 text-sm font-bold transition-all ${priority === p.value
                                                ? `${p.classes} scale-105`
                                                : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#1a0d10] text-slate-500'
                                                }`}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {errorMsg && (
                                <p className="text-sm text-rose-500 font-medium">{errorMsg}</p>
                            )}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={closeModal}
                                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-[#3a2028] text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-bold shadow-lg active:scale-95 transition-all"
                            >
                                {editing ? 'Guardar' : 'Crear nota'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
