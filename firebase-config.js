import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCJzeCRVWEWNV1on9ZCreYoBphqawxAqBk",
    authDomain: "vghub-9b27c.firebaseapp.com",
    projectId: "vghub-9b27c",
    storageBucket: "vghub-9b27c.firebasestorage.app",
    messagingSenderId: "938682573346",
    appId: "1:938682573346:web:a4924950a9c9f78116e07b"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);