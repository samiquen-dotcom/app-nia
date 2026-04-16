import React, { useState, useMemo } from 'react';
import type { Trip, TripJournalEntry, TripRecap } from '../../types';
import { tripDateList, formatCurrency, totalExpensesInBase } from './utils';

const MOOD_OPTIONS = [
    { emoji: '🤩', label: 'Increíble' },
    { emoji: '😄', label: 'Feliz' },
    { emoji: '😊', label: 'Bien' },
    { emoji: '😐', label: 'Normal' },
    { emoji: '😔', label: 'Mal' },
    { emoji: '😴', label: 'Cansada' },
    { emoji: '😍', label: 'Enamorada' },
    { emoji: '🤯', label: 'Sorprendida' },
    { emoji: '🥺', label: 'Sensible' },
    { emoji: '🤒', label: 'Enferma' },
    { emoji: '😎', label: 'Cool' },
    { emoji: '🥰', label: 'Agradecida' },
];

const WEATHER_OPTIONS = [
    { emoji: '☀️', label: 'Soleado' },
    { emoji: '⛅', label: 'Nublado' },
    { emoji: '🌧️', label: 'Lluvia' },
    { emoji: '⛈️', label: 'Tormenta' },
    { emoji: '❄️', label: 'Frío' },
    { emoji: '🌫️', label: 'Niebla' },
    { emoji: '🥵', label: 'Calor' },
];

export const JournalTab: React.FC<{
    trip: Trip;
    onUpdate: (trip: Trip) => void;
}> = ({ trip, onUpdate }) => {
    const [editingDate, setEditingDate] = useState<string | null>(null);
    const [showRecap, setShowRecap] = useState(false);

    const journal = trip.journal || [];
    const tripDays = useMemo(() => tripDateList(trip), [trip.startDate, trip.endDate]);
    const today = new Date().toISOString().split('T')[0];

    const entryByDate: Record<string, TripJournalEntry | undefined> = useMemo(() => {
        const map: Record<string, TripJournalEntry> = {};
        journal.forEach(e => { map[e.date] = e; });
        return map;
    }, [journal]);

    const saveEntry = (entry: TripJournalEntry) => {
        const exists = journal.some(e => e.date === entry.date);
        const updated = exists
            ? journal.map(e => e.date === entry.date ? entry : e)
            : [...journal, entry];
        onUpdate({ ...trip, journal: updated });
        setEditingDate(null);
    };

    const filledDays = journal.filter(e => e.moodEmoji || e.notes || e.highlight).length;
    const isCompleted = trip.status === 'completed';
    const recap = trip.recap;

    const saveRecap = (r: TripRecap) => {
        onUpdate({ ...trip, recap: { ...r, completedAt: r.completedAt || Date.now() } });
        setShowRecap(false);
    };

    return (
        <div className="space-y-3 sm:space-y-4">
            {/* Hero / Recap CTA */}
            {isCompleted && !recap && (
                <button
                    onClick={() => setShowRecap(true)}
                    className="w-full bg-gradient-to-br from-pink-400 via-rose-400 to-pink-500 text-white rounded-2xl p-4 text-left shadow-lg hover:shadow-xl transition-all"
                >
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-3xl">auto_awesome</span>
                        <div>
                            <p className="font-bold">¡Cierra este viaje! ✨</p>
                            <p className="text-xs text-white/80">Cuenta cómo te fue, qué te llevas y si volverías</p>
                        </div>
                    </div>
                </button>
            )}

            {recap && (
                <div className="bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/10 dark:to-rose-900/10 rounded-2xl p-4 border border-pink-100 dark:border-pink-900/20">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-pink-600 dark:text-pink-300 flex items-center gap-1">
                            <span className="material-symbols-outlined text-base">auto_stories</span>
                            Recuerdos del viaje
                        </h4>
                        <button onClick={() => setShowRecap(true)} className="text-xs text-pink-500 font-bold">Editar</button>
                    </div>
                    <div className="space-y-2 text-xs">
                        {recap.overallRating != null && (
                            <p className="text-amber-500 font-bold">{'⭐'.repeat(recap.overallRating)}{'☆'.repeat(5 - recap.overallRating)}</p>
                        )}
                        {recap.favoriteMoment && <RecapItem label="Mi momento favorito" value={recap.favoriteMoment} />}
                        {recap.bestPlace && <RecapItem label="El mejor lugar" value={recap.bestPlace} />}
                        {recap.worstPart && <RecapItem label="Lo peor" value={recap.worstPart} />}
                        {recap.lessonsLearned && <RecapItem label="Aprendí que" value={recap.lessonsLearned} />}
                        {recap.wouldReturn != null && (
                            <p className="text-pink-500 font-bold">{recap.wouldReturn ? '✓ Volvería en un segundo' : '✗ Una vez fue suficiente'}</p>
                        )}
                    </div>
                </div>
            )}

            {/* Stats del journal */}
            {tripDays.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-slate-50 dark:bg-[#2d1820] rounded-xl p-3 text-center">
                        <p className="text-[10px] text-slate-400 font-medium">Días registrados</p>
                        <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{filledDays}/{tripDays.length}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-[#2d1820] rounded-xl p-3 text-center">
                        <p className="text-[10px] text-slate-400 font-medium">Total gastado</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                            {formatCurrency(totalExpensesInBase(trip), trip.baseCurrency)}
                        </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-[#2d1820] rounded-xl p-3 text-center">
                        <p className="text-[10px] text-slate-400 font-medium">Reservas</p>
                        <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{(trip.reservations || []).length}</p>
                    </div>
                </div>
            )}

            {/* Días */}
            {tripDays.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">Define fechas del viaje para crear tu diario</p>
            ) : (
                <div className="space-y-2">
                    {tripDays.map(date => {
                        const entry = entryByDate[date];
                        const isToday = date === today;
                        const isPast = date < today;
                        const dateObj = new Date(date + 'T00:00:00');
                        const dateLabel = dateObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
                        const isExpanded = editingDate === date;
                        const dayNumber = tripDays.indexOf(date) + 1;

                        return (
                            <div
                                key={date}
                                className={`rounded-2xl overflow-hidden transition-all ${isToday ? 'ring-2 ring-pink-300' : ''} ${entry ? 'bg-slate-50 dark:bg-[#2d1820]' : 'bg-slate-50/50 dark:bg-[#2d1820]/50'}`}
                            >
                                <button
                                    onClick={() => setEditingDate(isExpanded ? null : date)}
                                    className="w-full px-4 py-3 flex items-center gap-3 text-left"
                                >
                                    <div className="flex-shrink-0 w-10 h-10 bg-pink-100 dark:bg-pink-900/30 text-pink-500 rounded-xl flex items-center justify-center text-xs font-bold">
                                        D{dayNumber}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{dateLabel}</p>
                                            {isToday && <span className="text-[10px] bg-pink-100 dark:bg-pink-900/30 text-pink-500 px-1.5 rounded-full font-bold">Hoy</span>}
                                            {entry?.moodEmoji && <span className="text-lg">{entry.moodEmoji}</span>}
                                            {entry?.weather && <span className="text-base">{entry.weather}</span>}
                                            {entry?.photoNotes && extractUrls(entry.photoNotes).length > 0 && (
                                                <span className="text-xs text-blue-400" title="Tiene links de fotos">📷</span>
                                            )}
                                        </div>
                                        {entry?.highlight && (
                                            <p className="text-xs text-pink-500 italic truncate mt-0.5">"{entry.highlight}"</p>
                                        )}
                                        {!entry && isPast && (
                                            <p className="text-[10px] text-slate-400">Sin registrar</p>
                                        )}
                                    </div>
                                    <span className="material-symbols-outlined text-slate-400 text-base">{isExpanded ? 'expand_less' : 'expand_more'}</span>
                                </button>

                                {isExpanded && (
                                    <JournalEntryForm
                                        date={date}
                                        initial={entry}
                                        onSave={saveEntry}
                                        onCancel={() => setEditingDate(null)}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Recap modal */}
            {showRecap && (
                <RecapForm
                    initial={recap}
                    onSave={saveRecap}
                    onCancel={() => setShowRecap(false)}
                />
            )}
        </div>
    );
};

const JournalEntryForm: React.FC<{
    date: string;
    initial?: TripJournalEntry;
    onSave: (e: TripJournalEntry) => void;
    onCancel: () => void;
}> = ({ date, initial, onSave, onCancel }) => {
    const [entry, setEntry] = useState<TripJournalEntry>(initial || { date });

    const update = <K extends keyof TripJournalEntry>(key: K, value: TripJournalEntry[K]) => {
        setEntry(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-[#5a2b35]/20 pt-3">
            <div>
                <label className="text-[10px] font-bold text-slate-500 mb-1 block">Mood del día</label>
                <div className="grid grid-cols-6 gap-1">
                    {MOOD_OPTIONS.map(m => (
                        <button
                            key={m.emoji}
                            onClick={() => { update('moodEmoji', m.emoji); update('moodLabel', m.label); }}
                            className={`p-2 rounded-lg text-xl ${entry.moodEmoji === m.emoji ? 'bg-pink-100 dark:bg-pink-900/30 ring-2 ring-pink-300' : 'bg-slate-50 dark:bg-[#1a0d10]'}`}
                            title={m.label}
                        >
                            {m.emoji}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className="text-[10px] font-bold text-slate-500 mb-1 block">Clima</label>
                <div className="grid grid-cols-7 gap-1">
                    {WEATHER_OPTIONS.map(w => (
                        <button
                            key={w.emoji}
                            onClick={() => update('weather', entry.weather === w.emoji ? undefined : w.emoji)}
                            className={`p-2 rounded-lg text-base ${entry.weather === w.emoji ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-300' : 'bg-slate-50 dark:bg-[#1a0d10]'}`}
                            title={w.label}
                        >
                            {w.emoji}
                        </button>
                    ))}
                </div>
            </div>

            <input
                type="text"
                value={entry.highlight || ''}
                onChange={e => update('highlight', e.target.value)}
                placeholder="Mejor momento del día ✨"
                className="w-full bg-white dark:bg-[#1a0d10] border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm"
            />

            <textarea
                value={entry.notes || ''}
                onChange={e => update('notes', e.target.value)}
                placeholder="Cuenta tu día, cómo te sentiste, dónde fuiste..."
                rows={3}
                className="w-full bg-white dark:bg-[#1a0d10] border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm resize-none"
            />

            <textarea
                value={entry.photoNotes || ''}
                onChange={e => update('photoNotes', e.target.value)}
                placeholder="Links de fotos (Drive/iCloud, uno por línea)"
                rows={2}
                className="w-full bg-white dark:bg-[#1a0d10] border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-xs resize-none"
            />
            {entry.photoNotes && extractUrls(entry.photoNotes).length > 0 && (
                <div className="space-y-1">
                    {extractUrls(entry.photoNotes).map((url, i) => (
                        <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-xs text-blue-500 hover:underline truncate"
                        >
                            🔗 {url}
                        </a>
                    ))}
                </div>
            )}

            <div className="flex gap-2">
                <button onClick={() => onSave(entry)} className="flex-1 bg-pink-400 text-white rounded-lg py-2 font-bold text-sm">
                    Guardar día
                </button>
                <button onClick={onCancel} className="bg-slate-200 dark:bg-slate-700 rounded-lg px-4 font-bold text-sm">Cancelar</button>
            </div>
        </div>
    );
};

const RecapForm: React.FC<{
    initial?: TripRecap;
    onSave: (r: TripRecap) => void;
    onCancel: () => void;
}> = ({ initial, onSave, onCancel }) => {
    const [r, setR] = useState<TripRecap>(initial || { overallRating: 5 });

    const update = <K extends keyof TripRecap>(key: K, value: TripRecap[K]) => {
        setR(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
            <div className="relative w-full sm:max-w-md max-h-[90vh] flex flex-col bg-white dark:bg-[#1a0d10] rounded-t-3xl sm:rounded-3xl shadow-2xl">
                <div className="px-5 pt-5 pb-3 border-b border-slate-100 dark:border-[#5a2b35]/30">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">¿Cómo te fue? ✨</h3>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">Calificación general</label>
                        <div className="flex justify-center gap-1">
                            {[1, 2, 3, 4, 5].map(n => (
                                <button
                                    key={n}
                                    onClick={() => update('overallRating', n)}
                                    className="text-3xl"
                                >
                                    {(r.overallRating || 0) >= n ? '⭐' : '☆'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">Mi momento favorito</label>
                        <textarea
                            value={r.favoriteMoment || ''}
                            onChange={e => update('favoriteMoment', e.target.value)}
                            rows={2}
                            className="w-full bg-slate-50 dark:bg-[#2d1820] border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm resize-none"
                            placeholder="Aquel atardecer en…"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">El mejor lugar</label>
                        <input
                            type="text"
                            value={r.bestPlace || ''}
                            onChange={e => update('bestPlace', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-[#2d1820] border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm"
                            placeholder="Restaurante, museo, playa…"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">Lo que no me gustó</label>
                        <input
                            type="text"
                            value={r.worstPart || ''}
                            onChange={e => update('worstPart', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-[#2d1820] border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm"
                            placeholder="Para no repetir…"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">Lecciones aprendidas</label>
                        <textarea
                            value={r.lessonsLearned || ''}
                            onChange={e => update('lessonsLearned', e.target.value)}
                            rows={2}
                            className="w-full bg-slate-50 dark:bg-[#2d1820] border border-slate-200 dark:border-[#5a2b35]/40 rounded-lg px-3 py-2 text-sm resize-none"
                            placeholder="Lo que me llevo…"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 block">¿Volverías?</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => update('wouldReturn', true)}
                                className={`py-2 rounded-lg font-bold text-sm ${r.wouldReturn === true ? 'bg-green-400 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}
                            >
                                ✓ Sí, sin duda
                            </button>
                            <button
                                onClick={() => update('wouldReturn', false)}
                                className={`py-2 rounded-lg font-bold text-sm ${r.wouldReturn === false ? 'bg-rose-400 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}
                            >
                                ✗ No
                            </button>
                        </div>
                    </div>
                </div>

                <div className="px-5 pb-28 sm:pb-5 pt-2 flex gap-2 border-t border-slate-100 dark:border-[#5a2b35]/30">
                    <button onClick={onCancel} className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-xl py-3 font-bold text-sm">Cancelar</button>
                    <button onClick={() => onSave(r)} className="flex-1 bg-gradient-to-r from-pink-400 to-rose-500 text-white rounded-xl py-3 font-bold text-sm">
                        Guardar recuerdos ✨
                    </button>
                </div>
            </div>
        </div>
    );
};

/** Extrae URLs (http(s)://...) de un texto multilinea o separado por espacios. */
function extractUrls(text: string): string[] {
    const matches = text.match(/https?:\/\/[^\s]+/g);
    return matches || [];
}

const RecapItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div>
        <p className="text-[10px] text-pink-400 uppercase tracking-wider font-bold">{label}</p>
        <p className="text-slate-700 dark:text-slate-200">{value}</p>
    </div>
);
