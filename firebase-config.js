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

// Realtime updates rely on a long-lived streaming connection. Firestore's
// default transport (WebChannel) is silently buffered or blocked by many
// mobile carriers, VPNs/proxies, and Safari configurations — when that
// happens, onSnapshot stops receiving live changes and the only way to see
// a new/checked/removed item is to reload the page. Auto-detecting long
// polling falls back to a transport that gets through, restoring realtime
// sync without a refresh. Must be set before any other Firestore use.
db.settings({ experimentalAutoDetectLongPolling: true });

// Offline cache so the list still works with bad signal in-store. Dropped
// synchronizeTabs: on a phone there's a single tab, and its multi-tab
// leader election is another thing that can stall updates on Safari.
db.enablePersistence().catch((err) => {
  console.warn("Offline persistence not enabled:", err.code);
});

const STORES = ["Vons", "Smart & Final", "Costco", "Trader Joe's", "Other"];
