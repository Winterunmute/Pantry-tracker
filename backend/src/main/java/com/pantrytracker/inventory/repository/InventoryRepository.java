package com.pantrytracker.inventory.repository;

import com.pantrytracker.inventory.model.InventoryItem;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InventoryRepository extends MongoRepository<InventoryItem, String> {

    List<InventoryItem> findByLocation(InventoryItem.Location location);

    List<InventoryItem> findByBarcode(String barcode);

    List<InventoryItem> findByConsumptionLevelGreaterThan(double consumptionLevel);
}
