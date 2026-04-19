package com.pantrytracker.inventory.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.pantrytracker.inventory.model.Recipe;
import com.pantrytracker.inventory.repository.RecipeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class RecipeService {

    private static final String MEALDB_LOOKUP =
            "https://www.themealdb.com/api/json/v1/1/lookup.php?i={id}";

    private static final String SPOONACULAR_LOOKUP =
            "https://api.spoonacular.com/recipes/{id}/information?apiKey={key}";

    @Value("${spoonacular.api-key}")
    private String spoonacularApiKey;

    private final RecipeRepository recipeRepository;
    private final RestTemplate restTemplate;

    public List<Recipe> findAll() {
        return recipeRepository.findAll();
    }

    public Recipe save(Recipe recipe) {
        if (recipe.getCreatedAt() == null) {
            recipe.setCreatedAt(Instant.now());
        }
        return recipeRepository.save(recipe);
    }

    public Recipe update(String id, Recipe updated) {
        Recipe existing = recipeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recipe not found: " + id));
        existing.setName(updated.getName());
        existing.setDescription(updated.getDescription());
        existing.setIngredients(updated.getIngredients());
        existing.setInstructions(updated.getInstructions());
        existing.setServings(updated.getServings());
        existing.setImageUrl(updated.getImageUrl());
        existing.setSourceUrl(updated.getSourceUrl());
        existing.setTags(updated.getTags());
        return recipeRepository.save(existing);
    }

    public void delete(String id) {
        if (!recipeRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Recipe not found: " + id);
        }
        recipeRepository.deleteById(id);
    }

    /**
     * Imports a recipe from TheMealDB by its meal ID.
     * Returns the existing saved recipe if already imported (idempotent).
     */
    public Recipe importFromMealDb(String mealDbId) {
        if (recipeRepository.existsBySourceMealDbId(mealDbId)) {
            return recipeRepository.findAll().stream()
                    .filter(r -> mealDbId.equals(r.getSourceMealDbId()))
                    .findFirst()
                    .orElseThrow();
        }

        MealDbResponse response = restTemplate.getForObject(MEALDB_LOOKUP, MealDbResponse.class, mealDbId);
        if (response == null || response.meals == null || response.meals.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Meal not found in TheMealDB: " + mealDbId);
        }

        MealDbMeal meal = response.meals.get(0);
        log.info("Importing TheMealDB meal: {} (id={})", meal.strMeal, mealDbId);

        List<Recipe.RecipeIngredient> ingredients = new ArrayList<>();
        for (int i = 1; i <= 20; i++) {
            String ing = meal.getIngredient(i);
            String mea = meal.getMeasure(i);
            if (ing != null && !ing.isBlank()) {
                ingredients.add(Recipe.RecipeIngredient.builder()
                        .name(ing.trim())
                        .amount(mea != null ? mea.trim() : "")
                        .build());
            }
        }

        List<String> steps = new ArrayList<>();
        if (meal.strInstructions != null) {
            for (String step : meal.strInstructions.split("\r?\n")) {
                String trimmed = step.trim();
                if (!trimmed.isEmpty()) steps.add(trimmed);
            }
        }

        List<String> tags = new ArrayList<>();
        if (meal.strTags != null) {
            for (String tag : meal.strTags.split(",")) {
                String t = tag.trim();
                if (!t.isEmpty()) tags.add(t);
            }
        }

        Recipe recipe = Recipe.builder()
                .name(meal.strMeal)
                .description(meal.strCategory + " · " + meal.strArea)
                .ingredients(ingredients)
                .instructions(steps)
                .servings(4)
                .imageUrl(meal.strMealThumb)
                .sourceUrl(meal.strSource)
                .sourceMealDbId(mealDbId)
                .tags(tags)
                .createdAt(Instant.now())
                .build();

        return recipeRepository.save(recipe);
    }

    /**
     * Imports a recipe from Spoonacular by its recipe ID.
     * Returns the existing saved recipe if already imported (idempotent).
     */
    public Recipe importFromSpoonacular(int spoonacularId) {
        String idStr = String.valueOf(spoonacularId);
        if (recipeRepository.existsBySourceSpoonacularId(idStr)) {
            return recipeRepository.findAll().stream()
                    .filter(r -> idStr.equals(r.getSourceSpoonacularId()))
                    .findFirst()
                    .orElseThrow();
        }

        SpoonacularInfo info = restTemplate.getForObject(
                SPOONACULAR_LOOKUP, SpoonacularInfo.class, spoonacularId, spoonacularApiKey);
        if (info == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Recipe not found in Spoonacular: " + spoonacularId);
        }

        log.info("Importing Spoonacular recipe: {} (id={})", info.title, spoonacularId);

        List<Recipe.RecipeIngredient> ingredients = new ArrayList<>();
        if (info.extendedIngredients != null) {
            for (SpoonacularInfo.ExtIngredient i : info.extendedIngredients) {
                if (i.name == null || i.name.isBlank()) continue;
                String amount = (i.amount != null ? i.amount.toString() : "")
                        + (i.unit != null && !i.unit.isBlank() ? " " + i.unit : "");
                ingredients.add(Recipe.RecipeIngredient.builder()
                        .name(i.name.trim().toLowerCase())
                        .amount(amount.trim())
                        .build());
            }
        }

        List<String> steps = new ArrayList<>();
        if (info.instructions != null && !info.instructions.isBlank()) {
            for (String step : info.instructions.split("\r?\n")) {
                String t = step.trim();
                if (!t.isEmpty()) steps.add(t);
            }
        } else if (info.analyzedInstructions != null && !info.analyzedInstructions.isEmpty()) {
            for (SpoonacularInfo.Step step : info.analyzedInstructions.get(0).steps) {
                if (step.step != null && !step.step.isBlank()) steps.add(step.step.trim());
            }
        }

        List<String> tags = info.dishTypes != null ? info.dishTypes : new ArrayList<>();

        String description = buildSpoonDescription(info);

        Recipe recipe = Recipe.builder()
                .name(info.title)
                .description(description)
                .ingredients(ingredients)
                .instructions(steps)
                .servings(info.servings != null ? info.servings : 4)
                .imageUrl(info.image)
                .sourceUrl(info.sourceUrl)
                .sourceSpoonacularId(idStr)
                .tags(tags)
                .createdAt(Instant.now())
                .build();

        return recipeRepository.save(recipe);
    }

    private String buildSpoonDescription(SpoonacularInfo info) {
        List<String> parts = new ArrayList<>();
        if (info.dishTypes != null && !info.dishTypes.isEmpty()) {
            parts.add(info.dishTypes.get(0));
        }
        if (info.cuisines != null && !info.cuisines.isEmpty()) {
            parts.add(info.cuisines.get(0));
        }
        if (info.readyInMinutes != null) {
            parts.add(info.readyInMinutes + " min");
        }
        return String.join(" · ", parts);
    }

    // ── Spoonacular response DTOs ─────────────────────────────────────────────

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class SpoonacularInfo {
        public Integer id;
        public String title;
        public String image;
        public Integer servings;
        public Integer readyInMinutes;
        public String instructions;
        public String sourceUrl;
        public List<String> dishTypes;
        public List<String> cuisines;
        public List<ExtIngredient> extendedIngredients;
        public List<InstructionGroup> analyzedInstructions;

        @JsonIgnoreProperties(ignoreUnknown = true)
        static class ExtIngredient {
            public String name;
            public Double amount;
            public String unit;
        }

        @JsonIgnoreProperties(ignoreUnknown = true)
        static class InstructionGroup {
            public List<Step> steps;
        }

        @JsonIgnoreProperties(ignoreUnknown = true)
        static class Step {
            public String step;
        }
    }

    // ── TheMealDB response DTOs ───────────────────────────────────────────────

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class MealDbResponse {
        public List<MealDbMeal> meals;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class MealDbMeal {
        public String idMeal;
        public String strMeal;
        public String strCategory;
        public String strArea;
        public String strInstructions;
        public String strMealThumb;
        public String strTags;
        public String strSource;

        // Jackson can't dynamically map strIngredient1..20, so we use @JsonProperty per field
        @JsonProperty("strIngredient1")  public String ing1;
        @JsonProperty("strIngredient2")  public String ing2;
        @JsonProperty("strIngredient3")  public String ing3;
        @JsonProperty("strIngredient4")  public String ing4;
        @JsonProperty("strIngredient5")  public String ing5;
        @JsonProperty("strIngredient6")  public String ing6;
        @JsonProperty("strIngredient7")  public String ing7;
        @JsonProperty("strIngredient8")  public String ing8;
        @JsonProperty("strIngredient9")  public String ing9;
        @JsonProperty("strIngredient10") public String ing10;
        @JsonProperty("strIngredient11") public String ing11;
        @JsonProperty("strIngredient12") public String ing12;
        @JsonProperty("strIngredient13") public String ing13;
        @JsonProperty("strIngredient14") public String ing14;
        @JsonProperty("strIngredient15") public String ing15;
        @JsonProperty("strIngredient16") public String ing16;
        @JsonProperty("strIngredient17") public String ing17;
        @JsonProperty("strIngredient18") public String ing18;
        @JsonProperty("strIngredient19") public String ing19;
        @JsonProperty("strIngredient20") public String ing20;

        @JsonProperty("strMeasure1")  public String mea1;
        @JsonProperty("strMeasure2")  public String mea2;
        @JsonProperty("strMeasure3")  public String mea3;
        @JsonProperty("strMeasure4")  public String mea4;
        @JsonProperty("strMeasure5")  public String mea5;
        @JsonProperty("strMeasure6")  public String mea6;
        @JsonProperty("strMeasure7")  public String mea7;
        @JsonProperty("strMeasure8")  public String mea8;
        @JsonProperty("strMeasure9")  public String mea9;
        @JsonProperty("strMeasure10") public String mea10;
        @JsonProperty("strMeasure11") public String mea11;
        @JsonProperty("strMeasure12") public String mea12;
        @JsonProperty("strMeasure13") public String mea13;
        @JsonProperty("strMeasure14") public String mea14;
        @JsonProperty("strMeasure15") public String mea15;
        @JsonProperty("strMeasure16") public String mea16;
        @JsonProperty("strMeasure17") public String mea17;
        @JsonProperty("strMeasure18") public String mea18;
        @JsonProperty("strMeasure19") public String mea19;
        @JsonProperty("strMeasure20") public String mea20;

        String getIngredient(int n) {
            return switch (n) {
                case 1  -> ing1;  case 2  -> ing2;  case 3  -> ing3;  case 4  -> ing4;
                case 5  -> ing5;  case 6  -> ing6;  case 7  -> ing7;  case 8  -> ing8;
                case 9  -> ing9;  case 10 -> ing10; case 11 -> ing11; case 12 -> ing12;
                case 13 -> ing13; case 14 -> ing14; case 15 -> ing15; case 16 -> ing16;
                case 17 -> ing17; case 18 -> ing18; case 19 -> ing19; case 20 -> ing20;
                default -> null;
            };
        }

        String getMeasure(int n) {
            return switch (n) {
                case 1  -> mea1;  case 2  -> mea2;  case 3  -> mea3;  case 4  -> mea4;
                case 5  -> mea5;  case 6  -> mea6;  case 7  -> mea7;  case 8  -> mea8;
                case 9  -> mea9;  case 10 -> mea10; case 11 -> mea11; case 12 -> mea12;
                case 13 -> mea13; case 14 -> mea14; case 15 -> mea15; case 16 -> mea16;
                case 17 -> mea17; case 18 -> mea18; case 19 -> mea19; case 20 -> mea20;
                default -> null;
            };
        }
    }
}
