// ---------- State ----------
// FULL is a pseudo-store: the consolidated view of every store's list.
const FULL = "Full List";

// Fall back to the first store if the remembered one is no longer offered —
// otherwise a device that last shopped at a since-removed store opens to an
// empty list with no tab selected.
const lastStore = localStorage.getItem("lastStore");
let currentStore = STORES.includes(lastStore) || lastStore === FULL ? lastStore : STORES[0];
let unsubItems = null;
let unsubCommon = null;
let unsubBadges = null;

// Local mirrors of the active store's data. Every user action mutates these
// and re-renders immediately, then writes to Firestore in the background —
// the UI never waits on the network. Snapshot listeners overwrite the
// mirrors whenever fresh data arrives (including edits from other devices).
let items = [];   // { id, name, notes, store, checked, createdAtMs }
let chips = [];   // { id, name }
let itemsLoaded = false;
let chipsLoaded = false;

// ---------- Store tabs ----------
const STORE_COLORS = {
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
function attachBadges() {
  if (unsubBadges) unsubBadges();
  unsubBadges = db.collection("shoppingItems").onSnapshot((snapshot) => {
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
}

// ---------- Full List toggle ----------
const fullBtn = document.getElementById("fullBtn");
fullBtn.addEventListener("click", () => switchStore(FULL));

// Store picker for the add bar — only shown on the Full List, where a new
// item has no single store to belong to. Defaults to the last store tab used.
const storeSelect = document.getElementById("storeSelect");
const STORE_SHORT = { "Smart & Final": "S&F", "Trader Joe's": "TJ's" };
STORES.forEach((store) => {
  const opt = document.createElement("option");
  opt.value = store;
  opt.textContent = STORE_SHORT[store] || store;
  storeSelect.appendChild(opt);
});
storeSelect.value = localStorage.getItem("lastAddStore") || STORES[0];
if (!storeSelect.value) storeSelect.value = STORES[0];
storeSelect.addEventListener("change", () => {
  localStorage.setItem("lastAddStore", storeSelect.value);
});

function applyStoreUI() {
  document.body.dataset.store = currentStore;
  document.querySelectorAll(".store-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.store === currentStore);
  });
  fullBtn.classList.toggle("active", currentStore === FULL);
}
applyStoreUI();

function switchStore(store) {
  currentStore = store;
  localStorage.setItem("lastStore", store);
  if (store !== FULL) {
    storeSelect.value = store;
    localStorage.setItem("lastAddStore", store);
  }
  applyStoreUI();
  items = [];
  chips = [];
  itemsLoaded = false;
  chipsLoaded = false;
  renderItems();
  renderChips();
  attachListeners();
}

// ---------- Firestore listeners ----------
function attachListeners() {
  if (unsubItems) unsubItems();
  if (unsubCommon) unsubCommon();

  // No orderBy: sorting happens locally in render, so these queries need no
  // composite indexes and can never break on a missing one.
  const itemsQuery = currentStore === FULL
    ? db.collection("shoppingItems")
    : db.collection("shoppingItems").where("store", "==", currentStore);
  unsubItems = itemsQuery
    .onSnapshot((snapshot) => {
      items = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          notes: data.notes || "",
          store: data.store,
          checked: !!data.checked,
          createdAtMs: data.createdAt ? data.createdAt.toMillis() : Date.now()
        };
      // Skip leftovers from stores no longer offered (e.g. a removed tab).
      }).filter((i) => STORES.includes(i.store));
      itemsLoaded = true;
      renderItems();
    }, (err) => console.error("shoppingItems listener:", err));

  // The Full List has no quick-add regulars.
  unsubCommon = null;
  if (currentStore === FULL) return;
  unsubCommon = db.collection("commonItems")
    .where("store", "==", currentStore)
    .onSnapshot((snapshot) => {
      chips = snapshot.docs.map((doc) => ({ id: doc.id, name: doc.data().name }));
      chipsLoaded = true;
      renderChips();
    }, (err) => console.error("commonItems listener:", err));
}

// iOS Safari kills idle connections when the app is backgrounded, the phone
// locks, or the network changes. Re-attach the listeners whenever the page
// comes back so the list is current without a manual refresh.
function reconnect() {
  attachBadges();
  attachListeners();
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) reconnect();
});
window.addEventListener("pageshow", (e) => {
  if (e.persisted) reconnect();
});
window.addEventListener("online", reconnect);

// ---------- Render: item list ----------
const itemList = document.getElementById("itemList");
const itemCount = document.getElementById("itemCount");

function sortItems(list) {
  return list.slice().sort(
    (a, b) => (a.checked - b.checked) || (a.createdAtMs - b.createdAtMs)
  );
}

function renderItems() {
  itemList.innerHTML = "";

  if (items.length === 0) {
    const emptyText = currentStore === FULL
      ? "Nothing on any list yet."
      : `Nothing on the ${currentStore} list yet.`;
    itemList.innerHTML = `<div class="empty-state">${
      itemsLoaded ? emptyText : "Loading…"
    }</div>`;
    itemCount.textContent = "";
    return;
  }

  if (currentStore === FULL) {
    // One group per store, in tab order, each tinted with its store color.
    STORES.forEach((store) => {
      const storeItems = items.filter((i) => i.store === store);
      if (storeItems.length === 0) return;
      const color = STORE_COLORS[store] || "var(--c-other)";
      const heading = document.createElement("li");
      heading.className = "store-group-heading";
      heading.style.setProperty("--accent", color);
      const open = storeItems.filter((i) => !i.checked).length;
      heading.innerHTML = `<span></span><span class="eyebrow"></span>`;
      heading.children[0].textContent = store;
      heading.children[1].textContent = `${open} left`;
      itemList.appendChild(heading);
      sortItems(storeItems).forEach((item) => itemList.appendChild(buildItemRow(item, color)));
    });
  } else {
    sortItems(items).forEach((item) => itemList.appendChild(buildItemRow(item)));
  }

  const checkedCount = items.filter((i) => i.checked).length;
  itemCount.textContent = `${checkedCount} of ${items.length} checked`;
}

function buildItemRow(item, color) {
  const li = document.createElement("li");
  li.className = "item-row" + (item.checked ? " checked" : "");
  if (color) li.style.setProperty("--accent", color);

  const check = document.createElement("div");
  check.className = "item-check";
  check.innerHTML = '<svg viewBox="0 0 18 18"><path d="M2.5 9.5 L7 14 L15.5 3.5"/></svg>';
  check.addEventListener("click", () => toggleItem(item.id));

  const text = document.createElement("div");
  text.className = "item-text";
  const name = document.createElement("div");
  name.className = "item-name";
  name.textContent = item.name;
  text.appendChild(name);
  if (item.notes) {
    const notes = document.createElement("div");
    notes.className = "item-notes";
    notes.textContent = item.notes;
    text.appendChild(notes);
  }

  const del = document.createElement("button");
  del.className = "item-delete";
  del.textContent = "✕";
  del.setAttribute("aria-label", "Remove item");
  del.addEventListener("click", () => deleteItem(item.id));

  li.appendChild(check);
  li.appendChild(text);
  li.appendChild(del);
  return li;
}

// ---------- Render: quick-add chips ----------
const chipRow = document.getElementById("chipRow");

function renderChips() {
  chipRow.innerHTML = "";
  if (currentStore === FULL) return;
  if (chips.length === 0) {
    if (chipsLoaded) {
      chipRow.innerHTML = `<span class="chip-empty">No regulars saved for ${currentStore} yet — add some on the Regulars page.</span>`;
    }
    return;
  }
  chips.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach((c) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = c.name;
    chip.addEventListener("click", () => addItem(c.name, ""));
    chipRow.appendChild(chip);
  });
}

// ---------- Actions: update the screen first, sync in the background ----------
function toggleItem(id) {
  const item = items.find((i) => i.id === id);
  if (!item) return;
  item.checked = !item.checked;
  renderItems();
  db.collection("shoppingItems").doc(id).update({ checked: item.checked })
    .catch((err) => console.error("toggle sync failed:", err));
}

function deleteItem(id) {
  items = items.filter((i) => i.id !== id);
  renderItems();
  db.collection("shoppingItems").doc(id).delete()
    .catch((err) => console.error("delete sync failed:", err));
}

function addItem(name, notes) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const store = currentStore === FULL ? storeSelect.value : currentStore;

  // Duplicate check against the local mirror — instant, no network round-trip.
  const dup = items.find(
    (i) => !i.checked && i.store === store && i.name.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (dup) {
    const proceed = confirm(`"${trimmed}" is already on the ${store} list. Add it again anyway?`);
    if (!proceed) return;
  }

  const ref = db.collection("shoppingItems").doc();
  items.push({
    id: ref.id,
    name: trimmed,
    notes: notes.trim(),
    store,
    checked: false,
    createdAtMs: Date.now()
  });
  renderItems();
  ref.set({
    name: trimmed,
    notes: notes.trim(),
    store,
    checked: false,
    createdAt: firebase.firestore.Timestamp.now()
  }).catch((err) => console.error("add sync failed:", err));
}

// ---------- Add form ----------
const addForm = document.getElementById("addForm");
const nameInput = document.getElementById("nameInput");
const notesInput = document.getElementById("notesInput");

addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  addItem(nameInput.value, notesInput.value);
  nameInput.value = "";
  notesInput.value = "";
  nameInput.focus();
});

// ---------- Clear checked ----------
document.getElementById("clearBtn").addEventListener("click", () => {
  const checkedItems = items.filter((i) => i.checked);
  if (checkedItems.length === 0) return;
  const where = currentStore === FULL ? "all lists" : currentStore;
  if (!confirm(`Remove ${checkedItems.length} checked item${checkedItems.length > 1 ? "s" : ""} from ${where}?`)) return;

  items = items.filter((i) => !i.checked);
  renderItems();
  const batch = db.batch();
  checkedItems.forEach((i) => batch.delete(db.collection("shoppingItems").doc(i.id)));
  batch.commit().catch((err) => console.error("clear checked sync failed:", err));
});

// ---------- Init ----------
attachBadges();
attachListeners();
