import React, { useEffect, useState } from 'react';

// Versión del onboarding. Bumpear cuando haya nuevas novedades para forzar reaparición.
// v2: unificación del registro de mood con el cuestionario diario del ciclo.
const WHATS_NEW_VERSION = 'v2';
const STORAGE_KEY = `nia_whats_new_seen_${WHATS_NEW_VERSION}`;

// Evento para reabrirlo desde otras pantallas (Profile)
export const SHOW_WHATS_NEW_EVENT = 'nia:show-whats-new';

interface Slide {
    emoji: string;          // Emoji grande hero del slide
    badge: string;          // Tag de la pantalla afectada (ej: "Inicio")
    badgeColor: string;     // Tailwind classes para el badge
    title: string;
    bullets: { icon: string; text: string }[]; // Lista de mejoras del slide
    accentClass: string;    // Color del header del slide
    bgClass: string;        // Fondo del slide
}

const SLIDES: Slide[] = [
    {
        emoji: '🌸',
        badge: 'Bienvenida',
        badgeColor: 'bg-pink-100 text-pink-500',
        title: '¡Tu Nia tiene novedades!',
        bullets: [
            { icon: '✨', text: 'Mejoramos el Inicio con insights personalizados.' },
            { icon: '💆‍♀️', text: 'Bienestar ahora trackea sueño, mood y hábitos.' },
            { icon: '🎯', text: 'Las cards muestran tu progreso real, no solo números.' },
        ],
        accentClass: 'text-pink-500',
        bgClass: 'from-pink-50 to-rose-50 dark:from-[#3a2028] dark:to-[#2d1820]',
    },
    {
        emoji: '🏠',
        badge: 'Inicio',
        badgeColor: 'bg-indigo-100 text-indigo-500',
        title: 'Tu Cuerpo Hoy ahora es personalizado',
        bullets: [
            { icon: '✦', text: 'Combina la fase de tu ciclo con la energía y síntomas que registraste hoy.' },
            { icon: '👆', text: 'Toca la card y te lleva a Periodo para ver más.' },
            { icon: '🍎', text: 'La card de Calorías muestra tu meta y barra de progreso.' },
            { icon: '💸', text: 'La card de Gastos muestra promedio diario y proyección del mes.' },
        ],
        accentClass: 'text-indigo-500',
        bgClass: 'from-indigo-50 to-purple-50 dark:from-[#2a2035] dark:to-[#332038]',
    },
    {
        emoji: '🌙',
        badge: 'Bienestar',
        badgeColor: 'bg-violet-100 text-violet-500',
        title: 'Tu día de hoy y sueño en un toque',
        bullets: [
            { icon: '📝', text: 'Card "Tu día de hoy" — abre el cuestionario diario donde registras mood, sangrado, energía y síntomas en un solo lugar.' },
            { icon: '🛌', text: 'Sueño anoche: chips rápidos de 5h a 10h con feedback de calidad.' },
            { icon: '🩸', text: 'Tip dinámico arriba según la fase de tu ciclo.' },
            { icon: '📊', text: 'Mira la tendencia de últimos 7 días en agua, sueño y mood.' },
        ],
        accentClass: 'text-violet-500',
        bgClass: 'from-violet-50 to-pink-50 dark:from-[#2a1f35] dark:to-[#3a2028]',
    },
    {
        emoji: '🔥',
        badge: 'Bienestar',
        badgeColor: 'bg-teal-100 text-teal-500',
        title: 'Hábitos editables y respiración real',
        bullets: [
            { icon: '✏️', text: 'Toca "Editar" para agregar tus propios hábitos con emoji.' },
            { icon: '🔥', text: 'Cada hábito muestra los días seguidos que llevas.' },
            { icon: '🌿', text: 'La respiración guiada usa el patrón 4-7-8 con animación real.' },
            { icon: '⏱️', text: 'Elige duración del timer (3, 5, 10, 15 o 25 min) y se guarda historial.' },
        ],
        accentClass: 'text-teal-500',
        bgClass: 'from-teal-50 to-cyan-50 dark:from-[#0d2b2b] dark:to-[#0a2233]',
    },
    {
        emoji: '🚀',
        badge: '¡Lista!',
        badgeColor: 'bg-emerald-100 text-emerald-500',
        title: '¡A disfrutar tu Nia renovada!',
        bullets: [
            { icon: '👆', text: 'Casi todas las cards del Inicio ahora son tappeables.' },
            { icon: '⚙️', text: 'Puedes volver a ver este tutorial desde Perfil → Ver novedades.' },
            { icon: '💕', text: 'Cualquier idea, dile a Claude que la añada — sigue mejorando contigo.' },
        ],
        accentClass: 'text-emerald-500',
        bgClass: 'from-emerald-50 to-teal-50 dark:from-[#0d2b1f] dark:to-[#0a2233]',
    },
];

export const WhatsNewModal: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState(0);

    // Auto-show la primera vez. También escucha el evento para reabrirlo.
    useEffect(() => {
        const seen = typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true';
        if (!seen) {
            // Pequeño delay para que la app cargue antes
            const t = setTimeout(() => setIsOpen(true), 600);
            return () => clearTimeout(t);
        }
    }, []);

    useEffect(() => {
        const handler = () => {
            setStep(0);
            setIsOpen(true);
        };
        window.addEventListener(SHOW_WHATS_NEW_EVENT, handler);
        return () => window.removeEventListener(SHOW_WHATS_NEW_EVENT, handler);
    }, []);

    const close = () => {
        try { localStorage.setItem(STORAGE_KEY, 'true'); } catch {}
        setIsOpen(false);
        // Reset al cerrar para que la próxima vez abra desde el principio
        setTimeout(() => setStep(0), 300);
    };

    const next = () => {
        if (step < SLIDES.length - 1) setStep(s => s + 1);
        else close();
    };

    const back = () => {
        if (step > 0) setStep(s => s - 1);
    };

    if (!isOpen) return null;

    const slide = SLIDES[step];
    const isLast = step === SLIDES.length - 1;
    const isFirst = step === 0;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={close}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-[#231218] w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">

                {/* Header con dots y close */}
                <div className="flex items-center justify-between px-5 pt-5 pb-2">
                    <div className="flex gap-1.5">
                        {SLIDES.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setStep(i)}
                                className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-pink-400' : 'w-1.5 bg-slate-300 dark:bg-slate-600'}`}
                                aria-label={`Slide ${i + 1}`}
                            />
                        ))}
                    </div>
                    <button
                        onClick={close}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                        aria-label="Cerrar"
                    >
                        <span className="material-symbols-outlined text-base">close</span>
                    </button>
                </div>

                {/* Slide content */}
                <div className={`bg-gradient-to-br ${slide.bgClass} px-6 py-8 flex flex-col items-center text-center relative overflow-hidden flex-1 overflow-y-auto`}>
                    {/* Decorative blob */}
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/40 dark:bg-white/5 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-white/30 dark:bg-white/5 rounded-full blur-3xl pointer-events-none" />

                    {/* Badge */}
                    <span className={`relative z-10 inline-block px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase ${slide.badgeColor} mb-4`}>
                        {slide.badge}
                    </span>

                    {/* Hero emoji */}
                    <div className="relative z-10 text-7xl mb-3 drop-shadow-sm">{slide.emoji}</div>

                    {/* Title */}
                    <h2 className={`relative z-10 text-xl font-extrabold ${slide.accentClass} dark:text-slate-100 mb-5 leading-tight px-2`}>
                        {slide.title}
                    </h2>

                    {/* Bullets */}
                    <div className="relative z-10 w-full space-y-2.5">
                        {slide.bullets.map((b, i) => (
                            <div
                                key={i}
                                className="bg-white/70 dark:bg-black/20 backdrop-blur-sm rounded-2xl p-3 flex items-start gap-3 text-left border border-white/60 dark:border-white/5"
                            >
                                <span className="text-lg flex-shrink-0 leading-none mt-0.5">{b.icon}</span>
                                <p className="text-xs text-slate-700 dark:text-slate-200 leading-snug font-medium">{b.text}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer con botones */}
                <div className="px-5 py-4 flex items-center gap-3 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-[#231218]">
                    {!isFirst ? (
                        <button
                            onClick={back}
                            className="px-5 py-2.5 rounded-2xl font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-sm"
                        >
                            Atrás
                        </button>
                    ) : (
                        <button
                            onClick={close}
                            className="px-5 py-2.5 rounded-2xl font-bold text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-sm"
                        >
                            Saltar
                        </button>
                    )}

                    <span className="flex-1 text-center text-[10px] font-bold text-slate-400">
                        {step + 1} / {SLIDES.length}
                    </span>

                    <button
                        onClick={next}
                        className="px-5 py-2.5 rounded-2xl font-bold text-white bg-gradient-to-r from-pink-400 to-rose-500 shadow-md shadow-pink-200 dark:shadow-none hover:scale-[1.03] active:scale-95 transition-transform text-sm"
                    >
                        {isLast ? '¡Empezar! 🚀' : 'Siguiente'}
                    </button>
                </div>
            </div>
        </div>
    );
};

/** Helper para reabrir el modal desde otras pantallas. */
export const triggerWhatsNew = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    window.dispatchEvent(new CustomEvent(SHOW_WHATS_NEW_EVENT));
};
