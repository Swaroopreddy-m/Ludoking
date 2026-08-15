package com.ludo.king.websocket;

public class WSMessage {
    private String type;
    private String roomId;
    private String username;
    private String mode;
    private Integer tokenIndex;
    private String message;
    private Boolean isEmote;

    public WSMessage() {
    }

    public WSMessage(String type) {
        this.type = type;
    }

    // Getters and Setters
    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getRoomId() {
        return roomId;
    }

    public void setRoomId(String roomId) {
        this.roomId = roomId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public Integer getTokenIndex() {
        return tokenIndex;
    }

    public void setTokenIndex(Integer tokenIndex) {
        this.tokenIndex = tokenIndex;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Boolean getIsEmote() {
        return isEmote;
    }

    public void setIsEmote(Boolean isEmote) {
        this.isEmote = isEmote;
    }
}
