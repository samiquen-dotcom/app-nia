import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

let genAI: GoogleGenerativeAI | null = null;
if (API_KEY) {
    genAI = new GoogleGenerativeAI(API_KEY);
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

export const analyzeFoodImage = async (base64Image: string): Promise<FoodAnalysisResult> => {
    if (!genAI) {
        throw new Error("No se ha configurado la API Key de Gemini. Por favor, añade VITE_GEMINI_API_KEY a tu archivo .env");
    }

    // Obtenemos el modelo gen-2.5-flash
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Preparar el prompt
    const prompt = `
Eres un experto nutricionista y analista de imágenes de alimentos. Analiza la foto y extrae información nutricional detallada.
Responde ÚNICAMENTE con un objeto JSON válido (sin marcas markdown ni texto extra). 
El objeto JSON debe tener EXACTAMENTE esta estructura y claves:

{
  "name": "Nombre descriptivo del plato detectado",
  "calories": 750, // Número entero, calorías totales estimadas
  "portion": "Porción media (aprox 350g)", // Texto indicando el tamaño de porción estimado
  "confidence": 85, // Número del 0 al 100 indicando tu nivel de confianza en esta predicción
  "macros": {
    "protein": 30, // gramos de proteína (número)
    "carbs": 50, // gramos de carbohidratos (número)
    "fats": 25 // gramos de grasa (número)
  },
  "ingredients": [
    { "name": "Pan", "calories": 180 },
    { "name": "Carne de res", "calories": 250 }
  ]
}

Importante: 
- Las calorías de ingredients deben sumar aproximadamente las calorías totales. 
- Los macros deben tener sentido nutricional con las calorías totales.
- Si no estás seguro de algo, da tu mejor estimación promedio pero refleja la duda en el valor "confidence" bajándolo.
`;

    try {
        // Si la imagen viene con "data:image/jpeg;base64,", lo limpiamos
        const base64Data = base64Image.split(',')[1] || base64Image;

        const imageParts = [
            {
                inlineData: {
                    data: base64Data,
                    mimeType: "image/jpeg" // Podemos asumir jpeg, la API lo entiende bien
                }
            }
        ];

        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        let text = response.text();

        // Limpiar posible formato markdown que devuelva (```json ... ```)
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const parsedData: FoodAnalysisResult = JSON.parse(text);

        if (typeof parsedData.calories !== "number" || typeof parsedData.name !== "string" || !parsedData.macros) {
            console.error("Respuesta inesperada de Gemini:", text);
            throw new Error("Invalid response format from Gemini: Missing required fields");
        }

        return parsedData;

    } catch (error) {
        console.error("Error analyzing food image:", error);
        throw error;
    }
};
