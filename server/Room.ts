import { GameEngine } from '../src/game/GameEngine.js';
import { NightInfo, Vote } from '../src/game/types.js';

export interface RoomPlayer {
  id: string;
  name: string;
  socketId: string;
  isBot?: boolean;
}

export interface RoomSpectator {
  id: string;
  name: string;
  socketId: string;
}

export class Room {
  code: string;
  hostId: string;
  players: RoomPlayer[] = [];
  spectators: RoomSpectator[] = [];
  game: GameEngine | null = null;
  started = false;

  constructor(hostId: string, hostName: string, socketId?: string) {
    this.code = this.generateCode();
    this.hostId = hostId;
    this.players.push({
      id: hostId,
      name: hostName.trim() || 'Player 1',
      socketId: socketId || hostId,
    });
  }

  generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  setPlayerSocketId(playerId: string, socketId: string) {
    const player = this.players.find((p) => p.id === playerId);
    if (player) player.socketId = socketId;
    const spec = this.spectators.find((s) => s.id === playerId);
    if (spec) spec.socketId = socketId;
  }

  getPlayerList() {
    return this.players.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.id === this.hostId,
      isBot: p.isBot || false,
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
    socketId?: string
  ): { success: boolean; isSpectator?: boolean; error?: string } {
    const cleanName = name.trim();
    if (!cleanName) {
      return { success: false, error: 'Please enter your name' };
    }

    // If game is already in progress, join as Spectator!
    if (this.started) {
      // Ensure unique spectator name
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
      });
      return { success: true, isSpectator: true };
    }

    if (this.players.length >= 10) {
      // If lobby is full (10 players), also allow joining as Spectator!
      this.spectators.push({
        id,
        name: cleanName,
        socketId: socketId || id,
      });
      return { success: true, isSpectator: true };
    }

    if (this.players.some((p) => p.name.toLowerCase() === cleanName.toLowerCase())) {
      return { success: false, error: 'Someone with that name is already in the room' };
    }

    this.players.push({
      id,
      name: cleanName,
      socketId: socketId || id,
    });

    return { success: true, isSpectator: false };
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
    };
    this.players.push(bot);
    return { success: true, bot };
  }

  removeBot(botId: string): boolean {
    const idx = this.players.findIndex((p) => p.id === botId && p.isBot);
    if (idx !== -1) {
      this.players.splice(idx, 1);
      return true;
    }
    return false;
  }

  removePlayer(id: string): { remaining: number; wasHost: boolean; wasSpectator: boolean } {
    const specIdx = this.spectators.findIndex((s) => s.id === id);
    if (specIdx !== -1) {
      this.spectators.splice(specIdx, 1);
      return { remaining: this.players.length, wasHost: false, wasSpectator: true };
    }

    const idx = this.players.findIndex((p) => p.id === id);
    if (idx === -1) return { remaining: this.players.length, wasHost: false, wasSpectator: false };

    const wasHost = this.players[idx].id === this.hostId;
    this.players.splice(idx, 1);

    if (wasHost && this.players.length > 0) {
      const nextHuman = this.players.find((p) => !p.isBot);
      this.hostId = nextHuman ? nextHuman.id : this.players[0].id;
    }

    return { remaining: this.players.length, wasHost, wasSpectator: false };
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

    const nightInfo: Record<string, NightInfo> = {};
    for (const p of this.players) {
      const info = this.game.getNightInfoForPlayer(p.id);
      if (info) nightInfo[p.id] = info;
    }

    return { success: true, nightInfo };
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
          // Bot accepts veto if cards don't align with their party
          const hasLiberal = this.game.currentChancellorCards.includes('LIBERAL');
          const accept = currentPres.party === 'LIBERAL' ? !hasLiberal : hasLiberal;
          const res = this.game.presidentVetoResponse(currentPres.id, accept);

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
              if (killRes.gameOver) {
                onUpdate('game-over', {
                  state: this.game.getPublicState(),
                  winner: killRes.winner,
                  winReason: killRes.winReason,
                  roles: this.game.getAllRoles(),
                });
              } else {
                onUpdate('player-executed', {
                  killed: killRes.killed,
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

    if (result.gameOver) {
      onUpdate('game-over', {
        state: this.game.getPublicState(),
        winner: result.winner,
        winReason: result.winReason,
        roles: this.game.getAllRoles(),
      });
      return;
    }

    if (result.chaos) {
      onUpdate('election-result', {
        passed: false,
        votes: result.votes,
        chaos: true,
        chaosPolicy: result.chaosPolicy,
        state: this.game.getPublicState(),
      });
      this.handleBotTurns(onUpdate);
      return;
    }

    onUpdate('election-result', {
      passed: result.passed,
      votes: result.votes,
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
}
