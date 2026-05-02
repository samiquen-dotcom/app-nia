import { todayStr as _todayStr, diffDays as _diffDays } from './dateHelpers';
import type { DailyCycleEntry } from '../types';

export type PhaseType = 'Menstrual' | 'Folicular' | 'Ovulación' | 'Lútea';

export interface PhaseInfo {
    name: PhaseType;
    desc: string;
    day: number;
    cycleLength: number;       // Total length of the cycle (used by alerts to compute days-left)
    daysUntilNextPeriod: number; // Días que faltan para la próxima menstruación (0 si está activa)
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

// Re-export todayStr/diffDays desde dateHelpers para mantener compatibilidad con
// imports existentes (CycleWidget, PeriodScreen). Nuevo código debe importar
// directamente desde '../utils/dateHelpers'.
export const todayStr = _todayStr;
const diffDays = _diffDays;

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

    // Días hasta la próxima menstruación (0 si estamos en fase menstrual)
    const daysUntilNextPeriod = phase === 'Menstrual' ? 0 : Math.max(0, cycleLength - day);

    return { name: phase, desc, day, cycleLength, daysUntilNextPeriod, color, bg, icon, gymAdvice: gym };
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

    const toLocalDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    return {
        nextPeriod: toLocalDate(nextStart),
        fertileWindow: {
            start: toLocalDate(fertileStart),
            end: toLocalDate(fertileEnd)
        }
    };
};

// ─── 4. Smart Advice (Energy + Phase) ─────────────────────────────────────────

export const getSmartGymAdvice = (phase: PhaseType | null, energy: EnergyLevel | undefined) => {
    if (!energy) return phase ? calculatePhase(todayStr(), 28, 5)?.gymAdvice : 'Escucha a tu cuerpo.'; // Fallback

    const config = ENERGY_LEVELS.find(e => e.id === energy);
    return config?.gym || 'Movimiento libre.';
};

// ─── 5. Insights & Analytics ──────────────────────────────────────────────────

export const getCycleRegularity = (cycleLength: number): { status: 'regular' | 'varying' | 'irregular', label: string, color: string, desc: string } => {
    if (cycleLength >= 26 && cycleLength <= 30) {
        return { status: 'regular', label: 'Regular', color: 'text-emerald-500 bg-emerald-100', desc: 'Tus ciclos duran lo recomendado de 26-30 días.' };
    } else if (cycleLength >= 21 && cycleLength <= 35) {
        return { status: 'varying', label: 'Cambiando', color: 'text-amber-500 bg-amber-100', desc: 'Tus ciclos son algo cortos o largos, pero dentro de lo habitual.' };
    } else {
        return { status: 'irregular', label: 'Irregular', color: 'text-rose-500 bg-rose-100', desc: 'Tus ciclos varían bastante. Si notas molestias, consulta a tu doc.' };
    }
}

export const generateCycleInsights = (data: any): string[] => {
    const insights: string[] = [];

    // Insight 1: Duración del ciclo (Regularidad)
    if (data.cycleLength) {
        insights.push(`Tu ciclo dura en promedio ${data.cycleLength} días.`);
    }

    // Insight 2: Análisis de dolor y soluciones (mocked with real data logic)
    let totalCramps = 0;
    let heatHelped = 0;
    let medsHelped = 0;
    let exerciseHelped = 0;
    const entries = Object.values(data.dailyEntries || {});

    entries.forEach((entry: any) => {
        if (entry.symptoms?.includes('colicos') || entry.painLevel && entry.painLevel >= 5) {
            totalCramps++;
        }
        if (entry.reliefMethods?.includes('calor')) heatHelped++;
        if (entry.reliefMethods?.includes('medicina')) medsHelped++;
        if (entry.reliefMethods?.includes('ejercicio')) exerciseHelped++;
    });

    if (totalCramps >= 1) {
        insights.push(`Tus cólicos suelen aparecer en la fase menstrual inicial.`);
        const best = Math.max(heatHelped, medsHelped, exerciseHelped);
        if (best > 0) {
            if (best === heatHelped) insights.push(`El calor te ayuda en la mayoría de las veces a aliviar tu dolor.`);
            else if (best === medsHelped) insights.push(`Los medicamentos son tu solución más efectiva reportada.`);
            else insights.push(`El ejercicio suave te ha ayudado a sentirte mejor.`);
        }
    }

    // Default insight if none
    if (insights.length === 1) {
        insights.push(`Registra tus síntomas diariamente para descubrir patrones de tu cuerpo ✨.`);
    }

    return insights;
}

export const getPredictiveAlert = (phase: PhaseInfo | null): string | null => {
    if (!phase) return null;

    switch (phase.name) {
        case 'Menstrual':
            if (phase.day === 1) return "Día 1: tu cuerpo está soltando. Calor, descanso y mucha agua 💧.";
            if (phase.day === 2) return "Hoy podrías retener líquidos y tener baja energía. ¡Consiéntete! ☕";
            if (phase.day === 3) return "El flujo suele bajar. Si te sientes mejor, una caminata corta ayuda 🚶‍♀️.";
            return "Tu cuerpo se está limpiando y renovando poco a poco. Mantente hidratada 💧.";
        case 'Folicular':
            if (phase.day <= 7) return "Tu energía empieza a despertar. Buen momento para planear la semana 🌱.";
            if (phase.day >= 8 && phase.day <= 10) return "Semana ideal para entrenamientos intensos 💪.";
            return "¡Tu energía y creatividad están en su punto! Sácale jugo 🚀";
        case 'Ovulación':
            if (phase.day <= 14) return "Pico hormonal: te sientes magnética. Habla, presenta, conecta ✨.";
            return "Estás radiante. Hoy es un día perfecto para socializar o pedir lo que quieres ✨.";
        case 'Lútea': {
            // Usar daysUntilNextPeriod en vez de parsear el desc (anti-frágil)
            if (phase.daysUntilNextPeriod <= 3) {
                return "Posible día de mayor sensibilidad emocional o antojos físicos 🍫.";
            }
            if (phase.daysUntilNextPeriod <= 7) {
                return "Tu energía comienza a bajar. Prioriza tareas mentales sobre físicas 🍂.";
            }
            return "Fase calmada. Buen momento para terminar pendientes y organizar 📋.";
        }
        default:
            return null;
    }
}

// ─── 6. Enhanced Body Alert (Phase + Daily Entry) ─────────────────────────────
// Combina la fase del ciclo con los datos que la usuaria registró HOY (energía,
// dolor, síntomas) para dar una recomendación más concreta. Si no hay entry
// del día, devuelve el alert básico de la fase.

const ENERGY_BODY_HINT: Record<EnergyLevel, string> = {
    ahorro:  'Hoy registraste energía baja. Permítete bajar el ritmo: agua, calor y descanso 🪫.',
    poco:    'Energía algo apagada hoy. Movimiento suave, no exigirte 📉.',
    estable: 'Energía estable. Mantén el ritmo, sin sobreexigirte 🆗.',
    impulso: '¡Vas con buena energía! Aprovecha para entrenar o avanzar pendientes 📈.',
    tope:    'Estás a tope hoy. Día perfecto para retos físicos o mentales ⚡.',
};

export interface EnhancedBodyAlert {
    headline: string;          // Texto principal corto
    detail?: string;           // Detalle/sub-texto opcional
    severity: 'info' | 'care' | 'energy'; // Para colorear el card
    source: 'phase' | 'entry' | 'combined' | 'fallback';
}

export const getEnhancedBodyAlert = (
    phase: PhaseInfo | null,
    todayEntry: DailyCycleEntry | null | undefined,
): EnhancedBodyAlert | null => {
    // Sin fase calculada: damos un fallback genérico solo si tampoco hay entry
    if (!phase && !todayEntry) {
        return {
            headline: 'Registra tu ciclo para recibir insights diarios 🌸',
            detail: 'Toca aquí para empezar a hacer seguimiento.',
            severity: 'info',
            source: 'fallback',
        };
    }

    // Señales del día con prioridad alta: dolor fuerte → recomendación de cuidado
    if (todayEntry?.painLevel && todayEntry.painLevel >= 6) {
        return {
            headline: 'Hoy registraste dolor fuerte. Calor + descanso 🛌',
            detail: phase ? `Estás en fase ${phase.name.toLowerCase()}. Si el dolor persiste varios ciclos, conviene consultar.` : undefined,
            severity: 'care',
            source: todayEntry ? 'combined' : 'entry',
        };
    }

    // Combinar fase + energía registrada
    if (phase && todayEntry?.energy) {
        const energyHint = ENERGY_BODY_HINT[todayEntry.energy];
        const phaseAlert = getPredictiveAlert(phase);
        return {
            headline: energyHint,
            detail: phaseAlert ?? undefined,
            severity: todayEntry.energy === 'ahorro' || todayEntry.energy === 'poco' ? 'care' : 'energy',
            source: 'combined',
        };
    }

    // Síntomas notables sin energía explícita
    if (phase && todayEntry?.symptoms && todayEntry.symptoms.length > 0) {
        const phaseAlert = getPredictiveAlert(phase);
        return {
            headline: `Registraste ${todayEntry.symptoms.length === 1 ? '1 síntoma' : `${todayEntry.symptoms.length} síntomas`} hoy. Escucha a tu cuerpo 💕`,
            detail: phaseAlert ?? undefined,
            severity: 'care',
            source: 'combined',
        };
    }

    // Fallback: alerta básica de la fase
    if (phase) {
        const alert = getPredictiveAlert(phase);
        if (!alert) return null;
        return {
            headline: alert,
            detail: undefined,
            severity: phase.name === 'Menstrual' || phase.name === 'Lútea' ? 'care' : 'energy',
            source: 'phase',
        };
    }

    return null;
};

// ─── 7. Phase-aware Affirmations ──────────────────────────────────────────────
// 5 afirmaciones por fase + 5 genéricas. Total: 25. Se elige una según la fecha
// para que sea estable durante el día pero rote.

const AFFIRMATIONS_BY_PHASE: Record<PhaseType, string[]> = {
    Menstrual: [
        '"Honro mi cuerpo y le doy el descanso que merece." 🩸',
        '"Soltar también es avanzar." 🌙',
        '"Mi sensibilidad es mi superpoder." 💕',
        '"Cuidarme es prioridad, no lujo." 🛁',
        '"Cada ciclo soy una versión más sabia de mí." 🌸',
    ],
    Folicular: [
        '"Mi energía está despertando y la canalizo en lo que amo." 🌱',
        '"Soy creadora, hoy planto semillas que crecerán." ✨',
        '"Tengo claridad para decidir lo que es bueno para mí." 💫',
        '"Estoy lista para empezar de nuevo, con más sabiduría." 🚀',
        '"Mi mente y mi cuerpo se están alineando." 🌿',
    ],
    Ovulación: [
        '"Soy magnética, brillo desde adentro." ✨',
        '"Hoy mi voz se escucha clara y segura." 🎤',
        '"Atraigo lo que merezco con facilidad." 💖',
        '"Soy capaz de lograr todo lo que me propongo." 💪',
        '"Mi confianza inspira a quienes me rodean." 🌟',
    ],
    Lútea: [
        '"Bajar el ritmo también es avanzar." 🍂',
        '"Confío en mi intuición más que nunca." 🔮',
        '"Termino con calma lo que empecé con fuego." 📋',
        '"Mis emociones son mensajes, no enemigos." 💕',
        '"Me cuido con la misma ternura que cuido a otros." 🌷',
    ],
};

const GENERIC_AFFIRMATIONS = [
    '"Soy capaz de lograr todo lo que me propongo con amor y paciencia." 🌸',
    '"Cada día soy más fuerte, más segura y más brillante." ✨',
    '"Mi bienestar es mi prioridad y lo cuido con cariño." 💕',
    '"Elijo la paz y el crecimiento en cada momento de mi día." 🌿',
    '"Soy suficiente, soy capaz, soy Nia." 💪',
];

export const getDailyAffirmation = (phase: PhaseInfo | null): string => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000);
    if (phase) {
        const list = AFFIRMATIONS_BY_PHASE[phase.name];
        return list[dayOfYear % list.length];
    }
    return GENERIC_AFFIRMATIONS[dayOfYear % GENERIC_AFFIRMATIONS.length];
};
