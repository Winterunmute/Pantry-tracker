# Pantry Tracker

A camera-first household inventory app. Scan barcodes continuously like a physical scanner, track consumption levels, get expiry warnings, and manage a smart shopping list.

Built with Spring Boot 3 + React as a standalone POC — designed to become a module in a larger personal life management system.

---

## Features

- **Continuous barcode scanning** — stream-based ZXing detection, no button press per item; audible beep + green flash on each scan
- **Open Food Facts lookup** — automatic product name, brand, and image from barcode
- **Inventory by location** — Fridge, Freezer, Pantry, Sundries; items grouped by location then by name
- **Consumption tracking** — 0–100% per package; multi-package support (two cartons of milk tracked separately)
- **Expiry date warnings** — items expiring within 3 days highlighted on the Dashboard
- **Staple items + shopping list** — mark a product as a staple once; it appears on the shopping list automatically when all packages reach 0
- **Cross-brand substitution** — scanning Garant Lättmjölk clears Arla Mellanmjölk from the shopping list via suffix/keyword matching
- **Smart location memory** — remembers where you put each product; auto-fills location on next scan

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Java 21, Spring Boot 3.2.5, Maven |
| Database | MongoDB Atlas (M0 free tier) |
| Frontend | React 18, Vite 5, TypeScript 5.2 |
| Styling | Tailwind CSS 3.3 |
| Data fetching | TanStack React Query 5 |
| HTTP client | Axios 1.6 |
| Barcode | @zxing/browser 0.1.5 (continuous stream) |
| Auth | JWT (JJWT 0.11.5) — issued, not yet enforced |

---

## Prerequisites

- Java 21+
- Node 18+
- MongoDB Atlas account (free M0 tier is sufficient)

---

## Getting Started

**1. Clone the repo**

```bash
git clone <repo-url>
cd pantry-tracker
```

**2. Configure backend secrets**

Create `backend/src/main/resources/application-local.properties` (gitignored — see `.example` for the template):

```properties
spring.data.mongodb.uri=mongodb+srv://pantryuser:<pass>@winterunmute.7hloc.mongodb.net/pantrytracker?appName=Winterunmute
jwt.secret=<string — must be ≥ 32 characters>
jwt.expiration=900000
jwt.refresh-expiration=2592000000
spoonacular.api-key=<key>
```

> **Note:** The MongoDB user is `pantryuser`, not the cluster owner account. NordVPN (or any VPN) must be **OFF** — the Atlas IP allowlist blocks VPN exit node addresses.

**3. Configure frontend**

Create `frontend/.env.local` (gitignored):

```
VITE_API_BASE_URL=http://localhost:8080
```

Without this, the Axios client falls back to `http://localhost:8080`, so local dev works either way. A production build requires the env var set to the live backend URL at build time.

**4. Run the backend**

```bash
cd backend
mvn spring-boot:run
```

Backend starts on `http://localhost:8080`.

**5. Run the frontend**

```bash
cd frontend
npm install
npm run dev
```

Frontend starts on `http://localhost:5173` (increments to 5174/5175 if busy; all three are pre-allowed in CORS config).

---

## API Endpoints

```
GET    /api/inventory                 List all items (consumptionLevel > 0)
GET    /api/inventory/shopping-list   Staple items where all packages are at level 0
GET    /api/inventory/expiring        Items expiring within N days (default 7), level > 0
POST   /api/inventory                 Create item
PUT    /api/inventory/{id}            Update item
DELETE /api/inventory/{id}            Delete item

POST   /api/barcode                   Look up product by barcode (Open Food Facts)
                                      body: { barcode } → { productName, brand, imageUrl }

POST   /api/auth/register             Create user → { accessToken, refreshToken }
POST   /api/auth/login                Authenticate → { accessToken, refreshToken }
POST   /api/auth/refresh              body: { refreshToken } → new token pair
```

> **Auth note:** All routes are currently `permitAll()`. JWT tokens are issued and validated but not enforced. One line change in `SecurityConfig.java` enables enforcement.

---

## Project Structure

```
pantry-tracker/
├── backend/
│   └── src/main/java/com/pantrytracker/inventory/
│       ├── controller/       InventoryController, BarcodeController, AuthController
│       ├── service/          InventoryService, BarcodeService, AuthService
│       ├── repository/       InventoryRepository, UserRepository (Spring Data MongoDB)
│       ├── model/            InventoryItem, User
│       ├── dto/              AuthRequest/Response, BarcodeRequest/Response
│       └── security/         JwtUtil, JwtAuthFilter, SecurityConfig
│   └── src/main/resources/
│       ├── application.properties              Base config (committed)
│       ├── application-local.properties.example  Secret template
│       └── application-local.properties        Secrets (gitignored — must create)
│
└── frontend/
    └── src/
        ├── api/              client.ts (Axios + auth interceptors), inventory.ts,
        │                     barcode.ts, auth.ts
        ├── components/       Navbar, BarcodeScanner, StagingList
        ├── pages/            Dashboard, Inventory, Scan, ShoppingList, Add, Login
        ├── utils/            locationMemory.ts, nameMatch.ts
        └── types/            Shared TypeScript types (index.ts)
```

---

## Data Model Notes

- `consumptionLevel = 0` — consumed/hidden. Items stay in MongoDB; they appear on the shopping list if `isStaple = true`.
- `isStaple` — marks a product as a household staple. Shopping list = all packages of a product have `consumptionLevel ≤ 0` AND `isStaple = true`.
- `restockThreshold` — stored (default 0.25) but not yet used in filtering. Shopping list triggers at `consumptionLevel ≤ 0` only.
- `item.name` can be null for items scanned before Open Food Facts integration. Frontend guards everywhere with `` item.name ?? `Product ${item.barcode}` ``.
- `location` — frontend sends lowercase (`"fridge"`), backend stores as enum (`FRIDGE`). Jackson `accept-case-insensitive-enums=true` handles the mapping.

---

## Development

**Dev simulator (no camera needed)**

On `/scan` in dev mode (`npm run dev`), a yellow panel provides:
- **9 barcode buttons** — inject preset Swedish products directly into the staging list, bypassing Open Food Facts
- **"🏠 Seed household data"** — POSTs 38 realistic Swedish household items across all four locations; useful for populating the inventory view

**Scanning dedup**

The same barcode within 3000 ms is ignored (prevents double-scanning a single item). Each new scan plays a 1046 Hz beep and flashes the viewfinder green for 300 ms.

**Location memory**

`localStorage` key `"pantry-location-memory"` maps product name → last used location. On scan, `lookupLocation()` checks for an exact match then falls back to `namesMatch()` (suffix/keyword overlap) for cross-brand recall.

---

## Roadmap

This app is Phase 1 of a personal life management system. Planned features:

- **Deals integration** — weekly grocery deals from Swedish chains via Tjek API; matched to shopping list items with nearest-store geolocation (backend stubs in `application.properties`; service not yet implemented)
- **Recipe search** — inventory-aware recipe suggestions via TheMealDB + Spoonacular (not yet implemented)
- **Auth enforcement** — one-line change in `SecurityConfig.java`; planned alongside deployment
- **Deployment** — Railway (backend), GitHub Pages (frontend); not yet configured
- **Expiry date OCR** — Tesseract.js (installed in `package.json`, not yet wired up); photo-capture after staging confirm
- **Matsvinn analytics** — waste tracking, expiry trends, cost over time
