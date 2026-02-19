import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { FirestoreService } from '../services/firestore';

/**
 * Generic hook to load and save any feature data to/from Firestore.
 * Usage: const { data, loading, save } = useFeatureData<MyType>('featureName', defaultValue);
 */
export function useFeatureData<T extends object>(feature: string, defaultValue: T) {
    const { user } = useAuth();
    const [data, setData] = useState<T>(defaultValue);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) { setLoading(false); return; }
        setLoading(true);
        FirestoreService.getFeatureData(user.uid, feature).then(fetched => {
            if (fetched) setData(fetched as T);
            setLoading(false);
        });
    }, [user, feature]);

    /**
     * Merge-saves partial updates. Client-side spread so arrays are replaced, not merged.
     * Always pass the full updated array/object when updating nested data.
     */
    const save = async (partial: Partial<T>) => {
        if (!user) return;
        const updated = { ...data, ...partial } as T;
        setData(updated);
        await FirestoreService.saveFeatureData(user.uid, feature, updated);
    };

    /** Replaces the entire document. */
    const saveAll = async (newData: T) => {
        if (!user) return;
        setData(newData);
        await FirestoreService.saveFeatureData(user.uid, feature, newData);
    };

    return { data, loading, save, saveAll, setData };
}
