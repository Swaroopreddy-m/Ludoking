package com.ludo.king.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "users")
public class User {

    @Id
    @Column(length = 50)
    private String username;

    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private int coins = 5000;

    private int wins = 0;
    private int losses = 0;
    private int gamesPlayed = 0;

    @Column(length = 1000)
    private String inventory = "default_dice,default_token,default_board,avatar_1";

    private String equippedDice = "default_dice";
    private String equippedToken = "default_token";
    private String equippedBoard = "default_board";
    private String equippedAvatar = "avatar_1";
    private String equippedFrame = "none";

    // Constructors
    public User() {
    }

    public User(String username, String passwordHash) {
        this.username = username;
        this.passwordHash = passwordHash;
    }

    // Getters and Setters
    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public int getCoins() {
        return coins;
    }

    public void setCoins(int coins) {
        this.coins = coins;
    }

    public int getWins() {
        return wins;
    }

    public void setWins(int wins) {
        this.wins = wins;
    }

    public int getLosses() {
        return losses;
    }

    public void setLosses(int losses) {
        this.losses = losses;
    }

    public int getGamesPlayed() {
        return gamesPlayed;
    }

    public void setGamesPlayed(int gamesPlayed) {
        this.gamesPlayed = gamesPlayed;
    }

    public String getInventory() {
        return inventory;
    }

    public void setInventory(String inventory) {
        this.inventory = inventory;
    }

    public String getEquippedDice() {
        return equippedDice;
    }

    public void setEquippedDice(String equippedDice) {
        this.equippedDice = equippedDice;
    }

    public String getEquippedToken() {
        return equippedToken;
    }

    public void setEquippedToken(String equippedToken) {
        this.equippedToken = equippedToken;
    }

    public String getEquippedBoard() {
        return equippedBoard;
    }

    public void setEquippedBoard(String equippedBoard) {
        this.equippedBoard = equippedBoard;
    }

    public String getEquippedAvatar() {
        return equippedAvatar;
    }

    public void setEquippedAvatar(String equippedAvatar) {
        this.equippedAvatar = equippedAvatar;
    }

    public String getEquippedFrame() {
        return equippedFrame;
    }

    public void setEquippedFrame(String equippedFrame) {
        this.equippedFrame = equippedFrame;
    }
}
