

export type PhaseType = 'Menstrual' | 'Folicular' | 'Ovulación' | 'Lútea';

interface PhaseInfo {
    name: PhaseType;
    desc: string;
    day: number;
    color: string;
    bg: string;
    icon: string;
    gymAdvice: string;
}

export type EnergyLevel = 'ahorro' | 'poco' | 'estable' | 'impulso' | 'tope';

interface EnergyConfig {
    id: EnergyLevel;
    label: string;
    emoji: string;
    desc: string;
    gym: string;
    color: string;
}

// ─── 1. Configuration & Constants ─────────────────────────────────────────────

export const ENERGY_LEVELS: EnergyConfig[] = [
    {
        id: 'ahorro',
        label: 'Modo Ahorro',
        emoji: '🪫',
        desc: 'Agotamiento, neblina mental o dolor.',
        gym: 'Descanso total o estiramientos suaves.',
        color: 'text-slate-400'
    },
    {
        id: 'poco',
        label: 'Poco a Poco',
        emoji: '📉',
        desc: 'Pesadez, falta de motivación.',
        gym: 'Yoga, caminata o movilidad.',
        color: 'text-blue-400'
    },
    {
        id: 'estable',
        label: 'Estable',
        emoji: '🆗',
        desc: 'Funcional, normal.',
        gym: 'Rutina estándar (sin exigirse de más).',
        color: 'text-emerald-500'
    },
    {
        id: 'impulso',
        label: 'Con Impulso',
        emoji: '📈',
        desc: 'Buena energía, mente clara.',
        gym: 'Cardio o fuerza moderada.',
        color: 'text-orange-400'
    },
    {
        id: 'tope',
        label: 'A Tope / Power',
        emoji: '⚡',
        desc: 'Invencible, confianza alta.',
        gym: 'Récords personales (PR) o HIIT intenso.',
        color: 'text-yellow-500'
    }
];

// Helper to get today string YYYY-MM-DD
export const todayStr = () => new Date().toISOString().split('T')[0];

const diffDays = (from: string, to: string) => {
    const a = new Date(from + 'T00:00:00');
    const b = new Date(to + 'T00:00:00');
    return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
};

// ─── 2. Phase Calculation ─────────────────────────────────────────────────────

export const calculatePhase = (startDate: string, cycleLength: number, periodLength: number): PhaseInfo | null => {
    if (!startDate) return null;

    const today = todayStr();
    const diff = diffDays(startDate, today);

    // If future date or invalid
    if (diff < 0) return null;

    const day = (diff % cycleLength) + 1;
    let phase: PhaseType;
    let desc = '';
    let color = '';
    let bg = '';
    let icon = '';

    if (day <= periodLength) {
        phase = 'Menstrual';
        desc = `Día ${day}. Descansa y mímate.`;
        color = 'text-rose-500';
        bg = 'bg-rose-100';
        icon = '🩸';
    } else if (day <= 11) {
        phase = 'Folicular';
        desc = 'Energía subiendo 🚀. ¡A crear!';
        color = 'text-pink-500';
        bg = 'bg-pink-100';
        icon = '🌱';
    } else if (day <= 16) { // Assuming ovulation around day 14 +/- 2
        phase = 'Ovulación';
        desc = 'Estás radiante y magnética ✨.';
        color = 'text-purple-500';
        bg = 'bg-purple-100';
        icon = '🌸';
    } else {
        phase = 'Lútea';
        const daysLeft = cycleLength - day;
        desc = `Calma. Tu periodo llega en ~${daysLeft} días.`;
        color = 'text-indigo-400';
        bg = 'bg-indigo-50';
        icon = '🍂';
    }

    // Default gym advice based on phase (overridden by Energy Level later)
    let gym = '';
    switch (phase) {
        case 'Menstrual': gym = 'Yoga restaurativo o paseo ligero.'; break;
        case 'Folicular': gym = 'Cardio y fuerza progresiva.'; break;
        case 'Ovulación': gym = '¡Dalo todo! HIIT o fuerza máxima.'; break;
        case 'Lútea': gym = 'Fuerza moderada, baja intensidad al final.'; break;
    }

    return { name: phase, desc, day, color, bg, icon, gymAdvice: gym };
};

// ─── 3. Predictions ───────────────────────────────────────────────────────────

export const getPredictions = (startDate: string, cycleLength: number) => {
    if (!startDate) return { nextPeriod: null, fertileWindow: null };

    const today = new Date();
    const start = new Date(startDate + 'T00:00:00');

    // Calculate next period date
    // Find how many cycles represent the difference between start and now
    const daysSinceStart = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
    const cyclesPassed = Math.floor(daysSinceStart / cycleLength);

    // Next start is (cyclesPassed + 1) * length
    const nextStart = new Date(start);
    nextStart.setDate(start.getDate() + (cyclesPassed + 1) * cycleLength);

    // Fertile window is approx 14 days before NEXT period (length - 14) -> range [day - 4, day + 1]
    const ovulationDay = cycleLength - 14;
    const currentCycleStart = new Date(start);
    currentCycleStart.setDate(start.getDate() + cyclesPassed * cycleLength);

    const fertileStart = new Date(currentCycleStart);
    fertileStart.setDate(currentCycleStart.getDate() + ovulationDay - 4);

    const fertileEnd = new Date(currentCycleStart);
    fertileEnd.setDate(currentCycleStart.getDate() + ovulationDay + 1);

    return {
        nextPeriod: nextStart.toISOString().split('T')[0],
        fertileWindow: {
            start: fertileStart.toISOString().split('T')[0],
            end: fertileEnd.toISOString().split('T')[0]
        }
    };
};

// ─── 4. Smart Advice (Energy + Phase) ─────────────────────────────────────────

export const getSmartGymAdvice = (phase: PhaseType | null, energy: EnergyLevel | undefined) => {
    if (!energy) return phase ? calculatePhase(todayStr(), 28, 5)?.gymAdvice : 'Escucha a tu cuerpo.'; // Fallback

    const config = ENERGY_LEVELS.find(e => e.id === energy);
    return config?.gym || 'Movimiento libre.';
};
