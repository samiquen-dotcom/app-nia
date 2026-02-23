import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { FirestoreService } from '../services/firestore';

export const LoginScreen: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();

    const handleEnterApp = async () => {
        if (!user) return;
        setLoading(true);
        try {
            await FirestoreService.initUser(user);
            navigate('/home');
        } catch (err) {
            console.error("Ocurrió un error entrando", err);
            setLoading(false);
        }
    };

    const handleLogin = async () => {
        setLoading(true);
        try {
            await signInWithPopup(auth, googleProvider);
            setLoading(false);
        } catch (error) {
            console.error("Login failed", error);
            alert("Error al iniciar sesión. Intenta de nuevo.");
            setLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-gradient-to-b from-[#ffd6e0] to-[#f3e5f5] overflow-hidden items-center justify-center p-6">

            {/* Logo Section */}
            <div className="flex flex-col items-center gap-6 mb-12 dark:text-white">
                <div className="relative flex items-center justify-center w-40 h-40 animate-float-coquette">
                    <img src="/LOGO NIA.png" alt="App Nia Logo" className="w-full h-full object-contain drop-shadow-xl" />
                </div>
                <div className="text-center">
                    <h1 className="text-[#2d2023] text-4xl font-extrabold tracking-tight mb-2 drop-shadow-sm">App Nia</h1>
                    <p className="text-[#5c4a4f] text-lg font-medium tracking-wide">Bienvenida, Nia 🌸</p>
                </div>
            </div>

            {/* Action Button */}
            {user ? (
                <button
                    onClick={handleEnterApp}
                    disabled={loading}
                    className="group relative flex w-full max-w-xs cursor-pointer items-center justify-center overflow-hidden rounded-full h-14 bg-gradient-to-r from-rose-400 to-pink-500 shadow-lg shadow-rose-200 dark:shadow-none transition-all hover:scale-[1.05] active:scale-[0.95] disabled:opacity-70"
                >
                    {loading ? (
                        <span className="material-symbols-outlined animate-spin text-white">progress_activity</span>
                    ) : (
                        <span className="text-white text-base font-extrabold leading-normal tracking-wide drop-shadow-sm">
                            Entrar a mi espacio ✨
                        </span>
                    )}
                </button>
            ) : (
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
            )}

            <div className="text-center pt-8">
                <p className="text-xs text-[#7d686f] font-normal">Tu espacio seguro y kawaii ✨</p>
            </div>
        </div>
    );
};
