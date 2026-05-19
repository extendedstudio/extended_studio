import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAbRRZfWmS3n8kYUL8AvHfaxQXuQf018H8",
  authDomain: "extendedstudio-9c37e.firebaseapp.com",
  projectId: "extendedstudio-9c37e",
  storageBucket: "extendedstudio-9c37e.firebasestorage.app",
  messagingSenderId: "563838618066",
  appId: "1:563838618066:web:ca574ede1c4524b5d3e00b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
