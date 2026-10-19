// Firebase browser project configuration provided by the project owner.
// This is a public Firebase WEB config, not an OAuth token, service account
// or permission to read Firestore. Private data is protected by Rules.
// Test-only isolated branch. Do not deploy to CRM main.
export const firebaseConfig = Object.freeze({
  apiKey: "AIzaSyB4EzMwS8hzDiec02jBVAe6ks5T8XiqELo",
  authDomain: "honbin-crm-notes-spark.firebaseapp.com",
  projectId: "honbin-crm-notes-spark",
  storageBucket: "honbin-crm-notes-spark.firebasestorage.app",
  messagingSenderId: "692331475098",
  appId: "1:692331475098:web:4c13d24c1f1d54f6922f23"
});
// This flag MUST NOT be confused with server-side security. The real
// Firestore production rules are currently DENY ALL. Real notes stay HOLD.
export const firestoreReadyForRealData = false;
