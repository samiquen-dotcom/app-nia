import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface ThemeContextType {
    isDark: boolean;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ isDark: false, toggleTheme: () => {} });

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [isDark, setIsDark] = useState(() => {
        return localStorage.getItem('nia_theme') === 'dark';
    });

    // Cargar preferencia de Firestore si hay usuario logueado
    useEffect(() => {
        if (!user) return;

        const loadDarkModePreference = async () => {
            try {
                const docRef = doc(db, 'users', user.uid, 'preferences', 'settings');
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.darkMode !== undefined) {
                        setIsDark(data.darkMode);
                        return;
                    }
                }

                // Si no existe, usar localStorage
                const stored = localStorage.getItem('nia_theme');
                if (stored) {
                    setIsDark(stored === 'dark');
                }
            } catch (error) {
                console.error('Error loading dark mode preference:', error);
            }
        };

        loadDarkModePreference();
    }, [user]);

    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('nia_theme', 'dark');
            // Guardar en Firestore si hay usuario
            if (user) {
                setDoc(doc(db, 'users', user.uid, 'preferences', 'settings'), { darkMode: true }, { merge: true })
                    .catch(err => console.error('Error saving dark mode:', err));
            }
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('nia_theme', 'light');
            // Guardar en Firestore si hay usuario
            if (user) {
                setDoc(doc(db, 'users', user.uid, 'preferences', 'settings'), { darkMode: false }, { merge: true })
                    .catch(err => console.error('Error saving dark mode:', err));
            }
        }
    }, [isDark, user]);

    const toggleTheme = () => setIsDark(prev => !prev);

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
