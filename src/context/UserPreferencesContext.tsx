import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface NavItem {
    id: string;
    path: string;
    icon: string;
    label: string;
    enabled: boolean;
}

export interface UserPreferences {
    darkMode: boolean;
    navItems: NavItem[];
}

const DEFAULT_NAV_ITEMS: NavItem[] = [
    { id: 'home', path: '/home', icon: 'home', label: 'Home', enabled: true },
    { id: 'finance', path: '/finance', icon: 'account_balance_wallet', label: 'Finanzas', enabled: true },
    { id: 'period', path: '/period', icon: 'female', label: 'Ciclo', enabled: true },
    { id: 'gym', path: '/gym', icon: 'fitness_center', label: 'Gym', enabled: true },
    { id: 'food', path: '/food', icon: 'nutrition', label: 'Comidas', enabled: true },
    { id: 'wellness', path: '/wellness', icon: 'self_improvement', label: 'Bienestar', enabled: true },
    { id: 'goals', path: '/goals', icon: 'stars', label: 'Metas', enabled: true },
    { id: 'travel', path: '/travel', icon: 'flight', label: 'Viajes', enabled: true },
];

interface UserPreferencesContextType {
    preferences: UserPreferences | null;
    loading: boolean;
    updateNavItems: (items: NavItem[]) => Promise<void>;
    reorderNavItems: (fromIndex: number, toIndex: number) => Promise<void>;
    toggleNavItem: (id: string, enabled: boolean) => Promise<void>;
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

export const UserPreferencesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [preferences, setPreferences] = useState<UserPreferences | null>(null);
    const [loading, setLoading] = useState(true);

    // Cargar preferencias
    useEffect(() => {
        if (!user) {
            setPreferences(null);
            setLoading(false);
            return;
        }

        const loadPreferences = async () => {
            try {
                const docRef = doc(db, 'users', user.uid, 'preferences', 'settings');
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    let navItems: NavItem[] = data.navItems ?? DEFAULT_NAV_ITEMS;

                    // Migración: Agregar items que falten (Viajes, etc.)
                    const missingItems = DEFAULT_NAV_ITEMS.filter(defaultItem =>
                        !navItems.some(item => item.id === defaultItem.id)
                    );
                    if (missingItems.length > 0) {
                        navItems = [...navItems, ...missingItems];
                        // Guardar actualización
                        const docRef = doc(db, 'users', user.uid, 'preferences', 'settings');
                        await setDoc(docRef, { navItems }, { merge: true });
                        console.log(`[Migración nav] Agregados ${missingItems.length} items:`, missingItems.map(i => i.label));
                    }

                    setPreferences({
                        darkMode: data.darkMode ?? false,
                        navItems,
                    });
                } else {
                    // Crear documento por defecto
                    const defaultPrefs: UserPreferences = {
                        darkMode: false,
                        navItems: DEFAULT_NAV_ITEMS,
                    };
                    await setDoc(docRef, defaultPrefs);
                    setPreferences(defaultPrefs);
                }
            } catch (error) {
                console.error('Error loading preferences:', error);
                setPreferences({
                    darkMode: false,
                    navItems: DEFAULT_NAV_ITEMS,
                });
            } finally {
                setLoading(false);
            }
        };

        loadPreferences();
    }, [user]);

    // Actualizar todos los nav items
    const updateNavItems = async (items: NavItem[]) => {
        if (!user || !preferences) return;

        try {
            const docRef = doc(db, 'users', user.uid, 'preferences', 'settings');
            await setDoc(docRef, { ...preferences, navItems: items }, { merge: true });
            setPreferences({ ...preferences, navItems: items });
        } catch (error) {
            console.error('Error updating nav items:', error);
        }
    };

    // Reordenar items (drag and drop)
    const reorderNavItems = async (fromIndex: number, toIndex: number) => {
        if (!user || !preferences) return;

        const items = [...preferences.navItems];
        const [removed] = items.splice(fromIndex, 1);
        items.splice(toIndex, 0, removed);

        try {
            const docRef = doc(db, 'users', user.uid, 'preferences', 'settings');
            await setDoc(docRef, { ...preferences, navItems: items }, { merge: true });
            setPreferences({ ...preferences, navItems: items });
        } catch (error) {
            console.error('Error reordering nav items:', error);
        }
    };

    // Toggle enabled/disabled
    const toggleNavItem = async (id: string, enabled: boolean) => {
        if (!user || !preferences) return;

        const items = preferences.navItems.map(item =>
            item.id === id ? { ...item, enabled } : item
        );

        try {
            const docRef = doc(db, 'users', user.uid, 'preferences', 'settings');
            await setDoc(docRef, { ...preferences, navItems: items }, { merge: true });
            setPreferences({ ...preferences, navItems: items });
        } catch (error) {
            console.error('Error toggling nav item:', error);
        }
    };

    return (
        <UserPreferencesContext.Provider
            value={{
                preferences,
                loading,
                updateNavItems,
                reorderNavItems,
                toggleNavItem,
            }}
        >
            {children}
        </UserPreferencesContext.Provider>
    );
};

export const useUserPreferences = () => {
    const context = useContext(UserPreferencesContext);
    if (context === undefined) {
        throw new Error('useUserPreferences must be used within UserPreferencesProvider');
    }
    return context;
};
