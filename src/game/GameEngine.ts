import {
  ExecutiveAction,
  GameLogEntry,
  NightInfo,
  Party,
  Phase,
  Player,
  Policy,
  PublicGameState,
  PublicPlayer,
  Role,
  Vote,
} from './types.js';

export class GameEngine {
  players: Player[];
  phase: Phase = 'LOBBY';
  roundNumber = 0;
  liberalPolicies = 0;
  fascistPolicies = 0;
  electionTracker = 0; // 0, 1, 2 (3 triggers chaos)

  drawDeck: Policy[] = [];
  discardPile: Policy[] = [];

  presidentIndex = 0;
  chancellorIndex: number | null = null;
  previousPresidentIndex: number | null = null;
  previousChancellorIndex: number | null = null;

  votes: Record<string, Vote> = {};
  lastRevealedVotes: Record<string, Vote> = {};
  lastVotePassed: boolean | null = null;

  currentPresidentCards: Policy[] = [];
  currentChancellorCards: Policy[] = [];
  executiveAction: ExecutiveAction = 'NONE';
  investigatedPlayerIds: Set<string> = new Set();
  lastInvestigationResult: { targetIndex: number; party: Party; targetName: string } | null = null;

  specialElectionReturnIndex: number | null = null;
  vetoRequestedByChancellor = false;
  vetoUsedThisRound = false;

  winner: 'LIBERAL' | 'FASCIST' | null = null;
  winReason: string | null = null;

  log: GameLogEntry[] = [];

  constructor(initialPlayers: { id: string; name: string; isBot?: boolean }[] = []) {
    this.players = initialPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      role: 'LIBERAL',
      party: 'LIBERAL',
      isAlive: true,
      isBot: p.isBot || false,
    }));
  }

  addLog(text: string, type: GameLogEntry['type'] = 'system') {
    this.log.push({
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      text,
      type,
    });
  }

  startGame(): { success: boolean; error?: string } {
    if (this.players.length < 5 || this.players.length > 10) {
      return { success: false, error: 'Game requires 5 to 10 players' };
    }

    const count = this.players.length;
    let numLiberals = 3;
    let numFascists = 1; // plus Hitler
    if (count === 6) {
      numLiberals = 4;
      numFascists = 1;
    } else if (count === 7) {
      numLiberals = 4;
      numFascists = 2;
    } else if (count === 8) {
      numLiberals = 5;
      numFascists = 2;
    } else if (count === 9) {
      numLiberals = 5;
      numFascists = 3;
    } else if (count === 10) {
      numLiberals = 6;
      numFascists = 3;
    }

    const roles: Role[] = [];
    for (let i = 0; i < numLiberals; i++) roles.push('LIBERAL');
    for (let i = 0; i < numFascists; i++) roles.push('FASCIST');
    roles.push('HITLER');

    this.shuffle(roles);

    for (let i = 0; i < this.players.length; i++) {
      this.players[i].role = roles[i];
      this.players[i].party = roles[i] === 'LIBERAL' ? 'LIBERAL' : 'FASCIST';
      this.players[i].isAlive = true;
    }

    // 17 Policy tiles: 6 Liberal, 11 Fascist
    this.drawDeck = [
      ...Array(6).fill('LIBERAL'),
      ...Array(11).fill('FASCIST'),
    ];
    this.shuffle(this.drawDeck);
    this.discardPile = [];

    this.liberalPolicies = 0;
    this.fascistPolicies = 0;
    this.electionTracker = 0;
    this.roundNumber = 1;
    this.previousPresidentIndex = null;
    this.previousChancellorIndex = null;
    this.specialElectionReturnIndex = null;
    this.investigatedPlayerIds.clear();
    this.lastInvestigationResult = null;
    this.votes = {};
    this.lastRevealedVotes = {};
    this.lastVotePassed = null;
    this.currentPresidentCards = [];
    this.currentChancellorCards = [];
    this.vetoRequestedByChancellor = false;
    this.vetoUsedThisRound = false;
    this.winner = null;
    this.winReason = null;
    this.log = [];

    // Random first president
    this.presidentIndex = Math.floor(Math.random() * this.players.length);
    this.chancellorIndex = null;
    this.phase = 'NIGHT';

    this.addLog(
      `Session initialized with ${this.players.length} players (${numLiberals} Liberals, ${numFascists} Fascist${numFascists > 1 ? 's' : ''}, 1 Secret Hitler).`,
      'system'
    );
    this.addLog(`${this.players[this.presidentIndex].name} holds the opening Presidential placard.`, 'election');

    return { success: true };
  }

  getNightInfoForPlayer(playerId: string): NightInfo | null {
    const p = this.players.find((pl) => pl.id === playerId);
    if (!p) return null;

    const totalCount = this.players.length;
    const fascists = this.players.filter((pl) => pl.role === 'FASCIST');
    const hitler = this.players.find((pl) => pl.role === 'HITLER')!;

    if (p.role === 'LIBERAL') {
      return {
        role: 'LIBERAL',
        party: 'LIBERAL',
        knowsHitler: false,
        hitlerKnowsFascists: totalCount <= 6,
      };
    }

    if (p.role === 'FASCIST') {
      return {
        role: 'FASCIST',
        party: 'FASCIST',
        teammates: fascists.filter((f) => f.id !== p.id).map((f) => ({ name: f.name, role: f.role })),
        hitlerName: hitler.name,
        knowsHitler: true,
        hitlerKnowsFascists: totalCount <= 6,
      };
    }

    if (totalCount <= 6) {
      return {
        role: 'HITLER',
        party: 'FASCIST',
        teammates: fascists.map((f) => ({ name: f.name, role: f.role })),
        knowsHitler: true,
        hitlerKnowsFascists: true,
      };
    } else {
      return {
        role: 'HITLER',
        party: 'FASCIST',
        knowsHitler: true,
        hitlerKnowsFascists: false,
      };
    }
  }

  advanceToNomination() {
    this.phase = 'NOMINATION';
    this.chancellorIndex = null;
    this.votes = {};
    this.currentPresidentCards = [];
    this.currentChancellorCards = [];
    this.vetoRequestedByChancellor = false;
    this.vetoUsedThisRound = false;
    this.addLog(`Round ${this.roundNumber}: President ${this.players[this.presidentIndex].name} must nominate a Chancellor.`, 'election');
  }

  getAlivePlayersCount(): number {
    return this.players.filter((p) => p.isAlive).length;
  }

  getEligibleChancellors(): number[] {
    const aliveCount = this.getAlivePlayersCount();
    const eligible: number[] = [];

    for (let i = 0; i < this.players.length; i++) {
      if (!this.players[i].isAlive) continue;
      if (i === this.presidentIndex) continue;

      if (aliveCount <= 5) {
        if (this.previousChancellorIndex !== null && i === this.previousChancellorIndex) {
          continue;
        }
      } else {
        if (this.previousChancellorIndex !== null && i === this.previousChancellorIndex) {
          continue;
        }
        if (this.previousPresidentIndex !== null && i === this.previousPresidentIndex) {
          continue;
        }
      }

      eligible.push(i);
    }
    return eligible;
  }

  nominateChancellor(chancellorIndex: number): { success: boolean; error?: string } {
    if (this.phase !== 'NOMINATION') {
      return { success: false, error: 'Not in nomination phase' };
    }

    const eligible = this.getEligibleChancellors();
    if (!eligible.includes(chancellorIndex)) {
      return { success: false, error: 'Selected player is term-limited or ineligible for Chancellor' };
    }

    this.chancellorIndex = chancellorIndex;
    this.phase = 'VOTING';
    this.votes = {};

    this.addLog(
      `President ${this.players[this.presidentIndex].name} nominated ${this.players[chancellorIndex].name} as Chancellor. Ballots open!`,
      'election'
    );

    return { success: true };
  }

  castVote(playerId: string, vote: Vote): {
    success: boolean;
    error?: string;
    waiting?: boolean;
    votesIn?: number;
    votesNeeded?: number;
    votes?: Record<string, Vote>;
    passed?: boolean;
    chaos?: boolean;
    chaosPolicy?: Policy;
    gameOver?: boolean;
    winner?: 'LIBERAL' | 'FASCIST';
    winReason?: string;
  } {
    if (this.phase !== 'VOTING') {
      return { success: false, error: 'Not in voting phase' };
    }

    const player = this.players.find((p) => p.id === playerId);
    if (!player || !player.isAlive) {
      return { success: false, error: 'Eliminated players cannot vote' };
    }

    this.votes[playerId] = vote;

    const alivePlayers = this.players.filter((p) => p.isAlive);
    const votesIn = Object.keys(this.votes).length;
    const votesNeeded = alivePlayers.length;

    if (votesIn < votesNeeded) {
      return {
        success: true,
        waiting: true,
        votesIn,
        votesNeeded,
      };
    }

    let jaCount = 0;
    let neinCount = 0;
    for (const p of alivePlayers) {
      const v = this.votes[p.id];
      if (v === 'JA') jaCount++;
      else neinCount++;
    }

    const passed = jaCount > neinCount;
    this.lastVotePassed = passed;
    this.lastRevealedVotes = { ...this.votes };

    const voteSummary = alivePlayers
      .map((p) => `${p.name}: ${this.votes[p.id]}`)
      .join(', ');
    this.addLog(
      `Vote tally (${jaCount} Ja! – ${neinCount} Nein!): ${passed ? 'GOVERNMENT ELECTED' : 'VOTE REJECTED'}. [${voteSummary}]`,
      'election'
    );

    if (passed) {
      this.electionTracker = 0;

      if (this.fascistPolicies >= 3 && this.players[this.chancellorIndex!].role === 'HITLER') {
        this.winner = 'FASCIST';
        this.winReason = 'Hitler was elected Chancellor after 3 Fascist policies were enacted!';
        this.phase = 'GAME_OVER';
        this.addLog(`FASCISTS WIN! Hitler (${this.players[this.chancellorIndex!].name}) was elected Chancellor!`, 'system');
        return {
          success: true,
          passed: true,
          votes: { ...this.lastRevealedVotes },
          gameOver: true,
          winner: 'FASCIST',
          winReason: this.winReason,
        };
      }

      this.previousPresidentIndex = this.presidentIndex;
      this.previousChancellorIndex = this.chancellorIndex;

      this.checkDeckReshuffle();

      this.currentPresidentCards = [this.drawDeck.pop()!, this.drawDeck.pop()!, this.drawDeck.pop()!];
      this.phase = 'LEGISLATIVE_PRESIDENT';

      this.addLog(
        `President ${this.players[this.presidentIndex].name} drew 3 policy tiles in secret.`,
        'policy'
      );

      return {
        success: true,
        passed: true,
        votes: { ...this.lastRevealedVotes },
      };
    } else {
      const revealedVotes = { ...this.lastRevealedVotes };
      this.electionTracker++;
      this.addLog(`Government rejected. Election tracker advanced to ${this.electionTracker}/3.`, 'election');

      if (this.electionTracker >= 3) {
        this.addLog(`CHAOS! Three consecutive governments failed. Enacting top policy from deck!`, 'chaos');
        this.checkDeckReshuffle();
        const chaosPolicy = this.drawDeck.pop()!;
        this.enactPolicyDirectly(chaosPolicy);
        this.electionTracker = 0;

        this.previousPresidentIndex = null;
        this.previousChancellorIndex = null;

        if (this.winner) {
          return {
            success: true,
            passed: false,
            chaos: true,
            chaosPolicy,
            votes: revealedVotes,
            gameOver: true,
            winner: this.winner,
            winReason: this.winReason!,
          };
        }

        this.advancePresidentClockwise();
        this.advanceToNomination();

        return {
          success: true,
          passed: false,
          chaos: true,
          chaosPolicy,
          votes: revealedVotes,
        };
      }

      this.advancePresidentClockwise();
      this.advanceToNomination();

      return {
        success: true,
        passed: false,
        votes: revealedVotes,
      };
    }
  }

  checkDeckReshuffle() {
    if (this.drawDeck.length < 3) {
      const reshuffled = [...this.drawDeck, ...this.discardPile];
      this.shuffle(reshuffled);
      this.drawDeck = reshuffled;
      this.discardPile = [];
      this.addLog(`Policy draw deck had fewer than 3 tiles; reshuffled with discard pile (${this.drawDeck.length} tiles).`, 'system');
    }
  }

  presidentDiscard(playerId: string, cardIndex: number): { success: boolean; error?: string } {
    if (this.phase !== 'LEGISLATIVE_PRESIDENT') {
      return { success: false, error: 'Not in President legislative phase' };
    }
    if (this.players[this.presidentIndex].id !== playerId) {
      return { success: false, error: 'Only the sitting President can discard' };
    }
    if (cardIndex < 0 || cardIndex >= this.currentPresidentCards.length) {
      return { success: false, error: 'Invalid card index' };
    }

    const discarded = this.currentPresidentCards.splice(cardIndex, 1)[0];
    this.discardPile.push(discarded);
    this.currentChancellorCards = [...this.currentPresidentCards];
    this.currentPresidentCards = [];
    this.phase = 'LEGISLATIVE_CHANCELLOR';

    this.addLog(
      `President ${this.players[this.presidentIndex].name} discarded 1 tile and passed 2 tiles to Chancellor ${this.players[this.chancellorIndex!].name}.`,
      'policy'
    );

    return { success: true };
  }

  chancellorDiscard(
    playerId: string,
    cardIndex: number
  ): {
    success: boolean;
    error?: string;
    policy?: Policy;
    executiveAction?: ExecutiveAction;
    gameOver?: boolean;
    winner?: 'LIBERAL' | 'FASCIST';
    winReason?: string;
  } {
    if (this.phase !== 'LEGISLATIVE_CHANCELLOR') {
      return { success: false, error: 'Not in Chancellor legislative phase' };
    }
    if (this.players[this.chancellorIndex!].id !== playerId) {
      return { success: false, error: 'Only the Chancellor can enact a policy' };
    }
    if (cardIndex < 0 || cardIndex >= this.currentChancellorCards.length) {
      return { success: false, error: 'Invalid card index' };
    }

    const discarded = this.currentChancellorCards.splice(cardIndex, 1)[0];
    this.discardPile.push(discarded);
    const enacted = this.currentChancellorCards[0];
    this.currentChancellorCards = [];

    return this.enactPolicyByGovernment(enacted);
  }

  enactPolicyDirectly(policy: Policy) {
    if (policy === 'LIBERAL') {
      this.liberalPolicies++;
      this.addLog(`Chaos enacted a LIBERAL Policy! (${this.liberalPolicies}/5)`, 'chaos');
    } else {
      this.fascistPolicies++;
      this.addLog(`Chaos enacted a FASCIST Policy! (${this.fascistPolicies}/6)`, 'chaos');
    }

    this.checkWinConditions();
    this.checkDeckReshuffle();
  }

  enactPolicyByGovernment(policy: Policy): {
    success: boolean;
    policy: Policy;
    executiveAction: ExecutiveAction;
    gameOver?: boolean;
    winner?: 'LIBERAL' | 'FASCIST';
    winReason?: string;
  } {
    if (policy === 'LIBERAL') {
      this.liberalPolicies++;
      this.addLog(`Government enacted a LIBERAL Policy! (${this.liberalPolicies}/5)`, 'policy');
    } else {
      this.fascistPolicies++;
      this.addLog(`Government enacted a FASCIST Policy! (${this.fascistPolicies}/6)`, 'policy');
    }

    this.electionTracker = 0;
    this.checkWinConditions();

    if (this.winner) {
      return {
        success: true,
        policy,
        executiveAction: 'NONE',
        gameOver: true,
        winner: this.winner,
        winReason: this.winReason!,
      };
    }

    let action: ExecutiveAction = 'NONE';
    if (policy === 'FASCIST') {
      action = this.getExecutivePowerForFascistSlot(this.fascistPolicies);
    }

    this.checkDeckReshuffle();

    if (action !== 'NONE') {
      this.executiveAction = action;
      this.phase = 'EXECUTIVE_ACTION';
      this.addLog(
        `Presidential Power unlocked: ${this.players[this.presidentIndex].name} must use ${this.formatActionName(action)}.`,
        'executive'
      );
      return {
        success: true,
        policy,
        executiveAction: action,
      };
    }

    this.advancePresidentClockwise();
    this.advanceToNomination();

    return {
      success: true,
      policy,
      executiveAction: 'NONE',
    };
  }

  formatActionName(action: ExecutiveAction): string {
    switch (action) {
      case 'PEEK':
        return 'Policy Peek';
      case 'INVESTIGATE':
        return 'Investigate Loyalty';
      case 'SPECIAL_ELECTION':
        return 'Call Special Election';
      case 'EXECUTE':
        return 'Execution';
      default:
        return 'None';
    }
  }

  getExecutivePowerForFascistSlot(slotNumber: number): ExecutiveAction {
    const count = this.players.length;

    if (count <= 6) {
      if (slotNumber === 3) return 'PEEK';
      if (slotNumber === 4 || slotNumber === 5) return 'EXECUTE';
      return 'NONE';
    } else if (count <= 8) {
      if (slotNumber === 2) return 'INVESTIGATE';
      if (slotNumber === 3) return 'SPECIAL_ELECTION';
      if (slotNumber === 4 || slotNumber === 5) return 'EXECUTE';
      return 'NONE';
    } else {
      if (slotNumber === 1 || slotNumber === 2) return 'INVESTIGATE';
      if (slotNumber === 3) return 'SPECIAL_ELECTION';
      if (slotNumber === 4 || slotNumber === 5) return 'EXECUTE';
      return 'NONE';
    }
  }

  chancellorVeto(playerId: string): { success: boolean; error?: string } {
    if (this.phase !== 'LEGISLATIVE_CHANCELLOR') {
      return { success: false, error: 'Not in Chancellor legislative phase' };
    }
    if (this.players[this.chancellorIndex!].id !== playerId) {
      return { success: false, error: 'Only Chancellor can propose veto' };
    }
    if (this.fascistPolicies < 5) {
      return { success: false, error: 'Veto power only unlocks at 5 Fascist policies' };
    }
    if (this.vetoUsedThisRound) {
      return { success: false, error: 'Veto was already rejected this session' };
    }

    this.vetoRequestedByChancellor = true;
    this.vetoUsedThisRound = true;
    this.phase = 'VETO_PENDING';
    this.addLog(
      `Chancellor ${this.players[this.chancellorIndex!].name} proposed to VETO the agenda. Waiting for President ${this.players[this.presidentIndex].name}.`,
      'policy'
    );

    return { success: true };
  }

  presidentVetoResponse(
    playerId: string,
    accept: boolean
  ): {
    success: boolean;
    error?: string;
    vetoed?: boolean;
    vetoRejected?: boolean;
    chaos?: boolean;
    policy?: Policy;
    electionTracker?: number;
    gameOver?: boolean;
    winner?: 'LIBERAL' | 'FASCIST';
    winReason?: string;
  } {
    if (this.phase !== 'VETO_PENDING') {
      return { success: false, error: 'Not in veto response phase' };
    }
    if (this.players[this.presidentIndex].id !== playerId) {
      return { success: false, error: 'Only sitting President can respond to veto' };
    }

    if (accept) {
      this.discardPile.push(...this.currentChancellorCards);
      this.currentChancellorCards = [];
      this.vetoRequestedByChancellor = false;
      this.electionTracker++;

      this.addLog(
        `President ${this.players[this.presidentIndex].name} agreed to the Veto! Both policies discarded. Election tracker: ${this.electionTracker}/3.`,
        'policy'
      );

      if (this.electionTracker >= 3) {
        this.addLog(`CHAOS! Veto pushed the Election Tracker to 3/3!`, 'chaos');
        this.checkDeckReshuffle();
        const chaosPolicy = this.drawDeck.pop()!;
        this.enactPolicyDirectly(chaosPolicy);
        this.electionTracker = 0;
        this.previousPresidentIndex = null;
        this.previousChancellorIndex = null;

        if (this.winner) {
          return {
            success: true,
            vetoed: true,
            chaos: true,
            policy: chaosPolicy,
            gameOver: true,
            winner: this.winner,
            winReason: this.winReason!,
          };
        }

        this.advancePresidentClockwise();
        this.advanceToNomination();

        return {
          success: true,
          vetoed: true,
          chaos: true,
          policy: chaosPolicy,
        };
      }

      this.advancePresidentClockwise();
      this.advanceToNomination();

      return {
        success: true,
        vetoed: true,
        electionTracker: this.electionTracker,
      };
    } else {
      this.vetoRequestedByChancellor = false;
      this.phase = 'LEGISLATIVE_CHANCELLOR';
      this.addLog(
        `President ${this.players[this.presidentIndex].name} rejected the Veto. Chancellor must enact one of the 2 policies.`,
        'policy'
      );

      return {
        success: true,
        vetoRejected: true,
      };
    }
  }

  getPeekCards(playerId: string): { success: boolean; cards?: Policy[]; error?: string } {
    if (this.phase !== 'EXECUTIVE_ACTION' || this.executiveAction !== 'PEEK') {
      return { success: false, error: 'Policy peek not active' };
    }
    if (this.players[this.presidentIndex].id !== playerId) {
      return { success: false, error: 'Only President can peek at policies' };
    }

    this.checkDeckReshuffle();
    const peek = this.drawDeck.slice(-3).reverse();
    return { success: true, cards: peek };
  }

  acknowledgePeek(playerId: string): { success: boolean; error?: string } {
    if (this.phase !== 'EXECUTIVE_ACTION' || this.executiveAction !== 'PEEK') {
      return { success: false, error: 'Policy peek not active' };
    }
    if (this.players[this.presidentIndex].id !== playerId) {
      return { success: false, error: 'Only President can acknowledge peek' };
    }

    this.addLog(`President ${this.players[this.presidentIndex].name} examined the top 3 policy tiles.`, 'executive');
    this.executiveAction = 'NONE';
    this.advancePresidentClockwise();
    this.advanceToNomination();
    return { success: true };
  }

  investigatePlayer(
    playerId: string,
    targetIndex: number
  ): {
    success: boolean;
    error?: string;
    targetIndex?: number;
    party?: Party;
    targetName?: string;
  } {
    if (this.phase !== 'EXECUTIVE_ACTION' || this.executiveAction !== 'INVESTIGATE') {
      return { success: false, error: 'Investigation not active' };
    }
    if (this.players[this.presidentIndex].id !== playerId) {
      return { success: false, error: 'Only President can investigate' };
    }
    if (targetIndex < 0 || targetIndex >= this.players.length) {
      return { success: false, error: 'Invalid target index' };
    }
    if (targetIndex === this.presidentIndex) {
      return { success: false, error: 'Cannot investigate yourself' };
    }
    const target = this.players[targetIndex];
    if (!target.isAlive) {
      return { success: false, error: 'Cannot investigate an eliminated player' };
    }
    if (this.investigatedPlayerIds.has(target.id)) {
      return { success: false, error: 'Cannot investigate the same player twice in one game' };
    }

    this.investigatedPlayerIds.add(target.id);
    this.lastInvestigationResult = {
      targetIndex,
      party: target.party,
      targetName: target.name,
    };

    this.addLog(
      `President ${this.players[this.presidentIndex].name} investigated the Party Membership of ${target.name}.`,
      'executive'
    );

    return {
      success: true,
      targetIndex,
      party: target.party,
      targetName: target.name,
    };
  }

  acknowledgeInvestigation(playerId: string): { success: boolean; error?: string } {
    if (this.phase !== 'EXECUTIVE_ACTION' || this.executiveAction !== 'INVESTIGATE') {
      return { success: false, error: 'Investigation not active' };
    }
    if (this.players[this.presidentIndex].id !== playerId) {
      return { success: false, error: 'Only President can acknowledge' };
    }

    this.executiveAction = 'NONE';
    this.lastInvestigationResult = null;
    this.advancePresidentClockwise();
    this.advanceToNomination();
    return { success: true };
  }

  executeSpecialElection(
    playerId: string,
    targetIndex: number
  ): { success: boolean; error?: string } {
    if (this.phase !== 'EXECUTIVE_ACTION' || this.executiveAction !== 'SPECIAL_ELECTION') {
      return { success: false, error: 'Special election not active' };
    }
    if (this.players[this.presidentIndex].id !== playerId) {
      return { success: false, error: 'Only President can call special election' };
    }
    if (targetIndex < 0 || targetIndex >= this.players.length) {
      return { success: false, error: 'Invalid target index' };
    }
    if (targetIndex === this.presidentIndex) {
      return { success: false, error: 'Cannot choose yourself' };
    }
    if (!this.players[targetIndex].isAlive) {
      return { success: false, error: 'Cannot choose an eliminated player' };
    }

    this.specialElectionReturnIndex = this.getNextAlivePlayerIndex(this.presidentIndex);

    this.presidentIndex = targetIndex;
    this.executiveAction = 'NONE';
    this.roundNumber++;

    this.addLog(
      `Special Election called! ${this.players[targetIndex].name} is appointed the next Presidential Candidate.`,
      'executive'
    );

    this.advanceToNomination();
    return { success: true };
  }

  executeKill(
    playerId: string,
    targetIndex: number
  ): {
    success: boolean;
    error?: string;
    killed?: string;
    gameOver?: boolean;
    winner?: 'LIBERAL' | 'FASCIST';
    winReason?: string;
  } {
    if (this.phase !== 'EXECUTIVE_ACTION' || this.executiveAction !== 'EXECUTE') {
      return { success: false, error: 'Execution not active' };
    }
    if (this.players[this.presidentIndex].id !== playerId) {
      return { success: false, error: 'Only President can execute a player' };
    }
    if (targetIndex < 0 || targetIndex >= this.players.length) {
      return { success: false, error: 'Invalid target index' };
    }
    if (targetIndex === this.presidentIndex) {
      return { success: false, error: 'Cannot execute yourself' };
    }
    const target = this.players[targetIndex];
    if (!target.isAlive) {
      return { success: false, error: 'Player is already eliminated' };
    }

    target.isAlive = false;
    this.executiveAction = 'NONE';

    this.addLog(
      `President ${this.players[this.presidentIndex].name} formally executed ${target.name}!`,
      'executive'
    );

    if (target.role === 'HITLER') {
      this.winner = 'LIBERAL';
      this.winReason = 'Secret Hitler was executed! The Liberal Republic prevails.';
      this.phase = 'GAME_OVER';
      this.addLog(`LIBERALS WIN! ${target.name} was Secret Hitler and has been assassinated!`, 'system');

      return {
        success: true,
        killed: target.name,
        gameOver: true,
        winner: 'LIBERAL',
        winReason: this.winReason,
      };
    }

    this.addLog(`${target.name} was not Hitler. Their role remains secret.`, 'system');

    this.advancePresidentClockwise();
    this.advanceToNomination();

    return {
      success: true,
      killed: target.name,
      gameOver: false,
    };
  }

  getNextAlivePlayerIndex(fromIndex: number): number {
    let next = (fromIndex + 1) % this.players.length;
    while (!this.players[next].isAlive) {
      next = (next + 1) % this.players.length;
    }
    return next;
  }

  advancePresidentClockwise() {
    if (this.specialElectionReturnIndex !== null) {
      let candidate = this.specialElectionReturnIndex;
      while (!this.players[candidate].isAlive) {
        candidate = (candidate + 1) % this.players.length;
      }
      this.presidentIndex = candidate;
      this.specialElectionReturnIndex = null;
    } else {
      this.presidentIndex = this.getNextAlivePlayerIndex(this.presidentIndex);
    }
    this.roundNumber++;
  }

  checkWinConditions() {
    if (this.liberalPolicies >= 5) {
      this.winner = 'LIBERAL';
      this.winReason = '5 Liberal policies have been enacted!';
      this.phase = 'GAME_OVER';
      this.addLog('LIBERALS WIN! 5 Liberal policies have been enacted!', 'system');
    } else if (this.fascistPolicies >= 6) {
      this.winner = 'FASCIST';
      this.winReason = '6 Fascist policies have been enacted!';
      this.phase = 'GAME_OVER';
      this.addLog('FASCISTS WIN! 6 Fascist policies have been enacted!', 'system');
    }
  }

  getPublicState(): PublicGameState {
    const publicPlayers: PublicPlayer[] = this.players.map((p, idx) => ({
      id: p.id,
      name: p.name,
      isAlive: p.isAlive,
      isPresident: idx === this.presidentIndex,
      isChancellor: idx === this.chancellorIndex,
      isPreviousPresident: idx === this.previousPresidentIndex,
      isPreviousChancellor: idx === this.previousChancellorIndex,
      investigatedByPresident: this.investigatedPlayerIds.has(p.id),
      hasVoted: this.phase === 'VOTING' ? Boolean(this.votes[p.id]) : false,
      isBot: p.isBot,
    }));

    return {
      phase: this.phase,
      roundNumber: this.roundNumber,
      liberalPolicies: this.liberalPolicies,
      fascistPolicies: this.fascistPolicies,
      electionTracker: this.electionTracker,
      deckCount: this.drawDeck.length,
      discardCount: this.discardPile.length,
      inHandCount: this.currentPresidentCards.length + this.currentChancellorCards.length,
      presidentIndex: this.presidentIndex,
      chancellorIndex: this.chancellorIndex,
      previousPresidentIndex: this.previousPresidentIndex,
      previousChancellorIndex: this.previousChancellorIndex,
      eligibleChancellors: this.phase === 'NOMINATION' ? this.getEligibleChancellors() : [],
      votes: this.phase === 'VOTING' ? {} : { ...this.lastRevealedVotes },
      lastVotePassed: this.lastVotePassed,
      executiveAction: this.executiveAction,
      specialElectionReturnIndex: this.specialElectionReturnIndex,
      vetoUnlocked: this.fascistPolicies >= 5,
      vetoUsedThisRound: this.vetoUsedThisRound,
      winner: this.winner,
      winReason: this.winReason,
      players: publicPlayers,
      log: this.log.slice(-50),
    };
  }

  getAllRoles(): Record<string, { role: Role; party: Party; name: string }> {
    const res: Record<string, { role: Role; party: Party; name: string }> = {};
    for (const p of this.players) {
      res[p.id] = { role: p.role, party: p.party, name: p.name };
    }
    return res;
  }

  private shuffle<T>(array: T[]) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
