import React from 'react';

export interface ConfirmModalProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'primary';
    icon?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    open,
    title,
    message,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    variant = 'primary',
    icon,
    onConfirm,
    onCancel,
}) => {
    if (!open) return null;

    const variantStyles = variant === 'danger'
        ? 'from-rose-400 to-rose-500'
        : 'from-pink-400 to-rose-500';
    const iconBg = variant === 'danger' ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-500' : 'bg-pink-50 dark:bg-pink-900/30 text-pink-500';
    const defaultIcon = variant === 'danger' ? 'warning' : 'help';

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#2d1820] w-full max-w-sm rounded-3xl p-6 shadow-2xl">
                <div className="flex flex-col items-center text-center">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${iconBg}`}>
                        <span className="material-symbols-outlined text-3xl">{icon || defaultIcon}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">{title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 whitespace-pre-line">{message}</p>
                    <div className="flex gap-2 w-full">
                        <button
                            onClick={onCancel}
                            className="flex-1 py-3 rounded-xl font-bold text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`flex-1 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r ${variantStyles} hover:shadow-lg transition-all`}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
