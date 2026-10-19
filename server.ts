import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { Room } from './server/Room.js';
import { DebugAgents } from './src/game/DebugAgents.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const rooms: Record<string, Room> = {};
const socketMap: Record<string, { roomCode: string; playerId: string; isSpectator?: boolean }> = {};

function getRoomAndPlayer(socket: Socket): { room: Room; playerId: string; isSpectator: boolean } | null {
  const mapping = socketMap[socket.id];
  if (!mapping) return null;
  const room = rooms[mapping.roomCode];
  if (!room) return null;
  return { room, playerId: mapping.playerId, isSpectator: Boolean(mapping.isSpectator) };
}

function broadcastRoomUpdate(room: Room, event: string, data: any) {
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
}

io.on('connection', (socket: Socket) => {
  // CREATE ROOM
  socket.on('create-room', ({ playerName }: { playerName: string }, callback) => {
    try {
      const playerId = `usr_${socket.id.substring(0, 6)}_${Date.now().toString(36)}`;
      const room = new Room(playerId, playerName || 'Host', socket.id);
      rooms[room.code] = room;

      socketMap[socket.id] = { roomCode: room.code, playerId, isSpectator: false };
      socket.join(room.code);

      callback({
        success: true,
        roomCode: room.code,
        playerId,
        isHost: true,
        isSpectator: false,
        players: room.getPlayerList(),
        spectators: room.getSpectatorList(),
      });
    } catch (err: any) {
      callback({ error: err.message || 'Failed to create room' });
    }
  });

  // JOIN ROOM (Supports active players in lobby OR Spectators if game already started!)
  socket.on(
    'join-room',
    ({ roomCode, playerName }: { roomCode: string; playerName: string }, callback) => {
      try {
        const code = (roomCode || '').toUpperCase().trim();
        const room = rooms[code];

        if (!room) {
          return callback({ error: `Room "${code}" not found. Check the 4-letter code.` });
        }

        const playerId = `usr_${socket.id.substring(0, 6)}_${Date.now().toString(36)}`;
        const result = room.addPlayer(playerId, playerName, socket.id);
        if (!result.success) {
          return callback({ error: result.error });
        }

        const isSpectator = Boolean(result.isSpectator);
        socketMap[socket.id] = { roomCode: code, playerId, isSpectator };
        socket.join(code);

        callback({
          success: true,
          roomCode: code,
          playerId,
          isHost: false,
          isSpectator,
          players: room.getPlayerList(),
          spectators: room.getSpectatorList(),
          gameState: room.game ? room.game.getPublicState() : null,
        });

        socket.to(code).emit('player-joined', {
          players: room.getPlayerList(),
          spectators: room.getSpectatorList(),
          playerName,
          isSpectator,
        });
      } catch (err: any) {
        callback({ error: err.message || 'Failed to join room' });
      }
    }
  );

  // RECONNECT
  socket.on(
    'reconnect-room',
    (
      { roomCode, playerName, playerId: prevPlayerId }: { roomCode: string; playerName: string; playerId?: string },
      callback
    ) => {
      const code = (roomCode || '').toUpperCase().trim();
      const room = rooms[code];
      if (!room) return callback({ error: 'Room not found' });

      // Check active players first
      const player = room.players.find(
        (p) => (prevPlayerId && p.id === prevPlayerId) || p.name.toLowerCase() === playerName.toLowerCase()
      );

      if (player) {
        player.socketId = socket.id;
        room.setPlayerSocketId(player.id, socket.id);
        socketMap[socket.id] = { roomCode: code, playerId: player.id, isSpectator: false };
        socket.join(code);

        const nightInfo = room.game ? room.game.getNightInfoForPlayer(player.id) : null;
        const gameState = room.game ? room.game.getPublicState() : null;

        callback({
          success: true,
          roomCode: code,
          playerId: player.id,
          isHost: room.hostId === player.id,
          isSpectator: false,
          players: room.getPlayerList(),
          spectators: room.getSpectatorList(),
          gameState,
          nightInfo,
        });

        if (room.game) {
          if (
            room.game.phase === 'LEGISLATIVE_PRESIDENT' &&
            room.game.players[room.game.presidentIndex].id === player.id
          ) {
            socket.emit('president-cards', { cards: room.game.currentPresidentCards });
          }
          if (
            room.game.phase === 'LEGISLATIVE_CHANCELLOR' &&
            room.game.players[room.game.chancellorIndex!].id === player.id
          ) {
            socket.emit('chancellor-cards', {
              cards: room.game.currentChancellorCards,
              vetoAvailable: room.game.fascistPolicies >= 5 && !room.game.vetoUsedThisRound,
            });
          }
          if (
            room.game.phase === 'EXECUTIVE_ACTION' &&
            room.game.executiveAction === 'PEEK' &&
            room.game.players[room.game.presidentIndex].id === player.id
          ) {
            const peek = room.game.getPeekCards(player.id);
            if (peek.cards) socket.emit('peek-cards', { cards: peek.cards });
          }
        }
        return;
      }

      // Check spectators
      const spec = room.spectators.find(
        (s) => (prevPlayerId && s.id === prevPlayerId) || s.name.toLowerCase() === playerName.toLowerCase()
      );

      if (spec) {
        spec.socketId = socket.id;
        room.setPlayerSocketId(spec.id, socket.id);
        socketMap[socket.id] = { roomCode: code, playerId: spec.id, isSpectator: true };
        socket.join(code);

        callback({
          success: true,
          roomCode: code,
          playerId: spec.id,
          isHost: false,
          isSpectator: true,
          players: room.getPlayerList(),
          spectators: room.getSpectatorList(),
          gameState: room.game ? room.game.getPublicState() : null,
          nightInfo: null,
        });
        return;
      }

      return callback({ error: 'Player record not found in room' });
    }
  );

  // ADD BOT
  socket.on('add-bot', (_, callback) => {
    const ctx = getRoomAndPlayer(socket);
    if (!ctx) return callback({ error: 'Not in a room' });
    const { room, playerId } = ctx;
    if (room.hostId !== playerId) return callback({ error: 'Only host can add bots' });

    const res = room.addBot();
    if (!res.success) return callback({ error: res.error });

    io.to(room.code).emit('lobby-updated', {
      players: room.getPlayerList(),
      spectators: room.getSpectatorList(),
    });
    callback({ success: true, bot: res.bot });
  });

  // REMOVE BOT
  socket.on('remove-bot', ({ botId }: { botId: string }, callback) => {
    const ctx = getRoomAndPlayer(socket);
    if (!ctx) return callback({ error: 'Not in a room' });
    const { room, playerId } = ctx;
    if (room.hostId !== playerId) return callback({ error: 'Only host can remove bots' });

    const ok = room.removeBot(botId);
    if (ok) {
      io.to(room.code).emit('lobby-updated', {
        players: room.getPlayerList(),
        spectators: room.getSpectatorList(),
      });
      callback({ success: true });
    } else {
      callback({ error: 'Bot not found' });
    }
  });

  // START GAME
  socket.on('start-game', (_, callback) => {
    const ctx = getRoomAndPlayer(socket);
    if (!ctx) return callback({ error: 'Not in a room' });
    const { room, playerId } = ctx;
    if (room.hostId !== playerId) return callback({ error: 'Only host can start the game' });

    const res = room.startGame();
    if (!res.success) return callback({ error: res.error });

    const pubState = room.game!.getPublicState();

    // Send private night info to each active human player
    for (const p of room.players) {
      if (!p.isBot && p.socketId) {
        const info = res.nightInfo ? res.nightInfo[p.id] : null;
        io.to(p.socketId).emit('game-started', {
          nightInfo: info,
          state: pubState,
        });
      }
    }

    // Send public state to spectators
    for (const s of room.spectators) {
      if (s.socketId) {
        io.to(s.socketId).emit('game-started', {
          nightInfo: null,
          state: pubState,
          isSpectator: true,
        });
      }
    }

    const hostNightInfo = res.nightInfo ? res.nightInfo[playerId] : null;
    callback({ success: true, nightInfo: hostNightInfo, state: pubState });
  });

  // NIGHT COMPLETE / READY
  socket.on('night-complete', (_, callback) => {
    const ctx = getRoomAndPlayer(socket);
    if (!ctx || !ctx.room.game) return callback({ error: 'Game not active' });
    if (ctx.isSpectator) return callback({ error: 'Spectators cannot perform game actions' });
    const { room } = ctx;

    if (room.game.phase === 'NIGHT') {
      room.game.advanceToNomination();
      io.to(room.code).emit('state-update', {
        state: room.game.getPublicState(),
      });
      room.handleBotTurns((evt, data) => broadcastRoomUpdate(room, evt, data));
    }

    callback({ success: true });
  });

  // NOMINATE CHANCELLOR
  socket.on('nominate-chancellor', ({ chancellorIndex }: { chancellorIndex: number }, callback) => {
    const ctx = getRoomAndPlayer(socket);
    if (!ctx || !ctx.room.game) return callback({ error: 'Game not active' });
    if (ctx.isSpectator) return callback({ error: 'Spectators cannot nominate' });
    const { room, playerId } = ctx;
    const game = room.game;

    if (game.players[game.presidentIndex].id !== playerId) {
      return callback({ error: 'Only the sitting President can nominate a Chancellor' });
    }

    const res = game.nominateChancellor(chancellorIndex);
    if (!res.success) return callback({ error: res.error });

    io.to(room.code).emit('state-update', {
      state: game.getPublicState(),
    });

    callback({ success: true });
    room.handleBotTurns((evt, data) => broadcastRoomUpdate(room, evt, data));
  });

  // CAST VOTE
  socket.on('cast-vote', ({ vote }: { vote: 'JA' | 'NEIN' }, callback) => {
    const ctx = getRoomAndPlayer(socket);
    if (!ctx || !ctx.room.game) return callback({ error: 'Game not active' });
    if (ctx.isSpectator) return callback({ error: 'Spectators cannot vote' });
    const { room, playerId } = ctx;
    const game = room.game;

    const res = game.castVote(playerId, vote);
    if (!res.success) return callback({ error: res.error });

    if (res.waiting) {
      io.to(room.code).emit('vote-progress', {
        votesIn: res.votesIn,
        votesNeeded: res.votesNeeded,
        state: game.getPublicState(),
      });
      callback({ success: true, waiting: true });
      return;
    }

    callback({ success: true });

    if (res.gameOver) {
      io.to(room.code).emit('game-over', {
        state: game.getPublicState(),
        winner: res.winner,
        winReason: res.winReason,
        roles: game.getAllRoles(),
      });
      return;
    }

    if (res.chaos) {
      io.to(room.code).emit('election-result', {
        passed: false,
        votes: res.votes,
        chaos: true,
        chaosPolicy: res.chaosPolicy,
        state: game.getPublicState(),
      });
      room.handleBotTurns((evt, data) => broadcastRoomUpdate(room, evt, data));
      return;
    }

    io.to(room.code).emit('election-result', {
      passed: res.passed,
      votes: res.votes,
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

    room.handleBotTurns((evt, data) => broadcastRoomUpdate(room, evt, data));
  });

  // PRESIDENT DISCARD
  socket.on('president-discard', ({ cardIndex }: { cardIndex: number }, callback) => {
    const ctx = getRoomAndPlayer(socket);
    if (!ctx || !ctx.room.game) return callback({ error: 'Game not active' });
    if (ctx.isSpectator) return callback({ error: 'Spectators cannot discard' });
    const { room, playerId } = ctx;
    const game = room.game;

    const res = game.presidentDiscard(playerId, cardIndex);
    if (!res.success) return callback({ error: res.error });

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

    callback({ success: true });
    room.handleBotTurns((evt, data) => broadcastRoomUpdate(room, evt, data));
  });

  // CHANCELLOR DISCARD (ENACT)
  socket.on('chancellor-discard', ({ cardIndex }: { cardIndex: number }, callback) => {
    const ctx = getRoomAndPlayer(socket);
    if (!ctx || !ctx.room.game) return callback({ error: 'Game not active' });
    if (ctx.isSpectator) return callback({ error: 'Spectators cannot enact policies' });
    const { room, playerId } = ctx;
    const game = room.game;

    const res = game.chancellorDiscard(playerId, cardIndex);
    if (!res.success) return callback({ error: res.error });

    callback({ success: true });

    if (res.gameOver) {
      io.to(room.code).emit('game-over', {
        state: game.getPublicState(),
        winner: res.winner,
        winReason: res.winReason,
        roles: game.getAllRoles(),
      });
      return;
    }

    io.to(room.code).emit('policy-enacted', {
      policy: res.policy,
      state: game.getPublicState(),
      executiveAction: res.executiveAction,
    });

    if (res.executiveAction === 'PEEK') {
      const pres = game.players[game.presidentIndex];
      const presSocketId = room.players.find((p) => p.id === pres.id)?.socketId;
      if (presSocketId) {
        const peek = game.getPeekCards(pres.id);
        io.to(presSocketId).emit('peek-cards', { cards: peek.cards });
      }
    }

    room.handleBotTurns((evt, data) => broadcastRoomUpdate(room, evt, data));
  });

  // CHANCELLOR VETO
  socket.on('chancellor-veto', (_, callback) => {
    const ctx = getRoomAndPlayer(socket);
    if (!ctx || !ctx.room.game) return callback({ error: 'Game not active' });
    if (ctx.isSpectator) return callback({ error: 'Spectators cannot veto' });
    const { room, playerId } = ctx;
    const game = room.game;

    const res = game.chancellorVeto(playerId);
    if (!res.success) return callback({ error: res.error });

    io.to(room.code).emit('veto-proposed', { state: game.getPublicState() });
    callback({ success: true });
    room.handleBotTurns((evt, data) => broadcastRoomUpdate(room, evt, data));
  });

  // PRESIDENT VETO RESPONSE
  socket.on('president-veto-response', ({ accept }: { accept: boolean }, callback) => {
    const ctx = getRoomAndPlayer(socket);
    if (!ctx || !ctx.room.game) return callback({ error: 'Game not active' });
    if (ctx.isSpectator) return callback({ error: 'Spectators cannot respond to veto' });
    const { room, playerId } = ctx;
    const game = room.game;

    const res = game.presidentVetoResponse(playerId, accept);
    if (!res.success) return callback({ error: res.error });

    callback({ success: true });

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

    room.handleBotTurns((evt, data) => broadcastRoomUpdate(room, evt, data));
  });

  // PEEK ACKNOWLEDGE
  socket.on('acknowledge-peek', (_, callback) => {
    const ctx = getRoomAndPlayer(socket);
    if (!ctx || !ctx.room.game) return callback({ error: 'Game not active' });
    if (ctx.isSpectator) return callback({ error: 'Spectators cannot perform actions' });
    const { room, playerId } = ctx;

    const res = room.game.acknowledgePeek(playerId);
    if (!res.success) return callback({ error: res.error });

    io.to(room.code).emit('state-update', {
      state: room.game.getPublicState(),
    });

    callback({ success: true });
    room.handleBotTurns((evt, data) => broadcastRoomUpdate(room, evt, data));
  });

  // INVESTIGATE PLAYER
  socket.on('investigate-player', ({ targetIndex }: { targetIndex: number }, callback) => {
    const ctx = getRoomAndPlayer(socket);
    if (!ctx || !ctx.room.game) return callback({ error: 'Game not active' });
    if (ctx.isSpectator) return callback({ error: 'Spectators cannot investigate' });
    const { room, playerId } = ctx;

    const res = room.game.investigatePlayer(playerId, targetIndex);
    if (!res.success) return callback({ error: res.error });

    callback({
      success: true,
      targetIndex: res.targetIndex,
      party: res.party,
      targetName: res.targetName,
    });
  });

  // INVESTIGATION ACKNOWLEDGE
  socket.on('acknowledge-investigation', (_, callback) => {
    const ctx = getRoomAndPlayer(socket);
    if (!ctx || !ctx.room.game) return callback({ error: 'Game not active' });
    if (ctx.isSpectator) return callback({ error: 'Spectators cannot perform actions' });
    const { room, playerId } = ctx;

    const res = room.game.acknowledgeInvestigation(playerId);
    if (!res.success) return callback({ error: res.error });

    io.to(room.code).emit('state-update', {
      state: room.game.getPublicState(),
    });

    callback({ success: true });
    room.handleBotTurns((evt, data) => broadcastRoomUpdate(room, evt, data));
  });

  // SPECIAL ELECTION
  socket.on('special-election', ({ targetIndex }: { targetIndex: number }, callback) => {
    const ctx = getRoomAndPlayer(socket);
    if (!ctx || !ctx.room.game) return callback({ error: 'Game not active' });
    if (ctx.isSpectator) return callback({ error: 'Spectators cannot call special elections' });
    const { room, playerId } = ctx;

    const res = room.game.executeSpecialElection(playerId, targetIndex);
    if (!res.success) return callback({ error: res.error });

    io.to(room.code).emit('state-update', {
      state: room.game.getPublicState(),
    });

    callback({ success: true });
    room.handleBotTurns((evt, data) => broadcastRoomUpdate(room, evt, data));
  });

  // EXECUTE KILL
  socket.on('execute-player', ({ targetIndex }: { targetIndex: number }, callback) => {
    const ctx = getRoomAndPlayer(socket);
    if (!ctx || !ctx.room.game) return callback({ error: 'Game not active' });
    if (ctx.isSpectator) return callback({ error: 'Spectators cannot execute players' });
    const { room, playerId } = ctx;
    const game = room.game;

    const res = game.executeKill(playerId, targetIndex);
    if (!res.success) return callback({ error: res.error });

    callback({ success: true });

    if (res.gameOver) {
      io.to(room.code).emit('game-over', {
        state: game.getPublicState(),
        winner: res.winner,
        winReason: res.winReason,
        roles: game.getAllRoles(),
      });
    } else {
      io.to(room.code).emit('player-executed', {
        killed: res.killed,
        state: game.getPublicState(),
      });
      io.to(room.code).emit('state-update', {
        state: game.getPublicState(),
      });
      room.handleBotTurns((evt, data) => broadcastRoomUpdate(room, evt, data));
    }
  });

  // RUN DEBUGGING AGENTS
  socket.on('run-diagnostics', (_, callback) => {
    const ctx = getRoomAndPlayer(socket);
    const liveState = ctx?.room?.game ? ctx.room.game.getPublicState() : null;
    const results = DebugAgents.runAllDiagnostics(liveState);
    callback({ success: true, results });
  });

  // RESTART GAME IN SAME ROOM
  socket.on('restart-game', (_, callback) => {
    const ctx = getRoomAndPlayer(socket);
    if (!ctx) return callback({ error: 'Not in a room' });
    const { room, playerId } = ctx;
    if (room.hostId !== playerId) return callback({ error: 'Only host can restart' });

    room.started = false;
    room.game = null;

    io.to(room.code).emit('game-reset', {
      players: room.getPlayerList(),
      spectators: room.getSpectatorList(),
    });

    callback({ success: true });
  });

  // DISCONNECT
  socket.on('disconnect', () => {
    const mapping = socketMap[socket.id];
    if (mapping) {
      const room = rooms[mapping.roomCode];
      if (room) {
        if (!room.started || mapping.isSpectator) {
          const { remaining } = room.removePlayer(mapping.playerId);
          if (remaining === 0 && room.spectators.length === 0) {
            delete rooms[mapping.roomCode];
          } else {
            io.to(room.code).emit('lobby-updated', {
              players: room.getPlayerList(),
              spectators: room.getSpectatorList(),
            });
          }
        } else {
          io.to(room.code).emit('player-disconnected', {
            playerId: mapping.playerId,
          });
        }
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
