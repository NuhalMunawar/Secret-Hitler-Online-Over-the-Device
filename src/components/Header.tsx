import React, { useState } from 'react';
import {
  BookOpen,
  Copy,
  Check,
  Eye,
  LogOut,
  Volume2,
  VolumeX,
  Smartphone,
  Radio,
} from 'lucide-react';
import { sound } from '../utils/sound.js';

interface HeaderProps {
  roomCode: string | null;
  isOfflineMode?: boolean;
  isSpectator: boolean;
  onOpenRules: () => void;
  onOpenDossier: () => void;
  onLeaveRoom: () => void;
  hasRole: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  roomCode,
  isOfflineMode = false,
  isSpectator,
  onOpenRules,
  onOpenDossier,
  onLeaveRoom,
  hasRole,
}) => {
  const [copied, setCopied] = useState(false);
  const [muted, setMuted] = useState(sound.muted);
  const [ambience, setAmbience] = useState(sound.ambienceActive);

  const copyRoomLink = () => {
    if (!roomCode) return;
    sound.playClick();
    const link = `${window.location.origin}?room=${roomCode}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleToggleSound = () => {
    const next = sound.toggleMute();
    setMuted(next);
    if (next) setAmbience(false);
  };

  const handleToggleAmbience = () => {
    const active = sound.toggleAmbience();
    setAmbience(active);
    setMuted(sound.muted);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#14110f]/95 backdrop-blur-md border-b border-[#2e2621] px-4 md:px-8 py-3 flex items-center justify-between gap-4 md:gap-8">
      {/* Zone 1: Single text element wordmark */}
      <a
        href="/"
        className="text-xl md:text-2xl font-woodcut tracking-wider text-[#f4efe6] hover:text-[#d4a359] transition-colors whitespace-nowrap shrink-0"
      >
        SECRET HITLER
      </a>

      {/* Zone 2: Navigation & Room Actions */}
      <nav className="flex items-center gap-3 md:gap-5 text-xs">
        {isOfflineMode && (
          <span className="flex items-center gap-1.5 text-[#d4a359] font-mono-numbers font-bold uppercase tracking-wider whitespace-nowrap shrink-0">
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Pass & Play</span>
          </span>
        )}

        {roomCode && !isOfflineMode && (
          <button
            onClick={copyRoomLink}
            title="Copy room invite link"
            aria-label={`Copy invite link for room ${roomCode}`}
            className="flex items-center gap-1.5 text-[#f4efe6] hover:text-[#d4a359] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span className="text-[#a89f91]">Room:</span>
            <span className="font-mono-numbers font-bold tracking-wider text-[#d4a359]">{roomCode}</span>
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-[#a89f91]" />
            )}
          </button>
        )}

        {isSpectator && roomCode && !isOfflineMode && (
          <span className="text-[#d4a359] font-mono-numbers uppercase tracking-wider whitespace-nowrap shrink-0">
            · Spectating
          </span>
        )}

        <button
          onClick={() => {
            sound.playClick();
            onOpenRules();
          }}
          className="flex items-center gap-1.5 text-[#d6cfc2] hover:text-[#f4efe6] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5 text-[#d4a359]" />
          <span>Rulebook</span>
        </button>

        {(hasRole || isOfflineMode) && !isSpectator && (
          <button
            onClick={() => {
              sound.playPaperSlide();
              onOpenDossier();
            }}
            className="flex items-center gap-1.5 text-[#d4a359] hover:text-[#f4efe6] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Secret Role</span>
          </button>
        )}

        <button
          onClick={handleToggleAmbience}
          aria-label={ambience ? 'Disable tabletop atmosphere drone' : 'Enable tabletop atmosphere drone'}
          title={ambience ? 'Disable tabletop atmosphere' : 'Enable tabletop atmosphere'}
          className={`flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            ambience ? 'text-emerald-400 font-semibold' : 'text-[#a89f91] hover:text-[#f4efe6]'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{ambience ? 'Ambience On' : 'Ambience'}</span>
        </button>

        <button
          onClick={handleToggleSound}
          aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
          title={muted ? 'Unmute sound effects' : 'Mute sound effects'}
          className="flex items-center gap-1 text-[#a89f91] hover:text-[#f4efe6] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {muted ? <VolumeX className="w-4 h-4 text-[#c83228]" /> : <Volume2 className="w-4 h-4 text-[#d4a359]" />}
          <span className="hidden md:inline">{muted ? 'Muted' : 'Sound FX'}</span>
        </button>
      </nav>

      {/* Zone 3: Primary action */}
      <div className="flex items-center shrink-0">
        {roomCode || isOfflineMode ? (
          <button
            onClick={onLeaveRoom}
            aria-label={isOfflineMode ? 'Exit Pass & Play' : 'Leave Room'}
            className="px-3 py-1.5 text-xs font-semibold text-[#f4efe6] bg-[#26201c] hover:bg-[#c83228] border border-[#3d332c] rounded transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{isOfflineMode ? 'Exit Pass & Play' : 'Leave Room'}</span>
          </button>
        ) : (
          <button
            onClick={() => {
              sound.playClick();
              onOpenRules();
            }}
            className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-[#12100e] bg-[#d4a359] hover:bg-[#e0b46e] rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            How to Play
          </button>
        )}
      </div>
    </header>
  );
};
