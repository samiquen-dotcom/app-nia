import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const navItems = [
    { path: '/home', icon: 'home', label: 'Home' },
    { path: '/finance', icon: 'account_balance_wallet', label: 'Finanzas' },
    { path: '/period', icon: 'female', label: 'Ciclo' },
    { path: '/gym', icon: 'fitness_center', label: 'Gym' },
    { path: '/food', icon: 'nutrition', label: 'Comidas' },
    { path: '/wellness', icon: 'self_improvement', label: 'Bienestar' },
    { path: '/goals', icon: 'stars', label: 'Metas' },
];

export const BottomNav: React.FC = () => {
    const location = useLocation();

    // Don't show nav on login screen
    if (location.pathname === '/') return null;

    return (
        <div className="fixed bottom-0 left-0 w-full px-4 pb-6 pt-4 bg-gradient-to-t from-white via-white to-transparent z-50 pointer-events-none">
            <nav className="pointer-events-auto bg-white/90 backdrop-blur-md rounded-full shadow-2xl border border-primary/20 p-2 flex justify-center items-center gap-2 max-w-fit mx-auto overflow-x-auto custom-scrollbar">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `
              flex flex-col items-center justify-center w-14 h-14 transition-all duration-300 rounded-full
              ${isActive ? 'text-primary bg-secondary/30 scale-110 shadow-sm' : 'text-accent hover:text-primary hover:bg-slate-50'}
            `}
                    >
                        <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                        {/* <span className="text-[9px] font-bold mt-1">{item.label}</span> */}
                    </NavLink>
                ))}
            </nav>
        </div>
    );
};
