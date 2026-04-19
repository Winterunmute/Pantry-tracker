package com.pantrytracker.inventory.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.pantrytracker.inventory.dto.DealInfo;
import com.pantrytracker.inventory.dto.DealResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Service
public class TjekService {

    private static final String TJEK_BASE          = "https://squid-api.tjek.com";
    private static final long   OFFER_CACHE_TTL_MS   = 60 * 60 * 1000;      // 1 h
    private static final long   CATALOG_CACHE_TTL_MS = 6 * 60 * 60 * 1000;  // 6 h
    private static final long   RADIUS_METERS         = 50_000;
    private static final DealResponse NO_DEALS =
            new DealResponse(false, Collections.emptyList());

    @Value("${tjek.dealer-ids}")
    private String dealerIds;

    private final RestTemplate restTemplate;

    // keyword (lowercased) → raw offers, shared across all locations
    private final Map<String, CachedOffers> offerCache = new ConcurrentHashMap<>();
    // "lat1,lng1" grid cell → Map<dealer_id, store label>
    private final Map<String, CachedCatalogs> catalogCache = new ConcurrentHashMap<>();

    public TjekService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Extracts the most meaningful search keyword from a product name.
     *
     * Strategy: take the longest word (by letter count) that is ≥ 5 characters.
     * On a tie the later word wins — product type typically follows the brand.
     *
     * Examples:
     *   "Garant Lättmjölk"    → "Lättmjölk"
     *   "Arla Mellanmjölk"    → "Mellanmjölk"
     *   "McVitie's Digestive" → "Digestive"  (8 letters vs 9)
     *   "Häagen-Dazs Glass"   → "Häagen-Dazs" (10 letters — known edge case)
     *   "Lambi Toapapper"     → "Toapapper"
     *   "GB Vaniljglass"      → "Vaniljglass"
     */
    static String extractKeyword(String name) {
        if (name == null || name.isBlank()) return name;

        String best = null;
        int bestLetterCount = 0;

        for (String word : name.trim().split("\\s+")) {
            int letters = (int) word.codePoints().filter(Character::isLetter).count();
            if (letters >= 5 && letters >= bestLetterCount) { // >= keeps last word on tie
                best = word;
                bestLetterCount = letters;
            }
        }

        return best != null ? best : name.trim();
    }

    /**
     * Search for deals matching the product name, optionally enriched with a nearby
     * store label when lat/lng are provided.
     *
     * Offer results are cached by keyword (1 h). Catalog lookups are cached by 1-decimal
     * lat/lng grid cell (~11 km) for 6 h. The two caches are independent so a cached
     * offer list is still re-enriched with a fresh location on every request.
     */
    public DealResponse search(String query, Double lat, Double lng) {
        if (query == null || query.isBlank()) return NO_DEALS;

        String keyword = extractKeyword(query);
        String cacheKey = keyword.toLowerCase().trim();
        log.debug("Tjek keyword '{}' extracted from '{}'", keyword, query);

        // 1. Raw offers — location-independent
        List<TjekOffer> offers = getCachedOffers(cacheKey);
        if (offers == null) {
            offers = fetchOffers(keyword);
            offerCache.put(cacheKey,
                    new CachedOffers(offers, System.currentTimeMillis() + OFFER_CACHE_TTL_MS));
            log.info("Tjek '{}' (kw '{}') → {} offers", query, keyword, offers.size());
        } else {
            log.debug("Tjek offer cache hit for '{}'", keyword);
        }

        if (offers.isEmpty()) return NO_DEALS;

        // 2. Nearby store labels — only fetched when coords provided
        Map<String, String> nearbyLabels = (lat != null && lng != null)
                ? getNearbyLabels(lat, lng)
                : Collections.emptyMap();
        log.info("Tjek location enrichment: lat={} lng={} → {} dealer labels available",
                lat, lng, nearbyLabels.size());

        // 3. Build enriched DealInfo list
        List<DealInfo> deals = offers.stream()
                .filter(o -> o.pricing() != null && o.pricing().price() != null)
                .map(o -> new DealInfo(
                        o.heading(),
                        o.pricing().price(),
                        o.pricing().currency() != null ? o.pricing().currency() : "SEK",
                        o.dealer() != null ? o.dealer().name() : "Okänd butik",
                        o.images() != null ? o.images().thumb() : null,
                        o.runTill(),
                        o.dealerId() != null ? nearbyLabels.get(o.dealerId()) : null))
                .toList();

        log.info("Tjek search '{}' → {} deals, first nearbyStoreLabel='{}'",
                query, deals.size(),
                deals.isEmpty() ? null : deals.get(0).nearbyStoreLabel());
        return deals.isEmpty() ? NO_DEALS : new DealResponse(true, deals);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private List<TjekOffer> getCachedOffers(String key) {
        CachedOffers entry = offerCache.get(key);
        return (entry != null && entry.expiresAt() > System.currentTimeMillis())
                ? entry.offers() : null;
    }

    private List<TjekOffer> fetchOffers(String keyword) {
        URI uri = UriComponentsBuilder.fromHttpUrl(TJEK_BASE + "/v2/offers/search")
                .queryParam("query", keyword)
                .queryParam("dealer_ids", dealerIds)
                .build().encode().toUri();
        try {
            ResponseEntity<List<TjekOffer>> resp = restTemplate.exchange(
                    uri, HttpMethod.GET, null, new ParameterizedTypeReference<>() {});
            List<TjekOffer> body = resp.getBody();
            return body != null ? body : Collections.emptyList();
        } catch (Exception e) {
            log.warn("Tjek offers fetch failed for '{}': {}", keyword, e.getMessage());
            return Collections.emptyList();
        }
    }

    /** Returns Map<dealer_id, store label> for catalogs within the search radius. */
    private Map<String, String> getNearbyLabels(double lat, double lng) {
        String gridKey = String.format("%.1f,%.1f", lat, lng);
        CachedCatalogs entry = catalogCache.get(gridKey);
        if (entry != null && entry.expiresAt() > System.currentTimeMillis()) {
            log.info("Tjek catalog cache hit for grid {}: {} stores", gridKey, entry.dealerLabels().size());
            return entry.dealerLabels();
        }
        Map<String, String> labels = fetchNearbyLabels(lat, lng);
        catalogCache.put(gridKey,
                new CachedCatalogs(labels, System.currentTimeMillis() + CATALOG_CACHE_TTL_MS));
        log.info("Tjek catalogs for grid {}: {} stores → dealer_ids: {}", gridKey, labels.size(), labels.keySet());
        return labels;
    }

    private Map<String, String> fetchNearbyLabels(double lat, double lng) {
        URI uri = UriComponentsBuilder.fromHttpUrl(TJEK_BASE + "/v2/catalogs")
                .queryParam("r_lat", lat)
                .queryParam("r_lng", lng)
                .queryParam("r_radius", RADIUS_METERS)
                .build().toUri();
        try {
            ResponseEntity<List<TjekCatalog>> resp = restTemplate.exchange(
                    uri, HttpMethod.GET, null, new ParameterizedTypeReference<>() {});
            List<TjekCatalog> catalogs = resp.getBody();
            if (catalogs == null) return Collections.emptyMap();

            log.info("Catalog lookup lat={} lng={} → {} catalogs", lat, lng, catalogs.size());
            catalogs.stream().limit(5).forEach(c ->
                log.info("  Catalog: dealer_id='{}' label='{}' dealer.name='{}' store.city='{}'",
                    c.dealerId(), c.label(),
                    c.dealer() != null ? c.dealer().name() : null,
                    c.store()  != null ? c.store().city()  : null));

            // Multiple catalogs can share a dealer_id (chain with many stores).
            // Keep the first per dealer — the API returns them sorted by proximity.
            return catalogs.stream()
                    .filter(c -> c.dealerId() != null)
                    .map(c -> Map.entry(c.dealerId(), catalogLabel(c)))
                    .filter(e -> e.getValue() != null)
                    .collect(Collectors.toMap(
                            Map.Entry::getKey,
                            Map.Entry::getValue,
                            (first, duplicate) -> first));
        } catch (Exception e) {
            log.warn("Tjek catalogs fetch failed for {},{}: {}", lat, lng, e.getMessage());
            return Collections.emptyMap();
        }
    }

    /**
     * Derives a human-readable store label from a catalog entry.
     *
     * Priority:
     *  1. catalog.label  (e.g. "ICA Kvantum Hötorget" — present in some Tjek responses)
     *  2. dealer.name + " " + store.city  (e.g. "ICA Kvantum Stockholm")
     *  3. dealer.name alone
     *  4. null  (nothing useful — caller will exclude this entry)
     */
    private static String catalogLabel(TjekCatalog c) {
        if (c.label() != null && !c.label().isBlank()) return c.label().trim();
        String dealer = c.dealer() != null && c.dealer().name() != null
                ? c.dealer().name().trim() : null;
        String city   = c.store() != null && c.store().city() != null
                ? c.store().city().trim() : null;
        if (dealer != null && city != null) return dealer + " " + city;
        return dealer; // may be null — filtered out by caller
    }

    // ── Tjek API response shapes ──────────────────────────────────────────────

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static record TjekOffer(
            String heading,
            Pricing pricing,
            Images images,
            Dealer dealer,
            @JsonProperty("dealer_id") String dealerId,
            @JsonProperty("run_till") String runTill) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static record Pricing(
            Double price,
            @JsonProperty("pre_price") Double prePrice,
            String currency) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static record Images(String thumb, String view, String zoom) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static record Dealer(String name, String logo) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static record TjekCatalog(
            String label,
            @JsonProperty("dealer_id") String dealerId,
            CatalogDealer dealer,
            CatalogStore store) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static record CatalogDealer(String name) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static record CatalogStore(String street, String city, String zip) {}

    private record CachedOffers(List<TjekOffer> offers, long expiresAt) {}

    private record CachedCatalogs(Map<String, String> dealerLabels, long expiresAt) {}
}
