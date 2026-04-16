import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

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
// ignoreUndefinedProperties: campos opcionales en TS pueden ser undefined; Firestore los rechaza por default.
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
