package com.pantrytracker.inventory.controller;

import com.pantrytracker.inventory.dto.DealResponse;
import com.pantrytracker.inventory.service.TjekService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/deals")
@RequiredArgsConstructor
public class DealsController {

    private final TjekService tjekService;

    @GetMapping
    public ResponseEntity<DealResponse> getDeal(
            @RequestParam String query,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng) {
        log.info("GET /api/deals query={} lat={} lng={}", query, lat, lng);
        return ResponseEntity.ok(tjekService.search(query, lat, lng));
    }
}
