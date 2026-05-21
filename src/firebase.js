import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBjLF36OWYOZ-xefFMujXryn7XeG9C5lYO",
  authDomain: "extended-studio.firebaseapp.com",
  projectId: "extended-studio",
  storageBucket: "extended-studio.firebasestorage.app",
  messagingSenderId: "910732755063",
  appId: "1:910732755063:web:6f3d3655ff691610920672",
  measurementId: "G-ZKMVPJV6TQ"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
