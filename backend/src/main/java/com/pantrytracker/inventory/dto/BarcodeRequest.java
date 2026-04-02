package com.pantrytracker.inventory.dto;

import jakarta.validation.constraints.NotBlank;

public record BarcodeRequest(
        @NotBlank(message = "Barcode must not be blank")
        String barcode
) {}
