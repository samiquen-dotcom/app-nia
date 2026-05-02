export type FinanceAccountType = 'cash' | 'savings' | 'checking' | 'credit' | 'other';

export interface FinanceAccount {
    id: string;
    name: string;
    balance: number;
    initialBalance: number;
    color?: string;
    emoji?: string;
    type?: FinanceAccountType;
    archived?: boolean;
}

export interface CustomCategory {
    emoji: string;
    label: string;
}

export interface Transaction {
    id: number;
    type: 'income' | 'expense' | 'transfer';
    accountId: string;
    amount: number;
    category: string;
    emoji: string;
    description: string;
    dateISO: string;
    date: string;
    // Para transferencias
    fromAccountId?: string;
    toAccountId?: string;
    // Origen del gasto (ej. viaje)
    sourceType?: 'travel' | 'manual';
    sourceTripId?: string;
    sourceExpenseId?: string;
}

export interface TransferTransaction {
    id: number;
    type: 'transfer';
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    description: string;
    dateISO: string;
    date: string;
}

export interface MonthStats {
    income: number;
    expense: number;
    categories: Record<string, { total: number; emoji: string }>; // Expense categories (legacy + new)
    incomeCategories?: Record<string, { total: number; emoji: string }>; // Income categories (new)
}

export interface FinanceData {
    accounts: FinanceAccount[];
    transactions: Transaction[]; // Kept for legacy/type compatibility, but strictly used for recent list now
    customCategories: CustomCategory[];
    monthStats?: Record<string, MonthStats>; // YYYY-MM -> stats
}

export interface Debt {
    id: string;
    title: string;
    amount: number;
    type: 'unique' | 'recurring';
    frequency?: 'weekly' | 'biweekly' | 'monthly';
    dueDate: string; // ISO date string YYYY-MM-DD
}

export interface DebtsData {
    items: Debt[];
}

// ─── Gym ──────────────────────────────────────────────────────────────────────
export interface GymRoutine {
    id: string;
    icon: string;
    label: string;
}

export interface GymEntry {
    date: string;     // YYYY-MM-DD
    workoutId: string;
}

export interface GymData {
    goalDaysPerWeek: number; // Configurable goal, default 5
    streak: number; // Legacy, kept for compatibility
    history: GymEntry[];
    customRoutines: GymRoutine[];
}

// ─── Period ───────────────────────────────────────────────────────────────────
export interface PeriodData {
    cycleStartDate: string;   // YYYY-MM-DD
    cycleLength: number;      // default 28
    periodLength: number;     // default 5
    isPeriodActive?: boolean; // Controls if the user is currently in a period
    symptomsLog: Record<string, string[]>;   // date → symptoms[] (Legacy, keep for migration/compat)
    dailyEntries?: Record<string, DailyCycleEntry>; // YYYY-MM-DD -> detailed entry
}

export interface DailyCycleEntry {
    date: string;
    hasBled?: boolean; // Novedad: Sangrado?
    moodEmoji?: string; // Novedad: emoji de ánimo
    moodLabel?: string; // Novedad: nombre de ánimo
    flow?: 'light' | 'medium' | 'heavy';
    energy?: 'ahorro' | 'poco' | 'estable' | 'impulso' | 'tope';
    symptoms?: string[];
    painLevel?: number; // 1-10
    reliefMethods?: string[]; // ibuprofen, heat, tea, etc.
    notes?: string;
    gymRoutineId?: string; // ID de la rutina de gym realizada (novedad)
}

// ─── Wellness ─────────────────────────────────────────────────────────────────
export interface CustomHabit {
    id: string;
    emoji: string;
    label: string;
    isDefault?: boolean;   // true para los hábitos seed (no se borran, solo se ocultan)
    archived?: boolean;    // Hábito oculto pero conservado para histórico
}

export interface TimerSession {
    date: string;          // YYYY-MM-DD
    type: 'breathing' | 'pomodoro';
    durationSec: number;   // Duración total programada en segundos
    completed: boolean;    // true si terminó, false si fue cancelado
    timestamp: number;
}

export interface WellnessDay {
    date: string;
    glasses: number;
    habits: string[];      // IDs de CustomHabit completados (compat: también acepta labels viejos)
    sleepHours?: number;   // Horas dormidas (acepta decimales: 7.5)
    // Nota: el mood/sangrado del día NO viven aquí, sino en period.dailyEntries (fuente única).
}

export interface WellnessData {
    days: WellnessDay[];
    customHabits?: CustomHabit[];     // Hábitos editables. Si está undefined, se inicializa con seed.
    timerSessions?: TimerSession[];   // Historial reciente de sesiones (últimas 60).
}

// ─── Goals ────────────────────────────────────────────────────────────────────
export interface GoalItem {
    id: number;
    text: string;
    completed: boolean;
}

export interface MediaItem {
    id: number;
    title: string;
    type: 'book' | 'series' | 'other';
    status: 'watching' | 'finished' | 'pending';
}

export interface GoalsData {
    goals: GoalItem[];
    wishlist: GoalItem[];
    media: MediaItem[];
}

// ─── Mood ─────────────────────────────────────────────────────────────────────
export interface MoodEntry {
    date: string;      // YYYY-MM-DD
    mood: string;
    emoji: string;
    timestamp: number;
}

export interface CustomMood {
    id: string;
    emoji: string;
    label: string;
}

export interface MoodData {
    entries: MoodEntry[];
    customMoods: CustomMood[];
}

// ─── Food ─────────────────────────────────────────────────────────────────────
export interface FoodItem {
    id: number;
    name: string;
    calories: number;
    portion?: string;
    confidence?: number;
    macros?: {
        protein: number;
        carbs: number;
        fats: number;
    };
    ingredients?: Array<{
        name: string;
        calories: number;
    }>;
}

export interface FoodDay {
    date: string;
    items: FoodItem[];
}

export interface FoodData {
    days: FoodDay[];
}

// ─── Travel ───────────────────────────────────────────────────────────────────
export type TripStatus = 'planned' | 'active' | 'completed' | 'cancelled';

export type TripType = 'beach' | 'mountain' | 'city' | 'business' | 'rural' | 'international' | 'other';

export type TripColor = 'pink' | 'blue' | 'green' | 'purple' | 'orange' | 'teal' | 'indigo' | 'rose';

export type PackingPriority = 'essential' | 'recommended' | 'optional';

export interface PackingItem {
    id: string;
    name: string;
    category: string;
    packed: boolean;
    quantity?: number;            // Cantidad. default 1
    priority?: PackingPriority;   // Prioridad. default 'recommended'
    weight?: number;              // Peso en gramos por unidad
    purchased?: boolean;          // ¿Ya lo tienes / hay que comprar?
    needsToBuy?: boolean;         // Marca explícita "comprar antes"
    assignedTo?: string;          // Companion id (quién lo lleva)
    notes?: string;
    autoSuggested?: boolean;      // Generado por sugerencia (clima/ciclo/duración)
    suggestionSource?: 'period' | 'duration' | 'climate' | 'type';
}

export type ExpenseCategory =
    | 'transport'
    | 'alojamiento'
    | 'comida'
    | 'actividades'
    | 'compras'
    | 'salud'
    | 'propinas'
    | 'otros';

export interface TravelExpense {
    id: string;
    category: ExpenseCategory;
    amount: number;               // En la moneda en que se pagó (currency)
    description: string;
    dateISO: string;
    currency?: string;            // ISO 4217 (USD, COP, EUR...). Default = trip.baseCurrency
    amountInBase?: number;        // Convertido a baseCurrency (para sumas globales)
    paidBy?: string;              // Companion id. 'me' por default
    splitWith?: string[];         // Companion ids con los que se divide (incluye paidBy)
    syncedToFinance?: boolean;    // Si se reflejó como Transaction en Finance
    financeAccountId?: string;    // Cuenta de origen al sincronizar
    financeTxId?: number;         // ID de la transacción creada
    linkedActivityId?: string;    // Actividad de itinerario asociada
}

export type ActivityType = 'food' | 'tour' | 'transport' | 'rest' | 'meeting' | 'shopping' | 'event' | 'other';

export interface Trip {
    id: string;
    destination: string;          // Destino principal (compat). Refleja destinations[0]?.name si existe
    type: TripType;
    status: TripStatus;
    startDate: string;            // YYYY-MM-DD
    endDate: string;              // YYYY-MM-DD
    budget: number;               // En baseCurrency
    notes: string;
    packingList: PackingItem[];
    expenses: TravelExpense[];
    createdAt: number;            // timestamp
    color?: TripColor;
    preTripChecklist?: PreTripChecklistItem[];
    itinerary?: ItineraryDay[];
    // ── NUEVOS ────────────────────────────────────────────────────────────
    destinations?: TripDestination[];      // Multi-destino opcional
    baseCurrency?: string;                  // ISO 4217. Default 'COP'
    countryCode?: string;                   // ISO 3166 del destino principal
    reservations?: Reservation[];
    companions?: Companion[];
    journal?: TripJournalEntry[];
    recap?: TripRecap;
    customChecklistCategories?: ChecklistCategory[];
    customPackingCategories?: string[];
    rating?: number;                        // 1-5 después del viaje
    transportToDestination?: 'plane' | 'car' | 'bus' | 'train' | 'boat' | 'other';
    /**
     * Tasas custom: 1 unidad de la moneda = X COP. Sobreescriben DEFAULT_RATES_TO_COP del helper.
     * Permite al usuario ajustar al cambio real del día durante un viaje.
     */
    customRates?: Record<string, number>;
}

export interface TripDestination {
    id: string;
    name: string;                           // "Madrid", "Barcelona"
    countryCode?: string;                   // ISO 3166
    startDate: string;                      // YYYY-MM-DD
    endDate: string;                        // YYYY-MM-DD
    notes?: string;
}

export type ReservationType =
    | 'flight'
    | 'hotel'
    | 'car'
    | 'transfer'
    | 'tour'
    | 'restaurant'
    | 'event'
    | 'insurance'
    | 'other';

export interface Reservation {
    id: string;
    type: ReservationType;
    title: string;                          // "Avianca Bogotá → Cancún" / "Hotel Riu Cancún"
    confirmationCode?: string;              // PNR / código de reserva
    provider?: string;                      // Aerolínea, cadena hotelera, agencia
    cost?: number;
    currency?: string;
    startDate?: string;                     // YYYY-MM-DD
    endDate?: string;                       // YYYY-MM-DD
    notes?: string;
    contact?: string;                       // Teléfono o email
    address?: string;
    referenceUrl?: string;                  // Link a reserva online (Booking, Airbnb…)
    paid?: boolean;
    syncedToFinance?: boolean;              // Si se reflejó como Transaction en Finance al pagar
    financeTxId?: number;                   // ID de la transacción creada
    // ── Vuelos ────
    airline?: string;
    flightNumber?: string;
    departureAirport?: string;
    departureTime?: string;                 // HH:MM
    departureTerminal?: string;
    departureGate?: string;
    arrivalAirport?: string;
    arrivalTime?: string;                   // HH:MM
    arrivalTerminal?: string;
    seat?: string;
    // ── Hotel ────
    checkInTime?: string;
    checkOutTime?: string;
    roomNumber?: string;
}

export interface Companion {
    id: string;
    name: string;
    color?: string;                         // Hex o tailwind color name
    emoji?: string;
    isMe?: boolean;                         // El usuario actual
}

export interface TripJournalEntry {
    date: string;                           // YYYY-MM-DD
    moodEmoji?: string;
    moodLabel?: string;
    highlight?: string;                     // Mejor momento del día
    notes?: string;
    photoNotes?: string;                    // URLs/links de fotos (texto, sin upload)
    weather?: string;
}

export interface TripRecap {
    favoriteMoment?: string;
    bestPlace?: string;
    worstPart?: string;
    lessonsLearned?: string;
    wouldReturn?: boolean;
    overallRating?: number;                 // 1-5
    completedAt?: number;                   // timestamp
}

export interface ChecklistCategory {
    key: string;
    label: string;
    icon: string;
    color: string;
}

export interface PreTripChecklistItem {
    id: string;
    task: string;
    completed: boolean;
    category: string;                       // Antes era enum cerrado, ahora libre (compat)
    dueDate?: string;                       // YYYY-MM-DD
    priority?: 'low' | 'medium' | 'high';
    notes?: string;
}

export interface ItineraryActivity {
    id: string;
    time: string;                           // HH:MM
    description: string;
    location?: string;
    completed: boolean;
    notes?: string;
    type?: ActivityType;
    duration?: number;                      // Minutos
    estimatedCost?: number;
    currency?: string;
    linkedExpenseId?: string;               // Si se sincronizó como gasto
    linkedReservationId?: string;
}

export interface ItineraryDay {
    id: string;
    date: string;                           // YYYY-MM-DD
    dayNumber: number;
    activities: ItineraryActivity[];
    notes?: string;
}

export interface TravelData {
    trips: Trip[];
    packingTemplates?: PackingTemplate[];
    tripTemplates?: TripTemplate[];         // Templates completos (packing + checklist + itinerario base)
    defaultCompanions?: Companion[];        // Companions reutilizables entre viajes
}

export interface PackingTemplate {
    id: string;
    name: string;
    description: string;
    items: Omit<PackingItem, 'id'>[];
    createdAt: number;
}

export interface TripTemplate {
    id: string;
    name: string;
    description: string;
    type: TripType;
    durationDays?: number;
    packingItems: Omit<PackingItem, 'id'>[];
    checklistItems: Omit<PreTripChecklistItem, 'id'>[];
    itineraryActivities?: Array<{ dayNumber: number; activities: Omit<ItineraryActivity, 'id'>[] }>;
    createdAt: number;
}
