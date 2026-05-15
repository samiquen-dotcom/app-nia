import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useUserPreferences } from '../context/UserPreferencesContext';

export const Sidebar: React.FC = () => {
    const location = useLocation();
    const { user } = useAuth();
    const { isDark, toggleTheme } = useTheme();
    const { preferences } = useUserPreferences();

    if (location.pathname === '/') return null;

    const enabledNavItems = preferences?.navItems.filter(item => item.enabled) || [];
    const displayName = user?.displayName ? user.displayName.split(' ')[0] : 'Nia';
    const photoURL = user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}&backgroundColor=ffd6e0`;

    return (
        <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-64 bg-white dark:bg-[#231218] border-r border-slate-100 dark:border-[#5a2b35]/30 z-40">
            {/* Logo / brand */}
            <div className="px-6 pt-8 pb-6 flex items-center gap-3">
                <img src="/LOGO NIA.png" alt="Logo Nia" className="w-10 h-10 object-contain drop-shadow-sm" />
                <div>
                    <h1 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">App Nia</h1>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-accent">Tu compañera diaria</p>
                </div>
            </div>

            {/* Nav items */}
            <nav className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1">
                {enabledNavItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `
                            flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200
                            ${isActive
                                ? 'text-primary bg-secondary/40 dark:bg-[#3a2028] font-bold shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-[#3a2028]'}
                        `}
                    >
                        <span className="material-symbols-outlined text-xl">{item.icon}</span>
                        <span className="text-sm">{item.label}</span>
                    </NavLink>
                ))}

                <NavLink
                    to="/profile"
                    className={({ isActive }) => `
                        flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200
                        ${isActive
                            ? 'text-primary bg-secondary/40 dark:bg-[#3a2028] font-bold shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-[#3a2028]'}
                    `}
                >
                    <span className="material-symbols-outlined text-xl">person</span>
                    <span className="text-sm">Perfil</span>
                </NavLink>
            </nav>

            {/* Footer: user + dark mode */}
            <div className="px-3 py-4 border-t border-slate-100 dark:border-[#5a2b35]/30">
                <div className="flex items-center gap-3 px-2 py-2 rounded-2xl">
                    <img
                        src={photoURL}
                        alt="Profile"
                        referrerPolicy="no-referrer"
                        className="w-9 h-9 rounded-full object-cover border-2 border-primary"
                    />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{displayName}</p>
                        <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
                    </div>
                    <button
                        onClick={toggleTheme}
                        title={isDark ? 'Modo claro' : 'Modo oscuro'}
                        className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-[#3a2028] transition"
                    >
                        <span className="material-symbols-outlined text-xl">
                            {isDark ? 'light_mode' : 'dark_mode'}
                        </span>
                    </button>
                </div>
            </div>
        </aside>
    );
};
