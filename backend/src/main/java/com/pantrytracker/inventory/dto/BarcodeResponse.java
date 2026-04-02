package com.pantrytracker.inventory.dto;

public record BarcodeResponse(
        String productName,
        String brand,
        String imageUrl
) {}
