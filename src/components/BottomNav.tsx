import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const mainNavs = [
    { path: '/home', icon: 'home', label: 'Home' },
    { path: '/finance', icon: 'account_balance_wallet', label: 'Finanzas' },
    { path: '/period', icon: 'female', label: 'Ciclo' },
];

const moreNavs = [
    { path: '/gym', icon: 'fitness_center', label: 'Gym' },
    { path: '/food', icon: 'nutrition', label: 'Comidas' },
    { path: '/wellness', icon: 'self_improvement', label: 'Bienestar' },
    { path: '/goals', icon: 'stars', label: 'Metas' },
];

export const BottomNav: React.FC = () => {
    const location = useLocation();
    const [showMore, setShowMore] = React.useState(false);

    // Don't show nav on login screen
    if (location.pathname === '/') return null;

    // Hide more menu when route changes
    React.useEffect(() => {
        setShowMore(false);
    }, [location.pathname]);

    return (
        <div className="fixed bottom-0 left-0 w-full px-4 pb-6 pt-4 bg-gradient-to-t from-white via-white to-transparent dark:from-[#1a0d10] dark:via-[#1a0d10]/80 z-50 pointer-events-none">

            {showMore && (
                <div className="pointer-events-auto absolute bottom-24 right-1/2 translate-x-1/2 sm:translate-x-0 sm:right-6 bg-white dark:bg-[#231218] p-3 rounded-2xl shadow-xl border border-slate-100 dark:border-[#5a2b35]/30 grid grid-cols-4 gap-2 animate-in slide-in-from-bottom-5">
                    {moreNavs.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => setShowMore(false)}
                            className={({ isActive }) => `
                                flex flex-col items-center justify-center p-3 transition-all duration-300 rounded-2xl
                                ${isActive ? 'text-primary bg-secondary/30 scale-105 shadow-sm' : 'text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-[#3a2028]'}
                            `}
                        >
                            <span className="material-symbols-outlined text-2xl mb-1">{item.icon}</span>
                            <span className="text-[9px] font-bold">{item.label}</span>
                        </NavLink>
                    ))}
                </div>
            )}

            <nav className="pointer-events-auto bg-white/90 dark:bg-[#231218]/90 backdrop-blur-md rounded-full shadow-2xl border border-primary/20 p-2 flex justify-center items-center gap-2 max-w-fit mx-auto relative">
                {mainNavs.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `
                            flex flex-col items-center justify-center w-14 h-14 transition-all duration-300 rounded-full
                            ${isActive ? 'text-primary bg-secondary/30 scale-110 shadow-sm' : 'text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-[#3a2028]'}
                        `}
                    >
                        <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                    </NavLink>
                ))}

                {/* More Button */}
                <button
                    onClick={() => setShowMore(!showMore)}
                    className={`
                        flex flex-col items-center justify-center w-14 h-14 transition-all duration-300 rounded-full
                        ${showMore || moreNavs.some(n => n.path === location.pathname) ? 'text-primary bg-secondary/30 scale-110 shadow-sm' : 'text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-[#3a2028]'}
                    `}
                >
                    <span className="material-symbols-outlined text-2xl">grid_view</span>
                </button>
            </nav>
        </div>
    );
};
