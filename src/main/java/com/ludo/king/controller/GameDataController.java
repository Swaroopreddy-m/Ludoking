package com.ludo.king.controller;

import com.ludo.king.model.User;
import com.ludo.king.repository.GameHistoryRepository;
import com.ludo.king.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class GameDataController {

    private final UserRepository userRepository;
    private final GameHistoryRepository gameHistoryRepository;

    private static final List<Map<String, Object>> STORE_ITEMS = new ArrayList<>();
    private static final List<Map<String, Object>> EVENTS_LIST = new ArrayList<>();

    private static Map<String, Object> createMap(Object... keyValues) {
        Map<String, Object> map = new HashMap<>();
        for (int i = 0; i < keyValues.length; i += 2) {
            map.put((String) keyValues[i], keyValues[i + 1]);
        }
        return map;
    }

    static {
        // Populate static Store Catalog
        STORE_ITEMS.add(createMap("id", "default_dice", "category", "dice", "name", "Classic White", "description", "The standard bone-white Ludo dice.", "price", 0, "previewColor", "#ffffff", "image", "🎲"));
        STORE_ITEMS.add(createMap("id", "golden_dice", "category", "dice", "name", "Golden Roll", "description", "A shiny golden dice that radiates luck.", "price", 1000, "previewColor", "#FFD700", "image", "🏆"));
        STORE_ITEMS.add(createMap("id", "fire_dice", "category", "dice", "name", "Inferno Dice", "description", "A burning hot dice with fire particles.", "price", 2500, "previewColor", "#FF4500", "image", "🔥"));

        STORE_ITEMS.add(createMap("id", "default_token", "category", "token", "name", "Classic Token", "description", "Standard round Ludo counters.", "price", 0, "previewColor", "#e74c3c", "image", "🔴"));
        STORE_ITEMS.add(createMap("id", "crown_token", "category", "token", "name", "Royal Crown", "description", "Tokens shaped like miniature royal crowns.", "price", 1500, "previewColor", "#f1c40f", "image", "👑"));
        STORE_ITEMS.add(createMap("id", "star_token", "category", "token", "name", "Cosmic Star", "description", "Glowing stars from deep space.", "price", 2000, "previewColor", "#9b59b6", "image", "⭐"));

        STORE_ITEMS.add(createMap("id", "default_board", "category", "board", "name", "Classic Wood", "description", "Traditional board theme with standard primary colors.", "price", 0, "previewColor", "#f39c12", "image", "🪵"));
        STORE_ITEMS.add(createMap("id", "neon_board", "category", "board", "name", "Neon Cyber", "description", "Cyberpunk layout with glowing grid lines.", "price", 3000, "previewColor", "#00ffff", "image", "🌐"));
        STORE_ITEMS.add(createMap("id", "candy_board", "category", "board", "name", "Candy Land", "description", "Sweet, pastel colors and candy theme.", "price", 1200, "previewColor", "#ff9ff3", "image", "🍭"));

        STORE_ITEMS.add(createMap("id", "avatar_1", "category", "avatar", "name", "Ludo Champ", "description", "A seasoned Ludo player avatar.", "price", 0, "previewColor", "#3498db", "image", "👤"));
        STORE_ITEMS.add(createMap("id", "avatar_2", "category", "avatar", "name", "Dice Master", "description", "Special wizard avatar wearing a dice hat.", "price", 800, "previewColor", "#e67e22", "image", "🧙‍♂️"));
        STORE_ITEMS.add(createMap("id", "avatar_3", "category", "avatar", "name", "Cyber Warrior", "description", "Futuristic cyborg ready for Ludo combat.", "price", 1500, "previewColor", "#2ecc71", "image", "🤖"));

        STORE_ITEMS.add(createMap("id", "frame_gold", "category", "frame", "name", "Golden Border", "description", "A gold-plated frame for your avatar profile.", "price", 1200, "previewColor", "#f1c40f", "image", "🖼️"));
        STORE_ITEMS.add(createMap("id", "frame_neon", "category", "frame", "name", "Laser Cyan", "description", "Electric cyan neon border for your avatar.", "price", 1800, "previewColor", "#00f5ff", "image", "⚡"));

        // Populate static Events List
        EVENTS_LIST.add(createMap("id", "daily_rush", "title", "Daily Coins Rush", "description", "Play 3 matches today to claim a bonus chest containing up to 1000 coins!", "endTime", "2026-08-16T23:59:59Z", "reward", "1000 Coins", "image", "💰", "type", "Daily"));
        EVENTS_LIST.add(createMap("id", "weekly_showdown", "title", "Ludo Masters Championship", "description", "Compete in the weekly leaderboard. The top 3 players win exclusive Golden Dice skins!", "endTime", "2026-08-20T12:00:00Z", "reward", "Golden Dice Skin + 5000 Coins", "image", "🏆", "type", "Weekly Tournament"));
        EVENTS_LIST.add(createMap("id", "star_challenge", "title", "Cosmic Star Event", "description", "Win 2 games using Yellow tokens. Unlock the Cosmic Star token skin for free!", "endTime", "2026-08-23T18:00:00Z", "reward", "Cosmic Star Skin", "image", "⭐", "type", "Special Challenge"));
    }

    @Autowired
    public GameDataController(UserRepository userRepository, GameHistoryRepository gameHistoryRepository) {
        this.userRepository = userRepository;
        this.gameHistoryRepository = gameHistoryRepository;
    }

    @GetMapping("/game-data")
    public ResponseEntity<Map<String, Object>> getGameData() {
        // Fetch top 10 players sorted by wins
        List<User> list = userRepository.findAll();
        List<Map<String, Object>> leaderboard = list.stream()
                .sorted((a, b) -> Integer.compare(b.getWins(), a.getWins()))
                .limit(10)
                .map(u -> createMap(
                        "username", u.getUsername(),
                        "wins", u.getWins(),
                        "gamesPlayed", u.getGamesPlayed()
                ))
                .collect(Collectors.toList());

        Map<String, Object> data = new HashMap<>();
        data.put("storeItems", STORE_ITEMS);
        data.put("events", EVENTS_LIST);
        data.put("leaderboard", leaderboard);

        return ResponseEntity.ok(data);
    }

    @PostMapping("/store/buy")
    public ResponseEntity<Map<String, Object>> buyItem(@RequestBody Map<String, String> request) {
        String username = request.get("username");
        String itemId = request.get("itemId");

        Map<String, Object> response = new HashMap<>();
        if (username == null || itemId == null) {
            response.put("error", "Missing parameters.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }

        User user = userRepository.findById(username.toLowerCase()).orElse(null);
        if (user == null) {
            response.put("error", "User not found.");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
        }

        List<String> inventoryList = new ArrayList<>(Arrays.asList(user.getInventory().split(",")));
        if (inventoryList.contains(itemId)) {
            response.put("error", "Item already owned.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }

        // Find item price
        Map<String, Object> item = STORE_ITEMS.stream().filter(i -> i.get("id").equals(itemId)).findFirst().orElse(null);
        if (item == null) {
            response.put("error", "Item not found in catalog.");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
        }

        int price = (int) item.get("price");
        if (user.getCoins() < price) {
            response.put("error", "Insufficient coins.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }

        // Deduct and save
        user.setCoins(user.getCoins() - price);
        inventoryList.add(itemId);
        user.setInventory(String.join(",", inventoryList));
        userRepository.save(user);

        response.put("success", true);
        response.put("coins", user.getCoins());
        response.put("inventory", inventoryList);

        return ResponseEntity.ok(response);
    }

    @PostMapping("/store/equip")
    public ResponseEntity<Map<String, Object>> equipItem(@RequestBody Map<String, String> request) {
        String username = request.get("username");
        String itemId = request.get("itemId");
        String category = request.get("category");

        Map<String, Object> response = new HashMap<>();
        if (username == null || itemId == null || category == null) {
            response.put("error", "Missing parameters.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }

        User user = userRepository.findById(username.toLowerCase()).orElse(null);
        if (user == null) {
            response.put("error", "User not found.");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
        }

        List<String> inventoryList = Arrays.asList(user.getInventory().split(","));
        if (!inventoryList.contains(itemId) && !itemId.equals("none")) {
            response.put("error", "You do not own this item.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }

        // Equip matching category
        switch (category) {
            case "dice":
                user.setEquippedDice(itemId);
                break;
            case "token":
                user.setEquippedToken(itemId);
                break;
            case "board":
                user.setEquippedBoard(itemId);
                break;
            case "avatar":
                user.setEquippedAvatar(itemId);
                break;
            case "frame":
                user.setEquippedFrame(itemId);
                break;
            default:
                response.put("error", "Invalid category.");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }

        userRepository.save(user);

        response.put("success", true);
        response.put("equipped", Map.of(
                "dice", user.getEquippedDice(),
                "token", user.getEquippedToken(),
                "board", user.getEquippedBoard(),
                "avatar", user.getEquippedAvatar(),
                "frame", user.getEquippedFrame()
        ));

        return ResponseEntity.ok(response);
    }
}
