package com.ludo.king.controller;

import com.ludo.king.model.GameHistory;
import com.ludo.king.model.User;
import com.ludo.king.repository.GameHistoryRepository;
import com.ludo.king.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class AuthController {

    private final UserRepository userRepository;
    private final GameHistoryRepository gameHistoryRepository;

    @Autowired
    public AuthController(UserRepository userRepository, GameHistoryRepository gameHistoryRepository) {
        this.userRepository = userRepository;
        this.gameHistoryRepository = gameHistoryRepository;
    }

    private String hashPassword(String password) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(password.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }
    }

    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@RequestBody Map<String, String> request) {
        String username = request.get("username");
        String password = request.get("password");

        Map<String, Object> response = new HashMap<>();

        if (username == null || username.trim().isEmpty() || password == null || password.trim().isEmpty()) {
            response.put("success", false);
            response.put("error", "Username and password required.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }

        String lowerUsername = username.trim().toLowerCase();

        if (userRepository.existsById(lowerUsername)) {
            response.put("success", false);
            response.put("error", "Username already exists.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }

        User user = new User();
        user.setUsername(username.trim());
        user.setPasswordHash(hashPassword(password));
        
        userRepository.save(user);

        response.put("success", true);
        response.put("message", "User registered successfully!");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> request) {
        String username = request.get("username");
        String password = request.get("password");

        Map<String, Object> response = new HashMap<>();

        if (username == null || username.trim().isEmpty() || password == null || password.trim().isEmpty()) {
            response.put("success", false);
            response.put("error", "Username and password required.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }

        String lowerUsername = username.trim().toLowerCase();
        User user = userRepository.findById(lowerUsername).orElse(null);

        // Custom bypass for restoring guest session from sessionStorage
        if (password.equals("guest_pass_bypass") && username.startsWith("Guest_")) {
            // Reconstruct a guest response directly
            Map<String, Object> guestData = new HashMap<>();
            guestData.put("username", username);
            guestData.put("coins", 5000);
            guestData.put("stats", Map.of("wins", 0, "losses", 0, "gamesPlayed", 0));
            guestData.put("inventory", List.of("default_dice", "default_token", "default_board", "avatar_1"));
            guestData.put("equipped", Map.of(
                    "dice", "default_dice",
                    "token", "default_token",
                    "board", "default_board",
                    "avatar", "avatar_1",
                    "frame", "none"
            ));
            guestData.put("history", List.of());

            response.put("success", true);
            response.put("user", guestData);
            return ResponseEntity.ok(response);
        }

        if (user == null || !user.getPasswordHash().equals(hashPassword(password))) {
            response.put("success", false);
            response.put("error", "Invalid username or password.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
        }

        // Fetch recent match history
        List<GameHistory> histories = gameHistoryRepository.findTop20ByUsernameOrderByIdDesc(user.getUsername());
        List<Map<String, Object>> historyList = histories.stream().map(h -> {
            Map<String, Object> hMap = new HashMap<>();
            hMap.put("gameId", "room-" + h.getRoomId());
            hMap.put("mode", h.getMode());
            hMap.put("date", h.getDate().toString());
            hMap.put("players", Arrays.asList(h.getPlayers().split(",")));
            hMap.put("rank", h.getRank());
            hMap.put("coinsEarned", h.getCoinsEarned());
            return hMap;
        }).collect(Collectors.toList());

        // Return user profile data
        Map<String, Object> userData = new HashMap<>();
        userData.put("username", user.getUsername());
        userData.put("coins", user.getCoins());
        userData.put("stats", Map.of(
                "wins", user.getWins(),
                "losses", user.getLosses(),
                "gamesPlayed", user.getGamesPlayed()
        ));
        
        userData.put("inventory", Arrays.asList(user.getInventory().split(",")));
        userData.put("equipped", Map.of(
                "dice", user.getEquippedDice(),
                "token", user.getEquippedToken(),
                "board", user.getEquippedBoard(),
                "avatar", user.getEquippedAvatar(),
                "frame", user.getEquippedFrame()
        ));
        userData.put("history", historyList);

        response.put("success", true);
        response.put("user", userData);
        
        return ResponseEntity.ok(response);
    }
}
