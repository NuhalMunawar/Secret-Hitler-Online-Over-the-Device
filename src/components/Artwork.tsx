import React from 'react';
import { Policy } from '../game/types.js';

export const LiberalDoveSVG: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
    {/* Outer constructivist sunburst ring */}
    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2" opacity="0.45" />
    <circle cx="32" cy="32" r="23" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
    {/* Stylized woodcut dove in flight */}
    <path
      d="M16 38C22 36 26 31 28 24C29 19 34 15 41 14C38 19 38 24 42 26C46 24 50 20 53 16C52 24 47 31 41 34C45 36 49 36 53 34C48 41 40 44 31 44C24 44 19 41 16 38Z"
      fill="currentColor"
    />
    {/* Olive branch in beak */}
    <path
      d="M41 14C44 11 49 10 53 11M46 11C45 8 47 6 49 6M50 11C50 8 52 7 54 7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export const FascistSkullSVG: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
    {/* Octagonal constructivist frame */}
    <polygon
      points="22,6 42,6 58,22 58,42 42,58 22,58 6,42 6,22"
      stroke="currentColor"
      strokeWidth="2"
      opacity="0.6"
    />
    {/* Woodcut Skull */}
    <path
      d="M32 13C21.5 13 15 20.5 15 29.5C15 35 18 39.5 22 42V49C22 50.5 23.5 52 25 52H39C40.5 52 42 50.5 42 49V42C46 39.5 49 35 49 29.5C49 20.5 42.5 13 32 13Z"
      fill="currentColor"
    />
    {/* Eye sockets & nasal cavity in negative space */}
    <circle cx="25" cy="30" r="4.2" fill="#161311" />
    <circle cx="39" cy="30" r="4.2" fill="#161311" />
    <polygon points="32,33 29.5,39 34.5,39" fill="#161311" />
    {/* Teeth */}
    <line x1="27" y1="44" x2="27" y2="51" stroke="#161311" strokeWidth="2.2" />
    <line x1="32" y1="44" x2="32" y2="51" stroke="#161311" strokeWidth="2.2" />
    <line x1="37" y1="44" x2="37" y2="51" stroke="#161311" strokeWidth="2.2" />
  </svg>
);

export const CrossedDaggerAndLaurelSVG: React.FC<{ className?: string }> = ({ className = 'w-28 h-16' }) => (
  <svg viewBox="0 0 180 76" fill="none" className={className} aria-hidden="true">
    {/* Left Skull */}
    <g transform="translate(16, 18) scale(0.62)" className="text-[#c83228]">
      <path
        d="M32 13C21.5 13 15 20.5 15 29.5C15 35 18 39.5 22 42V49C22 50.5 23.5 52 25 52H39C40.5 52 42 50.5 42 49V42C46 39.5 49 35 49 29.5C49 20.5 42.5 13 32 13Z"
        fill="currentColor"
      />
      <circle cx="25" cy="30" r="4.2" fill="#12100e" />
      <circle cx="39" cy="30" r="4.2" fill="#12100e" />
      <polygon points="32,33 29.5,39 34.5,39" fill="#12100e" />
    </g>

    {/* Center Crossed Sword & Olive Laurel (From Rulebook Cover) */}
    <g className="text-[#f4efe6]">
      {/* Sword blade diagonal bottom-left to top-right */}
      <path d="M62 64L114 12" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M102 14L112 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M111 15L118 8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      {/* Olive branch diagonal top-left to bottom-right */}
      <path d="M64 12L116 64" stroke="#d4a359" strokeWidth="2.8" strokeLinecap="round" />
      <ellipse cx="73" cy="17" rx="5" ry="2.5" transform="rotate(-25 73 17)" fill="#d4a359" />
      <ellipse cx="69" cy="23" rx="5" ry="2.5" transform="rotate(65 69 23)" fill="#d4a359" />
      <ellipse cx="83" cy="27" rx="5" ry="2.5" transform="rotate(-25 83 27)" fill="#d4a359" />
      <ellipse cx="79" cy="33" rx="5" ry="2.5" transform="rotate(65 79 33)" fill="#d4a359" />
      <ellipse cx="97" cy="41" rx="5" ry="2.5" transform="rotate(-25 97 41)" fill="#d4a359" />
      <ellipse cx="93" cy="47" rx="5" ry="2.5" transform="rotate(65 93 47)" fill="#d4a359" />
      <ellipse cx="107" cy="51" rx="5" ry="2.5" transform="rotate(-25 107 51)" fill="#d4a359" />
    </g>

    {/* Right Dove */}
    <g transform="translate(124, 16) scale(0.65)" className="text-[#3898b8]">
      <path
        d="M16 38C22 36 26 31 28 24C29 19 34 15 41 14C38 19 38 24 42 26C46 24 50 20 53 16C52 24 47 31 41 34C45 36 49 36 53 34C48 41 40 44 31 44C24 44 19 41 16 38Z"
        fill="currentColor"
      />
    </g>
  </svg>
);

export const PolicyTileGraphic: React.FC<{
  policy: Policy;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg';
}> = ({ policy, subtitle, size = 'md' }) => {
  const isLiberal = policy === 'LIBERAL';

  const padClass = size === 'sm' ? 'p-2' : size === 'lg' ? 'p-4' : 'p-3';
  const iconClass = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-12 h-12' : 'w-9 h-9';
  const titleClass = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-lg' : 'text-sm';

  return (
    <div
      className={`relative w-full h-full rounded-md ${padClass} flex flex-col items-center justify-between select-none shadow-md overflow-hidden border-2 ${
        isLiberal
          ? 'bg-[#17465c] border-[#76c4de] text-[#f4efe6]'
          : 'bg-[#8f1d18] border-[#e86f5c] text-[#f4efe6]'
      }`}
    >
      {/* Inner Art Deco double border frame */}
      <div
        className={`absolute inset-1.5 border pointer-events-none ${
          isLiberal ? 'border-[#76c4de]/40' : 'border-[#e86f5c]/40'
        }`}
      />

      <span className="relative z-10 text-[9px] font-mono-numbers uppercase tracking-[0.2em] opacity-80">
        {isLiberal ? 'Artikel' : 'Dekret'}
      </span>

      <div className="relative z-10 my-auto flex flex-col items-center">
        {isLiberal ? (
          <LiberalDoveSVG className={`${iconClass} text-[#bae8f7]`} />
        ) : (
          <FascistSkullSVG className={`${iconClass} text-[#ffd2c9]`} />
        )}
        <span className={`font-woodcut tracking-wider uppercase mt-1 ${titleClass}`}>
          {isLiberal ? 'Liberal' : 'Fascist'}
        </span>
      </div>

      <span className="relative z-10 text-[9px] uppercase tracking-widest font-semibold opacity-90">
        {subtitle || 'Policy'}
      </span>
    </div>
  );
};
