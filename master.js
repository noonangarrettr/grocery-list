const sectionsEl = document.getElementById("sections");

const STORE_COLORS = {
  "Vons": "var(--c-vons)",
  "Smart & Final": "var(--c-smart)",
  "Costco": "var(--c-costco)",
  "Trader Joe's": "var(--c-tj)",
  "Other": "var(--c-other)"
};

// Re-attach hooks for every store section, used when the page comes back
// from the background and iOS Safari has killed the connections.
const reattachFns = [];

// Build one section per store, each with a local mirror of its regulars.
// Adds and deletes update the mirror and re-render instantly, then sync to
// Firestore in the background — the UI never waits on the network.
STORES.forEach((store) => {
  const section = document.createElement("section");
  section.className = "store-section";
  section.style.setProperty("--tab-color", STORE_COLORS[store] || "var(--c-other)");

  const heading = document.createElement("h2");
  heading.textContent = store;
  section.appendChild(heading);

  const list = document.createElement("div");
  list.className = "common-item-list";
  section.appendChild(list);

  const addRow = document.createElement("form");
  addRow.className = "master-add-row";
  addRow.innerHTML = `
    <input type="text" placeholder="Add a regular…" autocomplete="off" required>
    <button type="submit">Add</button>
  `;
  section.appendChild(addRow);

  sectionsEl.appendChild(section);

  let regulars = [];   // { id, name }
  let loaded = false;
  let unsub = null;

  function render() {
    list.innerHTML = "";
    if (regulars.length === 0) {
      const empty = document.createElement("div");
      empty.className = "common-item-row";
      empty.innerHTML = `<span class="eyebrow">${loaded ? "No regulars yet" : "Loading…"}</span>`;
      list.appendChild(empty);
      return;
    }
    regulars.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach((item) => {
      const row = document.createElement("div");
      row.className = "common-item-row";

      const name = document.createElement("span");
      name.textContent = item.name;

      const del = document.createElement("button");
      del.className = "item-delete";
      del.textContent = "✕";
      del.setAttribute("aria-label", "Remove regular");
      del.addEventListener("click", () => {
        regulars = regulars.filter((r) => r.id !== item.id);
        render();
        db.collection("commonItems").doc(item.id).delete()
          .catch((err) => console.error("delete sync failed:", err));
      });

      row.appendChild(name);
      row.appendChild(del);
      list.appendChild(row);
    });
  }

  function attach() {
    if (unsub) unsub();
    unsub = db.collection("commonItems")
      .where("store", "==", store)
      .onSnapshot((snapshot) => {
        regulars = snapshot.docs.map((doc) => ({ id: doc.id, name: doc.data().name }));
        loaded = true;
        render();
      }, (err) => console.error("commonItems listener:", err));
  }

  render();
  attach();
  reattachFns.push(attach);

  // Add a new regular to this store
  addRow.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = addRow.querySelector("input");
    const trimmed = input.value.trim();
    if (!trimmed) return;

    // Duplicate check against the local mirror — instant, no network round-trip.
    const dup = regulars.find(
      (r) => r.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (dup) {
      alert(`"${trimmed}" is already a regular for ${store}.`);
      return;
    }

    const ref = db.collection("commonItems").doc();
    regulars.push({ id: ref.id, name: trimmed });
    render();
    ref.set({
      name: trimmed,
      store: store,
      createdAt: firebase.firestore.Timestamp.now()
    }).catch((err) => console.error("add sync failed:", err));
    input.value = "";
  });
});

function reconnect() {
  reattachFns.forEach((fn) => fn());
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) reconnect();
});
window.addEventListener("pageshow", (e) => {
  if (e.persisted) reconnect();
});
window.addEventListener("online", reconnect);
