import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyBjlF360WY0Z-xefFMujXryn7XeG9C5lY0",
  authDomain: "extended-studio.firebaseapp.com",
  projectId: "extended-studio",
  storageBucket: "extended-studio.firebasestorage.app",
  messagingSenderId: "910732755063",
  appId: "1:910732755063:web:6f3d3655ff691610920672",
  measurementId: "G-ZKMVPJV6TQ"
};

export const VAPID_KEY = "BOX_jHrv7CgYj72_zLjrAwhhaCGduiFINqBzpEv5Clj8DD9Wt9vZESm4-s61D8sMWBWGMCCchMIPlsXuW8RiB9w";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Messaging은 브라우저 지원 여부 확인 후 lazy init
let _messaging = null;
export async function getFcmMessaging() {
  if (_messaging) return _messaging;
  const supported = await isSupported().catch(() => false);
  if (!supported) return null;
  _messaging = getMessaging(app);
  return _messaging;
}

export { getToken, onMessage };
