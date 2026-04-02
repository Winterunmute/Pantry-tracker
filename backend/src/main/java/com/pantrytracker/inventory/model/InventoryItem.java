package com.pantrytracker.inventory.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "inventory")
public class InventoryItem {

    @Id
    private String id;

    private String name;
    private String barcode;
    private String brand;

    @Builder.Default
    private int quantity = 1;

    private Location location;

    private LocalDate expiryDate;
    private String imageUrl;

    /** 0.0 = empty, 1.0 = full */
    @Builder.Default
    private double consumptionLevel = 1.0;

    @JsonProperty("isStaple")
    @Builder.Default
    private boolean isStaple = false;

    /** Restock alert when consumptionLevel drops to or below this value */
    @Builder.Default
    private double restockThreshold = 0.25;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    public enum Location {
        FRIDGE, FREEZER, PANTRY, SUNDRIES
    }
}
