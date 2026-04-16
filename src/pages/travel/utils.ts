import type {
    TripStatus,
    TripType,
    TripColor,
    PackingItem,
    ActivityType,
    ReservationType,
    ChecklistCategory,
    Trip,
    TravelExpense,
} from '../../types';
import { DEFAULT_RATES_TO_COP, getCurrencyMeta } from './countries';

export const STATUS_CONFIG: Record<TripStatus, { label: string; color: string; bg: string; icon: string }> = {
    planned: { label: 'Planificado', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30', icon: 'event' },
    active: { label: 'En curso', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', icon: 'flight_takeoff' },
    completed: { label: 'Completado', color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-700/30', icon: 'check_circle' },
    cancelled: { label: 'Cancelado', color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-900/30', icon: 'cancel' },
};

export const TYPE_CONFIG: Record<TripType, { label: string; icon: string }> = {
    beach: { label: 'Playa', icon: 'beach_access' },
    mountain: { label: 'Montaña', icon: 'landscape' },
    city: { label: 'Ciudad', icon: 'location_city' },
    business: { label: 'Negocios', icon: 'work' },
    rural: { label: 'Rural', icon: 'grass' },
    international: { label: 'Internacional', icon: 'public' },
    other: { label: 'Otro', icon: 'travel_explore' },
};

export const TRIP_COLOR_CONFIG: Record<TripColor, { label: string; gradient: string; accent: string; bg: string }> = {
    pink: { label: 'Rosa', gradient: 'from-pink-400 via-rose-400 to-pink-500', accent: 'text-pink-400', bg: 'bg-pink-50 dark:bg-pink-900/20' },
    blue: { label: 'Azul', gradient: 'from-blue-400 via-cyan-400 to-blue-500', accent: 'text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    green: { label: 'Verde', gradient: 'from-green-400 via-emerald-400 to-green-500', accent: 'text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
    purple: { label: 'Púrpura', gradient: 'from-purple-400 via-fuchsia-400 to-purple-500', accent: 'text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    orange: { label: 'Naranja', gradient: 'from-orange-400 via-amber-400 to-orange-500', accent: 'text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
    teal: { label: 'Turquesa', gradient: 'from-teal-400 via-cyan-400 to-teal-500', accent: 'text-teal-400', bg: 'bg-teal-50 dark:bg-teal-900/20' },
    indigo: { label: 'Índigo', gradient: 'from-indigo-400 via-violet-400 to-indigo-500', accent: 'text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
    rose: { label: 'Rosado', gradient: 'from-rose-400 via-pink-400 to-rose-500', accent: 'text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/20' },
};

export const ACTIVITY_TYPE_CONFIG: Record<ActivityType, { label: string; icon: string; color: string }> = {
    food: { label: 'Comida', icon: 'restaurant', color: 'text-orange-500' },
    tour: { label: 'Tour', icon: 'tour', color: 'text-green-500' },
    transport: { label: 'Traslado', icon: 'directions_bus', color: 'text-blue-500' },
    rest: { label: 'Descanso', icon: 'hotel', color: 'text-purple-500' },
    meeting: { label: 'Reunión', icon: 'groups', color: 'text-indigo-500' },
    shopping: { label: 'Compras', icon: 'shopping_bag', color: 'text-pink-500' },
    event: { label: 'Evento', icon: 'celebration', color: 'text-rose-500' },
    other: { label: 'Otro', icon: 'event', color: 'text-slate-500' },
};

export const RESERVATION_TYPE_CONFIG: Record<ReservationType, { label: string; icon: string; color: string; gradient: string }> = {
    flight: { label: 'Vuelo', icon: 'flight', color: 'text-blue-500', gradient: 'from-blue-400 to-cyan-500' },
    hotel: { label: 'Hotel', icon: 'hotel', color: 'text-purple-500', gradient: 'from-purple-400 to-fuchsia-500' },
    car: { label: 'Auto', icon: 'directions_car', color: 'text-green-500', gradient: 'from-green-400 to-emerald-500' },
    transfer: { label: 'Traslado', icon: 'directions_bus', color: 'text-indigo-500', gradient: 'from-indigo-400 to-blue-500' },
    tour: { label: 'Tour', icon: 'tour', color: 'text-orange-500', gradient: 'from-orange-400 to-amber-500' },
    restaurant: { label: 'Restaurante', icon: 'restaurant', color: 'text-rose-500', gradient: 'from-rose-400 to-pink-500' },
    event: { label: 'Evento', icon: 'celebration', color: 'text-pink-500', gradient: 'from-pink-400 to-rose-500' },
    insurance: { label: 'Seguro', icon: 'shield', color: 'text-teal-500', gradient: 'from-teal-400 to-cyan-500' },
    other: { label: 'Otro', icon: 'bookmark', color: 'text-slate-500', gradient: 'from-slate-400 to-slate-500' },
};

export const DEFAULT_CHECKLIST_CATEGORIES: ChecklistCategory[] = [
    { key: 'booking', label: 'Reservas', icon: 'hotel', color: 'text-purple-500' },
    { key: 'documents', label: 'Documentos', icon: 'badge', color: 'text-blue-500' },
    { key: 'health', label: 'Salud', icon: 'medical_services', color: 'text-red-500' },
    { key: 'transport', label: 'Transporte', icon: 'directions_car', color: 'text-green-500' },
    { key: 'communication', label: 'Comunicación', icon: 'phone', color: 'text-orange-500' },
    { key: 'finances', label: 'Finanzas', icon: 'account_balance', color: 'text-teal-500' },
    { key: 'home', label: 'Casa', icon: 'home', color: 'text-indigo-500' },
    { key: 'other', label: 'Otros', icon: 'more_horiz', color: 'text-slate-500' },
];

export const PACKING_PRIORITY_CONFIG = {
    essential: { label: 'Esencial', color: 'text-rose-500', bg: 'bg-rose-100 dark:bg-rose-900/30', dot: 'bg-rose-500' },
    recommended: { label: 'Recomendado', color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30', dot: 'bg-amber-500' },
    optional: { label: 'Opcional', color: 'text-slate-400', bg: 'bg-slate-100 dark:bg-slate-700/30', dot: 'bg-slate-400' },
};

/** Generates a cryptographically-safe random ID */
export function generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `id_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export function formatDate(dateISO: string): string {
    const date = new Date(dateISO + 'T00:00:00');
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export function formatDateLong(dateISO: string): string {
    const date = new Date(dateISO + 'T00:00:00');
    return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** Formatea cantidad con la moneda dada (símbolo + número con separadores) */
export function formatCurrency(amount: number, currency?: string): string {
    const meta = getCurrencyMeta(currency);
    const rounded = Math.round(amount * 100) / 100;
    const display = rounded % 1 === 0
        ? rounded.toLocaleString('es-CO')
        : rounded.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${meta.symbol}${display}`;
}

/**
 * Convierte de una moneda a otra usando tasas (ya en COP).
 * Si las tasas no contienen alguna moneda, retorna el monto original.
 */
export function convertCurrency(amount: number, from: string, to: string, customRates?: Record<string, number>): number {
    if (!from || !to || from === to) return amount;
    const rates = { ...DEFAULT_RATES_TO_COP, ...(customRates || {}) };
    const rateFrom = rates[from.toUpperCase()];
    const rateTo = rates[to.toUpperCase()];
    if (!rateFrom || !rateTo) return amount;
    const inCop = amount * rateFrom;
    return inCop / rateTo;
}

/** Suma todos los gastos del viaje en su moneda base */
export function totalExpensesInBase(trip: Trip): number {
    const base = trip.baseCurrency || 'COP';
    return trip.expenses.reduce((sum, e) => {
        if (e.amountInBase != null && (e.currency || base) !== base) return sum + e.amountInBase;
        if ((e.currency || base) === base) return sum + e.amount;
        return sum + convertCurrency(e.amount, e.currency || base, base);
    }, 0);
}

export function tripDurationDays(trip: Pick<Trip, 'startDate' | 'endDate'>): number {
    if (!trip.startDate || !trip.endDate) return 0;
    const start = new Date(trip.startDate + 'T00:00:00');
    const end = new Date(trip.endDate + 'T00:00:00');
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

/** Genera un packing inteligente: categoría + prioridad + cantidad escalada por días */
export function generateDefaultPacking(type: TripType, durationDays: number = 5): PackingItem[] {
    const days = Math.max(1, durationDays);
    const clothesQty = Math.min(14, Math.max(1, days)); // tope razonable

    const templates: Record<TripType, Array<{ name: string; category: string; priority: 'essential' | 'recommended' | 'optional'; quantity?: number; weight?: number; }>> = {
        beach: [
            { name: 'Traje de baño', category: 'Ropa', priority: 'essential', quantity: 2 },
            { name: 'Camisetas', category: 'Ropa', priority: 'essential', quantity: clothesQty },
            { name: 'Shorts', category: 'Ropa', priority: 'essential', quantity: Math.ceil(clothesQty / 2) },
            { name: 'Ropa interior', category: 'Ropa', priority: 'essential', quantity: clothesQty },
            { name: 'Sandalias', category: 'Calzado', priority: 'essential', quantity: 1 },
            { name: 'Protector solar SPF 50+', category: 'Higiene', priority: 'essential' },
            { name: 'After-sun / Aloe vera', category: 'Higiene', priority: 'recommended' },
            { name: 'Gafas de sol', category: 'Accesorios', priority: 'essential' },
            { name: 'Sombrero', category: 'Accesorios', priority: 'recommended' },
            { name: 'Toalla de playa', category: 'Accesorios', priority: 'essential' },
            { name: 'Repelente', category: 'Higiene', priority: 'recommended' },
        ],
        mountain: [
            { name: 'Botas de senderismo', category: 'Calzado', priority: 'essential' },
            { name: 'Chaqueta impermeable', category: 'Ropa', priority: 'essential' },
            { name: 'Capas térmicas', category: 'Ropa', priority: 'essential', quantity: 2 },
            { name: 'Pantalones de trekking', category: 'Ropa', priority: 'essential', quantity: 2 },
            { name: 'Calcetines técnicos', category: 'Ropa', priority: 'essential', quantity: clothesQty },
            { name: 'Mochila', category: 'Accesorios', priority: 'essential' },
            { name: 'Linterna frontal', category: 'Electrónicos', priority: 'recommended' },
            { name: 'Protector solar', category: 'Higiene', priority: 'essential' },
            { name: 'Botiquín básico', category: 'Higiene', priority: 'essential' },
            { name: 'Cantimplora', category: 'Accesorios', priority: 'essential' },
        ],
        city: [
            { name: 'Camisetas', category: 'Ropa', priority: 'essential', quantity: clothesQty },
            { name: 'Pantalones / Faldas', category: 'Ropa', priority: 'essential', quantity: Math.ceil(clothesQty / 2) },
            { name: 'Ropa interior', category: 'Ropa', priority: 'essential', quantity: clothesQty },
            { name: 'Calcetines', category: 'Ropa', priority: 'essential', quantity: clothesQty },
            { name: 'Zapatos para caminar', category: 'Calzado', priority: 'essential' },
            { name: 'Cargador de teléfono', category: 'Electrónicos', priority: 'essential' },
            { name: 'Powerbank', category: 'Electrónicos', priority: 'recommended' },
            { name: 'Paraguas plegable', category: 'Accesorios', priority: 'optional' },
            { name: 'Chaqueta ligera', category: 'Ropa', priority: 'recommended' },
        ],
        business: [
            { name: 'Trajes / Conjuntos formales', category: 'Ropa', priority: 'essential', quantity: Math.min(5, days) },
            { name: 'Camisas', category: 'Ropa', priority: 'essential', quantity: days },
            { name: 'Zapatos de vestir', category: 'Calzado', priority: 'essential' },
            { name: 'Laptop + cargador', category: 'Electrónicos', priority: 'essential' },
            { name: 'Tarjetas de presentación', category: 'Documentos', priority: 'recommended' },
            { name: 'Adaptador de enchufe', category: 'Electrónicos', priority: 'recommended' },
            { name: 'Cuaderno/Bolígrafo', category: 'Accesorios', priority: 'recommended' },
        ],
        rural: [
            { name: 'Ropa resistente', category: 'Ropa', priority: 'essential', quantity: clothesQty },
            { name: 'Botas de campo', category: 'Calzado', priority: 'essential' },
            { name: 'Repelente de insectos', category: 'Higiene', priority: 'essential' },
            { name: 'Linterna', category: 'Electrónicos', priority: 'essential' },
            { name: 'Botiquín', category: 'Higiene', priority: 'essential' },
            { name: 'Capa de lluvia', category: 'Ropa', priority: 'recommended' },
        ],
        international: [
            { name: 'Pasaporte', category: 'Documentos', priority: 'essential' },
            { name: 'Visa / Documentos', category: 'Documentos', priority: 'essential' },
            { name: 'Adaptador de enchufe universal', category: 'Electrónicos', priority: 'essential' },
            { name: 'Seguro de viaje', category: 'Documentos', priority: 'essential' },
            { name: 'Tarjeta multidivisa / Efectivo', category: 'Documentos', priority: 'essential' },
            { name: 'Ropa variada', category: 'Ropa', priority: 'essential', quantity: clothesQty },
            { name: 'Cargador universal', category: 'Electrónicos', priority: 'essential' },
            { name: 'Powerbank', category: 'Electrónicos', priority: 'recommended' },
            { name: 'Botiquín de viaje', category: 'Higiene', priority: 'recommended' },
            { name: 'Copia digital de documentos', category: 'Documentos', priority: 'essential' },
        ],
        other: [
            { name: 'Ropa', category: 'Ropa', priority: 'essential', quantity: clothesQty },
            { name: 'Calzado cómodo', category: 'Calzado', priority: 'essential' },
            { name: 'Cargador', category: 'Electrónicos', priority: 'essential' },
            { name: 'Documentos de identidad', category: 'Documentos', priority: 'essential' },
            { name: 'Cepillo y pasta dental', category: 'Higiene', priority: 'essential' },
        ],
    };

    return (templates[type] || templates.other).map((item) => ({
        id: generateId(),
        name: item.name,
        category: item.category,
        packed: false,
        priority: item.priority,
        quantity: item.quantity || 1,
        weight: item.weight,
    }));
}

/** Items específicos sugeridos cuando hay menstruación durante el viaje. */
export function generatePeriodPackingItems(): PackingItem[] {
    return [
        { id: generateId(), name: 'Tampones / Toallas / Copa menstrual', category: 'Higiene íntima', packed: false, priority: 'essential', quantity: 1, autoSuggested: true, suggestionSource: 'period', notes: 'Sugerido porque cae menstruación durante el viaje' },
        { id: generateId(), name: 'Analgésico (ibuprofeno)', category: 'Higiene íntima', packed: false, priority: 'essential', autoSuggested: true, suggestionSource: 'period' },
        { id: generateId(), name: 'Ropa interior extra', category: 'Higiene íntima', packed: false, priority: 'recommended', quantity: 3, autoSuggested: true, suggestionSource: 'period' },
        { id: generateId(), name: 'Bolsa térmica / parches calor', category: 'Higiene íntima', packed: false, priority: 'optional', autoSuggested: true, suggestionSource: 'period' },
    ];
}

/** Detecta colisiones de horario (misma hora exacta) en un día del itinerario */
export function detectTimeConflicts(activities: Array<{ time: string; id: string }>): Set<string> {
    const conflicts = new Set<string>();
    const byTime: Record<string, string[]> = {};
    activities.forEach(a => {
        if (!byTime[a.time]) byTime[a.time] = [];
        byTime[a.time].push(a.id);
    });
    Object.values(byTime).forEach(ids => {
        if (ids.length > 1) ids.forEach(id => conflicts.add(id));
    });
    return conflicts;
}

/** Convierte minutos a "1h 30min" */
export function formatDuration(min: number): string {
    if (!min || min <= 0) return '';
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
}

/** True si ese día calendario cae dentro del rango del viaje */
export function dateWithinTrip(date: string, trip: Pick<Trip, 'startDate' | 'endDate'>): boolean {
    if (!trip.startDate || !trip.endDate) return false;
    return date >= trip.startDate && date <= trip.endDate;
}

/** Días del viaje en formato YYYY-MM-DD */
export function tripDateList(trip: Pick<Trip, 'startDate' | 'endDate'>): string[] {
    const days: string[] = [];
    if (!trip.startDate || !trip.endDate) return days;
    const start = new Date(trip.startDate + 'T00:00:00');
    const end = new Date(trip.endDate + 'T00:00:00');
    const cursor = new Date(start);
    while (cursor <= end) {
        days.push(cursor.toISOString().split('T')[0]);
        cursor.setDate(cursor.getDate() + 1);
    }
    return days;
}

/** Suma del peso de items empacados (en gramos) */
export function totalPackedWeight(trip: Trip): number {
    return trip.packingList.reduce((sum, i) => {
        if (!i.packed || !i.weight) return sum;
        return sum + (i.weight * (i.quantity || 1));
    }, 0);
}

/** Formatea peso en g/kg */
export function formatWeight(grams: number): string {
    if (grams < 1000) return `${grams}g`;
    return `${(grams / 1000).toFixed(grams % 1000 === 0 ? 0 : 1)}kg`;
}

/** Helper para split: monto que debe pagar cada companion en un gasto */
export function calculateSplitShare(expense: TravelExpense): number {
    const ppl = (expense.splitWith?.length || 1);
    return expense.amount / ppl;
}
