package com.pantrytracker.inventory.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/spoonacular")
@RequiredArgsConstructor
public class SpoonacularController {

    private static final String BASE = "https://api.spoonacular.com";

    @Value("${spoonacular.api-key}")
    private String apiKey;

    private final RestTemplate restTemplate;

    /** Proxy: GET /api/spoonacular/findByIngredients?ingredients={csv}&number=20 */
    @GetMapping("/findByIngredients")
    public ResponseEntity<Object> findByIngredients(
            @RequestParam String ingredients,
            @RequestParam(defaultValue = "20") int number) {
        log.info("Spoonacular findByIngredients ingredients={}", ingredients);
        String url = BASE + "/recipes/findByIngredients"
                + "?ingredients={ing}&number={n}&ranking=1&ignorePantry=true&apiKey={key}";
        try {
            Object result = restTemplate.getForObject(url, Object.class, ingredients, number, apiKey);
            return ResponseEntity.ok(result);
        } catch (HttpClientErrorException e) {
            log.warn("Spoonacular findByIngredients error {} — returning empty: {}", e.getStatusCode().value(), e.getResponseBodyAsString());
            return ResponseEntity.ok(Collections.emptyList());
        }
    }

    /** Proxy: GET /api/spoonacular/search?query={query}&number=20 */
    @GetMapping("/search")
    public ResponseEntity<Object> search(
            @RequestParam String query,
            @RequestParam(defaultValue = "20") int number) {
        log.info("Spoonacular search query={}", query);
        String url = BASE + "/recipes/complexSearch"
                + "?query={q}&number={n}&addRecipeInformation=true&apiKey={key}";
        try {
            Object result = restTemplate.getForObject(url, Object.class, query, number, apiKey);
            return ResponseEntity.ok(result);
        } catch (HttpClientErrorException e) {
            log.warn("Spoonacular search error {} — returning empty: {}", e.getStatusCode().value(), e.getResponseBodyAsString());
            return ResponseEntity.ok(Map.of("results", Collections.emptyList(), "totalResults", 0));
        }
    }

    /** Proxy: GET /api/spoonacular/recipe/{id} */
    @GetMapping("/recipe/{id}")
    public ResponseEntity<Object> recipeDetail(@PathVariable int id) {
        log.info("Spoonacular recipe/{}", id);
        String url = BASE + "/recipes/{id}/information?apiKey={key}";
        try {
            Object result = restTemplate.getForObject(url, Object.class, id, apiKey);
            return ResponseEntity.ok(result);
        } catch (HttpClientErrorException e) {
            log.warn("Spoonacular recipe/{} error {}: {}", id, e.getStatusCode().value(), e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).build();
        }
    }
}
