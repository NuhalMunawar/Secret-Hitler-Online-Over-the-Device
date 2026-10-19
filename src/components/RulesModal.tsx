import React from 'react';
import { X, Eye, Flame, Crown, AlertTriangle } from 'lucide-react';
import { LiberalDoveSVG, FascistSkullSVG } from './Artwork.js';
import { sound } from '../utils/sound.js';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Official Secret Hitler Rulebook"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-3xl max-h-[86vh] overflow-y-auto bg-[#171412] border-2 border-[#3d332c] rounded-lg shadow-2xl p-6 md:p-8 text-[#d6cfc2]">
        <button
          onClick={() => {
            sound.playClick();
            onClose();
          }}
          aria-label="Close rulebook"
          className="absolute top-5 right-5 text-[#a89f91] hover:text-[#f4efe6] transition-colors p-1.5 rounded hover:bg-[#26201c] cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6 border-b border-[#2e2621] pb-4">
          <span className="text-xs uppercase tracking-[0.2em] text-[#d4a359] font-mono-numbers">
            1932 Tabletop Edition
          </span>
          <h2 className="text-2xl md:text-3xl font-woodcut text-[#f4efe6] tracking-wider mt-1">
            Official Secret Hitler Rules
          </h2>
          <p className="text-xs text-[#a89f91] mt-1 max-w-lg mx-auto">
            5–10 Players · 17 Policy Tiles (6 Liberal, 11 Fascist)
          </p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed">
          {/* Win conditions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded bg-[#112530] border border-[#2c6680]">
              <div className="flex items-center gap-2 mb-2 text-[#76c4de] font-woodcut text-lg tracking-wide">
                <LiberalDoveSVG className="w-6 h-6" />
                Liberal Victory
              </div>
              <ul className="space-y-1.5 text-xs text-[#d6edf5] list-disc list-inside">
                <li>Enact <strong>5 Liberal Policies</strong>.</li>
                <li>Or <strong>Execute Secret Hitler</strong> via Presidential Execution.</li>
              </ul>
            </div>

            <div className="p-4 rounded bg-[#24110f] border border-[#8f2922]">
              <div className="flex items-center gap-2 mb-2 text-[#e86f5c] font-woodcut text-lg tracking-wide">
                <FascistSkullSVG className="w-6 h-6" />
                Fascist Victory
              </div>
              <ul className="space-y-1.5 text-xs text-[#f5d5cf] list-disc list-inside">
                <li>Enact <strong>6 Fascist Policies</strong>.</li>
                <li>Or elect <strong>Hitler as Chancellor</strong> any time after 3 Fascist Policies have been enacted.</li>
              </ul>
            </div>
          </div>

          {/* Role Distribution */}
          <div>
            <h3 className="text-base font-woodcut tracking-wider text-[#d4a359] mb-2 flex items-center gap-2">
              <Eye className="w-4 h-4" /> Role Setup & Night Phase
            </h3>
            <div className="bg-[#120f0d] p-3.5 rounded border border-[#2e2621] text-xs space-y-2">
              <div>
                <strong className="text-[#f4efe6]">5–6 Players:</strong> 3–4 Liberals, 1 Fascist + Hitler. The Fascist and Hitler know each other.
              </div>
              <div>
                <strong className="text-[#f4efe6]">7–10 Players:</strong> 4–6 Liberals, 2–3 Fascists + Hitler. The Fascists know each other and who Hitler is, but <em>Hitler does NOT know who the Fascists are</em>.
              </div>
              <div>
                <strong className="text-[#f4efe6]">Party Membership Card:</strong> When investigated, a player reveals only their Party Membership (Liberal or Fascist). Hitler&apos;s Party card shows <em>Fascist</em>.
              </div>
            </div>
          </div>

          {/* Election & Term Limits */}
          <div>
            <h3 className="text-base font-woodcut tracking-wider text-[#d4a359] mb-2 flex items-center gap-2">
              <Crown className="w-4 h-4" /> Elections, Term Limits & Chaos
            </h3>
            <div className="bg-[#120f0d] p-3.5 rounded border border-[#2e2621] text-xs space-y-1.5">
              <div>
                <strong className="text-[#f4efe6]">Term Limits:</strong> The last <em>elected</em> President and Chancellor cannot be nominated as Chancellor Candidate. <em>5-Player Rule:</em> If only 5 living players remain, only the last elected Chancellor is term-limited; the last President may be nominated.
              </div>
              <div>
                <strong className="text-[#f4efe6]">Voting:</strong> All living players vote <strong>Ja!</strong> or <strong>Nein!</strong> simultaneously. A strict majority of Ja! elects the government.
              </div>
              <div>
                <strong className="text-[#f4efe6]">Chaos (3 Rejected Governments):</strong> If 3 elections fail in a row, the top Policy tile on the Draw Deck is immediately enacted, any Presidential Power on that slot is ignored, the Election Tracker resets to 0, and all term limits are forgotten.
              </div>
            </div>
          </div>

          {/* Legislative Session & Veto */}
          <div>
            <h3 className="text-base font-woodcut tracking-wider text-[#d4a359] mb-2 flex items-center gap-2">
              <Flame className="w-4 h-4" /> Legislative Session & Veto Power
            </h3>
            <div className="bg-[#120f0d] p-3.5 rounded border border-[#2e2621] text-xs space-y-1.5">
              <p>• The President draws the top 3 Policy tiles in secret, discards 1 face-down, and passes 2 to the Chancellor.</p>
              <p>• The Chancellor discards 1 face-down and enacts the remaining Policy tile face-up on its track.</p>
              <p>• <strong>Veto Power (After 5 Fascist Policies):</strong> The Chancellor may propose to Veto the 2 tiles. If the President agrees, both tiles are discarded and the Election Tracker advances by 1. If the President refuses, the Chancellor must enact 1 of the tiles.</p>
            </div>
          </div>

          {/* Presidential Powers */}
          <div>
            <h3 className="text-base font-woodcut tracking-wider text-[#d4a359] mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Presidential Powers (Fascist Track)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
              <div className="bg-[#120f0d] p-3 rounded border border-[#2e2621]">
                <strong className="text-[#d4a359]">Policy Peek:</strong> Secretly view the top 3 Policy tiles in the Draw Deck.
              </div>
              <div className="bg-[#120f0d] p-3 rounded border border-[#2e2621]">
                <strong className="text-[#d4a359]">Investigate Loyalty:</strong> Secretly inspect one player&apos;s Party Membership card.
              </div>
              <div className="bg-[#120f0d] p-3 rounded border border-[#2e2621]">
                <strong className="text-[#d4a359]">Call Special Election:</strong> Choose any other player to be the next Presidential Candidate.
              </div>
              <div className="bg-[#120f0d] p-3 rounded border border-[#2e2621]">
                <strong className="text-[#d4a359]">Execution:</strong> Eliminate one player. If they are Secret Hitler, Liberals win immediately!
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-[#2e2621] flex justify-end">
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-[#12100e] bg-[#d4a359] hover:bg-[#e0b46e] rounded transition-colors cursor-pointer"
          >
            Close Rulebook
          </button>
        </div>
      </div>
    </div>
  );
};
