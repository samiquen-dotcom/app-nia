export interface FinanceAccount {
    id: string;
    name: string;
    balance: number;
    initialBalance: number;
}

export interface CustomCategory {
    emoji: string;
    label: string;
}

export interface Transaction {
    id: number;
    type: 'income' | 'expense';
    accountId: string;
    amount: number;
    category: string;
    emoji: string;
    description: string;
    dateISO: string;
    date: string;
}

export interface MonthStats {
    income: number;
    expense: number;
    categories: Record<string, { total: number; emoji: string }>;
}

export interface FinanceData {
    accounts: FinanceAccount[];
    transactions: Transaction[]; // Kept for legacy/type compatibility, but strictly used for recent list now
    customCategories: CustomCategory[];
    monthStats?: Record<string, MonthStats>; // YYYY-MM -> stats
}

// ─── Gym ──────────────────────────────────────────────────────────────────────
export interface GymEntry {
    date: string;     // YYYY-MM-DD
    workoutId: string;
}

export interface GymData {
    streak: number;
    history: GymEntry[];
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
    flow?: 'light' | 'medium' | 'heavy';
    energy?: 'ahorro' | 'poco' | 'estable' | 'impulso' | 'tope';
    symptoms?: string[];
    notes?: string;
}

// ─── Wellness ─────────────────────────────────────────────────────────────────
export interface WellnessDay {
    date: string;
    glasses: number;
    habits: string[];
}

export interface WellnessData {
    days: WellnessDay[];
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

export interface MoodData {
    entries: MoodEntry[];
}

// ─── Food ─────────────────────────────────────────────────────────────────────
export interface FoodItem {
    id: number;
    name: string;
    calories: number;
}

export interface FoodDay {
    date: string;
    meals: Record<string, FoodItem[]>;
}

export interface FoodData {
    days: FoodDay[];
}
