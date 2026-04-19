package com.pantrytracker.inventory.controller;

import com.pantrytracker.inventory.model.InventoryItem;
import com.pantrytracker.inventory.service.InventoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    @GetMapping
    public ResponseEntity<List<InventoryItem>> getAll() {
        return ResponseEntity.ok(inventoryService.getAll());
    }

    @GetMapping("/expiring")
    public ResponseEntity<List<InventoryItem>> getExpiring() {
        return ResponseEntity.ok(inventoryService.getExpiring());
    }

    @GetMapping("/shopping-list")
    public ResponseEntity<List<InventoryItem>> getShoppingList() {
        List<InventoryItem> result = inventoryService.getShoppingList();
        log.info("GET /api/inventory/shopping-list → {} items", result.size());
        result.forEach(i -> log.info("  shopping-list item: name={} isStaple={} consumptionLevel={} restockThreshold={}",
                i.getName(), i.isStaple(), i.getConsumptionLevel(), i.getRestockThreshold()));
        return ResponseEntity.ok(result);
    }

    @PostMapping
    public ResponseEntity<InventoryItem> create(@Valid @RequestBody InventoryItem item) {
        log.info("POST /api/inventory body: {}", item);
        InventoryItem created = inventoryService.create(item);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationError(MethodArgumentNotValidException ex) {
        List<String> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .collect(Collectors.toList());
        log.error("Validation failed: {}", errors);
        return ResponseEntity.badRequest().body(Map.of("errors", errors));
    }

    @PutMapping("/{id}")
    public ResponseEntity<InventoryItem> update(
            @PathVariable String id,
            @Valid @RequestBody InventoryItem item) {
        log.info("PUT /api/inventory/{} isStaple={} consumptionLevel={}", id, item.isStaple(), item.getConsumptionLevel());
        return ResponseEntity.ok(inventoryService.update(id, item));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        inventoryService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
