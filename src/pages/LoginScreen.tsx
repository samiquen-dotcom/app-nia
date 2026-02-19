import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { FirestoreService } from '../services/firestore';

export const LoginScreen: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();

    useEffect(() => {
        if (user) {
            // Initialize user doc if needed
            FirestoreService.initUser(user).then(() => navigate('/home'));
        }
    }, [user, navigate]);

    const handleLogin = async () => {
        setLoading(true);
        try {
            await signInWithPopup(auth, googleProvider);
            // Navigation handled by useEffect
        } catch (error) {
            console.error("Login failed", error);
            alert("Error al iniciar sesión. Intenta de nuevo.");
            setLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-gradient-to-b from-[#ffd6e0] to-[#f3e5f5] overflow-hidden items-center justify-center p-6">

            {/* Logo Section */}
            <div className="flex flex-col items-center gap-6 mb-12 animate-bounce dark:text-white" style={{ animationDuration: '3s' }}>
                <div className="relative flex items-center justify-center w-24 h-24 rounded-3xl bg-white/40 backdrop-blur-sm shadow-sm ring-4 ring-white/50">
                    <span className="material-symbols-outlined text-rose-400 !text-5xl">auto_awesome</span>
                    <span className="material-symbols-outlined absolute -top-2 -right-2 text-rose-300 !text-xl animate-pulse">star</span>
                </div>
                <div className="text-center">
                    <h1 className="text-[#2d2023] text-4xl font-extrabold tracking-tight mb-2 drop-shadow-sm">App Nia</h1>
                    <p className="text-[#5c4a4f] text-lg font-medium tracking-wide">Bienvenida, Nia 🌸</p>
                </div>
            </div>

            {/* Login Button */}
            <button
                onClick={handleLogin}
                disabled={loading}
                className="group relative flex w-full max-w-xs cursor-pointer items-center justify-center overflow-hidden rounded-full h-14 bg-white shadow-lg shadow-rose-100 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
            >
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                {loading ? (
                    <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
                ) : (
                    <>
                        <div className="mr-3 flex items-center justify-center">
                            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="Google" />
                        </div>
                        <span className="text-[#3c4043] text-base font-bold leading-normal tracking-wide">Continuar con Google</span>
                    </>
                )}
            </button>

            <div className="text-center pt-8">
                <p className="text-xs text-[#7d686f] font-normal">Tu espacio seguro y kawaii ✨</p>
            </div>
        </div>
    );
};
