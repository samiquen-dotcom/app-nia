# 📋 Handoff — Refactor del módulo Viajes

> Documento para retomar el trabajo del módulo Viajes desde otro PC.
> Última sesión: **2026-04-16** (actualizado)

---

## 🎯 Resumen ejecutivo

El módulo **Viajes** (`/travel`) pasó de ser un esqueleto con CRUD básico a una herramienta funcional para uso real. Ahora tiene 8 tabs (incluyendo "Modo Hoy" que aparece solo cuando el viaje está en curso), integraciones con los módulos **Period** y **Finance**, multi-divisa con tasas editables, sistema de templates, y todo persiste correctamente en Firestore.

---

## ✅ Lo que se hizo (en orden cronológico)

### 1. Rework completo de tipos y arquitectura
- `src/types/index.ts` — Modelos extendidos: `Trip`, `Reservation`, `Companion`, `TripJournalEntry`, `TripRecap`, `TripTemplate`, `ChecklistCategory`, `PackingItem` (con prioridad/cantidad/peso/asignación), `ItineraryActivity` (con tipos), `TravelExpense` (multi-currency + paidBy + split + sync Finance).
- `src/pages/travel/utils.ts` — Helpers nuevos: `formatCurrency`, `convertCurrency`, `totalExpensesInBase`, `tripDurationDays`, `tripDateList`, `detectTimeConflicts`, `formatDuration`, `totalPackedWeight`, `formatWeight`, `calculateSplitShare`, `generatePeriodPackingItems`. Configs compartidos: `STATUS_CONFIG`, `TYPE_CONFIG`, `TRIP_COLOR_CONFIG`, `ACTIVITY_TYPE_CONFIG`, `RESERVATION_TYPE_CONFIG`, `DEFAULT_CHECKLIST_CATEGORIES`, `PACKING_PRIORITY_CONFIG`.
- `src/pages/travel/countries.ts` — Dataset estático: 35 países con código ISO, bandera, moneda, símbolo, zona horaria, voltaje, enchufe, idioma, emergencias y conducción. 19 monedas comunes. `DEFAULT_RATES_TO_COP` con tasas aproximadas editables.

### 2. Componentes nuevos
| Archivo | Para qué sirve |
|---|---|
| `src/pages/travel/ConfirmModal.tsx` | Reemplazo del `window.confirm` nativo (UX consistente) |
| `src/pages/travel/ReservationsTab.tsx` | 9 tipos de reservas (vuelo/hotel/auto/transfer/tour/restaurante/evento/seguro/otro) con campos específicos. Sync con Finance + auto-creación de actividad en itinerario |
| `src/pages/travel/JournalTab.tsx` | Diario diario con mood, clima, mejor momento, notas y links de fotos. Recap final con rating ⭐ |
| `src/pages/travel/TodayTab.tsx` | **Modo Hoy** — solo aparece cuando el viaje está `active`. Dashboard del día con próxima actividad, próxima reserva, gasto rápido, mood rápido, etc. |
| `src/pages/travel/CurrencyRatesEditor.tsx` | Editor de tasas custom por viaje. Recalcula `amountInBase` de gastos al guardar |
| `src/pages/travel/TripTemplatesModal.tsx` | Browse/aplicar/guardar/borrar templates de viaje completos |
| `src/pages/travel/defaultTripTemplates.ts` | 5 templates predeseñados (Playa 3d, Internacional 14d, Negocios 3d, Montaña 4d, City 4d) |
| `src/pages/travel/printItinerary.ts` | Genera HTML imprimible para PDF con todo el viaje |

### 3. Componentes refactorizados
- **TripFormModal**: multi-destino, selector de país (35 con bandera), selector de moneda (19), transporte principal, validaciones reales (fechas absurdas, presupuesto negativo), botón "Empezar desde un template"
- **TripInfoTab**: info del país (TZ/voltaje/idioma/emergencias), CRUD de companions, picker de status (no más cycle confuso `completed → planned`), tarjeta amarilla "Tasas de cambio" cuando hay multi-divisa, tarjeta de transporte
- **PackingTab**: cantidades, prioridad (esencial/recomendado/opcional), peso, "comprar antes", asignar a companion, filtros (todo/pendiente/empacado/comprar/esencial), reset empacado, botones siempre visibles en móvil
- **ItineraryTab**: 8 tipos de actividad, detección de conflictos de horario ⚠️, costo estimado, link a Google Maps, botón **💰 Gasto** para convertir actividad → gasto
- **ExpensesTab**: multi-currency con conversión, paidBy, split tipo Splitwise con balances entre companions, **sync a Finance** (crea Transaction real en cuenta elegida con `sourceType: 'travel'`)
- **PreTripChecklistTab**: categorías personalizables (icono+color), prioridad, alerta de vencidas, filtros
- **TripCard**: bandera del país, badges de companions/reservas, mini progress bars de packing+checklist
- **TripDetailModal**: 8 tabs (Hoy aparece solo si `active`), botón 🖨️ imprimir, botón 🔖 guardar como template, integración Period (banner si menstruación cae en viaje)
- **TravelStatsDashboard**: usa config compartida (incluye `salud` y `propinas`), suma todo en COP con conversión multi-currency
- **TravelScreen**: búsqueda + filtros (estado/tipo/orden), botón ✨ templates en header
- **HomeScreen widget**: muestra progreso de packing/checklist + alertas de items esenciales sin empacar

### 4. Integraciones cross-feature
- **Period**: `TripDetailModal` lee Firestore feature `period` y detecta si la menstruación cae durante el viaje. Banner rosa con botón "Agregar items" que carga 4 items de higiene íntima al packing.
- **Finance**: `ExpensesTab` y `ReservationsTab` permiten elegir cuenta y crear `Transaction` real en Finance con `sourceType: 'travel'`, `sourceTripId` y `sourceExpenseId`.
- **Home**: el widget de viajes ahora muestra alertas y progreso real, no solo "días para salir".

### 5. Fixes de bugs reportados
- **Firestore rechazaba `undefined`**: cambiamos a `initializeFirestore(app, { ignoreUndefinedProperties: true })` en `src/firebase.ts`. Esto fue lo que causaba el error de "no se pudo guardar" y la pérdida del viaje.
- **Modal chocaba con BottomNav**: subí los z-index a `z-[60]` (modales principales), `z-[70]` (modales internos) y `z-[80]` (confirms). Footer del form con `pb-28` en móvil para que el botón quede arriba del nav.
- **BottomNav menú "más"**: en PC salía pegado a la derecha; ahora siempre centrado con `left-1/2 -translate-x-1/2`.
- **Tabs del TripDetailModal en PC**: salían a la izquierda con espacio sobrante; ahora usan `sm:overflow-visible` + `sm:w-full` + `sm:basis-0` para distribución equitativa.
- **Botones edit/delete invisibles en móvil**: eran `opacity-0 group-hover` (solo desktop). Ahora siempre visibles.
- **TravelStatsDashboard categorías hardcoded**: no mostraba `salud` ni `propinas`. Ahora usa config compartida.

---

## ⏭️ Lo que SIGUE

### ✅ Prioridad ALTA — COMPLETADO en esta sesión (2026-04-16)

#### **D — Compartir viaje vía WhatsApp / link** ✅
- Archivo nuevo: `src/pages/travel/shareTrip.ts` con `buildTripShareText(trip)` y `shareTrip(trip)`
- Botón 🟢 "share" en el header del `TripDetailModal` (entre imprimir y bookmark)
- Usa Web Share API en móvil, fallback a portapapeles + `wa.me/?text=...` en PC
- Toast de feedback ("Texto copiado", "Abriendo WhatsApp…")
- El texto incluye: destino con bandera, fechas, duración, país (moneda/emergencias), companions, presupuesto, vuelos con código + asiento, hoteles con dirección + contacto, otras reservas

#### **E — Tasas de cambio en vivo** ✅ (bonus)
- Archivo nuevo: `src/pages/travel/exchangeRatesApi.ts` — usa `open.er-api.com` (free, sin API key, soporta COP)
- Botón "🔄 Usar tasas de hoy" en `CurrencyRatesEditor`
- Cache en localStorage con TTL de 6h para no sobrecargar el API
- Fallback silencioso a `DEFAULT_RATES_TO_COP` si offline o falla el fetch
- Indicador "Tasas actualizadas DD/MM HH:MM" cuando vienen del API

### 🟡 Prioridad MEDIA — requiere setup externo

| Mejora | Requiere | Por qué importa |
|---|---|---|
| **Documentos adjuntos** (PDF de pasaporte, tickets, vouchers) | Firebase Storage habilitado en consola | Para tener todo en un solo sitio sin abrir Gmail |
| **Notificaciones push reales** (vuelo en 24h, check-in, vencidas) | Service Worker + Firebase Cloud Messaging | Hoy las dueDates del checklist son solo visuales |
| **Modo offline** (cache del viaje activo) | Service Worker (vite-plugin-pwa) | Para usar en el avión / sin datos |
| ~~Tasas de cambio en vivo~~ ✅ | ~~API gratis~~ | Implementado con `open.er-api.com` (free, sin API key) |
| **Clima del destino** (sugerir items de packing) | OpenWeather API (free tier) | "Vas a Cartagena en agosto, sugerir paraguas" |

### 🟢 Prioridad BAJA — nice to have

- **Mapa interactivo** del itinerario con pins por actividad (necesita Leaflet/Mapbox)
- **OCR de tickets** para extraer info de reservas automáticamente (Gemini Vision o similar — la app ya tiene Gemini integrado)
- **Versión imprimible del itinerario en formato libreta** (otro estilo de PDF, más visual)
- **Sincronización con Google Calendar** del itinerario (Google Calendar API)

### Después de Viajes (otros módulos pendientes)
Auditoría hecha en esta sesión, ranking de más débil a más sólido:
1. **Goals** — esqueleto puro, solo CRUD (3 listas básicas)
2. **Wellness** — esqueleto con timer, hidratación sin histórico, hábitos hardcoded
3. **Profile** — solo settings
4. **Debts** — decente pero sin alertas/análisis
5. Gym, Food, Finance, Period — sólidos

Recomendación dada: empezar por **Wellness** porque se usa diario y hoy pierde datos.

---

## 🚀 Cómo retomar desde otro PC

### Setup
```bash
cd "AppNia"
npm install
npm run dev          # http://localhost:5173 (o 5174 si está ocupado)
```

### Verificación rápida
```bash
npx tsc -b --noEmit  # debe salir limpio
npm run build        # debe terminar sin errores
```

### Stack confirmado
- React 19 + TypeScript + Vite 7
- Tailwind CSS v4 (con `@custom-variant dark` en `index.css`)
- Firebase 12 (Auth + Firestore — **`ignoreUndefinedProperties: true`** ya configurado en `firebase.ts`)
- React Router v7
- @google/generative-ai (Gemini para Food)

### Configuración del proyecto
- **`src/firebase.ts`** — Firestore tolera `undefined` en campos opcionales. NO QUITAR esa configuración.
- **Modales: jerarquía de z-index**
  - BottomNav: `z-50`
  - Modales principales (TripFormModal, TripDetailModal): `z-[60]`
  - Modales internos (Reservation form, Account picker, CurrencyRatesEditor, TripTemplatesModal): `z-[70]`
  - Confirms: `z-[80]`
- **Footer de modales en móvil**: `pb-28` para que el botón no quede tapado por el BottomNav

### Modelo de datos en Firestore
```
users/{uid}
users/{uid}/features/travel  → TravelData { trips, packingTemplates, tripTemplates, defaultCompanions }
users/{uid}/features/finance/transactions/{id}  → subcolección de Transactions
```

Las `Transaction` creadas desde Viajes tienen:
```ts
{
  sourceType: 'travel',
  sourceTripId: <id del viaje>,
  sourceExpenseId: <id del gasto/reserva>,
  category: `Viaje: ${trip.destination}`,
  emoji: '✈️' | '📌'
}
```

### Convenciones del módulo Viajes
- **Trip.baseCurrency** default = `'COP'`
- **Trip.companions** default = `[{ id: 'me', name: 'Yo', isMe: true, color: 'pink' }]`
- **TripExpense.amount** está en su `currency`. **`amountInBase`** se calcula al guardar usando `trip.customRates ?? DEFAULT_RATES_TO_COP`.
- **TripExpense.paidBy** default = `'me'`
- Para sumar gastos en multi-currency usar siempre `totalExpensesInBase(trip)` de utils.

### Cómo probar el Modo Hoy
1. Crea un viaje con `startDate <= hoy <= endDate`
2. Abre el detalle → tab "Hoy" debe aparecer y estar seleccionada por defecto
3. Si está fuera de fechas, cambia el status manualmente a `active` desde Info → Cambiar estado

---

## ⚠️ Notas técnicas / gotchas

### Cosas que podrían confundir al retomar

1. **El proxy de Claude Preview no funciona con Vite si el puerto cambia.** Si Vite arranca en 5174 (porque 5173 está ocupado), los screenshots del MCP fallan. Para verificar visualmente, abrir el navegador directamente.

2. **Las tasas de cambio son aproximadas.** Si cambias mucho en el módulo de finanzas o en un viaje, considera implementar la integración con `frankfurter.app` (gratis, sin API key).

3. **`useFeatureData` hace optimistic update.** Si el save falla, el estado local NO revierte. El usuario verá los cambios visualmente pero no estarán en Firestore. Si reportan "se borró al recargar", probablemente fue un save fallido. Ya está mitigado con `ignoreUndefinedProperties: true`.

4. **El TripCard del HomeScreen** usa los datos del trip directamente. Si agregas nuevos campos al Trip y no se reflejan en Home, recuerda que el widget hace su propio cálculo en `HomeScreen.tsx` (busca el bloque `Travel Card mejorado`).

5. **Print itinerary** abre una ventana popup. Si el navegador la bloquea, falla silenciosamente con un alert. En Edge/Chrome de PC funciona bien; en móvil depende del navegador.

6. **Auto-link de reservas a itinerario**: cuando guardas una reserva con `startDate` que coincide con un día existente del itinerario, se crea/actualiza una actividad linkeada con `linkedReservationId`. Si borras la reserva, se borra la actividad. Si borras la actividad, la reserva NO se borra.

7. **Sync de gastos a Finance**: solo se hace al click manual. NO es automático para evitar duplicar transacciones cuando el usuario edita un gasto.

8. **Period overlap detection**: lee Firestore feature `period` cada vez que se abre el TripDetailModal. Si tu ciclo cambió pero el viaje ya tenía items de período agregados, no se vuelven a sugerir (verifica `i.autoSuggested && i.suggestionSource === 'period'`).

### Memoria del usuario en Claude Code

El archivo de memoria persistente está en:
`C:\Users\Sinfi\.claude\projects\C--Users-Sinfi-OneDrive-Infiniity-Eventos-APP-ZEVEN-APP-NIA\memory\MEMORY.md`

Contiene contexto sobre:
- Stack y estructura clave
- Estado del refactor
- Preferencias del usuario (español, novato en Claude Code, quiere mejoras todas de una vez)

---

## 📂 Estructura final de `src/pages/travel/`

```
travel/
├── ConfirmModal.tsx                  ← Modal genérico de confirmación
├── countries.ts                      ← Dataset países + monedas + tasas default
├── CurrencyRatesEditor.tsx           ← Editor de tasas por viaje
├── defaultTripTemplates.ts           ← 5 templates predeseñados
├── ExpensesTab.tsx                   ← Tab de gastos multi-currency + sync Finance
├── ItineraryTab.tsx                  ← Tab de itinerario con tipos + conflictos
├── JournalTab.tsx                    ← Tab diario + recap
├── PackingTab.tsx                    ← Tab equipaje inteligente
├── PreTripChecklistTab.tsx           ← Tab checklist con categorías custom
├── printItinerary.ts                 ← Generador de HTML imprimible
├── ReservationsTab.tsx               ← Tab reservas con sync Finance + itinerario
├── TodayTab.tsx                      ← Modo Hoy (solo si trip.status === 'active')
├── TravelStatsDashboard.tsx          ← Dashboard de estadísticas globales
├── TripCard.tsx                      ← Card en lista de viajes
├── TripDetailModal.tsx               ← Modal de detalle con 8 tabs
├── TripFormModal.tsx                 ← Form crear/editar
├── TripInfoTab.tsx                   ← Tab info principal
├── TripTemplatesModal.tsx            ← Browse/save/delete templates
└── utils.ts                          ← Helpers + configs compartidos
```

---

## 💬 Última pregunta abierta al usuario

> "D y tasas en vivo quedaron listos. ¿Arranco módulo **Wellness** o sigues con otra mejora media (clima destino / push / offline)?"

El plan original A→B→C→D quedó cerrado en esta sesión + bonus de tasas en vivo.
El siguiente candidato natural es **Wellness** (se usa diario, hoy pierde datos).
