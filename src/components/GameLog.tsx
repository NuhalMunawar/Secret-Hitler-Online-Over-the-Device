import React, { useState } from 'react';
import { ScrollText, ChevronUp, ChevronDown } from 'lucide-react';
import { GameLogEntry } from '../game/types.js';
import { sound } from '../utils/sound.js';

interface GameLogProps {
  entries: GameLogEntry[];
}

export const GameLog: React.FC<GameLogProps> = ({ entries }) => {
  const [isOpen, setIsOpen] = useState(false);

  const getLogTypeLabel = (type: GameLogEntry['type']) => {
    switch (type) {
      case 'election':
        return 'text-[#d4a359]';
      case 'policy':
        return 'text-[#76c4de]';
      case 'chaos':
        return 'text-[#e86f5c]';
      case 'executive':
        return 'text-[#e86f5c]';
      default:
        return 'text-[#a89f91]';
    }
  };

  return (
    <div className="w-full bg-[#161310] border border-[#2e2621] rounded-lg overflow-hidden">
      <button
        onClick={() => {
          sound.playClick();
          setIsOpen(!isOpen);
        }}
        className="w-full px-4 py-3 bg-[#1a1613] hover:bg-[#221c18] flex items-center justify-between text-xs transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-[#d4a359]" />
          <span className="font-woodcut tracking-wider uppercase text-[#f4efe6] text-sm">
            Session Chronicle & Election History ({entries.length} Records)
          </span>
        </div>
        <div className="flex items-center gap-1 text-[#a89f91]">
          <span className="text-[10px] uppercase font-mono-numbers">{isOpen ? 'Collapse' : 'Expand'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 max-h-56 overflow-y-auto space-y-2 border-t border-[#2e2621] text-xs">
          {entries.length === 0 ? (
            <div className="text-[#a89f91] italic py-2 text-center">No legislative records yet.</div>
          ) : (
            entries
              .slice()
              .reverse()
              .map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-2.5 py-1.5 border-b border-[#241e1a] last:border-b-0"
                >
                  <span
                    className={`font-mono-numbers font-bold text-[10px] uppercase tracking-wider shrink-0 w-20 ${getLogTypeLabel(
                      entry.type
                    )}`}
                  >
                    [{entry.type}]
                  </span>
                  <span className="text-[#d6cfc2] leading-relaxed">{entry.text}</span>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );
};
