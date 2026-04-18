package com.pantrytracker.inventory.scheduler;

import com.pantrytracker.inventory.model.InventoryItem;
import com.pantrytracker.inventory.repository.InventoryRepository;
import com.pantrytracker.inventory.service.RecipeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class RecipePrefetchJob {

    private static final int MAX_COMBINATIONS = 10;

    private final InventoryRepository inventoryRepository;
    private final RecipeService recipeService;

    @Scheduled(cron = "0 0 2 * * *")
    public void prefetch() {
        log.info("Recipe prefetch job starting");

        List<InventoryItem> items = inventoryRepository.findByConsumptionLevelGreaterThan(0.0);

        // Staples first, then nearest expiry, then alphabetical
        List<InventoryItem> prioritized = items.stream()
                .sorted(Comparator
                        .<InventoryItem, Boolean>comparing(i -> !i.isStaple())
                        .thenComparing(i -> i.getExpiryDate() == null ? LocalDate.MAX : i.getExpiryDate())
                        .thenComparing(InventoryItem::getName))
                .limit(MAX_COMBINATIONS)
                .toList();

        int fetched = 0;
        for (InventoryItem item : prioritized) {
            String result = recipeService.fetchAndCache(List.of(item.getName()));
            if (result != null) fetched++;
        }

        log.info("Recipe prefetch complete: {} API call(s) made, {} skipped (already cached)",
                fetched, prioritized.size() - fetched);
    }
}
