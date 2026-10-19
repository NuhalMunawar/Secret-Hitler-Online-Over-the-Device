import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  AgentCheckResult,
  HitlerSuspenseCheck,
  NightInfo,
  Policy,
  PublicGameState,
  Spectator,
  Vote,
} from '../game/types.js';
import { sound } from '../utils/sound.js';

export interface RoomMember {
  id: string;
  name: string;
  isHost: boolean;
  isBot?: boolean;
}

export function useGameSocket() {
  const [connected, setConnected] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const [isHost, setIsHost] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [players, setPlayers] = useState<RoomMember[]>([]);
  const [spectators, setSpectators] = useState<Spectator[]>([]);
  const [gameState, setGameState] = useState<PublicGameState | null>(null);

  // Private state
  const [nightInfo, setNightInfo] = useState<NightInfo | null>(null);
  const [showNightModal, setShowNightModal] = useState(false);
  const [presidentCards, setPresidentCards] = useState<Policy[] | null>(null);
  const [chancellorCards, setChancellorCards] = useState<Policy[] | null>(null);
  const [canVeto, setCanVeto] = useState(false);
  const [peekCards, setPeekCards] = useState<Policy[] | null>(null);
  const [investigationResult, setInvestigationResult] = useState<{
    targetIndex: number;
    party: 'LIBERAL' | 'FASCIST';
    targetName: string;
  } | null>(null);

  // Voting progress & suspense
  const [voteProgress, setVoteProgress] = useState<{ votesIn: number; votesNeeded: number } | null>(null);
  const [lastElectionVotes, setLastElectionVotes] = useState<{
    votes: Record<string, Vote>;
    passed: boolean;
    chaos?: boolean;
    chaosPolicy?: Policy;
  } | null>(null);
  const [chancellorSuspenseCheck, setChancellorSuspenseCheck] =
    useState<HitlerSuspenseCheck | null>(null);

  // Game over state
  const [gameOverData, setGameOverData] = useState<{
    winner: 'LIBERAL' | 'FASCIST';
    winReason: string;
    roles: Record<string, { role: string; party: string; name: string }>;
  } | null>(null);

  const [notification, setNotification] = useState<{
    message: string;
    type: 'info' | 'alert' | 'success';
  } | null>(null);

  const socketRef = useRef<Socket | null>(null);

  const showNotification = useCallback(
    (message: string, type: 'info' | 'alert' | 'success' = 'info') => {
      setNotification({ message, type });
      setTimeout(() => {
        setNotification((curr) => (curr?.message === message ? null : curr));
      }, 4500);
    },
    []
  );

  useEffect(() => {
    const savedCode = localStorage.getItem('sh_room_code');
    const savedName = localStorage.getItem('sh_player_name');
    const savedId = localStorage.getItem('sh_player_id');

    if (savedName) setPlayerName(savedName);

    const socket = io(window.location.origin, {
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);

      if (savedCode && savedName) {
        socket.emit(
          'reconnect-room',
          { roomCode: savedCode, playerName: savedName, playerId: savedId },
          (res: any) => {
            if (res.success) {
              setRoomCode(res.roomCode);
              setPlayerId(res.playerId);
              setIsHost(Boolean(res.isHost));
              setIsSpectator(Boolean(res.isSpectator));
              setPlayers(res.players || []);
              setSpectators(res.spectators || []);
              if (res.gameState) setGameState(res.gameState);
              if (res.nightInfo) setNightInfo(res.nightInfo);
            }
          }
        );
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on(
      'player-joined',
      (data: {
        players: RoomMember[];
        spectators?: Spectator[];
        playerName: string;
        isSpectator?: boolean;
      }) => {
        setPlayers(data.players);
        if (data.spectators) setSpectators(data.spectators);
        sound.playClick();
        showNotification(
          data.isSpectator
            ? `${data.playerName} joined as a Spectator.`
            : `${data.playerName} joined the room.`,
          'info'
        );
      }
    );

    socket.on('lobby-updated', (data: { players: RoomMember[]; spectators?: Spectator[] }) => {
      setPlayers(data.players);
      if (data.spectators) setSpectators(data.spectators);
    });

    socket.on(
      'game-started',
      (data: { nightInfo: NightInfo | null; state: PublicGameState; isSpectator?: boolean }) => {
        setNightInfo(data.nightInfo);
        setGameState(data.state);
        if (!data.isSpectator && data.nightInfo) {
          setShowNightModal(true);
        }
        setGameOverData(null);
        setLastElectionVotes(null);
        setChancellorSuspenseCheck(null);
        sound.playCardShuffle();
        showNotification(
          data.isSpectator
            ? 'Game started! You are spectating.'
            : 'Roles & policy deck shuffled! Inspect your secret envelope.',
          'alert'
        );
      }
    );

    socket.on('state-update', (data: { state: PublicGameState }) => {
      setGameState(data.state);
      setVoteProgress(null);
    });

    socket.on(
      'vote-progress',
      (data: { votesIn: number; votesNeeded: number; state?: PublicGameState }) => {
        setVoteProgress({ votesIn: data.votesIn, votesNeeded: data.votesNeeded });
        if (data.state) setGameState(data.state);
        sound.playVoteCast();
      }
    );

    socket.on(
      'election-result',
      (data: {
        passed: boolean;
        votes: Record<string, Vote>;
        chaos?: boolean;
        chaosPolicy?: Policy;
        hitlerCheck?: HitlerSuspenseCheck;
        deckReshuffled?: boolean;
        state: PublicGameState;
      }) => {
        setGameState(data.state);
        setLastElectionVotes({
          votes: data.votes,
          passed: data.passed,
          chaos: data.chaos,
          chaosPolicy: data.chaosPolicy,
        });
        setVoteProgress(null);

        if (data.hitlerCheck) {
          setChancellorSuspenseCheck(data.hitlerCheck);
        } else {
          sound.playVoteResult(data.passed);
        }

        if (data.deckReshuffled) {
          setTimeout(() => sound.playCardShuffle(), 450);
        }

        if (data.chaos) {
          sound.playChaos();
          showNotification(
            `3 Failed Elections — CHAOS! Top policy (${data.chaosPolicy}) enacted!`,
            'alert'
          );
        } else if (data.passed) {
          showNotification('Government elected! Legislative session begins.', 'success');
        } else {
          showNotification('Vote failed. Presidency passes clockwise.', 'info');
        }
      }
    );

    socket.on('president-cards', (data: { cards: Policy[] }) => {
      setPresidentCards(data.cards);
      sound.playPaperSlide();
      showNotification('You drew 3 Policy tiles. Choose 1 to discard.', 'alert');
    });

    socket.on('chancellor-cards', (data: { cards: Policy[]; vetoAvailable?: boolean }) => {
      setChancellorCards(data.cards);
      setCanVeto(Boolean(data.vetoAvailable));
      sound.playPaperSlide();
      showNotification('You received 2 Policy tiles. Choose 1 to enact.', 'alert');
    });

    socket.on(
      'policy-enacted',
      (data: {
        policy: Policy;
        state: PublicGameState;
        executiveAction: string;
        deckReshuffled?: boolean;
      }) => {
        setGameState(data.state);
        setPresidentCards(null);
        setChancellorCards(null);
        if (data.policy === 'LIBERAL') {
          sound.playLiberalPolicy();
        } else {
          sound.playFascistPolicy();
        }
        if (data.deckReshuffled) {
          setTimeout(() => sound.playCardShuffle(), 500);
        }
        showNotification(
          `A ${data.policy} Policy has been enacted!`,
          data.policy === 'LIBERAL' ? 'success' : 'alert'
        );
      }
    );

    socket.on('peek-cards', (data: { cards: Policy[] }) => {
      setPeekCards(data.cards);
      sound.playInvestigation();
    });

    socket.on('veto-proposed', (data: { state: PublicGameState }) => {
      setGameState(data.state);
      sound.playGavel();
      showNotification('Chancellor proposed a VETO!', 'alert');
    });

    socket.on('veto-accepted', (data: { state: PublicGameState; deckReshuffled?: boolean }) => {
      setGameState(data.state);
      setPresidentCards(null);
      setChancellorCards(null);
      sound.playGavel();
      if (data.deckReshuffled) {
        setTimeout(() => sound.playCardShuffle(), 400);
      }
      showNotification('Veto agreed! Both policy tiles discarded.', 'info');
    });

    socket.on('veto-rejected', (data: { state: PublicGameState }) => {
      setGameState(data.state);
      sound.playGavel();
      showNotification('President rejected the Veto. Chancellor must enact a policy.', 'alert');
    });

    socket.on(
      'player-executed',
      (data: { killed: string; hitlerCheck?: HitlerSuspenseCheck; state: PublicGameState }) => {
        setGameState(data.state);
        sound.playExecution();
        if (data.hitlerCheck) {
          setChancellorSuspenseCheck(data.hitlerCheck);
        }
        showNotification(`${data.killed} has been formally executed!`, 'alert');
      }
    );

    socket.on(
      'game-over',
      (data: {
        state: PublicGameState;
        winner: 'LIBERAL' | 'FASCIST';
        winReason: string;
        roles: any;
        hitlerCheck?: HitlerSuspenseCheck;
        votes?: Record<string, Vote>;
      }) => {
        setGameState(data.state);
        if (data.votes) {
          setLastElectionVotes({
            votes: data.votes,
            passed: true,
          });
        }
        if (data.hitlerCheck) {
          setChancellorSuspenseCheck(data.hitlerCheck);
        } else {
          sound.playVictory(data.winner);
        }
        setGameOverData({
          winner: data.winner,
          winReason: data.winReason,
          roles: data.roles,
        });
        setPresidentCards(null);
        setChancellorCards(null);
        setPeekCards(null);
        setInvestigationResult(null);
      }
    );

    socket.on('game-reset', (data: { players: RoomMember[]; spectators?: Spectator[] }) => {
      setGameState(null);
      setPlayers(data.players);
      if (data.spectators) setSpectators(data.spectators);
      setGameOverData(null);
      setNightInfo(null);
      setPresidentCards(null);
      setChancellorCards(null);
      setPeekCards(null);
      setInvestigationResult(null);
      setChancellorSuspenseCheck(null);
      sound.playClick();
      showNotification('Room reset to lobby for a new game.', 'info');
    });

    return () => {
      socket.disconnect();
    };
  }, [showNotification]);

  const createRoom = (name: string): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      if (!socketRef.current) return resolve({ success: false, error: 'Connecting to server...' });
      socketRef.current.emit('create-room', { playerName: name }, (res: any) => {
        if (res.success) {
          sound.playClick();
          setRoomCode(res.roomCode);
          setPlayerId(res.playerId);
          setPlayerName(name);
          setIsHost(true);
          setIsSpectator(false);
          setPlayers(res.players || []);
          setSpectators(res.spectators || []);
          localStorage.setItem('sh_room_code', res.roomCode);
          localStorage.setItem('sh_player_name', name);
          localStorage.setItem('sh_player_id', res.playerId);
          resolve({ success: true });
        } else {
          resolve({ success: false, error: res.error });
        }
      });
    });
  };

  const joinRoom = (code: string, name: string): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      if (!socketRef.current) return resolve({ success: false, error: 'Connecting to server...' });
      socketRef.current.emit('join-room', { roomCode: code, playerName: name }, (res: any) => {
        if (res.success) {
          sound.playClick();
          setRoomCode(res.roomCode);
          setPlayerId(res.playerId);
          setPlayerName(name);
          setIsHost(false);
          setIsSpectator(Boolean(res.isSpectator));
          setPlayers(res.players || []);
          setSpectators(res.spectators || []);
          if (res.gameState) setGameState(res.gameState);
          localStorage.setItem('sh_room_code', res.roomCode);
          localStorage.setItem('sh_player_name', name);
          localStorage.setItem('sh_player_id', res.playerId);
          if (res.isSpectator) {
            showNotification('Game is already in progress — you joined as a Spectator.', 'info');
          }
          resolve({ success: true });
        } else {
          resolve({ success: false, error: res.error });
        }
      });
    });
  };

  const leaveRoom = () => {
    sound.playClick();
    localStorage.removeItem('sh_room_code');
    setRoomCode(null);
    setIsSpectator(false);
    setGameState(null);
    setNightInfo(null);
    setGameOverData(null);
    setChancellorSuspenseCheck(null);
    window.history.replaceState({}, '', window.location.pathname);
  };

  const addBot = () => {
    sound.playClick();
    socketRef.current?.emit('add-bot', {}, (res: any) => {
      if (!res.success) showNotification(res.error || 'Failed to add bot', 'alert');
    });
  };

  const removeBot = (botId: string) => {
    sound.playClick();
    socketRef.current?.emit('remove-bot', { botId }, (res: any) => {
      if (!res.success) showNotification(res.error || 'Failed to remove bot', 'alert');
    });
  };

  const startGame = () => {
    sound.playCardShuffle();
    socketRef.current?.emit('start-game', {}, (res: any) => {
      if (res.success) {
        if (res.nightInfo) setNightInfo(res.nightInfo);
        if (res.state) setGameState(res.state);
        setShowNightModal(true);
        setGameOverData(null);
        setLastElectionVotes(null);
        setChancellorSuspenseCheck(null);
        showNotification('Roles & policy deck shuffled! Inspect your secret envelope.', 'alert');
      } else {
        showNotification(res.error || 'Could not start game', 'alert');
      }
    });
  };

  const completeNight = () => {
    sound.playClick();
    setShowNightModal(false);
    socketRef.current?.emit('night-complete', {}, (res: any) => {
      if (!res.success) console.warn(res.error);
    });
  };

  const nominateChancellor = (index: number) => {
    sound.playClick();
    socketRef.current?.emit('nominate-chancellor', { chancellorIndex: index }, (res: any) => {
      if (!res.success) showNotification(res.error || 'Nomination failed', 'alert');
    });
  };

  const castVote = (vote: Vote) => {
    sound.playVoteCast();
    socketRef.current?.emit('cast-vote', { vote }, (res: any) => {
      if (!res.success) showNotification(res.error || 'Vote failed', 'alert');
    });
  };

  const presidentDiscard = (index: number) => {
    sound.playPaperSlide();
    socketRef.current?.emit('president-discard', { cardIndex: index }, (res: any) => {
      if (res.success) setPresidentCards(null);
      else showNotification(res.error || 'Discard failed', 'alert');
    });
  };

  const chancellorDiscard = (index: number) => {
    sound.playPaperSlide();
    socketRef.current?.emit('chancellor-discard', { cardIndex: index }, (res: any) => {
      if (res.success) setChancellorCards(null);
      else showNotification(res.error || 'Enact failed', 'alert');
    });
  };

  const chancellorVeto = () => {
    sound.playGavel();
    socketRef.current?.emit('chancellor-veto', {}, (res: any) => {
      if (!res.success) showNotification(res.error || 'Veto request failed', 'alert');
    });
  };

  const presidentVetoResponse = (accept: boolean) => {
    sound.playGavel();
    socketRef.current?.emit('president-veto-response', { accept }, (res: any) => {
      if (!res.success) showNotification(res.error || 'Veto response failed', 'alert');
    });
  };

  const acknowledgePeek = () => {
    sound.playClick();
    setPeekCards(null);
    socketRef.current?.emit('acknowledge-peek', {}, () => {});
  };

  const investigatePlayer = (targetIndex: number) => {
    sound.playInvestigation();
    socketRef.current?.emit('investigate-player', { targetIndex }, (res: any) => {
      if (res.success) {
        setInvestigationResult({
          targetIndex: res.targetIndex,
          party: res.party,
          targetName: res.targetName,
        });
      } else {
        showNotification(res.error || 'Investigation failed', 'alert');
      }
    });
  };

  const acknowledgeInvestigation = () => {
    sound.playClick();
    setInvestigationResult(null);
    socketRef.current?.emit('acknowledge-investigation', {}, () => {});
  };

  const specialElection = (targetIndex: number) => {
    sound.playGavel();
    socketRef.current?.emit('special-election', { targetIndex }, (res: any) => {
      if (!res.success) showNotification(res.error || 'Special election failed', 'alert');
    });
  };

  const executePlayer = (targetIndex: number) => {
    sound.playExecution();
    socketRef.current?.emit('execute-player', { targetIndex }, (res: any) => {
      if (!res.success) showNotification(res.error || 'Execution failed', 'alert');
    });
  };

  const restartGame = () => {
    sound.playClick();
    socketRef.current?.emit('restart-game', {}, (res: any) => {
      if (!res.success) showNotification(res.error || 'Restart failed', 'alert');
    });
  };

  const dismissChancellorSuspense = () => {
    setChancellorSuspenseCheck(null);
  };

  const runServerDiagnostics = (): Promise<AgentCheckResult[] | null> => {
    return new Promise((resolve) => {
      if (!socketRef.current || !connected) return resolve(null);
      socketRef.current.emit('run-diagnostics', {}, (res: any) => {
        if (res?.success && res.results) resolve(res.results);
        else resolve(null);
      });
    });
  };

  return {
    connected,
    roomCode,
    playerId,
    playerName,
    isHost,
    isSpectator,
    players,
    spectators,
    gameState,
    nightInfo,
    showNightModal,
    setShowNightModal,
    presidentCards,
    chancellorCards,
    canVeto,
    peekCards,
    investigationResult,
    voteProgress,
    lastElectionVotes,
    chancellorSuspenseCheck,
    dismissChancellorSuspense,
    gameOverData,
    notification,
    eligibleChancellors: gameState?.eligibleChancellors || [],
    createRoom,
    joinRoom,
    leaveRoom,
    addBot,
    removeBot,
    startGame,
    completeNight,
    nominateChancellor,
    castVote,
    presidentDiscard,
    chancellorDiscard,
    chancellorVeto,
    presidentVetoResponse,
    acknowledgePeek,
    investigatePlayer,
    acknowledgeInvestigation,
    specialElection,
    executePlayer,
    restartGame,
    runServerDiagnostics,
    showNotification,
  };
}
