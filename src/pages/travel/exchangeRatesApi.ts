/**
 * Cliente de tasas de cambio en vivo usando open.er-api.com.
 * - Free, sin API key, soporta COP y 160+ monedas (actualiza cada 24h).
 * - Cache en localStorage con TTL de 6h para no martillar el API.
 * - Devuelve tasas en formato "1 unidad = X COP" (compatible con DEFAULT_RATES_TO_COP).
 */

const API_URL = 'https://open.er-api.com/v6/latest/COP';
const CACHE_KEY = 'nia_live_rates_to_cop_v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas

interface CachedRates {
    rates: Record<string, number>;  // 1 unidad de la moneda = X COP
    fetchedAt: number;              // timestamp ms
    sourceTime: string;             // time_last_update_utc del API
}

interface ApiResponse {
    result: 'success' | 'error';
    base_code: string;
    rates: Record<string, number>;  // 1 COP = X unidad. Hay que invertir.
    time_last_update_utc?: string;
    'error-type'?: string;
}

function readCache(): CachedRates | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as CachedRates;
        if (!parsed.rates || !parsed.fetchedAt) return null;
        return parsed;
    } catch {
        return null;
    }
}

function writeCache(data: CachedRates) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
        // silent — storage full o denied
    }
}

function isCacheFresh(cache: CachedRates | null): cache is CachedRates {
    if (!cache) return false;
    return Date.now() - cache.fetchedAt < CACHE_TTL_MS;
}

/** Devuelve el timestamp de la última actualización cacheada, o null si no hay. */
export function getCachedRatesTimestamp(): number | null {
    return readCache()?.fetchedAt ?? null;
}

/** Devuelve las tasas cacheadas sin hacer fetch. null si no hay cache. */
export function getCachedRates(): CachedRates | null {
    return readCache();
}

/**
 * Obtiene tasas en vivo. Usa cache si es fresca. Si el fetch falla, cae al
 * cache (aunque sea viejo) y en último caso retorna null para que el caller
 * use los defaults.
 *
 * @param force Si true, ignora la cache fresca y hace fetch igual.
 */
export async function fetchLiveRates(force = false): Promise<CachedRates | null> {
    const cached = readCache();
    if (!force && isCacheFresh(cached)) return cached;

    try {
        const res = await fetch(API_URL, { method: 'GET' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ApiResponse;
        if (data.result !== 'success' || !data.rates) {
            throw new Error(data['error-type'] || 'bad response');
        }

        // Invertir: el API devuelve "1 COP = X USD", necesitamos "1 USD = X COP".
        const inverted: Record<string, number> = { COP: 1 };
        Object.entries(data.rates).forEach(([code, rate]) => {
            if (typeof rate === 'number' && rate > 0 && code !== 'COP') {
                inverted[code] = 1 / rate;
            }
        });

        const fresh: CachedRates = {
            rates: inverted,
            fetchedAt: Date.now(),
            sourceTime: data.time_last_update_utc || new Date().toISOString(),
        };
        writeCache(fresh);
        return fresh;
    } catch {
        // fallback silencioso: si hay cache aunque sea viejo, servirlo
        return cached ?? null;
    }
}

/** Formatea el timestamp como "DD/MM HH:MM" en español. */
export function formatRatesTimestamp(ms: number): string {
    const d = new Date(ms);
    const date = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    return `${date} ${time}`;
}
