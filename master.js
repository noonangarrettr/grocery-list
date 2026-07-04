const sectionsEl = document.getElementById("sections");

const STORE_COLORS = {
  "Vons": "var(--c-vons)",
  "Smart & Final": "var(--c-smart)",
  "Costco": "var(--c-costco)",
  "Trader Joe's": "var(--c-tj)",
  "Other": "var(--c-other)"
};

// Build one section per store, each with its own live listener
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

  // Live updates for this store's common items
  db.collection("commonItems")
    .where("store", "==", store)
    .orderBy("name")
    .onSnapshot((snapshot) => {
      list.innerHTML = "";
      if (snapshot.empty) {
        const empty = document.createElement("div");
        empty.className = "common-item-row";
        empty.innerHTML = `<span class="eyebrow">No regulars yet</span>`;
        list.appendChild(empty);
        return;
      }
      snapshot.docs.forEach((doc) => {
        const row = document.createElement("div");
        row.className = "common-item-row";

        const name = document.createElement("span");
        name.textContent = doc.data().name;

        const del = document.createElement("button");
        del.className = "item-delete";
        del.textContent = "✕";
        del.setAttribute("aria-label", "Remove regular");
        del.addEventListener("click", () => {
          db.collection("commonItems").doc(doc.id).delete();
        });

        row.appendChild(name);
        row.appendChild(del);
        list.appendChild(row);
      });
    }, (err) => console.error("commonItems listener:", err));

  // Add a new regular to this store
  addRow.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = addRow.querySelector("input");
    const trimmed = input.value.trim();
    if (!trimmed) return;

    // Prevent duplicate regulars within the same store
    const existing = await db.collection("commonItems")
      .where("store", "==", store)
      .get();
    const dup = existing.docs.find(
      (d) => d.data().name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (dup) {
      alert(`"${trimmed}" is already a regular for ${store}.`);
      return;
    }

    await db.collection("commonItems").add({
      name: trimmed,
      store: store,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    input.value = "";
  });
});
