// src/firebase.js

import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// ⚠️ THE PLACEHOLDERS WITH YOUR ACTUAL CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyDyECrUSwAbRAaXzeQgFzaBY1DE5j61lCs",
  authDomain: "mytodoapp-11963.firebaseapp.com",
  projectId: "mytodoapp-11963",
  storageBucket: "mytodoapp-11963.firebasestorage.app",
  messagingSenderId: "98856306030",
  appId: "1:98856306030:web:72eb5cecda26a1962d2d7f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and export it
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Force the Google Account Chooser to appear every time
googleProvider.setCustomParameters({
  prompt: 'select_account'
});