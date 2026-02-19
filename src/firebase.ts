import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCPr6TFhnmV8B_qHzl7tzxjSKyMb7hsonQ",
    authDomain: "app-nia.firebaseapp.com",
    projectId: "app-nia",
    storageBucket: "app-nia.firebasestorage.app",
    messagingSenderId: "240078329328",
    appId: "1:240078329328:web:7c04ea4297dd0b545ab935"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
