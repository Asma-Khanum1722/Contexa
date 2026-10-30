import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const clean = (val: string | undefined) => val?.replace(/^"|"$/g, "").trim();

const rawApiKey = clean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
const rawProjectId = clean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

export const isFirebaseConfigured = Boolean(rawApiKey && rawProjectId);

// Provide a valid dummy format key during static build / prerender if env vars aren't provided yet
const firebaseConfig = {
  apiKey: rawApiKey || "AIzaSyDummyKeyForStaticPrerendering000",
  authDomain: clean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) || "contexa-demo.firebaseapp.com",
  projectId: rawProjectId || "contexa-demo",
  storageBucket: clean(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) || "contexa-demo.appspot.com",
  messagingSenderId: clean(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) || "123456789012",
  appId: clean(process.env.NEXT_PUBLIC_FIREBASE_APP_ID) || "1:123456789012:web:abcdef0123456789"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app, auth };
