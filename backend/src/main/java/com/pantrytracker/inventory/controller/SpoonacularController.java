package com.pantrytracker.inventory.controller;

import com.pantrytracker.inventory.service.RecipeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/recipes")
@RequiredArgsConstructor
public class SpoonacularController {

    private final RecipeService recipeService;

    @GetMapping
    public ResponseEntity<String> getRecipes(@RequestParam List<String> ingredients) {
        return ResponseEntity.ok(recipeService.getRecipes(ingredients));
    }
}
