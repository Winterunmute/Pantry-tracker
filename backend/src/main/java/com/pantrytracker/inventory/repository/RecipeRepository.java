package com.pantrytracker.inventory.repository;

import com.pantrytracker.inventory.model.Recipe;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface RecipeRepository extends MongoRepository<Recipe, String> {

    boolean existsBySourceMealDbId(String sourceMealDbId);

    boolean existsBySourceSpoonacularId(String sourceSpoonacularId);
}
