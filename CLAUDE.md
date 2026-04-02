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

| Layer       | Technology                                              |
|-------------|----------------------------------------------------------|
| Frontend    | React 18.2, Vite 5, TypeScript 5.2                      |
| Styling     | Tailwind CSS 3.3.5 (custom "brand" green palette)        |
| Routing     | React Router DOM 6.20                                    |
| Data        | TanStack React Query 5                                   |
| HTTP        | Axios 1.6                                                |
| Barcode     | @zxing/browser 0.1.5 (continuous stream)                 |
| OCR         | Tesseract.js 5.0 (installed, not yet wired up)           |
| Backend     | Java 21, Spring Boot 3.2.5, Maven                        |
| Database    | MongoDB Atlas (M0 free tier)                             |
| Product API | Open Food Facts                                          |
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

**`isStaple`** — if true, this product is a household staple that should always be stocked. When all packages of this product reach level 0, it appears on the shopping list. Inherited automatically when rescanning a product already marked staple.

**`restockThreshold`** — default 0.25. Currently stored but not yet used in shopping list filtering (list triggers at level ≤ 0).

**`item.name`** can be null for items saved before the lookup was working — always guard with `` ?? `Product ${item.barcode}` ``

---

## Multi-Package / Consumption Tracking

The inventory supports multiple open packages of the same product (e.g., two cartons of milk). Key rules:

- Items are **grouped by normalized product name** (case-insensitive, trimmed) in the Inventory view
- **Single-package groups:** shown as one `ItemCard` (name, brand, qty, expiry, level bar, staple star)
- **Multi-package groups:** group header + compact `PackageCard` rows
  - "Active" badge: `consumptionLevel !== 0`
  - "Unopened" badge: `consumptionLevel === 1.0` (approximation — means never touched since being added)
- Tapping an item opens `QuickUpdateModal`:
  - Level selector (0 / 25% / 50% / 75% / Full)
  - "Mark as Staple" toggle
  - Flash message when set to 0: "Next package is now active" (other packages exist) or "Added to shopping list" (no packages left, item is staple)
- Items at level 0 are filtered from Inventory view entirely

---

## Shopping List Logic

- Backend: `GET /api/inventory/shopping-list` — returns one representative item per product name group where **at least one package has `isStaple = true`** AND **all packages have `consumptionLevel ≤ 0`**
- Frontend `ShoppingList` page renders items with colour-coded level bars (red ≤25%, yellow ≤50%, green >50%)
- **Auto-clearing on scan confirm:** `Scan.tsx` `handleConfirm()` finds existing items whose name matches (via `namesMatch()`) each newly scanned product, then calls `updateItem()` setting `isStaple = false` on those items to remove them from the list

---

## Backend API Endpoints

```
GET    /api/inventory                   — list all items
GET    /api/inventory/shopping-list     — staple items with consumptionLevel ≤ 0, one per product group
POST   /api/inventory                   — create item (createdAt set server-side)
PUT    /api/inventory/{id}              — update item (name, brand, barcode, quantity, location,
                                          expiryDate, imageUrl, consumptionLevel, isStaple, restockThreshold)
DELETE /api/inventory/{id}              — remove item

POST   /api/barcode                     — lookup product info
  body:   { "barcode": "string" }
  return: { "productName": "string", "brand": "string", "imageUrl": "string" }

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
| `/`              | Dashboard      | Inventory counts by location (4 cards), expiry warnings (≤3 days), scan CTA |
| `/inventory`     | Inventory      | Items grouped by location → product name, consumption levels, QuickUpdateModal |
| `/scan`          | Scan           | Continuous scanner + staging list, confirm to add all at once             |
| `/add`           | Add            | Manual add form (name, brand, barcode, quantity, location, expiry)        |
| `/shopping-list` | ShoppingList   | Staple items needing restock, colour-coded consumption bars               |
| `/login`         | Login          | Username + password, stores JWT pair in localStorage                      |

Navbar links (bottom on mobile, top on desktop): Home 🏠 · Pantry 📦 · Scan 📷 · Shop 🛒 · Add ➕

---

## Dev-Only Barcode Simulator

On `/scan`, when `import.meta.env.DEV` is true, a yellow panel shows **9 preset barcodes** for testing without a physical camera.

These buttons **bypass Open Food Facts lookup** and inject `productName`/`brand` directly into staging. Real scans still go through the full API flow.

| Barcode         | Product                  | Brand       |
|-----------------|--------------------------|-------------|
| `7310500144511` | Arla Mellanmjölk         | Arla        |
| `7622210449283` | McVitie's Digestive      | McVitie's   |
| `5000174155747` | Häagen-Dazs Glass        | Häagen-Dazs |
| `7310610011065` | Lambi Toapapper          | Lambi       |
| `7340011405642` | Garant Lättmjölk         | COOP        |
| `7310060007898` | GB Vaniljglass           | GB          |
| `3033490004316` | Activia Naturell         | Activia     |
| `8076808002432` | Barilla Spaghetti        | Barilla     |
| `8001250210609` | De Cecco Spaghetti       | De Cecco    |

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

---

## Auth Notes

- JWT fully implemented: `JwtUtil`, `JwtAuthFilter`, `AuthService`
- Currently **not enforced** — `anyRequest().permitAll()` in `SecurityConfig`
- Auth endpoints (`/api/auth/**`) are always public
- Tokens stored in `localStorage` as `accessToken` and `refreshToken`
- Axios client has a **silent refresh interceptor**: on 401, attempts token refresh once, retries original request; on refresh failure clears tokens
- Access token: 15 min (`jwt.expiration=900000`), Refresh token: 30 days (`jwt.refresh-expiration=2592000000`)
- Password minimum: 8 characters (backend validation)
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
- Collections: `inventory`, `users`
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
7. Location memory (localStorage, substring/suffix matching)
8. JWT auth (tokens issued, silent refresh in Axios, login page)
9. Dev barcode simulator (9 preset items, bypasses OFF)

### Not yet done ❌
- **Expiry date OCR** — Tesseract.js installed but not wired up
- **Auth enforcement** — JWT validated but all routes still `permitAll()`
- **Deployment** — Railway + GitHub Pages not yet configured

---

## Future Modules (do not implement, keep doors open)

- `todo/` — task system
- `habits/` — habit tracker
- `kitchen/` — recipe suggestions based on inventory
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
- All API calls go through the typed `api/` client layer — never raw fetch in components
- Always normalise `item.location` with `.toLowerCase()` before comparing against frontend string constants
- Guard `item.name` with `` ?? `Product ${item.barcode}` `` — can be null for older items
- `consumptionLevel === 0` items are consumed/hidden — never surface them in inventory views
- When setting level to 0, check if other non-zero packages exist before deciding the toast message
- Shopping list clearing in `Scan.tsx` `handleConfirm()` uses `namesMatch()` — do not bypass this with exact-string comparison
- `BrowserMultiFormatContinuousReader` does not exist in `@zxing/browser 0.1.5` — use `BrowserMultiFormatReader`
