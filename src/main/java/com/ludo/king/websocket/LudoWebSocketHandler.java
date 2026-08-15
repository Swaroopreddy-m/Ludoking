package com.ludo.king.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ludo.king.engine.LudoGame;
import com.ludo.king.model.GameHistory;
import com.ludo.king.model.User;
import com.ludo.king.repository.GameHistoryRepository;
import com.ludo.king.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Component
public class LudoWebSocketHandler extends TextWebSocketHandler {

    private final UserRepository userRepository;
    private final GameHistoryRepository gameHistoryRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(4);

    // Active Game Rooms (Key: roomId, Value: LudoGame)
    private final Map<String, LudoGame> rooms = new ConcurrentHashMap<>();
    
    // Maps sessionId to roomId
    private final Map<String, String> sessionRoomMap = new ConcurrentHashMap<>();
    
    // Maps sessionId to active WebSocketSession
    private final Map<String, WebSocketSession> activeSessions = new ConcurrentHashMap<>();

    @Autowired
    public LudoWebSocketHandler(UserRepository userRepository, GameHistoryRepository gameHistoryRepository) {
        this.userRepository = userRepository;
        this.gameHistoryRepository = gameHistoryRepository;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        activeSessions.put(session.getId(), session);
        System.out.println("WebSocket Connected: " + session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        WSMessage wsMsg = objectMapper.readValue(payload, WSMessage.class);
        String type = wsMsg.getType();

        switch (type) {
            case "createRoom":
                handleCreateRoom(session, wsMsg);
                break;
            case "joinRoom":
                handleJoinRoom(session, wsMsg);
                break;
            case "startGame":
                handleStartGame(session, wsMsg);
                break;
            case "rollDice":
                handleRollDice(session, wsMsg);
                break;
            case "moveToken":
                handleMoveToken(session, wsMsg);
                break;
            case "chatMessage":
                handleChatMessage(session, wsMsg);
                break;
            case "requestRematch":
                handleRematch(session, wsMsg);
                break;
            case "leaveRoom":
                handleLeaveRoom(session);
                break;
        }
    }

    private void handleCreateRoom(WebSocketSession session, WSMessage msg) throws IOException {
        String roomId;
        do {
            roomId = String.format("%06d", new Random().nextInt(900000) + 100000);
        } while (rooms.containsKey(roomId));

        LudoGame.Player host = new LudoGame.Player(msg.getUsername(), null, "human", session.getId());
        List<LudoGame.Player> list = new ArrayList<>();
        list.add(host);

        LudoGame game = new LudoGame(roomId, list, msg.getMode());
        rooms.put(roomId, game);
        sessionRoomMap.put(session.getId(), roomId);

        sendToSession(session, "roomState", game);
        System.out.println("Room Created: " + roomId + " by " + msg.getUsername());
    }

    private void handleJoinRoom(WebSocketSession session, WSMessage msg) throws IOException {
        String roomId = msg.getRoomId();
        LudoGame game = rooms.get(roomId);

        if (game == null) {
            sendError(session, "Room not found.");
            return;
        }

        String username = msg.getUsername();

        // 1. Check for Reconnection
        if (game.getState().equals("PLAYING")) {
            LudoGame.Player disconnected = null;
            for (LudoGame.Player p : game.getPlayers()) {
                if (p.getUsername().equals(username) && p.getType().equals("disconnected")) {
                    disconnected = p;
                    break;
                }
            }

            if (disconnected != null) {
                disconnected.setType("human");
                disconnected.setSessionId(session.getId());
                sessionRoomMap.put(session.getId(), roomId);

                broadcast(roomId, "playerReconnected", Map.of(
                        "username", username,
                        "color", disconnected.getColor()
                ));
                broadcast(roomId, "roomState", game);

                System.out.println("Player " + username + " reconnected to room " + roomId);
                
                // If it is the reconnected player's turn, trigger bot routines (in case it timed out)
                LudoGame.Player active = game.getCurrentPlayer();
                if (active != null && active.getUsername().equals(username)) {
                    triggerBotOrAwaitPlayer(game);
                }
                return;
            } else {
                sendError(session, "Game already in progress.");
                return;
            }
        }

        if (game.getState().equals("FINISHED")) {
            sendError(session, "Game has already finished.");
            return;
        }

        // 2. Add as new player
        long humansCount = game.getPlayers().stream().filter(p -> p.getType().equals("human")).count();
        int max = game.getMode().equals("2-player") ? 2 : (game.getMode().equals("3-player") ? 3 : 4);

        if (humansCount >= max) {
            sendError(session, "Room is full.");
            return;
        }

        LudoGame.Player p = new LudoGame.Player(username, null, "human", session.getId());
        List<String> colors = game.getMode().equals("2-player") ? Arrays.asList("RED", "YELLOW") : Arrays.asList("RED", "GREEN", "YELLOW", "BLUE");
        p.setColor(colors.get(game.getPlayers().size()));
        
        game.getPlayers().add(p);
        sessionRoomMap.put(session.getId(), roomId);

        broadcast(roomId, "roomState", game);
        System.out.println("Player " + username + " joined room " + roomId);
    }

    private void handleStartGame(WebSocketSession session, WSMessage msg) throws IOException {
        String roomId = msg.getRoomId();
        LudoGame game = rooms.get(roomId);
        if (game == null) return;

        game.startGame();
        broadcast(roomId, "gameStarted", game);
        System.out.println("Game started in room " + roomId);

        triggerBotOrAwaitPlayer(game);
    }

    private void handleRollDice(WebSocketSession session, WSMessage msg) throws IOException {
        String roomId = msg.getRoomId();
        LudoGame game = rooms.get(roomId);
        if (game == null) return;

        LudoGame.Player active = game.getCurrentPlayer();
        if (active == null || !active.getSessionId().equals(session.getId()) || game.isHasRolled()) {
            return; // Not their turn
        }

        Map<String, Object> result = game.rollDice();
        if (result == null) return;

        broadcast(roomId, "diceRolled", Map.of(
                "color", active.getColor(),
                "roll", result.get("roll"),
                "validMoves", result.get("validMoves") != null ? result.get("validMoves") : List.of(),
                "turnForfeited", result.get("turnForfeited"),
                "message", result.get("message") != null ? result.get("message") : ""
        ));

        if (Boolean.TRUE.equals(result.get("turnForfeited"))) {
            scheduler.schedule(() -> {
                try {
                    broadcast(roomId, "roomState", game);
                    triggerBotOrAwaitPlayer(game);
                } catch (Exception e) { e.printStackTrace(); }
            }, 2000, TimeUnit.MILLISECONDS);
            return;
        }

        List<?> validMoves = (List<?>) result.get("validMoves");
        if (validMoves == null || validMoves.isEmpty()) {
            scheduler.schedule(() -> {
                try {
                    game.nextTurn();
                    broadcast(roomId, "roomState", game);
                    triggerBotOrAwaitPlayer(game);
                } catch (Exception e) { e.printStackTrace(); }
            }, 2000, TimeUnit.MILLISECONDS);
        }
    }

    private void handleMoveToken(WebSocketSession session, WSMessage msg) throws IOException {
        String roomId = msg.getRoomId();
        LudoGame game = rooms.get(roomId);
        if (game == null) return;

        LudoGame.Player active = game.getCurrentPlayer();
        if (active == null || !active.getSessionId().equals(session.getId()) || !game.isHasRolled()) {
            return;
        }

        Map<String, Object> moveResult = game.moveToken(msg.getTokenIndex());
        if (moveResult == null) return;

        // Broadcast token slide animation coordinates path
        broadcast(roomId, "tokenMoved", Map.of(
                "color", active.getColor(),
                "tokenIndex", msg.getTokenIndex(),
                "roll", moveResult.get("roll"),
                "path", moveResult.get("path"),
                "capturedTokens", moveResult.get("capturedTokens"),
                "earnedExtraTurn", moveResult.get("earnedExtraTurn"),
                "extraRollReason", moveResult.get("extraRollReason") != null ? moveResult.get("extraRollReason") : "",
                "gameState", game
        ));

        if (game.getState().equals("FINISHED")) {
            handleGameCompletion(game);
            return;
        }

        // Cycle turns after animation delay
        scheduler.schedule(() -> {
            try {
                broadcast(roomId, "roomState", game);
                triggerBotOrAwaitPlayer(game);
            } catch (Exception e) { e.printStackTrace(); }
        }, 1500, TimeUnit.MILLISECONDS);
    }

    private void handleChatMessage(WebSocketSession session, WSMessage msg) throws IOException {
        String roomId = msg.getRoomId();
        LudoGame game = rooms.get(roomId);
        if (game == null) return;

        LudoGame.Player sender = null;
        for (LudoGame.Player p : game.getPlayers()) {
            if (p.getSessionId() != null && p.getSessionId().equals(session.getId())) {
                sender = p;
                break;
            }
        }

        if (sender != null) {
            broadcast(roomId, "chatMessage", Map.of(
                    "username", sender.getUsername(),
                    "color", sender.getColor(),
                    "message", msg.getMessage(),
                    "isEmote", msg.getIsEmote() != null ? msg.getIsEmote() : false
            ));
        }
    }

    private void handleRematch(WebSocketSession session, WSMessage msg) throws IOException {
        String roomId = msg.getRoomId();
        LudoGame game = rooms.get(roomId);
        if (game == null) return;

        // Clone current players to start new game
        List<LudoGame.Player> list = game.getPlayers().stream().map(p -> new LudoGame.Player(
                p.getUsername(),
                null,
                p.getType().equals("disconnected") ? "bot" : p.getType(),
                p.getSessionId()
        )).collect(Collectors.toList());

        LudoGame newGame = new LudoGame(roomId, list, game.getMode());
        rooms.put(roomId, newGame);
        newGame.startGame();

        broadcast(roomId, "gameStarted", newGame);
        triggerBotOrAwaitPlayer(newGame);
    }

    private void handleLeaveRoom(WebSocketSession session) throws IOException {
        handleUserLeaving(session.getId());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        activeSessions.remove(session.getId());
        handleUserLeaving(session.getId());
        System.out.println("WebSocket Disconnected: " + session.getId());
    }

    private void handleUserLeaving(String sessionId) throws IOException {
        String roomId = sessionRoomMap.get(sessionId);
        if (roomId == null) return;

        LudoGame game = rooms.get(roomId);
        if (game == null) return;

        LudoGame.Player target = null;
        for (LudoGame.Player p : game.getPlayers()) {
            if (p.getSessionId() != null && p.getSessionId().equals(sessionId)) {
                target = p;
                break;
            }
        }

        if (target == null) return;

        sessionRoomMap.remove(sessionId);

        if (game.getState().equals("LOBBY")) {
            // Remove from list
            game.getPlayers().remove(target);
            if (game.getPlayers().stream().noneMatch(p -> p.getType().equals("human"))) {
                rooms.remove(roomId);
                System.out.println("Lobby " + roomId + " deleted. All humans left.");
            } else {
                broadcast(roomId, "roomState", game);
            }
        } else if (game.getState().equals("PLAYING")) {
            // Mark disconnected
            target.setType("disconnected");
            target.setSessionId(null);

            broadcast(roomId, "playerDisconnected", Map.of(
                    "username", target.getUsername(),
                    "color", target.getColor()
            ));

            boolean anyHuman = game.getPlayers().stream().anyMatch(p -> p.getType().equals("human"));
            if (!anyHuman) {
                rooms.remove(roomId);
                System.out.println("Game " + roomId + " deleted. All humans disconnected.");
            } else {
                broadcast(roomId, "roomState", game);
                
                // If it was the disconnected player's turn, trigger bot routines
                LudoGame.Player active = game.getCurrentPlayer();
                if (active != null && active.getUsername().equals(target.getUsername())) {
                    triggerBotOrAwaitPlayer(game);
                }
            }
        }
    }

    private void triggerBotOrAwaitPlayer(LudoGame game) {
        if (!game.getState().equals("PLAYING")) return;

        LudoGame.Player active = game.getCurrentPlayer();
        if (active == null) return;

        boolean isBot = active.getType().equals("bot") || active.getType().equals("disconnected");
        if (!isBot) return;

        String roomId = game.getRoomId();

        // 1. Bot Dice Roll
        scheduler.schedule(() -> {
            try {
                if (!game.getState().equals("PLAYING")) return;
                Map<String, Object> rollRes = game.rollDice();
                if (rollRes == null) return;

                broadcast(roomId, "diceRolled", Map.of(
                        "color", active.getColor(),
                        "roll", rollRes.get("roll"),
                        "validMoves", rollRes.get("validMoves") != null ? rollRes.get("validMoves") : List.of(),
                        "turnForfeited", rollRes.get("turnForfeited"),
                        "message", rollRes.get("message") != null ? rollRes.get("message") : "Bot rolled " + rollRes.get("roll")
                ));

                if (Boolean.TRUE.equals(rollRes.get("turnForfeited"))) {
                    scheduler.schedule(() -> {
                        try {
                            broadcast(roomId, "roomState", game);
                            triggerBotOrAwaitPlayer(game);
                        } catch (Exception e) { e.printStackTrace(); }
                    }, 2000, TimeUnit.MILLISECONDS);
                    return;
                }

                List<?> valid = (List<?>) rollRes.get("validMoves");
                if (valid == null || valid.isEmpty()) {
                    scheduler.schedule(() -> {
                        try {
                            game.nextTurn();
                            broadcast(roomId, "roomState", game);
                            triggerBotOrAwaitPlayer(game);
                        } catch (Exception e) { e.printStackTrace(); }
                    }, 2000, TimeUnit.MILLISECONDS);
                    return;
                }

                // 2. Bot Move (After roll animation)
                scheduler.schedule(() -> {
                    try {
                        if (!game.getState().equals("PLAYING")) return;
                        Map<String, Object> dec = game.makeBotDecision();
                        if (dec != null && dec.get("action").equals("move")) {
                            int tokenIdx = (int) dec.get("tokenIndex");
                            Map<String, Object> moveRes = game.moveToken(tokenIdx);
                            if (moveRes != null) {
                                broadcast(roomId, "tokenMoved", Map.of(
                                        "color", active.getColor(),
                                        "tokenIndex", tokenIdx,
                                        "roll", moveRes.get("roll"),
                                        "path", moveRes.get("path"),
                                        "capturedTokens", moveRes.get("capturedTokens"),
                                        "earnedExtraTurn", moveRes.get("earnedExtraTurn"),
                                        "extraRollReason", moveRes.get("extraRollReason") != null ? moveRes.get("extraRollReason") : "",
                                        "gameState", game
                                ));

                                if (game.getState().equals("FINISHED")) {
                                    handleGameCompletion(game);
                                    return;
                                }

                                // Loop back on next turn
                                scheduler.schedule(() -> {
                                    try {
                                        broadcast(roomId, "roomState", game);
                                        triggerBotOrAwaitPlayer(game);
                                    } catch (Exception e) { e.printStackTrace(); }
                                }, 1500, TimeUnit.MILLISECONDS);
                            }
                        }
                    } catch (Exception e) { e.printStackTrace(); }
                }, 1500, TimeUnit.MILLISECONDS);

            } catch (Exception e) { e.printStackTrace(); }
        }, 1500, TimeUnit.MILLISECONDS);
    }

    // Save final rankings and award coins to PostgreSQL
    private void handleGameCompletion(LudoGame game) {
        List<String> ranking = game.getWinners(); // colors list in order of finish
        
        for (LudoGame.Player p : game.getPlayers()) {
            if (p.getType().equals("bot")) continue;

            try {
                User user = userRepository.findById(p.getUsername()).orElse(null);
                if (user != null) {
                    user.setGamesPlayed(user.getGamesPlayed() + 1);
                    boolean isWinner = ranking.get(0).equals(p.getColor());
                    int coinsEarned = 500;

                    if (isWinner) {
                        user.setWins(user.getWins() + 1);
                        coinsEarned += 500;
                    } else {
                        user.setLosses(user.getLosses() + 1);
                    }

                    user.setCoins(user.getCoins() + coinsEarned);
                    userRepository.save(user);

                    // Insert match history log
                    GameHistory history = new GameHistory();
                    history.setUsername(user.getUsername());
                    history.setRoomId(game.getRoomId());
                    history.setMode(game.getMode().toUpperCase());
                    history.setDate(Instant.now());
                    
                    String playersStr = game.getPlayers().stream().map(LudoGame.Player::getUsername).collect(Collectors.joining(","));
                    history.setPlayers(playersStr);
                    history.setRank(ranking.indexOf(p.getColor()) != -1 ? ranking.indexOf(p.getColor()) + 1 : ranking.size() + 1);
                    history.setCoinsEarned(coinsEarned);

                    gameHistoryRepository.save(history);
                }
            } catch (Exception e) {
                System.err.println("Failed to save match results for " + p.getUsername() + ": " + e.getMessage());
            }
        }
    }

    // Broadcast messages to all sessions in a room
    private void broadcast(String roomId, String type, Object data) {
        LudoGame game = rooms.get(roomId);
        if (game == null) return;

        Map<String, Object> envelope = Map.of(
                "type", type,
                "data", data
        );

        try {
            String text = objectMapper.writeValueAsString(envelope);
            TextMessage textMsg = new TextMessage(text);
            
            for (LudoGame.Player p : game.getPlayers()) {
                if (p.getSessionId() != null) {
                    WebSocketSession wsSession = activeSessions.get(p.getSessionId());
                    if (wsSession != null && wsSession.isOpen()) {
                        wsSession.sendMessage(textMsg);
                    }
                }
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private void sendToSession(WebSocketSession session, String type, Object data) throws IOException {
        Map<String, Object> envelope = Map.of(
                "type", type,
                "data", data
        );
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(envelope)));
    }

    private void sendError(WebSocketSession session, String errorMsg) throws IOException {
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(Map.of(
                "type", "errorMsg",
                "data", errorMsg
        ))));
    }
}
