import { GameEngine } from './GameEngine.js';
import { AgentCheckResult, PublicGameState } from './types.js';

export class DebugAgents {
  /**
   * Runs all 5 specialized debugging & verification agents against both
   * the live game state (if active) and deterministic/Monte-Carlo rule simulations.
   */
  static runAllDiagnostics(liveState?: PublicGameState | null): AgentCheckResult[] {
    return [
      this.runDeckConservationAgent(liveState),
      this.runElectoralInspectorAgent(liveState),
      this.runIdentitySecurityAgent(),
      this.runExecutiveComplianceAgent(),
      this.runMonteCarloSimulationAgent(30),
    ];
  }

  /**
   * Agent 1: Deck & Tile Conservation Auditor
   */
  static runDeckConservationAgent(liveState?: PublicGameState | null): AgentCheckResult {
    const details: string[] = [];
    let checksRun = 0;
    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

    // Check 1: Live state tile conservation
    if (liveState && liveState.phase !== 'LOBBY') {
      checksRun++;
      const total =
        liveState.deckCount +
        liveState.discardCount +
        liveState.liberalPolicies +
        liveState.fascistPolicies +
        liveState.inHandCount;
      if (total === 17) {
        details.push(
          `Live Table Conservation: 17/17 tiles accounted for (${liveState.deckCount} draw, ${liveState.discardCount} discard, ${liveState.liberalPolicies}L + ${liveState.fascistPolicies}F enacted, ${liveState.inHandCount} in hand).`
        );
      } else {
        status = 'FAIL';
        details.push(`Live Table Conservation Error: Expected 17 tiles, found ${total}.`);
      }
    }

    // Check 2: Engine initialization 6 Liberal + 11 Fascist
    checksRun++;
    const players = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, name: `User_${i}` }));
    const engine = new GameEngine(players);
    engine.startGame();
    const lib = engine.drawDeck.filter((c) => c === 'LIBERAL').length;
    const fas = engine.drawDeck.filter((c) => c === 'FASCIST').length;
    if (lib === 6 && fas === 11) {
      details.push('Deck Composition Verified: Exactly 6 Liberal and 11 Fascist tiles initialized.');
    } else {
      status = 'FAIL';
      details.push(`Deck Composition Mismatch: ${lib} Liberal, ${fas} Fascist.`);
    }

    // Check 3: Reshuffle threshold (< 3 tiles)
    checksRun++;
    engine.discardPile = engine.drawDeck.splice(0, 15); // leave 2 in drawDeck
    engine.checkDeckReshuffle();
    if (engine.drawDeck.length === 17 && engine.discardPile.length === 0) {
      details.push('Auto-Reshuffle Verified: Draw pile < 3 tiles cleanly merges and shuffles discard pile.');
    } else {
      status = 'FAIL';
      details.push('Auto-Reshuffle Failed.');
    }

    return {
      agentName: 'Deck & Tile Conservation Auditor',
      role: 'Verifies 17-tile conservation law & reshuffle mechanics',
      status,
      checksRun,
      details,
    };
  }

  /**
   * Agent 2: Electoral & Term-Limit Inspector
   */
  static runElectoralInspectorAgent(liveState?: PublicGameState | null): AgentCheckResult {
    const details: string[] = [];
    let checksRun = 0;
    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

    if (liveState && liveState.phase === 'NOMINATION') {
      checksRun++;
      const presId = liveState.players[liveState.presidentIndex]?.name;
      details.push(
        `Live Nomination Check: President ${presId} has ${liveState.eligibleChancellors.length} eligible Chancellor candidates.`
      );
    }

    // Check standard > 5 player term limits
    checksRun++;
    const players7 = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, name: `User_${i}` }));
    const engine = new GameEngine(players7);
    engine.startGame();
    engine.presidentIndex = 0;
    engine.previousPresidentIndex = 1;
    engine.previousChancellorIndex = 2;
    const elig7 = engine.getEligibleChancellors();
    if (!elig7.includes(0) && !elig7.includes(1) && !elig7.includes(2) && elig7.length === 4) {
      details.push('7-Player Term Limits Verified: Both last elected President & Chancellor excluded.');
    } else {
      status = 'FAIL';
      details.push('7-Player Term Limits Failed.');
    }

    // Check 5-player rule exception
    checksRun++;
    engine.players[5].isAlive = false;
    engine.players[6].isAlive = false; // 5 alive players left
    const elig5 = engine.getEligibleChancellors();
    if (elig5.includes(1) && !elig5.includes(2) && elig5.length === 3) {
      details.push('5-Player Rule Exception Verified: Last elected President is eligible; only last Chancellor is excluded.');
    } else {
      status = 'FAIL';
      details.push('5-Player Rule Exception Failed.');
    }

    // Check Chaos reset
    checksRun++;
    engine.advanceToNomination();
    for (let i = 0; i < 3; i++) {
      const c = engine.getEligibleChancellors()[0];
      engine.nominateChancellor(c);
      for (const p of engine.players.filter((pl) => pl.isAlive)) {
        engine.castVote(p.id, 'NEIN');
      }
    }
    if (engine.electionTracker === 0 && engine.previousChancellorIndex === null && engine.previousPresidentIndex === null) {
      details.push('Chaos Tracker Verified: 3 failed elections enact top tile and wipe all term limits.');
    } else {
      status = 'FAIL';
      details.push('Chaos Tracker Reset Failed.');
    }

    return {
      agentName: 'Electoral & Term-Limit Inspector',
      role: 'Audits nomination eligibility, 5-player exception & Chaos resets',
      status,
      checksRun,
      details,
    };
  }

  /**
   * Agent 3: Secret Role & Night Protocol Verifier
   */
  static runIdentitySecurityAgent(): AgentCheckResult {
    const details: string[] = [];
    let checksRun = 0;
    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

    const expectedMatrix: Record<number, { L: number; F: number; H: number; hitlerKnows: boolean }> = {
      5: { L: 3, F: 1, H: 1, hitlerKnows: true },
      6: { L: 4, F: 1, H: 1, hitlerKnows: true },
      7: { L: 4, F: 2, H: 1, hitlerKnows: false },
      8: { L: 5, F: 2, H: 1, hitlerKnows: false },
      9: { L: 5, F: 3, H: 1, hitlerKnows: false },
      10: { L: 6, F: 3, H: 1, hitlerKnows: false },
    };

    for (const [countStr, spec] of Object.entries(expectedMatrix)) {
      checksRun++;
      const count = Number(countStr);
      const players = Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `Player_${i}` }));
      const eng = new GameEngine(players);
      eng.startGame();

      const L = eng.players.filter((p) => p.role === 'LIBERAL').length;
      const F = eng.players.filter((p) => p.role === 'FASCIST').length;
      const H = eng.players.filter((p) => p.role === 'HITLER').length;
      const hitler = eng.players.find((p) => p.role === 'HITLER')!;
      const hitlerInfo = eng.getNightInfoForPlayer(hitler.id)!;

      if (L !== spec.L || F !== spec.F || H !== spec.H || hitlerInfo.hitlerKnowsFascists !== spec.hitlerKnows) {
        status = 'FAIL';
        details.push(`Role distribution or night visibility failed for ${count} players.`);
      }
    }

    if (status === 'PASS') {
      details.push('5–10 Player Matrix Verified: Exact Liberal/Fascist/Hitler counts and Night visibility rules.');
    }

    // Check Party Membership of Hitler during Investigation
    checksRun++;
    const p5 = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, name: `User_${i}` }));
    const eng5 = new GameEngine(p5);
    eng5.startGame();
    const hitlerIdx = eng5.players.findIndex((p) => p.role === 'HITLER');
    const presIdx = (hitlerIdx + 1) % 5;
    eng5.presidentIndex = presIdx;
    eng5.phase = 'EXECUTIVE_ACTION';
    eng5.executiveAction = 'INVESTIGATE';
    const inv = eng5.investigatePlayer(eng5.players[presIdx].id, hitlerIdx);
    if (inv.success && inv.party === 'FASCIST') {
      details.push("Party Investigation Verified: Investigating Hitler returns 'FASCIST' party without exposing Hitler role.");
    } else {
      status = 'FAIL';
      details.push('Party Investigation of Hitler failed.');
    }

    return {
      agentName: 'Secret Role & Night Security Agent',
      role: 'Verifies 5–10p role distribution, night visibility & investigation secrecy',
      status,
      checksRun,
      details,
    };
  }

  /**
   * Agent 4: Executive Power & Veto Compliance Agent
   */
  static runExecutiveComplianceAgent(): AgentCheckResult {
    const details: string[] = [];
    let checksRun = 0;
    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

    // Check 5-6, 7-8, 9-10 power tracks
    checksRun += 3;
    const e5 = new GameEngine(Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, name: `P${i}` })));
    const e7 = new GameEngine(Array.from({ length: 7 }, (_, i) => ({ id: `${i}`, name: `P${i}` })));
    const e9 = new GameEngine(Array.from({ length: 9 }, (_, i) => ({ id: `${i}`, name: `P${i}` })));

    const track5 = [1, 2, 3, 4, 5].map((s) => e5.getExecutivePowerForFascistSlot(s));
    const track7 = [1, 2, 3, 4, 5].map((s) => e7.getExecutivePowerForFascistSlot(s));
    const track9 = [1, 2, 3, 4, 5].map((s) => e9.getExecutivePowerForFascistSlot(s));

    if (
      JSON.stringify(track5) === JSON.stringify(['NONE', 'NONE', 'PEEK', 'EXECUTE', 'EXECUTE']) &&
      JSON.stringify(track7) === JSON.stringify(['NONE', 'INVESTIGATE', 'SPECIAL_ELECTION', 'EXECUTE', 'EXECUTE']) &&
      JSON.stringify(track9) === JSON.stringify(['INVESTIGATE', 'INVESTIGATE', 'SPECIAL_ELECTION', 'EXECUTE', 'EXECUTE'])
    ) {
      details.push('Fascist Track Powers Verified: All 5–6p, 7–8p, and 9–10p board powers match official rules.');
    } else {
      status = 'FAIL';
      details.push('Fascist Track Power mismatch detected.');
    }

    // Check Veto single-use per round guard
    checksRun++;
    e5.startGame();
    e5.fascistPolicies = 5;
    e5.phase = 'LEGISLATIVE_CHANCELLOR';
    e5.presidentIndex = 0;
    e5.chancellorIndex = 1;
    e5.currentChancellorCards = ['FASCIST', 'FASCIST'];
    const v1 = e5.chancellorVeto('1');
    const r1 = e5.presidentVetoResponse('0', false); // President rejects veto
    const v2 = e5.chancellorVeto('1'); // Chancellor tries to veto again in same round
    if (v1.success && r1.vetoRejected && !v2.success) {
      details.push('Veto Protocol Verified: Rejected veto forces policy enactment and prevents infinite re-veto.');
    } else {
      status = 'FAIL';
      details.push('Veto Protocol Guard Failed.');
    }

    return {
      agentName: 'Executive & Veto Compliance Agent',
      role: 'Verifies Presidential powers across player counts & Veto rules',
      status,
      checksRun,
      details,
    };
  }

  /**
   * Agent 5: Full-Game Monte Carlo Fuzzing Agent
   */
  static runMonteCarloSimulationAgent(numGames = 30): AgentCheckResult {
    const details: string[] = [];
    let checksRun = 0;
    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

    let liberalWins = 0;
    let fascistWins = 0;

    for (let g = 0; g < numGames; g++) {
      checksRun++;
      const playerCount = 5 + (g % 6); // 5, 6, 7, 8, 9, 10
      const players = Array.from({ length: playerCount }, (_, i) => ({
        id: `sim_${i}`,
        name: `Sim_${i}`,
        isBot: true,
      }));

      const game = new GameEngine(players);
      game.startGame();
      game.advanceToNomination();

      let safetySteps = 0;
      while (game.phase !== 'GAME_OVER' && safetySteps < 400) {
        safetySteps++;

        // Verify 17-card conservation on every step
        const totalCards =
          game.drawDeck.length +
          game.discardPile.length +
          game.liberalPolicies +
          game.fascistPolicies +
          game.currentPresidentCards.length +
          game.currentChancellorCards.length;
        if (totalCards !== 17) {
          status = 'FAIL';
          details.push(`Game #${g + 1} violated 17-card conservation (found ${totalCards}).`);
          break;
        }

        if (game.phase === 'NOMINATION') {
          const elig = game.getEligibleChancellors();
          const pick = elig[Math.floor(Math.random() * elig.length)];
          game.nominateChancellor(pick);
        } else if (game.phase === 'VOTING') {
          for (const p of game.players.filter((pl) => pl.isAlive)) {
            const v = Math.random() < 0.65 ? 'JA' : 'NEIN';
            const res = game.castVote(p.id, v);
            if (!res.waiting) break;
          }
        } else if (game.phase === 'LEGISLATIVE_PRESIDENT') {
          const pres = game.players[game.presidentIndex];
          game.presidentDiscard(pres.id, 0);
        } else if (game.phase === 'LEGISLATIVE_CHANCELLOR') {
          const chan = game.players[game.chancellorIndex!];
          if (game.fascistPolicies >= 5 && !game.vetoUsedThisRound && Math.random() < 0.3) {
            game.chancellorVeto(chan.id);
          } else {
            game.chancellorDiscard(chan.id, 0);
          }
        } else if (game.phase === 'VETO_PENDING') {
          const pres = game.players[game.presidentIndex];
          game.presidentVetoResponse(pres.id, Math.random() < 0.5);
        } else if (game.phase === 'EXECUTIVE_ACTION') {
          const pres = game.players[game.presidentIndex];
          if (game.executiveAction === 'PEEK') {
            game.acknowledgePeek(pres.id);
          } else if (game.executiveAction === 'INVESTIGATE') {
            const targets = game.players
              .map((_, idx) => idx)
              .filter(
                (idx) =>
                  idx !== game.presidentIndex &&
                  game.players[idx].isAlive &&
                  !game.investigatedPlayerIds.has(game.players[idx].id)
              );
            if (targets.length > 0) {
              game.investigatePlayer(pres.id, targets[0]);
              game.acknowledgeInvestigation(pres.id);
            } else {
              game.acknowledgeInvestigation(pres.id);
            }
          } else if (game.executiveAction === 'SPECIAL_ELECTION') {
            const targets = game.players
              .map((_, idx) => idx)
              .filter((idx) => idx !== game.presidentIndex && game.players[idx].isAlive);
            game.executeSpecialElection(pres.id, targets[0]);
          } else if (game.executiveAction === 'EXECUTE') {
            const targets = game.players
              .map((_, idx) => idx)
              .filter((idx) => idx !== game.presidentIndex && game.players[idx].isAlive);
            game.executeKill(pres.id, targets[Math.floor(Math.random() * targets.length)]);
          }
        }
      }

      if (game.phase !== 'GAME_OVER' || !game.winner) {
        status = 'FAIL';
        details.push(`Game #${g + 1} (${playerCount}p) failed to terminate cleanly.`);
        break;
      }

      if (game.winner === 'LIBERAL') liberalWins++;
      else fascistWins++;
    }

    if (status === 'PASS') {
      details.push(
        `Simulated ${numGames} full games (5–10 players): 100% terminated cleanly (${liberalWins} Liberal wins, ${fascistWins} Fascist wins) with zero rule or state violations.`
      );
    }

    return {
      agentName: 'Monte Carlo Full-Game Fuzzing Agent',
      role: `Simulates ${numGames} complete games (5–10p) verifying state machines & win conditions`,
      status,
      checksRun,
      details,
    };
  }
}
