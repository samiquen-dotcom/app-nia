import React from 'react';
import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { useTheme } from '../context/ThemeContext';

export const Layout: React.FC = () => {
    const { isDark, toggleTheme } = useTheme();

    return (
        <div className={isDark ? 'dark' : ''}>
            <div className="min-h-screen bg-background-light dark:bg-[#1a0d10] text-text-main dark:text-[#f5e8eb] flex flex-col items-center">
                {/* Main content container */}
                <div className="w-full max-w-7xl min-h-screen bg-white dark:bg-[#231218] shadow-xl relative pb-24 mx-auto">

                    {/* Dark mode toggle — fixed top-right */}
                    <button
                        onClick={toggleTheme}
                        className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full bg-white dark:bg-[#3a1e26] shadow-lg border border-slate-100 dark:border-slate-700 flex items-center justify-center transition-all hover:scale-110"
                        aria-label="Cambiar tema"
                    >
                        <span className="material-symbols-outlined text-lg text-slate-500 dark:text-yellow-300">
                            {isDark ? 'light_mode' : 'dark_mode'}
                        </span>
                    </button>

                    <Outlet />
                    <BottomNav />
                </div>
            </div>
        </div>
    );
};
