import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Copy,
  Check,
  Eye,
  LogOut,
  Volume2,
  VolumeX,
  Smartphone,
  Music,
  Sparkles,
  Sliders,
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
  const [ambienceVol, setAmbienceVol] = useState(sound.ambienceVolume);
  const [animationsOn, setAnimationsOn] = useState(sound.animationsEnabled);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  useEffect(() => {
    return sound.subscribe(() => {
      setMuted(sound.muted);
      setAmbience(sound.ambienceActive);
      setAmbienceVol(sound.ambienceVolume);
      setAnimationsOn(sound.animationsEnabled);
    });
  }, []);

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
  };

  const handleToggleAmbience = () => {
    sound.playClick();
    const active = sound.toggleAmbience();
    setAmbience(active);
  };

  const handleToggleAnimations = () => {
    sound.playClick();
    const next = sound.toggleAnimations();
    setAnimationsOn(next);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setAmbienceVol(val);
    sound.setAmbienceVolume(val);
    if (!ambience && val > 0) {
      sound.startAmbience();
      setAmbience(true);
    }
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

        {/* Animations toggle */}
        <button
          onClick={handleToggleAnimations}
          aria-label={animationsOn ? 'Disable animations' : 'Enable animations'}
          title="Enable/disable chancellor suspense check & policy slam animations"
          className={`flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer px-2 py-1 rounded border ${
            animationsOn
              ? 'text-emerald-300 bg-emerald-950/40 border-emerald-500/40'
              : 'text-[#8c8275] bg-[#1a1613] border-[#362e27] hover:text-[#f4efe6]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Animations: {animationsOn ? 'ON' : 'OFF'}</span>
        </button>

        {/* Ambience music toggle & volume control */}
        <div className="relative flex items-center shrink-0">
          <div
            className={`flex items-center gap-1 rounded border px-2 py-1 transition-colors ${
              ambience
                ? 'text-emerald-300 bg-emerald-950/40 border-emerald-500/40'
                : 'text-[#8c8275] bg-[#1a1613] border-[#362e27]'
            }`}
          >
            <button
              onClick={handleToggleAmbience}
              aria-label={ambience ? 'Pause suspense music' : 'Play suspense music'}
              title={ambience ? 'Pause suspense background music' : 'Play suspense background music'}
              className="flex items-center gap-1 cursor-pointer hover:text-[#f4efe6]"
            >
              <Music className={`w-3.5 h-3.5 ${ambience ? 'animate-pulse text-emerald-400' : ''}`} />
              <span className="hidden sm:inline">Music: {ambience ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={() => {
                sound.playClick();
                setShowVolumeSlider((prev) => !prev);
              }}
              aria-label="Adjust ambience music volume"
              title="Ambience music volume"
              className="ml-1 text-[#a89f91] hover:text-[#f4efe6] cursor-pointer"
            >
              <Sliders className="w-3 h-3" />
            </button>
          </div>

          {/* Ambience Volume Popover Slider */}
          {showVolumeSlider && (
            <div className="absolute top-full mt-2 right-0 bg-[#181411] border border-[#3d332c] rounded-lg p-3 shadow-2xl z-50 w-48 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-[11px] font-mono-numbers text-[#a89f91]">
                <span>Music Volume</span>
                <span className="text-[#d4a359] font-bold">{Math.round(ambienceVol * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={ambienceVol}
                onChange={handleVolumeChange}
                aria-label="Ambience volume"
                className="w-full accent-[#d4a359] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#7a6d60]">
                <button
                  onClick={() => {
                    sound.playClick();
                    setAmbienceVol(0);
                    sound.setAmbienceVolume(0);
                  }}
                  className="hover:text-[#f4efe6] cursor-pointer"
                >
                  Mute
                </button>
                <button
                  onClick={() => {
                    sound.playClick();
                    setAmbienceVol(0.28);
                    sound.setAmbienceVolume(0.28);
                  }}
                  className="hover:text-[#f4efe6] cursor-pointer"
                >
                  Default (28%)
                </button>
                <button
                  onClick={() => {
                    sound.playClick();
                    setAmbienceVol(1);
                    sound.setAmbienceVolume(1);
                  }}
                  className="hover:text-[#f4efe6] cursor-pointer"
                >
                  100%
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sound FX Toggle */}
        <button
          onClick={handleToggleSound}
          aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
          title={muted ? 'Unmute sound effects' : 'Mute sound effects'}
          className={`flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer px-2 py-1 rounded border ${
            !muted
              ? 'text-[#d4a359] bg-[#241e1a] border-[#3d332c]'
              : 'text-[#c83228] bg-[#261210] border-[#59221d]'
          }`}
        >
          {muted ? <VolumeX className="w-3.5 h-3.5 text-[#c83228]" /> : <Volume2 className="w-3.5 h-3.5 text-[#d4a359]" />}
          <span className="hidden md:inline">{muted ? 'SFX: OFF' : 'SFX: ON'}</span>
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
