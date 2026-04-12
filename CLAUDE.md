# pantry-tracker — Claude Code Instructions

## Project Overview

A **camera-first household inventory system** — scan barcodes continuously like a real scanner (no photo-per-item), log expiration dates, and view what's in the fridge/freezer/pantry.

This is a standalone POC that will later become a module in a larger personal life management system. Build clean separation so future modules (todo, habits, kitchen assistant, analytics) can plug in without refactoring.

---

## Monorepo Structure

```
pantry-tracker/
├── backend/          # Spring Boot 3 REST API
├── frontend/         # React 18 + Vite + TypeScript
├── CLAUDE.md         # This file
└── README.md
```

---

## Tech Stack

| Layer       | Technology                                                   |
|-------------|--------------------------------------------------------------|
| Frontend    | React 18.2, Vite 5, TypeScript 5.2                           |
| Styling     | Tailwind CSS 3.3.5 (custom "brand" green palette)            |
| Routing     | React Router DOM 6.20                                        |
| Data        | TanStack React Query 5                                       |
| HTTP        | Axios 1.6 (internal API) + raw `fetch` (TheMealDB)           |
| Barcode     | @zxing/browser 0.1.5 (continuous stream)                     |
| OCR         | Tesseract.js 5.0 (installed, not yet wired up)               |
| Backend     | Java 21, Spring Boot 3.2.5, Maven                            |
| Database    | MongoDB Atlas (M0 free tier)                                 |
| Product API | Open Food Facts                                              |
| Recipe API  | TheMealDB (free, called directly from frontend) + Spoonacular (proxied via backend) |
| Auth        | JWT via JJWT 0.11.5 — 15 min access / 30 day refresh (issued, not enforced on routes) |
| Hosting     | Railway (backend), GitHub Pages (frontend) — not yet deployed |

---

## Core Feature: Continuous Barcode Scanning

This is the most important UX requirement. The scanner must behave like a physical barcode scanner — not a camera app.

**Required behavior:**
- Stream live video continuously via `@zxing/browser` `BrowserMultiFormatReader.decodeFromVideoDevice()`
  - **IMPORTANT:** `BrowserMultiFormatContinuousReader` does not exist in `@zxing/browser 0.1.5` — always use `BrowserMultiFormatReader`
- Decode every frame in real time — no button press to scan
- On barcode detection:
  - Play an audible beep (1046 Hz sine wave, 0.3 gain, 150 ms)
  - Show 300 ms green flash on the scan frame
  - Call backend to look up product
  - Add item to a **staging list** (visible alongside camera)
  - Camera continues immediately — ready for next item
- **Deduplication:** ignore the same barcode if seen again within 3 seconds (`DEBOUNCE_MS = 3000`)
- After scanning all items, user reviews staging list, fills in expiry dates and locations, then confirms all at once

**Never implement:** photo-per-scan, manual "capture" button for barcodes.

---

## Expiration Date Flow

**Not yet implemented.** Tesseract.js is installed but not wired up.

Planned flow:
1. After a barcode is confirmed in staging, user taps "add expiry"
2. Camera switches to photo mode (single capture)
3. Tesseract.js attempts OCR on the captured image
4. Detected date string shown to user for confirmation/correction
5. User can also type the date manually — OCR result is a suggestion, not final

---

## Inventory Data Model

```json
{
  "id": "string",
  "name": "string",
  "barcode": "string | null",
  "brand": "string | null",
  "quantity": 1,
  "location": "FRIDGE | FREEZER | PANTRY | SUNDRIES",
  "expiryDate": "ISO date or null",
  "imageUrl": "string or null",
  "consumptionLevel": 1.0,
  "isStaple": false,
  "restockThreshold": 0.25,
  "createdAt": "ISO datetime"
}
```

**`location`** — backend stores as uppercase enum (`PANTRY`, `FRIDGE`, etc.). Frontend sends lowercase (`"pantry"`). Jackson is configured with `accept-case-insensitive-enums=true`. Always normalise with `.toLowerCase()` before comparing against frontend constants.

**`consumptionLevel`** — float 0.0–1.0. 1.0 = full/unopened, 0.0 = empty/consumed. Items at `consumptionLevel === 0` are hidden from Inventory view and considered consumed. The 5 discrete UI levels are 0, 0.25, 0.5, 0.75, 1.0.

**`isStaple`** — marks a product as a household staple that should always be stocked. When all packages of this product reach level 0, it appears on the shopping list. Inherited automatically when rescanning a product already marked staple.
- **Lombok gotcha:** The model field is `boolean isStaple`. Lombok generates `isStaple()` getter, which makes Jackson serialize/deserialize the JSON key as `"staple"` instead of `"isStaple"`. Fix: `@JsonProperty("isStaple")` on the field.

**`restockThreshold`** — default 0.25. Stored but not yet used in filtering (shopping list currently triggers at `consumptionLevel ≤ 0`).

**`item.name`** can be null for items saved before the lookup was working — always guard with `` ?? `Product ${item.barcode}` ``

---

## Recipe Data Model

```json
{
  "id": "string",
  "name": "string",
  "description": "string | null",
  "ingredients": [
    { "name": "chicken breast", "swedishName": "kycklingfilé | null", "amount": "200g" }
  ],
  "instructions": ["Step 1...", "Step 2..."],
  "servings": 4,
  "imageUrl": "string | null",
  "sourceUrl": "string | null",
  "sourceMealDbId": "string | null",
  "tags": ["pasta", "quick"],
  "createdAt": "ISO datetime"
}
```

- Stored in MongoDB collection `recipes`
- `sourceMealDbId` is set when imported via `POST /api/recipes/import` — used for dedup (import is idempotent)
- Ingredient `name` is always English (TheMealDB vocabulary) — this is what the missing-ingredient check uses
- `swedishName` is optional hint for display; not required
- `instructions` are stored as a flat list of step strings (split on newlines when importing from TheMealDB)

---

## Inventory View

The Inventory page (`/inventory`) uses a **compact tile grid** for quick in-store reference.

**Layout:**
- Location filter tabs at top: **Alla | 🧊 Fridge | ❄️ Freezer | 🥫 Pantry | 🧴 Sundries**
  - Each tab shows a count badge (number of unique product groups in that location)
  - "Alla" shows all locations with subtle section headers between them
- 2-column grid on mobile, 3-col on sm, 4-col on lg (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`)

**Tile (`ItemTile` component):**
- Top badge row (only rendered if there's content): `×N` on left (multi-package count), `⭐` on right (staple)
- Product name (`line-clamp-2`, `text-sm font-medium`)
- Brand (`text-xs text-gray-400`)
- Thin `h-1.5` consumption bar at very bottom (green/yellow/red, same thresholds as everywhere)
- Tapping opens `QuickUpdateModal` for `group.items[0]` (most depleted active package)

**Grouping:**
- Items are grouped by normalized product name within each location (same `groupByName()` function)
- Multi-package groups show `×N` badge on the tile
- The tile's consumption bar reflects `group.items[0]` (sorted lowest-level-first = most depleted active package)

**What was removed vs old design:**
- `ItemCard` and `PackageCard` components removed — replaced by `ItemTile`
- Delete buttons removed from the UI (items can be deleted via other means if needed)
- `expiryMeta()` helper removed — expiry no longer shown on tiles

**QuickUpdateModal** (unchanged):
- Level selector (0 / 25% / 50% / 75% / Full)
- "Mark as Staple" toggle
- Flash message when set to 0: "Next package is now active" (other packages exist) or "Added to shopping list" (no packages left, item is staple)

---

## Shopping List Logic

- Backend: `GET /api/inventory/shopping-list` — returns one representative item per product name group where **at least one package has `isStaple = true`** AND **all packages have `consumptionLevel ≤ 0`**
- Frontend `ShoppingList` page has two tabs: **Inköpslista** (the staple list) and **Deals 🏷️** (see below)
- Inköpslista renders items with colour-coded level bars (red ≤25%, yellow ≤50%, green >50%)
- **Auto-clearing on scan confirm:** `Scan.tsx` `handleConfirm()` finds existing items whose name matches (via `namesMatch()`) each newly scanned product, then calls `updateItem()` setting `isStaple = false` to remove them from the list

---

## Deals / Tjek Integration

Deal data comes from [Tjek](https://tjek.com) (squid-api.tjek.com), which aggregates Swedish grocery chain weekly ads.

**Backend — `TjekService.java`:**
- `extractKeyword(name)` — takes the longest word ≥ 5 letters from the product name (e.g. "Arla Mellanmjölk" → "Mellanmjölk"). Later word wins on tie (product type > brand).
- `search(query, lat, lng)` — extracts keyword, fetches offers from `/v2/offers/search?query=...&dealer_ids=...`, enriches with nearby store names if coords provided.
- Offer cache: keyword → offers, TTL 1 hour (`ConcurrentHashMap`).
- Catalog cache: grid cell "%.1f,%.1f" → dealer_id → store label, TTL 6 hours. Grid cells are ~11 km.
- `catalogLabel(catalog)` — priority: `catalog.label` → `dealer.name + " " + store.city` → `dealer.name`. Used because the `label` field is sometimes null in Tjek responses.
- Dealer IDs for Swedish chains configured in `application.properties` as `tjek.dealer-ids` (comma-separated).

**Backend — `DealsController.java`:**
- `GET /api/deals?query={name}&lat={lat}&lng={lng}` — lat/lng optional. Logs `query`, `lat`, `lng` at INFO level.

**Backend — DTOs:**
- `DealInfo` record: `heading, price, currency, storeName, imageUrl, runTill, nearbyStoreLabel`
- `DealResponse` record: `hasDeal, List<DealInfo> deals`

**Frontend — `api/deals.ts`:**
- `getDeal(query, lat?, lng?)` — GET `/api/deals` with params. Has a temporary `console.log('[getDeal] sending params', ...)` — remove once location display confirmed working.

**Frontend — `ShoppingList.tsx` Deals tab:**
- Geolocation requested once when the Deals tab is first opened (`geoRequested` ref prevents re-request).
- `useQueries` fires one `['deal', name, lat, lng]` query per shopping list item. Query key includes coords so queries automatically re-fire with location once geolocation resolves.
- `DealBadge` renders: `🏷️ ICA Kvantum · 45 kr · 📍 Hötorget` (chain name · price · location suffix).
- `locationSuffix(storeName, nearbyLabel)` strips the chain prefix from the catalog label to get just the store location (e.g. "ICA Kvantum Hötorget" → "Hötorget").
- `shortenStoreName()` abbreviates long chain names for badge display.
- Deals tab shows only items that have at least one deal; sorted cheapest first.
- Has temporary debug `console.log` statements in `DealBadge` and `DealsTab` — remove once location display confirmed.

**Known issue:** `nearbyStoreLabel` may be null if the Tjek catalog endpoint returns `label: null` and no `dealer`/`store` sub-objects. Check backend logs: `Catalog lookup lat=... → N catalogs` and per-catalog field dump (logged at INFO on first fetch).

---

## Expiry Date Notifications

**Backend:** `GET /api/inventory/expiring` — returns items where `expiryDate != null`, `expiryDate ≤ today + N days`, `consumptionLevel > 0`. Sorted by `expiryDate` ascending. Window configured via `inventory.expiry-warning-days=7` in `application.properties`.

**Frontend colour tiers** (used in Dashboard cards, Inventory item labels, and Navbar badge):
- Red (`text-red-*` / `bg-red-*`): expires today or tomorrow (≤ 1 day)
- Orange (`text-orange-*` / `bg-orange-*`): expires in 2–3 days
- Yellow (`text-yellow-*` / `bg-yellow-*`): expires in 4–7 days
- Gray: no expiry date set, or > 7 days away

**Dashboard:** "Expiring Soon" section — only renders when the `['expiring']` query returns items. Each card shows name, brand, days label ("Today!" / "Tomorrow" / "N days"), expiry date, consumption level bar.

**Inventory:** The compact grid view does not show expiry dates on tiles — expiry is surfaced via the Dashboard and Navbar badge. The `expiryMeta()` helper is no longer in `Inventory.tsx` (it was removed with the ItemCard/PackageCard redesign).

**Navbar badge:** Pantry link shows a red count badge when items with `days >= 0 && days <= 3` exist. Reads from the shared `['expiring']` React Query cache (no extra network call if Dashboard already fetched). Capped display at "9+".

---

## Recipe Feature

### Ingredient Mapping (`src/data/ingredientMap.ts`)

Static map of 200+ Swedish keyword → English ingredient name for TheMealDB lookups.

- Keys are lowercased Swedish product names or extracted keywords
- Values are English ingredient names in TheMealDB vocabulary
- Categories: dairy, meat/fish, vegetables, fresh herbs, pantry staples, baking, spices, condiments, fruits, nuts/seeds, cooking alcohol

### Ingredient Extraction (`src/utils/extractIngredients.ts`)

- `extractKeyword(name)` — same logic as Java `TjekService.extractKeyword`: longest word with ≥5 Unicode letter characters; later word wins on tie
- `extractIngredients(items)` — takes active inventory items (`consumptionLevel > 0`), tries full lowercased name then extracted keyword against `ingredientMap`, returns deduplicated English ingredient list

### TheMealDB Integration (`src/api/recipes.ts`)

TheMealDB is called **directly with raw `fetch`** (not Axios) — it's a public API with no auth. Base URL: `https://www.themealdb.com/api/json/v1/1`

- `fetchMealsByIngredient(ingredient)` → `GET /filter.php?i={ingredient_with_underscores}` — returns `MealSummary[]`. **Free tier only supports ONE ingredient per call.**
- `searchMealsByName(query)` → `GET /search.php?s={query}` — returns full `MealDetail[]` in one call
- `fetchMealDetail(id)` → `GET /lookup.php?i={id}` — returns single `MealDetail`
- TheMealDB returns `strIngredient1..20` and `strMeasure1..20` as top-level fields — `parseDetail()` maps these to `{ ingredient, measure }[]`, filtering out empty slots

### Recipes Page (`src/pages/Recipes.tsx`) — Route `/recipes`

Three-tab page:

**Tab 1 — "Mina ingredienser 🥫"** (default):
- Extracts ingredients from inventory via `extractIngredients()`
- Shows matched ingredient chips
- **Two-phase loading**: Phase 1 fetches `filter.php` for up to 8 ingredients in parallel → deduplicates meals by ID, ranks by frequency, takes top 20 → Phase 2 fetches full details for those 20 in parallel
- Phase 2 queries are enabled only after Phase 1 completes (via `every(q => !q.isLoading)` guard)
- Sort control: "Bäst match" (fewest missing, default) / "Flest ingredienser" (most matched) / "A-Ö"

**Tab 2 — "Sök recept 🔍"**:
- Debounced 400ms text input → `search.php?s=` (returns full details in one call, no Phase 2 needed)
- Same sort control and card format

**Tab 3 — "Mina recept ❤️"**:
- Loads from `GET /api/recipes`
- "➕ Skapa eget recept" button → inline `CreateRecipeForm` with dynamic ingredient/step rows
- Cards show ❤️ badge, same missing-ingredient display, 🗑️ delete

**Recipe card** (all tabs):
- Thumbnail, name, `✅ X hemma / 🛒 Y saknas`, missing ingredient list (up to 4 + "+N till")
- "🛒 Lägg till saknade varor" → POSTs each missing ingredient to `/api/inventory` with `isStaple: true, consumptionLevel: 0` (so they appear on the shopping list). Button changes to "✅ Tillagt" after click.
- Tap card body → opens detail view

**Recipe detail view** (inline, not a route):
- Full ingredient list with ✅/⬜ per line
- Step-by-step numbered instructions
- "🛒 Lägg till X saknade" button
- "❤️ Spara recept" (TheMealDB recipes only) → calls `POST /api/recipes/import`; idempotent
- YouTube link button if available
- Back button returns to tab

**Missing ingredient matching** (`ingredientPresent` function):
- Case-insensitive substring match: recipe ingredient `r` matches user ingredient `u` if `r === u`, `r.includes(u)`, or `u.includes(r)`
- e.g. user has "chicken" → recipe needs "chicken breast" → match

---

## Backend API Endpoints

```
GET    /api/inventory                   — list all items
GET    /api/inventory/shopping-list     — staple items with consumptionLevel ≤ 0, one per product group
GET    /api/inventory/expiring          — items expiring within N days (default 7), consumptionLevel > 0
POST   /api/inventory                   — create item (createdAt set server-side)
PUT    /api/inventory/{id}              — update item (name, brand, barcode, quantity, location,
                                          expiryDate, imageUrl, consumptionLevel, isStaple, restockThreshold)
DELETE /api/inventory/{id}              — remove item

POST   /api/barcode                     — lookup product info
  body:   { "barcode": "string" }
  return: { "productName": "string", "brand": "string", "imageUrl": "string" }

GET    /api/deals                       — search for deals at Swedish grocery chains
  params: query (product name), lat (optional), lng (optional)
  return: { "hasDeal": bool, "deals": [ DealInfo... ] }
  DealInfo fields: heading, price, currency, storeName, imageUrl, runTill, nearbyStoreLabel

GET    /api/recipes                     — list all personal saved recipes
POST   /api/recipes                     — create personal recipe
  body: { name, description?, ingredients:[{name,amount,swedishName?}], instructions:[], servings, tags:[], imageUrl? }
PUT    /api/recipes/{id}                — update personal recipe (same body as POST)
DELETE /api/recipes/{id}                — delete personal recipe
POST   /api/recipes/import              — import recipe from TheMealDB
  body: { "mealDbId": "12345" }
  return: saved Recipe document (idempotent — returns existing if already imported)

POST   /api/auth/register               — creates user, returns token pair (409 if username taken)
POST   /api/auth/login                  — validates credentials, returns token pair (401 on failure)
POST   /api/auth/refresh                — body: { "refreshToken": "..." }, returns new token pair
```

Open Food Facts call pattern:
`GET https://world.openfoodfacts.org/api/v0/product/{barcode}.json`
- Extract: `product.product_name` → fallback `product.product_name_en` → fallback `product.generic_name`
- Brand: `brands` field (trimmed, null if blank)
- Image: `image_url` field
- **Requires `User-Agent: pantry-tracker/1.0 (https://github.com/pantry-tracker)`** — without it, OFF blocks the request

**Known limitation:** Many Swedish barcodes return no results from Open Food Facts.

---

## Frontend Pages / Routes

| Route            | Component      | Description                                                               |
|------------------|----------------|---------------------------------------------------------------------------|
| `/`              | Dashboard      | Location counts, expiry warnings (from `/api/inventory/expiring`), scan CTA |
| `/inventory`     | Inventory      | Location filter tabs, compact 2–4 col tile grid, QuickUpdateModal         |
| `/scan`          | Scan           | Continuous scanner + staging list, confirm to add all at once             |
| `/add`           | Add            | Manual add form (name, brand, barcode, quantity, location, expiry)        |
| `/shopping-list` | ShoppingList   | Two tabs: Inköpslista (staples to restock) + Deals 🏷️ (Tjek deal badges) |
| `/recipes`       | Recipes        | Three tabs: inventory match, name search, saved personal recipes          |
| `/login`         | Login          | Username + password, stores JWT pair in localStorage                      |

Navbar links (bottom on mobile, top on desktop): Home 🏠 · Pantry 📦 (badge) · Scan 📷 · Shop 🛒 · Recept 🍳 · Add ➕

---

## Dev-Only Barcode Simulator

On `/scan`, when `import.meta.env.DEV` is true, a yellow panel shows **9 preset barcodes** and a **household data seeder** for testing without a physical camera.

Barcode buttons **bypass Open Food Facts lookup** and inject `productName`/`brand` directly into staging. Real scans still go through the full API flow.

| Barcode         | Product             | Brand       |
|-----------------|---------------------|-------------|
| `7310500144511` | Arla Mellanmjölk    | Arla        |
| `7622210449283` | McVitie's Digestive | McVitie's   |
| `5000174155747` | Häagen-Dazs Glass   | Häagen-Dazs |
| `7310610011065` | Lambi Toapapper     | Lambi       |
| `7340011405642` | Garant Lättmjölk    | COOP        |
| `7310060007898` | GB Vaniljglass      | GB          |
| `3033490004316` | Activia Naturell    | Activia     |
| `8076808002432` | Barilla Spaghetti   | Barilla     |
| `8001250210609` | De Cecco Spaghetti  | De Cecco    |

**"🏠 Seed household data" button** — POSTs 38 realistic Swedish household items directly to `/api/inventory` (bypasses staging). Covers all four locations with varied consumption levels. Used to populate a test dataset for the Inventory grid view. Data defined in `SEED_ITEMS` constant at the top of `Scan.tsx`.

---

## Smart Location Memory

`src/utils/locationMemory.ts` persists product→location mappings in localStorage.

- **Storage key:** `"pantry-location-memory"` (JSON-serialised Map)
- `rememberLocation(productName, location)` — saves normalized name → location on scan confirm
- `lookupLocation(productName)` — two-step lookup:
  1. Exact match on normalized (lowercased, trimmed) product name
  2. Keyword/suffix match via `namesMatch()` for Scandinavian compound words
  3. Returns `null` if no match
- When a location is auto-filled, staging list shows a `"📍 Remembered"` badge

---

## Name Matching (`src/utils/nameMatch.ts`)

Used by location memory and shopping list clearing.

- `namesMatch(a, b)` — true if any word pair from the two names `wordOverlap()`s
- `wordOverlap(a, b)` — true if:
  - Either word < 3 chars → false (skip noise)
  - Identical strings
  - One contains the other as substring
  - Shared suffix ≥ 4 characters (handles "mjölk" in "lättmjölk" / "mellanmjölk")
- Words are split on whitespace, lowercased, filtered to > 2 chars
- Used for: cross-brand matching (milk/milk, toilet paper/toilet paper), shopping list auto-clear on rescan

---

## Auth Notes

- JWT fully implemented: `JwtUtil`, `JwtAuthFilter`, `AuthService`
- Currently **not enforced** — `anyRequest().permitAll()` in `SecurityConfig`
- To enable: replace that line with `.requestMatchers("/api/auth/**").permitAll()` + `.anyRequest().authenticated()`
- Tokens stored in `localStorage` as `accessToken` and `refreshToken`
- Axios client has a **silent refresh interceptor**: on 401, attempts token refresh once, retries original request; on refresh failure clears tokens
- Access token: 15 min (`jwt.expiration=900000`), Refresh token: 30 days (`jwt.refresh-expiration=2592000000`)
- Password minimum: 8 characters (backend validation)
- `JwtAuthFilter` hardcodes `ROLE_USER` for all valid tokens — roles are not loaded from the User document
- No token blacklist/revocation, no logout endpoint
- Single user is fine for POC

---

## Security / CORS

Server-side CORS config (SecurityConfig) allows origins:
- `http://localhost:5173`
- `http://localhost:5174`
- `http://localhost:5175`
- `https://*.github.io`

Methods: GET, POST, PUT, DELETE, OPTIONS · Headers: `*` · Max age: 3600s · Path: `/api/**`

Axios client does **not** set `withCredentials` — tokens are passed via `Authorization: Bearer` header from localStorage, not cookies.

---

## MongoDB Atlas

- Cluster: **Winterunmute** (AWS eu-north-1)
- Database: `pantrytracker`
- Collections: `inventory`, `users`, `recipes`
- **User: `pantryuser`** (not `Winterunmute` — that user had auth issues)
- URI format: `mongodb+srv://pantryuser:<pass>@winterunmute.7hloc.mongodb.net/pantrytracker?appName=Winterunmute`
- **NordVPN must be OFF** — Atlas IP allowlist blocks VPN exit nodes
- `application-local.properties` is gitignored — create from the `.example` file

---

## Development Status

### Done ✅
1. Backend scaffolding (Spring Boot 3, MongoDB, REST API)
2. Frontend scaffolding (React 18, Vite, Tailwind, React Query)
3. Continuous barcode scanner (`BrowserMultiFormatReader`, beep, flash, 3s dedup)
4. Inventory CRUD (backend + frontend)
5. Multi-package tracking + consumption levels (0–1.0, QuickUpdateModal)
6. Staple items + shopping list (auto-populate, auto-clear on rescan)
7. Location memory (localStorage, suffix/substring matching)
8. JWT auth (tokens issued, silent refresh in Axios, login page)
9. Dev barcode simulator (9 preset items, bypasses OFF)
10. Expiry date notifications (dashboard section, navbar badge)
11. Tjek deal integration (TjekService, DealsController, DealInfo/DealResponse DTOs, api/deals.ts, Deals tab in ShoppingList)
12. Inventory compact grid redesign (location tabs, 2–4 col tile grid, ItemTile with ×N and ⭐)
13. Dev household data seeder (38 Swedish items across all 4 locations, "🏠 Seed household data" button)
14. Ingredient map (200+ Swedish → English mappings in `src/data/ingredientMap.ts`)
15. Recipe feature — TheMealDB integration (ingredient filter, name search, full detail fetch)
16. Recipe feature — Recipes page (`/recipes`) with 3 tabs: inventory match, name search, personal saved recipes
17. Recipe feature — Personal recipes backend (Recipe model, RecipeRepository, RecipeService, RecipeController, import from TheMealDB)
18. Recipe feature — Missing ingredient flow (compare recipe vs inventory, "🛒 Lägg till saknade" → adds to shopping list)
19. Shopping mode (Handla-läge) — full-screen checklist overlay in `ShoppingList.tsx`: tap to check off items, strikethrough + sort-to-bottom, progress bar, "✅ Klar" when all done
20. Spoonacular integration — `SpoonacularController.java` backend proxy (3 endpoints: search, findByIngredients, recipe/{id}); `importFromSpoonacular()` in `RecipeService`; `sourceSpoonacularId` field on `Recipe` model; parallel search alongside TheMealDB in `InventoryTab` and `SearchTab`; `SourceBadge` component (orange MealDB / green Spoonacular); HTML instruction rendering via `dangerouslySetInnerHTML` when instructions contain `<`

### Not yet done ❌
- **📍 location in deal badges** — `nearbyStoreLabel` may be null; catalog fallback logic added but needs live testing. Debug `console.log`s still present in `api/deals.ts` and `ShoppingList.tsx` — remove once confirmed working
- **Spoonacular end-to-end confirmation** — free-tier 50-point daily quota can be exhausted during dev. Debug `console.log`s intentionally kept in `recipes.ts` and `Recipes.tsx` — remove once results confirmed flowing through UI. API key in `application-local.properties` (gitignored).
- **Expiry date OCR** — Tesseract.js installed but not wired up
- **Auth enforcement** — JWT validated but all routes still `permitAll()`
- **Deployment** — Railway + GitHub Pages not yet configured (see TODO below)

---

## TODO / Next Steps

1. **Confirm deal location display** — restart backend, open Deals tab with location permission, read backend INFO logs for "Catalog lookup lat=... → N catalogs". Fix root cause if `nearbyStoreLabel` still null, then strip debug `console.log`s from `api/deals.ts` and `ShoppingList.tsx`.
2. **Deploy** — split into separate repos for Railway (backend) + GitHub Pages (frontend). Backend needs `application-prod.properties` with Railway env var injection. Frontend needs `VITE_API_BASE_URL` set to Railway URL at build time.
3. **Real camera testing** — test continuous scanner on a laptop with a physical barcode, WiFi connection to backend
4. **OCR expiry date scanning** — wire up Tesseract.js to a photo-capture mode after staging confirm
5. **Auth enforcement** — one-line change in `SecurityConfig`, then test token refresh flow end-to-end
6. **UI polish** — mobile-first pass, large touch targets audit, empty states
7. **Exam documentation** — kravspec, systemdokumentation, designdokumentation, projektplan

---

## Future Modules (do not implement, keep doors open)

- `todo/` — task system
- `habits/` — habit tracker
- `kitchen/` — recipe assistant (foundation now in place via Recipes page + ingredient map)
- `analytics/` — waste tracking, expiry trends

Keep backend package structure as `com.pantrytracker.inventory.*` so sibling packages can be added cleanly.

---

## Environment Variables

### Backend (`backend/src/main/resources/application-local.properties`)
```properties
spring.data.mongodb.uri=mongodb+srv://pantryuser:<pass>@winterunmute.7hloc.mongodb.net/pantrytracker?appName=Winterunmute
jwt.secret=<64-char hex string>
jwt.expiration=900000
jwt.refresh-expiration=2592000000
spoonacular.api-key=<key>
```

### Frontend (`frontend/.env.local`)
```
VITE_API_BASE_URL=http://localhost:8080
```

Frontend dev server defaults to **5173**, increments to 5174/5175 if port is busy. All three are in the CORS allowlist.

---

## Notes for Claude Code

- Ask before installing new dependencies not listed in this file
- Keep components small and single-responsibility
- Use React Query for all API state management — no `useEffect` for data fetching
- Tailwind only — no inline styles, no CSS modules
- Internal API calls go through `api/client.ts` (Axios). TheMealDB calls use raw `fetch` directly — it is the only exception (public API, no auth headers needed)
- Always normalise `item.location` with `.toLowerCase()` before comparing against frontend string constants
- Guard `item.name` with `` ?? `Product ${item.barcode}` `` — can be null for older items
- `consumptionLevel === 0` items are consumed/hidden — never surface them in inventory views
- When setting level to 0, check if other non-zero packages exist before deciding the toast message
- Shopping list clearing in `Scan.tsx` `handleConfirm()` uses `namesMatch()` — do not bypass with exact-string comparison
- `BrowserMultiFormatContinuousReader` does not exist in `@zxing/browser 0.1.5` — use `BrowserMultiFormatReader`
- `boolean isStaple` in the Java model needs `@JsonProperty("isStaple")` — without it, Lombok generates `isStaple()` and Jackson serializes the key as `"staple"`, breaking the frontend
- Expiry color tiers: red ≤1d, orange 2–3d, yellow 4–7d, gray >7d or null — keep these consistent across Dashboard and Navbar (Inventory tiles do not show expiry)
- The `['expiring']` React Query cache is shared between Dashboard and Navbar — Navbar does not make a separate network request if Dashboard has already fetched it
- Tjek `TjekCatalog` record needs `dealer` and `store` nested fields as fallbacks — `label` is sometimes null in API responses. `catalogLabel()` helper applies priority: label → dealer.name+city → dealer.name
- Tjek offer `dealer_id` must match catalog `dealer_id` for the nearby store lookup to work — if `nearbyStoreLabel` is null, check backend INFO logs for "Catalog lookup" line
- The `['deal', name, lat, lng]` React Query key intentionally includes coords — this causes queries to re-fire automatically once geolocation resolves, without any extra logic
- TheMealDB free tier (`/1/`) `filter.php` supports only ONE ingredient per request — fetch multiple in parallel and aggregate client-side. `search.php` returns full detail objects; `filter.php` returns only summary (id, name, thumbnail); `lookup.php` returns full detail for one meal by ID
- Recipe ingredient names in the `Recipe` model and in `ingredientMap` values must use TheMealDB vocabulary (English) — this is what `ingredientPresent()` compares against
- "Add missing to shopping list" posts with `isStaple: true, consumptionLevel: 0` — both flags are required for the item to appear on the shopping list (the shopping list filter requires `isStaple = true AND consumptionLevel ≤ 0`)
- `RecipeService.importFromMealDb` is idempotent — it checks `existsBySourceMealDbId` before fetching TheMealDB. Re-importing returns the existing document.
- `RecipeService.importFromSpoonacular` is idempotent — checks `existsBySourceSpoonacularId`. `sourceSpoonacularId` is stored as a String (not int) on the `Recipe` model.
- Spoonacular API key must be in `application-local.properties` as `spoonacular.api-key=<key>` — placeholder in `application.properties` (empty). Free tier: 50 points/day; `complexSearch` with `addRecipeInformation=true` costs ~1 point, `findByIngredients` ~1 point, `recipe/{id}` ~1 point.
- Spoonacular calls go through the backend proxy (`/api/spoonacular/*`) — never call `api.spoonacular.com` directly from the frontend. `SpoonacularController` catches `HttpClientErrorException` and returns HTTP 200 with empty data on quota/auth errors (graceful degradation).
- Spoonacular recipe IDs are prefixed `spoon_${id}` in the frontend to avoid collision with TheMealDB string IDs. Phase 2 detail fetcher dispatches by checking `meal.id.startsWith('spoon_')`.
- Spoonacular instructions may be HTML (`<ol><li>…</li></ol>`). Detected via `detail.instructions?.includes('<')` — render with `dangerouslySetInnerHTML` + Tailwind `[&_ol]:list-decimal [&_li]:leading-relaxed`. TheMealDB instructions are plain text split on `\r?\n`.
- Shopping mode (`ShoppingMode` component in `ShoppingList.tsx`) — full-screen fixed overlay, `useState<Set<string>>` for checked IDs, checked items sort to bottom with strikethrough/opacity-50, progress bar `w-[X%]`, exits on "✅ Klar" or back button.
