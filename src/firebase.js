import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDRx4F-qpMWwHtI3tSxkY5reeuN1lAkVgI",
  authDomain: "ntt-wc-game.firebaseapp.com",
  projectId: "ntt-wc-game",
  storageBucket: "ntt-wc-game.firebasestorage.app",
  messagingSenderId: "882337808922",
  appId: "1:882337808922:web:0798967c3dcbb0c08207a3",
  measurementId: "G-KGH9M111PD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth and Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);
