// Authoritative Ludo Game Engine
// c:\Users\user\Documents\Projects\Ludoking\server\gameLogic.js

class LudoGame {
  constructor(roomId, playersInput, mode = '4-player') {
    this.roomId = roomId;
    this.mode = mode; // '2-player' or '4-player'
    this.state = 'LOBBY'; // 'LOBBY', 'PLAYING', 'FINISHED'
    this.players = []; // Array of { username, color, type: 'human'|'bot'|'disconnected', socketId }
    this.turn = 0; // Index of the player whose turn it is
    this.diceRoll = null;
    this.hasRolled = false;
    this.consecutiveSixes = 0;
    this.winners = []; // Array of colors in winning order
    
    // Tokens: 4 per player. Value is stepsMoved:
    // -1 = In Yard
    // 0 = Start cell
    // 1-51 = On main track
    // 52-56 = On home path
    // 57 = Home (Finished)
    this.tokens = {
      RED: [-1, -1, -1, -1],
      GREEN: [-1, -1, -1, -1],
      YELLOW: [-1, -1, -1, -1],
      BLUE: [-1, -1, -1, -1]
    };

    // Color definitions
    this.colors = mode === '2-player' ? ['RED', 'YELLOW'] : ['RED', 'GREEN', 'YELLOW', 'BLUE'];

    // Map players input to colors
    this.setupPlayers(playersInput);
  }

  setupPlayers(playersInput) {
    this.players = [];
    for (let i = 0; i < this.colors.length; i++) {
      const color = this.colors[i];
      const inputPlayer = playersInput[i];
      if (inputPlayer) {
        this.players.push({
          username: inputPlayer.username,
          color: color,
          type: inputPlayer.type || 'human',
          socketId: inputPlayer.socketId || null
        });
      } else {
        // Fill empty slots with bots
        this.players.push({
          username: `Bot_${color.toLowerCase()}`,
          color: color,
          type: 'bot',
          socketId: null
        });
      }
    }
  }

  // Get start track index for color
  static getStartOffset(color) {
    switch (color) {
      case 'RED': return 0;
      case 'BLUE': return 13;
      case 'YELLOW': return 26;
      case 'GREEN': return 39;
      default: return 0;
    }
  }

  // Get index before entering home path
  static getHomeEntranceOffset(color) {
    switch (color) {
      case 'RED': return 50;
      case 'BLUE': return 11;
      case 'YELLOW': return 24;
      case 'GREEN': return 37;
      default: return 50;
    }
  }

  // Converts relative stepsMoved to absolute global board position (0-51) or home path index (100+)
  static getGlobalPosition(color, stepsMoved) {
    if (stepsMoved === -1) return -1; // Yard
    if (stepsMoved === 57) return 57; // Finished Home
    if (stepsMoved >= 52) {
      // Home path: return unique indicator (e.g. color + home index)
      return 100 + (stepsMoved - 52); // 100 to 104
    }
    const offset = LudoGame.getStartOffset(color);
    return (offset + stepsMoved) % 52;
  }

  // Safe cells on global track (0 to 51)
  static isGlobalSafe(globalPos) {
    const safeCells = [0, 8, 13, 21, 26, 34, 39, 47];
    return safeCells.includes(globalPos);
  }

  startGame() {
    this.state = 'PLAYING';
    this.turn = Math.floor(Math.random() * this.players.length);
    this.diceRoll = null;
    this.hasRolled = false;
    this.consecutiveSixes = 0;
    this.winners = [];
    this.tokens = {
      RED: [-1, -1, -1, -1],
      GREEN: [-1, -1, -1, -1],
      YELLOW: [-1, -1, -1, -1],
      BLUE: [-1, -1, -1, -1]
    };
  }

  getCurrentPlayer() {
    return this.players[this.turn];
  }

  rollDice() {
    if (this.state !== 'PLAYING') return null;
    if (this.hasRolled) return null;

    const roll = Math.floor(Math.random() * 6) + 1;
    this.diceRoll = roll;
    this.hasRolled = true;

    if (roll === 6) {
      this.consecutiveSixes++;
      if (this.consecutiveSixes === 3) {
        // 3 consecutive sixes forfeits turn
        const logMsg = `${this.getCurrentPlayer().username} rolled 3 sixes in a row! Turn forfeited.`;
        this.consecutiveSixes = 0;
        this.nextTurn();
        return { roll, turnForfeited: true, message: logMsg };
      }
    } else {
      this.consecutiveSixes = 0;
    }

    const validMoves = this.getValidMoves();
    return { roll, validMoves };
  }

  getValidMoves() {
    if (!this.hasRolled || this.state !== 'PLAYING') return [];
    
    const currentPlayer = this.getCurrentPlayer();
    const color = currentPlayer.color;
    const playerTokens = this.tokens[color];
    const roll = this.diceRoll;

    const valid = [];
    for (let i = 0; i < playerTokens.length; i++) {
      const steps = playerTokens[i];
      if (steps === 57) {
        continue; // Already finished
      }
      
      if (steps === -1) {
        // In yard, need a 6 to release
        if (roll === 6) {
          valid.push(i);
        }
      } else if (steps + roll <= 57) {
        // Can move as long as it doesn't overshoot home
        valid.push(i);
      }
    }

    return valid;
  }

  moveToken(tokenIndex) {
    if (this.state !== 'PLAYING') return null;
    if (!this.hasRolled) return null;

    const validMoves = this.getValidMoves();
    if (!validMoves.includes(tokenIndex)) return null;

    const currentPlayer = this.getCurrentPlayer();
    const color = currentPlayer.color;
    const roll = this.diceRoll;
    const oldSteps = this.tokens[color][tokenIndex];
    let newSteps = oldSteps;

    if (oldSteps === -1 && roll === 6) {
      newSteps = 0; // Release to start
    } else {
      newSteps += roll;
    }

    // Apply the move
    this.tokens[color][tokenIndex] = newSteps;
    const tokenPath = [];
    for (let s = (oldSteps === -1 ? 0 : oldSteps + 1); s <= newSteps; s++) {
      tokenPath.push({
        stepsMoved: s,
        globalPos: LudoGame.getGlobalPosition(color, s)
      });
    }

    let capturedTokens = [];
    let earnedExtraTurn = false;

    // Check capture only if token lands on global board track (0 to 51)
    const newGlobalPos = LudoGame.getGlobalPosition(color, newSteps);
    if (newSteps < 52 && !LudoGame.isGlobalSafe(newGlobalPos)) {
      // Find opponent tokens on the same global track cell
      for (const player of this.players) {
        if (player.color === color) continue;
        const opponentTokens = this.tokens[player.color];
        for (let i = 0; i < opponentTokens.length; i++) {
          const oppSteps = opponentTokens[i];
          const oppGlobal = LudoGame.getGlobalPosition(player.color, oppSteps);
          if (oppGlobal === newGlobalPos) {
            // Captured! Send back to yard
            this.tokens[player.color][i] = -1;
            capturedTokens.push({
              color: player.color,
              tokenIndex: i
            });
            earnedExtraTurn = true;
          }
        }
      }
    }

    // Check if token reached home
    if (newSteps === 57) {
      earnedExtraTurn = true;
      // Check if this player has finished
      if (this.tokens[color].every(s => s === 57)) {
        if (!this.winners.includes(color)) {
          this.winners.push(color);
        }
        // Check game end conditions
        const activePlayersCount = this.players.filter(p => !this.winners.includes(p.color)).length;
        if (activePlayersCount <= 1 || this.winners.length === this.players.length - 1) {
          this.state = 'FINISHED';
        }
      }
    }

    // Reset roll state
    this.hasRolled = false;

    // Determine next turn
    let extraRollReason = null;
    if (this.state === 'PLAYING') {
      if (earnedExtraTurn) {
        // Player retains turn
        this.consecutiveSixes = 0; // Reset consecutive count but keep turn
        extraRollReason = newSteps === 57 ? 'home' : 'capture';
      } else if (roll === 6) {
        // Rolled 6 and moved successfully -> gets another roll
        extraRollReason = 'six';
      } else {
        // Pass turn
        this.nextTurn();
      }
    }

    return {
      player: currentPlayer,
      tokenIndex,
      roll,
      path: tokenPath,
      capturedTokens,
      earnedExtraTurn,
      extraRollReason,
      gameState: this.serialize()
    };
  }

  nextTurn() {
    this.hasRolled = false;
    this.diceRoll = null;
    this.consecutiveSixes = 0;

    if (this.state !== 'PLAYING') return;

    // Cycle turns, skipping winners
    let attempts = 0;
    do {
      this.turn = (this.turn + 1) % this.players.length;
      attempts++;
    } while (this.winners.includes(this.players[this.turn].color) && attempts < this.players.length);
  }

  // Automatic bot playing decisions
  makeBotDecision() {
    if (this.state !== 'PLAYING') return null;
    
    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer.type !== 'bot') return null;

    if (!this.hasRolled) {
      // Must roll dice
      return { action: 'roll' };
    }

    const validMoves = this.getValidMoves();
    if (validMoves.length === 0) {
      // No moves, pass turn (server will trigger nextTurn automatically after broadcasting)
      return { action: 'skip' };
    }

    // Bot decision tree
    const color = currentPlayer.color;
    const playerTokens = this.tokens[color];
    const roll = this.diceRoll;

    // 1. Capture opponent is highest priority
    for (const tIndex of validMoves) {
      const destSteps = playerTokens[tIndex] === -1 ? 0 : playerTokens[tIndex] + roll;
      const destGlobal = LudoGame.getGlobalPosition(color, destSteps);
      if (destSteps < 52 && !LudoGame.isGlobalSafe(destGlobal)) {
        for (const p of this.players) {
          if (p.color === color) continue;
          if (this.tokens[p.color].some(s => LudoGame.getGlobalPosition(p.color, s) === destGlobal)) {
            return { action: 'move', tokenIndex: tIndex };
          }
        }
      }
    }

    // 2. Land exactly in home
    for (const tIndex of validMoves) {
      const destSteps = playerTokens[tIndex] + roll;
      if (destSteps === 57) {
        return { action: 'move', tokenIndex: tIndex };
      }
    }

    // 3. Release token from yard
    if (roll === 6) {
      const yardIndex = validMoves.find(tIndex => playerTokens[tIndex] === -1);
      if (yardIndex !== undefined) {
        return { action: 'move', tokenIndex: yardIndex };
      }
    }

    // 4. Move token safely out of danger if opponent is right behind
    // Or move token that is closest to home to get them in
    let bestToken = validMoves[0];
    let maxSteps = -2;
    for (const tIndex of validMoves) {
      const steps = playerTokens[tIndex];
      if (steps > maxSteps) {
        maxSteps = steps;
        bestToken = tIndex;
      }
    }

    return { action: 'move', tokenIndex: bestToken };
  }

  // Handle client disconnection
  handleDisconnect(socketId) {
    const player = this.players.find(p => p.socketId === socketId);
    if (player) {
      player.type = 'disconnected';
      player.socketId = null;
      return player;
    }
    return null;
  }

  // Handle reconnection
  handleReconnect(username, socketId) {
    const player = this.players.find(p => p.username === username);
    if (player) {
      player.type = 'human';
      player.socketId = socketId;
      return player;
    }
    return null;
  }

  serialize() {
    return {
      roomId: this.roomId,
      mode: this.mode,
      state: this.state,
      players: this.players.map(p => ({
        username: p.username,
        color: p.color,
        type: p.type
      })),
      turn: this.turn,
      activeColor: this.players[this.turn] ? this.players[this.turn].color : null,
      diceRoll: this.diceRoll,
      hasRolled: this.hasRolled,
      tokens: this.tokens,
      winners: this.winners
    };
  }
}

module.exports = LudoGame;
