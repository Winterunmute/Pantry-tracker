package com.pantrytracker.inventory.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "recipe_cache")
public class RecipeCache {

    @Id
    private String id;

    @Indexed(unique = true)
    private String ingredientHash;

    private List<String> ingredients;
    private String spoonacularResponse;

    @Indexed(expireAfterSeconds = 604800) // 7 days TTL
    @Builder.Default
    private Instant createdAt = Instant.now();
}
