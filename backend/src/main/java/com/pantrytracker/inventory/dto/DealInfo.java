package com.pantrytracker.inventory.dto;

public record DealInfo(
        String heading,
        double price,
        String currency,
        String storeName,
        String imageUrl,
        String runTill,
        String nearbyStoreLabel   // null when no location provided or no nearby match
) {}
