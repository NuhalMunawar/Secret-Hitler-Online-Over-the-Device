import React, { useState } from 'react';
import { Crown, Check, X, Bot, Eye } from 'lucide-react';
import { PublicPlayer, Spectator, Vote } from '../game/types.js';

interface PlayerRosterProps {
  players: PublicPlayer[];
  spectators: Spectator[];
  currentUserId: string | null;
  lastVotes: Record<string, Vote> | null;
  isVotingPhase: boolean;
  isSpectator?: boolean;
  onSyncSeat?: (playerId: string, playerName: string, password: string) => Promise<{ success: boolean; error?: string }>;
}

export const PlayerRoster: React.FC<PlayerRosterProps> = ({
  players,
  spectators,
  currentUserId,
  lastVotes,
  isVotingPhase,
  isSpectator = false,
  onSyncSeat,
}) => {
  const [syncSeatId, setSyncSeatId] = useState<string | null>(null);
  const [syncPassword, setSyncPassword] = useState('');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  const handleConfirmSync = async (e: React.FormEvent, player: PublicPlayer) => {
    e.preventDefault();
    if (!onSyncSeat) return;
    setSyncError(null);
    const cleanPw = syncPassword.trim();
    if (!cleanPw || cleanPw.length < 4 || cleanPw.length > 64) {
      setSyncError('Enter 4–64 character password.');
      return;
    }
    setSyncLoading(true);
    const res = await onSyncSeat(player.id, player.name, cleanPw);
    setSyncLoading(false);
    if (!res.success) {
      setSyncError(res.error || 'Incorrect password');
    } else {
      setSyncSeatId(null);
      setSyncPassword('');
    }
  };
  return (
    <div className="w-full space-y-4">
      <div className="bg-[#181411] border border-[#332a24] rounded-lg p-4 md:p-5 tactile-card-shadow">
        <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-[#2e2621]">
          <h3 className="text-sm font-woodcut uppercase tracking-wider text-[#d4a359]">
            Seated Players ({players.filter((p) => p.isAlive).length} Active / {players.length} Total)
          </h3>
          <span className="text-xs text-[#a89f91]">Clockwise Seating Order</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {players.map((p, idx) => {
            const isMe = p.id === currentUserId;
            const revealedVote = !isVotingPhase && lastVotes ? lastVotes[p.id] : null;
            const history = p.governmentHistory || [];

            return (
              <div
                key={p.id}
                className={`relative p-3 rounded-md border transition-all flex flex-col justify-between gap-2 ${
                  !p.isAlive
                    ? 'bg-[#110e0c] border-[#261f1b] opacity-50'
                    : p.isPresident
                    ? 'bg-[#261e14] border-[#d4a359]'
                    : p.isChancellor
                    ? 'bg-[#13232b] border-[#76c4de]'
                    : isMe
                    ? 'bg-[#1f1a16] border-[#6e5d4f]'
                    : 'bg-[#14110e] border-[#2c251f]'
                }`}
              >
                {/* Seat Index & Badges */}
                <div>
                  <div className="flex items-center justify-between gap-1 text-[10px] font-mono-numbers text-[#a89f91] mb-1">
                    <span>SEAT #{idx + 1}</span>
                    <div className="flex items-center gap-1">
                      {p.isHost && (
                        <span title="Host" className="inline-flex">
                          <Crown className="w-3 h-3 text-[#d4a359]" />
                        </span>
                      )}
                      {p.isBot && (
                        <span title="Automated Agent" className="inline-flex">
                          <Bot className="w-3 h-3 text-[#a89f91]" />
                        </span>
                      )}
                      {isMe && (
                        <span className="px-1.5 py-0.2 bg-[#d4a359]/20 text-[#d4a359] rounded font-bold">
                          YOU
                        </span>
                      )}
                      {isSpectator && !p.isBot && onSyncSeat && (
                        <button
                          type="button"
                          onClick={() => {
                            setSyncError(null);
                            setSyncSeatId((prev) => (prev === p.id ? null : p.id));
                          }}
                          aria-label={`Sync with ${p.name}`}
                          className="px-2 py-0.5 rounded bg-[#241e1a] hover:bg-[#d4a359] text-[#d4a359] hover:text-[#12100e] border border-[#d4a359]/40 text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          Sync
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-1.5">
                    <div
                      className={`font-bold text-sm truncate ${
                        !p.isAlive ? 'line-through text-[#786e65]' : 'text-[#f4efe6]'
                      }`}
                    >
                      {p.name}
                    </div>

                    {/* Past Government History Ticks (Green Tick = Liberal, Red Cross = Fascist) */}
                    {history.length > 0 && (
                      <div className="flex items-center gap-1 shrink-0">
                        {history.map((pol, i) =>
                          pol === 'LIBERAL' ? (
                            <span
                              key={`roster-hist-${i}`}
                              title="Enacted Liberal Policy"
                              className="w-4 h-4 rounded-full bg-emerald-950 border border-emerald-400 text-emerald-400 inline-flex items-center justify-center"
                            >
                              <Check className="w-2.5 h-2.5 stroke-[3.5]" />
                            </span>
                          ) : (
                            <span
                              key={`roster-hist-${i}`}
                              title="Enacted Fascist Policy"
                              className="w-4 h-4 rounded-full bg-red-950 border border-red-400 text-red-400 inline-flex items-center justify-center"
                            >
                              <X className="w-2.5 h-2.5 stroke-[3.5]" />
                            </span>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Placards & Status */}
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {!p.isAlive ? (
                    <span className="px-2 py-0.5 text-[10px] font-woodcut uppercase tracking-wider bg-[#3d1613] text-[#e86f5c] rounded border border-[#6e241e]">
                      EXECUTED
                    </span>
                  ) : (
                    <>
                      {p.isPresident && (
                        <span className="px-2 py-0.5 text-[10px] font-woodcut uppercase tracking-wider bg-[#d4a359] text-[#12100e] rounded font-bold">
                          PRESIDENT
                        </span>
                      )}
                      {p.isChancellor && (
                        <span className="px-2 py-0.5 text-[10px] font-woodcut uppercase tracking-wider bg-[#76c4de] text-[#0c1d24] rounded font-bold">
                          CHANCELLOR
                        </span>
                      )}
                      {!p.isPresident && !p.isChancellor && p.isPreviousPresident && (
                        <span className="px-1.5 py-0.5 text-[9px] font-mono-numbers uppercase bg-[#241e1a] text-[#a89f91] rounded border border-[#382f29]">
                          Prev. Pres
                        </span>
                      )}
                      {!p.isPresident && !p.isChancellor && p.isPreviousChancellor && (
                        <span className="px-1.5 py-0.5 text-[9px] font-mono-numbers uppercase bg-[#241e1a] text-[#a89f91] rounded border border-[#382f29]">
                          Term-Limited
                        </span>
                      )}
                    </>
                  )}

                  {/* Voting Status */}
                  {isVotingPhase && p.isAlive && (
                    <span
                      className={`ml-auto px-1.5 py-0.5 text-[10px] font-mono-numbers rounded flex items-center gap-1 ${
                        p.hasVoted
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/50'
                          : 'bg-[#211c18] text-[#a89f91]'
                      }`}
                    >
                      {p.hasVoted ? (
                        <>
                          <Check className="w-2.5 h-2.5" /> Voted
                        </>
                      ) : (
                        'Voting...'
                      )}
                    </span>
                  )}

                  {/* Last Revealed Vote Badge (Green for JA!, Red for NEIN!) */}
                  {revealedVote && (
                    <span
                      className={`ml-auto px-2.5 py-0.5 text-[11px] font-woodcut uppercase tracking-wider rounded border-2 font-bold shadow-sm ${
                        revealedVote === 'JA'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-500'
                          : 'bg-red-950 text-red-300 border-red-500'
                      }`}
                    >
                      {revealedVote === 'JA' ? 'JA!' : 'NEIN!'}
                    </span>
                  )}
                </div>

                {isSpectator && !p.isBot && syncSeatId === p.id && (
                  <form
                    onSubmit={(e) => handleConfirmSync(e, p)}
                    className="pt-2 border-t border-[#2e2621] space-y-1.5"
                  >
                    <input
                      type="password"
                      aria-label={`Password to sync with ${p.name}`}
                      value={syncPassword}
                      onChange={(e) => setSyncPassword(e.target.value)}
                      placeholder="Seat password..."
                      autoFocus
                      className="w-full px-2 py-1 rounded bg-[#0d0b09] border border-[#d4a359]/60 text-[11px] text-[#f4efe6] focus:outline-none focus:border-[#d4a359]"
                    />
                    {syncError && (
                      <div className="text-[10px] text-[#e86f5c]">{syncError}</div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="submit"
                        disabled={syncLoading}
                        className="flex-1 py-1 rounded bg-[#d4a359] hover:bg-[#e0b46e] text-[#12100e] text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                      >
                        {syncLoading ? '...' : 'Reclaim Seat'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSyncSeatId(null)}
                        className="px-2 py-1 rounded bg-[#241e1a] text-[#a89f91] text-[10px] cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>

        {/* Spectators Strip */}
        {spectators.length > 0 && (
          <div className="mt-4 pt-3 border-t border-[#2e2621] flex flex-wrap items-center gap-2 text-xs text-[#a89f91]">
            <div className="flex items-center gap-1.5 font-mono-numbers uppercase text-[#d4a359]">
              <Eye className="w-3.5 h-3.5" />
              <span>Spectators ({spectators.length}):</span>
            </div>
            {spectators.map((s) => (
              <span
                key={s.id}
                className="px-2 py-0.5 rounded bg-[#120f0d] border border-[#2c251f] text-[#d6cfc2]"
              >
                {s.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
