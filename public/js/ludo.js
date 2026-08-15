// Ludo Board Dynamic Rendering, Stacking and Interactive Moves Animations
// c:\Users\user\Documents\Projects\Ludoking\public\js\ludo.js

const loopCoords = [
  { x: 2, y: 9 },  // Red start (index 0)
  { x: 3, y: 9 },
  { x: 4, y: 9 },
  { x: 5, y: 9 },
  { x: 6, y: 9 },
  
  { x: 7, y: 10 },
  { x: 7, y: 11 },
  { x: 7, y: 12 },
  { x: 7, y: 13 }, // Safe/Star cell (index 8)
  { x: 7, y: 14 },
  { x: 7, y: 15 },
  
  { x: 8, y: 15 },
  { x: 9, y: 15 },
  { x: 9, y: 14 }, // Blue start (index 13)
  { x: 9, y: 13 },
  { x: 9, y: 12 },
  { x: 9, y: 11 },
  { x: 9, y: 10 },
  
  { x: 10, y: 9 },
  { x: 11, y: 9 },
  { x: 12, y: 9 },
  { x: 13, y: 9 }, // Safe/Star cell (index 21)
  { x: 14, y: 9 },
  { x: 15, y: 9 },
  
  { x: 15, y: 8 },
  { x: 15, y: 7 },
  { x: 14, y: 7 }, // Yellow start (index 26)
  { x: 13, y: 7 },
  { x: 12, y: 7 },
  { x: 11, y: 7 },
  { x: 10, y: 7 },
  
  { x: 9, y: 6 },
  { x: 9, y: 5 },
  { x: 9, y: 4 },
  { x: 9, y: 3 }, // Safe/Star cell (index 34)
  { x: 9, y: 2 },
  { x: 9, y: 1 },
  
  { x: 8, y: 1 },
  { x: 7, y: 1 },
  { x: 7, y: 2 }, // Green start (index 39)
  { x: 7, y: 3 },
  { x: 7, y: 4 },
  { x: 7, y: 5 },
  { x: 7, y: 6 },
  
  { x: 6, y: 7 },
  { x: 5, y: 7 },
  { x: 4, y: 7 },
  { x: 3, y: 7 }, // Safe/Star cell (index 47)
  { x: 2, y: 7 },
  { x: 1, y: 7 },
  
  { x: 1, y: 8 }, // Red Entrance (index 50)
  { x: 1, y: 9 }
];

// Helper offsets
const startOffsets = {
  RED: 0,
  BLUE: 13,
  YELLOW: 26,
  GREEN: 39
};

const safeCells = [0, 8, 13, 21, 26, 34, 39, 47];

const LudoRenderer = {
  boardEl: null,
  overlayEl: null,
  isAnimating: false,

  initBoard(room) {
    this.boardEl = document.getElementById('ludo-board');
    this.overlayEl = document.getElementById('token-overlay-layer');
    
    // Position home corners explicitly to avoid flow misalignment
    document.getElementById('home-green').style.gridColumn = '1 / 7';
    document.getElementById('home-green').style.gridRow = '1 / 7';
    document.getElementById('home-yellow').style.gridColumn = '10 / 16';
    document.getElementById('home-yellow').style.gridRow = '1 / 7';
    document.getElementById('home-red').style.gridColumn = '1 / 7';
    document.getElementById('home-red').style.gridRow = '10 / 16';
    document.getElementById('home-blue').style.gridColumn = '10 / 16';
    document.getElementById('home-blue').style.gridRow = '10 / 16';
    document.querySelector('.center-zone').style.gridColumn = '7 / 10';
    document.querySelector('.center-zone').style.gridRow = '7 / 10';

    // Clear existing dynamically generated cells
    const generatedCells = this.boardEl.querySelectorAll('.cell');
    generatedCells.forEach(c => c.remove());

    // 1. Draw Loop Cells (52 cells)
    loopCoords.forEach((coord, index) => {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.style.gridColumn = coord.x;
      cell.style.gridRow = coord.y;
      cell.setAttribute('data-pos', index);

      // Star cell marking
      if (safeCells.includes(index)) {
        cell.classList.add('safe-cell', 'star-cell');
      }

      // Mark color starts
      if (index === startOffsets.RED) cell.classList.add('start-red');
      if (index === startOffsets.BLUE) cell.classList.add('start-blue');
      if (index === startOffsets.YELLOW) cell.classList.add('start-yellow');
      if (index === startOffsets.GREEN) cell.classList.add('start-green');

      this.boardEl.appendChild(cell);
    });

    // 2. Draw Home Paths (5 cells per player)
    for (let i = 0; i < 5; i++) {
      // RED Home path: row 8, columns 2 to 6
      const redCell = document.createElement('div');
      redCell.className = 'cell path-red';
      redCell.style.gridColumn = 2 + i;
      redCell.style.gridRow = 8;
      this.boardEl.appendChild(redCell);

      // GREEN Home path: col 8, rows 2 to 6
      const greenCell = document.createElement('div');
      greenCell.className = 'cell path-green';
      greenCell.style.gridColumn = 8;
      greenCell.style.gridRow = 2 + i;
      this.boardEl.appendChild(greenCell);

      // YELLOW Home path: row 8, columns 14 down to 10
      const yellowCell = document.createElement('div');
      yellowCell.className = 'cell path-yellow';
      yellowCell.style.gridColumn = 14 - i;
      yellowCell.style.gridRow = 8;
      this.boardEl.appendChild(yellowCell);

      // BLUE Home path: col 8, rows 14 down to 10
      const blueCell = document.createElement('div');
      blueCell.className = 'cell path-blue';
      blueCell.style.gridColumn = 8;
      blueCell.style.gridRow = 14 - i;
      this.boardEl.appendChild(blueCell);
    }
  },

  // Calculate top/left relative percentages (15x15 board)
  getCellPercentCoords(color, stepsMoved) {
    if (stepsMoved === -1) return null; // Yard is handled by slots

    let x, y;
    if (stepsMoved === 57) {
      // Home center triangles
      switch (color) {
        case 'RED': x = 7.5; y = 8.5; break;
        case 'GREEN': x = 8.5; y = 7.5; break;
        case 'YELLOW': x = 9.5; y = 8.5; break;
        case 'BLUE': x = 8.5; y = 9.5; break;
      }
    } else if (stepsMoved >= 52) {
      const idx = stepsMoved - 52;
      switch (color) {
        case 'RED': x = 2 + idx + 0.5; y = 8.5; break;
        case 'GREEN': x = 8.5; y = 2 + idx + 0.5; break;
        case 'YELLOW': x = 14 - idx + 0.5; y = 8.5; break;
        case 'BLUE': x = 8.5; y = 14 - idx + 0.5; break;
      }
    } else {
      const offset = startOffsets[color];
      const globalPos = (offset + stepsMoved) % 52;
      const coord = loopCoords[globalPos];
      x = coord.x - 0.5;
      y = coord.y - 0.5;
    }

    // Multiply by percentage per cell on 15x15 grid
    const cellPercent = 100 / 15;
    return {
      left: x * cellPercent,
      top: y * cellPercent
    };
  },

  // Redraws the board tokens and equips active cosmetics
  syncBoard(room) {
    if (this.isAnimating) return; // Wait for animations to finish before syncing

    // Ensure board is drawn
    if (!this.boardEl || !this.boardEl.querySelector('.cell')) {
      this.initBoard(room);
    }

    this.overlayEl.innerHTML = '';
    
    // Clear token slots inside home yards
    document.querySelectorAll('.token-slot').forEach(s => s.innerHTML = '');

    // Track active player info and status banner
    const turnColor = room.players[room.turn].color;
    const turnBanner = document.getElementById('turn-banner');
    const turnText = document.getElementById('turn-status-text');
    const activePlayer = room.players[room.turn];

    turnBanner.className = `turn-banner`;
    turnBanner.style.borderLeftColor = `var(--color-${turnColor.toLowerCase()})`;
    
    const isMyTurn = activePlayer.username === App.user.username;
    if (room.state === 'FINISHED') {
      turnText.textContent = 'Match Finished!';
    } else {
      turnText.textContent = isMyTurn ? `Your Turn (${turnColor})` : `${activePlayer.username}'s Turn (${turnColor})`;
    }

    // Update active indicators around control panels
    document.querySelectorAll('.player-control-panel').forEach(p => p.classList.remove('active'));
    const activePanel = document.getElementById(`panel-${turnColor}`);
    if (activePanel) {
      activePanel.classList.add('active');
    }

    // Update Player control details
    room.players.forEach(p => {
      const panel = document.getElementById(`panel-${p.color}`);
      if (panel) {
        panel.querySelector('.panel-name').textContent = p.username;
        let status = 'Waiting...';
        if (p.color === turnColor) {
          status = room.hasRolled ? 'Moving...' : 'Rolling...';
        }
        if (p.type === 'disconnected') {
          status = '🤖 Autoplay';
        }
        panel.querySelector('.panel-status').textContent = status;

        // Apply Dice Skin cosmetic
        const diceWidget = document.getElementById(`dice-${p.color}`);
        diceWidget.className = `dice-widget ${App.equippedDice}`;
        if (p.color === turnColor && isMyTurn && !room.hasRolled) {
          diceWidget.classList.add('active');
          // Add click event for active dice
          diceWidget.onclick = () => {
            diceWidget.onclick = null;
            diceWidget.classList.remove('active');
            socket.emit('rollDice', { roomId: room.roomId });
          };
        } else {
          diceWidget.classList.remove('active');
          diceWidget.onclick = null;
        }

        // Show roll value if rolled
        if (p.color === turnColor && room.diceRoll !== null) {
          diceWidget.textContent = room.diceRoll;
        }
      }
    });

    // Populate tokens map for stacking offset math
    const cellTokenMap = {};

    room.players.forEach(player => {
      const color = player.color;
      const positions = room.tokens[color];

      positions.forEach((stepsMoved, tokenIndex) => {
        if (stepsMoved === -1) {
          // Token in Yard Slot
          const slot = document.querySelector(`.token-slot.${color.toLowerCase()}[data-index="${tokenIndex}"]`);
          if (slot) {
            const tokenEl = document.createElement('div');
            tokenEl.className = `ludo-token ${color.toLowerCase()} ${App.equippedToken}`;
            tokenEl.textContent = tokenIndex + 1;
            slot.appendChild(tokenEl);
          }
        } else {
          // Token on path/home
          const coordKey = stepsMoved === 57 ? `home-${color}` : `${color}-${stepsMoved}`;
          if (!cellTokenMap[coordKey]) {
            cellTokenMap[coordKey] = [];
          }
          cellTokenMap[coordKey].push({ color, tokenIndex, stepsMoved });
        }
      });
    });

    // Render positioned tokens on overlay layer with stack offsets
    Object.keys(cellTokenMap).forEach(key => {
      const tokensList = cellTokenMap[key];
      const count = tokensList.length;

      tokensList.forEach((tokenData, listIdx) => {
        const { color, tokenIndex, stepsMoved } = tokenData;
        const coords = this.getCellPercentCoords(color, stepsMoved);
        if (!coords) return;

        const tokenEl = document.createElement('div');
        tokenEl.className = `ludo-token ${color.toLowerCase()} ${App.equippedToken}`;
        tokenEl.textContent = tokenIndex + 1;
        tokenEl.style.left = `${coords.left}%`;
        tokenEl.style.top = `${coords.top}%`;

        // Apply stack offsets if multiple tokens occupy the same cell
        let offsetX = 0;
        let offsetY = 0;
        const offsetVal = 1.3; // percentage offset

        if (count === 2) {
          offsetX = listIdx === 0 ? -offsetVal : offsetVal;
          offsetY = listIdx === 0 ? -offsetVal : offsetVal;
        } else if (count === 3) {
          if (listIdx === 0) { offsetX = -offsetVal; offsetY = -offsetVal; }
          if (listIdx === 1) { offsetX = offsetVal; offsetY = -offsetVal; }
          if (listIdx === 2) { offsetX = 0; offsetY = offsetVal; }
        } else if (count >= 4) {
          if (listIdx === 0) { offsetX = -offsetVal; offsetY = -offsetVal; }
          if (listIdx === 1) { offsetX = offsetVal; offsetY = -offsetVal; }
          if (listIdx === 2) { offsetX = -offsetVal; offsetY = offsetVal; }
          if (listIdx === 3) { offsetX = offsetVal; offsetY = offsetVal; }
        }

        tokenEl.style.transform = `translate(calc(-50% + ${offsetX}vw), calc(-50% + ${offsetY}vw))`;

        // Make playable if this token belongs to local player and turn is active
        const isMyTurn = room.players[room.turn].username === App.user.username;
        if (isMyTurn && color === room.players[room.turn].color && room.hasRolled) {
          const playableMoves = this.calculateValidMovesLocally(room);
          if (playableMoves.includes(tokenIndex)) {
            tokenEl.classList.add('playable');
            tokenEl.onclick = () => {
              this.disablePlayableHighlights();
              socket.emit('moveToken', { roomId: room.roomId, tokenIndex });
            };
          }
        }

        this.overlayEl.appendChild(tokenEl);
      });
    });
  },

  calculateValidMovesLocally(room) {
    const activeColor = room.players[room.turn].color;
    const tokens = room.tokens[activeColor];
    const roll = room.diceRoll;
    const valid = [];

    tokens.forEach((steps, idx) => {
      if (steps === 57) return;
      if (steps === -1) {
        if (roll === 6) valid.push(idx);
      } else if (steps + roll <= 57) {
        valid.push(idx);
      }
    });

    return valid;
  },

  disablePlayableHighlights() {
    document.querySelectorAll('.ludo-token.playable').forEach(t => {
      t.classList.remove('playable');
      t.onclick = null;
    });
  },

  // Animate dice shake tumbling
  animateDiceRoll(color, roll, validMoves, turnForfeited) {
    LudoSound.playRoll();
    const diceEl = document.getElementById(`dice-${color}`);
    if (!diceEl) return;

    diceEl.classList.add('rolling');
    diceEl.textContent = '🎲';

    setTimeout(() => {
      diceEl.classList.remove('rolling');
      diceEl.textContent = roll;
      
      // Update local state if needed (handled on roomState update, but this ensures instant visual sync)
      // Highlight valid tokens if it is my turn
      const activePlayer = document.querySelector(`.player-control-panel.active`);
      if (activePlayer && activePlayer.id === `panel-${color}` && color === App.user?.equipped?.token) {
        // Redraw to register playable token click listeners
      }
    }, 600);
  },

  // Sequenced path token jump animations
  async animateTokenMovement(color, tokenIndex, path, capturedTokens, earnedExtraTurn, extraRollReason, gameState) {
    this.isAnimating = true;
    this.disablePlayableHighlights();

    // 1. Locate the token element
    // If it started in yard, remove it from yard slot and spawn it at Start coordinate
    const slot = document.querySelector(`.token-slot.${color.toLowerCase()}[data-index="${tokenIndex}"]`);
    let animToken = null;

    if (slot && slot.children.length > 0) {
      animToken = slot.children[0];
      animToken.remove(); // Remove from slot
      
      // Spawn on overlay layer at relative start coordinates
      animToken = document.createElement('div');
      animToken.className = `ludo-token ${color.toLowerCase()} ${App.equippedToken}`;
      animToken.textContent = tokenIndex + 1;
      
      const startCoords = this.getCellPercentCoords(color, 0);
      animToken.style.left = `${startCoords.left}%`;
      animToken.style.top = `${startCoords.top}%`;
      animToken.style.transform = 'translate(-50%, -50%)';
      this.overlayEl.appendChild(animToken);
    } else {
      // Find on overlay layer
      const tokensOnOverlay = Array.from(this.overlayEl.querySelectorAll(`.ludo-token.${color.toLowerCase()}`));
      animToken = tokensOnOverlay.find(t => t.textContent == (tokenIndex + 1));
    }

    if (!animToken) {
      this.isAnimating = false;
      this.syncBoard(gameState);
      return;
    }

    // 2. Perform step by step paths slide
    for (let i = 0; i < path.length; i++) {
      const step = path[i];
      const dest = this.getCellPercentCoords(color, step.stepsMoved);
      if (dest) {
        animToken.style.left = `${dest.left}%`;
        animToken.style.top = `${dest.top}%`;
        LudoSound.playMove();
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }

    // 3. Play Home chord if reached home
    const finalStep = path[path.length - 1];
    if (finalStep && finalStep.stepsMoved === 57) {
      LudoSound.playHomeEntry();
    }

    // 4. Play capture sound if captured opponent
    if (capturedTokens && capturedTokens.length > 0) {
      LudoSound.playCapture();
      // Wait a moment for visual capture effect before resetting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.isAnimating = false;
    // Finally sync back full room status
    this.syncBoard(gameState);
  }
};
