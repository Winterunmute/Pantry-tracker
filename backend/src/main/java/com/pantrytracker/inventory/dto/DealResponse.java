package com.pantrytracker.inventory.dto;

import java.util.List;

public record DealResponse(
        boolean hasDeal,
        List<DealInfo> deals
) {}
