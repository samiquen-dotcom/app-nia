import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { FirestoreService } from '../services/firestore';

/**
 * Generic hook to load and save any feature data to/from Firestore.
 * Usage: const { data, loading, saving, error, save } = useFeatureData<MyType>('featureName', defaultValue);
 */
export function useFeatureData<T extends object>(feature: string, defaultValue: T) {
    const { user } = useAuth();
    const [data, setData] = useState<T>(defaultValue);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user) { setLoading(false); return; }
        setLoading(true);
        setError(null);
        FirestoreService.getFeatureData(user.uid, feature)
            .then(fetched => {
                if (fetched) {
                    // Merge with defaultValue to ensure newly added properties (like Arrays) exist
                    setData({ ...defaultValue, ...fetched } as T);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(`Error loading feature data for "${feature}":`, err);
                setError('No se pudieron cargar los datos. Intenta de nuevo.');
                setLoading(false);
            });
    }, [user, feature]);

    /**
     * Merge-saves partial updates. Client-side spread so arrays are replaced, not merged.
     * Always pass the full updated array/object when updating nested data.
     */
    const save = async (partial: Partial<T>) => {
        if (!user) return;
        setSaving(true);
        const updated = { ...data, ...partial } as T;
        setData(updated);
        try {
            await FirestoreService.saveFeatureData(user.uid, feature, updated);
            setError(null);
        } catch (err) {
            console.error(`Error saving feature data for "${feature}":`, err);
            setError('No se pudieron guardar los cambios. Intenta de nuevo.');
            // Revert to previous state on error
        } finally {
            setSaving(false);
        }
    };

    /** Replaces the entire document. */
    const saveAll = async (newData: T) => {
        if (!user) return;
        setSaving(true);
        setData(newData);
        try {
            await FirestoreService.saveFeatureData(user.uid, feature, newData);
            setError(null);
        } catch (err) {
            console.error(`Error saving feature data for "${feature}":`, err);
            setError('No se pudieron guardar los cambios. Intenta de nuevo.');
        } finally {
            setSaving(false);
        }
    };

    return { data, loading, saving, error, save, saveAll, setData };
}
