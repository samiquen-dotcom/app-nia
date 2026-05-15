import React, { createContext, useContext, useEffect, useState } from 'react';
import { type User, onAuthStateChanged, signOut, getRedirectResult } from 'firebase/auth';
import { auth } from '../firebase';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, logout: async () => {} });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Safety-net: si veníamos de signInWithRedirect (fallback en navegadores
        // in-app de WhatsApp/Instagram), procesar el resultado al montar.
        // onAuthStateChanged también se disparará después, pero esto nos da
        // mejor manejo de errores cuando sessionStorage queda inaccesible.
        getRedirectResult(auth).catch(err => {
            // Solo log; no interrumpe el flujo de auth normal.
            if (err?.code && err.code !== 'auth/no-auth-event') {
                console.warn('[Auth] getRedirectResult:', err.code, err.message);
            }
        });

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
            // Optional: Save to local storage for persistence if needed, but Firebase handles it.
            if (user) localStorage.setItem('isAuthenticated', 'true');
            else localStorage.removeItem('isAuthenticated');
        });

        return unsubscribe;
    }, []);

    const logout = async () => {
        await signOut(auth);
        localStorage.removeItem('isAuthenticated');
    };

    return (
        <AuthContext.Provider value={{ user, loading, logout }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
