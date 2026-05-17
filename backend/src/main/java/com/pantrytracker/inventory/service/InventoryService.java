package com.pantrytracker.inventory.service;

import com.pantrytracker.inventory.model.InventoryItem;
import com.pantrytracker.inventory.repository.InventoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import org.springframework.beans.factory.annotation.Value;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InventoryService {

    private final InventoryRepository inventoryRepository;

    @Value("${inventory.expiry-warning-days:7}")
    private int expiryWarningDays;

    public List<InventoryItem> getAll() {
        return inventoryRepository.findAll();
    }

    public InventoryItem create(InventoryItem item) {
        // Ensure createdAt is set server-side, regardless of what the client sends
        item.setCreatedAt(LocalDateTime.now());
        return inventoryRepository.save(item);
    }

    public InventoryItem update(String id, InventoryItem updated) {
        InventoryItem existing = inventoryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Item not found: " + id));

        // Apply only the mutable fields — id and createdAt are immutable
        existing.setName(updated.getName());
        existing.setBrand(updated.getBrand());
        existing.setBarcode(updated.getBarcode());
        existing.setQuantity(updated.getQuantity());
        existing.setLocation(updated.getLocation());
        existing.setExpiryDate(updated.getExpiryDate());
        existing.setImageUrl(updated.getImageUrl());
        existing.setConsumptionLevel(updated.getConsumptionLevel());
        existing.setStaple(updated.isStaple());
        existing.setRestockThreshold(updated.getRestockThreshold());

        return inventoryRepository.save(existing);
    }

    public List<InventoryItem> getShoppingList() {
        List<InventoryItem> all = inventoryRepository.findAll();

        // Group by normalised product name
        Map<String, List<InventoryItem>> byName = all.stream()
                .collect(Collectors.groupingBy(i ->
                        i.getName() != null ? i.getName().toLowerCase().trim() : i.getId()));

        return byName.values().stream()
                // Only consider groups where at least one package is a staple
                .filter(group -> group.stream().anyMatch(InventoryItem::isStaple))
                // Only add to shopping list when ALL packages are consumed (level == 0)
                .filter(group -> group.stream().allMatch(i -> i.getConsumptionLevel() <= 0))
                // Return one representative per group (prefer the staple-marked one)
                .map(group -> group.stream()
                        .filter(InventoryItem::isStaple)
                        .min(Comparator.comparingDouble(InventoryItem::getConsumptionLevel))
                        .orElse(group.get(0)))
                .collect(Collectors.toList());
    }

    public List<InventoryItem> getExpiring() {
        LocalDate today = LocalDate.now();
        LocalDate cutoff = today.plusDays(expiryWarningDays);
        return inventoryRepository.findAll().stream()
                .filter(i -> i.getExpiryDate() != null && !i.getExpiryDate().isAfter(cutoff))
                .filter(i -> i.getConsumptionLevel() > 0)
                .sorted(Comparator.comparing(InventoryItem::getExpiryDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .collect(Collectors.toList());
    }

    public void delete(String id) {
        if (!inventoryRepository.existsById(id)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Item not found: " + id);
        }
        inventoryRepository.deleteById(id);
    }

    public InventoryItem getById(String id) {
        return inventoryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Item not found: " + id));
    }
}
