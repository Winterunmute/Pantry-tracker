package com.pantrytracker.inventory.service;

import com.pantrytracker.inventory.model.RecipeCache;
import com.pantrytracker.inventory.repository.RecipeCacheRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class RecipeService {

    private final RecipeCacheRepository recipeCacheRepository;
    private final RestTemplate restTemplate;

    @Value("${spoonacular.api.key}")
    private String apiKey;

    private static final String SPOONACULAR_URL =
            "https://api.spoonacular.com/recipes/findByIngredients";

    public String getRecipes(List<String> ingredients) {
        String hash = hash(ingredients);
        return recipeCacheRepository.findByIngredientHash(hash)
                .map(cached -> {
                    log.info("Cache HIT for ingredients: {}", ingredients);
                    return cached.getSpoonacularResponse();
                })
                .orElseGet(() -> {
                    log.info("Cache MISS for ingredients: {} — calling Spoonacular", ingredients);
                    String response = fetchFromSpoonacular(ingredients);
                    recipeCacheRepository.save(RecipeCache.builder()
                            .ingredientHash(hash)
                            .ingredients(ingredients)
                            .spoonacularResponse(response)
                            .build());
                    return response;
                });
    }

    /** Returns the API response if a fetch was made, null if already cached. */
    public String fetchAndCache(List<String> ingredients) {
        String hash = hash(ingredients);
        if (recipeCacheRepository.findByIngredientHash(hash).isPresent()) {
            log.debug("Prefetch SKIP (already cached): {}", ingredients);
            return null;
        }
        log.info("Prefetch FETCH: {}", ingredients);
        String response = fetchFromSpoonacular(ingredients);
        recipeCacheRepository.save(RecipeCache.builder()
                .ingredientHash(hash)
                .ingredients(ingredients)
                .spoonacularResponse(response)
                .build());
        return response;
    }

    private String fetchFromSpoonacular(List<String> ingredients) {
        String url = UriComponentsBuilder.fromHttpUrl(SPOONACULAR_URL)
                .queryParam("ingredients", String.join(",", ingredients))
                .queryParam("number", 5)
                .queryParam("apiKey", apiKey)
                .toUriString();
        return restTemplate.getForObject(url, String.class);
    }

    static String hash(List<String> ingredients) {
        String normalized = ingredients.stream()
                .map(s -> s.toLowerCase().trim())
                .sorted()
                .reduce((a, b) -> a + "," + b)
                .orElse("");
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(normalized.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
