import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAQJURNe3rYYvN6Jp4bDfP2_jqIgo6YelM",
  authDomain: "voucher-drop.firebaseapp.com",
  projectId: "voucher-drop",
  storageBucket: "voucher-drop.firebasestorage.app",
  messagingSenderId: "81485864306",
  appId: "1:81485864306:web:35c3b3d3262d61bf1651eb",
  measurementId: "G-FP1BPBJ2YK"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;

export { app, db, analytics };
