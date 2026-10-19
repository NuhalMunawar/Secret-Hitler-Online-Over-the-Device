import React, { useState, useEffect } from 'react';
import { Eye, CheckCircle2, AlertCircle, Smartphone, Users } from 'lucide-react';
import { NightInfo, PublicPlayer } from '../game/types.js';
import { LiberalDoveSVG, FascistSkullSVG } from './Artwork.js';
import { sound } from '../utils/sound.js';

interface NightModalProps {
  isOpen: boolean;
  onClose: () => void;
  nightInfo: NightInfo | null;
  playerName: string;
  isNightPhase: boolean;
  onConfirmNight?: () => void;
  // Offline Pass-and-Play props
  isOfflineMode?: boolean;
  nightStepCurrent?: number;
  nightStepTotal?: number;
  allPlayers?: PublicPlayer[];
  getOfflineNightInfo?: (playerId: string) => NightInfo | null;
}

export const NightModal: React.FC<NightModalProps> = ({
  isOpen,
  onClose,
  nightInfo,
  playerName,
  isNightPhase,
  onConfirmNight,
  isOfflineMode = false,
  nightStepCurrent = 1,
  nightStepTotal = 5,
  allPlayers = [],
  getOfflineNightInfo,
}) => {
  const [envelopeOpened, setEnvelopeOpened] = useState(false);
  const [selectedPeekPlayerId, setSelectedPeekPlayerId] = useState<string | null>(null);

  // Reset envelope seal whenever modal opens or player changes
  useEffect(() => {
    setEnvelopeOpened(false);
    if (!isNightPhase) {
      setSelectedPeekPlayerId(null);
    }
  }, [isOpen, playerName, isNightPhase, nightStepCurrent]);

  if (!isOpen) return null;

  // In Offline Mode outside of Night Phase, let the person holding the device pick their name first
  const isOfflineMidGamePeek = isOfflineMode && !isNightPhase;
  const targetPlayer = isOfflineMidGamePeek
    ? allPlayers.find((p) => p.id === selectedPeekPlayerId) || null
    : null;

  const activeNightInfo = isOfflineMidGamePeek
    ? selectedPeekPlayerId && getOfflineNightInfo
      ? getOfflineNightInfo(selectedPeekPlayerId)
      : null
    : nightInfo;

  const activePlayerName = isOfflineMidGamePeek
    ? targetPlayer?.name || ''
    : playerName;

  if (!isOfflineMidGamePeek && !activeNightInfo) return null;

  const isLiberal = activeNightInfo?.role === 'LIBERAL';
  const isFascist = activeNightInfo?.role === 'FASCIST';
  const isHitler = activeNightInfo?.role === 'HITLER';

  const handleOpenEnvelope = () => {
    sound.playPaperSlide();
    setEnvelopeOpened(true);
  };

  const handleFinish = () => {
    sound.playClick();
    setEnvelopeOpened(false);
    setSelectedPeekPlayerId(null);
    if (isNightPhase && onConfirmNight) {
      onConfirmNight();
    } else {
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Secret Role Envelope"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/92 backdrop-blur-md animate-fade-in"
    >
      <div className="relative w-full max-w-xl bg-[#181411] border-2 border-[#473b32] rounded-lg tactile-card-shadow p-6 md:p-8 text-[#f4efe6] text-center">
        {/* CASE 1: Offline Mid-Game Role Check — Choose which player is holding the device */}
        {isOfflineMidGamePeek && !selectedPeekPlayerId ? (
          <div className="space-y-5 py-2">
            <div>
              <span className="text-xs uppercase tracking-[0.2em] text-[#d4a359] font-mono-numbers flex items-center justify-center gap-1.5">
                <Users className="w-4 h-4" /> Pass & Play Secret Envelope Check
              </span>
              <h2 className="text-2xl md:text-3xl font-woodcut tracking-wider text-[#f4efe6] mt-1">
                Who Is Holding the Device?
              </h2>
              <p className="text-xs text-[#a89f91] mt-1">
                Select your name below to privately inspect your Secret Role envelope.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-left">
              {allPlayers
                .filter((p) => !p.isBot)
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      sound.playClick();
                      setSelectedPeekPlayerId(p.id);
                      setEnvelopeOpened(false);
                    }}
                    className="p-3 rounded bg-[#241e1a] hover:bg-[#332922] border border-[#453930] hover:border-[#d4a359] transition-all cursor-pointer"
                  >
                    <div className="font-bold text-sm text-[#f4efe6] truncate">{p.name}</div>
                    <div className="text-[10px] font-mono-numbers uppercase text-[#d4a359] mt-0.5">
                      Select Envelope →
                    </div>
                  </button>
                ))}
            </div>

            <div className="pt-3 border-t border-[#2e2621] flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#d6cfc2] bg-[#26201c] hover:bg-[#362e28] rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : !envelopeOpened ? (
          /* CASE 2: Privacy Lock / Pass Device Confirmation before unsealing envelope */
          <div className="py-6 space-y-6">
            {isOfflineMode && isNightPhase && (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded bg-[#261e14] border border-[#d4a359]/60 text-xs font-mono-numbers text-[#d4a359]">
                <Smartphone className="w-4 h-4" />
                <span>
                  Pass & Play Setup · Player {nightStepCurrent} of {nightStepTotal}
                </span>
              </div>
            )}

            <div className="w-20 h-20 mx-auto rounded-full bg-[#241d17] border-2 border-[#d4a359] flex items-center justify-center text-[#d4a359]">
              <Eye className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-[#d4a359] font-mono-numbers block">
                {isOfflineMode ? 'Pass Device & Verify Privacy' : 'Strictly Confidential'}
              </span>
              <h2 className="text-3xl md:text-4xl font-woodcut tracking-wider text-[#f4efe6]">
                {isOfflineMode ? `Pass Device to ${activePlayerName}` : 'Your Secret Role Envelope'}
              </h2>
              <p className="text-sm text-[#d6cfc2] max-w-md mx-auto leading-relaxed">
                <strong>{activePlayerName}</strong>, take the device and make sure no one else can see the screen before unsealing your confidential role and party intelligence.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              {isOfflineMidGamePeek && (
                <button
                  onClick={() => setSelectedPeekPlayerId(null)}
                  className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#d6cfc2] bg-[#26201c] hover:bg-[#362e28] rounded transition-all cursor-pointer"
                >
                  ← Back
                </button>
              )}
              <button
                onClick={handleOpenEnvelope}
                className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#12100e] bg-[#d4a359] hover:bg-[#e0b46e] rounded transition-all cursor-pointer"
              >
                I am {activePlayerName} · Unseal Secret Envelope
              </button>
            </div>
          </div>
        ) : (
          /* CASE 3: Unsealed Envelope — Secret Role, Party Card & Night Intel */
          <div className="space-y-6 text-left animate-fade-in">
            <div className="text-center border-b border-[#2e2621] pb-4">
              <span className="text-xs uppercase tracking-[0.2em] text-[#d4a359] font-mono-numbers">
                {activePlayerName}&apos;s Secret Role & Party Card
              </span>
              <h2 className="text-3xl font-woodcut tracking-wider text-[#f4efe6] mt-0.5">
                {isLiberal ? 'LIBERAL' : isFascist ? 'FASCIST' : 'SECRET HITLER'}
              </h2>
            </div>

            {/* Cards Display */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Secret Role Card */}
              <div
                className={`p-5 rounded border-2 flex flex-col items-center text-center justify-between min-h-[175px] ${
                  isLiberal
                    ? 'bg-[#112530] border-[#76c4de] text-[#f4efe6]'
                    : isFascist
                    ? 'bg-[#2a1210] border-[#e86f5c] text-[#f4efe6]'
                    : 'bg-[#2b1d10] border-[#d4a359] text-[#f4efe6]'
                }`}
              >
                <div className="text-[10px] font-mono-numbers uppercase tracking-widest opacity-80">
                  Secret Role Card
                </div>
                <div className="my-2 flex flex-col items-center">
                  {isLiberal ? (
                    <LiberalDoveSVG className="w-12 h-12 text-[#76c4de]" />
                  ) : (
                    <FascistSkullSVG
                      className={`w-12 h-12 ${isHitler ? 'text-[#d4a359]' : 'text-[#e86f5c]'}`}
                    />
                  )}
                  <div className="font-woodcut text-2xl mt-2 tracking-wider">
                    {activeNightInfo!.role}
                  </div>
                </div>
                <div className="text-xs opacity-80">
                  {isLiberal
                    ? 'Enact 5 Liberal Policies or Execute Hitler'
                    : isFascist
                    ? 'Enact 6 Fascist Policies or Elect Hitler'
                    : 'Get Elected Chancellor after 3 Fascist Policies'}
                </div>
              </div>

              {/* Party Membership Card */}
              <div
                className={`p-5 rounded border-2 flex flex-col items-center text-center justify-between min-h-[175px] ${
                  activeNightInfo!.party === 'LIBERAL'
                    ? 'bg-[#0e1e26] border-[#2c6680] text-[#f4efe6]'
                    : 'bg-[#210f0d] border-[#8f2922] text-[#f4efe6]'
                }`}
              >
                <div className="text-[10px] font-mono-numbers uppercase tracking-widest opacity-80">
                  Party Membership Card
                </div>
                <div className="my-2">
                  <div className="font-woodcut text-2xl tracking-wider uppercase">
                    {activeNightInfo!.party} PARTY
                  </div>
                  <div className="text-xs text-[#d6cfc2] mt-2 max-w-[190px]">
                    Revealed if a President uses Investigate Loyalty on you.
                  </div>
                </div>
                <div className="text-[10px] text-[#a89f91] font-mono-numbers">
                  {isHitler ? 'Shows Fascist Party (Hides Hitler Role)' : 'Official Party Card'}
                </div>
              </div>
            </div>

            {/* Night Phase Teammates / Intel */}
            <div className="bg-[#120f0d] p-4 rounded border border-[#2e2621] text-xs space-y-2">
              <div className="text-[#d4a359] font-woodcut uppercase tracking-wider text-sm flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> Night Phase Intelligence
              </div>

              {isLiberal && (
                <p className="text-[#d6cfc2] leading-relaxed">
                  You do not know anyone else&apos;s role. Liberals hold the majority, but Fascists will lie and sow distrust. Work out who to trust and keep Hitler out of the Chancellorship once 3 Fascist policies are on the board!
                </p>
              )}

              {isFascist && (
                <div className="space-y-1.5 text-[#d6cfc2]">
                  <p>
                    <strong>Secret Hitler is:</strong>{' '}
                    <span className="font-bold text-[#d4a359]">
                      {activeNightInfo!.hitlerName || 'Unknown'}
                    </span>
                  </p>
                  {activeNightInfo!.teammates && activeNightInfo!.teammates.length > 0 && (
                    <p>
                      <strong>Fellow Fascists:</strong>{' '}
                      <span className="font-bold text-[#e86f5c]">
                        {activeNightInfo!.teammates.map((t) => t.name).join(', ')}
                      </span>
                    </p>
                  )}
                  <p className="text-[#a89f91]">
                    {activeNightInfo!.hitlerKnowsFascists
                      ? '5–6 Player Rule: Hitler also knows who you are.'
                      : '7–10 Player Rule: Hitler does NOT know who the Fascists are. Protect and elect Hitler!'}
                  </p>
                </div>
              )}

              {isHitler && (
                <div className="space-y-1.5 text-[#d6cfc2]">
                  {activeNightInfo!.hitlerKnowsFascists ? (
                    <p>
                      <strong>5–6 Player Rule — Your fellow Fascist is:</strong>{' '}
                      <span className="font-bold text-[#e86f5c]">
                        {activeNightInfo!.teammates?.map((t) => t.name).join(', ') || 'Unknown'}
                      </span>
                    </p>
                  ) : (
                    <p>
                      <strong>7–10 Player Rule:</strong> You do NOT know who the Fascists are, but they know who you are! Play like a trustworthy Liberal so the table elects you Chancellor after 3 Fascist policies are enacted.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={handleFinish}
                className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-[#12100e] bg-[#d4a359] hover:bg-[#e0b46e] rounded transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isOfflineMode && isNightPhase
                    ? nightStepCurrent < nightStepTotal
                      ? 'Seal Envelope & Pass to Next Player →'
                      : 'Seal Final Envelope & Start Round 1 →'
                    : isNightPhase
                    ? 'Seal Envelope & Enter Table'
                    : 'Re-Seal Secret Envelope'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
