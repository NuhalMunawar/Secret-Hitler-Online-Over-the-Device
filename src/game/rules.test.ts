import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from './GameEngine.js';
import { DebugAgents } from './DebugAgents.js';
import { Room } from '../../server/Room.js';

test('Game setup - 5 players role distribution and night info', () => {
  const players = [
    { id: 'p1', name: 'Alice' },
    { id: 'p2', name: 'Bob' },
    { id: 'p3', name: 'Charlie' },
    { id: 'p4', name: 'Diana' },
    { id: 'p5', name: 'Evan' },
  ];
  const engine = new GameEngine(players);
  const result = engine.startGame();
  assert.equal(result.success, true);

  const liberals = engine.players.filter((p) => p.role === 'LIBERAL');
  const fascists = engine.players.filter((p) => p.role === 'FASCIST');
  const hitler = engine.players.filter((p) => p.role === 'HITLER');

  assert.equal(liberals.length, 3);
  assert.equal(fascists.length, 1);
  assert.equal(hitler.length, 1);

  const fascistNight = engine.getNightInfoForPlayer(fascists[0].id);
  assert.equal(fascistNight?.knowsHitler, true);
  assert.equal(fascistNight?.hitlerName, hitler[0].name);

  const hitlerNight = engine.getNightInfoForPlayer(hitler[0].id);
  assert.equal(hitlerNight?.hitlerKnowsFascists, true);
  assert.equal(hitlerNight?.teammates?.[0].name, fascists[0].name);
});

test('Game setup - 7 players: Hitler does not know who Fascists are', () => {
  const players = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}` }));
  const engine = new GameEngine(players);
  engine.startGame();

  const liberals = engine.players.filter((p) => p.role === 'LIBERAL');
  const fascists = engine.players.filter((p) => p.role === 'FASCIST');
  const hitler = engine.players.find((p) => p.role === 'HITLER')!;

  assert.equal(liberals.length, 4);
  assert.equal(fascists.length, 2);

  const hitlerNight = engine.getNightInfoForPlayer(hitler.id);
  assert.equal(hitlerNight?.hitlerKnowsFascists, false);
  assert.equal(hitlerNight?.teammates, undefined);

  const fascistNight = engine.getNightInfoForPlayer(fascists[0].id);
  assert.equal(fascistNight?.hitlerName, hitler.name);
  assert.equal(fascistNight?.teammates?.length, 1);
});

test('Deck composition - 17 total policies: 6 Liberal, 11 Fascist', () => {
  const players = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
  const engine = new GameEngine(players);
  engine.startGame();

  const libCount = engine.drawDeck.filter((c) => c === 'LIBERAL').length;
  const fasCount = engine.drawDeck.filter((c) => c === 'FASCIST').length;

  assert.equal(libCount, 6);
  assert.equal(fasCount, 11);
  assert.equal(engine.drawDeck.length, 17);
});

test('Term limits - 6 living players vs 5 living players', () => {
  const players = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
  const engine = new GameEngine(players);
  engine.startGame();
  engine.presidentIndex = 0;
  engine.previousPresidentIndex = 1;
  engine.previousChancellorIndex = 2;

  let eligible = engine.getEligibleChancellors();
  assert.deepEqual(eligible.sort(), [3, 4, 5]);

  engine.players[5].isAlive = false;
  eligible = engine.getEligibleChancellors();
  assert.deepEqual(eligible.sort(), [1, 3, 4]);
});

test('Voting and Chaos tracker', () => {
  const players = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
  const engine = new GameEngine(players);
  engine.startGame();
  engine.advanceToNomination();
  engine.presidentIndex = 0;

  engine.nominateChancellor(1);
  assert.equal(engine.phase, 'VOTING');

  engine.castVote('p0', 'JA');
  engine.castVote('p1', 'JA');
  engine.castVote('p2', 'NEIN');
  engine.castVote('p3', 'NEIN');
  const res1 = engine.castVote('p4', 'NEIN');
  assert.equal(res1.passed, false);
  assert.equal(engine.electionTracker, 1);

  const eligible2 = engine.getEligibleChancellors();
  engine.nominateChancellor(eligible2[0]);
  engine.castVote('p0', 'NEIN');
  engine.castVote('p1', 'NEIN');
  engine.castVote('p2', 'NEIN');
  engine.castVote('p3', 'NEIN');
  engine.castVote('p4', 'NEIN');
  assert.equal(engine.electionTracker, 2);

  const eligible3 = engine.getEligibleChancellors();
  engine.nominateChancellor(eligible3[0]);
  engine.castVote('p0', 'NEIN');
  engine.castVote('p1', 'NEIN');
  engine.castVote('p2', 'NEIN');
  engine.castVote('p3', 'NEIN');
  const chaosRes = engine.castVote('p4', 'NEIN');

  assert.equal(chaosRes.chaos, true);
  assert.equal(engine.electionTracker, 0);
  assert.equal(engine.liberalPolicies + engine.fascistPolicies, 1);
  assert.equal(engine.previousChancellorIndex, null);
  assert.equal(engine.previousPresidentIndex, null);
});

test('Hitler elected Chancellor after 3 Fascist policies triggers Fascist Victory', () => {
  const players = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
  const engine = new GameEngine(players);
  engine.startGame();

  engine.fascistPolicies = 3;

  const hitlerIdx = engine.players.findIndex((p) => p.role === 'HITLER');
  const nonHitlerIdx = engine.players.findIndex((p) => p.role !== 'HITLER');
  engine.presidentIndex = nonHitlerIdx;
  engine.advanceToNomination();
  engine.nominateChancellor(hitlerIdx);

  for (const p of engine.players) {
    engine.castVote(p.id, 'JA');
  }

  assert.equal(engine.phase, 'GAME_OVER');
  assert.equal(engine.winner, 'FASCIST');
  assert.ok(engine.winReason?.includes('Hitler'));
});

test('Execution of Hitler ends game with Liberal Victory', () => {
  const players = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
  const engine = new GameEngine(players);
  engine.startGame();

  const hitlerIdx = engine.players.findIndex((p) => p.role === 'HITLER');
  const nonHitlerIdx = engine.players.findIndex((p) => p.role !== 'HITLER');

  engine.presidentIndex = nonHitlerIdx;
  engine.phase = 'EXECUTIVE_ACTION';
  engine.executiveAction = 'EXECUTE';

  const killRes = engine.executeKill(engine.players[nonHitlerIdx].id, hitlerIdx);
  assert.equal(killRes.gameOver, true);
  assert.equal(engine.winner, 'LIBERAL');
});

test('Veto Power at 5 Fascist policies and single-veto-per-round guard', () => {
  const players = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
  const engine = new GameEngine(players);
  engine.startGame();

  engine.fascistPolicies = 5;
  engine.phase = 'LEGISLATIVE_CHANCELLOR';
  engine.presidentIndex = 0;
  engine.chancellorIndex = 1;
  engine.currentChancellorCards = ['FASCIST', 'LIBERAL'];

  const vetoReq = engine.chancellorVeto(players[1].id);
  assert.equal(vetoReq.success, true);
  assert.equal(engine.phase, 'VETO_PENDING');

  // President rejects veto first
  const rejectResp = engine.presidentVetoResponse(players[0].id, false);
  assert.equal(rejectResp.vetoRejected, true);
  assert.equal(engine.phase, 'LEGISLATIVE_CHANCELLOR');

  // Chancellor cannot propose veto a second time in the same round
  const secondVeto = engine.chancellorVeto(players[1].id);
  assert.equal(secondVeto.success, false);
});

test('Late joiners after game starts become Spectators and cannot affect game', () => {
  const room = new Room('host1', 'Alice', 'sock_1');
  room.addPlayer('p2', 'Bob', 'sock_2');
  room.addPlayer('p3', 'Charlie', 'sock_3');
  room.addPlayer('p4', 'Diana', 'sock_4');
  room.addPlayer('p5', 'Evan', 'sock_5');

  const startRes = room.startGame();
  assert.equal(startRes.success, true);
  assert.equal(room.started, true);

  // Late joiner joins after game started
  const lateJoin = room.addPlayer('spec1', 'Frank', 'sock_6');
  assert.equal(lateJoin.success, true);
  assert.equal(lateJoin.isSpectator, true);
  assert.equal(room.players.length, 5);
  assert.equal(room.spectators.length, 1);
  assert.equal(room.spectators[0].name, 'Frank');
});

test('All 5 Debugging & Verification Agents pass 100% of checks', () => {
  const results = DebugAgents.runAllDiagnostics();
  assert.equal(results.length, 5);
  for (const agent of results) {
    assert.equal(agent.status, 'PASS', `Agent ${agent.agentName} failed: ${agent.details.join('; ')}`);
  }
});

function createTestGame(count: number) {
  const players = Array.from({ length: count }, (_, i) => ({
    id: `p_${i + 1}`,
    name: `Player ${i + 1}`,
  }));
  const engine = new GameEngine(players);
  engine.startGame();
  engine.advanceToNomination();
  return engine;
}

test('Role & Deck Shuffling: Player #1 gets unbiased random roles and deck order varies every game', () => {
  const trials = 300;
  let player1Liberal = 0;
  let player1Fascist = 0;
  let player1Hitler = 0;
  const deckSignatures = new Set<string>();

  for (let t = 0; t < trials; t++) {
    const game = createTestGame(5);
    if (game.players[0].role === 'LIBERAL') player1Liberal++;
    else if (game.players[0].role === 'FASCIST') player1Fascist++;
    else if (game.players[0].role === 'HITLER') player1Hitler++;

    deckSignatures.add(game.drawDeck.join(','));
  }

  // In a 5-player game (3L, 1F, 1H), Player #1 should get Liberal ~60% of the time (180 +- 45)
  assert.ok(player1Liberal > 120 && player1Liberal < 240, `Expected uniform Liberal distribution for Player #1, got ${player1Liberal}/${trials}`);
  assert.ok(player1Fascist > 25 && player1Fascist < 100, `Expected uniform Fascist distribution for Player #1, got ${player1Fascist}/${trials}`);
  assert.ok(player1Hitler > 25 && player1Hitler < 100, `Expected uniform Hitler distribution for Player #1, got ${player1Hitler}/${trials}`);
  // Deck signatures should have high entropy
  assert.ok(deckSignatures.size > 200, `Expected diverse deck shuffles, got ${deckSignatures.size} unique orders`);
});

test('Hitler Suspense Check reveals ONLY Hitler status (no party info) on 3+ Fascist Chancellor election and Player Execution', () => {
  const game = createTestGame(5);
  game.fascistPolicies = 3;
  game.presidentIndex = 0;

  const nonHitlerIdx = game.players.findIndex((p, idx) => idx !== 0 && p.role !== 'HITLER');
  game.nominateChancellor(nonHitlerIdx);

  let lastRes: any = null;
  for (const p of game.players) {
    lastRes = game.castVote(p.id, 'JA');
  }

  assert.equal(lastRes.passed, true);
  assert.ok(lastRes.hitlerCheck, 'Expected hitlerCheck when fascistPolicies >= 3');
  assert.equal(lastRes.hitlerCheck.targetName, game.players[nonHitlerIdx].name);
  assert.equal(lastRes.hitlerCheck.context, 'CHANCELLOR_ELECTED');
  assert.equal(lastRes.hitlerCheck.isHitler, false);
  assert.equal('party' in lastRes.hitlerCheck, false, 'hitlerCheck must NOT leak party');
  assert.equal('role' in lastRes.hitlerCheck, false, 'hitlerCheck must NOT leak role');
  assert.ok(lastRes.lastVoteDetails);
  assert.equal(lastRes.lastVoteDetails.jaCount, 5);

  // Also test Execution Hitler Check
  game.phase = 'EXECUTIVE_ACTION';
  game.executiveAction = 'EXECUTE';
  const presId = game.players[game.presidentIndex].id;
  const execRes = game.executeKill(presId, nonHitlerIdx);
  assert.equal(execRes.success, true);
  assert.ok(execRes.hitlerCheck, 'Expected hitlerCheck when a player is executed');
  assert.equal(execRes.hitlerCheck?.context, 'PLAYER_EXECUTED');
  assert.equal(execRes.hitlerCheck?.isHitler, false);
  assert.equal('party' in (execRes.hitlerCheck as any), false);
});

test('Table Approved/Rejected omits LastVoteDetails and Government History records Liberal/Fascist enactments', () => {
  const game = createTestGame(5);
  game.presidentIndex = 0;
  game.nominateChancellor(1);

  const tableRes = game.resolveTableVote(true);
  assert.equal(tableRes.success, true);
  assert.equal(tableRes.passed, true);
  assert.equal(game.lastVoteDetails, null, 'Table vote must not produce lastVoteDetails breakdown');

  // Enact policy and verify governmentHistory on President and Chancellor
  const pres = game.players[0];
  const chan = game.players[1];
  game.presidentDiscard(pres.id, 0);
  const enactedPolicy = game.currentChancellorCards[0];
  game.chancellorDiscard(chan.id, 1);

  assert.deepEqual(pres.governmentHistory, [enactedPolicy]);
  assert.deepEqual(chan.governmentHistory, [enactedPolicy]);
});

test('Live Room serialization, getLiveSnapshot, and multi-device seat synchronization', () => {
  const room = new Room('host_1', 'Alice', undefined, undefined, false, 'aliceSecret');
  room.addPlayer('p_2', 'Bob', 'bobSecret123');
  room.addPlayer('p_3', 'Charlie', 'charliePass');
  room.addPlayer('p_4', 'Diana', 'dianaPass');
  room.addPlayer('p_5', 'Evan', 'evanPass');

  // Re-joining with incorrect password should be rejected
  const wrongPasswordAttempt = room.addPlayer('new_device_id', 'Bob', 'wrongPassword');
  assert.equal(wrongPasswordAttempt.success, false);
  assert.ok(wrongPasswordAttempt.error?.includes('Incorrect password'));

  // Re-joining with matching password on another device seamlessly reconnects to that seat
  const reconnectByName = room.addPlayer('new_device_id', 'Bob', 'bobSecret123');
  assert.equal(reconnectByName.success, true);
  assert.equal(reconnectByName.reconnected, true);
  assert.equal(reconnectByName.playerId, 'p_2');
  assert.equal(room.players.length, 5);

  const startRes = room.startGame();
  assert.equal(startRes.success, true);

  // Serialize to JSON and restore (simulating disk persistence / live room sync)
  const serialized = room.toJSON();
  const restored = Room.fromJSON(serialized);
  assert.equal(restored.code, room.code);
  assert.equal(restored.started, true);
  assert.equal(restored.players.length, 5);

  // Verify live snapshot for Alice includes her private nightInfo and public gameState
  const snapAlice = restored.getLiveSnapshot('host_1');
  assert.equal(snapAlice.success, true);
  assert.equal(snapAlice.roomCode, room.code);
  assert.equal(snapAlice.liveUrl, `/live/${room.code}`);
  assert.equal(snapAlice.isHost, true);
  assert.ok(snapAlice.gameState);
  assert.ok(snapAlice.privateState?.nightInfo);
});

test('Host can remove any player before game starts and room supports Public/Private visibility', () => {
  const privateRoom = new Room('host_1', 'Alice', 'sock_1', undefined, true);
  assert.equal(privateRoom.isPrivate, true);
  assert.equal(privateRoom.getLiveSnapshot('host_1').isPrivate, true);

  privateRoom.addPlayer('p_2', 'Bob', 'sock_2');
  privateRoom.addPlayer('p_3', 'Charlie', 'sock_3');
  assert.equal(privateRoom.players.length, 3);

  // Non-host cannot remove players
  const nonHostKick = privateRoom.kickPlayer('p_2', 'p_3');
  assert.equal(nonHostKick.success, false);
  assert.equal(privateRoom.players.length, 3);

  // Host cannot remove themselves
  const selfKick = privateRoom.kickPlayer('host_1', 'host_1');
  assert.equal(selfKick.success, false);

  // Host can remove any human player before the game starts
  const hostKick = privateRoom.kickPlayer('host_1', 'p_2');
  assert.equal(hostKick.success, true);
  assert.equal(hostKick.removedPlayer?.name, 'Bob');
  assert.equal(privateRoom.players.length, 2);

  // Add players and start game -> host cannot remove players once game has started
  privateRoom.addPlayer('p_4', 'Diana');
  privateRoom.addPlayer('p_5', 'Evan');
  privateRoom.addPlayer('p_6', 'Fiona');
  assert.equal(privateRoom.startGame().success, true);

  const afterStartKick = privateRoom.kickPlayer('host_1', 'p_3');
  assert.equal(afterStartKick.success, false);
});

test('While game is running, leaving or disconnecting keeps player name on the game so they can sync with that name', () => {
  const room = new Room('host_1', 'Alice', 'sock_1', undefined, false, 'passAlice');
  room.addPlayer('p_2', 'Bob', 'passBob', 'sock_2');
  room.addBot();
  room.addBot();
  room.addBot();

  assert.equal(room.startGame().success, true);
  assert.equal(room.isGameRunning(), true);

  // 1. Bob leaves the room while the game is running
  const leaveBob = room.removePlayer('p_2');
  assert.equal(leaveBob.shouldCloseRoom, false);

  // Bob's name is still on the game (both in room.getPlayerList() and gameState.players)
  assert.ok(room.getPlayerList().some((p) => p.name === 'Bob'));
  assert.ok(room.getPublicGameState()?.players.some((p) => p.name === 'Bob'));

  // 2. Host Alice ALSO leaves the room while the game is running (only bots connected now)
  const leaveAlice = room.removePlayer('host_1');
  assert.equal(leaveAlice.shouldCloseRoom, false);
  // Bots never become host
  assert.ok(!room.getPlayerList().some((p) => p.isBot && p.isHost));
  // Alice's name is still on the game
  assert.ok(room.getPlayerList().some((p) => p.name === 'Alice'));

  // 3. Wrong password cannot sync to Bob's seat
  const badSync = room.addPlayer('new_id_1', 'Bob', 'wrongPw', 'sock_new_1');
  assert.equal(badSync.success, false);

  // 4. Bob syncs with his name and correct password to reclaim his seat
  const goodSyncBob = room.addPlayer('new_id_2', 'Bob', 'passBob', 'sock_new_2');
  assert.equal(goodSyncBob.success, true);
  assert.equal(goodSyncBob.reconnected, true);
  assert.equal(goodSyncBob.playerId, 'p_2');
  assert.equal(goodSyncBob.isSpectator, false);

  // 5. Alice syncs with her name and correct password to reclaim her seat
  const goodSyncAlice = room.addPlayer('new_id_3', 'Alice', 'passAlice', 'sock_new_3');
  assert.equal(goodSyncAlice.success, true);
  assert.equal(goodSyncAlice.reconnected, true);
  assert.equal(goodSyncAlice.playerId, 'host_1');
});

test('When game has ended, if host leaves another real player becomes host; bots are never hosts; if no real player remains room closes', () => {
  const room = new Room('host_1', 'Alice', 'sock_1', undefined, false, 'passAlice');
  room.addPlayer('p_2', 'Bob', 'passBob', 'sock_2');
  room.addBot();
  room.addBot();
  room.addBot();

  assert.equal(room.startGame().success, true);

  // Conclude the game (GAME_OVER)
  room.game!.liberalPolicies = 5;
  room.game!.winner = 'LIBERAL';
  room.game!.winReason = '5 Liberal policies have been enacted!';
  room.game!.phase = 'GAME_OVER';
  assert.equal(room.isGameEnded(), true);

  // 1. Host Alice leaves the room after the game has ended -> real player Bob becomes host
  const res1 = room.removePlayer('host_1');
  assert.equal(res1.wasHost, true);
  assert.equal(res1.shouldCloseRoom, false);
  assert.equal(room.hostId, 'p_2');
  assert.equal(room.getLiveSnapshot('p_2').isHost, true);
  // Ensure no bot is marked as host
  assert.equal(room.getPlayerList().some((p) => p.isBot && p.isHost), false);

  // 2. Now Bob (the last real player) leaves the room -> bots never become host, and room is closed
  const res2 = room.removePlayer('p_2');
  assert.equal(res2.wasHost, true);
  assert.equal(res2.remainingRealPlayers, 0);
  assert.equal(res2.shouldCloseRoom, true);
  assert.equal(room.hostId, '');
  assert.equal(room.getPlayerList().some((p) => p.isBot && p.isHost), false);
});





