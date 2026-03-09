import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyAlvst4JidFnBiNZEZnAfZ-pf9ipd6VM8M";
const genAI = new GoogleGenerativeAI(API_KEY);

async function checkModels() {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        console.log("Modelos disponibles:", data.models.map((m: any) => m.name));
    } catch (e) {
        console.error(e);
    }
}
checkModels();
