import React, { useState, useEffect } from 'react';
import {
  Crown,
  Bot,
  Play,
  Copy,
  Check,
  ArrowRight,
  User,
  Eye,
  Smartphone,
  Globe,
  UserPlus,
  Trash2,
  RefreshCw,
  Radio,
  ArrowLeft,
  ExternalLink,
  Lock,
} from 'lucide-react';
import {
  LiveRoomSnapshot,
  PublicRoomSummary,
  RoomMember,
} from '../hooks/useGameSocket.js';
import { OfflinePlayerEntry } from '../hooks/useOfflineGame.js';
import { Spectator } from '../game/types.js';
import { CrossedDaggerAndLaurelSVG } from './Artwork.js';
import { sound } from '../utils/sound.js';

interface LobbyViewProps {
  roomCode: string | null;
  isPrivateRoom?: boolean;
  playerName: string;
  isHost: boolean;
  isSpectator: boolean;
  players: RoomMember[];
  spectators: Spectator[];
  publicRooms: PublicRoomSummary[];
  liveRoomPreview: LiveRoomSnapshot | null;
  onInspectLiveRoom: (
    code: string
  ) => Promise<{ success: boolean; snapshot?: LiveRoomSnapshot; error?: string }>;
  onCloseLivePreview: () => void;
  onRefreshPublicRooms: () => void;
  onCreateRoom: (name: string, isPrivate?: boolean) => Promise<{ success: boolean; error?: string }>;
  onJoinRoom: (
    code: string,
    name: string,
    claimPlayerId?: string
  ) => Promise<{ success: boolean; error?: string }>;
  onAddBot: () => void;
  onRemoveBot: (botId: string) => void;
  onRemovePlayer: (playerId: string) => void;
  onStartGame: () => void;
  onStartOfflineGame: (players: OfflinePlayerEntry[]) => { success: boolean; error?: string };
  onOpenRules: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  roomCode,
  isPrivateRoom = false,
  playerName,
  isHost,
  isSpectator,
  players,
  spectators,
  publicRooms,
  liveRoomPreview,
  onInspectLiveRoom,
  onCloseLivePreview,
  onRefreshPublicRooms,
  onCreateRoom,
  onJoinRoom,
  onAddBot,
  onRemoveBot,
  onRemovePlayer,
  onStartGame,
  onStartOfflineGame,
  onOpenRules,
}) => {
  const [playModeTab, setPlayModeTab] = useState<'online' | 'offline'>('online');
  const [createRoomVisibility, setCreateRoomVisibility] = useState<'public' | 'private'>('public');
  const [inputName, setInputName] = useState(playerName || '');
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Offline Pass & Play roster state (defaults to 5 seats ready to fill)
  const [offlineRoster, setOfflineRoster] = useState<OfflinePlayerEntry[]>([
    { id: 'seat_1', name: 'Alex' },
    { id: 'seat_2', name: 'Sam' },
    { id: 'seat_3', name: 'Jordan' },
    { id: 'seat_4', name: 'Morgan' },
    { id: 'seat_5', name: 'Taylor' },
  ]);
  const [newOfflinePlayerName, setNewOfflinePlayerName] = useState('');

  useEffect(() => {
    const pathMatch = window.location.pathname.match(/^\/live\/([A-Za-z0-9]{4})/i);
    const params = new URLSearchParams(window.location.search);
    const codeParam = (pathMatch && pathMatch[1]) || params.get('room') || params.get('live');
    if (codeParam) {
      setInputCode(codeParam.toUpperCase().trim());
      setPlayModeTab('online');
    }
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!inputName.trim()) {
      setErrorMsg('Please enter your name before creating a room.');
      return;
    }
    setLoading(true);
    const res = await onCreateRoom(inputName.trim(), createRoomVisibility === 'private');
    setLoading(false);
    if (!res.success) setErrorMsg(res.error || 'Failed to create room');
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const cleanCode = inputCode.trim().toUpperCase();
    if (!cleanCode) {
      setErrorMsg('Please enter the 4-letter room code.');
      return;
    }
    if (!inputName.trim()) {
      // If no name was entered yet, open the Live Room Page for this code so they can pick a seat or enter a name!
      setLoading(true);
      const previewRes = await onInspectLiveRoom(cleanCode);
      setLoading(false);
      if (!previewRes.success) {
        setErrorMsg(previewRes.error || `Room "${cleanCode}" not found.`);
      }
      return;
    }
    setLoading(true);
    const res = await onJoinRoom(cleanCode, inputName.trim());
    setLoading(false);
    if (!res.success) setErrorMsg(res.error || 'Failed to join room');
  };

  const handleOpenLivePage = async (codeToOpen: string) => {
    setErrorMsg(null);
    const clean = codeToOpen.trim().toUpperCase();
    if (!clean) {
      setErrorMsg('Please enter a 4-letter room code first.');
      return;
    }
    setLoading(true);
    const res = await onInspectLiveRoom(clean);
    setLoading(false);
    if (!res.success) {
      setErrorMsg(res.error || `Live room "${clean}" not found.`);
    }
  };

  const handleClaimSeat = async (code: string, seatPlayer: RoomMember) => {
    setErrorMsg(null);
    setLoading(true);
    const res = await onJoinRoom(code, seatPlayer.name, seatPlayer.id);
    setLoading(false);
    if (!res.success) {
      setErrorMsg(res.error || 'Could not sync to seat');
    }
  };

  const handleJoinFromLivePage = async (code: string, asSpectatorOnly = false) => {
    setErrorMsg(null);
    const chosenName =
      inputName.trim() ||
      (asSpectatorOnly ? `Spectator ${Math.floor(100 + Math.random() * 900)}` : '');
    if (!chosenName) {
      setErrorMsg('Please enter your name above to join this Live Room.');
      return;
    }
    setLoading(true);
    const res = await onJoinRoom(code, chosenName);
    setLoading(false);
    if (!res.success) {
      setErrorMsg(res.error || 'Could not join live room');
    }
  };

  const handleUpdateOfflineSeatName = (index: number, name: string) => {
    setErrorMsg(null);
    setOfflineRoster((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, name } : item))
    );
  };

  const handleAddOfflineSeat = (isBot = false) => {
    sound.playClick();
    setErrorMsg(null);
    if (offlineRoster.length >= 10) {
      setErrorMsg('Maximum 10 players allowed.');
      return;
    }

    const defaultNames = [
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
    const used = new Set(offlineRoster.map((p) => p.name.trim().toLowerCase()));
    const fallbackName =
      defaultNames.find((n) => !used.has(n.toLowerCase())) || `Player ${offlineRoster.length + 1}`;

    const nameToUse =
      !isBot && newOfflinePlayerName.trim() ? newOfflinePlayerName.trim() : fallbackName;

    setOfflineRoster((prev) => [
      ...prev,
      {
        id: `seat_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        name: nameToUse,
        isBot,
      },
    ]);
    if (!isBot) setNewOfflinePlayerName('');
  };

  const handleRemoveOfflineSeat = (id: string) => {
    sound.playClick();
    setErrorMsg(null);
    setOfflineRoster((prev) => prev.filter((item) => item.id !== id));
  };

  const handleStartOffline = () => {
    setErrorMsg(null);
    const res = onStartOfflineGame(offlineRoster);
    if (!res.success) {
      setErrorMsg(res.error || 'Could not start offline game');
    }
  };

  const copyInvite = (targetCode?: string) => {
    const code = targetCode || roomCode;
    if (!code) return;
    sound.playClick();
    const url = `${window.location.origin}/live/${code}?room=${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const getRoleBreakdown = (count: number) => {
    if (count < 5)
      return 'Requires 5 to 10 players (3 Liberals · 1 Fascist · 1 Hitler at 5 players)';
    if (count === 5) return '3 Liberals · 1 Fascist · 1 Secret Hitler (Hitler knows Fascist)';
    if (count === 6) return '4 Liberals · 1 Fascist · 1 Secret Hitler (Hitler knows Fascist)';
    if (count === 7) return '4 Liberals · 2 Fascists · 1 Secret Hitler (Hitler blind to Fascists)';
    if (count === 8) return '5 Liberals · 2 Fascists · 1 Secret Hitler (Hitler blind to Fascists)';
    if (count === 9) return '5 Liberals · 3 Fascists · 1 Secret Hitler (Hitler blind to Fascists)';
    return '6 Liberals · 3 Fascists · 1 Secret Hitler (Hitler blind to Fascists)';
  };

  // ==========================================================================
  // 1. IN ONLINE ROOM LOBBY (JOINED & SYNCED TO LIVE PAGE /live/:code)
  // ==========================================================================
  if (roomCode) {
    const canStart = players.length >= 5 && players.length <= 10;
    const needMore = Math.max(0, 5 - players.length);

    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        {/* Live Room Page Banner */}
        <div className="bg-[#181411] border-2 border-[#3d332c] rounded-lg p-6 md:p-8 tactile-card-shadow text-center relative overflow-hidden">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded border text-[11px] font-mono-numbers uppercase tracking-[0.18em] mb-2 ${
              isPrivateRoom
                ? 'bg-[#2a1d11] border-[#d4a359]/50 text-[#f3c879]'
                : 'bg-[#11261c] border-emerald-500/40 text-emerald-300'
            }`}
          >
            {isPrivateRoom ? (
              <>
                <Lock className="w-3 h-3 text-[#d4a359]" />
                <span>Private Live Room (Code-Only) · /live/{roomCode}</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Public Live Room Page Active · /live/{roomCode}</span>
              </>
            )}
          </div>

          <h2 className="text-3xl md:text-4xl font-woodcut tracking-wider text-[#f4efe6] mt-1">
            {isPrivateRoom ? `Private Room ${roomCode}` : `Live Room ${roomCode}`}
          </h2>
          <p className="text-xs text-[#a89f91] mt-1 max-w-xl mx-auto">
            {isPrivateRoom ? (
              <>
                Hidden from the public rooms list. Only players who enter code{' '}
                <strong className="text-[#d4a359]">{roomCode}</strong> or open{' '}
                <span className="font-mono-numbers text-[#f4efe6]">/live/{roomCode}</span> can join.
              </>
            ) : (
              <>
                Anyone entering code <strong className="text-[#d4a359]">{roomCode}</strong> or opening{' '}
                <span className="font-mono-numbers text-[#f4efe6]">/live/{roomCode}</span> on any device
                automatically connects to this live room data in real time.
              </>
            )}
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <div className="px-4 py-2 rounded bg-[#110e0c] border border-[#3d332c] font-mono-numbers text-sm flex items-center gap-2">
              <span className="text-[#a89f91] text-xs uppercase">Room Code:</span>
              <span className="text-[#d4a359] font-bold tracking-widest text-lg">{roomCode}</span>
            </div>

            <div className="px-3.5 py-2.5 rounded bg-[#110e0c] border border-[#2e2621] font-mono-numbers text-xs text-[#d6cfc2] flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span>/live/{roomCode}</span>
            </div>

            <button
              onClick={() => copyInvite(roomCode)}
              className="px-4 py-2.5 rounded bg-[#d4a359] hover:bg-[#e0b46e] text-[#12100e] text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Live Page Link Copied!' : 'Copy Live Room Link'}</span>
            </button>
          </div>

          <p className="mt-4 text-xs text-[#a89f91] font-mono-numbers">
            Envelope Setup ({players.length} seated):{' '}
            <strong className="text-[#f4efe6]">{getRoleBreakdown(players.length)}</strong>
          </p>
        </div>

        {/* Seated Players Section */}
        <div className="bg-[#161310] border border-[#2e2621] rounded-lg p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2e2621] pb-3">
            <div>
              <h3 className="text-lg font-woodcut tracking-wider text-[#f4efe6]">
                Seated Players ({players.length} / 10)
              </h3>
              <p className="text-xs text-[#a89f91]">
                All devices connected to Room {roomCode} stay synchronized automatically.
              </p>
            </div>

            {isHost && players.length < 10 && (
              <button
                onClick={onAddBot}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#241e1a] hover:bg-[#322923] border border-[#3d332c] text-xs font-semibold text-[#d4a359] transition-colors cursor-pointer whitespace-nowrap"
              >
                <Bot className="w-4 h-4" />
                <span>+ Add Bot Player</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {players.map((p, index) => (
              <div
                key={p.id}
                className="p-3.5 rounded bg-[#1d1815] border border-[#332a24] flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="text-xs font-mono-numbers text-[#a89f91] w-5">
                    {String(index + 1).padStart(2, '0')}.
                  </span>
                  {p.isBot ? (
                    <Bot className="w-4 h-4 text-[#a89f91] shrink-0" />
                  ) : (
                    <User className="w-4 h-4 text-[#d4a359] shrink-0" />
                  )}
                  <span className="font-semibold text-sm text-[#f4efe6] truncate">{p.name}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {p.isHost && (
                    <span className="text-[11px] font-mono-numbers text-[#d4a359] flex items-center gap-1">
                      <Crown className="w-3.5 h-3.5" /> Host
                    </span>
                  )}
                  {isHost && !p.isHost && (
                    <button
                      onClick={() => onRemovePlayer(p.id)}
                      aria-label={`Remove player ${p.name}`}
                      className="text-xs font-mono-numbers text-[#a89f91] hover:text-[#ffd2c9] hover:bg-[#3b1412] border border-transparent hover:border-[#c83228]/60 px-2 py-1 rounded flex items-center gap-1 transition-colors cursor-pointer"
                      title={`Remove ${p.name} from room`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[#e86f5c]" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Spectators List if any */}
          {spectators.length > 0 && (
            <div className="pt-3 border-t border-[#2e2621]">
              <div className="text-xs font-mono-numbers uppercase tracking-wider text-[#a89f91] mb-2 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-[#d4a359]" />
                <span>Spectators Watching ({spectators.length})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {spectators.map((s) => (
                  <span
                    key={s.id}
                    className="text-xs text-[#d6cfc2] bg-[#1d1815] border border-[#2e2621] px-2.5 py-1 rounded inline-flex items-center gap-2"
                  >
                    <span>{s.name}</span>
                    {isHost && (
                      <button
                        onClick={() => onRemovePlayer(s.id)}
                        aria-label={`Remove spectator ${s.name}`}
                        className="text-[#a89f91] hover:text-[#e86f5c] cursor-pointer"
                        title={`Remove ${s.name}`}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Start Game Bar */}
          <div className="pt-4 border-t border-[#2e2621] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-[#d6cfc2]">
              {needMore > 0 ? (
                <span>
                  Need{' '}
                  <strong className="text-[#d4a359]">
                    {needMore} more player{needMore > 1 ? 's' : ''}
                  </strong>{' '}
                  to start (5–10 players). Share code <strong className="text-[#f4efe6]">{roomCode}</strong> or add Bot Players.
                </span>
              ) : (
                <span className="text-emerald-400 font-medium">
                  Table ready with {players.length} players. Secret envelopes are prepared.
                </span>
              )}
            </div>

            {isHost ? (
              <button
                onClick={onStartGame}
                disabled={!canStart}
                className={`w-full sm:w-auto px-6 py-3 text-xs font-bold uppercase tracking-wider rounded flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
                  canStart
                    ? 'bg-[#c83228] hover:bg-[#df3b30] text-[#f4efe6] shadow-lg cursor-pointer'
                    : 'bg-[#26201c] text-[#6e655c] border border-[#362e28] cursor-not-allowed'
                }`}
              >
                <Play className="w-4 h-4" />
                <span>Deal Secret Envelopes & Start</span>
              </button>
            ) : (
              <div className="text-xs text-[#a89f91] italic">
                {isSpectator
                  ? 'You are in Spectator mode.'
                  : 'Waiting for the room host to deal the envelopes...'}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // 2. PUBLIC LIVE ROOM PAGE (/live/:code) WHEN ENTERING A CODE OR VISITING URL
  // ==========================================================================
  if (liveRoomPreview) {
    const humanSeats = liveRoomPreview.players.filter((p) => !p.isBot);
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <button
            onClick={onCloseLivePreview}
            className="text-xs text-[#a89f91] hover:text-[#f4efe6] flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Rooms</span>
          </button>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[#11261c] border border-emerald-500/40 text-[11px] font-mono-numbers uppercase tracking-wider text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live Sync Page · /live/{liveRoomPreview.roomCode}</span>
          </div>
        </div>

        <div className="bg-[#181411] border-2 border-[#d4a359] rounded-lg p-6 md:p-8 tactile-card-shadow space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2e2621] pb-5">
            <div>
              <div className="text-xs font-mono-numbers uppercase tracking-[0.2em] text-[#d4a359]">
                Public Live Room Data · Synced Across Devices
              </div>
              <h2 className="text-3xl md:text-4xl font-woodcut tracking-wider text-[#f4efe6] mt-1">
                Room {liveRoomPreview.roomCode}
              </h2>
              <p className="text-xs text-[#a89f91] mt-1">
                Status:{' '}
                <strong className="text-[#f4efe6]">
                  {liveRoomPreview.started
                    ? `In Game (${liveRoomPreview.gameState?.phase || 'ACTIVE'} · Liberal ${
                        liveRoomPreview.gameState?.liberalPolicies || 0
                      }/5 · Fascist ${liveRoomPreview.gameState?.fascistPolicies || 0}/6)`
                    : `Waiting in Lobby (${liveRoomPreview.players.length}/10 Players Seated)`}
                </strong>
              </p>
            </div>

            <button
              onClick={() => copyInvite(liveRoomPreview.roomCode)}
              className="px-4 py-2.5 rounded bg-[#241e1a] hover:bg-[#322923] border border-[#d4a359]/50 text-[#d4a359] text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer self-start md:self-auto"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Link Copied!' : `Copy /live/${liveRoomPreview.roomCode}`}</span>
            </button>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded bg-[#3b1412] border border-[#c83228] text-xs text-[#ffd2c9]"
            >
              {errorMsg}
            </div>
          )}

          {/* Option A: Join as New Player or Spectator */}
          <div className="p-5 rounded bg-[#14110e] border border-[#2e2621] space-y-4">
            <h3 className="text-lg font-woodcut tracking-wider text-[#f4efe6]">
              {liveRoomPreview.started
                ? 'Join Live Room as Spectator (or Enter Name to Sync)'
                : 'Enter Your Name to Join This Live Room'}
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                aria-label="Your Name for Live Room"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                placeholder="Enter your name..."
                maxLength={20}
                className="flex-1 px-4 py-3 rounded bg-[#0d0b09] border border-[#3d332c] text-[#f4efe6] placeholder-[#6e655c] text-sm focus:outline-none focus:border-[#d4a359]"
              />
              {!liveRoomPreview.started && liveRoomPreview.players.length < 10 && (
                <button
                  onClick={() => handleJoinFromLivePage(liveRoomPreview.roomCode, false)}
                  disabled={loading}
                  className="px-6 py-3 rounded bg-[#d4a359] hover:bg-[#e0b46e] text-[#12100e] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <span>{loading ? 'Connecting...' : 'Join as Player'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => handleJoinFromLivePage(liveRoomPreview.roomCode, true)}
                disabled={loading}
                className="px-5 py-3 rounded bg-[#241e1a] hover:bg-[#322923] border border-[#3d332c] text-[#f4efe6] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Eye className="w-4 h-4 text-[#d4a359]" />
                <span>Watch Live Board</span>
              </button>
            </div>
          </div>

          {/* Option B: Sync / Reconnect to an Existing Player Seat on this Device */}
          {humanSeats.length > 0 && (
            <div className="space-y-3">
              <div>
                <h3 className="text-base font-woodcut tracking-wider text-[#f4efe6]">
                  Seated Players in Room {liveRoomPreview.roomCode} ({liveRoomPreview.players.length}/10)
                </h3>
                <p className="text-xs text-[#a89f91]">
                  Already seated in this room on another tab or device? Tap your seat below to sync
                  this device directly to your player data:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {liveRoomPreview.players.map((p, idx) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded bg-[#14110e] border border-[#2e2621] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="text-xs font-mono-numbers text-[#a89f91]">
                        {String(idx + 1).padStart(2, '0')}.
                      </span>
                      {p.isBot ? (
                        <Bot className="w-4 h-4 text-[#a89f91] shrink-0" />
                      ) : (
                        <User className="w-4 h-4 text-[#d4a359] shrink-0" />
                      )}
                      <span className="text-sm font-semibold text-[#f4efe6] truncate">
                        {p.name}
                      </span>
                      {p.isHost && (
                        <span className="text-[10px] font-mono-numbers text-[#d4a359] uppercase">
                          (Host)
                        </span>
                      )}
                    </div>

                    {!p.isBot ? (
                      <button
                        onClick={() => handleClaimSeat(liveRoomPreview.roomCode, p)}
                        disabled={loading}
                        className="px-3 py-1.5 rounded bg-[#241e1a] hover:bg-[#d4a359] text-[#d4a359] hover:text-[#12100e] border border-[#d4a359]/40 text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0"
                      >
                        Sync This Seat
                      </button>
                    ) : (
                      <span className="text-[11px] font-mono-numbers text-[#7a6d60]">Bot</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================================================
  // 3. LANDING VIEW: ONLINE MULTIPLAYER OR OFFLINE PASS & PLAY
  // ==========================================================================
  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4 md:py-8 animate-fade-in">
      {/* Constructivist Woodcut Poster Hero */}
      <div className="text-center space-y-3">
        <div className="text-xs font-mono-numbers uppercase tracking-[0.25em] text-[#d4a359]">
          Can You Find and Stop The...
        </div>

        <h1 className="text-5xl sm:text-6xl md:text-7xl font-woodcut tracking-wider text-[#f4efe6] uppercase woodcut-title-shadow select-none">
          SECRET HITLER
        </h1>

        <div className="flex justify-center py-1">
          <CrossedDaggerAndLaurelSVG className="w-44 h-20" />
        </div>

        <p className="text-sm text-[#d6cfc2] max-w-xl mx-auto leading-relaxed">
          Play the 5–10 player social deduction board game online with live synced public rooms or
          offline on a single shared device with Pass & Play privacy shields.
        </p>
      </div>

      {/* Mode Switcher Tabs + Entry Card */}
      <div className="bg-[#181411] border-2 border-[#3d332c] rounded-lg tactile-card-shadow overflow-hidden">
        {/* Top Mode Tabs */}
        <div className="grid grid-cols-2 border-b border-[#3d332c] bg-[#120f0d]">
          <button
            onClick={() => {
              sound.playClick();
              setErrorMsg(null);
              setPlayModeTab('online');
            }}
            className={`py-4 px-4 text-xs md:text-sm font-woodcut tracking-wider uppercase flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              playModeTab === 'online'
                ? 'bg-[#181411] text-[#d4a359] border-b-2 border-[#d4a359]'
                : 'text-[#a89f91] hover:text-[#f4efe6] hover:bg-[#161210]'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Online Room (Multi-Device)</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setErrorMsg(null);
              setPlayModeTab('offline');
            }}
            className={`py-4 px-4 text-xs md:text-sm font-woodcut tracking-wider uppercase flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              playModeTab === 'offline'
                ? 'bg-[#181411] text-[#d4a359] border-b-2 border-[#d4a359]'
                : 'text-[#a89f91] hover:text-[#f4efe6] hover:bg-[#161210]'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Offline Pass & Play (1 Device)</span>
          </button>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded bg-[#3b1412] border border-[#c83228] text-xs text-[#ffd2c9]"
            >
              {errorMsg}
            </div>
          )}

          {playModeTab === 'online' ? (
            /* TAB 1: ONLINE MULTIPLAYER */
            <div className="space-y-6 animate-fade-in">
              <div>
                <label
                  htmlFor="player-display-name"
                  className="block text-sm font-woodcut tracking-wider uppercase text-[#f4efe6] mb-2"
                >
                  Your Name
                </label>
                <input
                  id="player-display-name"
                  type="text"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  placeholder="Enter your name..."
                  maxLength={20}
                  className="w-full px-4 py-3 rounded bg-[#100d0b] border border-[#3d332c] text-[#f4efe6] placeholder-[#6e655c] text-sm focus:outline-none focus:border-[#d4a359] transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
                {/* Create Room */}
                <div className="p-5 rounded bg-[#14110e] border border-[#2e2621] flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div>
                      <h2 className="font-woodcut text-xl tracking-wide text-[#f4efe6]">
                        Create Live Room
                      </h2>
                      <p className="text-xs text-[#a89f91] mt-1 leading-relaxed">
                        Choose whether your room appears in the public lobby directory or is private (joinable by 4-letter code only).
                      </p>
                    </div>

                    {/* Public vs Private Room Selector */}
                    <div
                      role="group"
                      aria-label="Room Visibility"
                      className="grid grid-cols-2 gap-2 p-1 rounded bg-[#0d0b09] border border-[#2e2621]"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          setCreateRoomVisibility('public');
                        }}
                        className={`py-2 px-2.5 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          createRoomVisibility === 'public'
                            ? 'bg-[#241e1a] text-[#d4a359] border border-[#d4a359]/60'
                            : 'text-[#a89f91] hover:text-[#f4efe6] border border-transparent'
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Public Room</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          setCreateRoomVisibility('private');
                        }}
                        className={`py-2 px-2.5 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          createRoomVisibility === 'private'
                            ? 'bg-[#241e1a] text-[#d4a359] border border-[#d4a359]/60'
                            : 'text-[#a89f91] hover:text-[#f4efe6] border border-transparent'
                        }`}
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Private Room</span>
                      </button>
                    </div>

                    <p className="text-[11px] font-mono-numbers text-[#a89f91]">
                      {createRoomVisibility === 'public'
                        ? 'Public: Listed in Public Live Rooms Online & joinable via code.'
                        : 'Private: Hidden from public list; joinable only with the 4-letter code.'}
                    </p>
                  </div>

                  <button
                    onClick={handleCreate}
                    disabled={loading}
                    className="w-full py-3 px-4 text-xs font-bold uppercase tracking-wider text-[#12100e] bg-[#d4a359] hover:bg-[#e0b46e] rounded transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <span>
                      {loading
                        ? 'Creating...'
                        : createRoomVisibility === 'private'
                        ? 'Create Private Room'
                        : 'Create Public Room'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Join or Open Live Room by Code */}
                <div className="p-5 rounded bg-[#14110e] border border-[#2e2621] flex flex-col justify-between space-y-4">
                  <div>
                    <h2 className="font-woodcut text-xl tracking-wide text-[#f4efe6]">
                      Enter Room Code
                    </h2>
                    <p className="text-xs text-[#a89f91] mt-1 mb-3 leading-relaxed">
                      Enter the 4-letter room code to join immediately or open its synced Live Room page.
                    </p>
                    <input
                      type="text"
                      aria-label="Room Code"
                      value={inputCode}
                      onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                      placeholder="ROOM CODE"
                      maxLength={4}
                      className="w-full px-3 py-2 rounded bg-[#0d0b09] border border-[#3d332c] text-center font-mono-numbers font-bold tracking-[0.25em] text-[#d4a359] uppercase text-sm focus:outline-none focus:border-[#d4a359]"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={handleJoin}
                      disabled={loading}
                      className="flex-1 py-3 px-4 text-xs font-bold uppercase tracking-wider text-[#f4efe6] bg-[#c83228] hover:bg-[#df3b30] rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <span>{loading ? 'Joining...' : 'Join Room'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenLivePage(inputCode)}
                      disabled={loading}
                      title="Open the public Live Room page for this code"
                      className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-[#d4a359] bg-[#241e1a] hover:bg-[#322923] border border-[#3d332c] rounded transition-colors flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Live Page</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Public Live Rooms Directory */}
              <div className="pt-4 border-t border-[#2e2621] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <h3 className="text-sm font-woodcut tracking-wider uppercase text-[#f4efe6]">
                      Public Live Rooms Online ({publicRooms.length})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      onRefreshPublicRooms();
                    }}
                    className="text-xs text-[#a89f91] hover:text-[#d4a359] flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh</span>
                  </button>
                </div>

                {publicRooms.length === 0 ? (
                  <div className="p-4 rounded bg-[#14110e] border border-[#26201b] text-center text-xs text-[#a89f91]">
                    No active public rooms right now. Create a room above to launch a live room page!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {publicRooms.map((r) => (
                      <div
                        key={r.roomCode}
                        className="p-3.5 rounded bg-[#14110e] border border-[#2e2621] hover:border-[#d4a359]/50 transition-colors flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="px-2.5 py-1 rounded bg-[#0d0b09] border border-[#3d332c] font-mono-numbers font-bold tracking-widest text-sm text-[#d4a359]">
                            {r.roomCode}
                          </span>
                          <div>
                            <div className="text-xs font-semibold text-[#f4efe6] flex items-center gap-2">
                              <span>Host: {r.hostName}</span>
                              <span className="text-[11px] font-mono-numbers text-[#a89f91]">
                                · {r.playerCount}/10 Players
                              </span>
                            </div>
                            <div className="text-[11px] font-mono-numbers text-[#a89f91]">
                              {r.started
                                ? `In Game (${r.phase}) · Lib ${r.liberalPolicies}/5 · Fas ${r.fascistPolicies}/6`
                                : 'Waiting in Lobby'}
                              {' · '}
                              <span className="text-emerald-400">{r.liveUrl}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenLivePage(r.roomCode)}
                            className="px-3 py-1.5 rounded bg-[#241e1a] hover:bg-[#322923] border border-[#3d332c] text-[11px] font-bold uppercase tracking-wider text-[#d4a359] cursor-pointer"
                          >
                            Open Live Page
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setInputCode(r.roomCode);
                              if (inputName.trim()) {
                                setLoading(true);
                                const res = await onJoinRoom(r.roomCode, inputName.trim());
                                setLoading(false);
                                if (!res.success) setErrorMsg(res.error || 'Failed to join');
                              } else {
                                handleOpenLivePage(r.roomCode);
                              }
                            }}
                            className="px-3 py-1.5 rounded bg-[#c83228] hover:bg-[#df3b30] text-[11px] font-bold uppercase tracking-wider text-[#f4efe6] cursor-pointer"
                          >
                            Join
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* TAB 2: OFFLINE PASS & PLAY (SINGLE DEVICE) */
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2e2621] pb-4">
                <div>
                  <h2 className="text-2xl font-woodcut tracking-wider text-[#f4efe6]">
                    Single-Device Pass & Play ({offlineRoster.length} / 10 Players)
                  </h2>
                  <p className="text-xs text-[#a89f91] mt-0.5">
                    Enter everyone&apos;s name below. Rotate the device when prompted—privacy
                    shields protect all secret roles and policy draws.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {offlineRoster.length < 10 && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleAddOfflineSeat(false)}
                        className="px-3 py-2 rounded bg-[#241e1a] hover:bg-[#332a24] border border-[#d4a359]/60 text-xs font-semibold text-[#d4a359] flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>+ Add Player</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddOfflineSeat(true)}
                        className="px-3 py-2 rounded bg-[#1d1815] hover:bg-[#2a221d] border border-[#3d332c] text-xs font-semibold text-[#d6cfc2] flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        <span>+ Add Bot</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Player Names Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {offlineRoster.map((seat, idx) => (
                  <div
                    key={seat.id}
                    className="flex items-center gap-2 p-2.5 rounded bg-[#14110e] border border-[#2e2621]"
                  >
                    <span className="text-xs font-mono-numbers text-[#d4a359] w-7 text-center shrink-0">
                      #{idx + 1}
                    </span>
                    {seat.isBot ? (
                      <Bot className="w-4 h-4 text-[#a89f91] shrink-0" title="Bot Player" />
                    ) : (
                      <User className="w-4 h-4 text-[#d4a359] shrink-0" title="Human Player" />
                    )}
                    <input
                      type="text"
                      aria-label={`Player ${idx + 1} Name`}
                      value={seat.name}
                      onChange={(e) => handleUpdateOfflineSeatName(idx, e.target.value)}
                      placeholder={`Player ${idx + 1} name...`}
                      maxLength={20}
                      className="flex-1 bg-[#0d0b09] border border-[#332a24] focus:border-[#d4a359] rounded px-3 py-1.5 text-sm text-[#f4efe6] focus:outline-none"
                    />
                    {offlineRoster.length > 5 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOfflineSeat(seat.id)}
                        aria-label={`Remove player ${idx + 1}`}
                        className="p-1.5 text-[#a89f91] hover:text-[#e86f5c] rounded hover:bg-[#241c18] transition-colors cursor-pointer"
                        title="Remove Seat"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Role Breakdown & Start Button */}
              <div className="p-4 rounded bg-[#14110e] border border-[#2e2621] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-[#d6cfc2] space-y-1">
                  <div className="font-mono-numbers text-[#a89f91]">
                    Role Distribution ({offlineRoster.length} Players):
                  </div>
                  <div className="font-semibold text-[#f4efe6]">
                    {getRoleBreakdown(offlineRoster.length)}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleStartOffline}
                  className="w-full sm:w-auto px-6 py-3.5 rounded bg-[#d4a359] hover:bg-[#e0b46e] text-[#12100e] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shadow-lg"
                >
                  <Play className="w-4 h-4" />
                  <span>Start Pass & Play Game</span>
                </button>
              </div>
            </div>
          )}

          {/* Footer link for Official Rules */}
          <div className="pt-4 border-t border-[#2e2621] flex items-center justify-between text-xs text-[#a89f91]">
            <button
              onClick={() => {
                sound.playClick();
                onOpenRules();
              }}
              className="hover:text-[#d4a359] underline underline-offset-4 transition-colors cursor-pointer"
            >
              Read Official Secret Hitler Rules
            </button>
            <span className="font-mono-numbers text-[11px] text-[#7a6d60]">
              17 Policy Deck (6 Liberal · 11 Fascist)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};


