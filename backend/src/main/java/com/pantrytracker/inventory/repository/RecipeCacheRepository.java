package com.pantrytracker.inventory.repository;

import com.pantrytracker.inventory.model.RecipeCache;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RecipeCacheRepository extends MongoRepository<RecipeCache, String> {
    Optional<RecipeCache> findByIngredientHash(String ingredientHash);
}
