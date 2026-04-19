package com.pantrytracker.inventory.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "recipes")
public class Recipe {

    @Id
    private String id;

    private String name;
    private String description;

    private List<RecipeIngredient> ingredients;

    /** Ordered cooking steps. */
    private List<String> instructions;

    @Builder.Default
    private int servings = 4;

    private String imageUrl;

    /** Original URL if the recipe was found online. */
    private String sourceUrl;

    /** TheMealDB meal ID — set when imported via /api/recipes/import. */
    private String sourceMealDbId;

    /** Spoonacular recipe ID — set when imported via /api/recipes/import. */
    private String sourceSpoonacularId;

    private List<String> tags;

    @Builder.Default
    private Instant createdAt = Instant.now();

    // ── Nested type ───────────────────────────────────────────────────────────

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecipeIngredient {
        /** English ingredient name (matches TheMealDB vocabulary). */
        private String name;

        /** Optional Swedish product name hint. */
        private String swedishName;

        /** Free-text amount, e.g. "200g", "2 st", "1 msk". */
        private String amount;
    }
}
