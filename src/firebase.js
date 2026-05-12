import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD_NThP0Wl_f_fZO-F_tkxuLvEZIvO_LuQ",
  authDomain: "lyrova-1ccab.firebaseapp.com",
  projectId: "lyrova-1ccab",
  storageBucket: "lyrova-1ccab.firebasestorage.app",
  messagingSenderId: "796048764105",
  appId: "1:796048764105:web:381c43b12ccd93b6973118",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);