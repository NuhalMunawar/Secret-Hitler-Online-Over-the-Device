import { useState, useCallback } from 'react';
import { GameEngine } from '../game/GameEngine.js';
import { NightInfo, Policy, PublicGameState, Vote } from '../game/types.js';
import { sound } from '../utils/sound.js';

export interface OfflinePlayerEntry {
  id: string;
  name: string;
  isBot?: boolean;
}

export function useOfflineGame(
  showNotification: (message: string, type?: 'info' | 'alert' | 'success') => void
) {
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [offlinePlayers, setOfflinePlayers] = useState<OfflinePlayerEntry[]>([
    { id: 'off_1', name: 'Player 1' },
    { id: 'off_2', name: 'Player 2' },
    { id: 'off_3', name: 'Player 3' },
    { id: 'off_4', name: 'Player 4' },
    { id: 'off_5', name: 'Player 5' },
  ]);

  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [gameState, setGameState] = useState<PublicGameState | null>(null);

  // Privacy & Pass-Device state
  // During NIGHT phase, each human player inspects their envelope in sequence [0..N-1]
  const [nightPlayerIndex, setNightPlayerIndex] = useState<number>(0);
  // Whether the current active player has confirmed "I have the device" for secret actions
  const [privacyUnlocked, setPrivacyUnlocked] = useState<boolean>(false);

  // During VOTING phase, track which human player is currently holding the device to vote
  const [currentVoterIndex, setCurrentVoterIndex] = useState<number>(0);

  // Investigation result secret state for President
  const [investigationResult, setInvestigationResult] = useState<{
    targetIndex: number;
    party: 'LIBERAL' | 'FASCIST';
    targetName: string;
  } | null>(null);

  // Last election votes
  const [lastElectionVotes, setLastElectionVotes] = useState<{
    votes: Record<string, Vote>;
    passed: boolean;
    chaos?: boolean;
    chaosPolicy?: Policy;
  } | null>(null);

  // Game Over data
  const [gameOverData, setGameOverData] = useState<{
    winner: 'LIBERAL' | 'FASCIST';
    winReason: string;
    roles: Record<string, { role: string; party: string; name: string }>;
  } | null>(null);

  const syncEngineState = useCallback((eng: GameEngine) => {
    setGameState({ ...eng.getPublicState() });
  }, []);

  // Automatically process bot actions if any bot is included in offline mode
  const processBotActions = useCallback(
    (eng: GameEngine) => {
      if (eng.phase === 'GAME_OVER') return;

      // Bot Nomination
      if (eng.phase === 'NOMINATION') {
        const pres = eng.players[eng.presidentIndex];
        if (pres && pres.isBot && pres.isAlive) {
          const elig = eng.getEligibleChancellors();
          if (elig.length > 0) {
            const pick = elig[Math.floor(Math.random() * elig.length)];
            eng.nominateChancellor(pick);
            // Have all bots vote immediately
            for (const p of eng.players) {
              if (p.isAlive && p.isBot) {
                eng.castVote(p.id, Math.random() < 0.7 ? 'JA' : 'NEIN');
              }
            }
            const firstHumanIdx = eng.players.findIndex((p) => p.isAlive && !p.isBot && !eng.votes[p.id]);
            setCurrentVoterIndex(firstHumanIdx !== -1 ? firstHumanIdx : 0);
            setPrivacyUnlocked(false);
            syncEngineState(eng);
          }
        }
      }
      // Bot Legislative President
      else if (eng.phase === 'LEGISLATIVE_PRESIDENT') {
        const pres = eng.players[eng.presidentIndex];
        if (pres && pres.isBot) {
          let discardIdx = 0;
          if (pres.party === 'LIBERAL') {
            const fIdx = eng.currentPresidentCards.findIndex((c) => c === 'FASCIST');
            if (fIdx !== -1) discardIdx = fIdx;
          } else {
            const lIdx = eng.currentPresidentCards.findIndex((c) => c === 'LIBERAL');
            if (lIdx !== -1) discardIdx = lIdx;
          }
          eng.presidentDiscard(pres.id, discardIdx);
          setPrivacyUnlocked(false);
          syncEngineState(eng);
          processBotActions(eng);
        }
      }
      // Bot Legislative Chancellor
      else if (eng.phase === 'LEGISLATIVE_CHANCELLOR') {
        const chan = eng.players[eng.chancellorIndex!];
        if (chan && chan.isBot) {
          let discardIdx = 0;
          if (chan.party === 'LIBERAL') {
            const fIdx = eng.currentChancellorCards.findIndex((c) => c === 'FASCIST');
            if (fIdx !== -1) discardIdx = fIdx;
          } else {
            const lIdx = eng.currentChancellorCards.findIndex((c) => c === 'LIBERAL');
            if (lIdx !== -1) discardIdx = lIdx;
          }
          const res = eng.chancellorDiscard(chan.id, discardIdx);
          setPrivacyUnlocked(false);
          syncEngineState(eng);
          if (res.gameOver && res.winner) {
            sound.playVictory(res.winner);
            setGameOverData({
              winner: res.winner,
              winReason: res.winReason || '',
              roles: eng.getAllRoles(),
            });
          } else {
            if (res.policy === 'LIBERAL') sound.playLiberalPolicy();
            else sound.playFascistPolicy();
            showNotification(`A ${res.policy} Policy has been enacted!`, res.policy === 'LIBERAL' ? 'success' : 'alert');
            processBotActions(eng);
          }
        }
      }
      // Bot Executive Action
      else if (eng.phase === 'EXECUTIVE_ACTION') {
        const pres = eng.players[eng.presidentIndex];
        if (pres && pres.isBot) {
          if (eng.executiveAction === 'PEEK') {
            eng.acknowledgePeek(pres.id);
          } else if (eng.executiveAction === 'INVESTIGATE') {
            const targets = eng.players
              .map((_, i) => i)
              .filter(
                (i) =>
                  i !== eng.presidentIndex &&
                  eng.players[i].isAlive &&
                  !eng.investigatedPlayerIds.has(eng.players[i].id)
              );
            if (targets.length > 0) {
              eng.investigatePlayer(pres.id, targets[0]);
            }
            eng.acknowledgeInvestigation(pres.id);
          } else if (eng.executiveAction === 'SPECIAL_ELECTION') {
            const targets = eng.players
              .map((_, i) => i)
              .filter((i) => i !== eng.presidentIndex && eng.players[i].isAlive);
            if (targets.length > 0) {
              eng.executeSpecialElection(pres.id, targets[0]);
            }
          } else if (eng.executiveAction === 'EXECUTE') {
            const targets = eng.players
              .map((_, i) => i)
              .filter((i) => i !== eng.presidentIndex && eng.players[i].isAlive);
            if (targets.length > 0) {
              const target = targets[Math.floor(Math.random() * targets.length)];
              const killRes = eng.executeKill(pres.id, target);
              if (killRes.gameOver && killRes.winner) {
                sound.playVictory(killRes.winner);
                setGameOverData({
                  winner: killRes.winner,
                  winReason: killRes.winReason || '',
                  roles: eng.getAllRoles(),
                });
              } else {
                sound.playExecution();
                showNotification(`${killRes.killed} has been formally executed!`, 'alert');
              }
            }
          }
          setPrivacyUnlocked(false);
          syncEngineState(eng);
          processBotActions(eng);
        }
      }
    },
    [showNotification, syncEngineState]
  );

  // Start Offline Pass-and-Play Game
  const startOfflineGame = (customPlayers: OfflinePlayerEntry[]): { success: boolean; error?: string } => {
    const cleaned = customPlayers
      .map((p, idx) => ({
        id: p.id || `off_${idx + 1}`,
        name: p.name.trim(),
        isBot: Boolean(p.isBot),
      }))
      .filter((p) => p.name.length > 0);

    if (cleaned.length < 5) {
      return { success: false, error: `Need at least 5 players to start (currently ${cleaned.length}).` };
    }
    if (cleaned.length > 10) {
      return { success: false, error: 'Maximum 10 players allowed.' };
    }

    // Check duplicate names
    const lowerNames = cleaned.map((p) => p.name.toLowerCase());
    if (new Set(lowerNames).size !== lowerNames.length) {
      return { success: false, error: 'Each player must have a unique name.' };
    }

    const newEngine = new GameEngine(cleaned);
    const res = newEngine.startGame();
    if (!res.success) {
      return { success: false, error: res.error || 'Failed to start offline game' };
    }

    setOfflinePlayers(cleaned);
    setEngine(newEngine);
    setIsOfflineMode(true);
    setGameOverData(null);
    setLastElectionVotes(null);
    setInvestigationResult(null);

    // Find first human player for Night Phase envelope inspection
    const firstHuman = newEngine.players.findIndex((p) => !p.isBot);
    if (firstHuman !== -1) {
      setNightPlayerIndex(firstHuman);
      setPrivacyUnlocked(false);
      syncEngineState(newEngine);
    } else {
      newEngine.advanceToNomination();
      syncEngineState(newEngine);
      processBotActions(newEngine);
    }

    sound.playPaperSlide();
    showNotification('Pass & Play started! Pass the device around to inspect Secret Envelopes.', 'info');
    return { success: true };
  };

  // Advance sequential Night Phase inspection to next human player
  const advanceOfflineNightPlayer = () => {
    if (!engine) return;
    sound.playClick();
    setPrivacyUnlocked(false);

    let nextIdx = nightPlayerIndex + 1;
    while (nextIdx < engine.players.length && engine.players[nextIdx].isBot) {
      nextIdx++;
    }

    if (nextIdx < engine.players.length) {
      setNightPlayerIndex(nextIdx);
    } else {
      // All human players have inspected their envelopes!
      engine.advanceToNomination();
      syncEngineState(engine);
      processBotActions(engine);
      showNotification('All Secret Envelopes sealed! Round 1 Election begins.', 'success');
    }
  };

  const unlockPrivacy = () => {
    sound.playPaperSlide();
    setPrivacyUnlocked(true);
  };

  const lockPrivacy = () => {
    sound.playClick();
    setPrivacyUnlocked(false);
  };

  // Nominate Chancellor
  const nominateChancellor = (chancellorIndex: number) => {
    if (!engine) return;
    sound.playClick();
    const res = engine.nominateChancellor(chancellorIndex);
    if (!res.success) {
      showNotification(res.error || 'Nomination failed', 'alert');
      return;
    }

    // Bots cast their votes automatically
    for (const p of engine.players) {
      if (p.isAlive && p.isBot) {
        engine.castVote(p.id, Math.random() < 0.7 ? 'JA' : 'NEIN');
      }
    }

    const firstHumanVoter = engine.players.findIndex((p) => p.isAlive && !p.isBot && !engine.votes[p.id]);
    setCurrentVoterIndex(firstHumanVoter !== -1 ? firstHumanVoter : 0);
    setPrivacyUnlocked(false);
    syncEngineState(engine);
  };

  // Cast Vote for current active voter (or specific playerId)
  const castOfflineVote = (vote: Vote, specificPlayerId?: string) => {
    if (!engine) return;
    sound.playVoteCast();
    const voter = specificPlayerId
      ? engine.players.find((p) => p.id === specificPlayerId)
      : engine.players[currentVoterIndex];
    if (!voter) return;

    const res = engine.castVote(voter.id, vote);
    if (!res.success) {
      showNotification(res.error || 'Vote failed', 'alert');
      return;
    }

    setPrivacyUnlocked(false);

    if (res.waiting) {
      // Find next living unvoted human player
      const nextVoter = engine.players.findIndex((p) => p.isAlive && !p.isBot && !engine.votes[p.id]);
      if (nextVoter !== -1) {
        setCurrentVoterIndex(nextVoter);
      }
      syncEngineState(engine);
      return;
    }

    // All votes are in!
    sound.playGavel();
    syncEngineState(engine);

    if (res.gameOver && res.winner) {
      sound.playVictory(res.winner);
      setGameOverData({
        winner: res.winner,
        winReason: res.winReason || '',
        roles: engine.getAllRoles(),
      });
      return;
    }

    setLastElectionVotes({
      votes: res.votes || {},
      passed: Boolean(res.passed),
      chaos: res.chaos,
      chaosPolicy: res.chaosPolicy,
    });

    if (res.chaos) {
      sound.playFascistPolicy();
      showNotification(`3 Failed Elections — CHAOS! Top policy (${res.chaosPolicy}) enacted!`, 'alert');
    } else if (res.passed) {
      showNotification('Government elected! Pass device to the President.', 'success');
    } else {
      showNotification('Vote failed! Presidency rotates clockwise.', 'info');
    }

    processBotActions(engine);
  };

  // Quick Table Vote (when players vote out loud / by show of hands in the room)
  const resolveQuickTableVote = (passed: boolean) => {
    if (!engine || engine.phase !== 'VOTING') return;
    sound.playGavel();
    const alive = engine.players.filter((p) => p.isAlive);
    for (const p of alive) {
      if (!engine.votes[p.id]) {
        const res = engine.castVote(p.id, passed ? 'JA' : 'NEIN');
        if (!res.waiting) {
          syncEngineState(engine);
          if (res.gameOver && res.winner) {
            sound.playVictory(res.winner);
            setGameOverData({
              winner: res.winner,
              winReason: res.winReason || '',
              roles: engine.getAllRoles(),
            });
            return;
          }
          setLastElectionVotes({
            votes: res.votes || {},
            passed: Boolean(res.passed),
            chaos: res.chaos,
            chaosPolicy: res.chaosPolicy,
          });
          if (res.chaos) {
            sound.playFascistPolicy();
            showNotification(`3 Failed Elections — CHAOS! Top policy (${res.chaosPolicy}) enacted!`, 'alert');
          } else if (res.passed) {
            showNotification('Government elected! Pass device to the President.', 'success');
          } else {
            showNotification('Vote failed! Presidency rotates clockwise.', 'info');
          }
          processBotActions(engine);
          break;
        }
      }
    }
  };

  // President Discard
  const presidentDiscard = (cardIndex: number) => {
    if (!engine) return;
    sound.playPaperSlide();
    const pres = engine.players[engine.presidentIndex];
    const res = engine.presidentDiscard(pres.id, cardIndex);
    if (!res.success) {
      showNotification(res.error || 'Discard failed', 'alert');
      return;
    }
    // Immediately lock screen so President can pass device to Chancellor without leaking the 2 tiles
    setPrivacyUnlocked(false);
    syncEngineState(engine);
    processBotActions(engine);
  };

  // Chancellor Discard (Enact)
  const chancellorDiscard = (cardIndex: number) => {
    if (!engine) return;
    sound.playPaperSlide();
    const chan = engine.players[engine.chancellorIndex!];
    const res = engine.chancellorDiscard(chan.id, cardIndex);
    if (!res.success) {
      showNotification(res.error || 'Enact failed', 'alert');
      return;
    }
    setPrivacyUnlocked(false);
    syncEngineState(engine);

    if (res.gameOver && res.winner) {
      sound.playVictory(res.winner);
      setGameOverData({
        winner: res.winner,
        winReason: res.winReason || '',
        roles: engine.getAllRoles(),
      });
      return;
    }

    if (res.policy === 'LIBERAL') sound.playLiberalPolicy();
    else sound.playFascistPolicy();

    showNotification(`A ${res.policy} Policy has been enacted!`, res.policy === 'LIBERAL' ? 'success' : 'alert');
    processBotActions(engine);
  };

  // Chancellor Veto
  const chancellorVeto = () => {
    if (!engine) return;
    sound.playGavel();
    const chan = engine.players[engine.chancellorIndex!];
    const res = engine.chancellorVeto(chan.id);
    if (!res.success) {
      showNotification(res.error || 'Veto failed', 'alert');
      return;
    }
    setPrivacyUnlocked(false);
    syncEngineState(engine);
    showNotification('Chancellor proposed a Veto! Pass device to the President.', 'alert');
    processBotActions(engine);
  };

  // President Veto Response
  const presidentVetoResponse = (accept: boolean) => {
    if (!engine) return;
    sound.playGavel();
    const pres = engine.players[engine.presidentIndex];
    const res = engine.presidentVetoResponse(pres.id, accept);
    if (!res.success) {
      showNotification(res.error || 'Veto response failed', 'alert');
      return;
    }
    setPrivacyUnlocked(false);
    syncEngineState(engine);

    if (res.gameOver && res.winner) {
      sound.playVictory(res.winner);
      setGameOverData({
        winner: res.winner,
        winReason: res.winReason || '',
        roles: engine.getAllRoles(),
      });
      return;
    }

    if (res.vetoed) {
      showNotification('Veto agreed! Both policy tiles discarded.', 'info');
    } else if (res.vetoRejected) {
      showNotification('President refused Veto! Pass device back to Chancellor to enact a policy.', 'alert');
    }
    processBotActions(engine);
  };

  // Executive Actions
  const acknowledgePeek = () => {
    if (!engine) return;
    sound.playClick();
    const pres = engine.players[engine.presidentIndex];
    engine.acknowledgePeek(pres.id);
    setPrivacyUnlocked(false);
    syncEngineState(engine);
    processBotActions(engine);
  };

  const investigatePlayer = (targetIndex: number) => {
    if (!engine) return;
    sound.playPaperSlide();
    const pres = engine.players[engine.presidentIndex];
    const res = engine.investigatePlayer(pres.id, targetIndex);
    if (res.success && res.party && res.targetName) {
      setInvestigationResult({
        targetIndex: res.targetIndex!,
        party: res.party,
        targetName: res.targetName,
      });
      syncEngineState(engine);
    } else {
      showNotification(res.error || 'Investigation failed', 'alert');
    }
  };

  const acknowledgeInvestigation = () => {
    if (!engine) return;
    sound.playClick();
    const pres = engine.players[engine.presidentIndex];
    engine.acknowledgeInvestigation(pres.id);
    setInvestigationResult(null);
    setPrivacyUnlocked(false);
    syncEngineState(engine);
    processBotActions(engine);
  };

  const specialElection = (targetIndex: number) => {
    if (!engine) return;
    sound.playGavel();
    const pres = engine.players[engine.presidentIndex];
    const res = engine.executeSpecialElection(pres.id, targetIndex);
    if (!res.success) {
      showNotification(res.error || 'Special election failed', 'alert');
      return;
    }
    setPrivacyUnlocked(false);
    syncEngineState(engine);
    processBotActions(engine);
  };

  const executePlayer = (targetIndex: number) => {
    if (!engine) return;
    sound.playExecution();
    const pres = engine.players[engine.presidentIndex];
    const res = engine.executeKill(pres.id, targetIndex);
    if (!res.success) {
      showNotification(res.error || 'Execution failed', 'alert');
      return;
    }
    setPrivacyUnlocked(false);
    syncEngineState(engine);

    if (res.gameOver && res.winner) {
      sound.playVictory(res.winner);
      setGameOverData({
        winner: res.winner,
        winReason: res.winReason || '',
        roles: engine.getAllRoles(),
      });
    } else {
      showNotification(`${res.killed} has been formally executed!`, 'alert');
      processBotActions(engine);
    }
  };

  const restartOfflineGame = () => {
    startOfflineGame(offlinePlayers);
  };

  const exitOfflineMode = () => {
    sound.playClick();
    setIsOfflineMode(false);
    setEngine(null);
    setGameState(null);
    setGameOverData(null);
    setPrivacyUnlocked(false);
  };

  const getNightInfoForPlayerId = (playerId: string): NightInfo | null => {
    if (!engine) return null;
    return engine.getNightInfoForPlayer(playerId);
  };

  // Determine who currently holds the device in Pass-and-Play
  const getActiveActorPlayer = () => {
    if (!engine || !gameState) return null;
    if (gameState.phase === 'NIGHT') {
      return gameState.players[nightPlayerIndex] || gameState.players[0];
    }
    if (gameState.phase === 'VOTING') {
      return gameState.players[currentVoterIndex] || gameState.players[gameState.presidentIndex];
    }
    if (gameState.phase === 'LEGISLATIVE_CHANCELLOR' && gameState.chancellorIndex !== null) {
      return gameState.players[gameState.chancellorIndex];
    }
    return gameState.players[gameState.presidentIndex];
  };

  const activeActor = getActiveActorPlayer();
  const currentPres = engine ? engine.players[engine.presidentIndex] : null;
  const currentChan =
    engine && engine.chancellorIndex !== null ? engine.players[engine.chancellorIndex] : null;

  return {
    isOfflineMode,
    offlinePlayers,
    setOfflinePlayers,
    gameState,
    activeActorId: activeActor?.id || null,
    activeActorName: activeActor?.name || '',
    nightPlayerIndex,
    currentVoterIndex,
    privacyUnlocked,
    unlockPrivacy,
    lockPrivacy,
    advanceOfflineNightPlayer,
    getNightInfoForPlayerId,
    presidentCards:
      engine && gameState?.phase === 'LEGISLATIVE_PRESIDENT' && privacyUnlocked
        ? engine.currentPresidentCards
        : null,
    chancellorCards:
      engine && gameState?.phase === 'LEGISLATIVE_CHANCELLOR' && privacyUnlocked
        ? engine.currentChancellorCards
        : null,
    canVeto:
      Boolean(engine && engine.fascistPolicies >= 5 && !engine.vetoUsedThisRound && currentChan),
    peekCards:
      engine &&
      gameState?.phase === 'EXECUTIVE_ACTION' &&
      gameState.executiveAction === 'PEEK' &&
      privacyUnlocked &&
      currentPres
        ? engine.getPeekCards(currentPres.id).cards || null
        : null,
    investigationResult,
    lastElectionVotes,
    gameOverData,
    startOfflineGame,
    nominateChancellor,
    castOfflineVote,
    resolveQuickTableVote,
    presidentDiscard,
    chancellorDiscard,
    chancellorVeto,
    presidentVetoResponse,
    acknowledgePeek,
    investigatePlayer,
    acknowledgeInvestigation,
    specialElection,
    executePlayer,
    restartOfflineGame,
    exitOfflineMode,
  };
}
