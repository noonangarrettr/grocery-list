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

// Realtime updates depend on a streaming connection that iOS Safari and many
// mobile networks silently block or drop. Force the long-polling transport
// unconditionally — slightly chattier, but it works everywhere.
// (Auto-detection proved unreliable on the devices this app targets.)
db.settings({ experimentalForceLongPolling: true });

// NOTE: offline persistence (IndexedDB) is intentionally NOT enabled.
// Safari's IndexedDB is prone to wedging after the app is backgrounded,
// which stalls the whole SDK — including rendering of local writes — until
// a full page reload. Writes made with bad signal still queue in memory
// and commit when the connection recovers.

const STORES = ["Vons", "Smart & Final", "Costco", "Trader Joe's", "Other"];
