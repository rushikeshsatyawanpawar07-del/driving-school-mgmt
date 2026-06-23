import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC2TuLS8tZv-7n_1K23-2RlGBGojXf52ik",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "driving-catalog.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "driving-catalog",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "driving-catalog.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "979140342078",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:979140342078:web:3616ee48d9f48bffb93c6f"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export default app;