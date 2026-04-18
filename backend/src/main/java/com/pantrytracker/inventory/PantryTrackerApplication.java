package com.pantrytracker.inventory;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@Slf4j
@SpringBootApplication
@EnableScheduling
public class PantryTrackerApplication {

    @Value("${spring.data.mongodb.uri}")
    private String mongoUri;

    public static void main(String[] args) {
        SpringApplication.run(PantryTrackerApplication.class, args);
    }

    @PostConstruct
    public void logMongoUri() {
        log.info("MongoDB URI (masked): {}", mongoUri.replaceAll(":([^@]+)@", ":***@"));
    }
}
