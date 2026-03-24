import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUserPreferences } from '../context/UserPreferencesContext';
import { useTheme } from '../context/ThemeContext';

export const ProfileScreen: React.FC = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { preferences, updateNavItems, toggleNavItem } = useUserPreferences();
    const { isDark, toggleTheme } = useTheme();

    const [isReordering, setIsReordering] = useState(false);

    const enabledNavItems = preferences?.navItems.filter(item => item.enabled) || [];

    // Handle logout
    const handleLogout = async () => {
        if (confirm('¿Seguro que querés cerrar sesión?')) {
            await logout();
            navigate('/');
        }
    };

    // Mover item hacia arriba
    const moveUp = useCallback((index: number) => {
        if (index === 0) return;

        const items = [...enabledNavItems];
        const temp = items[index];
        items[index] = items[index - 1];
        items[index - 1] = temp;

        // Reconstruir lista completa manteniendo items ocultos en su posición original
        const hiddenItems = preferences?.navItems.filter(item => !item.enabled) || [];
        const newAllItems = [...items, ...hiddenItems];

        updateNavItems(newAllItems);
    }, [enabledNavItems, preferences, updateNavItems]);

    // Mover item hacia abajo
    const moveDown = useCallback((index: number) => {
        if (index === enabledNavItems.length - 1) return;

        const items = [...enabledNavItems];
        const temp = items[index];
        items[index] = items[index + 1];
        items[index + 1] = temp;

        // Reconstruir lista completa manteniendo items ocultos en su posición original
        const hiddenItems = preferences?.navItems.filter(item => !item.enabled) || [];
        const newAllItems = [...items, ...hiddenItems];

        updateNavItems(newAllItems);
    }, [enabledNavItems, preferences, updateNavItems]);

    return (
        <div className="pb-32 dark:bg-[#1a0d10] min-h-screen">
            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div className="px-6 pt-12 pb-6 bg-gradient-to-br from-pink-50 to-white dark:from-[#2d1820] dark:to-[#1a0d10] rounded-b-[2rem] shadow-sm">
                <div className="flex items-center gap-4 mb-6">
                    <button
                        onClick={() => navigate('/home')}
                        className="w-10 h-10 rounded-full bg-white dark:bg-[#3a2028] flex items-center justify-center shadow-sm hover:scale-105 transition-transform"
                    >
                        <span className="material-symbols-outlined text-slate-600 dark:text-slate-300">arrow_back</span>
                    </button>
                    <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                        Perfil ⚙️
                    </h1>
                </div>

                {/* User Info */}
                <div className="flex items-center gap-4 bg-white dark:bg-[#2d1820] rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-[#5a2b35]/30">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-3xl font-black text-white shadow-lg">
                        {user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || '👤'}
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                            {user?.displayName || 'Usuario'}
                        </h2>
                        <p className="text-sm text-slate-400 truncate">{user?.email}</p>
                    </div>
                </div>
            </div>

            {/* ── Configuración ─────────────────────────────────────────────── */}
            <div className="px-6 mb-8 mt-6">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 ml-1">
                    Apariencia
                </h3>

                <div className="bg-white dark:bg-[#2d1820] rounded-3xl shadow-sm border border-slate-100 dark:border-[#5a2b35]/30 overflow-hidden">
                    {/* Dark Mode Toggle */}
                    <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-[#5a2b35]/20">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#3a2028] flex items-center justify-center">
                                <span className="material-symbols-outlined text-slate-500 dark:text-slate-400">dark_mode</span>
                            </div>
                            <div>
                                <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">Modo Oscuro</p>
                                <p className="text-xs text-slate-400">Activar tema oscuro</p>
                            </div>
                        </div>
                        <button
                            onClick={() => toggleTheme()}
                            className={`w-14 h-8 rounded-full transition-colors relative ${isDark ? 'bg-emerald-500' : 'bg-slate-300'}`}
                        >
                            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${isDark ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Orden del Menú ────────────────────────────────────────────── */}
            <div className="px-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider ml-1">
                        Orden del Menú
                    </h3>
                    <button
                        onClick={() => setIsReordering(!isReordering)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
                            isReordering
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-100 dark:bg-[#3a2028] text-slate-500 dark:text-slate-400'
                        }`}
                    >
                        {isReordering ? '✅ Listo' : '✏️ Editar'}
                    </button>
                </div>

                <div className="bg-white dark:bg-[#2d1820] rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-[#5a2b35]/30">
                    <p className="text-xs text-slate-400 mb-4">
                        {isReordering
                            ? '👆 Arrastrá para reordenar • Tocá 👁️ para mostrar/ocultar'
                            : 'Personalizá el orden de las pestañas del menú inferior'}
                    </p>

                    <div className="space-y-2">
                        {enabledNavItems.map((item, index) => (
                            <div
                                key={item.id}
                                className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                                    isReordering
                                        ? 'bg-slate-100 dark:bg-[#3a2028] shadow-sm'
                                        : 'bg-slate-50 dark:bg-[#1a0d10]/50 border-slate-100 dark:border-[#5a2b35]/20'
                                }`}
                            >
                                {/* Botones Subir/Bajar */}
                                {isReordering && item.id !== 'home' && (
                                    <div className="flex flex-col gap-0.5">
                                        <button
                                            onClick={() => moveUp(index)}
                                            disabled={index === 0}
                                            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-200 dark:hover:bg-[#3a2028] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-slate-500 text-sm">keyboard_arrow_up</span>
                                        </button>
                                        <button
                                            onClick={() => moveDown(index)}
                                            disabled={index === enabledNavItems.length - 1}
                                            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-200 dark:hover:bg-[#3a2028] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-slate-500 text-sm">keyboard_arrow_down</span>
                                        </button>
                                    </div>
                                )}

                                {/* Icon */}
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                    item.path === '/home' ? 'bg-pink-100 text-pink-500' :
                                    item.path === '/finance' ? 'bg-amber-100 text-amber-500' :
                                    item.path === '/period' ? 'bg-rose-100 text-rose-500' :
                                    item.path === '/gym' ? 'bg-blue-100 text-blue-500' :
                                    item.path === '/food' ? 'bg-emerald-100 text-emerald-500' :
                                    item.path === '/wellness' ? 'bg-purple-100 text-purple-500' :
                                    'bg-indigo-100 text-indigo-500'
                                }`}>
                                    <span className="material-symbols-outlined">{item.icon}</span>
                                </div>

                                {/* Label */}
                                <span className="flex-1 font-bold text-slate-700 dark:text-slate-200 text-sm">
                                    {item.label}
                                </span>

                                {/* Toggle Visibility */}
                                {isReordering && item.id !== 'home' && (
                                    <button
                                        onClick={() => toggleNavItem(item.id, !item.enabled)}
                                        className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-200 dark:hover:bg-[#3a2028] transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-slate-400 text-lg">
                                            {item.enabled ? 'visibility' : 'visibility_off'}
                                        </span>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Mostrar items ocultos */}
                    {isReordering && (
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-[#5a2b35]/20">
                            <p className="text-xs font-bold text-slate-400 mb-3">Pestañas ocultas:</p>
                            <div className="space-y-2">
                                {preferences?.navItems
                                    .filter(item => !item.enabled && item.id !== 'home')
                                    .map(item => (
                                        <div
                                            key={item.id}
                                            className="flex items-center gap-3 p-3 rounded-2xl bg-slate-100 dark:bg-[#1a0d10]/50 opacity-60"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-[#3a2028] flex items-center justify-center">
                                                <span className="material-symbols-outlined text-slate-400">{item.icon}</span>
                                            </div>
                                            <span className="flex-1 font-bold text-slate-500 text-sm">{item.label}</span>
                                            <button
                                                onClick={() => toggleNavItem(item.id, true)}
                                                className="w-9 h-9 rounded-full flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 hover:bg-emerald-200 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-lg">add</span>
                                            </button>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Cerrar Sesión ─────────────────────────────────────────────── */}
            <div className="px-6 mb-10">
                <button
                    onClick={handleLogout}
                    className="w-full bg-rose-50 dark:bg-rose-900/20 border-2 border-rose-200 dark:border-rose-800/30 rounded-3xl p-5 flex items-center justify-center gap-3 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors"
                >
                    <span className="material-symbols-outlined text-rose-500 text-2xl">logout</span>
                    <span className="font-extrabold text-rose-500 text-base">Cerrar Sesión</span>
                </button>
            </div>

            {/* ── Info App ──────────────────────────────────────────────────── */}
            <div className="text-center pb-8">
                <p className="text-xs text-slate-400 font-medium">
                    App Nia v1.0.0
                </p>
                <p className="text-[9px] text-slate-300 dark:text-slate-500 mt-1">
                    Hecho con 💖 para tu bienestar
                </p>
            </div>
        </div>
    );
};
