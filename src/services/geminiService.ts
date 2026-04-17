import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── Configuración de múltiples APIs ─────────────────────────────────────────
const API_KEY_1 = import.meta.env.VITE_GEMINI_API_KEY;
const API_KEY_2 = import.meta.env.VITE_GEMINI_API_KEY_2;

// Estado global para gestionar qué API está activa
let currentApiIndex = 0; // 0 = API_KEY_1, 1 = API_KEY_2

// Crear instancias de las APIs disponibles
const apis: GoogleGenerativeAI[] = [];
if (API_KEY_1) apis.push(new GoogleGenerativeAI(API_KEY_1));
if (API_KEY_2) apis.push(new GoogleGenerativeAI(API_KEY_2));

// Obtener la instancia activa
function getActiveGenAI(): GoogleGenerativeAI | null {
    if (apis.length === 0) return null;
    return apis[currentApiIndex] || apis[0];
}

// Cambiar a la siguiente API si está disponible
function switchToNextApi(): boolean {
    if (apis.length < 2) return false;

    const previousIndex = currentApiIndex;
    currentApiIndex = (currentApiIndex + 1) % apis.length;

    console.log(`⚡ Cambiando de API ${previousIndex + 1} → API ${currentApiIndex + 1}`);
    return true;
}

// Saber si hay APIs alternativas disponibles
function hasAlternativeApi(): boolean {
    return apis.length > 1;
}

export interface FoodAnalysisResult {
    name: string;
    calories: number;
    portion: string;
    confidence: number;
    macros: {
        protein: number;
        carbs: number;
        fats: number;
    };
    ingredients: Array<{
        name: string;
        calories: number;
    }>;
}

/**
 * Analiza texto descriptivo de comida usando Gemini AI
 * @param description - Descripción textual de la comida
 * @param retryCount - Número de reintentos (interno)
 * @returns Promesa con el análisis nutricional
 */
export const analyzeFoodText = async (description: string, retryCount = 0): Promise<FoodAnalysisResult> => {
    const genAI = getActiveGenAI();
    if (!genAI) {
        throw new Error("No se ha configurado la API Key de Gemini. Por favor, añade VITE_GEMINI_API_KEY a tu archivo .env");
    }

    const MAX_RETRIES = 2;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
Eres un experto nutricionista. El usuario describió qué comió y debes calcular la información nutricional.

Descripción del usuario: "${description}"

IMPORTANTE:
- Responde ÚNICAMENTE con JSON válido, sin texto adicional ni markdown
- Estimá porciones realistas basadas en la descripción
- Usá valores nutricionales estándar para alimentos comunes

El JSON debe tener EXACTAMENTE esta estructura:

{
  "name": "Nombre descriptivo del plato en español",
  "calories": 750,
  "portion": "Porción estimada (aprox 350g)",
  "confidence": 85,
  "macros": {
    "protein": 30,
    "carbs": 50,
    "fats": 25
  },
  "ingredients": [
    { "name": "Ingrediente 1", "calories": 180 },
    { "name": "Ingrediente 2", "calories": 250 }
  ]
}

Reglas nutricionales:
- 1g proteína = 4 kcal, 1g carbs = 4 kcal, 1g grasa = 9 kcal
- Los macros deben ser coherentes con las calorías totales (±15%)
- Bajá el confidence si la descripción es vaga o ambigua
`;

    try {
        const result = await model.generateContent([prompt]);
        const response = await result.response;
        let text = response.text();

        // Limpiar formato markdown
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        // Detectar error de no-comida
        if (text.includes('"error"') && text.includes('no_food_detected')) {
            throw new Error("No se detectó comida en la descripción. Por favor, sé más específico.");
        }

        const parsedData: FoodAnalysisResult = JSON.parse(text);

        // Validación estricta de campos requeridos
        if (
            typeof parsedData.calories !== "number" ||
            typeof parsedData.name !== "string" ||
            !parsedData.macros ||
            typeof parsedData.macros.protein !== "number" ||
            typeof parsedData.macros.carbs !== "number" ||
            typeof parsedData.macros.fats !== "number"
        ) {
            console.error("Respuesta inválida de Gemini:", text);
            throw new Error("La IA devolvió un formato inválido. Intentá de nuevo.");
        }

        // Validación de coherencia nutricional (opcional, solo log)
        const calculatedCalories = (parsedData.macros.protein * 4) + (parsedData.macros.carbs * 4) + (parsedData.macros.fats * 9);
        const diff = Math.abs(calculatedCalories - parsedData.calories);
        if (diff > parsedData.calories * 0.2) {
            console.warn(`Advertencia: macros no coherentes con calorías. Calculadas: ${calculatedCalories}, Reportadas: ${parsedData.calories}`);
        }

        return parsedData;

    } catch (error: any) {
        // Reintentar en caso de error de red o timeout
        if (retryCount < MAX_RETRIES && (error.message?.includes('timeout') || error.message?.includes('network'))) {
            console.log(`Reintentando análisis (intento ${retryCount + 1}/${MAX_RETRIES})...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return analyzeFoodText(description, retryCount + 1);
        }

        // Detectar error de quota/rate limit y cambiar de API inmediatamente
        if (error.message?.includes('quota') || error.message?.includes('rate limit') || error.message?.includes('429')) {
            if (hasAlternativeApi() && retryCount < MAX_RETRIES) {
                switchToNextApi();
                console.log(`⚡ Límite alcanzado. Reintentando con API alternativa...`);
                await new Promise(resolve => setTimeout(resolve, 500));
                return analyzeFoodText(description, retryCount + 1);
            }

            throw new Error("Se alcanzó el límite de uso de ambas APIs. Intentá en unos minutos.");
        }

        console.error("Error analyzing food text:", error);

        // Mensajes de error más amigables
        if (error.message?.includes('API key')) {
            throw new Error("Error de configuración de API. Contactá al administrador.");
        }

        throw error;
    }
};

/**
 * Corrige un análisis previo de comida usando IA con feedback del usuario
 * @param originalResult - Resultado original del análisis
 * @param correction - Descripción del usuario sobre qué corregir
 * @param base64Image - Imagen original en base64 (opcional, si viene de foto)
 * @param retryCount - Número de reintentos (interno)
 * @returns Promesa con el análisis nutricional corregido
 */
export const correctFoodAnalysis = async (
    originalResult: FoodAnalysisResult,
    correction: string,
    base64Image?: string,
    retryCount = 0
): Promise<FoodAnalysisResult> => {
    const genAI = getActiveGenAI();
    if (!genAI) {
        throw new Error("No se ha configurado la API Key de Gemini. Por favor, añade VITE_GEMINI_API_KEY a tu archivo .env");
    }

    const MAX_RETRIES = 2;
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
Eres un experto nutricionista corrigiendo un análisis nutricional previo basado en feedback del usuario.

ANÁLISIS ORIGINAL:
{
  "name": "${originalResult.name}",
  "calories": ${originalResult.calories},
  "portion": "${originalResult.portion}",
  "confidence": ${originalResult.confidence},
  "macros": {
    "protein": ${originalResult.macros.protein},
    "carbs": ${originalResult.macros.carbs},
    "fats": ${originalResult.macros.fats}
  }
}

CORRECCIÓN DEL USUARIO: "${correction}"

Tu tarea:
- Re-analizá los datos considerando la corrección del usuario
- Mantené la estructura original pero ajustá los valores según la corrección
- Si el usuario menciona ingredientes diferentes, ajustá calorías y macros
- Si el usuario menciona porción diferente, recalculá todo proporcionalmente
- Responde ÚNICAMENTE con JSON válido, sin texto adicional ni markdown

El JSON debe tener EXACTAMENTE esta estructura:

{
  "name": "Nombre corregido del plato en español",
  "calories": 750,
  "portion": "Porción corregida (aprox 350g)",
  "confidence": 85,
  "macros": {
    "protein": 30,
    "carbs": 50,
    "fats": 25
  },
  "ingredients": [
    { "name": "Ingrediente 1", "calories": 180 },
    { "name": "Ingrediente 2", "calories": 250 }
  ]
}

Reglas:
- 1g proteína = 4 kcal, 1g carbs = 4 kcal, 1g grasa = 9 kcal
- Los macros deben ser coherentes con las calorías totales (±15%)
- Subí el confidence si la corrección clarifica ambigüedades
`;

    try {
        let contentParts: any[] = [prompt];

        // Si hay imagen, incluirla para contexto adicional
        if (base64Image) {
            const base64Data = base64Image.split(',')[1] || base64Image;
            contentParts.push({
                inlineData: {
                    data: base64Data,
                    mimeType: "image/jpeg"
                }
            });
        }

        const result = await model.generateContent(contentParts);
        const response = await result.response;
        let text = response.text();

        // Limpiar formato markdown
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const parsedData: FoodAnalysisResult = JSON.parse(text);

        // Validación estricta de campos requeridos
        if (
            typeof parsedData.calories !== "number" ||
            typeof parsedData.name !== "string" ||
            !parsedData.macros ||
            typeof parsedData.macros.protein !== "number" ||
            typeof parsedData.macros.carbs !== "number" ||
            typeof parsedData.macros.fats !== "number"
        ) {
            console.error("Respuesta inválida de Gemini:", text);
            throw new Error("La IA devolvió un formato inválido. Intentá de nuevo.");
        }

        return parsedData;

    } catch (error: any) {
        // Reintentar en caso de error de red o timeout
        if (retryCount < MAX_RETRIES && (error.message?.includes('timeout') || error.message?.includes('network'))) {
            console.log(`Reintentando corrección (intento ${retryCount + 1}/${MAX_RETRIES})...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return correctFoodAnalysis(originalResult, correction, base64Image, retryCount + 1);
        }

        // Detectar error de quota/rate limit y cambiar de API inmediatamente
        if (error.message?.includes('quota') || error.message?.includes('rate limit') || error.message?.includes('429')) {
            if (hasAlternativeApi() && retryCount < MAX_RETRIES) {
                switchToNextApi();
                console.log(`⚡ Límite alcanzado. Reintentando corrección con API alternativa...`);
                await new Promise(resolve => setTimeout(resolve, 500));
                return correctFoodAnalysis(originalResult, correction, base64Image, retryCount + 1);
            }

            throw new Error("Se alcanzó el límite de uso de ambas APIs. Intentá en unos minutos.");
        }

        console.error("Error correcting food analysis:", error);

        if (error.message?.includes('API key')) {
            throw new Error("Error de configuración de API. Contactá al administrador.");
        }

        throw error;
    }
};

/**
 * Analiza una imagen de comida usando Gemini AI
 * @param base64Image - Imagen en formato base64 (con o sin prefijo data:image)
 * @param retryCount - Número de reintentos (interno)
 * @returns Promesa con el análisis nutricional
 */
export const analyzeFoodImage = async (base64Image: string, retryCount = 0): Promise<FoodAnalysisResult> => {
    const genAI = getActiveGenAI();
    if (!genAI) {
        throw new Error("No se ha configurado la API Key de Gemini. Por favor, añade VITE_GEMINI_API_KEY a tu archivo .env");
    }

    const MAX_RETRIES = 2;

    // Obtenemos el modelo gemini-2.5-flash
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Prompt optimizado para mejor precisión
    const prompt = `
Eres un experto nutricionista y analista de imágenes de alimentos. Analiza la foto y extrae información nutricional detallada.

IMPORTANTE:
- Responde ÚNICAMENTE con JSON válido, sin texto adicional ni markdown
- Si la imagen no es comida, devuelve: {"error": "no_food_detected"}
- Estimá porciones realistas basadas en referencias visuales comunes

El JSON debe tener EXACTAMENTE esta estructura:

{
  "name": "Nombre descriptivo del plato en español",
  "calories": 750,
  "portion": "Porción media (aprox 350g)",
  "confidence": 85,
  "macros": {
    "protein": 30,
    "carbs": 50,
    "fats": 25
  },
  "ingredients": [
    { "name": "Ingrediente 1", "calories": 180 },
    { "name": "Ingrediente 2", "calories": 250 }
  ]
}

Reglas nutricionales:
- 1g proteína = 4 kcal, 1g carbs = 4 kcal, 1g grasa = 9 kcal
- Los macros deben ser coherentes con las calorías totales (±15%)
- Bajá el confidence si la imagen es oscura, borrosa o hay múltiples platos
`;

    try {
        // Limpiar prefijo data:image si existe
        const base64Data = base64Image.split(',')[1] || base64Image;

        const imageParts = [
            {
                inlineData: {
                    data: base64Data,
                    mimeType: "image/jpeg"
                }
            }
        ];

        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        let text = response.text();

        // Limpiar formato markdown
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        // Detectar error de no-comida
        if (text.includes('"error"') && text.includes('no_food_detected')) {
            throw new Error("No se detectó comida en la imagen. Por favor, tomá una foto de un plato o alimento.");
        }

        const parsedData: FoodAnalysisResult = JSON.parse(text);

        // Validación estricta de campos requeridos
        if (
            typeof parsedData.calories !== "number" ||
            typeof parsedData.name !== "string" ||
            !parsedData.macros ||
            typeof parsedData.macros.protein !== "number" ||
            typeof parsedData.macros.carbs !== "number" ||
            typeof parsedData.macros.fats !== "number"
        ) {
            console.error("Respuesta inválida de Gemini:", text);
            throw new Error("La IA devolvió un formato inválido. Intentá de nuevo.");
        }

        // Validación de coherencia nutricional (opcional, solo log)
        const calculatedCalories = (parsedData.macros.protein * 4) + (parsedData.macros.carbs * 4) + (parsedData.macros.fats * 9);
        const diff = Math.abs(calculatedCalories - parsedData.calories);
        if (diff > parsedData.calories * 0.2) {
            console.warn(`Advertencia: macros no coherentes con calorías. Calculadas: ${calculatedCalories}, Reportadas: ${parsedData.calories}`);
        }

        return parsedData;

    } catch (error: any) {
        // Reintentar en caso de error de red o timeout
        if (retryCount < MAX_RETRIES && (error.message?.includes('timeout') || error.message?.includes('network'))) {
            console.log(`Reintentando análisis de imagen (intento ${retryCount + 1}/${MAX_RETRIES})...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return analyzeFoodImage(base64Image, retryCount + 1);
        }

        // Detectar error de quota/rate limit y cambiar de API inmediatamente
        if (error.message?.includes('quota') || error.message?.includes('rate limit') || error.message?.includes('429')) {
            if (hasAlternativeApi() && retryCount < MAX_RETRIES) {
                switchToNextApi();
                console.log(`⚡ Límite alcanzado. Reintentando análisis de imagen con API alternativa...`);
                await new Promise(resolve => setTimeout(resolve, 500));
                return analyzeFoodImage(base64Image, retryCount + 1);
            }

            throw new Error("Se alcanzó el límite de uso de ambas APIs. Intentá en unos minutos.");
        }

        console.error("Error analyzing food image:", error);

        // Mensajes de error más amigables
        if (error.message?.includes('API key')) {
            throw new Error("Error de configuración de API. Contactá al administrador.");
        }

        throw error;
    }
};
