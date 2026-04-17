# Results

## [plan-only] Read ~/CLAUDE.md and ~/projects/zero-system/CLAUDE.md first.

**Completed:** 2026-04-17 14:26:18

README.md updated. Here's what changed and why:

**Removed (described in README but not in codebase):**
- Deal integration and nearest-store geolocation — no `TjekService` or `DealsController` exist
- "Compact tile grid with location filter tabs" — `Inventory.tsx` uses `ItemCard`/`PackageCard` list view
- "Expiry badge in nav" — `Navbar.tsx` has no badge; expiry warnings are on the Dashboard only
- `/api/deals` from the endpoints table

**Added/corrected:**
- Data model notes section explaining the key invariants (`consumptionLevel`, `isStaple`, null names, location casing)
- Roadmap now accurately labels deals and recipes as "not yet implemented" with notes on what exists (Tjek dealer IDs in `application.properties`, Tesseract.js installed but unwired)
- MongoDB user (`pantryuser`) and VPN note moved into setup instructions where a new dev will see them
- Auth `permitAll()` caveat added inline to the endpoints table

---

