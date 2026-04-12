# Pantry Tracker

A camera-first household inventory app. Scan barcodes continuously like a physical scanner, track consumption levels, get expiry warnings, and see which items on your shopping list are on deal this week.

Built with Spring Boot 3 + React as a standalone POC — designed to become a module in a larger personal life management system.

---

## Features

- **Continuous barcode scanning** — stream-based ZXing detection, no button press per item; audible beep + green flash on each scan
- **Open Food Facts lookup** — automatic product name, brand, and image from barcode
- **Inventory by location** — Fridge, Freezer, Pantry, Sundries; compact tile grid with location filter tabs
- **Consumption tracking** — 0–100% per package; multi-package support (two cartons of milk tracked separately)
- **Expiry date warnings** — colour-coded by urgency (red ≤1d, orange 2–3d, yellow 4–7d); badge in nav
- **Staple items + shopping list** — mark a product as a staple once; it appears on the list automatically when all packages reach 0
- **Cross-brand substitution** — scanning Garant Lättmjölk clears Arla Mellanmjölk from the shopping list via suffix/keyword matching
- **Deal integration** — weekly grocery deals from Swedish chains via Tjek API; matched to shopping list items; no API key required
- **Nearest store for deals** — browser geolocation passed to backend; deals show the closest specific store (e.g. "ICA Kvantum Hötorget")
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
- A Tjek API dealer ID list (or use the defaults in `application.properties`)

---

## Getting Started

**1. Clone the repo**

```bash
git clone <repo-url>
cd pantry-tracker
```

**2. Configure backend secrets**

Create `backend/src/main/resources/application-local.properties`:

```properties
spring.data.mongodb.uri=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/pantrytracker?appName=<cluster>
jwt.secret=<64-char hex string>
jwt.expiration=900000
jwt.refresh-expiration=2592000000
```

**3. Configure frontend**

Create `frontend/.env.local`:

```
VITE_API_BASE_URL=http://localhost:8080
```

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

Frontend starts on `http://localhost:5173` (increments to 5174/5175 if busy).

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

GET    /api/deals                     Search for deals at Swedish grocery chains
                                      params: query, lat (optional), lng (optional)
                                      returns: { hasDeal, deals: [ { heading, price, currency,
                                                storeName, imageUrl, runTill, nearbyStoreLabel } ] }

POST   /api/auth/register             Create user → { accessToken, refreshToken }
POST   /api/auth/login                Authenticate → { accessToken, refreshToken }
POST   /api/auth/refresh              body: { refreshToken } → new token pair
```

---

## Project Structure

```
pantry-tracker/
├── backend/
│   └── src/main/java/com/pantrytracker/inventory/
│       ├── controller/       REST endpoints
│       ├── service/          Business logic + external API calls
│       ├── repository/       Spring Data MongoDB interfaces
│       ├── model/            MongoDB documents (InventoryItem, User)
│       ├── dto/              Request/response records
│       └── security/         JWT filter, SecurityConfig, CORS
│   └── src/main/resources/
│       ├── application.properties          Base config (committed)
│       └── application-local.properties    Secrets (gitignored)
│
└── frontend/
    └── src/
        ├── api/              Typed API client functions
        ├── components/       Scanner, StagingList, Navbar
        ├── pages/            Dashboard, Inventory, Scan, ShoppingList, Add, Login
        ├── utils/            locationMemory.ts, nameMatch.ts
        └── types/            Shared TypeScript types
```

---

## Development

**Dev simulator (no camera needed)**

On `/scan` in dev mode (`npm run dev`), a yellow panel provides:
- **9 barcode buttons** — inject preset Swedish products directly into the staging list, bypassing Open Food Facts
- **"🏠 Seed household data"** — POSTs 38 realistic Swedish household items across all four locations; useful for testing the inventory grid view

**MongoDB Atlas connection**

NordVPN (or any VPN) must be **OFF** — Atlas IP allowlist blocks VPN exit nodes.

MongoDB user is `pantryuser` (not the cluster owner account).

**Auth**

JWT is fully implemented but routes are currently `permitAll()`. To enforce auth, change one line in `SecurityConfig.java` — see `CLAUDE.md` for details.

---

## Roadmap

This app is Phase 1 of a personal life management system. Planned future modules:

- **Phase 2** — Auth enforcement + deployment (Railway backend, GitHub Pages frontend)
- **Phase 3** — Expiry date OCR via Tesseract.js (photo-capture mode after staging confirm)
- **Phase 4** — LLM kitchen assistant ("vad kan jag laga med det som finns hemma?")
- **Phase 5** — Matsvinn analytics (waste tracking, expiry trends, cost over time)
