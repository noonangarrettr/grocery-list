// Firebase project: noonan-grocery-list
const firebaseConfig = {
  apiKey: "AIzaSyAgOXlNEeJYtC_3BsN3OPf7O198fwYBrZg",
  authDomain: "noonan-grocery-list.firebaseapp.com",
  projectId: "noonan-grocery-list",
  storageBucket: "noonan-grocery-list.firebasestorage.app",
  messagingSenderId: "478909880363",
  appId: "1:478909880363:web:e2707e96dc503d3ef2326e"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Offline persistence so the list still works with bad signal in-store
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  console.warn("Offline persistence not enabled:", err.code);
});

const STORES = ["Vons", "Smart & Final", "Costco", "Trader Joe's", "Other"];
