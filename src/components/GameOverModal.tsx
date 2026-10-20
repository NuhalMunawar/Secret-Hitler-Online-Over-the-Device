import React from 'react';
import { RotateCcw, LogOut } from 'lucide-react';
import { LiberalDoveSVG, FascistSkullSVG } from './Artwork.js';

interface GameOverModalProps {
  isOpen: boolean;
  winner: 'LIBERAL' | 'FASCIST';
  winReason: string;
  roles: Record<string, { role: string; party: string; name: string }>;
  isHost: boolean;
  onRestart: () => void;
  onExitRoom: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  winner,
  winReason,
  roles,
  isHost,
  onRestart,
  onExitRoom,
}) => {
  if (!isOpen) return null;

  const isLiberalWin = winner === 'LIBERAL';

  return (
    <div
      role="dialog"
      aria-label="Game Over"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
    >
      <div
        className={`relative w-full max-w-2xl bg-[#181411] border-2 rounded-lg tactile-card-shadow p-6 md:p-8 text-[#f4efe6] text-center ${
          isLiberalWin ? 'border-[#76c4de]' : 'border-[#c83228]'
        }`}
      >
        <div className="mb-6 space-y-3">
          <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center border-2">
            {isLiberalWin ? (
              <div className="w-full h-full rounded-full bg-[#112530] border-[#76c4de] flex items-center justify-center text-[#76c4de]">
                <LiberalDoveSVG className="w-11 h-11" />
              </div>
            ) : (
              <div className="w-full h-full rounded-full bg-[#2a1210] border-[#e86f5c] flex items-center justify-center text-[#e86f5c]">
                <FascistSkullSVG className="w-11 h-11" />
              </div>
            )}
          </div>

          <div>
            <span className="text-xs uppercase tracking-[0.2em] font-mono-numbers text-[#d4a359]">
              Session Concluded
            </span>
            <h2
              className={`text-3xl md:text-4xl font-woodcut tracking-wider mt-1 uppercase ${
                isLiberalWin ? 'text-[#76c4de]' : 'text-[#e86f5c]'
              }`}
            >
              {isLiberalWin ? 'Liberal Victory' : 'Fascist Victory'}
            </h2>
            <p className="text-sm md:text-base text-[#f4efe6] mt-2 max-w-lg mx-auto font-medium">
              {winReason}
            </p>
          </div>
        </div>

        {/* All Player Roles Unmasked */}
        <div className="my-6 text-left">
          <h3 className="text-sm font-woodcut uppercase tracking-wider text-[#d4a359] mb-3 border-b border-[#2e2621] pb-1.5">
            All Secret Roles Revealed
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
            {Object.entries(roles).map(([id, info]) => {
              const isHitler = info.role === 'HITLER';
              const isFascist = info.role === 'FASCIST';

              return (
                <div
                  key={id}
                  className={`p-3 rounded border text-xs flex items-center justify-between ${
                    isHitler
                      ? 'bg-[#2b1d10] border-[#d4a359] text-[#f4efe6]'
                      : isFascist
                      ? 'bg-[#24110f] border-[#8f2922] text-[#f4efe6]'
                      : 'bg-[#112530] border-[#2c6680] text-[#f4efe6]'
                  }`}
                >
                  <span className="font-bold text-sm truncate mr-2">{info.name}</span>
                  <span
                    className={`font-mono-numbers font-bold uppercase tracking-wider ${
                      isHitler
                        ? 'text-[#d4a359]'
                        : isFascist
                        ? 'text-[#e86f5c]'
                        : 'text-[#76c4de]'
                    }`}
                  >
                    {isHitler ? 'SECRET HITLER' : info.role}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-5 border-t border-[#2e2621] flex flex-col sm:flex-row items-center justify-center gap-3">
          {isHost ? (
            <button
              onClick={onRestart}
              className="w-full sm:w-auto px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#12100e] bg-[#d4a359] hover:bg-[#e0b46e] rounded transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Play Again in This Room</span>
            </button>
          ) : (
            <div className="text-xs text-[#a89f91] italic py-2">
              Waiting for the host to start a new game...
            </div>
          )}

          <button
            onClick={onExitRoom}
            className="w-full sm:w-auto px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#f4efe6] bg-[#241e1a] hover:bg-[#c83228] border border-[#3d332c] hover:border-[#c83228] rounded transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Exit The Room</span>
          </button>
        </div>
      </div>
    </div>
  );
};
