package com.pantrytracker.inventory.controller;

import com.pantrytracker.inventory.model.Recipe;
import com.pantrytracker.inventory.service.RecipeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/recipes")
@RequiredArgsConstructor
public class RecipeController {

    private final RecipeService recipeService;

    @GetMapping
    public ResponseEntity<List<Recipe>> getAll() {
        return ResponseEntity.ok(recipeService.findAll());
    }

    @PostMapping
    public ResponseEntity<Recipe> create(@RequestBody Recipe recipe) {
        log.info("POST /api/recipes name={}", recipe.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(recipeService.save(recipe));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Recipe> update(@PathVariable String id, @RequestBody Recipe recipe) {
        log.info("PUT /api/recipes/{}", id);
        return ResponseEntity.ok(recipeService.update(id, recipe));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        log.info("DELETE /api/recipes/{}", id);
        recipeService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/import")
    public ResponseEntity<Recipe> importRecipe(@RequestBody Map<String, String> body) {
        String mealDbId       = body.get("mealDbId");
        String spoonacularId  = body.get("spoonacularId");

        if (mealDbId != null && !mealDbId.isBlank()) {
            log.info("POST /api/recipes/import mealDbId={}", mealDbId);
            return ResponseEntity.status(HttpStatus.CREATED).body(recipeService.importFromMealDb(mealDbId));
        }

        if (spoonacularId != null && !spoonacularId.isBlank()) {
            log.info("POST /api/recipes/import spoonacularId={}", spoonacularId);
            try {
                int id = Integer.parseInt(spoonacularId);
                return ResponseEntity.status(HttpStatus.CREATED).body(recipeService.importFromSpoonacular(id));
            } catch (NumberFormatException e) {
                return ResponseEntity.badRequest().build();
            }
        }

        return ResponseEntity.badRequest().build();
    }
}
