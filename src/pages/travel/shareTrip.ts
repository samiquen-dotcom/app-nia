import type { Trip } from '../../types';
import { formatDate, formatCurrency, tripDurationDays } from './utils';
import { getCountryByCode } from './countries';

export type ShareResult = 'shared' | 'copied' | 'whatsapp' | 'cancelled' | 'error';

/** Construye un texto resumido del viaje, listo para pegar en WhatsApp u otros. */
export function buildTripShareText(trip: Trip): string {
    const country = trip.countryCode ? getCountryByCode(trip.countryCode) : null;
    const flag = country?.flag || '✈️';
    const days = tripDurationDays(trip);
    const lines: string[] = [];

    lines.push(`${flag} *${trip.destination}*`);
    lines.push(`📅 ${formatDate(trip.startDate)} → ${formatDate(trip.endDate)} (${days} día${days !== 1 ? 's' : ''})`);

    if (country) {
        lines.push(`📍 ${country.name} · 💱 ${country.currency} · 🚨 ${country.emergency}`);
    }

    const companions = (trip.companions || []).filter(c => !c.isMe);
    if (companions.length > 0) {
        lines.push(`👥 Con: ${companions.map(c => c.name).join(', ')}`);
    }

    if (trip.budget > 0) {
        lines.push(`💰 Presupuesto: ${formatCurrency(trip.budget, trip.baseCurrency || 'COP')}`);
    }

    // Reservas críticas: vuelos + hoteles primero, con código y fecha
    const reservations = trip.reservations || [];
    const flights = reservations.filter(r => r.type === 'flight');
    const hotels = reservations.filter(r => r.type === 'hotel');
    const other = reservations.filter(r => r.type !== 'flight' && r.type !== 'hotel');

    if (flights.length > 0) {
        lines.push('');
        lines.push('✈️ *Vuelos*');
        flights.forEach(f => {
            const parts: string[] = [`• ${f.title}`];
            if (f.confirmationCode) parts.push(`(${f.confirmationCode})`);
            lines.push(parts.join(' '));
            const meta: string[] = [];
            if (f.departureAirport && f.arrivalAirport) {
                const dep = [f.departureAirport, f.departureTime].filter(Boolean).join(' ');
                const arr = [f.arrivalAirport, f.arrivalTime].filter(Boolean).join(' ');
                meta.push(`${dep} → ${arr}`);
            }
            if (f.startDate) meta.push(formatDate(f.startDate));
            if (f.seat) meta.push(`asiento ${f.seat}`);
            if (meta.length > 0) lines.push(`   ${meta.join(' · ')}`);
        });
    }

    if (hotels.length > 0) {
        lines.push('');
        lines.push('🏨 *Hospedaje*');
        hotels.forEach(h => {
            const parts: string[] = [`• ${h.title}`];
            if (h.confirmationCode) parts.push(`(${h.confirmationCode})`);
            lines.push(parts.join(' '));
            const meta: string[] = [];
            if (h.startDate && h.endDate) meta.push(`${formatDate(h.startDate)} → ${formatDate(h.endDate)}`);
            else if (h.startDate) meta.push(formatDate(h.startDate));
            if (h.address) meta.push(h.address);
            if (h.contact) meta.push(`📞 ${h.contact}`);
            if (meta.length > 0) lines.push(`   ${meta.join(' · ')}`);
        });
    }

    if (other.length > 0) {
        lines.push('');
        lines.push('📌 *Otras reservas*');
        other.forEach(r => {
            const parts: string[] = [`• ${r.title}`];
            if (r.confirmationCode) parts.push(`(${r.confirmationCode})`);
            if (r.startDate) parts.push(`— ${formatDate(r.startDate)}`);
            lines.push(parts.join(' '));
        });
    }

    lines.push('');
    lines.push('— Compartido desde App Nia 🌸');
    return lines.join('\n');
}

/** Detecta si el navegador soporta Web Share API con texto. */
function canUseWebShare(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/** Copia texto al portapapeles (con fallback legacy). */
async function copyToClipboard(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // fallthrough a método legacy
    }
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch {
        return false;
    }
}

/**
 * Comparte el viaje. Usa Web Share API si está disponible (móvil),
 * si no, copia al portapapeles y abre wa.me con el texto pre-armado.
 */
export async function shareTrip(trip: Trip): Promise<ShareResult> {
    const text = buildTripShareText(trip);
    const title = `Viaje a ${trip.destination}`;

    if (canUseWebShare()) {
        try {
            await navigator.share({ title, text });
            return 'shared';
        } catch (err) {
            // AbortError = el usuario canceló el sheet, no es un error real
            if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
            // Si falla por otra razón, caer al fallback
        }
    }

    const copied = await copyToClipboard(text);
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    const opened = window.open(waUrl, '_blank', 'noopener,noreferrer');
    if (opened) return 'whatsapp';
    return copied ? 'copied' : 'error';
}
