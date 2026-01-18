import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDvyxvxizzz0ALkLw_uqnzc5ylhmtticIhM",
  authDomain: "scan2serve-63295.firebaseapp.com",
  projectId: "scan2serve-63295",
  storageBucket: "scan2serve-63295.firebasestorage.app",
  messagingSenderId: "732190149505",
  appId: "1:732190149505:web:f0b35a4763ba946a36b680",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);