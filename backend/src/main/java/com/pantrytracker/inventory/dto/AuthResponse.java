package com.pantrytracker.inventory.dto;

public record AuthResponse(
        String accessToken,
        String refreshToken
) {}
