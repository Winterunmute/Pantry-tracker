package com.pantrytracker.inventory.controller;

import com.pantrytracker.inventory.dto.BarcodeRequest;
import com.pantrytracker.inventory.dto.BarcodeResponse;
import com.pantrytracker.inventory.service.BarcodeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/barcode")
@RequiredArgsConstructor
public class BarcodeController {

    private final BarcodeService barcodeService;

    @PostMapping
    public ResponseEntity<BarcodeResponse> lookup(@Valid @RequestBody BarcodeRequest request) {
        BarcodeResponse response = barcodeService.lookup(request.barcode());
        return ResponseEntity.ok(response);
    }
}
