// Unit tests for Ludo authoritative game state engine
// c:\Users\user\Documents\Projects\Ludoking\test\gameLogic.test.js

const assert = require('assert');
const test = require('node:test');
const LudoGame = require('../server/gameLogic');

test('LudoGame Initialization & Setup', () => {
  const players = [
    { username: 'PlayerRed', type: 'human' },
    { username: 'PlayerBlue', type: 'human' }
  ];
  
  const game = new LudoGame('123456', players, '2-player');
  
  assert.strictEqual(game.roomId, '123456');
  assert.strictEqual(game.mode, '2-player');
  assert.strictEqual(game.state, 'LOBBY');
  assert.strictEqual(game.players.length, 2);
  
  // Verify colors assign Red and Yellow for 2-player
  assert.strictEqual(game.players[0].color, 'RED');
  assert.strictEqual(game.players[1].color, 'YELLOW');
  
  // Verify tokens are in yard (-1)
  assert.deepStrictEqual(game.tokens.RED, [-1, -1, -1, -1]);
  assert.deepStrictEqual(game.tokens.YELLOW, [-1, -1, -1, -1]);
});

test('Dice Roll Rules & Double Turn Checks', () => {
  const players = [{ username: 'Red', type: 'human' }];
  const game = new LudoGame('111222', players, '2-player');
  game.startGame();
  
  // Mock turn to Red (0)
  game.turn = 0;
  
  // Roll a dice and verify boundaries
  const rollRes = game.rollDice();
  assert.ok(rollRes.roll >= 1 && rollRes.roll <= 6);
  assert.strictEqual(game.hasRolled, true);
  
  // Test 3 consecutive sixes forfeits turn
  game.hasRolled = false;
  game.consecutiveSixes = 2;
  game.diceRoll = null;
  
  // Mock Math.random to return 1.0 (so roll becomes 6)
  const origRandom = Math.random;
  Math.random = () => 0.99; // (0.99 * 6) + 1 = 6.94 -> floor is 6
  
  const res3Sixes = game.rollDice();
  Math.random = origRandom; // Restore original random
  
  assert.strictEqual(res3Sixes.roll, 6);
  assert.strictEqual(res3Sixes.turnForfeited, true);
  assert.strictEqual(game.consecutiveSixes, 0);
  assert.strictEqual(game.hasRolled, false); // turn passes automatically
});

test('Token Movement & Release Rules', () => {
  const players = [{ username: 'Red', type: 'human' }];
  const game = new LudoGame('111333', players, '2-player');
  game.startGame();
  game.turn = 0;
  
  // Try to move token with a roll of 3 (Should fail to release from yard)
  game.hasRolled = true;
  game.diceRoll = 3;
  let validMoves = game.getValidMoves();
  assert.deepStrictEqual(validMoves, []);
  
  // Set roll to 6 (Should allow release)
  game.diceRoll = 6;
  validMoves = game.getValidMoves();
  assert.deepStrictEqual(validMoves, [0, 1, 2, 3]);
  
  // Release token 0
  const moveRes = game.moveToken(0);
  assert.strictEqual(game.tokens.RED[0], 0); // Released to start index 0
  assert.strictEqual(moveRes.earnedExtraTurn, false); // Six roll itself gives extra roll, but handled by turn loop
});

test('Token Captures & Safe Zone Shields', () => {
  const players = [
    { username: 'Red', type: 'human' },
    { username: 'Blue', type: 'human' }
  ];
  const game = new LudoGame('111444', players, '2-player');
  game.startGame();
  
  // Position Red token 0 on track 5 (global 5)
  game.tokens.RED[0] = 5;
  
  // Position Yellow token 0 on track 31.
  // Wait, in 2-player mode, the second player is Yellow. Yellow startOffset is 26.
  // Global position of Yellow at stepsMoved = 31 is (26 + 31) % 52 = 5.
  // So they are on the same cell!
  game.tokens.YELLOW[0] = 31;
  
  // Move Red token 0 by 0 steps to trigger capture?
  // Let's manually trigger collision check by placing Red at stepsMoved = 5.
  // Red moves from stepsMoved = 4 to stepsMoved = 5 with roll = 1.
  game.tokens.RED[0] = 4;
  game.turn = 0; // Red's turn
  game.hasRolled = true;
  game.diceRoll = 1;
  
  const moveRes = game.moveToken(0);
  
  // Verify Yellow token 0 is captured and returned to yard (-1)
  assert.strictEqual(game.tokens.YELLOW[0], -1);
  assert.strictEqual(moveRes.capturedTokens.length, 1);
  assert.strictEqual(moveRes.capturedTokens[0].color, 'YELLOW');
  assert.strictEqual(moveRes.capturedTokens[0].tokenIndex, 0);
  assert.strictEqual(moveRes.earnedExtraTurn, true); // Captured yields extra turn!
});

test('Exact Roll Home Path entry & Victory triggers', () => {
  const players = [{ username: 'Red', type: 'human' }];
  const game = new LudoGame('111555', players, '2-player');
  game.startGame();
  game.turn = 0;
  
  // Place token at 55
  game.tokens.RED[0] = 55;
  
  // Roll 3 -> 55 + 3 = 58 > 57 (Overshoot, invalid move)
  game.hasRolled = true;
  game.diceRoll = 3;
  let valid = game.getValidMoves();
  assert.ok(!valid.includes(0));
  
  // Roll 2 -> 55 + 2 = 57 (Exact hit, valid)
  game.diceRoll = 2;
  valid = game.getValidMoves();
  assert.ok(valid.includes(0));
  
  // Perform exact move
  const moveRes = game.moveToken(0);
  assert.strictEqual(game.tokens.RED[0], 57);
  assert.strictEqual(moveRes.earnedExtraTurn, true); // reaching home yields extra turn
  
  // Check victory condition
  // Set all Red tokens to home (57)
  game.tokens.RED = [57, 57, 57, 57];
  
  // Trigger move token to check finished state
  game.tokens.RED[3] = 56;
  game.turn = 0;
  game.hasRolled = true;
  game.diceRoll = 1;
  const finishRes = game.moveToken(3);
  
  assert.strictEqual(game.state, 'FINISHED');
  assert.ok(game.winners.includes('RED'));
});
