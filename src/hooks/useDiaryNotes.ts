import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { FirestoreService } from '../services/firestore';
import type { DiaryNote, DiaryData, DiaryPreferences } from '../types';

/**
 * Hook para el diario.
 *
 * - Cada nota vive en su propio doc en la subcolección
 *   `users/{uid}/features/diary/notes/{noteId}`. Esto evita el límite de 1 MiB
 *   por documento de Firestore cuando hay clips de voz / loops.
 *
 * - Las preferencias del feature siguen en el doc principal `features/diary`.
 *
 * - Si el usuario tenía notas legacy en `features/diary.notes[]`, se migran
 *   automáticamente a la subcolección la primera vez que carga.
 */
export function useDiaryNotes() {
    const { user } = useAuth();
    const [notes, setNotes] = useState<DiaryNote[]>([]);
    const [preferences, setPreferences] = useState<DiaryPreferences>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const migratedRef = useRef(false);

    useEffect(() => {
        if (!user) { setLoading(false); return; }
        let cancelled = false;
        setLoading(true);
        setError(null);

        (async () => {
            try {
                // 1) Migración (idempotente). Solo intentamos una vez por sesión.
                if (!migratedRef.current) {
                    migratedRef.current = true;
                    try {
                        await FirestoreService.migrateDiaryToSubcollection(user.uid);
                    } catch (e) {
                        console.warn('[Diary] Migración no aplicó:', e);
                    }
                }

                // 2) Cargar notas + preferencias en paralelo
                const [fetchedNotes, mainDoc] = await Promise.all([
                    FirestoreService.getDiaryNotes(user.uid),
                    FirestoreService.getFeatureData(user.uid, 'diary') as Promise<DiaryData | null>,
                ]);
                if (cancelled) return;
                setNotes(fetchedNotes);
                setPreferences(mainDoc?.preferences || {});
                setLoading(false);
            } catch (e) {
                console.error('[Diary] Error cargando:', e);
                if (cancelled) return;
                setError('No se pudo cargar tu diario.');
                setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [user]);

    const addNote = useCallback(async (incoming: Omit<DiaryNote, 'id' | 'createdAt'>): Promise<DiaryNote> => {
        if (!user) throw new Error('No user');
        setSaving(true);
        setError(null);
        const note: DiaryNote = {
            ...incoming,
            id: 'd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            createdAt: Date.now(),
        };
        try {
            await FirestoreService.addDiaryNote(user.uid, note);
            setNotes(prev => [note, ...prev]);
            return note;
        } catch (e: any) {
            console.error('[Diary] Error guardando nota:', e);
            // Mensaje útil cuando es por tamaño
            const msg = (e?.message || '').includes('exceeds the maximum')
                ? 'La nota es muy pesada (clip de voz muy largo). Intenta una grabación más corta.'
                : 'No se pudo guardar la nota. Intenta de nuevo.';
            setError(msg);
            throw e;
        } finally {
            setSaving(false);
        }
    }, [user]);

    const updateNote = useCallback(async (id: string, partial: Partial<DiaryNote>): Promise<void> => {
        if (!user) return;
        setSaving(true);
        setError(null);
        try {
            await FirestoreService.updateDiaryNote(user.uid, id, partial);
            setNotes(prev => prev.map(n => n.id === id ? { ...n, ...partial } : n));
        } catch (e) {
            console.error('[Diary] Error actualizando nota:', e);
            setError('No se pudo actualizar la nota.');
            throw e;
        } finally {
            setSaving(false);
        }
    }, [user]);

    const deleteNote = useCallback(async (id: string): Promise<void> => {
        if (!user) return;
        setSaving(true);
        setError(null);
        try {
            await FirestoreService.deleteDiaryNote(user.uid, id);
            setNotes(prev => prev.filter(n => n.id !== id));
        } catch (e) {
            console.error('[Diary] Error borrando nota:', e);
            setError('No se pudo borrar la nota.');
            throw e;
        } finally {
            setSaving(false);
        }
    }, [user]);

    const togglePin = useCallback(async (id: string): Promise<void> => {
        const target = notes.find(n => n.id === id);
        if (!target) return;
        await updateNote(id, { pinned: !target.pinned });
    }, [notes, updateNote]);

    const savePreferences = useCallback(async (next: DiaryPreferences): Promise<void> => {
        if (!user) return;
        setSaving(true);
        try {
            await FirestoreService.saveFeatureData(user.uid, 'diary', { preferences: next });
            setPreferences(next);
        } catch (e) {
            console.error('[Diary] Error guardando preferencias:', e);
            setError('No se pudieron guardar las preferencias.');
            throw e;
        } finally {
            setSaving(false);
        }
    }, [user]);

    return {
        notes,
        preferences,
        loading,
        saving,
        error,
        addNote,
        updateNote,
        deleteNote,
        togglePin,
        savePreferences,
        clearError: () => setError(null),
    };
}
