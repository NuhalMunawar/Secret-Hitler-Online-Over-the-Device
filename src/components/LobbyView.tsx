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
  ShieldCheck,
  Smartphone,
  Globe,
  UserPlus,
  Trash2,
} from 'lucide-react';
import { RoomMember } from '../hooks/useGameSocket.js';
import { OfflinePlayerEntry } from '../hooks/useOfflineGame.js';
import { Spectator } from '../game/types.js';
import { CrossedDaggerAndLaurelSVG } from './Artwork.js';
import { sound } from '../utils/sound.js';

interface LobbyViewProps {
  roomCode: string | null;
  playerName: string;
  isHost: boolean;
  isSpectator: boolean;
  players: RoomMember[];
  spectators: Spectator[];
  onCreateRoom: (name: string) => Promise<{ success: boolean; error?: string }>;
  onJoinRoom: (code: string, name: string) => Promise<{ success: boolean; error?: string }>;
  onAddBot: () => void;
  onRemoveBot: (botId: string) => void;
  onStartGame: () => void;
  onStartOfflineGame: (players: OfflinePlayerEntry[]) => { success: boolean; error?: string };
  onOpenRules: () => void;
  onOpenDiagnostics: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  roomCode,
  playerName,
  isHost,
  isSpectator,
  players,
  spectators,
  onCreateRoom,
  onJoinRoom,
  onAddBot,
  onRemoveBot,
  onStartGame,
  onStartOfflineGame,
  onOpenRules,
  onOpenDiagnostics,
}) => {
  const [playModeTab, setPlayModeTab] = useState<'online' | 'offline'>('online');
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
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('room');
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
    const res = await onCreateRoom(inputName.trim());
    setLoading(false);
    if (!res.success) setErrorMsg(res.error || 'Failed to create room');
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!inputName.trim()) {
      setErrorMsg('Please enter your name before joining.');
      return;
    }
    if (!inputCode.trim()) {
      setErrorMsg('Please enter the 4-letter room code.');
      return;
    }
    setLoading(true);
    const res = await onJoinRoom(inputCode.trim().toUpperCase(), inputName.trim());
    setLoading(false);
    if (!res.success) setErrorMsg(res.error || 'Failed to join room');
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

    const nameToUse = !isBot && newOfflinePlayerName.trim() ? newOfflinePlayerName.trim() : fallbackName;

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

  const copyInvite = () => {
    if (!roomCode) return;
    sound.playClick();
    const url = `${window.location.origin}?room=${roomCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const getRoleBreakdown = (count: number) => {
    if (count < 5) return 'Requires 5 to 10 players (3 Liberals · 1 Fascist · 1 Hitler at 5 players)';
    if (count === 5) return '3 Liberals · 1 Fascist · 1 Secret Hitler (Hitler knows Fascist)';
    if (count === 6) return '4 Liberals · 1 Fascist · 1 Secret Hitler (Hitler knows Fascist)';
    if (count === 7) return '4 Liberals · 2 Fascists · 1 Secret Hitler (Hitler blind to Fascists)';
    if (count === 8) return '5 Liberals · 2 Fascists · 1 Secret Hitler (Hitler blind to Fascists)';
    if (count === 9) return '5 Liberals · 3 Fascists · 1 Secret Hitler (Hitler blind to Fascists)';
    return '6 Liberals · 3 Fascists · 1 Secret Hitler (Hitler blind to Fascists)';
  };

  // 1. IN ONLINE ROOM LOBBY
  if (roomCode) {
    const canStart = players.length >= 5 && players.length <= 10;
    const needMore = Math.max(0, 5 - players.length);

    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        {/* Room Banner */}
        <div className="bg-[#181411] border-2 border-[#3d332c] rounded-lg p-6 md:p-8 tactile-card-shadow text-center relative overflow-hidden">
          <div className="text-xs font-mono-numbers uppercase tracking-[0.2em] text-[#d4a359]">
            Tabletop Room Lobby · Late Joiners Automatically Spectate
          </div>
          <h2 className="text-3xl md:text-4xl font-woodcut tracking-wider text-[#f4efe6] mt-1">
            Room {roomCode}
          </h2>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <div className="px-4 py-2 rounded bg-[#110e0c] border border-[#3d332c] font-mono-numbers text-sm flex items-center gap-2">
              <span className="text-[#a89f91] text-xs uppercase">Code:</span>
              <span className="text-[#d4a359] font-bold tracking-widest text-lg">{roomCode}</span>
            </div>

            <button
              onClick={copyInvite}
              className="px-4 py-2.5 rounded bg-[#d4a359] hover:bg-[#e0b46e] text-[#12100e] text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Invite Link Copied!' : 'Copy Invite Link'}</span>
            </button>
          </div>

          <p className="mt-4 text-xs text-[#a89f91] font-mono-numbers">
            Envelope Setup ({players.length} seated): <strong className="text-[#f4efe6]">{getRoleBreakdown(players.length)}</strong>
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
                Anyone joining after the game starts will enter Spectator mode automatically.
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
                  {isHost && p.isBot && (
                    <button
                      onClick={() => onRemoveBot(p.id)}
                      aria-label={`Remove bot ${p.name}`}
                      className="text-[#a89f91] hover:text-[#c83228] text-sm font-bold px-1.5 py-0.5 rounded hover:bg-[#2a221d] cursor-pointer"
                      title="Remove Bot"
                    >
                      ×
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
                    className="text-xs text-[#d6cfc2] bg-[#1d1815] border border-[#2e2621] px-2.5 py-1 rounded"
                  >
                    {s.name}
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
                  Need <strong className="text-[#d4a359]">{needMore} more player{needMore > 1 ? 's' : ''}</strong> to start (5–10 players). Share the room code or add Bot Players to test.
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

  // 2. LANDING VIEW: ONLINE MULTIPLAYER OR OFFLINE PASS & PLAY
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
          Play the 5–10 player social deduction board game online with custom rooms (and spectator support for late joiners) or offline on a single shared device with Pass & Play privacy shields.
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
            <div role="alert" className="p-3 rounded bg-[#3b1412] border border-[#c83228] text-xs text-[#ffd2c9]">
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
                <div className="p-5 rounded bg-[#14110e] border border-[#2e2621] flex flex-col justify-between space-y-5">
                  <div>
                    <h2 className="font-woodcut text-xl tracking-wide text-[#f4efe6]">
                      Create Custom Room
                    </h2>
                    <p className="text-xs text-[#a89f91] mt-1 leading-relaxed">
                      Start a new table and share the 4-letter code or direct link with your friends.
                    </p>
                  </div>

                  <button
                    onClick={handleCreate}
                    disabled={loading}
                    className="w-full py-3 px-4 text-xs font-bold uppercase tracking-wider text-[#12100e] bg-[#d4a359] hover:bg-[#e0b46e] rounded transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <span>{loading ? 'Creating...' : 'Create Room'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Join or Spectate Room */}
                <div className="p-5 rounded bg-[#14110e] border border-[#2e2621] flex flex-col justify-between space-y-4">
                  <div>
                    <h2 className="font-woodcut text-xl tracking-wide text-[#f4efe6]">
                      Join or Spectate Room
                    </h2>
                    <p className="text-xs text-[#a89f91] mt-1 mb-3 leading-relaxed">
                      Enter a 4-letter room code. If the game has already started, you will join as a Spectator.
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

                  <button
                    onClick={handleJoin}
                    disabled={loading}
                    className="w-full py-3 px-4 text-xs font-bold uppercase tracking-wider text-[#f4efe6] bg-[#c83228] hover:bg-[#df3b30] rounded transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <span>{loading ? 'Joining...' : 'Join Room'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
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
                    Enter everyone&apos;s name below. Rotate the device when prompted—privacy shields protect all secret roles and policy draws.
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

          {/* Footer links for Official Rules & Verification Agents */}
          <div className="pt-4 border-t border-[#2e2621] flex flex-wrap items-center justify-between gap-3 text-xs text-[#a89f91]">
            <button
              onClick={() => {
                sound.playClick();
                onOpenRules();
              }}
              className="hover:text-[#d4a359] underline underline-offset-4 transition-colors cursor-pointer"
            >
              Read Official Secret Hitler Rules
            </button>

            <button
              onClick={() => {
                sound.playClick();
                onOpenDiagnostics();
              }}
              className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Run 5 Rule-Verification Agents</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
