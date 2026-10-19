import React, { useEffect, useState } from 'react';
import { ShieldAlert, Crosshair, CheckCircle2 } from 'lucide-react';
import { HitlerSuspenseCheck } from '../game/types.js';
import { FascistSkullSVG } from './Artwork.js';
import { sound } from '../utils/sound.js';

interface ChancellorSuspenseModalProps {
  check: HitlerSuspenseCheck | null;
  onDismiss: () => void;
}

export const ChancellorSuspenseModal: React.FC<ChancellorSuspenseModalProps> = ({
  check,
  onDismiss,
}) => {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!check) {
      setRevealed(false);
      return;
    }

    setRevealed(false);
    // Play the intense mysterious 3.15s suspense sound
    sound.playChancellorSuspense();

    const timer = setTimeout(() => {
      setRevealed(true);
      sound.playSuspenseReveal(check.isHitler);
    }, 3150);

    return () => clearTimeout(timer);
  }, [check]);

  if (!check) return null;

  const isExecution = check.context === 'PLAYER_EXECUTED';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hitler-suspense-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
    >
      <div className="w-full max-w-md rounded-lg bg-[#161210] border-2 border-[#d4a359] tactile-card-shadow overflow-hidden">
        {/* Top Banner */}
        <div className="px-6 py-3.5 bg-[#241311] border-b border-[#59221d] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono-numbers uppercase tracking-widest text-[#e86f5c] font-bold">
            {isExecution ? <Crosshair className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
            <span>
              {isExecution ? 'Execution Identity Check' : 'Chancellor Hitler Check'}
            </span>
          </div>
          <span className="text-[11px] font-mono-numbers text-[#d4a359]">
            {revealed ? 'REVEALED' : 'VERIFYING...'}
          </span>
        </div>

        <div className="p-6 md:p-8 text-center space-y-6">
          {!revealed ? (
            /* PHASE 1: INTENSE MYSTERIOUS SUSPENSE */
            <div className="space-y-5 py-3">
              <div className="w-20 h-20 mx-auto rounded-full bg-[#241814] border-2 border-[#d4a359] flex items-center justify-center animate-pulse">
                <FascistSkullSVG className="w-11 h-11 text-[#d4a359]" />
              </div>

              <div className="space-y-2">
                <h2
                  id="hitler-suspense-title"
                  className="text-3xl md:text-4xl font-woodcut tracking-wider text-[#f4efe6] uppercase"
                >
                  {isExecution
                    ? `Executing ${check.targetName}...`
                    : `Checking Chancellor ${check.targetName}...`}
                </h2>
                <p className="text-xs md:text-sm text-[#a89f91]">
                  {isExecution
                    ? `Is ${check.targetName} Secret Hitler?`
                    : `Is Chancellor ${check.targetName} Secret Hitler?`}
                </p>
              </div>

              {/* Suspense Progress Bar */}
              <div className="w-full max-w-xs mx-auto h-2 bg-[#0d0b09] rounded-full overflow-hidden border border-[#3d332c]">
                <div className="h-full bg-gradient-to-r from-[#8f1d18] via-[#d4a359] to-[#8f1d18] animate-pulse w-full" />
              </div>

              <div>
                <button
                  onClick={() => {
                    setRevealed(true);
                    sound.playSuspenseReveal(check.isHitler);
                  }}
                  className="text-xs font-mono-numbers uppercase tracking-wider text-[#a89f91] hover:text-[#f4efe6] underline underline-offset-4 cursor-pointer"
                >
                  Reveal Now
                </button>
              </div>
            </div>
          ) : (
            /* PHASE 2: REVEAL ONLY HITLER OR NOT HITLER (NO PARTY LEAK) */
            <div className="space-y-6 animate-fade-in">
              <div
                className={`p-6 rounded-lg border-2 space-y-3 ${
                  check.isHitler
                    ? 'bg-[#2b100e] border-[#e86f5c] text-[#ffd2c9]'
                    : 'bg-[#1a1613] border-[#d4a359] text-[#f4efe6]'
                }`}
              >
                <div className="text-xs font-mono-numbers uppercase tracking-[0.2em] text-[#d4a359]">
                  {check.targetName}
                </div>

                <div className="flex justify-center">
                  {check.isHitler ? (
                    <FascistSkullSVG className="w-16 h-16 text-[#e86f5c]" />
                  ) : (
                    <CheckCircle2 className="w-14 h-14 text-emerald-400" />
                  )}
                </div>

                <h2
                  id="hitler-suspense-title"
                  className={`text-4xl md:text-5xl font-woodcut tracking-wider uppercase ${
                    check.isHitler ? 'text-[#ff8978]' : 'text-emerald-400'
                  }`}
                >
                  {check.isHitler ? 'IS HITLER!' : 'NOT HITLER'}
                </h2>

                <p className="text-xs text-[#a89f91]">
                  {check.isHitler
                    ? isExecution
                      ? `${check.targetName} was Secret Hitler! Liberals win!`
                      : `${check.targetName} is Secret Hitler! Fascists win!`
                    : `${check.targetName} is not Secret Hitler. Party affiliation remains secret.`}
                </p>
              </div>

              <button
                onClick={() => {
                  sound.playClick();
                  onDismiss();
                }}
                className="w-full py-3.5 px-6 rounded font-bold text-xs uppercase tracking-wider bg-[#d4a359] hover:bg-[#e0b46e] text-[#12100e] transition-colors cursor-pointer"
              >
                Continue
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
