import React from 'react';
import { Crown, Check, Bot, Eye } from 'lucide-react';
import { PublicPlayer, Spectator, Vote } from '../game/types.js';

interface PlayerRosterProps {
  players: PublicPlayer[];
  spectators: Spectator[];
  currentUserId: string | null;
  lastVotes: Record<string, Vote> | null;
  isVotingPhase: boolean;
}

export const PlayerRoster: React.FC<PlayerRosterProps> = ({
  players,
  spectators,
  currentUserId,
  lastVotes,
  isVotingPhase,
}) => {
  return (
    <div className="w-full bg-[#161310] border border-[#2e2621] rounded-lg p-4 md:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2e2621] pb-2.5">
        <h3 className="text-base font-woodcut tracking-wider uppercase text-[#f4efe6]">
          Seated Players ({players.filter((p) => p.isAlive).length} / {players.length} Active)
        </h3>
        <span className="text-xs font-mono-numbers text-[#a89f91]">
          Clockwise Presidential Rotation
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {players.map((player, idx) => {
          const isYou = player.id === currentUserId;
          const publicVote = !isVotingPhase && lastVotes ? lastVotes[player.id] : null;

          return (
            <div
              key={player.id}
              className={`relative p-3.5 rounded border transition-all flex flex-col justify-between min-h-[118px] ${
                !player.isAlive
                  ? 'bg-[#0e0c0a] border-[#211b18] opacity-55'
                  : player.isPresident
                  ? 'bg-[#261e14] border-2 border-[#d4a359]'
                  : player.isChancellor
                  ? 'bg-[#1c2329] border-2 border-[#76c4de]'
                  : isYou
                  ? 'bg-[#1f1a16] border-[#6e5d4f]'
                  : 'bg-[#1a1613] border-[#2e2621]'
              }`}
            >
              {/* Placards & Status Row */}
              <div className="flex items-center justify-between gap-1 text-[10px] font-mono-numbers uppercase">
                <div className="flex items-center gap-1.5">
                  {player.isPresident && (
                    <span className="font-woodcut tracking-wider text-xs text-[#d4a359] flex items-center gap-1">
                      <Crown className="w-3.5 h-3.5" /> PRESIDENT
                    </span>
                  )}
                  {player.isChancellor && (
                    <span className="font-woodcut tracking-wider text-xs text-[#76c4de]">
                      CHANCELLOR
                    </span>
                  )}
                  {!player.isPresident && !player.isChancellor && player.isPreviousPresident && (
                    <span className="text-[#a89f91]">Last Pres.</span>
                  )}
                  {!player.isPresident && !player.isChancellor && player.isPreviousChancellor && (
                    <span className="text-[#a89f91]">Last Chan.</span>
                  )}
                  {!player.isPresident &&
                    !player.isChancellor &&
                    !player.isPreviousPresident &&
                    !player.isPreviousChancellor && (
                      <span className="text-[#6e655c]">Seat {idx + 1}</span>
                    )}
                </div>

                <div className="flex items-center gap-1">
                  {player.isBot && <Bot className="w-3.5 h-3.5 text-[#a89f91]" title="Bot Player" />}
                  {isYou && <span className="text-[#d4a359] font-bold">YOU</span>}
                </div>
              </div>

              {/* Player Name */}
              <div className="my-1.5">
                <div
                  className={`font-bold text-sm truncate ${
                    !player.isAlive ? 'line-through text-[#8c7f73]' : 'text-[#f4efe6]'
                  }`}
                >
                  {player.name}
                </div>
                {!player.isAlive && (
                  <span className="text-[10px] font-mono-numbers uppercase text-[#e86f5c] font-bold">
                    Executed
                  </span>
                )}
                {player.investigatedByPresident && player.isAlive && (
                  <span className="text-[10px] text-[#d4a359] block">
                    Loyalty Investigated
                  </span>
                )}
              </div>

              {/* Ballot Status */}
              <div className="pt-2 border-t border-[#2e2621] flex items-center justify-between text-xs">
                {isVotingPhase && player.isAlive ? (
                  player.hasVoted ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-mono-numbers text-[11px]">
                      <Check className="w-3.5 h-3.5" /> Ballot Sealed
                    </span>
                  ) : (
                    <span className="text-[#a89f91] text-[11px]">Deliberating...</span>
                  )
                ) : publicVote && player.isAlive ? (
                  <div
                    className={`w-full py-1 rounded text-center font-woodcut tracking-widest text-xs uppercase border ${
                      publicVote === 'JA'
                        ? 'bg-[#f4efe6] text-[#12100e] border-[#d4a359]'
                        : 'bg-[#1c1613] text-[#e86f5c] border-[#8f2922]'
                    }`}
                  >
                    {publicVote === 'JA' ? 'JA!' : 'NEIN!'}
                  </div>
                ) : (
                  <span className="text-[11px] font-mono-numbers text-[#7a6d60]">
                    {player.isAlive ? 'Seated' : 'Eliminated'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Spectators Footer if any */}
      {spectators.length > 0 && (
        <div className="pt-3 border-t border-[#2e2621] flex flex-wrap items-center gap-2 text-xs text-[#a89f91]">
          <span className="flex items-center gap-1.5 font-mono-numbers uppercase text-[#d4a359]">
            <Eye className="w-3.5 h-3.5" /> Spectators ({spectators.length}):
          </span>
          {spectators.map((s, i) => (
            <React.Fragment key={s.id}>
              <span className="text-[#f4efe6]">{s.name}</span>
              {i < spectators.length - 1 && <span>·</span>}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
