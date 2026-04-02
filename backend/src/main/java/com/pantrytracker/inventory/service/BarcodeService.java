package com.pantrytracker.inventory.service;

import com.pantrytracker.inventory.dto.BarcodeResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class BarcodeService {

    private static final String OPEN_FOOD_FACTS_URL =
            "https://world.openfoodfacts.org/api/v0/product/{barcode}.json";

    private final RestTemplate restTemplate;

    /**
     * Looks up product information from Open Food Facts by barcode.
     * Returns a BarcodeResponse with whatever fields were found; missing
     * fields default to null so the frontend can show a "product not found"
     * state and let the user fill in details manually.
     */
    @SuppressWarnings("unchecked")
    public BarcodeResponse lookup(String barcode) {
        try {
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.set("User-Agent", "pantry-tracker/1.0 (https://github.com/pantry-tracker)");
            org.springframework.http.HttpEntity<Void> entity =
                    new org.springframework.http.HttpEntity<>(headers);

            org.springframework.http.ResponseEntity<Map> responseEntity = restTemplate.exchange(
                    OPEN_FOOD_FACTS_URL,
                    org.springframework.http.HttpMethod.GET,
                    entity,
                    Map.class,
                    barcode);
            Map<String, Object> response = responseEntity.getBody();

            if (response == null) {
                log.warn("Open Food Facts returned null for barcode {}", barcode);
                return new BarcodeResponse(null, null, null);
            }

            Number status = (Number) response.get("status");
            if (status == null || status.intValue() != 1) {
                log.info("Product not found in Open Food Facts for barcode {}", barcode);
                return new BarcodeResponse(null, null, null);
            }

            Map<String, Object> product = (Map<String, Object>) response.get("product");
            if (product == null) {
                return new BarcodeResponse(null, null, null);
            }

            // product_name can be blank — fall back to English or generic name
            String productName = firstNonBlank(
                    (String) product.get("product_name"),
                    (String) product.get("product_name_en"),
                    (String) product.get("generic_name"));
            String brand    = blankToNull((String) product.get("brands"));
            String imageUrl = (String) product.get("image_url");

            return new BarcodeResponse(productName, brand, imageUrl);

        } catch (Exception e) {
            log.error("Failed to reach Open Food Facts for barcode {}: {}", barcode, e.getMessage());
            return new BarcodeResponse(null, null, null);
        }
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v.trim();
        }
        return null;
    }

    private static String blankToNull(String v) {
        return (v == null || v.isBlank()) ? null : v.trim();
    }
}
