// ---------- State ----------
let currentStore = localStorage.getItem("lastStore") || STORES[0];
let unsubItems = null;
let unsubCommon = null;

// ---------- Store tabs ----------
const STORE_COLORS = {
  "Vons": "var(--c-vons)",
  "Smart & Final": "var(--c-smart)",
  "Costco": "var(--c-costco)",
  "Trader Joe's": "var(--c-tj)",
  "Other": "var(--c-other)"
};

const storeTabs = document.getElementById("storeTabs");
const badgeEls = {};
STORES.forEach((store) => {
  const btn = document.createElement("button");
  btn.className = "store-tab" + (store === currentStore ? " active" : "");
  btn.dataset.store = store;
  btn.style.setProperty("--tab-color", STORE_COLORS[store] || "var(--c-other)");

  const label = document.createElement("span");
  label.textContent = store;
  btn.appendChild(label);

  const badge = document.createElement("span");
  badge.className = "tab-badge";
  badge.style.display = "none";
  btn.appendChild(badge);
  badgeEls[store] = badge;

  btn.addEventListener("click", () => switchStore(store));
  storeTabs.appendChild(btn);
});

// Keep a running count of unchecked items per store, regardless of which
// store tab is active, so a shopper can see at a glance where things are needed.
db.collection("shoppingItems").onSnapshot((snapshot) => {
  const counts = {};
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (!data.checked) counts[data.store] = (counts[data.store] || 0) + 1;
  });
  STORES.forEach((store) => {
    const badge = badgeEls[store];
    const count = counts[store] || 0;
    badge.textContent = count;
    badge.style.display = count > 0 ? "flex" : "none";
  });
}, (err) => console.error("badge count listener:", err));

document.body.dataset.store = currentStore;

function switchStore(store) {
  currentStore = store;
  localStorage.setItem("lastStore", store);
  document.body.dataset.store = store;
  document.querySelectorAll(".store-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.store === store);
  });
  // Clear the previous store's list and chips immediately so its contents
  // never linger on screen while the new store's snapshot is loading. Without
  // this, the old store's items appear to "carry over" to the new list.
  itemList.innerHTML = `<div class="empty-state">Loading ${store}…</div>`;
  itemCount.textContent = "";
  chipRow.innerHTML = "";
  attachListeners();
}

// ---------- Firestore listeners ----------
function attachListeners() {
  if (unsubItems) unsubItems();
  if (unsubCommon) unsubCommon();

  unsubItems = db.collection("shoppingItems")
    .where("store", "==", currentStore)
    .orderBy("checked")
    .orderBy("createdAt")
    .onSnapshot(renderItems, (err) => console.error("shoppingItems listener:", err));

  unsubCommon = db.collection("commonItems")
    .where("store", "==", currentStore)
    .orderBy("name")
    .onSnapshot(renderChips, (err) => console.error("commonItems listener:", err));
}

// ---------- Render: item list ----------
const itemList = document.getElementById("itemList");
const itemCount = document.getElementById("itemCount");

function renderItems(snapshot) {
  itemList.innerHTML = "";
  const docs = snapshot.docs;

  if (docs.length === 0) {
    itemList.innerHTML = `<div class="empty-state">Nothing on the ${currentStore} list yet.</div>`;
    itemCount.textContent = "";
    return;
  }

  let checkedCount = 0;
  docs.forEach((doc) => {
    const data = doc.data();
    if (data.checked) checkedCount++;

    const li = document.createElement("li");
    li.className = "item-row" + (data.checked ? " checked" : "");

    const check = document.createElement("div");
    check.className = "item-check";
    check.innerHTML = '<svg viewBox="0 0 18 18"><path d="M2.5 9.5 L7 14 L15.5 3.5"/></svg>';
    check.addEventListener("click", () => {
      const willCheck = !data.checked;
      // Reflect the change instantly for tactile feedback; the snapshot
      // listener will re-render and re-sort a beat later.
      li.classList.toggle("checked", willCheck);
      db.collection("shoppingItems").doc(doc.id).update({ checked: willCheck });
    });

    const text = document.createElement("div");
    text.className = "item-text";
    const name = document.createElement("div");
    name.className = "item-name";
    name.textContent = data.name;
    text.appendChild(name);
    if (data.notes) {
      const notes = document.createElement("div");
      notes.className = "item-notes";
      notes.textContent = data.notes;
      text.appendChild(notes);
    }

    const del = document.createElement("button");
    del.className = "item-delete";
    del.textContent = "✕";
    del.setAttribute("aria-label", "Remove item");
    del.addEventListener("click", () => {
      db.collection("shoppingItems").doc(doc.id).delete();
    });

    li.appendChild(check);
    li.appendChild(text);
    li.appendChild(del);
    itemList.appendChild(li);
  });

  itemCount.textContent = `${checkedCount} of ${docs.length} checked`;
}

// ---------- Render: quick-add chips ----------
const chipRow = document.getElementById("chipRow");

function renderChips(snapshot) {
  chipRow.innerHTML = "";
  if (snapshot.empty) {
    chipRow.innerHTML = `<span class="chip-empty">No regulars saved for ${currentStore} yet — add some on the Regulars page.</span>`;
    return;
  }
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = data.name;
    chip.addEventListener("click", () => addItem(data.name, ""));
    chipRow.appendChild(chip);
  });
}

// ---------- Add item (with duplicate warning) ----------
async function addItem(name, notes) {
  const trimmed = name.trim();
  if (!trimmed) return;

  const existing = await db.collection("shoppingItems")
    .where("store", "==", currentStore)
    .where("checked", "==", false)
    .get();

  const dup = existing.docs.find(
    (d) => d.data().name.trim().toLowerCase() === trimmed.toLowerCase()
  );

  if (dup) {
    const proceed = confirm(`"${trimmed}" is already on the ${currentStore} list. Add it again anyway?`);
    if (!proceed) return;
  }

  await db.collection("shoppingItems").add({
    name: trimmed,
    notes: notes.trim(),
    store: currentStore,
    checked: false,
    // Client-side timestamp (not serverTimestamp) so the value exists
    // immediately. A pending serverTimestamp reads back as null locally,
    // which makes the createdAt ordering unstable and delays the new item
    // from settling into place until the server round-trip completes.
    createdAt: firebase.firestore.Timestamp.now()
  });
}

// ---------- Add form ----------
const addForm = document.getElementById("addForm");
const nameInput = document.getElementById("nameInput");
const notesInput = document.getElementById("notesInput");

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await addItem(nameInput.value, notesInput.value);
  nameInput.value = "";
  notesInput.value = "";
  nameInput.focus();
});

// ---------- Clear checked ----------
document.getElementById("clearBtn").addEventListener("click", async () => {
  const snapshot = await db.collection("shoppingItems")
    .where("store", "==", currentStore)
    .where("checked", "==", true)
    .get();

  if (snapshot.empty) return;
  if (!confirm(`Remove ${snapshot.size} checked item${snapshot.size > 1 ? "s" : ""} from ${currentStore}?`)) return;

  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
});

// ---------- Init ----------
attachListeners();
