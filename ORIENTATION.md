# Developer Orientation — Pantry Tracker

Personal reference for the sole developer. Everything here is specific to the actual code, not generic Spring/React boilerplate.

---

## 1. Project Layout

```
pantry-tracker/
├── backend/          Spring Boot 3 REST API (Java 21, Maven)
├── frontend/         React 18 + Vite + TypeScript SPA
├── CLAUDE.md         Project requirements, tech decisions, gotchas — the authoritative spec
├── ORIENTATION.md    This file
└── README.md         (not yet created)
```

The two sides are fully decoupled. Backend serves JSON on `:8080`, frontend runs on `:5173` and proxies `/api/*` to the backend in dev. They share no code.

---

## 2. Backend Map

**Root package:** `com.pantrytracker.inventory`
**Source root:** `backend/src/main/java/com/pantrytracker/inventory/`

```
PantryTrackerApplication.java   Entry point — @SpringBootApplication, logs masked MongoDB URI

controller/
  InventoryController.java      GET/POST/PUT/DELETE /api/inventory, /expiring, /shopping-list
  BarcodeController.java        POST /api/barcode — delegates to BarcodeService
  DealsController.java          GET /api/deals?query&lat&lng — delegates to TjekService
  AuthController.java           POST /api/auth/register, /login, /refresh

service/
  InventoryService.java         Business logic: grouping, filtering, expiry window, shopping-list logic
  BarcodeService.java           HTTP call to Open Food Facts, product name fallback chain
  TjekService.java              Tjek deal search: keyword extraction, offer fetch/cache, catalog
                                nearby-store lookup/cache, DealInfo enrichment
  AuthService.java              User creation, BCrypt comparison, token issuance

repository/
  InventoryRepository.java      MongoRepository<InventoryItem, String> — findByLocation, findByBarcode
  UserRepository.java           MongoRepository<User, String> — findByUsername, existsByUsername

model/
  InventoryItem.java            Main MongoDB document — all inventory fields
  User.java                     User document — username (unique index), password, roles

dto/
  AuthRequest.java              Record: username, password (validation annotations)
  AuthResponse.java             Record: accessToken, refreshToken
  BarcodeRequest.java           Record: barcode
  BarcodeResponse.java          Record: productName, brand, imageUrl
  DealInfo.java                 Record: heading, price, currency, storeName, imageUrl, runTill,
                                nearbyStoreLabel
  DealResponse.java             Record: hasDeal, List<DealInfo> deals

security/
  JwtUtil.java                  Token generation (HMAC-SHA256), validation, claim extraction
  JwtAuthFilter.java            OncePerRequestFilter — reads Bearer header, sets SecurityContext
  SecurityConfig.java           CORS rules, session policy, auth rules, PasswordEncoder bean
```

**Resources:** `backend/src/main/resources/`
```
application.properties          Base config — active profile, Jackson, expiry window
application-local.properties    Secrets (gitignored) — MongoDB URI, JWT secret & timings
```

### Layer responsibilities

| Layer | What to do here | What NOT to do here |
|---|---|---|
| Controller | Map HTTP → service calls, validation errors, HTTP status codes | Business logic |
| Service | Grouping, filtering, derived queries, external API calls | Direct MongoDB queries |
| Repository | Spring Data method declarations | Any logic |
| Model | Field definitions, `@Document`, `@JsonProperty` overrides | Computation |
| Security | Token plumbing, CORS config | Application logic |

### Adding or changing a backend feature

**New endpoint:** Add method to existing controller (or new controller), add corresponding service method, no repository change if using existing queries.

**New field on InventoryItem:** Add field to `InventoryItem.java`. If it's a boolean named `isFoo`, add `@JsonProperty("isFoo")` — Lombok generates `isFoo()` which Jackson maps to `"foo"` without it. Add the field to the `update()` method in `InventoryService.java` so PUT picks it up.

**New MongoDB query:** Add a method signature to the appropriate repository interface — Spring Data derives the query from the method name, or use `@Query`.

**Change CORS or auth:** `SecurityConfig.java` — the two relevant blocks are `corsConfigurationSource()` and the `.authorizeHttpRequests()` chain.

---

## 3. Frontend Map

**Source root:** `frontend/src/`

```
main.tsx                  React DOM entry — QueryClient (1min staleTime), BrowserRouter
App.tsx                   Route tree (6 routes, see table below)

types/
  index.ts                All shared TypeScript types: InventoryItem, StagingItem, Location,
                          BarcodeResponse, AuthRequest/Response, payload utility types

api/
  client.ts               Axios instance — baseURL from env, Bearer token interceptor,
                          silent 401→refresh interceptor
  inventory.ts            getInventory, getShoppingList, getExpiringItems, createItem,
                          updateItem, deleteItem
  barcode.ts              lookupBarcode(barcode)
  deals.ts                getDeal(query, lat?, lng?) — GET /api/deals, returns DealResponse
  auth.ts                 login, register, refresh

utils/
  locationMemory.ts       localStorage Map: product name → location (persists across sessions)
  nameMatch.ts            namesMatch(), wordOverlap() — Scandinavian suffix matching

components/
  Layout/
    Navbar.tsx            Bottom nav (mobile) / top nav (desktop), expiry badge on Pantry link
  Scanner/
    BarcodeScanner.tsx    Continuous ZXing stream, dedup, beep, green flash
    StagingList.tsx       Editable rows (qty, location, expiry) + Confirm All button

pages/
  Dashboard.tsx           Location counts, expiring-soon cards, scan/inventory CTAs
  Inventory.tsx           Location filter tabs (Alla/Fridge/Freezer/Pantry/Sundries),
                          compact 2–4 col ItemTile grid, QuickUpdateModal
  Scan.tsx                BarcodeScanner + StagingList, dev barcode simulator,
                          "🏠 Seed household data" button, handleConfirm logic
  Add.tsx                 Manual entry form
  ShoppingList.tsx        Two tabs: Inköpslista (staple restock list) + Deals 🏷️
                          (Tjek deal badges per item, geolocation for nearby store)
  Login.tsx               Auth form, stores tokens in localStorage
```

### Routes

| Path | Component | Purpose |
|---|---|---|
| `/` | Dashboard | Overview, expiry warnings |
| `/inventory` | Inventory | Browse and update items |
| `/scan` | Scan | Continuous scanner + staging |
| `/add` | Add | Manual item entry |
| `/shopping-list` | ShoppingList | Staples to restock |
| `/login` | Login | Auth |

### How React Query is used

Every data-fetching call goes through `useQuery` or `useMutation`. Query keys:
- `['inventory']` — full item list
- `['expiring']` — expiring items (shared between Dashboard and Navbar — Navbar reads this cache, no extra request)
- `['shopping-list']` — staples needing restock
- `['deal', name, lat, lng]` — one per shopping list item; lat/lng included so queries auto-refetch once geolocation resolves (different key = cache miss = fresh fetch)

Mutations call `queryClient.invalidateQueries` on success to refresh the relevant caches.

### Where Tailwind config lives

`frontend/tailwind.config.js` — brand green palette defined here (`brand` color scale 50–900). `frontend/postcss.config.js` wires Tailwind + Autoprefixer. No CSS modules, no inline styles.

---

## 4. Key Files to Know by Heart

| File | Why it matters |
|---|---|
| `backend/src/main/resources/application.properties` | Base Spring config — active profile, Jackson enum case, expiry window |
| `backend/src/main/resources/application-local.properties` | Secrets — MongoDB URI, JWT secret (gitignored, create from `.example`) |
| `backend/pom.xml` | All Java dependencies and Java version |
| `frontend/.env.local` | `VITE_API_BASE_URL=http://localhost:8080` (gitignored) |
| `frontend/package.json` | All JS dependencies and dev scripts |
| `frontend/vite.config.ts` | Dev proxy `/api` → `:8080`, React plugin |
| `frontend/src/api/client.ts` | The single Axios instance — token attach + silent refresh |
| `frontend/src/App.tsx` | Route tree — add new pages here |
| `frontend/src/types/index.ts` | Shared types — always update when the data model changes |
| `backend/.../model/InventoryItem.java` | The document — source of truth for data shape |
| `backend/.../security/SecurityConfig.java` | CORS origins + auth enforcement toggle |

---

## 5. Data Flow Walkthrough

**Scenario:** User confirms a batch of scanned items on `/scan`.

```
Scan.tsx handleConfirm()
  │
  ├─ for each staged item:
  │    createItem(payload)                              api/inventory.ts
  │      └─ POST /api/inventory                        Axios + Bearer header
  │           └─ InventoryController.createItem()      sets createdAt server-side
  │                └─ InventoryService.create()
  │                     └─ InventoryRepository.save()  MongoDB Atlas "inventory" collection
  │
  ├─ for each new item, find matching existing items by namesMatch()
  │    updateItem(id, { isStaple: false })              api/inventory.ts
  │      └─ PUT /api/inventory/{id}                    clears shopping list entry
  │           └─ InventoryService.update()
  │                └─ InventoryRepository.save()
  │
  ├─ rememberLocation(productName, location)            utils/locationMemory.ts → localStorage
  │
  └─ queryClient.invalidateQueries(['inventory', 'shopping-list'])
       └─ Dashboard/Inventory/ShoppingList re-fetch automatically
```

**Scenario:** Navbar loads expiry badge count.

```
Navbar.tsx
  └─ useQuery(['expiring'], getExpiringItems)          reads from React Query cache if warm
       └─ GET /api/inventory/expiring                  only if cache stale (1min staleTime)
            └─ InventoryService.getExpiring()
                 └─ MongoDB: expiryDate ≤ today+7, consumptionLevel > 0
            items filtered client-side: days >= 0 && days <= 3
            count capped at "9+" for display
```

**Scenario:** BarcodeScanner detects a barcode.

```
BarcodeScanner.tsx (ZXing continuous stream)
  └─ decodeFromVideoDevice() fires on every frame
       └─ if same barcode seen < 3000ms ago → skip (dedup)
       └─ play 1046 Hz beep (Web Audio API)
       └─ show 300ms green flash (CSS overlay)
       └─ call onDetected(barcode) callback
            └─ Scan.tsx handleDetected()
                 └─ lookupBarcode(barcode)             POST /api/barcode
                      └─ BarcodeService.lookup()
                           └─ GET openfoodfacts.org/api/v0/product/{barcode}.json
                 └─ add to stagingItems state
                      └─ lookupLocation(productName)   check localStorage memory
                      └─ show "📍 Remembered" badge if location found
```

---

## 6. Where to Go When...

### Backend

| Task | Where |
|---|---|
| Add a new REST endpoint | New method in `controller/` + `service/` |
| Add a new field to inventory items | `model/InventoryItem.java` + `InventoryService.update()` |
| Change the expiry warning window | `application.properties` → `inventory.expiry-warning-days` |
| Change CORS allowed origins | `SecurityConfig.java` → `corsConfigurationSource()` |
| Enable JWT auth enforcement | `SecurityConfig.java` → replace `anyRequest().permitAll()` |
| Add a new MongoDB query | Method signature in `repository/` interface |
| Change token expiry | `application-local.properties` → `jwt.expiration` / `jwt.refresh-expiration` |
| Change Open Food Facts field extraction | `BarcodeService.lookup()` |

### Frontend

| Task | Where |
|---|---|
| Add a new page | Create in `pages/`, add `<Route>` in `App.tsx` + link in `Navbar.tsx` |
| Add a new API call | Add function to appropriate `api/` file, use `useQuery`/`useMutation` in component |
| Change the type of an existing field | `types/index.ts` first, then propagate |
| Change what triggers a shopping list entry | `InventoryService.getShoppingList()` (backend) + `ShoppingList.tsx` (frontend) |
| Change expiry color thresholds | `Dashboard.tsx` ExpiringCard colors + `Navbar.tsx` badge filter |
| Add a dev barcode simulator preset | `Scan.tsx` → `DEV_BARCODES` array |
| Add/change dev seed data | `Scan.tsx` → `SEED_ITEMS` constant |
| Change location memory matching | `utils/nameMatch.ts` `wordOverlap()` |
| Add a new Tailwind color | `tailwind.config.js` |
| Change the Axios base URL or interceptors | `api/client.ts` |
| Change React Query stale time or retry policy | `main.tsx` QueryClient config |
| Change Tjek dealer IDs | `application.properties` → `tjek.dealer-ids` |
| Change Tjek offer/catalog cache TTL | `TjekService.java` constants `OFFER_CACHE_TTL_MS` / `CATALOG_CACHE_TTL_MS` |
| Change nearby-store search radius | `TjekService.java` → `RADIUS_METERS` |
| Debug missing 📍 location in deal badges | Check backend INFO logs: "Catalog lookup lat=... → N catalogs" and per-catalog field dump |

---

## 7. Environment and Secrets

### What exists, what is gitignored

| File | Tracked? | Contents |
|---|---|---|
| `backend/src/main/resources/application.properties` | Yes | Non-secret base config |
| `backend/src/main/resources/application-local.properties` | **No** | MongoDB URI, JWT secret |
| `backend/src/main/resources/application-local.properties.example` | (should exist) | Template without real values |
| `frontend/.env.local` | **No** | `VITE_API_BASE_URL` |
| `CLAUDE.md` | **No** (removed from tracking) | Project spec for AI assistant |
| `ORIENTATION.md` | **No** | This file |

### Backend secrets (`application-local.properties`)

```properties
spring.data.mongodb.uri=mongodb+srv://pantryuser:<pass>@winterunmute.7hloc.mongodb.net/pantrytracker?appName=Winterunmute
jwt.secret=<64-char hex string>
jwt.expiration=900000
jwt.refresh-expiration=2592000000
```

- MongoDB user is `pantryuser`, not `Winterunmute`
- NordVPN must be OFF — Atlas IP allowlist blocks VPN exit nodes
- `spring.profiles.active=local` in `application.properties` activates this file

### Frontend env (`frontend/.env.local`)

```
VITE_API_BASE_URL=http://localhost:8080
```

Only this one variable. Vite exposes it as `import.meta.env.VITE_API_BASE_URL` in `api/client.ts`. At build time for production, set it to the Railway backend URL.

### What the gitignores cover

- `backend/.gitignore` — `application-local.properties`, `target/`, IDE files
- `frontend/.gitignore` — `node_modules`, `dist`, `.env.local`, `Claude.md`
- Root `.gitignore` — `CLAUDE.md`, `ORIENTATION.md`

---

## 8. Known Gotchas (quick reference)

**`boolean isStaple` in Java** — Lombok generates `isStaple()`, so Jackson serializes it as `"staple"`. Fix already in place: `@JsonProperty("isStaple")` on the field. Don't remove it.

**`consumptionLevel === 0` means hidden** — Items at level 0 are filtered from Inventory view. They only surface on the shopping list if `isStaple = true`.

**Location case mismatch** — Backend stores `FRIDGE`/`PANTRY` etc., frontend uses `fridge`/`pantry`. Jackson `accept-case-insensitive-enums=true` handles inbound. Always call `.toLowerCase()` before comparing in frontend code.

**`item.name` can be null** — Items scanned before the Open Food Facts integration was working may have `name: null`. Guard everywhere with `` item.name ?? `Product ${item.barcode}` ``.

**`BrowserMultiFormatContinuousReader` does not exist** — The installed version `@zxing/browser 0.1.5` only has `BrowserMultiFormatReader`. Using the wrong class name gives a runtime crash.

**Shopping list clears by de-stapling, not deleting** — `Scan.tsx handleConfirm()` sets `isStaple = false` on matched items. The items remain in the DB at level 0; they just fall off the shopping list query.

**Expiry badge uses shared React Query cache** — The `['expiring']` query is fetched by Dashboard. Navbar reads from that same cache — it will not fire its own network request if Dashboard has already fetched recently (within 1 min stale time).

**Deal coords in query key** — `['deal', name, lat, lng]` includes the coordinates so that React Query treats the pre-location and post-location fetches as separate entries. When geolocation resolves, the new key is a cache miss → fresh fetch with coords. No manual refetch trigger needed.

**Tjek `TjekCatalog.label` may be null** — The Tjek API sometimes returns `null` for `catalog.label`. The `catalogLabel()` helper applies a fallback chain: `label` → `dealer.name + " " + store.city` → `dealer.name`. Never filter catalogs on `label != null` alone; filter after `catalogLabel()` returns null instead.

**Inventory tile shows `group.items[0]`** — Groups are sorted lowest consumptionLevel first. `items[0]` is therefore the most depleted active package — the one currently being consumed. The tile's level bar reflects this package. Tapping the tile opens the modal for this same item.
