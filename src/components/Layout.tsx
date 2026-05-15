import React from 'react';
import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { WhatsNewModal } from './WhatsNewModal';
import { useTheme } from '../context/ThemeContext';

export const Layout: React.FC = () => {
    const { isDark } = useTheme();

    return (
        <div className={isDark ? 'dark' : ''}>
            <div className="min-h-screen bg-background-light dark:bg-[#1a0d10] text-text-main dark:text-[#f5e8eb]">
                {/* Sidebar (solo desktop) */}
                <Sidebar />

                {/* Main content */}
                <div className="lg:pl-64 min-h-screen">
                    <div className="bg-white dark:bg-[#231218] shadow-xl lg:shadow-none min-h-screen relative pb-24 lg:pb-12 mx-auto max-w-7xl lg:max-w-none">
                        <Outlet />
                        <BottomNav />
                    </div>
                </div>
            </div>

            {/* Onboarding / What's New (montado a nivel del Layout para todas las rutas autenticadas) */}
            <WhatsNewModal />
        </div>
    );
};
