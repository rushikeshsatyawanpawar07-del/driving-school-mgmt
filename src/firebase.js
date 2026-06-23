import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC2TuLS8tZv-7n_1K23-2RlGBGojXf52ik",
  authDomain: "driving-catalog.firebaseapp.com",
  projectId: "driving-catalog",
  storageBucket: "driving-catalog.firebasestorage.app",
  messagingSenderId: "979140342078",
  appId: "1:979140342078:web:3616ee48d9f48bffb93c6f"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;