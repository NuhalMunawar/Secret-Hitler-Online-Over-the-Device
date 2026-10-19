import React from 'react';
import { Eye, Search, Vote, Crosshair, Layers } from 'lucide-react';
import { ExecutiveAction } from '../game/types.js';
import { LiberalDoveSVG, FascistSkullSVG, PolicyTileGraphic } from './Artwork.js';

interface PolicyTracksProps {
  liberalPolicies: number;
  fascistPolicies: number;
  deckCount: number;
  discardCount: number;
  playerCount: number;
}

export const PolicyTracks: React.FC<PolicyTracksProps> = ({
  liberalPolicies,
  fascistPolicies,
  deckCount,
  discardCount,
  playerCount,
}) => {
  const getFascistSlotInfo = (slotIndex: number): { action: ExecutiveAction; title: string; subtitle: string } => {
    if (slotIndex === 6) {
      return { action: 'NONE', title: 'FASCIST VICTORY', subtitle: '6th Policy Enacted' };
    }

    if (playerCount <= 6) {
      if (slotIndex === 3) return { action: 'PEEK', title: 'Policy Peek', subtitle: 'View top 3 tiles' };
      if (slotIndex === 4) return { action: 'EXECUTE', title: 'Execution', subtitle: 'Eliminate 1 player' };
      if (slotIndex === 5) return { action: 'EXECUTE', title: 'Execution + Veto', subtitle: 'Eliminate & Veto' };
      return { action: 'NONE', title: 'No Power', subtitle: '5–6 Player Track' };
    } else if (playerCount <= 8) {
      if (slotIndex === 2) return { action: 'INVESTIGATE', title: 'Investigate', subtitle: 'Check Party Card' };
      if (slotIndex === 3) return { action: 'SPECIAL_ELECTION', title: 'Special Election', subtitle: 'Pick next President' };
      if (slotIndex === 4) return { action: 'EXECUTE', title: 'Execution', subtitle: 'Eliminate 1 player' };
      if (slotIndex === 5) return { action: 'EXECUTE', title: 'Execution + Veto', subtitle: 'Eliminate & Veto' };
      return { action: 'NONE', title: 'No Power', subtitle: '7–8 Player Track' };
    } else {
      if (slotIndex === 1 || slotIndex === 2) return { action: 'INVESTIGATE', title: 'Investigate', subtitle: 'Check Party Card' };
      if (slotIndex === 3) return { action: 'SPECIAL_ELECTION', title: 'Special Election', subtitle: 'Pick next President' };
      if (slotIndex === 4) return { action: 'EXECUTE', title: 'Execution', subtitle: 'Eliminate 1 player' };
      if (slotIndex === 5) return { action: 'EXECUTE', title: 'Execution + Veto', subtitle: 'Eliminate & Veto' };
      return { action: 'NONE', title: 'No Power', subtitle: '9–10 Player Track' };
    }
  };

  const renderFascistIcon = (action: ExecutiveAction, slotIndex: number) => {
    if (slotIndex === 6) return <FascistSkullSVG className="w-8 h-8 text-[#c83228]" />;
    switch (action) {
      case 'PEEK':
        return <Eye className="w-6 h-6 text-[#d4a359]" />;
      case 'INVESTIGATE':
        return <Search className="w-6 h-6 text-[#d4a359]" />;
      case 'SPECIAL_ELECTION':
        return <Vote className="w-6 h-6 text-[#d4a359]" />;
      case 'EXECUTE':
        return <Crosshair className="w-6 h-6 text-[#e86f5c]" />;
      default:
        return <span className="text-sm font-woodcut text-[#7a6d60]">{slotIndex}</span>;
    }
  };

  return (
    <div className="w-full space-y-5">
      {/* LIBERAL BOARD */}
      <div className="relative p-4 md:p-6 rounded-lg bg-[#112530] border-2 border-[#2c6680] tactile-card-shadow">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b border-[#2c6680]/50 pb-2.5">
          <div className="flex items-center gap-2.5">
            <LiberalDoveSVG className="w-6 h-6 text-[#76c4de]" />
            <h2 className="text-base md:text-lg font-woodcut tracking-wider uppercase text-[#f4efe6]">
              Liberal Track
            </h2>
            <span className="text-xs text-[#91c4d8] hidden sm:inline">
              · Enact 5 Liberal Policies or Execute Hitler to Win
            </span>
          </div>
          <div className="text-xs font-mono-numbers font-bold text-[#76c4de]">
            {liberalPolicies} / 5 ENACTED
          </div>
        </div>

        {/* 5 Liberal Slots */}
        <div className="grid grid-cols-5 gap-2.5 md:gap-4">
          {[1, 2, 3, 4, 5].map((slot) => {
            const isEnacted = slot <= liberalPolicies;
            const isVictorySlot = slot === 5;

            return (
              <div
                key={`lib-${slot}`}
                className={`relative aspect-[3/4] rounded border-2 flex flex-col items-center justify-between p-1.5 md:p-2 text-center transition-all ${
                  isEnacted
                    ? 'border-[#bae8f7] bg-[#17465c]'
                    : 'bg-[#0b1921]/90 border-[#25556b]/70 text-[#6e9db0]'
                }`}
              >
                {isEnacted ? (
                  <PolicyTileGraphic policy="LIBERAL" subtitle={`Tile #${slot}`} size="sm" />
                ) : (
                  <>
                    <div className="text-[10px] font-mono-numbers uppercase tracking-wider opacity-75">
                      Slot {slot}
                    </div>
                    <div className="my-auto flex flex-col items-center">
                      <LiberalDoveSVG className="w-7 h-7 md:w-9 md:h-9 opacity-45" />
                      <span className="text-[10px] md:text-xs font-woodcut uppercase tracking-wider mt-1">
                        {isVictorySlot ? 'LIBERAL WIN' : 'Liberal'}
                      </span>
                    </div>
                    <div className="text-[9px] uppercase tracking-wider opacity-70">
                      {isVictorySlot ? '5th Policy' : 'Open Slot'}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* FASCIST BOARD */}
      <div className="relative p-4 md:p-6 rounded-lg bg-[#24110f] border-2 border-[#8f2922] tactile-card-shadow">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 border-b border-[#8f2922]/50 pb-2.5">
          <div className="flex items-center gap-2.5">
            <FascistSkullSVG className="w-6 h-6 text-[#e86f5c]" />
            <h2 className="text-base md:text-lg font-woodcut tracking-wider uppercase text-[#f4efe6]">
              Fascist Track ({playerCount <= 6 ? '5–6' : playerCount <= 8 ? '7–8' : '9–10'} Players)
            </h2>
          </div>
          <div className="text-xs font-mono-numbers font-bold text-[#e86f5c]">
            {fascistPolicies} / 6 ENACTED
          </div>
        </div>

        {/* Hitler Danger Zone Notice */}
        <div
          className={`mb-4 px-3.5 py-2 rounded border text-xs flex flex-wrap items-center justify-between gap-2 ${
            fascistPolicies >= 3
              ? 'bg-[#4a1410] border-[#e86f5c] text-[#f4efe6]'
              : 'bg-[#180b0a] border-[#541d18] text-[#c49a93]'
          }`}
        >
          <span className="font-woodcut tracking-wider uppercase">
            Hitler Chancellor Zone (Slots 4–6):
          </span>
          <span>
            {fascistPolicies >= 3 ? (
              <strong className="text-[#d4a359]">
                ACTIVE — If Hitler is elected Chancellor now, Fascists win immediately!
              </strong>
            ) : (
              'Activates once 3 Fascist policies are enacted.'
            )}
          </span>
        </div>

        {/* 6 Fascist Slots */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 md:gap-3.5">
          {[1, 2, 3, 4, 5, 6].map((slot) => {
            const isEnacted = slot <= fascistPolicies;
            const slotInfo = getFascistSlotInfo(slot);
            const isDangerZone = slot >= 4;

            return (
              <div
                key={`fas-${slot}`}
                className={`relative aspect-[3/4] rounded border-2 flex flex-col items-center justify-between p-1.5 md:p-2 text-center transition-all ${
                  isEnacted
                    ? 'border-[#ffd2c9] bg-[#8f1d18]'
                    : isDangerZone
                    ? 'bg-[#170908] border-[#782620] text-[#d6b2ac]'
                    : 'bg-[#140b0a] border-[#4d1e1a] text-[#a8847e]'
                }`}
              >
                {isEnacted ? (
                  <PolicyTileGraphic policy="FASCIST" subtitle={slotInfo.title} size="sm" />
                ) : (
                  <>
                    <div className="text-[10px] font-mono-numbers uppercase tracking-wider opacity-80">
                      Slot {slot}
                    </div>
                    <div className="my-auto flex flex-col items-center px-1">
                      <div className="mb-1.5">{renderFascistIcon(slotInfo.action, slot)}</div>
                      <span className="text-[10px] md:text-xs font-woodcut tracking-wide text-[#f4efe6] leading-tight">
                        {slotInfo.title}
                      </span>
                    </div>
                    <div className="text-[9px] opacity-80 leading-tight">{slotInfo.subtitle}</div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* POLICY DECK & DISCARD PILE */}
      <div className="p-4 rounded-lg bg-[#181411] border border-[#332a24] flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Layers className="w-5 h-5 text-[#d4a359] shrink-0" />
          <div>
            <div className="text-sm font-woodcut tracking-wider uppercase text-[#f4efe6]">
              Policy Deck &amp; Discard
            </div>
            <div className="text-xs text-[#a89f91]">
              17 tiles (6 Liberal · 11 Fascist) · Reshuffles discard when Draw &lt; 3
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <span className="text-[10px] uppercase text-[#a89f91] block font-mono-numbers">Draw Pile</span>
            <span className="font-mono-numbers font-bold text-base text-[#d4a359]">{deckCount}</span>
          </div>
          <div className="text-right border-l border-[#332a24] pl-4">
            <span className="text-[10px] uppercase text-[#a89f91] block font-mono-numbers">Discard</span>
            <span className="font-mono-numbers font-bold text-base text-[#f4efe6]">{discardCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
