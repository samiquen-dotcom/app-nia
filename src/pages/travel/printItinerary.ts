import type { Trip } from '../../types';
import { formatDateLong, formatCurrency, totalExpensesInBase, formatDate } from './utils';
import { getCountryByCode, getCurrencyMeta } from './countries';

const escapeHTML = (s: string) =>
    s.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

/** Genera un HTML imprimible y abre la ventana de impresión nativa. */
export function printTripItinerary(trip: Trip) {
    const country = getCountryByCode(trip.countryCode);
    const baseCurrency = trip.baseCurrency || 'COP';
    const currencyMeta = getCurrencyMeta(baseCurrency);
    const totalSpent = totalExpensesInBase(trip);

    const reservations = trip.reservations || [];
    const itinerary = trip.itinerary || [];
    const checklist = trip.preTripChecklist || [];
    const packing = trip.packingList || [];
    const companions = trip.companions || [];

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Viaje: ${escapeHTML(trip.destination)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; padding: 32px; max-width: 720px; margin: 0 auto; line-height: 1.5; }
  h1 { color: #ec4899; margin: 0 0 8px; font-size: 28px; }
  h2 { color: #be185d; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #fce7f3; font-size: 18px; }
  h3 { margin: 16px 0 6px; font-size: 14px; color: #475569; }
  .muted { color: #94a3b8; font-size: 12px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: bold; background: #fce7f3; color: #be185d; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .card { background: #f8fafc; padding: 10px 12px; border-radius: 8px; border: 1px solid #e2e8f0; }
  ul { padding-left: 20px; margin: 8px 0; }
  li { margin: 4px 0; font-size: 13px; }
  .reservation { background: #f8fafc; border-left: 3px solid #ec4899; padding: 8px 12px; margin-bottom: 8px; border-radius: 4px; }
  .reservation .title { font-weight: bold; }
  .reservation .meta { font-size: 11px; color: #64748b; margin-top: 4px; }
  .day { margin-bottom: 16px; }
  .day .header { background: #fce7f3; color: #be185d; padding: 6px 10px; border-radius: 6px; font-weight: bold; font-size: 13px; }
  .activity { padding: 4px 10px; border-bottom: 1px dashed #e2e8f0; font-size: 13px; display: flex; gap: 8px; }
  .time { font-weight: bold; color: #ec4899; min-width: 50px; }
  .checked { text-decoration: line-through; color: #94a3b8; }
  @media print {
    body { padding: 16px; }
    .no-print { display: none; }
    h2 { page-break-after: avoid; }
    .day, .reservation { page-break-inside: avoid; }
  }
  .print-btn { position: fixed; top: 12px; right: 12px; background: #ec4899; color: white; padding: 8px 16px; border: 0; border-radius: 8px; font-weight: bold; cursor: pointer; }
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>

<h1>${country?.flag || '✈️'} ${escapeHTML(trip.destination)}</h1>
<p class="muted">${escapeHTML(formatDateLong(trip.startDate))} → ${escapeHTML(formatDateLong(trip.endDate))}</p>
${country ? `<p class="muted">📍 ${escapeHTML(country.name)} · 🌐 UTC${country.timezoneOffset >= 0 ? '+' : ''}${country.timezoneOffset} · 💱 ${escapeHTML(country.currency)} · 🔌 ${escapeHTML(country.voltage)} (${escapeHTML(country.plugType)}) · 🚨 ${escapeHTML(country.emergency)}</p>` : ''}

<div class="grid" style="margin-top: 12px;">
  ${trip.budget > 0 ? `
  <div class="card">
    <div class="muted">Presupuesto</div>
    <div style="font-size: 18px; font-weight: bold;">${escapeHTML(currencyMeta.symbol)}${trip.budget.toLocaleString()}</div>
  </div>
  <div class="card">
    <div class="muted">Gastado</div>
    <div style="font-size: 18px; font-weight: bold; color: ${totalSpent > trip.budget ? '#dc2626' : '#16a34a'}">${escapeHTML(formatCurrency(totalSpent, baseCurrency))}</div>
  </div>
  ` : ''}
</div>

${companions.length > 0 ? `
<h2>👥 Acompañantes</h2>
<p>${companions.map(c => `${c.emoji || '👤'} ${escapeHTML(c.name)}${c.isMe ? ' (yo)' : ''}`).join(' · ')}</p>
` : ''}

${reservations.length > 0 ? `
<h2>📌 Reservas</h2>
${reservations.map(r => `
<div class="reservation">
  <div class="title">${escapeHTML(r.title)} ${r.paid ? '<span class="badge" style="background:#bbf7d0;color:#15803d;">✓ Pagada</span>' : ''}</div>
  <div class="meta">
    ${r.confirmationCode ? `<strong>Cod:</strong> ${escapeHTML(r.confirmationCode)}` : ''}
    ${r.provider ? ` · ${escapeHTML(r.provider)}` : ''}
    ${r.startDate ? ` · ${escapeHTML(formatDate(r.startDate))}` : ''}
    ${r.cost ? ` · ${escapeHTML(formatCurrency(r.cost, r.currency))}` : ''}
  </div>
  ${r.airline || r.flightNumber ? `<div class="meta">✈️ ${escapeHTML(r.airline || '')} ${escapeHTML(r.flightNumber || '')} ${r.departureAirport ? `· ${escapeHTML(r.departureAirport)} ${r.departureTime || ''} → ${escapeHTML(r.arrivalAirport || '')} ${r.arrivalTime || ''}` : ''} ${r.seat ? `· asiento ${escapeHTML(r.seat)}` : ''}</div>` : ''}
  ${r.address ? `<div class="meta">📍 ${escapeHTML(r.address)}</div>` : ''}
  ${r.contact ? `<div class="meta">📞 ${escapeHTML(r.contact)}</div>` : ''}
  ${r.notes ? `<div class="meta" style="font-style:italic;">${escapeHTML(r.notes)}</div>` : ''}
</div>
`).join('')}
` : ''}

${itinerary.length > 0 ? `
<h2>🗓 Itinerario</h2>
${itinerary.map(d => `
<div class="day">
  <div class="header">Día ${d.dayNumber} — ${escapeHTML(formatDateLong(d.date))}</div>
  ${d.activities.length === 0 ? '<p class="muted" style="margin:6px 0;">— sin actividades —</p>' : d.activities.map(a => `
    <div class="activity">
      <span class="time">${escapeHTML(a.time)}</span>
      <span class="${a.completed ? 'checked' : ''}">
        ${escapeHTML(a.description)}
        ${a.location ? ` <span class="muted">📍 ${escapeHTML(a.location)}</span>` : ''}
        ${a.estimatedCost ? ` <span class="muted">💰 ${escapeHTML(formatCurrency(a.estimatedCost, a.currency || baseCurrency))}</span>` : ''}
      </span>
    </div>
  `).join('')}
</div>
`).join('')}
` : ''}

${packing.length > 0 ? `
<h2>🧳 Equipaje</h2>
<ul>
${packing.map(p => `
  <li class="${p.packed ? 'checked' : ''}">
    ${p.packed ? '☑' : '☐'} ${escapeHTML(p.name)}${(p.quantity || 1) > 1 ? ` ×${p.quantity}` : ''}${p.priority === 'essential' ? ' <span class="badge" style="background:#fee2e2;color:#991b1b;">Esencial</span>' : ''} <span class="muted">(${escapeHTML(p.category)})</span>
  </li>
`).join('')}
</ul>
` : ''}

${checklist.length > 0 ? `
<h2>✅ Checklist pre-viaje</h2>
<ul>
${checklist.map(c => `
  <li class="${c.completed ? 'checked' : ''}">
    ${c.completed ? '☑' : '☐'} ${escapeHTML(c.task)}${c.dueDate ? ` <span class="muted">— vence ${escapeHTML(formatDate(c.dueDate))}</span>` : ''}
  </li>
`).join('')}
</ul>
` : ''}

${trip.notes ? `<h2>📝 Notas</h2><p style="white-space:pre-wrap;">${escapeHTML(trip.notes)}</p>` : ''}

<p class="muted" style="margin-top:32px; text-align:center;">Generado por App Nia 🌸</p>

<script>
  setTimeout(() => window.print(), 400);
</script>
</body>
</html>`;

    const w = window.open('', '_blank');
    if (!w) {
        alert('Permite popups para imprimir el itinerario');
        return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
}
