package com.ludo.king.engine;

import java.util.*;

public class LudoGame {

    public static class Player {
        private String username;
        private String color;
        private String type; // "human", "bot", "disconnected"
        private String sessionId;

        public Player() {
        }

        public Player(String username, String color, String type, String sessionId) {
            this.username = username;
            this.color = color;
            this.type = type;
            this.sessionId = sessionId;
        }

        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
        public String getColor() { return color; }
        public void setColor(String color) { this.color = color; }
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public String getSessionId() { return sessionId; }
        public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    }

    private String roomId;
    private String mode; // "2-player", "3-player", "4-player"
    private String state = "LOBBY"; // "LOBBY", "PLAYING", "FINISHED"
    private List<Player> players = new ArrayList<>();
    private int turn = 0;
    private Integer diceRoll = null;
    private boolean hasRolled = false;
    private int consecutiveSixes = 0;
    private List<String> winners = new ArrayList<>();
    private Map<String, int[]> tokens = new HashMap<>();

    private static final List<String> ALL_COLORS = Arrays.asList("RED", "GREEN", "YELLOW", "BLUE");

    public LudoGame(String roomId, List<Player> initialPlayers, String mode) {
        this.roomId = roomId;
        this.mode = mode;
        
        // Initialize tokens
        tokens.put("RED", new int[]{-1, -1, -1, -1});
        tokens.put("GREEN", new int[]{-1, -1, -1, -1});
        tokens.put("YELLOW", new int[]{-1, -1, -1, -1});
        tokens.put("BLUE", new int[]{-1, -1, -1, -1});

        setupPlayers(initialPlayers);
    }

    private void setupPlayers(List<Player> initialPlayers) {
        this.players.clear();
        int limit = mode.equals("2-player") ? 2 : (mode.equals("3-player") ? 3 : 4);
        List<String> roomColors = mode.equals("2-player") ? Arrays.asList("RED", "YELLOW") : ALL_COLORS;

        for (int i = 0; i < limit; i++) {
            String color = roomColors.get(i);
            if (i < initialPlayers.size()) {
                Player p = initialPlayers.get(i);
                p.setColor(color);
                this.players.add(p);
            } else {
                // Add automated bots for empty slots
                this.players.add(new Player("Bot_" + color.toLowerCase(), color, "bot", null));
            }
        }
    }

    public static int getStartOffset(String color) {
        switch (color) {
            case "RED": return 0;
            case "BLUE": return 13;
            case "YELLOW": return 26;
            case "GREEN": return 39;
            default: return 0;
        }
    }

    public static int getHomeEntranceOffset(String color) {
        switch (color) {
            case "RED": return 50;
            case "BLUE": return 11;
            case "YELLOW": return 24;
            case "GREEN": return 37;
            default: return 50;
        }
    }

    public static int getGlobalPosition(String color, int stepsMoved) {
        if (stepsMoved == -1) return -1;
        if (stepsMoved == 57) return 57;
        if (stepsMoved >= 52) {
            return 100 + (stepsMoved - 52);
        }
        int offset = getStartOffset(color);
        return (offset + stepsMoved) % 52;
    }

    public static boolean isGlobalSafe(int globalPos) {
        int[] safeCells = {0, 8, 13, 21, 26, 34, 39, 47};
        for (int cell : safeCells) {
            if (cell == globalPos) return true;
        }
        return false;
    }

    public void startGame() {
        this.state = "PLAYING";
        this.turn = new Random().nextInt(players.size());
        this.diceRoll = null;
        this.hasRolled = false;
        this.consecutiveSixes = 0;
        this.winners.clear();
        
        tokens.put("RED", new int[]{-1, -1, -1, -1});
        tokens.put("GREEN", new int[]{-1, -1, -1, -1});
        tokens.put("YELLOW", new int[]{-1, -1, -1, -1});
        tokens.put("BLUE", new int[]{-1, -1, -1, -1});
    }

    public Player getCurrentPlayer() {
        if (players.isEmpty()) return null;
        return players.get(turn);
    }

    public Map<String, Object> rollDice() {
        if (!state.equals("PLAYING") || hasRolled) return null;

        int roll = new Random().nextInt(6) + 1;
        this.diceRoll = roll;
        this.hasRolled = true;

        Map<String, Object> result = new HashMap<>();
        result.put("roll", roll);

        if (roll == 6) {
            consecutiveSixes++;
            if (consecutiveSixes == 3) {
                consecutiveSixes = 0;
                nextTurn();
                result.put("turnForfeited", true);
                result.put("message", getCurrentPlayer().getUsername() + " rolled 3 sixes! Turn forfeited.");
                return result;
            }
        } else {
            consecutiveSixes = 0;
        }

        result.put("validMoves", getValidMoves());
        result.put("turnForfeited", false);
        return result;
    }

    public List<Integer> getValidMoves() {
        if (!hasRolled || !state.equals("PLAYING")) return new ArrayList<>();

        Player player = getCurrentPlayer();
        String color = player.getColor();
        int[] playerTokens = tokens.get(color);
        int roll = diceRoll;

        List<Integer> valid = new ArrayList<>();
        for (int i = 0; i < playerTokens.length; i++) {
            int steps = playerTokens[i];
            if (steps == 57) continue;

            if (steps == -1) {
                if (roll == 6) valid.add(i);
            } else if (steps + roll <= 57) {
                valid.add(i);
            }
        }
        return valid;
    }

    public Map<String, Object> moveToken(int tokenIndex) {
        if (!state.equals("PLAYING") || !hasRolled) return null;

        List<Integer> validMoves = getValidMoves();
        if (!validMoves.contains(tokenIndex)) return null;

        Player player = getCurrentPlayer();
        String color = player.getColor();
        int roll = diceRoll;
        int[] playerTokens = tokens.get(color);
        int oldSteps = playerTokens[tokenIndex];
        int newSteps = oldSteps;

        if (oldSteps == -1 && roll == 6) {
            newSteps = 0;
        } else {
            newSteps += roll;
        }

        playerTokens[tokenIndex] = newSteps;

        // Trace movement path
        List<Map<String, Object>> path = new ArrayList<>();
        int startPoint = (oldSteps == -1) ? 0 : oldSteps + 1;
        for (int s = startPoint; s <= newSteps; s++) {
            Map<String, Object> pathStep = new HashMap<>();
            pathStep.put("stepsMoved", s);
            pathStep.put("globalPos", getGlobalPosition(color, s));
            path.add(pathStep);
        }

        List<Map<String, Object>> capturedTokens = new ArrayList<>();
        boolean earnedExtraTurn = false;

        // Check captures on global cells
        int newGlobalPos = getGlobalPosition(color, newSteps);
        if (newSteps < 52 && !isGlobalSafe(newGlobalPos)) {
            for (Player p : players) {
                if (p.getColor().equals(color)) continue;
                int[] oppTokens = tokens.get(p.getColor());
                for (int i = 0; i < oppTokens.length; i++) {
                    int oppSteps = oppTokens[i];
                    int oppGlobal = getGlobalPosition(p.getColor(), oppSteps);
                    if (oppGlobal == newGlobalPos) {
                        // Capture! Reset to yard
                        oppTokens[i] = -1;
                        Map<String, Object> cap = new HashMap<>();
                        cap.put("color", p.getColor());
                        cap.put("tokenIndex", i);
                        capturedTokens.add(cap);
                        earnedExtraTurn = true;
                    }
                }
            }
        }

        // Reached home check
        if (newSteps == 57) {
            earnedExtraTurn = true;
            boolean allFinished = true;
            for (int steps : playerTokens) {
                if (steps != 57) {
                    allFinished = false;
                    break;
                }
            }
            if (allFinished) {
                if (!winners.contains(color)) {
                    winners.add(color);
                }
                
                // End game when 1 player remains active
                int remaining = 0;
                for (Player p : players) {
                    if (!winners.contains(p.getColor())) remaining++;
                }
                if (remaining <= 1 || winners.size() == players.size() - 1) {
                    state = "FINISHED";
                }
            }
        }

        hasRolled = false;
        String extraRollReason = null;
        if (state.equals("PLAYING")) {
            if (earnedExtraTurn) {
                consecutiveSixes = 0;
                extraRollReason = (newSteps == 57) ? "home" : "capture";
            } else if (roll == 6) {
                extraRollReason = "six";
            } else {
                nextTurn();
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("player", player);
        response.put("tokenIndex", tokenIndex);
        response.put("roll", roll);
        response.put("path", path);
        response.put("capturedTokens", capturedTokens);
        response.put("earnedExtraTurn", earnedExtraTurn);
        response.put("extraRollReason", extraRollReason);
        
        return response;
    }

    public void nextTurn() {
        hasRolled = false;
        diceRoll = null;
        consecutiveSixes = 0;

        if (!state.equals("PLAYING")) return;

        int attempts = 0;
        do {
            turn = (turn + 1) % players.size();
            attempts++;
        } while (winners.contains(players.get(turn).getColor()) && attempts < players.size());
    }

    // Bot decision maker
    public Map<String, Object> makeBotDecision() {
        if (!state.equals("PLAYING")) return null;
        Player current = getCurrentPlayer();
        if (!current.getType().equals("bot") && !current.getType().equals("disconnected")) return null;

        Map<String, Object> decision = new HashMap<>();
        if (!hasRolled) {
            decision.put("action", "roll");
            return decision;
        }

        List<Integer> validMoves = getValidMoves();
        if (validMoves.isEmpty()) {
            decision.put("action", "skip");
            return decision;
        }

        String color = current.getColor();
        int[] playerTokens = tokens.get(color);
        int roll = diceRoll;

        // 1. Priority: Capture
        for (int tIndex : validMoves) {
            int destSteps = (playerTokens[tIndex] == -1) ? 0 : playerTokens[tIndex] + roll;
            int destGlobal = getGlobalPosition(color, destSteps);
            if (destSteps < 52 && !isGlobalSafe(destGlobal)) {
                for (Player p : players) {
                    if (p.getColor().equals(color)) continue;
                    int[] oppTokens = tokens.get(p.getColor());
                    for (int opp : oppTokens) {
                        if (getGlobalPosition(p.getColor(), opp) == destGlobal) {
                            decision.put("action", "move");
                            decision.put("tokenIndex", tIndex);
                            return decision;
                        }
                    }
                }
            }
        }

        // 2. Priority: Finish home
        for (int tIndex : validMoves) {
            if (playerTokens[tIndex] + roll == 57) {
                decision.put("action", "move");
                decision.put("tokenIndex", tIndex);
                return decision;
            }
        }

        // 3. Priority: Release from yard
        if (roll == 6) {
            for (int tIndex : validMoves) {
                if (playerTokens[tIndex] == -1) {
                    decision.put("action", "move");
                    decision.put("tokenIndex", tIndex);
                    return decision;
                }
            }
        }

        // 4. Default: Move advanced token
        int bestIndex = validMoves.get(0);
        int maxProgress = -2;
        for (int tIndex : validMoves) {
            if (playerTokens[tIndex] > maxProgress) {
                maxProgress = playerTokens[tIndex];
                bestIndex = tIndex;
            }
        }

        decision.put("action", "move");
        decision.put("tokenIndex", bestIndex);
        return decision;
    }

    public Player handleDisconnect(String sessionId) {
        for (Player p : players) {
            if (p.getSessionId() != null && p.getSessionId().equals(sessionId)) {
                p.setType("disconnected");
                p.setSessionId(null);
                return p;
            }
        }
        return null;
    }

    public Player handleReconnect(String username, String sessionId) {
        for (Player p : players) {
            if (p.getUsername().equals(username)) {
                p.setType("human");
                p.setSessionId(sessionId);
                return p;
            }
        }
        return null;
    }

    // Getters for automatic JSON serialization
    public String getRoomId() { return roomId; }
    public String getMode() { return mode; }
    public String getState() { return state; }
    public List<Player> getPlayers() { return players; }
    public int getTurn() { return turn; }
    public String getActiveColor() {
        if (players.isEmpty() || turn >= players.size()) return null;
        return players.get(turn).getColor();
    }
    public Integer getDiceRoll() { return diceRoll; }
    public boolean isHasRolled() { return hasRolled; }
    public List<String> getWinners() { return winners; }
    public Map<String, int[]> getTokens() { return tokens; }
}
