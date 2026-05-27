package com.pantrytracker.inventory.service;

import com.pantrytracker.inventory.model.User;
import com.pantrytracker.inventory.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.seed.username:pantry}")
    private String seedUsername;

    @Value("${app.seed.password:pantry}")
    private String seedPassword;

    @Override
    public void run(String... args) {
        if (userRepository.count() > 0) {
            log.info("Users exist — skipping seed");
            return;
        }

        User user = User.builder()
                .username(seedUsername)
                .password(passwordEncoder.encode(seedPassword))
                .build();

        userRepository.save(user);
        log.info("Seeded default user: {}", seedUsername);
    }
}
