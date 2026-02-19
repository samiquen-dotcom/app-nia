import React from 'react';
import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { useTheme } from '../context/ThemeContext';

export const Layout: React.FC = () => {
    const { isDark } = useTheme();

    return (
        <div className={isDark ? 'dark' : ''}>
            <div className="min-h-screen bg-background-light dark:bg-[#1a0d10] text-text-main dark:text-[#f5e8eb] flex flex-col items-center">
                {/* Main content container */}
                <div className="w-full max-w-7xl min-h-screen bg-white dark:bg-[#231218] shadow-xl relative pb-24 mx-auto">



                    <Outlet />
                    <BottomNav />
                </div>
            </div>
        </div>
    );
};
