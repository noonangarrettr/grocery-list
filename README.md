# The List — shared grocery shopping app

Two pages:
- **index.html** — the shopping list, used in-store. Switch stores with the tabs, tap chips to quick-add regulars, check items off as you shop.
- **master.html** — "Regulars," where you manage the common items per store.

## 1. Create the Firebase project

1. Go to https://console.firebase.google.com → **Add project**. Name it whatever you like (e.g. `noonan-grocery-list`).
2. Once created, click the **web** icon (`</>`) to register a web app. Skip Firebase Hosting — you're using GitHub Pages.
3. Copy the `firebaseConfig` object it gives you and paste the values into `firebase-config.js` in this folder, replacing the placeholders.

## 2. Turn on Firestore

1. In the Firebase console, go to **Build → Firestore Database → Create database**.
2. Choose **production mode** (the rules below lock it down).
3. Pick a region close to San Diego (e.g. `us-west1` / `nam5`).

## 3. Set security rules

Firestore → **Rules**, replace the contents with `firestore.rules` from this folder, then **Publish**. Since there's no login, this scopes access to only the two collections the app uses — it won't stop your wife (or anyone with the URL) from reading/writing, but it does stop the database from being wide open to arbitrary collections.

## 4. Composite indexes

The app runs a couple of queries that need composite indexes (store + checked + date, etc.). You don't need to set these up manually — the first time you use the app, open the browser console (if something doesn't load), and Firestore will print an error with a direct link that creates the exact index needed with one click. `firestore.indexes.json` is included here too if you ever set up the Firebase CLI and want to deploy them that way instead.

## 5. Deploy to GitHub Pages

1. Push this folder's contents to a repo under `noonangarrettr` (e.g. `grocery-list`).
2. Repo → **Settings → Pages** → set source to the `main` branch, root folder.
3. Your app will be live at `https://noonangarrettr.github.io/grocery-list/`.

## 6. First use

Open the site, go to **Regulars**, and seed each store with the items you buy often. Then switch to **The List** and start shopping.

## Data model

**`commonItems`** (the Regulars / quick-add library)
- `name` (string)
- `store` (string — one of Vons, Smart & Final, Costco, Trader Joe's, Other)
- `createdAt` (timestamp)

**`shoppingItems`** (the live list)
- `name` (string)
- `notes` (string, optional — quantity or details)
- `store` (string)
- `checked` (boolean)
- `createdAt` (timestamp)

Checked items stay on the list, struck through, until you tap **Void Checked**, which only removes checked items and leaves the rest untouched.
