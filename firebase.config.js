"use strict";

/**
 * Firebase config for Refocus (REST-only, no SDK).
 * Used by background.js for anonymous auth and Realtime Database writes.
 *
 * In Firebase Console:
 * - Authentication > Sign-in method: enable "Anonymous".
 * - Realtime Database > Rules: e.g.
 *   "feedbackEvents": { ".read": false, ".write": "auth != null" }
 *   (Optional: validate .write with messageId string, vote 1|0|-1, ts number, installId string.)
 */
var FIREBASE_CONFIG = {
  apiKey: "AIzaSyD8Y-e1MPjxDIFH3hLEz_hCteCDo_4YPQo",
  authDomain: "refocus-ed10f.firebaseapp.com",
  databaseURL: "https://refocus-ed10f-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "refocus-ed10f",
  storageBucket: "refocus-ed10f.firebasestorage.app",
  messagingSenderId: "234937135478",
  appId: "1:234937135478:web:82471cfdbbf9523c9c8a57"
};
