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
import { PolicyEnactedEvent } from '../components/PolicyEnactmentModal.js';

export interface RoomMember {
  id: string;
  name: string;
  isHost: boolean;
  isBot?: boolean;
  connected?: boolean;
}

export interface PublicRoomSummary {
  roomCode: string;
  hostName: string;
  playerCount: number;
  humanCount: number;
  botCount: number;
  spectatorCount: number;
  started: boolean;
  isPrivate?: boolean;
  phase: string;
  roundNumber: number;
  liberalPolicies: number;
  fascistPolicies: number;
  createdAt: number;
  updatedAt: number;
  revision: number;
  liveUrl: string;
  players: RoomMember[];
}

export interface LiveRoomSnapshot {
  success: boolean;
  roomCode: string;
  liveUrl: string;
  revision: number;
  updatedAt: number;
  started: boolean;
  isPrivate?: boolean;
  hostId: string;
  isHost: boolean;
  isSpectator: boolean;
  isSeatedPlayer: boolean;
  players: RoomMember[];
  spectators: Spectator[];
  gameState: PublicGameState | null;
  voteProgress: { votesIn: number; votesNeeded: number } | null;
  lastElectionVotes: {
    votes: Record<string, Vote>;
    passed: boolean;
    chaos?: boolean;
    chaosPolicy?: Policy;
  } | null;
  lastHitlerCheck: { id: string; check: HitlerSuspenseCheck } | null;
  gameOverData: {
    winner: 'LIBERAL' | 'FASCIST';
    winReason: string;
    roles: Record<string, { role: string; party: string; name: string }>;
  } | null;
  privateState?: {
    playerId: string;
    nightInfo: NightInfo | null;
    presidentCards: Policy[] | null;
    chancellorCards: Policy[] | null;
    canVeto: boolean;
    peekCards: Policy[] | null;
    investigationResult: {
      targetIndex: number;
      party: 'LIBERAL' | 'FASCIST';
      targetName: string;
    } | null;
  } | null;
}

function extractRoomCodeFromUrl(): string | null {
  const pathMatch = window.location.pathname.match(/^\/live\/([A-Za-z0-9]{4})/i);
  if (pathMatch && pathMatch[1]) {
    return pathMatch[1].toUpperCase();
  }
  const params = new URLSearchParams(window.location.search);
  const queryCode = params.get('room') || params.get('live');
  if (queryCode && queryCode.trim().length === 4) {
    return queryCode.trim().toUpperCase();
  }
  return null;
}

function setBrowserLiveUrl(code: string | null) {
  try {
    if (code) {
      const clean = code.toUpperCase().trim();
      window.history.replaceState({}, '', `/live/${clean}?room=${clean}`);
    } else {
      window.history.replaceState({}, '', '/');
    }
  } catch {
    // Ignore history errors in restricted iframes
  }
}

export function useGameSocket() {
  const [connected, setConnected] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isPrivateRoom, setIsPrivateRoom] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const [isHost, setIsHost] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [players, setPlayers] = useState<RoomMember[]>([]);
  const [spectators, setSpectators] = useState<Spectator[]>([]);
  const [gameState, setGameState] = useState<PublicGameState | null>(null);

  // Public live rooms & live room page preview (when entering a code or visiting /live/:code before joining)
  const [publicRooms, setPublicRooms] = useState<PublicRoomSummary[]>([]);
  const [liveRoomPreview, setLiveRoomPreview] = useState<LiveRoomSnapshot | null>(null);

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
  const [enactedPolicyEvent, setEnactedPolicyEvent] = useState<PolicyEnactedEvent | null>(null);

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
  const roomCodeRef = useRef<string | null>(null);
  const playerIdRef = useRef<string | null>(null);
  const playerNameRef = useRef<string>('');
  const lastSeenHitlerCheckIdRef = useRef<string | null>(null);
  const hasShownNightForRoundRef = useRef<boolean>(false);
  const prevPolicyCountsRef = useRef<{ lib: number; fas: number } | null>(null);
  const lastEnactedKeyRef = useRef<string | null>(null);

  roomCodeRef.current = roomCode;
  playerIdRef.current = playerId;
  playerNameRef.current = playerName;

  const showNotification = useCallback(
    (message: string, type: 'info' | 'alert' | 'success' = 'info') => {
      setNotification({ message, type });
      setTimeout(() => {
        setNotification((curr) => (curr?.message === message ? null : curr));
      }, 4500);
    },
    []
  );

  // Apply authoritative LiveRoomSnapshot from /api/live/:code or socket sync
  const applyLiveSnapshot = useCallback(
    (snap: LiveRoomSnapshot) => {
      if (!snap || !snap.success) return;

      const currentPid = snap.privateState?.playerId || playerIdRef.current;
      // Check if this player was removed from the lobby by the host
      if (
        roomCodeRef.current &&
        snap.roomCode === roomCodeRef.current &&
        currentPid &&
        !snap.started
      ) {
        const stillInPlayers = (snap.players || []).some((p) => p.id === currentPid);
        const stillInSpectators = (snap.spectators || []).some((s) => s.id === currentPid);
        if (!stillInPlayers && !stillInSpectators) {
          localStorage.removeItem('sh_room_code');
          localStorage.removeItem('sh_player_id');
          roomCodeRef.current = null;
          playerIdRef.current = null;
          setRoomCode(null);
          setPlayerId(null);
          setIsHost(false);
          setIsSpectator(false);
          setPlayers([]);
          setSpectators([]);
          setGameState(null);
          setBrowserLiveUrl(null);
          showNotification('You were removed from the room by the host.', 'alert');
          return;
        }
      }

      setLastSyncedAt(Date.now());
      setConnected(true);
      setIsPrivateRoom(Boolean(snap.isPrivate));
      setPlayers(snap.players || []);
      setSpectators(snap.spectators || []);
      const computedIsHost = currentPid
        ? snap.hostId === currentPid ||
          (snap.players || []).some((p) => p.id === currentPid && p.isHost)
        : Boolean(snap.isHost);
      setIsHost(computedIsHost);
      setIsSpectator(Boolean(snap.isSpectator));
      setGameState(snap.gameState || null);
      setVoteProgress(snap.voteProgress || null);

      if (snap.gameState) {
        const curLib = snap.gameState.liberalPolicies;
        const curFas = snap.gameState.fascistPolicies;
        const prev = prevPolicyCountsRef.current;
        if (prev && snap.gameState.phase !== 'GAME_OVER') {
          const key = `${curLib}-${curFas}`;
          if (curLib > prev.lib && lastEnactedKeyRef.current !== key) {
            lastEnactedKeyRef.current = key;
            setEnactedPolicyEvent({
              policy: 'LIBERAL',
              slotNumber: curLib,
              executiveAction: snap.gameState.executiveAction,
            });
          } else if (curFas > prev.fas && lastEnactedKeyRef.current !== key) {
            lastEnactedKeyRef.current = key;
            setEnactedPolicyEvent({
              policy: 'FASCIST',
              slotNumber: curFas,
              executiveAction: snap.gameState.executiveAction,
            });
          }
        }
        prevPolicyCountsRef.current = { lib: curLib, fas: curFas };
      } else {
        prevPolicyCountsRef.current = null;
        lastEnactedKeyRef.current = null;
      }

      if (snap.lastElectionVotes) {
        setLastElectionVotes(snap.lastElectionVotes);
      } else if (!snap.gameState) {
        setLastElectionVotes(null);
      }

      if (snap.lastHitlerCheck && snap.lastHitlerCheck.id !== lastSeenHitlerCheckIdRef.current) {
        lastSeenHitlerCheckIdRef.current = snap.lastHitlerCheck.id;
        setChancellorSuspenseCheck(snap.lastHitlerCheck.check);
      } else if (!snap.lastHitlerCheck && !snap.gameState) {
        lastSeenHitlerCheckIdRef.current = null;
        setChancellorSuspenseCheck(null);
      }

      if (snap.gameOverData) {
        setGameOverData(snap.gameOverData);
      } else if (!snap.gameState || snap.gameState.phase !== 'GAME_OVER') {
        setGameOverData(null);
      }

      if (snap.privateState) {
        if (snap.privateState.nightInfo) {
          setNightInfo(snap.privateState.nightInfo);
          if (
            snap.gameState?.phase === 'NIGHT' &&
            !snap.isSpectator &&
            !hasShownNightForRoundRef.current
          ) {
            hasShownNightForRoundRef.current = true;
            setShowNightModal(true);
          }
        }
        setPresidentCards(snap.privateState.presidentCards || null);
        setChancellorCards(snap.privateState.chancellorCards || null);
        setCanVeto(Boolean(snap.privateState.canVeto));
        setPeekCards(snap.privateState.peekCards || null);
        if (snap.privateState.investigationResult) {
          setInvestigationResult(snap.privateState.investigationResult);
        }
      }

      if (!snap.gameState) {
        hasShownNightForRoundRef.current = false;
        setNightInfo(null);
        setPresidentCards(null);
        setChancellorCards(null);
        setPeekCards(null);
        setInvestigationResult(null);
      }
    },
    [showNotification]
  );

  // Fetch public live rooms directory
  const refreshPublicRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/live');
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success && Array.isArray(data.rooms)) {
        setPublicRooms(data.rooms);
        setConnected(true);
      }
    } catch {
      // Ignore network hiccup
    }
  }, []);

  // Fetch / inspect a specific live room by 4-letter code
  const inspectLiveRoom = useCallback(
    async (rawCode: string): Promise<{ success: boolean; snapshot?: LiveRoomSnapshot; error?: string }> => {
      const code = (rawCode || '').toUpperCase().trim();
      if (!code) return { success: false, error: 'Please enter a 4-letter room code.' };
      try {
        const savedId = localStorage.getItem('sh_player_id') || '';
        const res = await fetch(`/api/live/${encodeURIComponent(code)}?playerId=${encodeURIComponent(savedId)}`);
        const data = await res.json();
        if (!res.ok || !data?.success) {
          return {
            success: false,
            error: data?.error || `Live room "${code}" not found.`,
          };
        }
        setLiveRoomPreview(data);
        setBrowserLiveUrl(code);
        return { success: true, snapshot: data };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Could not reach live room server.' };
      }
    },
    []
  );

  const closeLivePreview = useCallback(() => {
    setLiveRoomPreview(null);
    if (!roomCodeRef.current) {
      setBrowserLiveUrl(null);
    }
  }, []);

  // Sync active room via HTTP GET /api/live/:code
  const syncActiveRoomFromHttp = useCallback(
    async (targetCode?: string, targetPlayerId?: string) => {
      const code = targetCode || roomCodeRef.current;
      const pid = targetPlayerId || playerIdRef.current;
      if (!code) return;
      try {
        const url = `/api/live/${encodeURIComponent(code)}${
          pid ? `?playerId=${encodeURIComponent(pid)}` : ''
        }`;
        const res = await fetch(url);
        if (res.status === 404) {
          if (roomCodeRef.current === code) {
            localStorage.removeItem('sh_room_code');
            localStorage.removeItem('sh_player_id');
            roomCodeRef.current = null;
            playerIdRef.current = null;
            setRoomCode(null);
            setIsPrivateRoom(false);
            setPlayerId(null);
            setIsHost(false);
            setIsSpectator(false);
            setPlayers([]);
            setSpectators([]);
            setGameState(null);
            setGameOverData(null);
            setChancellorSuspenseCheck(null);
            setBrowserLiveUrl(null);
            refreshPublicRooms();
          }
          return;
        }
        if (!res.ok) return;
        const snap: LiveRoomSnapshot = await res.json();
        if (snap && snap.success && roomCodeRef.current === code) {
          applyLiveSnapshot(snap);
        }
      } catch {
        // Ignore transient fetch errors
      }
    },
    [applyLiveSnapshot, refreshPublicRooms]
  );

  // Initial boot: setup socket, check URL /live/:code or localStorage, start polling sync
  useEffect(() => {
    const savedCode = localStorage.getItem('sh_room_code');
    const savedName = localStorage.getItem('sh_player_name');
    const savedId = localStorage.getItem('sh_player_id');
    const urlCode = extractRoomCodeFromUrl();

    if (savedName) setPlayerName(savedName);
    refreshPublicRooms();

    const socket = io(window.location.origin, {
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    const targetCode = urlCode || savedCode;

    // Immediately sync or preview targetCode over HTTP so we never wait on socket handshake
    if (targetCode) {
      (async () => {
        try {
          const res = await fetch(
            `/api/live/${encodeURIComponent(targetCode)}${
              savedId ? `?playerId=${encodeURIComponent(savedId)}` : ''
            }`
          );
          if (!res.ok) {
            if (savedCode === targetCode) {
              localStorage.removeItem('sh_room_code');
            }
            return;
          }
          const snap: LiveRoomSnapshot = await res.json();
          if (!snap?.success) return;

          // Only auto-reconnect on page reload when savedCode and savedId match an active seat
          const isSameSavedRoom = Boolean(
            savedCode && savedCode.toUpperCase() === snap.roomCode.toUpperCase() && savedId
          );
          const matchedPlayer = isSameSavedRoom
            ? snap.players.find((p) => !p.isBot && p.id === savedId)
            : undefined;
          const matchedSpec = isSameSavedRoom
            ? snap.spectators.find((s) => s.id === savedId)
            : undefined;

          if (matchedPlayer || matchedSpec) {
            const resolvedId = matchedPlayer ? matchedPlayer.id : matchedSpec!.id;
            const resolvedName = matchedPlayer ? matchedPlayer.name : matchedSpec!.name;
            const savedPw = localStorage.getItem('sh_player_password') || undefined;
            setRoomCode(snap.roomCode);
            setPlayerId(resolvedId);
            setPlayerName(resolvedName);
            localStorage.setItem('sh_room_code', snap.roomCode);
            localStorage.setItem('sh_player_id', resolvedId);
            localStorage.setItem('sh_player_name', resolvedName);
            setBrowserLiveUrl(snap.roomCode);
            setLiveRoomPreview(null);

            // Fetch full snapshot with resolvedId
            const fullRes = await fetch(
              `/api/live/${encodeURIComponent(snap.roomCode)}?playerId=${encodeURIComponent(resolvedId)}`
            );
            if (fullRes.ok) {
              const fullSnap = await fullRes.json();
              applyLiveSnapshot(fullSnap);
            } else {
              applyLiveSnapshot(snap);
            }

            if (socket.connected) {
              socket.emit(
                'reconnect-room',
                {
                  roomCode: snap.roomCode,
                  playerName: resolvedName,
                  password: savedPw,
                  playerId: resolvedId,
                },
                () => {}
              );
            }
          } else if (urlCode) {
            // Opened /live/:code on a new device -> show the Live Room Page!
            setLiveRoomPreview(snap);
            setBrowserLiveUrl(snap.roomCode);
          }
        } catch {
          // Ignore initial fetch failure
        }
      })();
    }

    socket.on('connect', () => {
      setConnected(true);
      const activeCode = roomCodeRef.current || localStorage.getItem('sh_room_code');
      const activeName = playerNameRef.current || localStorage.getItem('sh_player_name');
      const activeId = playerIdRef.current || localStorage.getItem('sh_player_id');

      if (activeCode && (activeName || activeId)) {
        socket.emit(
          'reconnect-room',
          { roomCode: activeCode, playerName: activeName || '', playerId: activeId || undefined },
          (res: any) => {
            if (res?.success) {
              setRoomCode(res.roomCode);
              setPlayerId(res.playerId);
              setBrowserLiveUrl(res.roomCode);
              applyLiveSnapshot(res);
            }
          }
        );
      }
    });

    socket.on('disconnect', () => {
      // Note: HTTP Live Sync continues working even if socket disconnects!
    });

    socket.on('public-rooms-updated', (data: { rooms: PublicRoomSummary[] }) => {
      if (data?.rooms) setPublicRooms(data.rooms);
    });

    socket.on('live-room-sync', (snap: LiveRoomSnapshot) => {
      if (snap?.roomCode && snap.roomCode === roomCodeRef.current) {
        syncActiveRoomFromHttp(snap.roomCode, playerIdRef.current || undefined);
      }
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
            ? `${data.playerName} joined the live room as a Spectator.`
            : `${data.playerName} joined the live room.`,
          'info'
        );
      }
    );

    socket.on(
      'lobby-updated',
      (data: { players: RoomMember[]; spectators?: Spectator[]; hostId?: string }) => {
        setPlayers(data.players);
        if (data.spectators) setSpectators(data.spectators);
        const myPid = playerIdRef.current;
        if (myPid) {
          const isNowHost =
            data.hostId === myPid ||
            (data.players || []).some((p) => p.id === myPid && p.isHost);
          setIsHost(isNowHost);
        }
      }
    );

    socket.on('room-closed', () => {
      localStorage.removeItem('sh_room_code');
      localStorage.removeItem('sh_player_id');
      roomCodeRef.current = null;
      playerIdRef.current = null;
      setRoomCode(null);
      setIsPrivateRoom(false);
      setPlayerId(null);
      setIsHost(false);
      setIsSpectator(false);
      setPlayers([]);
      setSpectators([]);
      setGameState(null);
      setGameOverData(null);
      setChancellorSuspenseCheck(null);
      setBrowserLiveUrl(null);
      refreshPublicRooms();
    });

    socket.on('kicked-from-room', (data: { roomCode?: string; reason?: string }) => {
      localStorage.removeItem('sh_room_code');
      localStorage.removeItem('sh_player_id');
      roomCodeRef.current = null;
      playerIdRef.current = null;
      setRoomCode(null);
      setPlayerId(null);
      setIsHost(false);
      setIsSpectator(false);
      setPlayers([]);
      setSpectators([]);
      setGameState(null);
      setBrowserLiveUrl(null);
      sound.playClick();
      showNotification(data?.reason || 'You were removed from the room by the host.', 'alert');
      refreshPublicRooms();
    });

    socket.on(
      'game-started',
      (data: { nightInfo: NightInfo | null; state: PublicGameState; isSpectator?: boolean }) => {
        hasShownNightForRoundRef.current = true;
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
            ? 'Game started! You are spectating live.'
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
          if (data.chaosPolicy) {
            const key = `${data.state.liberalPolicies}-${data.state.fascistPolicies}`;
            lastEnactedKeyRef.current = key;
            prevPolicyCountsRef.current = {
              lib: data.state.liberalPolicies,
              fas: data.state.fascistPolicies,
            };
            const slot =
              data.chaosPolicy === 'LIBERAL'
                ? data.state.liberalPolicies
                : data.state.fascistPolicies;
            setEnactedPolicyEvent({
              policy: data.chaosPolicy,
              slotNumber: slot,
              isChaos: true,
            });
          }
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
        const key = `${data.state.liberalPolicies}-${data.state.fascistPolicies}`;
        lastEnactedKeyRef.current = key;
        prevPolicyCountsRef.current = {
          lib: data.state.liberalPolicies,
          fas: data.state.fascistPolicies,
        };
        const slot =
          data.policy === 'LIBERAL'
            ? data.state.liberalPolicies
            : data.state.fascistPolicies;
        setEnactedPolicyEvent({
          policy: data.policy,
          slotNumber: slot,
          executiveAction: data.executiveAction,
        });
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

    socket.on(
      'game-reset',
      (data: { players: RoomMember[]; spectators?: Spectator[]; hostId?: string }) => {
        hasShownNightForRoundRef.current = false;
        setGameState(null);
        setPlayers(data.players);
        if (data.spectators) setSpectators(data.spectators);
        const myPid = playerIdRef.current;
        if (myPid) {
          const isNowHost =
            data.hostId === myPid ||
            (data.players || []).some((p) => p.id === myPid && p.isHost);
          setIsHost(isNowHost);
        }
        setGameOverData(null);
        setNightInfo(null);
        setPresidentCards(null);
        setChancellorCards(null);
        setPeekCards(null);
        setInvestigationResult(null);
        setChancellorSuspenseCheck(null);
        sound.playClick();
        showNotification('Room reset to lobby for a new game.', 'info');
      }
    );

    return () => {
      socket.disconnect();
    };
  }, [applyLiveSnapshot, refreshPublicRooms, showNotification, syncActiveRoomFromHttp]);

  // Continuous HTTP Live Sync Interval (keeps all devices in sync every 1.5s even if WebSockets drop)
  useEffect(() => {
    const interval = setInterval(() => {
      if (roomCodeRef.current) {
        syncActiveRoomFromHttp();
      } else if (liveRoomPreview?.roomCode) {
        inspectLiveRoom(liveRoomPreview.roomCode);
      } else {
        refreshPublicRooms();
      }
    }, 1500);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (roomCodeRef.current) {
          syncActiveRoomFromHttp();
        } else {
          refreshPublicRooms();
        }
      }
    };
    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [inspectLiveRoom, liveRoomPreview?.roomCode, refreshPublicRooms, syncActiveRoomFromHttp]);

  // Helper to send action via HTTP /api/live/:code/action (guaranteed delivery & state sync)
  const sendLiveAction = useCallback(
    async (action: string, payload: Record<string, any> = {}) => {
      const code = roomCodeRef.current;
      const pid = playerIdRef.current;
      if (!code || !pid) return { success: false, error: 'Not in a live room' };

      try {
        const res = await fetch(`/api/live/${encodeURIComponent(code)}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, playerId: pid, payload }),
        });
        const data = await res.json();
        if (data?.snapshot) {
          applyLiveSnapshot(data.snapshot);
        }
        return data;
      } catch (err: any) {
        return { success: false, error: err?.message || 'Network error' };
      }
    },
    [applyLiveSnapshot]
  );

  const createRoom = async (
    name: string,
    password: string,
    isPrivate = false
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const cleanName = name.trim() || 'Host';
      const cleanPassword = (password || '').trim();
      if (!cleanPassword || cleanPassword.length < 4 || cleanPassword.length > 64) {
        return { success: false, error: 'Password must be between 4 and 64 characters.' };
      }

      const res = await fetch('/api/live/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: cleanName,
          password: cleanPassword,
          isPrivate: Boolean(isPrivate),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        return { success: false, error: data?.error || 'Failed to create room' };
      }

      sound.playClick();
      roomCodeRef.current = data.roomCode;
      playerIdRef.current = data.playerId;
      playerNameRef.current = cleanName;
      setRoomCode(data.roomCode);
      setIsPrivateRoom(Boolean(data.isPrivate));
      setPlayerId(data.playerId);
      setPlayerName(cleanName);
      setLiveRoomPreview(null);
      localStorage.setItem('sh_room_code', data.roomCode);
      localStorage.setItem('sh_player_name', cleanName);
      localStorage.setItem('sh_player_password', cleanPassword);
      localStorage.setItem('sh_player_id', data.playerId);
      setBrowserLiveUrl(data.roomCode);
      applyLiveSnapshot(data);

      // Bind socket to the newly created live room as well
      if (socketRef.current?.connected) {
        socketRef.current.emit(
          'reconnect-room',
          { roomCode: data.roomCode, playerName: cleanName, password: cleanPassword, playerId: data.playerId },
          () => {}
        );
      }

      showNotification(
        data.isPrivate
          ? `Private Room ${data.roomCode} created! Share code ${data.roomCode} with invited players.`
          : `Public Live Room ${data.roomCode} created! Share code ${data.roomCode} or link /live/${data.roomCode}.`,
        'success'
      );
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to create live room' };
    }
  };

  const joinRoom = async (
    code: string,
    name: string,
    password?: string,
    claimPlayerId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const cleanCode = (code || '').toUpperCase().trim();
      const cleanName = (name || '').trim();
      const cleanPassword = (password || '').trim();
      const rawSavedId = localStorage.getItem('sh_player_id') || undefined;
      const rawSavedName = localStorage.getItem('sh_player_name') || '';
      const savedId =
        rawSavedId && rawSavedName.toLowerCase() === cleanName.toLowerCase()
          ? rawSavedId
          : undefined;

      const res = await fetch(`/api/live/${encodeURIComponent(cleanCode)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: cleanName,
          password: cleanPassword,
          playerId: savedId,
          claimPlayerId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        return { success: false, error: data?.error || `Room "${cleanCode}" not found.` };
      }

      sound.playClick();
      roomCodeRef.current = data.roomCode;
      playerIdRef.current = data.playerId;
      playerNameRef.current = data.playerName || cleanName;
      setRoomCode(data.roomCode);
      setIsPrivateRoom(Boolean(data.isPrivate));
      setPlayerId(data.playerId);
      setPlayerName(data.playerName || cleanName);
      setLiveRoomPreview(null);
      localStorage.setItem('sh_room_code', data.roomCode);
      localStorage.setItem('sh_player_name', data.playerName || cleanName);
      if (cleanPassword) {
        localStorage.setItem('sh_player_password', cleanPassword);
      }
      localStorage.setItem('sh_player_id', data.playerId);
      setBrowserLiveUrl(data.roomCode);
      applyLiveSnapshot(data);

      if (socketRef.current?.connected) {
        socketRef.current.emit(
          'reconnect-room',
          {
            roomCode: data.roomCode,
            playerName: data.playerName || cleanName,
            password: cleanPassword,
            playerId: data.playerId,
          },
          () => {}
        );
      }

      if (data.reconnected) {
        showNotification(`Synced to seat "${data.playerName}" in Live Room ${data.roomCode}!`, 'success');
      } else if (data.isSpectator) {
        showNotification('Game is in progress — you joined the Live Room as a Spectator.', 'info');
      } else {
        showNotification(`Joined Live Room ${data.roomCode}!`, 'success');
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to join room' };
    }
  };

  const leaveRoom = async () => {
    sound.playClick();
    const codeToLeave = roomCodeRef.current;
    const pidToLeave = playerIdRef.current;

    localStorage.removeItem('sh_room_code');
    localStorage.removeItem('sh_player_id');
    roomCodeRef.current = null;
    playerIdRef.current = null;
    setRoomCode(null);
    setIsPrivateRoom(false);
    setPlayerId(null);
    setIsSpectator(false);
    setIsHost(false);
    setPlayers([]);
    setSpectators([]);
    setGameState(null);
    setNightInfo(null);
    setGameOverData(null);
    setChancellorSuspenseCheck(null);
    setLiveRoomPreview(null);
    setBrowserLiveUrl(null);

    if (codeToLeave && pidToLeave) {
      try {
        await fetch(`/api/live/${encodeURIComponent(codeToLeave)}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'leave-room', playerId: pidToLeave, payload: {} }),
        });
      } catch {
        // Ignore network errors on leave
      }
    }
    refreshPublicRooms();
  };

  const addBot = async () => {
    sound.playClick();
    const res = await sendLiveAction('add-bot');
    if (!res.success) showNotification(res.error || 'Failed to add bot', 'alert');
  };

  const removeBot = async (botId: string) => {
    sound.playClick();
    const res = await sendLiveAction('remove-player', { targetPlayerId: botId });
    if (!res.success) showNotification(res.error || 'Failed to remove bot', 'alert');
  };

  const removePlayer = async (targetPlayerId: string) => {
    sound.playClick();
    const res = await sendLiveAction('remove-player', { targetPlayerId });
    if (!res.success) {
      showNotification(res.error || 'Failed to remove player', 'alert');
    } else if (res.removedPlayerName) {
      showNotification(`Removed ${res.removedPlayerName} from the room.`, 'info');
    }
  };

  const startGame = async () => {
    sound.playCardShuffle();
    const res = await sendLiveAction('start-game');
    if (res.success) {
      hasShownNightForRoundRef.current = true;
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
  };

  const completeNight = async () => {
    sound.playClick();
    setShowNightModal(false);
    await sendLiveAction('night-complete');
  };

  const nominateChancellor = async (index: number) => {
    sound.playClick();
    const res = await sendLiveAction('nominate-chancellor', { chancellorIndex: index });
    if (!res.success) showNotification(res.error || 'Nomination failed', 'alert');
  };

  const castVote = async (vote: Vote) => {
    sound.playVoteCast();
    const res = await sendLiveAction('cast-vote', { vote });
    if (!res.success) showNotification(res.error || 'Vote failed', 'alert');
  };

  const presidentDiscard = async (index: number) => {
    sound.playPaperSlide();
    const res = await sendLiveAction('president-discard', { cardIndex: index });
    if (res.success) setPresidentCards(null);
    else showNotification(res.error || 'Discard failed', 'alert');
  };

  const chancellorDiscard = async (index: number) => {
    sound.playPaperSlide();
    const res = await sendLiveAction('chancellor-discard', { cardIndex: index });
    if (res.success) setChancellorCards(null);
    else showNotification(res.error || 'Enact failed', 'alert');
  };

  const chancellorVeto = async () => {
    sound.playGavel();
    const res = await sendLiveAction('chancellor-veto');
    if (!res.success) showNotification(res.error || 'Veto request failed', 'alert');
  };

  const presidentVetoResponse = async (accept: boolean) => {
    sound.playGavel();
    const res = await sendLiveAction('president-veto-response', { accept });
    if (!res.success) showNotification(res.error || 'Veto response failed', 'alert');
  };

  const acknowledgePeek = async () => {
    sound.playClick();
    setPeekCards(null);
    await sendLiveAction('acknowledge-peek');
  };

  const investigatePlayer = async (targetIndex: number) => {
    sound.playInvestigation();
    const res = await sendLiveAction('investigate-player', { targetIndex });
    if (res.success) {
      setInvestigationResult({
        targetIndex: res.targetIndex,
        party: res.party,
        targetName: res.targetName,
      });
    } else {
      showNotification(res.error || 'Investigation failed', 'alert');
    }
  };

  const acknowledgeInvestigation = async () => {
    sound.playClick();
    setInvestigationResult(null);
    await sendLiveAction('acknowledge-investigation');
  };

  const specialElection = async (targetIndex: number) => {
    sound.playGavel();
    const res = await sendLiveAction('special-election', { targetIndex });
    if (!res.success) showNotification(res.error || 'Special election failed', 'alert');
  };

  const executePlayer = async (targetIndex: number) => {
    sound.playExecution();
    const res = await sendLiveAction('execute-player', { targetIndex });
    if (!res.success) showNotification(res.error || 'Execution failed', 'alert');
  };

  const restartGame = async () => {
    sound.playClick();
    const res = await sendLiveAction('restart-game');
    if (!res.success) showNotification(res.error || 'Restart failed', 'alert');
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
    lastSyncedAt,
    roomCode,
    isPrivateRoom,
    playerId,
    playerName,
    isHost,
    isSpectator,
    players,
    spectators,
    gameState,
    publicRooms,
    liveRoomPreview,
    inspectLiveRoom,
    closeLivePreview,
    refreshPublicRooms,
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
    enactedPolicyEvent,
    dismissEnactedPolicy: () => setEnactedPolicyEvent(null),
    gameOverData,
    notification,
    eligibleChancellors: gameState?.eligibleChancellors || [],
    createRoom,
    joinRoom,
    leaveRoom,
    addBot,
    removeBot,
    removePlayer,
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
