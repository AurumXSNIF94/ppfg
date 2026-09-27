import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyBdzBG3TmaL2-QNcdzOknlez3lMgkAV5mg",
    authDomain: "ppfgwh-713a2.firebaseapp.com",
    databaseURL: "https://ppfgwh-713a2-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "ppfgwh-713a2",
    storageBucket: "ppfgwh-713a2.firebasestorage.app",
    messagingSenderId: "888290709822",
    appId: "1:888290709822:web:0e8b5f17e618d1eb7a1c6f"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();