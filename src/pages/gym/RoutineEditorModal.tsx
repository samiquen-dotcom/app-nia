import React, { useState } from 'react';
import type { GymRoutine, RoutineExercise, ExerciseKind } from '../../types';

const KIND_LABELS: Record<ExerciseKind, { label: string; icon: string }> = {
    strength: { label: 'Fuerza', icon: 'fitness_center' },
    cardio: { label: 'Cardio', icon: 'directions_run' },
    other: { label: 'Otro', icon: 'sports_gymnastics' },
};

interface Props {
    routine?: GymRoutine;          // si viene, es edición; si no, es creación
    onSave: (routine: GymRoutine) => void;
    onClose: () => void;
}

export const RoutineEditorModal: React.FC<Props> = ({ routine, onSave, onClose }) => {
    const isEditing = !!routine;
    const [icon, setIcon] = useState(routine?.icon || '💪');
    const [label, setLabel] = useState(routine?.label || '');
    const [exercises, setExercises] = useState<RoutineExercise[]>(routine?.exercises ?? []);

    const [newExName, setNewExName] = useState('');
    const [newExKind, setNewExKind] = useState<ExerciseKind>('strength');

    const addExercise = () => {
        if (!newExName.trim()) return;
        setExercises(prev => [...prev, {
            id: `ex_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: newExName.trim(),
            kind: newExKind,
        }]);
        setNewExName('');
    };

    const removeExercise = (id: string) => {
        setExercises(prev => prev.filter(e => e.id !== id));
    };

    const handleSave = () => {
        if (!label.trim()) return;
        onSave({
            id: routine?.id || `rtn_${Date.now()}`,
            icon: icon || '💪',
            label: label.trim(),
            exercises,
        });
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in" onClick={onClose}>
            <div
                className="bg-white dark:bg-[#231218] w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto scrollbar-hide"
                onClick={e => e.stopPropagation()}
            >
                <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mb-5">
                    {isEditing ? 'Editar rutina' : 'Nueva rutina'}
                </h2>

                {/* Emoji + nombre */}
                <div className="flex gap-3 mb-5">
                    <input
                        type="text"
                        value={icon}
                        onChange={e => setIcon(e.target.value.substring(0, 4) || '💪')}
                        onClick={() => { if (icon === '💪') setIcon(''); }}
                        className="w-16 h-16 text-3xl text-center bg-slate-50 dark:bg-[#1a0d10] border-2 border-emerald-100 dark:border-emerald-900/40 rounded-2xl focus:border-emerald-500 outline-none transition-all flex-shrink-0"
                        placeholder="💪"
                    />
                    <input
                        type="text"
                        value={label}
                        onChange={e => setLabel(e.target.value)}
                        placeholder="Nombre (ej: Día de pierna)"
                        autoFocus={!isEditing}
                        className="flex-1 min-w-0 px-4 rounded-2xl bg-slate-50 dark:bg-[#1a0d10] border-2 border-transparent focus:border-emerald-500 text-slate-800 dark:text-slate-100 focus:outline-none font-bold"
                    />
                </div>

                {/* Lista de ejercicios */}
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 block">
                    Ejercicios ({exercises.length})
                </label>
                <p className="text-[11px] text-slate-400 mb-3">
                    Opcional. Si los agregas, podrás registrar series/reps/peso. Si no, la rutina funciona como etiqueta rápida.
                </p>

                <div className="space-y-2 mb-3">
                    {exercises.map(ex => (
                        <div key={ex.id} className="flex items-center gap-2 bg-slate-50 dark:bg-[#1a0d10] rounded-xl px-3 py-2">
                            <span className="material-symbols-outlined text-base text-emerald-500 flex-shrink-0">
                                {KIND_LABELS[ex.kind].icon}
                            </span>
                            <span className="flex-1 min-w-0 text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                                {ex.name}
                            </span>
                            <span className="text-[10px] text-slate-400 flex-shrink-0">{KIND_LABELS[ex.kind].label}</span>
                            <button
                                onClick={() => removeExercise(ex.id)}
                                className="text-slate-300 hover:text-rose-400 transition-colors flex-shrink-0"
                                aria-label="Quitar ejercicio"
                            >
                                <span className="material-symbols-outlined text-base">close</span>
                            </button>
                        </div>
                    ))}
                </div>

                {/* Agregar ejercicio */}
                <div className="bg-slate-50 dark:bg-[#1a0d10] rounded-2xl p-3 mb-5">
                    <input
                        type="text"
                        value={newExName}
                        onChange={e => setNewExName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addExercise()}
                        placeholder="Nombre del ejercicio…"
                        className="w-full bg-white dark:bg-[#2d1820] border border-slate-200 dark:border-[#5a2b35]/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400 mb-2 dark:text-slate-200"
                    />
                    <div className="flex gap-2">
                        <div className="flex gap-1 flex-1">
                            {(Object.keys(KIND_LABELS) as ExerciseKind[]).map(k => (
                                <button
                                    key={k}
                                    onClick={() => setNewExKind(k)}
                                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${newExKind === k
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-white dark:bg-[#2d1820] text-slate-400 border border-slate-200 dark:border-[#5a2b35]/40'}`}
                                >
                                    {KIND_LABELS[k].label}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={addExercise}
                            disabled={!newExName.trim()}
                            className="bg-emerald-500 text-white rounded-lg px-3 font-bold disabled:opacity-40 flex-shrink-0"
                        >
                            +
                        </button>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-[#3a2028] text-slate-600 dark:text-slate-300 font-bold"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!label.trim()}
                        className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold shadow-lg disabled:opacity-40 active:scale-95 transition-all"
                    >
                        {isEditing ? 'Guardar' : 'Crear rutina'}
                    </button>
                </div>
            </div>
        </div>
    );
};
