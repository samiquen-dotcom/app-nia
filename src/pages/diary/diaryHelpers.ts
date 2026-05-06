import type { DiaryNote, NoteContext, PeriodData, MoodData, WellnessData } from '../../types';
import { calculatePhase, todayStr } from '../../utils/cycleLogic';

/**
 * Saca un snapshot del contexto actual de la usuaria desde period + mood + wellness.
 * Snapshot, no referencia viva: una entrada de ayer no cambia cuando cambia tu ánimo de hoy.
 */
export const buildCurrentContext = async (
    period: PeriodData | null,
    mood: MoodData | null,
    wellness: WellnessData | null,
): Promise<NoteContext> => {
    const today = todayStr();
    const ctx: NoteContext = {};

    // Fase del ciclo
    if (period?.cycleStartDate) {
        const phase = calculatePhase(
            period.cycleStartDate,
            period.cycleLength || 28,
            period.periodLength || 5,
        );
        if (phase) {
            ctx.cyclePhase = phase.name;
            ctx.cycleDay = phase.day;
        }

        // Energy del día
        const todayEntry = period.dailyEntries?.[today];
        if (todayEntry?.energy) ctx.energy = todayEntry.energy;
    }

    // Mood (la entrada más reciente, máx 24h)
    if (mood?.entries && mood.entries.length > 0) {
        const sorted = [...mood.entries].sort((a, b) => b.timestamp - a.timestamp);
        const latest = sorted[0];
        const ageMs = Date.now() - latest.timestamp;
        if (ageMs < 24 * 60 * 60 * 1000) {
            ctx.moodEmoji = latest.emoji;
            ctx.moodLabel = latest.mood;
        }
    }

    // Wellness — sleep
    if (wellness?.days) {
        const todayWell = wellness.days.find(d => d.date === today);
        if (todayWell?.sleepHours !== undefined) ctx.sleepHours = todayWell.sleepHours;
    }

    return ctx;
};

// Color por fase del ciclo (para la constellation y badges)
export const PHASE_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
    Menstrual: { bg: 'bg-rose-200/70', text: 'text-rose-700', ring: 'ring-rose-300' },
    Folicular: { bg: 'bg-pink-200/70', text: 'text-pink-700', ring: 'ring-pink-300' },
    'Ovulación': { bg: 'bg-purple-200/70', text: 'text-purple-700', ring: 'ring-purple-300' },
    'Lútea': { bg: 'bg-indigo-200/70', text: 'text-indigo-700', ring: 'ring-indigo-300' },
};

// Color por tipo de nota
export const TYPE_META: Record<DiaryNote['type'], { label: string; icon: string; color: string; accent: string }> = {
    thought: { label: 'Pensamiento',  icon: 'edit_note',     color: 'text-rose-500',    accent: 'bg-rose-100 dark:bg-rose-900/20' },
    voice:   { label: 'Voz',          icon: 'graphic_eq',    color: 'text-violet-500',  accent: 'bg-violet-100 dark:bg-violet-900/20' },
    letter:  { label: 'Carta',        icon: 'mail',          color: 'text-amber-500',   accent: 'bg-amber-100 dark:bg-amber-900/20' },
    poem:    { label: 'Poema',        icon: 'format_quote',  color: 'text-fuchsia-500', accent: 'bg-fuchsia-100 dark:bg-fuchsia-900/20' },
};

export const isUnlocked = (note: DiaryNote): boolean => {
    if (!note.isLocked) return true;
    if (!note.unlockDate) return true;
    return todayStr() >= note.unlockDate;
};

export const formatDate = (ts: number): string => {
    const d = new Date(ts);
    const now = new Date();
    const todayY = now.getFullYear(), todayM = now.getMonth(), todayD = now.getDate();
    if (d.getFullYear() === todayY && d.getMonth() === todayM && d.getDate() === todayD) {
        return 'Hoy ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate()) {
        return 'Ayer ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) + ' ' +
           d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
};

export const formatDuration = (ms: number): string => {
    const totalSec = Math.round(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
};

export const daysUntil = (dateISO: string): number => {
    const today = new Date(todayStr() + 'T00:00:00');
    const target = new Date(dateISO + 'T00:00:00');
    return Math.round((target.getTime() - today.getTime()) / 86_400_000);
};

// Markdown-light: bold **text**, italic *text*, lista "- item", cita "> texto"
export const renderLightMarkdown = (text: string): string => {
    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    return escaped
        .split('\n')
        .map(line => {
            if (line.trim().startsWith('&gt; ')) {
                return `<blockquote class="border-l-2 border-pink-300 pl-3 italic opacity-80">${line.replace(/^\s*&gt;\s?/, '')}</blockquote>`;
            }
            if (line.trim().startsWith('- ')) {
                return `<div class="pl-4 relative before:content-['•'] before:absolute before:left-1 before:text-pink-400">${line.replace(/^\s*-\s?/, '')}</div>`;
            }
            return line || '<br/>';
        })
        .join('\n')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
};
