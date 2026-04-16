// Dataset estático de países e información útil para viajeros.
// Sin APIs externas. Las tasas son referencia y EDITABLES por el usuario.

export interface CountryInfo {
    code: string;            // ISO 3166-1 alpha-2
    name: string;            // Nombre en español
    flag: string;            // Emoji bandera
    currency: string;        // ISO 4217
    currencySymbol: string;
    timezone: string;        // IANA tz, principal
    timezoneOffset: number;  // Horas vs UTC (referencial; sin DST)
    voltage: string;         // "110V" / "220V"
    plugType: string;        // "A,B" / "C,F" / etc
    language: string;
    emergency: string;       // Número de emergencia
    drivingSide: 'right' | 'left';
}

export const COUNTRIES: CountryInfo[] = [
    { code: 'CO', name: 'Colombia', flag: '🇨🇴', currency: 'COP', currencySymbol: '$', timezone: 'America/Bogota', timezoneOffset: -5, voltage: '110V', plugType: 'A,B', language: 'Español', emergency: '123', drivingSide: 'right' },
    { code: 'MX', name: 'México', flag: '🇲🇽', currency: 'MXN', currencySymbol: '$', timezone: 'America/Mexico_City', timezoneOffset: -6, voltage: '127V', plugType: 'A,B', language: 'Español', emergency: '911', drivingSide: 'right' },
    { code: 'US', name: 'Estados Unidos', flag: '🇺🇸', currency: 'USD', currencySymbol: '$', timezone: 'America/New_York', timezoneOffset: -5, voltage: '120V', plugType: 'A,B', language: 'Inglés', emergency: '911', drivingSide: 'right' },
    { code: 'CA', name: 'Canadá', flag: '🇨🇦', currency: 'CAD', currencySymbol: '$', timezone: 'America/Toronto', timezoneOffset: -5, voltage: '120V', plugType: 'A,B', language: 'Inglés/Francés', emergency: '911', drivingSide: 'right' },
    { code: 'ES', name: 'España', flag: '🇪🇸', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Madrid', timezoneOffset: 1, voltage: '230V', plugType: 'C,F', language: 'Español', emergency: '112', drivingSide: 'right' },
    { code: 'FR', name: 'Francia', flag: '🇫🇷', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Paris', timezoneOffset: 1, voltage: '230V', plugType: 'C,E', language: 'Francés', emergency: '112', drivingSide: 'right' },
    { code: 'IT', name: 'Italia', flag: '🇮🇹', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Rome', timezoneOffset: 1, voltage: '230V', plugType: 'C,F,L', language: 'Italiano', emergency: '112', drivingSide: 'right' },
    { code: 'PT', name: 'Portugal', flag: '🇵🇹', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Lisbon', timezoneOffset: 0, voltage: '230V', plugType: 'C,F', language: 'Portugués', emergency: '112', drivingSide: 'right' },
    { code: 'GB', name: 'Reino Unido', flag: '🇬🇧', currency: 'GBP', currencySymbol: '£', timezone: 'Europe/London', timezoneOffset: 0, voltage: '230V', plugType: 'G', language: 'Inglés', emergency: '999', drivingSide: 'left' },
    { code: 'DE', name: 'Alemania', flag: '🇩🇪', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Berlin', timezoneOffset: 1, voltage: '230V', plugType: 'C,F', language: 'Alemán', emergency: '112', drivingSide: 'right' },
    { code: 'NL', name: 'Países Bajos', flag: '🇳🇱', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Amsterdam', timezoneOffset: 1, voltage: '230V', plugType: 'C,F', language: 'Neerlandés', emergency: '112', drivingSide: 'right' },
    { code: 'AR', name: 'Argentina', flag: '🇦🇷', currency: 'ARS', currencySymbol: '$', timezone: 'America/Argentina/Buenos_Aires', timezoneOffset: -3, voltage: '220V', plugType: 'C,I', language: 'Español', emergency: '911', drivingSide: 'right' },
    { code: 'CL', name: 'Chile', flag: '🇨🇱', currency: 'CLP', currencySymbol: '$', timezone: 'America/Santiago', timezoneOffset: -4, voltage: '220V', plugType: 'C,L', language: 'Español', emergency: '133', drivingSide: 'right' },
    { code: 'PE', name: 'Perú', flag: '🇵🇪', currency: 'PEN', currencySymbol: 'S/', timezone: 'America/Lima', timezoneOffset: -5, voltage: '220V', plugType: 'A,B,C', language: 'Español', emergency: '105', drivingSide: 'right' },
    { code: 'EC', name: 'Ecuador', flag: '🇪🇨', currency: 'USD', currencySymbol: '$', timezone: 'America/Guayaquil', timezoneOffset: -5, voltage: '120V', plugType: 'A,B', language: 'Español', emergency: '911', drivingSide: 'right' },
    { code: 'BR', name: 'Brasil', flag: '🇧🇷', currency: 'BRL', currencySymbol: 'R$', timezone: 'America/Sao_Paulo', timezoneOffset: -3, voltage: '127/220V', plugType: 'C,N', language: 'Portugués', emergency: '190', drivingSide: 'right' },
    { code: 'UY', name: 'Uruguay', flag: '🇺🇾', currency: 'UYU', currencySymbol: '$', timezone: 'America/Montevideo', timezoneOffset: -3, voltage: '220V', plugType: 'C,F,I,L', language: 'Español', emergency: '911', drivingSide: 'right' },
    { code: 'PA', name: 'Panamá', flag: '🇵🇦', currency: 'USD', currencySymbol: '$', timezone: 'America/Panama', timezoneOffset: -5, voltage: '110V', plugType: 'A,B', language: 'Español', emergency: '911', drivingSide: 'right' },
    { code: 'CR', name: 'Costa Rica', flag: '🇨🇷', currency: 'CRC', currencySymbol: '₡', timezone: 'America/Costa_Rica', timezoneOffset: -6, voltage: '120V', plugType: 'A,B', language: 'Español', emergency: '911', drivingSide: 'right' },
    { code: 'DO', name: 'República Dominicana', flag: '🇩🇴', currency: 'DOP', currencySymbol: '$', timezone: 'America/Santo_Domingo', timezoneOffset: -4, voltage: '110V', plugType: 'A,B', language: 'Español', emergency: '911', drivingSide: 'right' },
    { code: 'CU', name: 'Cuba', flag: '🇨🇺', currency: 'CUP', currencySymbol: '$', timezone: 'America/Havana', timezoneOffset: -5, voltage: '110/220V', plugType: 'A,B,C,L', language: 'Español', emergency: '106', drivingSide: 'right' },
    { code: 'JP', name: 'Japón', flag: '🇯🇵', currency: 'JPY', currencySymbol: '¥', timezone: 'Asia/Tokyo', timezoneOffset: 9, voltage: '100V', plugType: 'A,B', language: 'Japonés', emergency: '110', drivingSide: 'left' },
    { code: 'CN', name: 'China', flag: '🇨🇳', currency: 'CNY', currencySymbol: '¥', timezone: 'Asia/Shanghai', timezoneOffset: 8, voltage: '220V', plugType: 'A,C,I', language: 'Mandarín', emergency: '110', drivingSide: 'right' },
    { code: 'KR', name: 'Corea del Sur', flag: '🇰🇷', currency: 'KRW', currencySymbol: '₩', timezone: 'Asia/Seoul', timezoneOffset: 9, voltage: '220V', plugType: 'C,F', language: 'Coreano', emergency: '112', drivingSide: 'right' },
    { code: 'TH', name: 'Tailandia', flag: '🇹🇭', currency: 'THB', currencySymbol: '฿', timezone: 'Asia/Bangkok', timezoneOffset: 7, voltage: '220V', plugType: 'A,B,C,F,O', language: 'Tailandés', emergency: '191', drivingSide: 'left' },
    { code: 'AE', name: 'Emiratos Árabes', flag: '🇦🇪', currency: 'AED', currencySymbol: 'د.إ', timezone: 'Asia/Dubai', timezoneOffset: 4, voltage: '230V', plugType: 'G', language: 'Árabe', emergency: '999', drivingSide: 'right' },
    { code: 'TR', name: 'Turquía', flag: '🇹🇷', currency: 'TRY', currencySymbol: '₺', timezone: 'Europe/Istanbul', timezoneOffset: 3, voltage: '230V', plugType: 'C,F', language: 'Turco', emergency: '112', drivingSide: 'right' },
    { code: 'AU', name: 'Australia', flag: '🇦🇺', currency: 'AUD', currencySymbol: '$', timezone: 'Australia/Sydney', timezoneOffset: 10, voltage: '230V', plugType: 'I', language: 'Inglés', emergency: '000', drivingSide: 'left' },
    { code: 'NZ', name: 'Nueva Zelanda', flag: '🇳🇿', currency: 'NZD', currencySymbol: '$', timezone: 'Pacific/Auckland', timezoneOffset: 12, voltage: '230V', plugType: 'I', language: 'Inglés', emergency: '111', drivingSide: 'left' },
    { code: 'CH', name: 'Suiza', flag: '🇨🇭', currency: 'CHF', currencySymbol: 'CHF', timezone: 'Europe/Zurich', timezoneOffset: 1, voltage: '230V', plugType: 'C,J', language: 'Alemán/Francés/Italiano', emergency: '112', drivingSide: 'right' },
    { code: 'GR', name: 'Grecia', flag: '🇬🇷', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Athens', timezoneOffset: 2, voltage: '230V', plugType: 'C,F', language: 'Griego', emergency: '112', drivingSide: 'right' },
    { code: 'EG', name: 'Egipto', flag: '🇪🇬', currency: 'EGP', currencySymbol: 'E£', timezone: 'Africa/Cairo', timezoneOffset: 2, voltage: '220V', plugType: 'C,F', language: 'Árabe', emergency: '122', drivingSide: 'right' },
    { code: 'MA', name: 'Marruecos', flag: '🇲🇦', currency: 'MAD', currencySymbol: 'DH', timezone: 'Africa/Casablanca', timezoneOffset: 1, voltage: '220V', plugType: 'C,E', language: 'Árabe/Francés', emergency: '15', drivingSide: 'right' },
    { code: 'IN', name: 'India', flag: '🇮🇳', currency: 'INR', currencySymbol: '₹', timezone: 'Asia/Kolkata', timezoneOffset: 5.5, voltage: '230V', plugType: 'C,D,M', language: 'Hindi/Inglés', emergency: '112', drivingSide: 'left' },
    { code: 'ID', name: 'Indonesia', flag: '🇮🇩', currency: 'IDR', currencySymbol: 'Rp', timezone: 'Asia/Jakarta', timezoneOffset: 7, voltage: '230V', plugType: 'C,F', language: 'Indonesio', emergency: '112', drivingSide: 'left' },
];

export const COMMON_CURRENCIES = [
    { code: 'COP', symbol: '$', name: 'Peso Colombiano', flag: '🇨🇴' },
    { code: 'USD', symbol: '$', name: 'Dólar', flag: '🇺🇸' },
    { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
    { code: 'MXN', symbol: '$', name: 'Peso Mexicano', flag: '🇲🇽' },
    { code: 'ARS', symbol: '$', name: 'Peso Argentino', flag: '🇦🇷' },
    { code: 'CLP', symbol: '$', name: 'Peso Chileno', flag: '🇨🇱' },
    { code: 'PEN', symbol: 'S/', name: 'Sol Peruano', flag: '🇵🇪' },
    { code: 'BRL', symbol: 'R$', name: 'Real Brasileño', flag: '🇧🇷' },
    { code: 'GBP', symbol: '£', name: 'Libra Esterlina', flag: '🇬🇧' },
    { code: 'JPY', symbol: '¥', name: 'Yen', flag: '🇯🇵' },
    { code: 'CNY', symbol: '¥', name: 'Yuan', flag: '🇨🇳' },
    { code: 'KRW', symbol: '₩', name: 'Won', flag: '🇰🇷' },
    { code: 'CAD', symbol: '$', name: 'Dólar Canadiense', flag: '🇨🇦' },
    { code: 'AUD', symbol: '$', name: 'Dólar Australiano', flag: '🇦🇺' },
    { code: 'CHF', symbol: 'CHF', name: 'Franco Suizo', flag: '🇨🇭' },
    { code: 'AED', symbol: 'د.إ', name: 'Dirham', flag: '🇦🇪' },
    { code: 'TRY', symbol: '₺', name: 'Lira Turca', flag: '🇹🇷' },
    { code: 'THB', symbol: '฿', name: 'Baht', flag: '🇹🇭' },
    { code: 'INR', symbol: '₹', name: 'Rupia', flag: '🇮🇳' },
];

export function getCountryByCode(code?: string): CountryInfo | undefined {
    if (!code) return undefined;
    return COUNTRIES.find(c => c.code === code.toUpperCase());
}

export function getCountryByName(name: string): CountryInfo | undefined {
    if (!name) return undefined;
    const lower = name.toLowerCase();
    return COUNTRIES.find(c =>
        c.name.toLowerCase() === lower ||
        lower.includes(c.name.toLowerCase()) ||
        c.name.toLowerCase().includes(lower)
    );
}

export function getCurrencyMeta(code?: string) {
    if (!code) return COMMON_CURRENCIES[0];
    const found = COMMON_CURRENCIES.find(c => c.code === code.toUpperCase());
    return found || { code: code.toUpperCase(), symbol: code, name: code, flag: '💱' };
}

/**
 * Tasas de referencia almacenadas localmente (default).
 * Son APROXIMADAS y se sobreescriben con lo que el usuario configure por viaje.
 * Base = COP (1 unidad de la moneda = X COP)
 */
export const DEFAULT_RATES_TO_COP: Record<string, number> = {
    COP: 1,
    USD: 4000,
    EUR: 4350,
    MXN: 220,
    ARS: 4,
    CLP: 4.3,
    PEN: 1080,
    BRL: 730,
    GBP: 5050,
    JPY: 26,
    CNY: 555,
    KRW: 2.85,
    CAD: 2900,
    AUD: 2630,
    CHF: 4570,
    AED: 1090,
    TRY: 110,
    THB: 115,
    INR: 47,
    UYU: 100,
    DOP: 67,
    CRC: 7.5,
    EGP: 80,
    MAD: 400,
    IDR: 0.25,
    NZD: 2400,
    CUP: 165,
};
