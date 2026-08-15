// Client Side View Routing, Auth, Store and Socket Sync
// c:\Users\user\Documents\Projects\Ludoking\public\js\app.js

const socket = io();

// Application State
const App = {
  user: null,
  currentRoomId: null,
  equippedDice: 'default_dice',
  equippedToken: 'default_token',
  equippedBoard: 'default_board',
  equippedAvatar: 'avatar_1',
  equippedFrame: 'none',
  
  // View states
  activeScreen: 'screen-auth',
  storeCategory: 'dice',
  storeItems: [],
  eventsList: [],
  leaderboardData: [],
  
  init() {
    this.cacheDOM();
    this.bindEvents();
    this.checkSession();
    this.loadGameData();
    this.startEventCountdown();
  },

  cacheDOM() {
    this.screens = {
      auth: document.getElementById('screen-auth'),
      home: document.getElementById('screen-home'),
      lobby: document.getElementById('screen-lobby'),
      game: document.getElementById('screen-game')
    };

    // Auth components
    this.authForm = document.getElementById('auth-form');
    this.authUsername = document.getElementById('auth-username');
    this.authPassword = document.getElementById('auth-password');
    this.authSubmitBtn = document.getElementById('auth-submit-btn');
    this.tabLogin = document.getElementById('tab-login');
    this.tabRegister = document.getElementById('tab-register');
    this.guestLoginBtn = document.getElementById('guest-login-btn');
    this.logoutBtn = document.getElementById('logout-btn');

    // Header elements
    this.userBadge = document.getElementById('user-profile-badge');
    this.profileAvatar = document.getElementById('profile-avatar');
    this.profileUsername = document.getElementById('profile-username');
    this.profileCoins = document.getElementById('profile-coins');
    this.playerFrameWrapper = document.getElementById('player-frame-wrapper');
    this.soundToggleBtn = document.getElementById('sound-toggle-btn');

    // Home / Play selections
    this.btnShowCreate = document.getElementById('btn-show-create');
    this.btnShowJoin = document.getElementById('btn-show-join');
    this.modalCreateGame = document.getElementById('modal-create-game');
    this.modalJoinGame = document.getElementById('modal-join-game');
    this.btnConfirmCreate = document.getElementById('btn-confirm-create');
    this.btnConfirmJoin = document.getElementById('btn-confirm-join');
    this.btnCancelCreate = document.getElementById('btn-cancel-create');
    this.btnCancelJoin = document.getElementById('btn-cancel-join');
    this.joinRoomCodeInput = document.getElementById('join-room-code');

    // Store & Events elements
    this.storeGrid = document.getElementById('store-grid');
    this.eventsListContainer = document.getElementById('events-list');
    this.globalTimerVal = document.getElementById('global-timer');
    this.leaderboardBody = document.getElementById('leaderboard-body');
    
    // Stats elements
    this.statPlayed = document.getElementById('stat-played');
    this.statWins = document.getElementById('stat-wins');
    this.statLosses = document.getElementById('stat-losses');
    this.statWinrate = document.getElementById('stat-winrate');
    this.historyList = document.getElementById('history-list');

    // Lobby elements
    this.lobbyCodeVal = document.getElementById('lobby-code-val');
    this.lobbyModeVal = document.getElementById('lobby-mode-val');
    this.btnStartGame = document.getElementById('btn-start-game');
    this.btnLeaveLobby = document.getElementById('btn-leave-lobby');

    // Gameplay Control sidebar
    this.gameRoomCode = document.getElementById('game-room-code');
    this.btnLeaveGame = document.getElementById('btn-leave-game');
    this.chatForm = document.getElementById('chat-form');
    this.chatInput = document.getElementById('chat-input');
    this.chatMessages = document.getElementById('chat-messages');

    // Modals
    this.modalVictory = document.getElementById('modal-victory');
    this.victoryRanking = document.getElementById('victory-ranking');
    this.btnVictoryRematch = document.getElementById('btn-victory-rematch');
    this.btnVictoryLeave = document.getElementById('btn-victory-leave');
  },

  bindEvents() {
    // Auth screens routing
    let authMode = 'login';
    this.tabLogin.addEventListener('click', () => {
      authMode = 'login';
      this.tabLogin.classList.add('active');
      this.tabRegister.classList.remove('active');
      this.authSubmitBtn.textContent = 'Login';
    });

    this.tabRegister.addEventListener('click', () => {
      authMode = 'register';
      this.tabRegister.classList.add('active');
      this.tabLogin.classList.remove('active');
      this.authSubmitBtn.textContent = 'Register';
    });

    this.authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = this.authUsername.value.trim();
      const password = this.authPassword.value;

      if (authMode === 'register') {
        const res = await this.apiPost('/api/register', { username, password });
        if (res.success) {
          this.showToast('Registration successful! Please login.', 'success');
          // Switch to login tab automatically
          this.tabLogin.click();
          this.authPassword.value = '';
        } else {
          this.showToast(res.error || 'Registration failed', 'error');
        }
      } else {
        const res = await this.apiPost('/api/login', { username, password });
        if (res.success) {
          this.loginUser(res.user);
        } else {
          this.showToast(res.error || 'Invalid credentials', 'error');
        }
      }
    });

    this.guestLoginBtn.addEventListener('click', () => {
      const guestName = 'Guest_' + Math.floor(1000 + Math.random() * 9000);
      const guestUser = {
        username: guestName,
        coins: 5000,
        stats: { wins: 0, losses: 0, gamesPlayed: 0 },
        inventory: ['default_dice', 'default_token', 'default_board', 'avatar_1'],
        equipped: {
          dice: 'default_dice',
          token: 'default_token',
          board: 'default_board',
          avatar: 'avatar_1',
          frame: 'none'
        }
      };
      this.loginUser(guestUser);
      this.showToast('LoggedIn as Guest player!', 'success');
    });

    this.logoutBtn.addEventListener('click', () => {
      this.logoutUser();
    });

    // Sound toggle
    this.soundToggleBtn.addEventListener('click', () => {
      const isSound = LudoSound.toggle();
      this.soundToggleBtn.textContent = isSound ? '🔊' : '🔇';
      this.showToast(`Sound ${isSound ? 'Enabled' : 'Muted'}`, 'success');
    });

    // Modal view handlers
    this.btnShowCreate.addEventListener('click', () => this.modalCreateGame.classList.remove('hidden'));
    this.btnCancelCreate.addEventListener('click', () => this.modalCreateGame.classList.add('hidden'));
    this.btnShowJoin.addEventListener('click', () => this.modalJoinGame.classList.remove('hidden'));
    this.btnCancelJoin.addEventListener('click', () => {
      this.modalJoinGame.classList.add('hidden');
      this.joinRoomCodeInput.value = '';
    });

    // Confirm Create Game Room
    this.btnConfirmCreate.addEventListener('click', () => {
      const selectedBtn = document.querySelector('.mode-select-btn.active');
      const mode = selectedBtn ? selectedBtn.getAttribute('data-mode') : '4-player';
      
      this.modalCreateGame.classList.add('hidden');
      socket.emit('createRoom', { username: this.user.username, mode });
    });

    // Confirm Join Game Room
    this.btnConfirmJoin.addEventListener('click', () => {
      const code = this.joinRoomCodeInput.value.trim();
      if (code.length !== 6 || isNaN(code)) {
        this.showToast('Please enter a valid 6-digit room code.', 'error');
        return;
      }

      this.modalJoinGame.classList.add('hidden');
      socket.emit('joinRoom', { username: this.user.username, roomId: code });
      this.joinRoomCodeInput.value = '';
    });

    // Set active create mode buttons
    document.querySelectorAll('.mode-select-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.mode-select-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
      });
    });

    // Lobby buttons
    this.btnLeaveLobby.addEventListener('click', () => {
      if (this.currentRoomId) {
        socket.emit('leaveRoom', { roomId: this.currentRoomId });
        this.currentRoomId = null;
        this.switchScreen('screen-home');
        sessionStorage.removeItem('ludo_room_id');
      }
    });

    this.btnStartGame.addEventListener('click', () => {
      if (this.currentRoomId) {
        socket.emit('startGame', { roomId: this.currentRoomId });
      }
    });

    // In-game Actions
    this.btnLeaveGame.addEventListener('click', () => {
      if (confirm('Are you sure you want to leave this game? Your place will be taken by a bot.')) {
        socket.emit('leaveRoom', { roomId: this.currentRoomId });
        this.currentRoomId = null;
        sessionStorage.removeItem('ludo_room_id');
        this.switchScreen('screen-home');
        this.loadGameData(); // reload statistics
      }
    });

    // Chat Message submit
    this.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const msg = this.chatInput.value.trim();
      if (!msg) return;
      
      socket.emit('chatMessage', { roomId: this.currentRoomId, message: msg, isEmote: false });
      this.chatInput.value = '';
    });

    // Emotes click
    document.querySelectorAll('.emote-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const emote = e.target.getAttribute('data-msg');
        socket.emit('chatMessage', { roomId: this.currentRoomId, message: emote, isEmote: true });
      });
    });

    // Store Tab selection
    document.querySelectorAll('.store-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.store-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        this.storeCategory = e.target.getAttribute('data-cat');
        this.renderStore();
      });
    });

    // Victory handlers
    this.btnVictoryLeave.addEventListener('click', () => {
      this.modalVictory.classList.add('hidden');
      this.switchScreen('screen-home');
      sessionStorage.removeItem('ludo_room_id');
      this.loadGameData();
    });

    this.btnVictoryRematch.addEventListener('click', () => {
      this.modalVictory.classList.add('hidden');
      socket.emit('requestRematch', { roomId: this.currentRoomId });
    });

    // Global click listener to resume Web Audio Context
    document.addEventListener('click', () => {
      LudoSound.init();
    });
  },

  // Switch Screen panels
  switchScreen(screenId) {
    Object.values(this.screens).forEach(screen => screen.classList.add('hidden'));
    this.screens[screenId.split('-')[1]].classList.remove('hidden');
    this.activeScreen = screenId;
  },

  loginUser(user) {
    this.user = user;
    sessionStorage.setItem('ludo_username', user.username);
    
    // Equip states
    this.equippedDice = user.equipped.dice;
    this.equippedToken = user.equipped.token;
    this.equippedBoard = user.equipped.board;
    this.equippedAvatar = user.equipped.avatar;
    this.equippedFrame = user.equipped.frame;

    // Show Nav features
    this.logoutBtn.classList.remove('hidden');
    this.userBadge.classList.remove('hidden');
    this.updateHeaderProfile();

    this.switchScreen('screen-home');
    this.renderStats();
    this.renderStore();

    // Check if user was previously in a room
    const savedRoomId = sessionStorage.getItem('ludo_room_id');
    if (savedRoomId) {
      this.showToast('Restoring previous game session...', 'success');
      socket.emit('joinRoom', { username: user.username, roomId: savedRoomId });
    }
  },

  logoutUser() {
    this.user = null;
    sessionStorage.removeItem('ludo_username');
    sessionStorage.removeItem('ludo_room_id');
    this.logoutBtn.classList.add('hidden');
    this.userBadge.classList.add('hidden');
    this.switchScreen('screen-auth');
  },

  checkSession() {
    const savedUsername = sessionStorage.getItem('ludo_username');
    if (savedUsername) {
      // Re-fetch user profile (For testing let's fetch, or create temporary guest check)
      // Since it's a demo server, let's fetch profile. If user does not exist in DB, it triggers logout.
      this.apiPost('/api/login', { username: savedUsername, password: 'guest_pass_bypass' })
        .then(res => {
          if (res.success) {
            this.loginUser(res.user);
          } else {
            // If they were a guest, reconstruct guest session
            if (savedUsername.startsWith('Guest_')) {
              this.loginUser({
                username: savedUsername,
                coins: 5000,
                stats: { wins: 0, losses: 0, gamesPlayed: 0 },
                inventory: ['default_dice', 'default_token', 'default_board', 'avatar_1'],
                equipped: {
                  dice: 'default_dice',
                  token: 'default_token',
                  board: 'default_board',
                  avatar: 'avatar_1',
                  frame: 'none'
                }
              });
            } else {
              this.logoutUser();
            }
          }
        });
    }
  },

  updateHeaderProfile() {
    if (!this.user) return;
    this.profileUsername.textContent = this.user.username;
    this.profileCoins.textContent = this.user.coins;
    
    // Draw avatar
    const equippedAvatarItem = this.storeItems.find(i => i.id === this.equippedAvatar);
    this.profileAvatar.textContent = equippedAvatarItem ? equippedAvatarItem.image : '👤';

    // Apply cosmetic frame
    this.playerFrameWrapper.className = 'avatar-frame-container';
    if (this.equippedFrame === 'frame_gold') {
      this.playerFrameWrapper.classList.add('frame-gold');
    } else if (this.equippedFrame === 'frame_neon') {
      this.playerFrameWrapper.classList.add('frame-neon');
    }
  },

  // Fetch store, events and leaderboard from API
  async loadGameData() {
    try {
      const res = await fetch('/api/game-data');
      const data = await res.json();
      
      this.storeItems = data.storeItems || [];
      this.eventsList = data.events || [];
      this.leaderboardData = data.leaderboard || [];
      
      this.renderLeaderboard();
      this.renderEvents();
      this.renderStore();
      this.updateHeaderProfile();
    } catch (e) {
      console.error('Error fetching game details:', e);
    }
  },

  renderStats() {
    if (!this.user) return;
    const stats = this.user.stats;
    this.statPlayed.textContent = stats.gamesPlayed;
    this.statWins.textContent = stats.wins;
    this.statLosses.textContent = stats.losses;
    
    const rate = stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;
    this.statWinrate.textContent = `${rate}%`;

    // History logs
    this.historyList.innerHTML = '';
    if (!this.user.history || this.user.history.length === 0) {
      this.historyList.innerHTML = '<div class="history-item">No recent games played.</div>';
      return;
    }

    this.user.history.forEach(match => {
      const div = document.createElement('div');
      div.className = 'history-item';
      
      const dateString = new Date(match.date).toLocaleDateString();
      const didWin = match.rank === 1;

      div.innerHTML = `
        <div>
          <div class="history-mode">${match.mode}</div>
          <div class="history-date">${dateString}</div>
        </div>
        <div class="history-rank ${didWin ? '' : 'lost'}">
          Rank: #${match.rank} (+${match.coinsEarned} 🪙)
        </div>
      `;
      this.historyList.appendChild(div);
    });
  },

  renderStore() {
    this.storeGrid.innerHTML = '';
    const filtered = this.storeItems.filter(i => i.category === this.storeCategory);
    
    if (filtered.length === 0) {
      this.storeGrid.innerHTML = '<div style="grid-column: 1/-1; padding: 2rem;">No items available.</div>';
      return;
    }

    filtered.forEach(item => {
      const isOwned = this.user ? this.user.inventory.includes(item.id) : item.price === 0;
      let isEquipped = false;
      if (this.user) {
        isEquipped = this.user.equipped[item.category] === item.id;
      } else {
        isEquipped = item.id === `default_${item.category}`;
      }

      const card = document.createElement('div');
      card.className = 'store-card';
      card.innerHTML = `
        <div class="store-card-image" style="color: ${item.previewColor}">${item.image}</div>
        <div class="store-card-name">${item.name}</div>
        <div class="store-card-desc">${item.description}</div>
        <div class="store-card-price">${isOwned ? 'Owned' : `🪙 ${item.price}`}</div>
        <button class="store-card-btn ${isEquipped ? 'equipped' : (isOwned ? 'equip' : 'buy')}" data-id="${item.id}">
          ${isEquipped ? 'Equipped' : (isOwned ? 'Equip' : 'Purchase')}
        </button>
      `;

      const btn = card.querySelector('button');
      btn.addEventListener('click', () => this.handleStoreAction(item, isOwned, isEquipped));
      
      this.storeGrid.appendChild(card);
    });
  },

  async handleStoreAction(item, isOwned, isEquipped) {
    if (!this.user) {
      this.showToast('Please login or play as Guest to purchase items.', 'error');
      return;
    }

    if (isEquipped) return;

    if (!isOwned) {
      if (this.user.coins < item.price) {
        this.showToast('Not enough coins to buy this skin.', 'error');
        return;
      }

      const res = await this.apiPost('/api/store/buy', { username: this.user.username, itemId: item.id });
      if (res.success) {
        this.user.coins = res.coins;
        this.user.inventory = res.inventory;
        this.showToast(`Purchased ${item.name}!`, 'success');
        
        // Auto-equip item after purchase
        this.equipItem(item.id, item.category);
      } else {
        this.showToast(res.error || 'Purchase failed', 'error');
      }
    } else {
      this.equipItem(item.id, item.category);
    }
  },

  async equipItem(itemId, category) {
    const res = await this.apiPost('/api/store/equip', { username: this.user.username, itemId, category });
    if (res.success) {
      this.user.equipped = res.equipped;
      
      // Update local state
      if (category === 'dice') this.equippedDice = itemId;
      if (category === 'token') this.equippedToken = itemId;
      if (category === 'board') this.equippedBoard = itemId;
      if (category === 'avatar') this.equippedAvatar = itemId;
      if (category === 'frame') this.equippedFrame = itemId;

      this.showToast(`Equipped ${category}!`, 'success');
      this.loadGameData(); // refresh visuals
      this.renderStore();
    } else {
      this.showToast(res.error || 'Equip failed', 'error');
    }
  },

  renderEvents() {
    this.eventsListContainer.innerHTML = '';
    if (this.eventsList.length === 0) {
      this.eventsListContainer.innerHTML = '<div style="padding: 1.5rem;">No active tournaments.</div>';
      return;
    }

    this.eventsList.forEach(event => {
      const card = document.createElement('div');
      card.className = 'event-card';
      card.innerHTML = `
        <div class="event-icon">${event.image}</div>
        <div class="event-info">
          <span class="event-badge">${event.type}</span>
          <div class="event-title">${event.title}</div>
          <div class="event-desc">${event.description}</div>
          <div class="event-reward">Reward: ${event.reward}</div>
        </div>
      `;
      this.eventsListContainer.appendChild(card);
    });
  },

  renderLeaderboard() {
    this.leaderboardBody.innerHTML = '';
    if (this.leaderboardData.length === 0) {
      this.leaderboardBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No data found.</td></tr>';
      return;
    }

    this.leaderboardData.forEach((row, i) => {
      const tr = document.createElement('tr');
      const winRate = row.gamesPlayed > 0 ? Math.round((row.wins / row.gamesPlayed) * 100) : 0;
      
      tr.innerHTML = `
        <td><span class="rank-badge rank-${i+1}">${i+1}</span></td>
        <td><strong>${row.username}</strong></td>
        <td>${row.wins}</td>
        <td>${winRate}%</td>
      `;
      this.leaderboardBody.appendChild(tr);
    });
  },

  startEventCountdown() {
    setInterval(() => {
      const now = new Date();
      // Reset timer countdown to end of day
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      
      const diff = endOfDay - now;
      if (diff <= 0) return;

      const hrs = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, '0');
      const mins = Math.floor((diff / (1000 * 60)) % 60).toString().padStart(2, '0');
      const secs = Math.floor((diff / 1000) % 60).toString().padStart(2, '0');
      
      this.globalTimerVal.textContent = `${hrs}:${mins}:${secs}`;
    }, 1000);
  },

  // Helper HTTP POST calls
  async apiPost(url, body) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      return await res.json();
    } catch (e) {
      return { success: false, error: 'Network communication failure.' };
    }
  },

  // Toast notifier
  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'error' : 'success'}`;
    toast.innerHTML = `
      <span>${message}</span>
      <button style="background:none;border:none;color:#fff;cursor:pointer;font-weight:bold;margin-left:10px;">×</button>
    `;
    
    toast.querySelector('button').addEventListener('click', () => toast.remove());
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 4000);
  }
};

// Start frontend
App.init();

// --- SOCKET EVENTS ---

// Socket Connection Error Handling
socket.on('errorMsg', (msg) => {
  App.showToast(msg, 'error');
});

// Update Room state (Lobby or Board state changes)
socket.on('roomState', (room) => {
  App.currentRoomId = room.roomId;
  sessionStorage.setItem('ludo_room_id', room.roomId);

  if (room.state === 'LOBBY') {
    App.switchScreen('screen-lobby');
    App.lobbyCodeVal.textContent = room.roomId;
    App.lobbyModeVal.textContent = `${room.mode === '2-player' ? '2-Player' : '4-Player'} Mode`;
    
    // Draw slots
    const maxPlayers = room.mode === '2-player' ? 2 : 4;
    
    // Hide slot elements not matching mode
    for (let i = 0; i < 4; i++) {
      const slot = document.getElementById(`lobby-slot-${i}`);
      if (i >= maxPlayers) {
        slot.style.display = 'none';
        continue;
      }
      slot.style.display = 'flex';
      
      const player = room.players[i];
      const content = slot.querySelector('.slot-content');
      
      if (player) {
        content.innerHTML = `👤 <strong>${player.username}</strong> ${player.username === App.user.username ? '(You)' : ''}`;
      } else {
        content.innerHTML = '<span style="color:var(--text-muted);font-style:italic;">Waiting...</span>';
      }
    }

    // Toggle start game button for host (first player in list)
    const isHost = room.players[0] && room.players[0].username === App.user.username;
    if (isHost) {
      App.btnStartGame.classList.remove('hidden');
    } else {
      App.btnStartGame.classList.add('hidden');
    }

  } else if (room.state === 'PLAYING') {
    App.switchScreen('screen-game');
    App.gameRoomCode.textContent = room.roomId;
    
    // Redraw entire board and synchronize tokens positions
    LudoRenderer.syncBoard(room);
  } else if (room.state === 'FINISHED') {
    App.switchScreen('screen-game');
    App.gameRoomCode.textContent = room.roomId;
    
    // Sync final board
    LudoRenderer.syncBoard(room);

    // Show victory modal
    App.modalVictory.classList.remove('hidden');
    App.victoryRanking.innerHTML = '';
    
    room.winners.forEach((color, idx) => {
      const player = room.players.find(p => p.color === color);
      const row = document.createElement('div');
      row.className = `victory-row ${idx === 0 ? 'first-place' : ''}`;
      row.innerHTML = `
        <span>#${idx + 1} Place: ${color}</span>
        <span>${player ? player.username : 'Bot'}</span>
      `;
      App.victoryRanking.appendChild(row);
    });

    LudoSound.playWin();
  }
});

// Triggered when Game starts
socket.on('gameStarted', (room) => {
  App.currentRoomId = room.roomId;
  sessionStorage.setItem('ludo_room_id', room.roomId);
  App.switchScreen('screen-game');
  App.gameRoomCode.textContent = room.roomId;

  // Clear chat log
  App.chatMessages.innerHTML = '';
  
  // Render Board
  LudoRenderer.initBoard(room);
  LudoRenderer.syncBoard(room);
  
  App.showToast('Game Started! Red goes first.', 'success');
});

// Event when a player rolls dice
socket.on('diceRolled', ({ color, roll, validMoves, turnForfeited, message }) => {
  LudoRenderer.animateDiceRoll(color, roll, validMoves, turnForfeited);
  
  if (message) {
    App.chatMessages.innerHTML += `<div class="chat-msg system">📢 ${message}</div>`;
    App.chatMessages.scrollTop = App.chatMessages.scrollHeight;
  }
});

// Event when a player moves token
socket.on('tokenMoved', ({ color, tokenIndex, roll, path, capturedTokens, earnedExtraTurn, extraRollReason, gameState }) => {
  LudoRenderer.animateTokenMovement(color, tokenIndex, path, capturedTokens, earnedExtraTurn, extraRollReason, gameState);
});

// Text Chat/Emote broadcast handler
socket.on('chatMessage', ({ username, color, message, isEmote }) => {
  const isMe = username === App.user.username;
  const colClass = color.toLowerCase();
  
  let msgContent = '';
  if (isEmote) {
    msgContent = `<div class="chat-msg emote ${colClass}"><span class="msg-sender">${username}:</span> ${message}</div>`;
  } else {
    msgContent = `<div class="chat-msg ${colClass}"><span class="msg-sender">${username}:</span> ${message}</div>`;
  }
  
  App.chatMessages.innerHTML += msgContent;
  App.chatMessages.scrollTop = App.chatMessages.scrollHeight;
});

// Connection drop notifications
socket.on('playerDisconnected', ({ username, color }) => {
  App.showToast(`${username} (${color}) disconnected! Play continues.`, 'error');
  App.chatMessages.innerHTML += `<div class="chat-msg system" style="color:var(--color-red-light);">🔌 ${username} left the room. Bot auto-play active.</div>`;
  App.chatMessages.scrollTop = App.chatMessages.scrollHeight;
});

socket.on('playerReconnected', ({ username, color }) => {
  App.showToast(`${username} (${color}) reconnected!`, 'success');
  App.chatMessages.innerHTML += `<div class="chat-msg system" style="color:var(--color-green-light);">⚡ ${username} returned!</div>`;
  App.chatMessages.scrollTop = App.chatMessages.scrollHeight;
});
