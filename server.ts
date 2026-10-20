import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Room } from './server/Room.js';
import { DebugAgents } from './src/game/DebugAgents.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 30000,
  pingInterval: 10000,
});

const DATA_DIR = path.join(__dirname, '.data');
const ROOMS_FILE = path.join(DATA_DIR, 'live-rooms.json');

const rooms: Record<string, Room> = {};
const socketMap: Record<string, { roomCode: string; playerId: string; isSpectator?: boolean }> = {};

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('Could not create .data dir:', err);
  }
}

function loadRoomsFromDisk() {
  try {
    ensureDataDir();
    if (!fs.existsSync(ROOMS_FILE)) return;
    const raw = fs.readFileSync(ROOMS_FILE, 'utf-8');
    if (!raw.trim()) return;
    const parsed = JSON.parse(raw);
    const now = Date.now();
    const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
    for (const [code, roomData] of Object.entries<any>(parsed)) {
      if (roomData && now - (roomData.updatedAt || 0) < MAX_AGE_MS) {
        const room = Room.fromJSON(roomData);
        rooms[code.toUpperCase()] = room;
        // Resume bot turns if needed
        if (room.started && room.game) {
          room.handleBotTurns((evt, data) => broadcastRoomUpdate(room, evt, data));
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load rooms from disk:', err);
  }
}

function saveRoomsToDisk() {
  try {
    ensureDataDir();
    const now = Date.now();
    const MAX_AGE_MS = 24 * 60 * 60 * 1000;
    const serialized: Record<string, any> = {};
    for (const [code, room] of Object.entries(rooms)) {
      const hasRealPlayer = room.players.some((p) => !p.isBot);
      if (now - room.updatedAt < MAX_AGE_MS && hasRealPlayer) {
        serialized[code] = room.toJSON();
      }
    }
    fs.writeFileSync(ROOMS_FILE, JSON.stringify(serialized, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to save rooms to disk:', err);
  }
}

function getRoomByCode(rawCode: string): Room | null {
  const code = (rawCode || '').toUpperCase().trim();
  if (!code) return null;
  if (rooms[code]) return rooms[code];
  // Check disk in case room was persisted in another worker/process
  loadRoomsFromDisk();
  return rooms[code] || null;
}

function getPublicRoomsList() {
  const now = Date.now();
  const MAX_AGE_MS = 12 * 60 * 60 * 1000;
  return Object.values(rooms)
    .filter(
      (r) =>
        !r.isPrivate &&
        r.players.some((p) => !p.isBot) &&
        now - r.updatedAt < MAX_AGE_MS
    )
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((r) => r.getSummary());
}

function broadcastPublicRooms() {
  saveRoomsToDisk();
  io.emit('public-rooms-updated', { rooms: getPublicRoomsList() });
}

function getRoomAndPlayer(socket: Socket): { room: Room; playerId: string; isSpectator: boolean } | null {
  const mapping = socketMap[socket.id];
  if (!mapping) return null;
  const room = getRoomByCode(mapping.roomCode);
  if (!room) return null;
  return { room, playerId: mapping.playerId, isSpectator: Boolean(mapping.isSpectator) };
}

function broadcastRoomUpdate(room: Room, event: string, data: any) {
  saveRoomsToDisk();
  if (event === 'direct-president-cards') {
    io.to(data.socketId).emit('president-cards', { cards: data.cards });
    return;
  }
  if (event === 'direct-chancellor-cards') {
    io.to(data.socketId).emit('chancellor-cards', {
      cards: data.cards,
      vetoAvailable: data.vetoAvailable,
    });
    return;
  }
  if (event === 'direct-peek-cards') {
    io.to(data.socketId).emit('peek-cards', { cards: data.cards });
    return;
  }
  io.to(room.code).emit(event, data);
  io.to(room.code).emit('live-room-sync', room.getLiveSnapshot());
  broadcastPublicRooms();
}

// Load persisted live rooms on startup
loadRoomsFromDisk();

// ============================================================================
// REST API FOR PUBLIC LIVE ROOMS & MULTI-DEVICE SYNC (/api/live/*)
// ============================================================================

// 1. List all public live rooms
app.get('/api/live', (_req, res) => {
  res.json({
    success: true,
    rooms: getPublicRoomsList(),
  });
});

// 2. Create a new public or private live room via HTTP
app.post('/api/live/create', (req, res) => {
  try {
    const playerName = (req.body?.playerName || 'Host').trim() || 'Host';
    const isPrivate = Boolean(req.body?.isPrivate);
    const password = (req.body?.password || '').trim();

    if (!password || password.length < 4 || password.length > 64) {
      return res.status(400).json({
        success: false,
        error: 'Password must be between 4 and 64 characters.',
      });
    }

    const playerId = `usr_${Math.random().toString(36).substring(2, 8)}_${Date.now().toString(36)}`;
    let room = new Room(playerId, playerName, playerId, undefined, isPrivate, password);
    while (rooms[room.code]) {
      room = new Room(playerId, playerName, playerId, undefined, isPrivate, password);
    }
    rooms[room.code] = room;
    broadcastPublicRooms();

    res.json({
      ...room.getLiveSnapshot(playerId),
      playerId,
      playerName,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to create room' });
  }
});

// 3. Get live room snapshot by 4-letter code (used by /live/:code page and live sync polling)
app.get('/api/live/:code', (req, res) => {
  const code = (req.params.code || '').toUpperCase().trim();
  const playerId = typeof req.query.playerId === 'string' ? req.query.playerId : undefined;
  const room = getRoomByCode(code);
  if (!room) {
    return res.status(404).json({
      success: false,
      error: `Live room "${code}" was not found. Check the 4-letter code or create a new room.`,
    });
  }
  res.json(room.getLiveSnapshot(playerId));
});

// 4. Join or claim/reconnect a seat in a live room via HTTP
app.post('/api/live/:code/join', (req, res) => {
  try {
    const code = (req.params.code || '').toUpperCase().trim();
    const room = getRoomByCode(code);
    if (!room) {
      return res.status(404).json({
        success: false,
        error: `Room "${code}" not found. Check the 4-letter code.`,
      });
    }

    const playerName = (req.body?.playerName || '').trim();
    const password = (req.body?.password || '').trim();
    const existingPlayerId = req.body?.playerId;
    const claimPlayerId = req.body?.claimPlayerId;
    const newId =
      existingPlayerId ||
      `usr_${Math.random().toString(36).substring(2, 8)}_${Date.now().toString(36)}`;

    const result = room.addPlayer(newId, playerName, password, undefined, claimPlayerId);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    const finalPlayerId = result.playerId || newId;
    const isSpectator = Boolean(result.isSpectator);
    const seatedPlayer =
      room.players.find((p) => p.id === finalPlayerId) ||
      room.spectators.find((s) => s.id === finalPlayerId);
    const finalPlayerName = seatedPlayer ? seatedPlayer.name : playerName;

    saveRoomsToDisk();
    if (!result.reconnected) {
      io.to(code).emit('player-joined', {
        players: room.getPlayerList(),
        spectators: room.getSpectatorList(),
        playerName: finalPlayerName,
        isSpectator,
      });
    } else {
      io.to(code).emit('lobby-updated', {
        players: room.getPlayerList(),
        spectators: room.getSpectatorList(),
      });
    }
    broadcastPublicRooms();

    res.json({
      ...room.getLiveSnapshot(finalPlayerId),
      playerId: finalPlayerId,
      playerName: finalPlayerName,
      reconnected: Boolean(result.reconnected),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to join room' });
  }
});

// 5. Execute any game/lobby action on the live room via HTTP
app.post('/api/live/:code/action', (req, res) => {
  try {
    const code = (req.params.code || '').toUpperCase().trim();
    const room = getRoomByCode(code);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    const { action, playerId, payload } = req.body || {};
    const result = executeRoomAction(room, playerId, action, payload || {});
    if (!result.success) {
      return res.status(400).json(result);
    }

    if (action === 'leave-room' || !rooms[room.code]) {
      return res.json(result);
    }

    res.json({
      ...result,
      snapshot: room.getLiveSnapshot(playerId),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Action failed' });
  }
});

// Shared authoritative action processor used by both Socket.IO and HTTP Live Sync
function executeRoomAction(
  room: Room,
  playerId: string,
  action: string,
  payload: any
): Record<string, any> {
  const isSpectator = room.spectators.some((s) => s.id === playerId);

  switch (action) {
    case 'leave-room': {
      // Unbind any sockets belonging to this leaving player
      for (const [sid, info] of Object.entries(socketMap)) {
        if (info.roomCode === room.code && info.playerId === playerId) {
          const targetSock = io.sockets.sockets.get(sid);
          if (targetSock) targetSock.leave(room.code);
          delete socketMap[sid];
        }
      }

      const { shouldCloseRoom } = room.removePlayer(playerId);
      if (shouldCloseRoom) {
        io.to(room.code).emit('room-closed', {
          roomCode: room.code,
          reason: 'Room closed because no real players remain.',
        });
        delete rooms[room.code];
      } else {
        io.to(room.code).emit('lobby-updated', {
          players: room.getPlayerList(),
          spectators: room.getSpectatorList(),
          hostId: room.hostId,
        });
        io.to(room.code).emit('live-room-sync', room.getLiveSnapshot());
      }
      broadcastPublicRooms();
      return { success: true, roomClosed: shouldCloseRoom };
    }

    case 'add-bot': {
      if (room.hostId !== playerId) return { success: false, error: 'Only host can add bots' };
      const res = room.addBot();
      if (!res.success) return res;
      io.to(room.code).emit('lobby-updated', {
        players: room.getPlayerList(),
        spectators: room.getSpectatorList(),
      });
      broadcastPublicRooms();
      return { success: true, bot: res.bot };
    }

    case 'remove-bot': {
      if (room.hostId !== playerId) return { success: false, error: 'Only host can remove bots' };
      const ok = room.removeBot(payload.botId);
      if (!ok) return { success: false, error: 'Bot not found' };
      io.to(room.code).emit('lobby-updated', {
        players: room.getPlayerList(),
        spectators: room.getSpectatorList(),
      });
      broadcastPublicRooms();
      return { success: true };
    }

    case 'remove-player': {
      const targetPlayerId = payload.targetPlayerId || payload.playerId || payload.botId;
      const res = room.kickPlayer(playerId, targetPlayerId);
      if (!res.success) return res;

      const removed = res.removedPlayer;
      if (removed && !removed.isBot && removed.socketId) {
        io.to(removed.socketId).emit('kicked-from-room', {
          roomCode: room.code,
          reason: 'You were removed from the room by the host.',
        });
        const targetSocket = io.sockets.sockets.get(removed.socketId);
        if (targetSocket) {
          targetSocket.leave(room.code);
        }
        delete socketMap[removed.socketId];
      }

      io.to(room.code).emit('lobby-updated', {
        players: room.getPlayerList(),
        spectators: room.getSpectatorList(),
      });
      broadcastPublicRooms();
      return { success: true, removedPlayerName: removed?.name };
    }

    case 'start-game': {
      if (room.hostId !== playerId) return { success: false, error: 'Only host can start the game' };
      const res = room.startGame();
      if (!res.success) return res;

      const pubState = room.game!.getPublicState();
      for (const p of room.players) {
        if (!p.isBot && p.socketId) {
          const info = res.nightInfo ? res.nightInfo[p.id] : null;
          io.to(p.socketId).emit('game-started', {
            nightInfo: info,
            state: pubState,
          });
        }
      }
      for (const s of room.spectators) {
        if (s.socketId) {
          io.to(s.socketId).emit('game-started', {
            nightInfo: null,
            state: pubState,
            isSpectator: true,
          });
        }
      }
      broadcastPublicRooms();
      const hostNightInfo = res.nightInfo ? res.nightInfo[playerId] : null;
      return { success: true, nightInfo: hostNightInfo, state: pubState };
    }

    case 'night-complete': {
      if (!room.game) return { success: false, error: 'Game not active' };
      if (isSpectator) return { success: false, error: 'Spectators cannot perform game actions' };
      if (room.game.phase === 'NIGHT') {
        room.game.advanceToNomination();
        room.touch();
        io.to(room.code).emit('state-update', {
          state: room.game.getPublicState(),
        });
        broadcastPublicRooms();
        room.handleBotTurns((evt, data) => broadcastRoomUpdate(room, evt, data));
      }
      return { success: true };
    }

    case 'nominate-chancellor': {
      if (!room.game) return { success: false, error: 'Game not active' };
      if (isSpectator) return { success: false, error: 'Spectators cannot nominate' };
      const game = room.game;
      if (game.players[game.presidentIndex].id !== playerId) {
        return { success: false, error: 'Only the sitting President can nominate a Chancellor' };
      }
      const res = game.nominateChancellor(payload.chancellorIndex);
      if (!res.success) return res;
      room.touch();
      io.to(room.code).emit('state-update', {
        state: game.getPublicState(),
      });
      broadcastPublicRooms();
      room.handleBotTurns((evt, data) => broadcastRoomUpdate(room, evt, data));
      return { success: true };
    }

    case 'cast-vote': {
      if (!room.game) return { success: false, error: 'Game not active' };
      if (isSpectator) return { success: false, error: 'Spectators cannot vote' };
      const game = room.game;
      const res = game.castVote(playerId, payload.vote);
      if (!res.success) return res;
      room.touch();

      if (res.waiting) {
        io.to(room.code).emit('vote-progress', {
          votesIn: res.votesIn,
          votesNeeded: res.votesNeeded,
          state: game.getPublicState(),
        });
        saveRoomsToDisk();
        return { success: true, waiting: true };
      }

      room.RecordHitlerCheck(res.hitlerCheck);

      if (res.gameOver) {
        io.to(room.code).emit('game-over', {
          state: game.getPublicState(),
          winner: res.winner,
          winReason: res.winReason,
          roles: game.getAllRoles(),
          hitlerCheck: res.hitlerCheck,
          votes: res.votes,
        });
        broadcastPublicRooms();
        return { success: true };
      }

      if (res.chaos) {
        io.to(room.code).emit('election-result', {
          passed: false,
          votes: res.votes,
          chaos: true,
          chaosPolicy: res.chaosPolicy,
          deckReshuffled: res.deckReshuffled,
          state: game.getPublicState(),
        });
        broadcastPublicRooms();
        room.handleBotTurns((evt, data) => broadcastRoomUpdate(room, evt, data));
        return { success: true };
      }

      io.to(room.code).emit('election-result', {
        passed: res.passed,
        votes: res.votes,
        hitlerCheck: res.hitlerCheck,
        deckReshuffled: res.deckReshuffled,
        state: game.getPublicState(),
      });

      if (res.passed) {
        const pres = game.players[game.presidentIndex];
        if (pres && !pres.isBot) {
          const presSocketId = room.players.find((p) => p.id === pres.id)?.socketId;
          if (presSocketId) {
            io.to(presSocketId).emit('president-cards', { cards: game.currentPresidentCards });
          }
        }
      }

      broadcastPublicRooms();
      room.handleBotTurns((evt, data) => broadcastRoomUpdate(room, evt, data));
      return { success: true };
    }

    case 'president-discard': {
      if (!room.game) return { success: false, error: 'Game not active' };
      if (isSpectator) return { success: false, error: 'Spectators cannot discard' };
      const game = room.game;
      const res = game.presidentDiscard(playerId, payload.cardIndex);
      if (!res.success) return res;
      room.touch();

      io.to(room.code).emit('state-update', { state: game.getPublicState() });

      const chan = game.players[game.chancellorIndex!];
      if (chan && !chan.isBot) {
        const chanSocketId = room.players.find((p) => p.id === chan.id)?.socketId;
        if (chanSocketId) {
          io.to(chanSocketId).emit('chancellor-cards', {
            cards: game.currentChancellorCards,
            vetoAvailable: game.fascistPolicies >= 5 && !game.vetoUsedThisRound,
          });
        }
      }

      broadcastPublicRooms();
      room.handleBotTurns((evt, data) => broadcastRoomUpdate(room, evt, data));
      return { success: true };
    }

    case 'chancellor-discard': {
      if (!room.game) return { success: false, error: 'Game not active' };
      if (isSpectator) return { success: false, error: 'Spectators cannot enact policies' };
      const game = room.game;
      const res = game.chancellorDiscard(playerId, payload.cardIndex);
      if (!res.success) return res;
      room.touch();

      if (res.gameOver) {
        io.to(room.code).emit('game-over', {
          state: game.getPublicState(),
          winner: res.winner,
          winReason: res.winReason,
          roles: game.getAllRoles(),
        });
        broadcastPublicRooms();
        return { success: true };
      }

      io.to(room.code).emit('policy-enacted', {
        policy: res.policy,
        state: game.getPublicState(),
        executiveAction: res.executiveAction,
        deckReshuffled: res.deckReshuffled,
      });

      if (res.executiveAction === 'PEEK') {
        const pres = game.players[game.presidentIndex];
        const presSocketId = room.players.find((p) => p.id === pres.id)?.socketId;
        if (presSocketId) {
          const peek = game.getPeekCards(pres.id);
          io.to(presSocketId).emit('peek-cards', { cards: peek.cards });
        }
      }

      broadcastPublicRooms();
      room.handleBotTurns((evt, data) => broadcastRoomUpdate(room, evt, data));
      return { success: true };
    }

    case 'chancellor-veto': {
      if (!room.game) return { success: false, error: 'Game not active' };
      if (isSpectator) return { success: false, error: 'Spectators cannot veto' };
      const res = room.game.chancellorVeto(playerId);
      if (!res.success) return res;
      room.touch();
      io.to(room.code).emit('veto-proposed', { state: room.game.getPublicState() });
      broadcastPublicRooms();
      room.handleBotTurns((evt, data) => broadcastRoomUpdate(room, evt, data));
      return { success: true };
    }

    case 'president-veto-response': {
      if (!room.game) return { success: false, error: 'Game not active' };
      if (isSpectator) return { success: false, error: 'Spectators cannot respond to veto' };
      const game = room.game;
      const res = game.presidentVetoResponse(playerId, Boolean(payload.accept));
      if (!res.success) return res;
      room.touch();

      if (res.vetoed) {
        if (res.gameOver) {
          io.to(room.code).emit('game-over', {
            state: game.getPublicState(),
            winner: res.winner,
            winReason: res.winReason,
            roles: game.getAllRoles(),
          });
        } else if (res.chaos) {
          io.to(room.code).emit('policy-enacted', {
            policy: res.policy,
            state: game.getPublicState(),
            vetoed: true,
            chaos: true,
          });
        } else {
          io.to(room.code).emit('veto-accepted', {
            state: game.getPublicState(),
            electionTracker: res.electionTracker,
          });
        }
      } else if (res.vetoRejected) {
        const chan = game.players[game.chancellorIndex!];
        const chanSocketId = room.players.find((p) => p.id === chan.id)?.socketId;
        if (chanSocketId) {
          io.to(chanSocketId).emit('chancellor-cards', {
            cards: game.currentChancellorCards,
            vetoAvailable: false,
          });
        }
        io.to(room.code).emit('veto-rejected', { state: game.getPublicState() });
      }

      broadcastPublicRooms();
      room.handleBotTurns((evt, data) => broadcastRoomUpdate(room, evt, data));
      return { success: true };
    }

    case 'acknowledge-peek': {
      if (!room.game) return { success: false, error: 'Game not active' };
      if (isSpectator) return { success: false, error: 'Spectators cannot perform actions' };
      const res = room.game.acknowledgePeek(playerId);
      if (!res.success) return res;
      room.touch();
      io.to(room.code).emit('state-update', {
        state: room.game.getPublicState(),
      });
      broadcastPublicRooms();
      room.handleBotTurns((evt, data) => broadcastRoomUpdate(room, evt, data));
      return { success: true };
    }

    case 'investigate-player': {
      if (!room.game) return { success: false, error: 'Game not active' };
      if (isSpectator) return { success: false, error: 'Spectators cannot investigate' };
      const res = room.game.investigatePlayer(playerId, payload.targetIndex);
      if (!res.success) return res;
      room.touch();
      saveRoomsToDisk();
      return {
        success: true,
        targetIndex: res.targetIndex,
        party: res.party,
        targetName: res.targetName,
      };
    }

    case 'acknowledge-investigation': {
      if (!room.game) return { success: false, error: 'Game not active' };
      if (isSpectator) return { success: false, error: 'Spectators cannot perform actions' };
      const res = room.game.acknowledgeInvestigation(playerId);
      if (!res.success) return res;
      room.touch();
      io.to(room.code).emit('state-update', {
        state: room.game.getPublicState(),
      });
      broadcastPublicRooms();
      room.handleBotTurns((evt, data) => broadcastRoomUpdate(room, evt, data));
      return { success: true };
    }

    case 'special-election': {
      if (!room.game) return { success: false, error: 'Game not active' };
      if (isSpectator) return { success: false, error: 'Spectators cannot call special elections' };
      const res = room.game.executeSpecialElection(playerId, payload.targetIndex);
      if (!res.success) return res;
      room.touch();
      io.to(room.code).emit('state-update', {
        state: room.game.getPublicState(),
      });
      broadcastPublicRooms();
      room.handleBotTurns((evt, data) => broadcastRoomUpdate(room, evt, data));
      return { success: true };
    }

    case 'execute-player': {
      if (!room.game) return { success: false, error: 'Game not active' };
      if (isSpectator) return { success: false, error: 'Spectators cannot execute players' };
      const game = room.game;
      const res = game.executeKill(playerId, payload.targetIndex);
      if (!res.success) return res;
      room.RecordHitlerCheck(res.hitlerCheck);
      room.touch();

      if (res.gameOver) {
        io.to(room.code).emit('game-over', {
          state: game.getPublicState(),
          winner: res.winner,
          winReason: res.winReason,
          roles: game.getAllRoles(),
          hitlerCheck: res.hitlerCheck,
        });
      } else {
        io.to(room.code).emit('player-executed', {
          killed: res.killed,
          hitlerCheck: res.hitlerCheck,
          state: game.getPublicState(),
        });
        io.to(room.code).emit('state-update', {
          state: game.getPublicState(),
        });
        room.handleBotTurns((evt, data) => broadcastRoomUpdate(room, evt, data));
      }
      broadcastPublicRooms();
      return { success: true };
    }

    case 'restart-game': {
      room.ensureRealPlayerHost();
      if (room.hostId !== playerId) return { success: false, error: 'Only host can restart' };
      room.resetToLobby();
      io.to(room.code).emit('game-reset', {
        players: room.getPlayerList(),
        spectators: room.getSpectatorList(),
        hostId: room.hostId,
      });
      broadcastPublicRooms();
      return { success: true };
    }

    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
}

io.on('connection', (socket: Socket) => {
  // Send active public rooms immediately upon connection
  socket.emit('public-rooms-updated', { rooms: getPublicRoomsList() });

  // CREATE ROOM
  socket.on(
    'create-room',
    ({ playerName, password, isPrivate }: { playerName: string; password?: string; isPrivate?: boolean }, callback) => {
      try {
        const cleanPassword = (password || '').trim();
        if (!cleanPassword || cleanPassword.length < 4 || cleanPassword.length > 64) {
          return callback({ error: 'Password must be between 4 and 64 characters.' });
        }

        const playerId = `usr_${socket.id.substring(0, 6)}_${Date.now().toString(36)}`;
        let room = new Room(playerId, playerName || 'Host', socket.id, undefined, Boolean(isPrivate), cleanPassword);
        while (rooms[room.code]) {
          room = new Room(playerId, playerName || 'Host', socket.id, undefined, Boolean(isPrivate), cleanPassword);
        }
        rooms[room.code] = room;

        socketMap[socket.id] = { roomCode: room.code, playerId, isSpectator: false };
        socket.join(room.code);
        broadcastPublicRooms();

        callback({
          success: true,
          roomCode: room.code,
          liveUrl: `/live/${room.code}`,
          isPrivate: room.isPrivate,
          playerId,
          isHost: true,
          isSpectator: false,
          players: room.getPlayerList(),
          spectators: room.getSpectatorList(),
        });
      } catch (err: any) {
        callback({ error: err.message || 'Failed to create room' });
      }
    }
  );

  // JOIN ROOM
  socket.on(
    'join-room',
    (
      {
        roomCode,
        playerName,
        password,
        playerId: prevPlayerId,
        claimPlayerId,
      }: { roomCode: string; playerName: string; password?: string; playerId?: string; claimPlayerId?: string },
      callback
    ) => {
      try {
        const code = (roomCode || '').toUpperCase().trim();
        const room = getRoomByCode(code);

        if (!room) {
          return callback({ error: `Room "${code}" not found. Check the 4-letter code.` });
        }

        const candidateId =
          prevPlayerId || `usr_${socket.id.substring(0, 6)}_${Date.now().toString(36)}`;
        const result = room.addPlayer(candidateId, playerName, password, socket.id, claimPlayerId);
        if (!result.success) {
          return callback({ error: result.error });
        }

        const finalPlayerId = result.playerId || candidateId;
        const isSpectator = Boolean(result.isSpectator);
        const isHost = Boolean(result.isHost);
        socketMap[socket.id] = { roomCode: code, playerId: finalPlayerId, isSpectator };
        socket.join(code);

        const snapshot = room.getLiveSnapshot(finalPlayerId);
        callback({
          ...snapshot,
          playerId: finalPlayerId,
          isHost,
          isSpectator,
          reconnected: Boolean(result.reconnected),
        });

        if (!result.reconnected) {
          socket.to(code).emit('player-joined', {
            players: room.getPlayerList(),
            spectators: room.getSpectatorList(),
            playerName,
            isSpectator,
          });
        } else {
          socket.to(code).emit('lobby-updated', {
            players: room.getPlayerList(),
            spectators: room.getSpectatorList(),
          });
        }
        broadcastPublicRooms();
      } catch (err: any) {
        callback({ error: err.message || 'Failed to join room' });
      }
    }
  );

  // RECONNECT / BIND SOCKET TO LIVE ROOM
  socket.on(
    'reconnect-room',
    (
      {
        roomCode,
        playerName,
        password,
        playerId: prevPlayerId,
      }: { roomCode: string; playerName: string; password?: string; playerId?: string },
      callback
    ) => {
      const code = (roomCode || '').toUpperCase().trim();
      const room = getRoomByCode(code);
      if (!room) return callback({ error: 'Room not found' });

      const cleanPw = (password || '').trim();

      // Check active players first (require matching prevPlayerId or valid password)
      const player = room.players.find((p) => {
        if (p.isBot) return false;
        if (prevPlayerId && p.id === prevPlayerId && !p.leftWhileRunning) {
          return !p.password || !cleanPw || p.password === cleanPw;
        }
        if (playerName && p.name.toLowerCase() === playerName.toLowerCase()) {
          return !p.password || p.password === cleanPw;
        }
        return false;
      });

      if (player) {
        room.setPlayerSocketId(player.id, socket.id, true);
        socketMap[socket.id] = { roomCode: code, playerId: player.id, isSpectator: false };
        socket.join(code);
        saveRoomsToDisk();

        const snapshot = room.getLiveSnapshot(player.id);
        callback({
          ...snapshot,
          playerId: player.id,
          isHost: room.hostId === player.id,
          isSpectator: false,
          nightInfo: snapshot.privateState?.nightInfo || null,
        });

        if (snapshot.privateState?.presidentCards) {
          socket.emit('president-cards', { cards: snapshot.privateState.presidentCards });
        }
        if (snapshot.privateState?.chancellorCards) {
          socket.emit('chancellor-cards', {
            cards: snapshot.privateState.chancellorCards,
            vetoAvailable: snapshot.privateState.canVeto,
          });
        }
        if (snapshot.privateState?.peekCards) {
          socket.emit('peek-cards', { cards: snapshot.privateState.peekCards });
        }
        return;
      }

      // Check spectators
      const spec = room.spectators.find(
        (s) =>
          (prevPlayerId && s.id === prevPlayerId) ||
          (playerName && s.name.toLowerCase() === playerName.toLowerCase())
      );

      if (spec) {
        room.setPlayerSocketId(spec.id, socket.id, true);
        socketMap[socket.id] = { roomCode: code, playerId: spec.id, isSpectator: true };
        socket.join(code);
        saveRoomsToDisk();

        const snapshot = room.getLiveSnapshot(spec.id);
        callback({
          ...snapshot,
          playerId: spec.id,
          isHost: false,
          isSpectator: true,
          nightInfo: null,
        });
        return;
      }

      return callback({ error: 'Player record not found in room' });
    }
  );

  // Explicit Leave Room
  socket.on('leave-room', (_, callback) => {
    const ctx = getRoomAndPlayer(socket);
    if (!ctx) return callback?.({ success: true });
    const { room, playerId } = ctx;
    socket.leave(room.code);
    delete socketMap[socket.id];
    const res = executeRoomAction(room, playerId, 'leave-room', {});
    callback?.(res);
  });

  // Delegate all other socket events through executeRoomAction
  const socketActions: Array<{ event: string; mapPayload?: (data: any) => any }> = [
    { event: 'add-bot' },
    { event: 'remove-bot' },
    { event: 'remove-player' },
    { event: 'start-game' },
    { event: 'night-complete' },
    { event: 'nominate-chancellor' },
    { event: 'cast-vote' },
    { event: 'president-discard' },
    { event: 'chancellor-discard' },
    { event: 'chancellor-veto' },
    { event: 'president-veto-response' },
    { event: 'acknowledge-peek' },
    { event: 'investigate-player' },
    { event: 'acknowledge-investigation' },
    { event: 'special-election' },
    { event: 'execute-player' },
    { event: 'restart-game' },
  ];

  for (const { event } of socketActions) {
    socket.on(event, (data, callback) => {
      const ctx = getRoomAndPlayer(socket);
      if (!ctx) return callback?.({ error: 'Not in a room' });
      const res = executeRoomAction(ctx.room, ctx.playerId, event, data || {});
      callback?.(res);
    });
  }

  // RUN DEBUGGING AGENTS
  socket.on('run-diagnostics', (_, callback) => {
    const ctx = getRoomAndPlayer(socket);
    const liveState = ctx?.room?.game ? ctx.room.game.getPublicState() : null;
    const results = DebugAgents.runAllDiagnostics(liveState);
    callback({ success: true, results });
  });

  // DISCONNECT — Never delete the room or remove the player on temporary socket disconnect!
  socket.on('disconnect', () => {
    const mapping = socketMap[socket.id];
    if (mapping) {
      const room = getRoomByCode(mapping.roomCode);
      if (room) {
        room.setPlayerSocketId(mapping.playerId, '', false);
        saveRoomsToDisk();
        io.to(room.code).emit('lobby-updated', {
          players: room.getPlayerList(),
          spectators: room.getSpectatorList(),
        });
      }
      delete socketMap[socket.id];
    }
  });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Secret Hitler server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
