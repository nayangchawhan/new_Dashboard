import dotenv from 'dotenv';
dotenv.config();

export const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyDlLW27MJKryEE4juaVGcmjIotj5ueFebo",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "rasptemp-d5695.firebaseapp.com",
  databaseURL: process.env.FIREBASE_DATABASE_URL || "https://rasptemp-d5695-default-rtdb.firebaseio.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "rasptemp-d5695",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "rasptemp-d5695.appspot.com",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "936439079920",
  appId: process.env.FIREBASE_APP_ID || "1:936439079920:web:7a956f5f65ed3f3b497335"
};

export const RTDB_BASE_URL = firebaseConfig.databaseURL.replace(/\/$/, '');
