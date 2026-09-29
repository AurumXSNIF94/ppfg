// src/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// Ganti dengan Config Firebase lo (ada di Project Settings Firebase Console)
const firebaseConfig = {
    apiKey: "AIzaSyBdzBG3TmaL2-QNcdzOknlez3lMgkAV5mg",
    authDomain: "ppfgwh-713a2.firebaseapp.com",
    databaseURL: "https://ppfgwh-713a2-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "ppfgwh-713a2",
    storageBucket: "ppfgwh-713a2.firebasestorage.app",
    messagingSenderId: "888290709822",
    appId: "1:888290709822:web:0e8b5f17e618d1eb7a1c6f"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
