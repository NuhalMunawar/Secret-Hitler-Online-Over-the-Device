import { GameEngine } from '../src/game/GameEngine.js';
import { HitlerSuspenseCheck, NightInfo, Vote } from '../src/game/types.js';

export interface RoomPlayer {
  id: string;
  name: string;
  socketId: string;
  password?: string;
  isBot?: boolean;
  connected?: boolean;
  leftWhileRunning?: boolean;
}

export interface RoomSpectator {
  id: string;
  name: string;
  socketId: string;
  connected?: boolean;
}

export class Room {
  code: string;
  hostId: string;
  players: RoomPlayer[] = [];
  spectators: RoomSpectator[] = [];
  game: GameEngine | null = null;
  started = false;
  isPrivate = false;
  createdAt: number;
  updatedAt: number;
  revision = 1;
  lastHitlerCheck: { id: string; check: HitlerSuspenseCheck } | null = null;

  constructor(
    hostId: string,
    hostName: string,
    socketId?: string,
    existingCode?: string,
    isPrivate = false,
    hostPassword?: string
  ) {
    this.code = existingCode || this.generateCode();
    this.hostId = hostId;
    this.isPrivate = Boolean(isPrivate);
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    if (hostId) {
      this.players.push({
        id: hostId,
        name: hostName.trim() || 'Player 1',
        socketId: socketId || hostId,
        password: (hostPassword || '').trim() || undefined,
        connected: true,
      });
    }
  }

  touch() {
    this.updatedAt = Date.now();
    this.revision++;
  }

  RecordHitlerCheck(check?: HitlerSuspenseCheck) {
    if (check) {
      this.lastHitlerCheck = {
        id: `hc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        check,
      };
    }
  }

  generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  isGameRunning(): boolean {
    return Boolean(
      this.started &&
        this.game &&
        this.game.phase !== 'LOBBY' &&
        this.game.phase !== 'GAME_OVER'
    );
  }

  isGameEnded(): boolean {
    return Boolean(this.started && this.game && this.game.phase === 'GAME_OVER');
  }

  ensureRealPlayerHost() {
    const currentHost = this.players.find((p) => p.id === this.hostId);
    if (!currentHost || currentHost.isBot || currentHost.leftWhileRunning) {
      const nextReal =
        this.players.find((p) => !p.isBot && !p.leftWhileRunning && p.connected !== false) ||
        this.players.find((p) => !p.isBot && !p.leftWhileRunning) ||
        this.players.find((p) => !p.isBot);
      this.hostId = nextReal ? nextReal.id : '';
    }
  }

  setPlayerSocketId(playerId: string, socketId: string, connected = true) {
    const player = this.players.find((p) => p.id === playerId);
    if (player) {
      if (socketId) player.socketId = socketId;
      player.connected = connected;
      if (connected) {
        player.leftWhileRunning = false;
      }
    }
    const spec = this.spectators.find((s) => s.id === playerId);
    if (spec) {
      if (socketId) spec.socketId = socketId;
      spec.connected = connected;
    }
    this.touch();
  }

  getPlayerList() {
    return this.players.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: !p.isBot && p.id === this.hostId,
      isBot: p.isBot || false,
      connected: p.isBot ? true : p.connected !== false,
    }));
  }

  getSpectatorList() {
    return this.spectators.map((s) => ({
      id: s.id,
      name: s.name,
    }));
  }

  addPlayer(
    id: string,
    name: string,
    password?: string,
    socketId?: string,
    claimPlayerId?: string
  ): {
    success: boolean;
    playerId?: string;
    isHost?: boolean;
    isSpectator?: boolean;
    reconnected?: boolean;
    error?: string;
  } {
    const cleanPassword = (password || '').trim();

    // 1. Check if claiming an explicit player seat by ID
    if (claimPlayerId) {
      const target = this.players.find((p) => p.id === claimPlayerId && !p.isBot);
      if (target) {
        if (target.password && target.password !== cleanPassword) {
          return {
            success: false,
            error: 'Incorrect password for this player seat. Enter the password created for this seat to sync.',
          };
        }
        if (!target.password && cleanPassword && cleanPassword.length >= 4 && cleanPassword.length <= 64) {
          target.password = cleanPassword;
        }
        if (socketId) target.socketId = socketId;
        target.connected = true;
        target.leftWhileRunning = false;
        this.spectators = this.spectators.filter((s) => s.id !== id && s.id !== target.id);
        this.ensureRealPlayerHost();
        this.touch();
        return {
          success: true,
          playerId: target.id,
          isHost: target.id === this.hostId,
          isSpectator: false,
          reconnected: true,
        };
      }
    }

    const cleanName = (name || '').trim();
    if (!cleanName) {
      return { success: false, error: 'Please enter your name' };
    }

    // 2. If a human player with this exact name (or ID) is already seated in the room,
    // verify password and seamlessly reconnect/sync them to their seat!
    const existingHuman =
      this.players.find(
        (p) => !p.isBot && p.name.toLowerCase() === cleanName.toLowerCase()
      ) ||
      this.players.find((p) => !p.isBot && p.id === id);
    if (existingHuman) {
      if (existingHuman.password && existingHuman.password !== cleanPassword) {
        return {
          success: false,
          error: `Incorrect password for player "${existingHuman.name}". Enter the password created for this seat to sync.`,
        };
      }
      if (!existingHuman.password && cleanPassword && cleanPassword.length >= 4 && cleanPassword.length <= 64) {
        existingHuman.password = cleanPassword;
      }
      if (socketId) existingHuman.socketId = socketId;
      existingHuman.connected = true;
      existingHuman.leftWhileRunning = false;
      this.spectators = this.spectators.filter((s) => s.id !== id && s.id !== existingHuman.id);
      this.ensureRealPlayerHost();
      this.touch();
      return {
        success: true,
        playerId: existingHuman.id,
        isHost: existingHuman.id === this.hostId,
        isSpectator: false,
        reconnected: true,
      };
    }

    // 3. Check if already in spectators with same name/id
    const existingSpec = this.spectators.find(
      (s) => s.id === id || s.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (existingSpec && this.started) {
      if (socketId) existingSpec.socketId = socketId;
      existingSpec.connected = true;
      this.touch();
      return {
        success: true,
        playerId: existingSpec.id,
        isHost: false,
        isSpectator: true,
        reconnected: true,
      };
    }

    // 4. If game is already in progress, join as Spectator!
    if (this.started) {
      let finalName = cleanName;
      if (
        this.players.some((p) => p.name.toLowerCase() === finalName.toLowerCase()) ||
        this.spectators.some((s) => s.name.toLowerCase() === finalName.toLowerCase())
      ) {
        finalName = `${cleanName} (Spec)`;
      }
      this.spectators.push({
        id,
        name: finalName,
        socketId: socketId || id,
        connected: true,
      });
      this.touch();
      return { success: true, playerId: id, isHost: false, isSpectator: true };
    }

    if (this.players.length >= 10) {
      this.spectators.push({
        id,
        name: cleanName,
        socketId: socketId || id,
        connected: true,
      });
      this.touch();
      return { success: true, playerId: id, isHost: false, isSpectator: true };
    }

    // Check if a bot has the same name; if so, rename the bot or append number
    if (this.players.some((p) => p.isBot && p.name.toLowerCase() === cleanName.toLowerCase())) {
      const botMatch = this.players.find(
        (p) => p.isBot && p.name.toLowerCase() === cleanName.toLowerCase()
      );
      if (botMatch) {
        botMatch.name = `${botMatch.name} (Bot)`;
      }
    }

    const finalPassword =
      cleanPassword || (password === undefined ? `pw_${id.replace(/[^a-zA-Z0-9]/g, '')}`.padEnd(6, '0').substring(0, 16) : '');

    if (!finalPassword || finalPassword.length < 4 || finalPassword.length > 64) {
      return {
        success: false,
        error: 'Please enter a recovery password between 4 and 64 characters.',
      };
    }

    this.players.push({
      id,
      name: cleanName,
      socketId: socketId || id,
      password: finalPassword,
      connected: true,
    });
    this.touch();

    return { success: true, playerId: id, isHost: id === this.hostId, isSpectator: false };
  }

  addBot(): { success: boolean; bot?: RoomPlayer; error?: string } {
    if (this.started) return { success: false, error: 'Game already started' };
    if (this.players.length >= 10) return { success: false, error: 'Room is full (max 10)' };

    const botNames = [
      'Alex',
      'Sam',
      'Jordan',
      'Morgan',
      'Taylor',
      'Casey',
      'Riley',
      'Quinn',
      'Avery',
      'Robin',
    ];
    const available = botNames.filter(
      (n) => !this.players.some((p) => p.name.toLowerCase() === n.toLowerCase())
    );
    const chosenName = available.length > 0 ? available[0] : `Bot ${this.players.length + 1}`;
    const botId = `bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const bot: RoomPlayer = {
      id: botId,
      name: chosenName,
      socketId: botId,
      isBot: true,
      connected: true,
    };
    this.players.push(bot);
    this.touch();
    return { success: true, bot };
  }

  removeBot(botId: string): boolean {
    const idx = this.players.findIndex((p) => p.id === botId && p.isBot);
    if (idx !== -1) {
      this.players.splice(idx, 1);
      this.touch();
      return true;
    }
    return false;
  }

  kickPlayer(
    hostId: string,
    targetPlayerId: string
  ): {
    success: boolean;
    removedPlayer?: {
      id: string;
      name: string;
      socketId: string;
      isBot?: boolean;
      isSpectator?: boolean;
    };
    error?: string;
  } {
    if (this.hostId !== hostId) {
      return { success: false, error: 'Only the room host can remove players' };
    }
    if (this.started) {
      return { success: false, error: 'Cannot remove players after the game has started' };
    }
    if (targetPlayerId === this.hostId) {
      return { success: false, error: 'Host cannot remove themselves' };
    }

    const playerIdx = this.players.findIndex((p) => p.id === targetPlayerId);
    if (playerIdx !== -1) {
      const [removed] = this.players.splice(playerIdx, 1);
      this.touch();
      return {
        success: true,
        removedPlayer: {
          id: removed.id,
          name: removed.name,
          socketId: removed.socketId,
          isBot: removed.isBot,
          isSpectator: false,
        },
      };
    }

    const specIdx = this.spectators.findIndex((s) => s.id === targetPlayerId);
    if (specIdx !== -1) {
      const [removedSpec] = this.spectators.splice(specIdx, 1);
      this.touch();
      return {
        success: true,
        removedPlayer: {
          id: removedSpec.id,
          name: removedSpec.name,
          socketId: removedSpec.socketId,
          isBot: false,
          isSpectator: true,
        },
      };
    }

    return { success: false, error: 'Player not found in room' };
  }

  removePlayer(id: string): {
    remaining: number;
    remainingRealPlayers: number;
    wasHost: boolean;
    wasSpectator: boolean;
    shouldCloseRoom: boolean;
    newHostId: string;
  } {
    const specIdx = this.spectators.findIndex((s) => s.id === id);
    if (specIdx !== -1) {
      this.spectators.splice(specIdx, 1);
      const realPlayers = this.players.filter((p) => !p.isBot && !p.leftWhileRunning);
      const shouldCloseRoom = !this.isGameRunning() && realPlayers.length === 0;
      this.touch();
      return {
        remaining: realPlayers.length,
        remainingRealPlayers: realPlayers.length,
        wasHost: false,
        wasSpectator: true,
        shouldCloseRoom,
        newHostId: this.hostId,
      };
    }

    const idx = this.players.findIndex((p) => p.id === id);
    if (idx === -1) {
      const realPlayers = this.players.filter((p) => !p.isBot && !p.leftWhileRunning);
      const shouldCloseRoom = !this.isGameRunning() && realPlayers.length === 0;
      return {
        remaining: realPlayers.length,
        remainingRealPlayers: realPlayers.length,
        wasHost: false,
        wasSpectator: false,
        shouldCloseRoom,
        newHostId: this.hostId,
      };
    }

    const targetPlayer = this.players[idx];
    const wasHost = targetPlayer.id === this.hostId;

    // While the game is running, keep the player's name and seat on the game
    // so they can sync with their name and password to reclaim their seat.
    if (this.isGameRunning()) {
      targetPlayer.connected = false;
      targetPlayer.socketId = '';
      targetPlayer.leftWhileRunning = true;

      if (wasHost) {
        const activeReal =
          this.players.find((p) => !p.isBot && !p.leftWhileRunning && p.connected !== false) ||
          this.players.find((p) => !p.isBot && !p.leftWhileRunning);
        if (activeReal) {
          this.hostId = activeReal.id;
        }
        // Note: if no other active real player is currently in the room during the running game,
        // keep this real player as hostId (bots will never be hosts) so they remain host when syncing back.
      }

      const allRealPlayers = this.players.filter((p) => !p.isBot);
      this.touch();
      return {
        remaining: this.players.length,
        remainingRealPlayers: allRealPlayers.length,
        wasHost,
        wasSpectator: false,
        shouldCloseRoom: false,
        newHostId: this.hostId,
      };
    }

    // Game has ended (GAME_OVER) or room is in LOBBY:
    // Remove the leaving player and any other players who left while the game was running and never returned.
    this.players.splice(idx, 1);
    this.players = this.players.filter((p) => !p.leftWhileRunning);

    const remainingReal = this.players.filter((p) => !p.isBot);

    if (remainingReal.length === 0) {
      // Bots will never be hosts; if no real player is remaining, the room will be closed.
      this.hostId = '';
      this.touch();
      return {
        remaining: 0,
        remainingRealPlayers: 0,
        wasHost,
        wasSpectator: false,
        shouldCloseRoom: true,
        newHostId: '',
      };
    }

    if (wasHost || !remainingReal.some((p) => p.id === this.hostId)) {
      const nextHost = remainingReal.find((p) => p.connected !== false) || remainingReal[0];
      this.hostId = nextHost.id;
    }

    this.touch();
    return {
      remaining: remainingReal.length,
      remainingRealPlayers: remainingReal.length,
      wasHost,
      wasSpectator: false,
      shouldCloseRoom: false,
      newHostId: this.hostId,
    };
  }

  resetToLobby() {
    this.started = false;
    this.game = null;
    this.lastHitlerCheck = null;
    this.players = this.players.filter((p) => !p.leftWhileRunning);
    this.ensureRealPlayerHost();
    this.touch();
  }

  startGame(): { success: boolean; error?: string; nightInfo?: Record<string, NightInfo> } {
    if (this.players.length < 5) {
      return {
        success: false,
        error: `Need at least 5 players to start (currently ${this.players.length})`,
      };
    }
    if (this.players.length > 10) {
      return { success: false, error: 'Maximum 10 players allowed' };
    }

    this.game = new GameEngine(
      this.players.map((p) => ({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
      }))
    );

    const res = this.game.startGame();
    if (!res.success) return res;

    this.started = true;
    this.lastHitlerCheck = null;
    this.touch();

    const nightInfo: Record<string, NightInfo> = {};
    for (const p of this.players) {
      const info = this.game.getNightInfoForPlayer(p.id);
      if (info) nightInfo[p.id] = info;
    }

    return { success: true, nightInfo };
  }

  getSummary() {
    this.ensureRealPlayerHost();
    const hostPlayer =
      this.players.find((p) => p.id === this.hostId && !p.isBot) ||
      this.players.find((p) => !p.isBot);
    return {
      roomCode: this.code,
      hostName: hostPlayer ? hostPlayer.name : 'Host',
      playerCount: this.players.length,
      humanCount: this.players.filter((p) => !p.isBot).length,
      botCount: this.players.filter((p) => p.isBot).length,
      spectatorCount: this.spectators.length,
      started: this.started,
      isPrivate: this.isPrivate,
      phase: this.game ? this.game.phase : 'LOBBY',
      roundNumber: this.game ? this.game.roundNumber : 0,
      liberalPolicies: this.game ? this.game.liberalPolicies : 0,
      fascistPolicies: this.game ? this.game.fascistPolicies : 0,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      revision: this.revision,
      liveUrl: `/live/${this.code}`,
      players: this.getPlayerList(),
    };
  }

  getPublicGameState() {
    if (!this.game) return null;
    const state = this.game.getPublicState();
    state.players = state.players.map((p) => ({
      ...p,
      isHost: !p.isBot && p.id === this.hostId,
    }));
    return state;
  }

  getLiveSnapshot(forPlayerId?: string) {
    this.ensureRealPlayerHost();
    const publicState = this.getPublicGameState();
    const isPlayer = forPlayerId ? this.players.some((p) => p.id === forPlayerId) : false;
    const isSpec = forPlayerId ? this.spectators.some((s) => s.id === forPlayerId) : false;

    let nightInfo: NightInfo | null = null;
    let presidentCards = null;
    let chancellorCards = null;
    let canVeto = false;
    let peekCards = null;
    let investigationResult = null;

    if (this.game && forPlayerId && isPlayer) {
      nightInfo = this.game.getNightInfoForPlayer(forPlayerId);
      const currentPres = this.game.players[this.game.presidentIndex];
      const currentChan =
        this.game.chancellorIndex !== null
          ? this.game.players[this.game.chancellorIndex]
          : null;

      if (this.game.phase === 'LEGISLATIVE_PRESIDENT' && currentPres?.id === forPlayerId) {
        presidentCards = [...this.game.currentPresidentCards];
      }
      if (this.game.phase === 'LEGISLATIVE_CHANCELLOR' && currentChan?.id === forPlayerId) {
        chancellorCards = [...this.game.currentChancellorCards];
        canVeto = this.game.fascistPolicies >= 5 && !this.game.vetoUsedThisRound;
      }
      if (
        this.game.phase === 'EXECUTIVE_ACTION' &&
        this.game.executiveAction === 'PEEK' &&
        currentPres?.id === forPlayerId
      ) {
        const peek = this.game.getPeekCards(forPlayerId);
        if (peek.cards) peekCards = peek.cards;
      }
      if (
        this.game.phase === 'EXECUTIVE_ACTION' &&
        this.game.executiveAction === 'INVESTIGATE' &&
        currentPres?.id === forPlayerId &&
        this.game.lastInvestigationResult
      ) {
        investigationResult = this.game.lastInvestigationResult;
      }
    }

    let voteProgress: { votesIn: number; votesNeeded: number } | null = null;
    if (this.game && this.game.phase === 'VOTING') {
      const aliveCount = this.game.players.filter((p) => p.isAlive).length;
      const votesIn = Object.keys(this.game.votes).length;
      voteProgress = { votesIn, votesNeeded: aliveCount };
    }

    let gameOverData = null;
    if (this.game && this.game.phase === 'GAME_OVER' && this.game.winner) {
      gameOverData = {
        winner: this.game.winner,
        winReason: this.game.winReason || '',
        roles: this.game.getAllRoles(),
      };
    }

    let lastElectionVotes = null;
    if (this.game && Object.keys(this.game.lastRevealedVotes).length > 0) {
      lastElectionVotes = {
        votes: { ...this.game.lastRevealedVotes },
        passed: Boolean(this.game.lastVotePassed),
      };
    }

    return {
      success: true,
      roomCode: this.code,
      liveUrl: `/live/${this.code}`,
      revision: this.revision,
      updatedAt: this.updatedAt,
      started: this.started,
      isPrivate: this.isPrivate,
      hostId: this.hostId,
      isHost: Boolean(forPlayerId && forPlayerId === this.hostId),
      isSpectator: isSpec,
      isSeatedPlayer: isPlayer,
      players: this.getPlayerList(),
      spectators: this.getSpectatorList(),
      gameState: publicState,
      voteProgress,
      lastElectionVotes,
      lastHitlerCheck: this.lastHitlerCheck,
      gameOverData,
      privateState: forPlayerId
        ? {
            playerId: forPlayerId,
            nightInfo,
            presidentCards,
            chancellorCards,
            canVeto,
            peekCards,
            investigationResult,
          }
        : null,
    };
  }

  handleBotTurns(onUpdate: (event: string, data: any) => void) {
    if (!this.game || !this.started) return;

    const game = this.game;

    // BOT VOTING
    if (game.phase === 'VOTING') {
      const alivePlayers = game.players.filter((p) => p.isAlive);
      const pendingBots = alivePlayers.filter((p) => p.isBot && !game.votes[p.id]);

      if (pendingBots.length > 0) {
        setTimeout(() => {
          if (!this.game || this.game.phase !== 'VOTING') return;
          for (const bot of pendingBots) {
            const vote: Vote = Math.random() < 0.7 ? 'JA' : 'NEIN';
            const result = this.game.castVote(bot.id, vote);
            this.touch();
            if (!result.waiting) {
              this.notifyElectionResolution(result, onUpdate);
              break;
            } else {
              onUpdate('vote-progress', {
                votesIn: result.votesIn,
                votesNeeded: result.votesNeeded,
                state: this.game.getPublicState(),
              });
            }
          }
        }, 850);
      }
    }

    // BOT NOMINATION
    else if (game.phase === 'NOMINATION') {
      const currentPres = game.players[game.presidentIndex];
      if (currentPres && currentPres.isBot && currentPres.isAlive) {
        setTimeout(() => {
          if (!this.game || this.game.phase !== 'NOMINATION') return;
          const eligible = this.game.getEligibleChancellors();
          if (eligible.length > 0) {
            const picked = eligible[Math.floor(Math.random() * eligible.length)];
            this.game.nominateChancellor(picked);
            this.touch();
            onUpdate('state-update', {
              state: this.game.getPublicState(),
            });
            this.handleBotTurns(onUpdate);
          }
        }, 1000);
      }
    }

    // BOT PRESIDENT DISCARD
    else if (game.phase === 'LEGISLATIVE_PRESIDENT') {
      const currentPres = game.players[game.presidentIndex];
      if (currentPres && currentPres.isBot) {
        setTimeout(() => {
          if (!this.game || this.game.phase !== 'LEGISLATIVE_PRESIDENT') return;
          let discardIndex = 0;
          if (currentPres.party === 'LIBERAL') {
            const fasIdx = this.game.currentPresidentCards.findIndex((c) => c === 'FASCIST');
            if (fasIdx !== -1) discardIndex = fasIdx;
          } else {
            const libIdx = this.game.currentPresidentCards.findIndex((c) => c === 'LIBERAL');
            if (libIdx !== -1) discardIndex = libIdx;
          }
          this.game.presidentDiscard(currentPres.id, discardIndex);
          this.touch();
          onUpdate('state-update', {
            state: this.game.getPublicState(),
          });

          // If Chancellor is human, send their cards!
          const chan = this.game.players[this.game.chancellorIndex!];
          if (chan && !chan.isBot) {
            const chanRoomPlayer = this.players.find((p) => p.id === chan.id);
            if (chanRoomPlayer?.socketId) {
              onUpdate('direct-chancellor-cards', {
                socketId: chanRoomPlayer.socketId,
                cards: this.game.currentChancellorCards,
                vetoAvailable: this.game.fascistPolicies >= 5 && !this.game.vetoUsedThisRound,
              });
            }
          }

          this.handleBotTurns(onUpdate);
        }, 1200);
      }
    }

    // BOT CHANCELLOR DISCARD
    else if (game.phase === 'LEGISLATIVE_CHANCELLOR') {
      const currentChan = game.players[game.chancellorIndex!];
      if (currentChan && currentChan.isBot) {
        setTimeout(() => {
          if (!this.game || this.game.phase !== 'LEGISLATIVE_CHANCELLOR') return;
          let discardIndex = 0;
          if (currentChan.party === 'LIBERAL') {
            const fasIdx = this.game.currentChancellorCards.findIndex((c) => c === 'FASCIST');
            if (fasIdx !== -1) discardIndex = fasIdx;
          } else {
            const libIdx = this.game.currentChancellorCards.findIndex((c) => c === 'LIBERAL');
            if (libIdx !== -1) discardIndex = libIdx;
          }
          const result = this.game.chancellorDiscard(currentChan.id, discardIndex);
          this.touch();
          if (result.gameOver) {
            onUpdate('game-over', {
              state: this.game.getPublicState(),
              winner: result.winner,
              winReason: result.winReason,
              roles: this.game.getAllRoles(),
            });
          } else {
            onUpdate('policy-enacted', {
              policy: result.policy,
              state: this.game.getPublicState(),
              executiveAction: result.executiveAction,
              deckReshuffled: result.deckReshuffled,
            });
            if (result.executiveAction === 'PEEK') {
              const pres = this.game.players[this.game.presidentIndex];
              if (pres && !pres.isBot) {
                const presRoomPlayer = this.players.find((p) => p.id === pres.id);
                const peek = this.game.getPeekCards(pres.id);
                if (presRoomPlayer?.socketId && peek.cards) {
                  onUpdate('direct-peek-cards', {
                    socketId: presRoomPlayer.socketId,
                    cards: peek.cards,
                  });
                }
              }
            }
            this.handleBotTurns(onUpdate);
          }
        }, 1200);
      }
    }

    // BOT VETO RESPONSE
    else if (game.phase === 'VETO_PENDING') {
      const currentPres = game.players[game.presidentIndex];
      if (currentPres && currentPres.isBot) {
        setTimeout(() => {
          if (!this.game || this.game.phase !== 'VETO_PENDING') return;
          const hasLiberal = this.game.currentChancellorCards.includes('LIBERAL');
          const accept = currentPres.party === 'LIBERAL' ? !hasLiberal : hasLiberal;
          const res = this.game.presidentVetoResponse(currentPres.id, accept);
          this.touch();

          if (res.vetoed) {
            if (res.gameOver) {
              onUpdate('game-over', {
                state: this.game.getPublicState(),
                winner: res.winner,
                winReason: res.winReason,
                roles: this.game.getAllRoles(),
              });
            } else {
              onUpdate('veto-accepted', {
                state: this.game.getPublicState(),
                electionTracker: res.electionTracker,
                deckReshuffled: res.deckReshuffled,
              });
            }
          } else if (res.vetoRejected) {
            const chan = this.game.players[this.game.chancellorIndex!];
            if (chan && !chan.isBot) {
              const chanRoomPlayer = this.players.find((p) => p.id === chan.id);
              if (chanRoomPlayer?.socketId) {
                onUpdate('direct-chancellor-cards', {
                  socketId: chanRoomPlayer.socketId,
                  cards: this.game.currentChancellorCards,
                  vetoAvailable: false,
                });
              }
            }
            onUpdate('veto-rejected', { state: this.game.getPublicState() });
          }
          this.handleBotTurns(onUpdate);
        }, 1000);
      }
    }

    // BOT EXECUTIVE ACTION
    else if (game.phase === 'EXECUTIVE_ACTION') {
      const currentPres = game.players[game.presidentIndex];
      if (currentPres && currentPres.isBot) {
        setTimeout(() => {
          if (!this.game || this.game.phase !== 'EXECUTIVE_ACTION') return;
          if (this.game.executiveAction === 'PEEK') {
            this.game.acknowledgePeek(currentPres.id);
            this.touch();
            onUpdate('state-update', { state: this.game.getPublicState() });
            this.handleBotTurns(onUpdate);
          } else if (this.game.executiveAction === 'INVESTIGATE') {
            const targets = this.game.players
              .map((_, i) => i)
              .filter(
                (i) =>
                  i !== this.game!.presidentIndex &&
                  this.game!.players[i].isAlive &&
                  !this.game!.investigatedPlayerIds.has(this.game!.players[i].id)
              );
            if (targets.length > 0) {
              const target = targets[Math.floor(Math.random() * targets.length)];
              this.game.investigatePlayer(currentPres.id, target);
              this.game.acknowledgeInvestigation(currentPres.id);
              this.touch();
              onUpdate('state-update', { state: this.game.getPublicState() });
              this.handleBotTurns(onUpdate);
            }
          } else if (this.game.executiveAction === 'SPECIAL_ELECTION') {
            const targets = this.game.players
              .map((_, i) => i)
              .filter((i) => i !== this.game!.presidentIndex && this.game!.players[i].isAlive);
            if (targets.length > 0) {
              const target = targets[Math.floor(Math.random() * targets.length)];
              this.game.executeSpecialElection(currentPres.id, target);
              this.touch();
              onUpdate('state-update', { state: this.game.getPublicState() });
              this.handleBotTurns(onUpdate);
            }
          } else if (this.game.executiveAction === 'EXECUTE') {
            const targets = this.game.players
              .map((_, i) => i)
              .filter((i) => i !== this.game!.presidentIndex && this.game!.players[i].isAlive);
            if (targets.length > 0) {
              const target = targets[Math.floor(Math.random() * targets.length)];
              const killRes = this.game.executeKill(currentPres.id, target);
              this.RecordHitlerCheck(killRes.hitlerCheck);
              this.touch();
              if (killRes.gameOver) {
                onUpdate('game-over', {
                  state: this.game.getPublicState(),
                  winner: killRes.winner,
                  winReason: killRes.winReason,
                  roles: this.game.getAllRoles(),
                  hitlerCheck: killRes.hitlerCheck,
                });
              } else {
                onUpdate('player-executed', {
                  killed: killRes.killed,
                  hitlerCheck: killRes.hitlerCheck,
                  state: this.game.getPublicState(),
                });
                this.handleBotTurns(onUpdate);
              }
            }
          }
        }, 1200);
      }
    }
  }

  private notifyElectionResolution(
    result: any,
    onUpdate: (event: string, data: any) => void
  ) {
    if (!this.game) return;
    this.RecordHitlerCheck(result.hitlerCheck);

    if (result.gameOver) {
      onUpdate('game-over', {
        state: this.game.getPublicState(),
        winner: result.winner,
        winReason: result.winReason,
        roles: this.game.getAllRoles(),
        hitlerCheck: result.hitlerCheck,
        votes: result.votes,
      });
      return;
    }

    if (result.chaos) {
      onUpdate('election-result', {
        passed: false,
        votes: result.votes,
        chaos: true,
        chaosPolicy: result.chaosPolicy,
        deckReshuffled: result.deckReshuffled,
        state: this.game.getPublicState(),
      });
      this.handleBotTurns(onUpdate);
      return;
    }

    onUpdate('election-result', {
      passed: result.passed,
      votes: result.votes,
      hitlerCheck: result.hitlerCheck,
      deckReshuffled: result.deckReshuffled,
      state: this.game.getPublicState(),
    });

    if (result.passed) {
      const pres = this.game.players[this.game.presidentIndex];
      if (pres && !pres.isBot) {
        const presRoomPlayer = this.players.find((p) => p.id === pres.id);
        if (presRoomPlayer?.socketId) {
          onUpdate('direct-president-cards', {
            socketId: presRoomPlayer.socketId,
            cards: this.game.currentPresidentCards,
          });
        }
      }
    }

    this.handleBotTurns(onUpdate);
  }

  toJSON() {
    return {
      code: this.code,
      hostId: this.hostId,
      players: this.players,
      spectators: this.spectators,
      started: this.started,
      isPrivate: this.isPrivate,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      revision: this.revision,
      lastHitlerCheck: this.lastHitlerCheck,
      game: this.game ? this.game.toJSON() : null,
    };
  }

  static fromJSON(data: any): Room {
    const room = new Room('', '', '', data.code, Boolean(data.isPrivate));
    room.hostId = data.hostId || '';
    room.players = Array.isArray(data.players) ? data.players : [];
    room.spectators = Array.isArray(data.spectators) ? data.spectators : [];
    room.started = Boolean(data.started);
    room.isPrivate = Boolean(data.isPrivate);
    room.createdAt = data.createdAt || Date.now();
    room.updatedAt = data.updatedAt || Date.now();
    room.revision = data.revision || 1;
    room.lastHitlerCheck = data.lastHitlerCheck || null;
    room.game = data.game ? GameEngine.fromJSON(data.game) : null;
    room.ensureRealPlayerHost();
    return room;
  }
}
