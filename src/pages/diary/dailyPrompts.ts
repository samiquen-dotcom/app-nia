// Curated prompts (sin APIs externas). Se eligen por fase del ciclo + día del año
// para que el prompt sea estable durante el día pero rote.

import type { PhaseType } from '../../utils/cycleLogic';

const PROMPTS_BY_PHASE: Record<PhaseType, string[]> = {
    Menstrual: [
        '¿Qué necesita tu cuerpo hoy que no le estás dando?',
        'Si te dieras permiso de descansar sin culpa, ¿qué harías esta tarde?',
        'Escribe una despedida a algo que estás soltando este ciclo.',
        '¿Qué emoción está pidiendo salir hoy? Déjala en el papel.',
        'Tres cosas que tu cuerpo te enseñó esta semana.',
    ],
    Folicular: [
        '¿Qué idea está empezando a brotar y todavía no le has prestado atención?',
        'Si esta semana fuera el primer capítulo de algo, ¿de qué sería?',
        'Escribe una carta a quien serás dentro de 30 días.',
        '¿Qué te dio energía ayer? ¿Cómo lo repites hoy?',
        'Una decisión que vas a tomar esta semana, sin pedirle permiso a nadie.',
    ],
    'Ovulación': [
        'Hoy tu voz se escucha más clara. ¿Qué quieres decir, y a quién?',
        'Si tuvieras que pedir algo grande hoy, ¿qué sería?',
        'Tres cualidades tuyas que el mundo necesita ver más.',
        '¿Qué conversación llevas posponiendo?',
        'Una versión de ti que estás lista para mostrar.',
    ],
    'Lútea': [
        'Algo que terminaste pero todavía no celebraste.',
        '¿Qué pendiente te está robando energía solo por seguir abierto?',
        'Escribe sin filtro lo que te tiene incómoda. No para resolverlo, solo para verlo.',
        'Tres cosas que vas a soltar antes de que llegue tu próxima menstruación.',
        '¿Qué te diría tu intuición si la dejaras hablar 5 minutos?',
    ],
};

const GENERIC_PROMPTS = [
    'Empieza con la primera frase que se te venga a la mente. No la edites.',
    '¿Qué pensaste hoy que no te atreviste a decir en voz alta?',
    'Tres detalles del día que casi se te olvidan.',
    'Una cosa que te hizo sentir tú hoy.',
    '¿Qué notaste de tu cuerpo en las últimas 24 horas?',
    'Si pudieras mandarte un mensaje hace un año, ¿qué dirías?',
    'Una pregunta que estás cargando sin respuesta.',
];

export const getDailyPrompt = (phase: PhaseType | null, sleepHours?: number, energy?: string): string => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000);

    // Caso especial: dormiste poco
    if (sleepHours !== undefined && sleepHours < 6) {
        return 'Dormiste poco. Antes de cualquier cosa: ¿qué te tiene activa de noche?';
    }
    // Caso especial: energía baja
    if (energy === 'ahorro' || energy === 'poco') {
        return 'Hoy tu energía está baja. ¿Qué necesita tu cuerpo y qué necesita tu mente, por separado?';
    }
    if (energy === 'tope') {
        return 'Tu energía está al tope. ¿En qué la quieres invertir hoy, antes de que se vaya?';
    }

    if (phase) {
        const list = PROMPTS_BY_PHASE[phase];
        return list[dayOfYear % list.length];
    }
    return GENERIC_PROMPTS[dayOfYear % GENERIC_PROMPTS.length];
};

// Plantillas para "Carta para mí" — ya pre-llenadas con contexto del momento.
export const buildSelfLetterTemplate = (ctx: {
    phase?: string;
    moodLabel?: string;
    energy?: string;
}): string => {
    const lines: string[] = [];
    lines.push('Hoy, ' + new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) + ',');
    lines.push('');
    if (ctx.phase) lines.push(`Estoy en mi fase ${ctx.phase.toLowerCase()}.`);
    if (ctx.moodLabel) lines.push(`Hoy me siento: ${ctx.moodLabel}.`);
    if (ctx.energy) lines.push(`Mi energía está en: ${ctx.energy}.`);
    lines.push('');
    lines.push('Esto es lo que quiero que recuerdes cuando abras esta carta:');
    lines.push('');
    lines.push('');
    lines.push('Tres cosas que estoy aprendiendo:');
    lines.push('1. ');
    lines.push('2. ');
    lines.push('3. ');
    lines.push('');
    lines.push('Algo de lo que estoy orgullosa hoy:');
    lines.push('');
    lines.push('');
    lines.push('Con cariño,');
    lines.push('Yo');
    return lines.join('\n');
};

// Sílabas en español: heurística simple. Cuenta grupos vocálicos por palabra.
// No es perfecta (ignora hiatos/diptongos) pero sirve como guía para letras/poesía.
const VOWELS = 'aeiouáéíóúüAEIOUÁÉÍÓÚÜ';
export const countSyllables = (line: string): number => {
    if (!line.trim()) return 0;
    let total = 0;
    for (const word of line.trim().split(/\s+/)) {
        let count = 0;
        let inGroup = false;
        for (const ch of word) {
            const isVowel = VOWELS.includes(ch);
            if (isVowel && !inGroup) { count++; inGroup = true; }
            else if (!isVowel) { inGroup = false; }
        }
        total += Math.max(1, count);
    }
    return total;
};
