import React, { useEffect, useRef, useState } from 'react';
import { LiberalDoveSVG, FascistSkullSVG, PolicyTileGraphic } from './Artwork.js';
import { sound } from '../utils/sound.js';
import { Policy } from '../game/types.js';

export interface PolicyEnactedEvent {
  policy: Policy;
  slotNumber: number;
  executiveAction?: string;
  isChaos?: boolean;
}

interface PolicyEnactmentModalProps {
  enacted: PolicyEnactedEvent | null;
  onDismiss: () => void;
}

export const PolicyEnactmentModal: React.FC<PolicyEnactmentModalProps> = ({
  enacted,
  onDismiss,
}) => {
  const [slammed, setSlammed] = useState(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!enacted) {
      setSlammed(false);
      return;
    }

    setSlammed(false);

    if (!sound.animationsEnabled) {
      setSlammed(true);
      sound.playPolicySlam(enacted.policy);
      const instantTimer = setTimeout(() => {
        onDismissRef.current();
      }, 700);
      return () => clearTimeout(instantTimer);
    }

    // Play initial card reveal sound, then slam impact right when card contacts slot
    sound.playCardSlide();

    const slamTimer = setTimeout(() => {
      setSlammed(true);
      // Play heavy tabletop card slam impact + distinct enactment soundtrack
      sound.playPolicySlam(enacted.policy);
    }, 420);

    const closeTimer = setTimeout(() => {
      onDismissRef.current();
    }, 2800);

    return () => {
      clearTimeout(slamTimer);
      clearTimeout(closeTimer);
    };
  }, [enacted]);

  if (!enacted) return null;

  const isLiberal = enacted.policy === 'LIBERAL';
  const totalSlots = isLiberal ? 5 : 6;
  const slots = Array.from({ length: totalSlots }, (_, i) => i + 1);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isLiberal ? 'Liberal Policy Enacted' : 'Fascist Policy Enacted'}
      onClick={() => {
        sound.playClick();
        onDismiss();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in cursor-pointer select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-xl rounded-xl p-5 md:p-7 text-center border-4 shadow-2xl transition-all duration-300 ${
          isLiberal
            ? 'bg-[#0f2430] border-[#5cc8e8] shadow-[0_0_60px_rgba(92,200,232,0.45)]'
            : 'bg-[#260f0d] border-[#e86f5c] shadow-[0_0_60px_rgba(232,111,92,0.45)]'
        }`}
      >
        {/* Tabletop shockwave effect upon slam impact */}
        {slammed && (
          <div
            className={`absolute inset-0 rounded-xl border-4 animate-ping pointer-events-none opacity-40 ${
              isLiberal ? 'border-[#5cc8e8]' : 'border-[#e86f5c]'
            }`}
          />
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-mono-numbers text-xs uppercase tracking-[0.2em] font-bold ${
                enacted.isChaos
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-500/50'
                  : isLiberal
                  ? 'bg-[#153e50] text-[#86d4ec] border border-[#5cc8e8]/50'
                  : 'bg-[#4a1714] text-[#ff8c7a] border border-[#e86f5c]/50'
              }`}
            >
              {enacted.isChaos ? 'Chaos Inaction Resolution' : 'Legislative Vote Enacted'}
            </span>
          </div>

          <div>
            <h2
              className={`text-2xl sm:text-3xl md:text-4xl font-woodcut tracking-wider uppercase ${
                isLiberal ? 'text-[#76c4de]' : 'text-[#ff8978]'
              }`}
            >
              {isLiberal ? 'Liberal Policy Enacted!' : 'Fascist Policy Enacted!'}
            </h2>
            <p className="text-xs text-[#d6cfc2] mt-1">
              Placing policy on the{' '}
              <strong className={isLiberal ? 'text-[#5cc8e8]' : 'text-[#ff8978]'}>
                {isLiberal ? 'Liberal Track' : 'Fascist Track'}
              </strong>{' '}
              at Slot #{enacted.slotNumber}
            </p>
          </div>

          {/* Interactive Mini-Track showing card getting placed at the specific slot */}
          <div
            className={`p-3 md:p-4 rounded-lg border-2 ${
              isLiberal
                ? 'bg-[#0a1820] border-[#224b5e]'
                : 'bg-[#1a0a09] border-[#5e1f1a]'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-mono-numbers text-[#a89f91] mb-2.5 px-1">
              <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
                {isLiberal ? (
                  <LiberalDoveSVG className="w-4 h-4 text-[#76c4de] shrink-0" />
                ) : (
                  <FascistSkullSVG className="w-4 h-4 text-[#e86f5c] shrink-0" />
                )}
                <span>
                  {isLiberal ? 'Liberal Track' : 'Fascist Track'} · {enacted.slotNumber} of {totalSlots} Enacted
                </span>
              </span>
              <span className="text-xs font-bold text-[#f4efe6] shrink-0">
                Slot #{enacted.slotNumber}
              </span>
            </div>

            <div
              className={`grid gap-2.5 ${
                totalSlots === 5 ? 'grid-cols-5' : 'grid-cols-3 sm:grid-cols-6'
              }`}
            >
              {slots.map((slot) => {
                const isPriorSlot = slot < enacted.slotNumber;
                const isTargetSlot = slot === enacted.slotNumber;

                if (isPriorSlot) {
                  return (
                    <div
                      key={`slot-${slot}`}
                      className="aspect-[3/4] rounded border border-white/20 bg-black/40 flex flex-col items-center justify-between p-1.5 overflow-hidden"
                    >
                      <div className="w-full flex-1 min-h-0 flex items-center justify-center overflow-hidden">
                        <PolicyTileGraphic policy={enacted.policy} size="sm" />
                      </div>
                      <span className="text-[9px] font-mono-numbers text-white/60 mt-1 shrink-0">
                        #{slot}
                      </span>
                    </div>
                  );
                }

                if (isTargetSlot) {
                  return (
                    <div
                      key={`slot-${slot}`}
                      className={`relative aspect-[3/4] rounded border-2 transition-all flex flex-col items-center justify-between p-1.5 ${
                        slammed
                          ? isLiberal
                            ? 'border-[#76c4de] bg-[#164254] shadow-[0_0_20px_rgba(118,196,222,0.6)]'
                            : 'border-[#ff8978] bg-[#4a1814] shadow-[0_0_20px_rgba(255,137,120,0.6)]'
                          : 'border-dashed border-amber-400/80 bg-amber-950/20'
                      }`}
                    >
                      {/* Revealed Policy Card slamming down from table height onto this spot */}
                      <div
                        className={`w-full flex-1 min-h-0 flex items-center justify-center transition-all duration-300 ease-out transform ${
                          slammed
                            ? 'scale-100 translate-y-0 rotate-0 opacity-100'
                            : 'scale-110 -translate-y-3 -rotate-3 opacity-90'
                        }`}
                      >
                        <PolicyTileGraphic policy={enacted.policy} size="sm" />
                      </div>

                      <div
                        className={`text-[9px] font-mono-numbers font-bold uppercase tracking-wider mt-1 shrink-0 ${
                          slammed
                            ? isLiberal
                              ? 'text-[#a2e3f5]'
                              : 'text-[#ffc4bc]'
                            : 'text-amber-400 animate-pulse'
                        }`}
                      >
                        {slammed ? `Slot #${slot}` : 'Slamming...'}
                      </div>
                    </div>
                  );
                }

                // Future slot
                return (
                  <div
                    key={`slot-${slot}`}
                    className="aspect-[3/4] rounded border border-white/10 bg-black/20 flex flex-col items-center justify-center p-1 text-[#6e655c]"
                  >
                    <span className="text-[10px] font-woodcut opacity-40">#{slot}</span>
                    <span className="text-[8px] uppercase tracking-wider opacity-30 mt-1">
                      Open
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {enacted.executiveAction && enacted.executiveAction !== 'NONE' && (
            <div className="p-2.5 rounded bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs font-semibold uppercase tracking-wider animate-pulse">
              Executive Action Unlocked: {enacted.executiveAction.replace(/_/g, ' ')}
            </div>
          )}

          <div className="pt-1 flex items-center justify-center">
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                onDismiss();
              }}
              className="px-4 py-1.5 rounded bg-black/30 hover:bg-black/50 border border-white/15 text-[11px] font-mono-numbers uppercase tracking-wider text-[#d6cfc2] hover:text-white transition-colors cursor-pointer"
            >
              Continue (Tap anywhere to dismiss)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
