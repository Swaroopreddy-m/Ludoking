// Node.js Backend Server with Express & Socket.io
// c:\Users\user\Documents\Projects\Ludoking\server.js

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const LudoGame = require('./server/gameLogic');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'server', 'db.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Cache for active game rooms
// Key: roomId, Value: LudoGame instance
const rooms = new Map();

// Helper to read database
function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return { users: {}, storeItems: [], events: [], leaderboard: [] };
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database:', error);
    return { users: {}, storeItems: [], events: [], leaderboard: [] };
  }
}

// Helper to write database
function writeDB(db) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing database:', error);
  }
}

// Password Hashing helper
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Auth: Register
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }

  const db = readDB();
  const lowerUsername = username.trim().toLowerCase();

  if (db.users[lowerUsername]) {
    return res.status(400).json({ error: 'Username already exists.' });
  }

  db.users[lowerUsername] = {
    username: username.trim(),
    passwordHash: hashPassword(password),
    coins: 5000,
    stats: { wins: 0, losses: 0, gamesPlayed: 0 },
    inventory: ["default_dice", "default_token", "default_board", "avatar_1"],
    equipped: {
      dice: "default_dice",
      token: "default_token",
      board: "default_board",
      avatar: "avatar_1",
      frame: "none"
    },
    history: []
  };

  // Sync to leaderboard if not present
  if (!db.leaderboard.some(l => l.username.toLowerCase() === lowerUsername)) {
    db.leaderboard.push({
      username: username.trim(),
      wins: 0,
      gamesPlayed: 0
    });
  }

  writeDB(db);
  res.json({ success: true, message: 'User registered successfully!' });
});

// Auth: Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }

  const db = readDB();
  const lowerUsername = username.trim().toLowerCase();
  const user = db.users[lowerUsername];

  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  res.json({
    success: true,
    user: {
      username: user.username,
      coins: user.coins,
      stats: user.stats,
      inventory: user.inventory,
      equipped: user.equipped
    }
  });
});

// Store: Purchase Item
app.post('/api/store/buy', (req, res) => {
  const { username, itemId } = req.body;
  if (!username || !itemId) {
    return res.status(400).json({ error: 'Missing username or item ID.' });
  }

  const db = readDB();
  const lowerUsername = username.toLowerCase();
  const user = db.users[lowerUsername];

  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  if (user.inventory.includes(itemId)) {
    return res.status(400).json({ error: 'Item already owned.' });
  }

  const item = db.storeItems.find(i => i.id === itemId);
  if (!item) {
    return res.status(404).json({ error: 'Item not found in store.' });
  }

  if (user.coins < item.price) {
    return res.status(400).json({ error: 'Insufficient coins.' });
  }

  // Deduct coins and add to inventory
  user.coins -= item.price;
  user.inventory.push(itemId);
  writeDB(db);

  res.json({
    success: true,
    coins: user.coins,
    inventory: user.inventory
  });
});

// Store: Equip Item
app.post('/api/store/equip', (req, res) => {
  const { username, itemId, category } = req.body;
  if (!username || !itemId || !category) {
    return res.status(400).json({ error: 'Missing required parameters.' });
  }

  const db = readDB();
  const lowerUsername = username.toLowerCase();
  const user = db.users[lowerUsername];

  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  if (!user.inventory.includes(itemId) && itemId !== 'none') {
    return res.status(400).json({ error: 'You do not own this item.' });
  }

  user.equipped[category] = itemId;
  writeDB(db);

  res.json({
    success: true,
    equipped: user.equipped
  });
});

// Leaderboard and events endpoint
app.get('/api/game-data', (req, res) => {
  const db = readDB();
  res.json({
    leaderboard: db.leaderboard.sort((a, b) => b.wins - a.wins).slice(0, 10),
    events: db.events,
    storeItems: db.storeItems
  });
});

// Server-side Game Room socket handlers
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // 1. Create Room
  socket.on('createRoom', ({ username, mode }) => {
    let roomId;
    do {
      roomId = Math.floor(100000 + Math.random() * 900000).toString();
    } while (rooms.has(roomId));

    const game = new LudoGame(roomId, [{ username, type: 'human', socketId: socket.id }], mode);
    rooms.set(roomId, game);

    socket.join(roomId);
    socket.emit('roomState', game.serialize());
    console.log(`Room created: ${roomId} by ${username}`);
  });

  // 2. Join Room
  socket.on('joinRoom', ({ username, roomId }) => {
    const game = rooms.get(roomId);
    if (!game) {
      socket.emit('errorMsg', 'Room not found.');
      return;
    }

    if (game.state === 'PLAYING') {
      // Check for reconnection
      const disconnectedPlayer = game.players.find(p => p.username === username && p.type === 'disconnected');
      if (disconnectedPlayer) {
        disconnectedPlayer.type = 'human';
        disconnectedPlayer.socketId = socket.id;
        socket.join(roomId);
        socket.emit('roomState', game.serialize());
        io.to(roomId).emit('playerReconnected', { username, color: disconnectedPlayer.color });
        io.to(roomId).emit('roomState', game.serialize());
        console.log(`Player ${username} reconnected to room ${roomId}`);
        
        // If it is the reconnected player's turn, alert them
        const currentPlayer = game.getCurrentPlayer();
        if (currentPlayer.username === username) {
          triggerBotOrAwaitPlayer(game);
        }
        return;
      } else {
        socket.emit('errorMsg', 'This game is already in progress.');
        return;
      }
    }

    if (game.state === 'FINISHED') {
      socket.emit('errorMsg', 'This game has finished.');
      return;
    }

    const currentPlayers = game.players.filter(p => p.type === 'human');
    const maxPlayers = game.mode === '2-player' ? 2 : 4;

    if (currentPlayers.length >= maxPlayers) {
      socket.emit('errorMsg', 'Room is full.');
      return;
    }

    // Add player
    game.players.push({
      username,
      color: game.colors[game.players.length],
      type: 'human',
      socketId: socket.id
    });

    socket.join(roomId);
    io.to(roomId).emit('roomState', game.serialize());
    console.log(`Player ${username} joined room ${roomId}`);
  });

  // 3. Start Game
  socket.on('startGame', ({ roomId }) => {
    const game = rooms.get(roomId);
    if (!game) return;

    // Start game & assign colors
    game.startGame();
    io.to(roomId).emit('gameStarted', game.serialize());
    console.log(`Game started in room ${roomId}`);

    // Trigger turn lifecycle
    triggerBotOrAwaitPlayer(game);
  });

  // 4. Dice Roll Request
  socket.on('rollDice', ({ roomId }) => {
    const game = rooms.get(roomId);
    if (!game) return;

    const currentPlayer = game.getCurrentPlayer();
    if (currentPlayer.socketId !== socket.id || game.hasRolled) {
      return; // Not their turn or already rolled
    }

    const result = game.rollDice();
    if (!result) return;

    // Send roll result
    io.to(roomId).emit('diceRolled', {
      color: currentPlayer.color,
      roll: result.roll,
      validMoves: result.validMoves || [],
      turnForfeited: result.turnForfeited || false,
      message: result.message || ''
    });

    if (result.turnForfeited) {
      // 3 sixes rolled
      setTimeout(() => {
        io.to(roomId).emit('roomState', game.serialize());
        triggerBotOrAwaitPlayer(game);
      }, 2000);
      return;
    }

    if (!result.validMoves || result.validMoves.length === 0) {
      // No valid moves, advance turn after short delay
      setTimeout(() => {
        game.nextTurn();
        io.to(roomId).emit('roomState', game.serialize());
        triggerBotOrAwaitPlayer(game);
      }, 2000);
    }
  });

  // 5. Move Token Request
  socket.on('moveToken', ({ roomId, tokenIndex }) => {
    const game = rooms.get(roomId);
    if (!game) return;

    const currentPlayer = game.getCurrentPlayer();
    if (currentPlayer.socketId !== socket.id || !game.hasRolled) return;

    const moveResult = game.moveToken(tokenIndex);
    if (!moveResult) return;

    // Broadcast move event with paths and captures for client animation
    io.to(roomId).emit('tokenMoved', {
      color: currentPlayer.color,
      tokenIndex: tokenIndex,
      roll: moveResult.roll,
      path: moveResult.path,
      capturedTokens: moveResult.capturedTokens,
      earnedExtraTurn: moveResult.earnedExtraTurn,
      extraRollReason: moveResult.extraRollReason,
      gameState: moveResult.gameState
    });

    // Check if game is finished
    if (game.state === 'FINISHED') {
      handleGameCompletion(game);
      return;
    }

    // Trigger next turn lifecycle after animation finishes (estimate 1.5 seconds)
    setTimeout(() => {
      io.to(roomId).emit('roomState', game.serialize());
      triggerBotOrAwaitPlayer(game);
    }, 1500);
  });

  // 6. In-game Chat / Emote
  socket.on('chatMessage', ({ roomId, message, isEmote }) => {
    const game = rooms.get(roomId);
    if (!game) return;
    const player = game.players.find(p => p.socketId === socket.id);
    if (player) {
      io.to(roomId).emit('chatMessage', {
        username: player.username,
        color: player.color,
        message,
        isEmote
      });
    }
  });

  // 7. Rematch Request
  socket.on('requestRematch', ({ roomId }) => {
    const game = rooms.get(roomId);
    if (!game) return;

    // Reset game using same players list
    const activePlayers = game.players.map(p => ({
      username: p.username,
      type: p.type === 'disconnected' ? 'bot' : p.type,
      socketId: p.socketId
    }));

    const newGame = new LudoGame(roomId, activePlayers, game.mode);
    rooms.set(roomId, newGame);
    newGame.startGame();

    io.to(roomId).emit('gameStarted', newGame.serialize());
    triggerBotOrAwaitPlayer(newGame);
  });

  // 8. Leave Room
  socket.on('leaveRoom', ({ roomId }) => {
    handleUserLeaving(socket, roomId);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    // Find room the socket belonged to
    for (const [roomId, game] of rooms.entries()) {
      const player = game.players.find(p => p.socketId === socket.id);
      if (player) {
        handleUserLeaving(socket, roomId);
        break;
      }
    }
  });
});

// Handle game completion: Save user stats, logs, add coins
function handleGameCompletion(game) {
  const db = readDB();
  const ranking = game.winners; // Array of colors in order of winning
  
  game.players.forEach(p => {
    if (p.type === 'bot') return;

    const lowerUsername = p.username.toLowerCase();
    const user = db.users[lowerUsername];
    if (user) {
      user.stats.gamesPlayed++;
      const isWinner = ranking[0] === p.color;
      let coinsReward = 500; // Base completion reward
      
      if (isWinner) {
        user.stats.wins++;
        coinsReward += 500; // Extra +500 for winning
      } else {
        user.stats.losses++;
      }

      user.coins += coinsReward;
      
      // Save game history
      user.history.unshift({
        gameId: `room-${game.roomId}`,
        mode: `${game.mode.toUpperCase()}`,
        date: new Date().toISOString(),
        players: game.players.map(pl => pl.username),
        rank: ranking.indexOf(p.color) !== -1 ? ranking.indexOf(p.color) + 1 : ranking.length + 1,
        coinsEarned: coinsReward
      });
      if (user.history.length > 20) user.history.pop();

      // Sync leaderboard entry
      const leadEntry = db.leaderboard.find(l => l.username.toLowerCase() === lowerUsername);
      if (leadEntry) {
        leadEntry.wins = user.stats.wins;
        leadEntry.gamesPlayed = user.stats.gamesPlayed;
      }
    }
  });

  writeDB(db);
}

// User leaving room handling
function handleUserLeaving(socket, roomId) {
  const game = rooms.get(roomId);
  if (!game) return;

  const player = game.players.find(p => p.socketId === socket.id);
  if (!player) return;

  socket.leave(roomId);

  if (game.state === 'LOBBY') {
    // Just remove them from lobby list
    game.players = game.players.filter(p => p.socketId !== socket.id);
    if (game.players.length === 0) {
      rooms.delete(roomId);
      console.log(`Lobby ${roomId} deleted because all players left.`);
    } else {
      io.to(roomId).emit('roomState', game.serialize());
    }
  } else if (game.state === 'PLAYING') {
    // Mark as disconnected
    player.type = 'disconnected';
    player.socketId = null;
    io.to(roomId).emit('playerDisconnected', { username: player.username, color: player.color });
    console.log(`Player ${player.username} marked disconnected in room ${roomId}`);

    // If all players are disconnected/bots, clear the room
    const humanActive = game.players.some(p => p.type === 'human');
    if (!humanActive) {
      rooms.delete(roomId);
      console.log(`Game ${roomId} deleted because all human players left.`);
    } else {
      io.to(roomId).emit('roomState', game.serialize());
      // If it was the disconnected player's turn, auto-play for them or switch turn
      const currentPlayer = game.getCurrentPlayer();
      if (currentPlayer.username === player.username) {
        triggerBotOrAwaitPlayer(game);
      }
    }
  }
}

// Automated BOT turn trigger or await human roll
function triggerBotOrAwaitPlayer(game) {
  if (game.state !== 'PLAYING') return;

  const player = game.getCurrentPlayer();
  const roomId = game.roomId;

  // If the player is disconnected, treat them as a bot for this turn to prevent game locking
  const isBotOrDisconnected = player.type === 'bot' || player.type === 'disconnected';

  if (isBotOrDisconnected) {
    // 1. Trigger Bot Roll
    setTimeout(() => {
      if (game.state !== 'PLAYING') return;
      const rollRes = game.rollDice();
      if (!rollRes) return;

      io.to(roomId).emit('diceRolled', {
        color: player.color,
        roll: rollRes.roll,
        validMoves: rollRes.validMoves || [],
        turnForfeited: rollRes.turnForfeited || false,
        message: rollRes.message || `Bot ${player.username} rolled ${rollRes.roll}`
      });

      if (rollRes.turnForfeited) {
        setTimeout(() => {
          io.to(roomId).emit('roomState', game.serialize());
          triggerBotOrAwaitPlayer(game);
        }, 2000);
        return;
      }

      if (!rollRes.validMoves || rollRes.validMoves.length === 0) {
        // No moves for bot, advance
        setTimeout(() => {
          game.nextTurn();
          io.to(roomId).emit('roomState', game.serialize());
          triggerBotOrAwaitPlayer(game);
        }, 2000);
        return;
      }

      // 2. Trigger Bot Move after roll animation
      setTimeout(() => {
        if (game.state !== 'PLAYING') return;
        const decision = game.makeBotDecision();
        if (decision && decision.action === 'move') {
          const moveRes = game.moveToken(decision.tokenIndex);
          if (moveRes) {
            io.to(roomId).emit('tokenMoved', {
              color: player.color,
              tokenIndex: decision.tokenIndex,
              roll: moveRes.roll,
              path: moveRes.path,
              capturedTokens: moveRes.capturedTokens,
              earnedExtraTurn: moveRes.earnedExtraTurn,
              extraRollReason: moveRes.extraRollReason,
              gameState: moveRes.gameState
            });

            if (game.state === 'FINISHED') {
              handleGameCompletion(game);
              return;
            }

            // Await animation to complete, then loop back
            setTimeout(() => {
              io.to(roomId).emit('roomState', game.serialize());
              triggerBotOrAwaitPlayer(game);
            }, 1500);
          }
        }
      }, 1500);

    }, 1500);
  }
}

// Start HTTP + Websocket Server
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
