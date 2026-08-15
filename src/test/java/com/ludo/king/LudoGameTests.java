package com.ludo.king;

import com.ludo.king.engine.LudoGame;
import com.ludo.king.model.GameHistory;
import com.ludo.king.model.User;
import com.ludo.king.repository.GameHistoryRepository;
import com.ludo.king.repository.UserRepository;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.Instant;
import java.util.*;

@SpringBootTest
public class LudoGameTests {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GameHistoryRepository gameHistoryRepository;

    @Test
    public void testDatabaseMappings() {
        // Test User Creation and Persistence
        String testUser = "test_junit_player_" + new Random().nextInt(100000);
        User user = new User(testUser, "hashed_password_123");
        user.setCoins(3500);
        user.setWins(2);
        user.setLosses(1);
        userRepository.save(user);

        User retrieved = userRepository.findById(testUser).orElse(null);
        Assertions.assertNotNull(retrieved);
        Assertions.assertEquals(3500, retrieved.getCoins());
        Assertions.assertEquals(2, retrieved.getWins());

        // Test GameHistory Persistence
        GameHistory history = new GameHistory(
                testUser,
                "999999",
                "2-PLAYER",
                Instant.now(),
                testUser + ",Bot_yellow",
                1,
                1000
        );
        gameHistoryRepository.save(history);

        List<GameHistory> list = gameHistoryRepository.findTop20ByUsernameOrderByIdDesc(testUser);
        Assertions.assertFalse(list.isEmpty());
        Assertions.assertEquals("2-PLAYER", list.get(0).getMode());
        Assertions.assertEquals(1, list.get(0).getRank());

        // Cleanup
        gameHistoryRepository.delete(history);
        userRepository.delete(user);
    }

    @Test
    public void testLudoEngineRules() {
        // Initialize 2-Player game (Red and Yellow)
        List<LudoGame.Player> players = new ArrayList<>();
        players.add(new LudoGame.Player("P1", null, "human", "session_red"));
        players.add(new LudoGame.Player("P2", null, "human", "session_yellow"));

        LudoGame game = new LudoGame("555666", players, "2-player");
        Assertions.assertEquals("LOBBY", game.getState());
        
        game.startGame();
        Assertions.assertEquals("PLAYING", game.getState());

        // Test coordinates conversions
        Assertions.assertEquals(0, LudoGame.getStartOffset("RED"));
        Assertions.assertEquals(26, LudoGame.getStartOffset("YELLOW"));
        Assertions.assertEquals(13, LudoGame.getStartOffset("BLUE"));
        Assertions.assertEquals(39, LudoGame.getStartOffset("GREEN"));

        // Verify star cells
        Assertions.assertTrue(LudoGame.isGlobalSafe(0));
        Assertions.assertTrue(LudoGame.isGlobalSafe(8));
        Assertions.assertFalse(LudoGame.isGlobalSafe(5));

        // Test Release from yard validation:
        // Set turn explicitly to P1 (Red: index 0)
        // Red tokens initial value is -1 (in yard)
        // Set dice roll explicitly to 3 (should have no valid moves)
        // Set hasRolled to true so engine can check moves
        // We set values via reflection or modify game rules (we can set values directly since turn and roll are package private/have getters)
        // Let's execute this check programmatically.
        // Wait, we can test rolling and moving on game.
    }
}
