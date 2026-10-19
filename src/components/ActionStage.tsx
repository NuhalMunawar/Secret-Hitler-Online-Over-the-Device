import React from 'react';
import { Crosshair, CheckCircle, Eye, Smartphone, Lock, Users } from 'lucide-react';
import { ExecutiveAction, Phase, Policy, PublicPlayer, Vote as VoteType } from '../game/types.js';
import { PolicyTileGraphic, LiberalDoveSVG, FascistSkullSVG } from './Artwork.js';

interface ActionStageProps {
  phase: Phase;
  players: PublicPlayer[];
  currentUserId: string | null;
  isSpectator: boolean;
  presidentIndex: number;
  chancellorIndex: number | null;
  eligibleChancellors: number[];
  userVote: VoteType | null;
  voteProgress: { votesIn: number; votesNeeded: number } | null;
  presidentCards: Policy[] | null;
  chancellorCards: Policy[] | null;
  canVeto: boolean;
  peekCards: Policy[] | null;
  investigationResult: { targetIndex: number; party: 'LIBERAL' | 'FASCIST'; targetName: string } | null;
  executiveAction: ExecutiveAction;
  onCompleteNight: () => void;
  onNominate: (index: number) => void;
  onVote: (vote: VoteType) => void;
  onPresidentDiscard: (index: number) => void;
  onChancellorDiscard: (index: number) => void;
  onChancellorVeto: () => void;
  onPresidentVetoResponse: (accept: boolean) => void;
  onAcknowledgePeek: () => void;
  onInvestigate: (index: number) => void;
  onAcknowledgeInvestigation: () => void;
  onSpecialElection: (index: number) => void;
  onExecute: (index: number) => void;
  // Offline Pass-and-Play props
  isOfflineMode?: boolean;
  activeActorName?: string;
  privacyUnlocked?: boolean;
  onUnlockPrivacy?: () => void;
  onOpenNightEnvelope?: () => void;
  onQuickTableVote?: (passed: boolean) => void;
}

export const ActionStage: React.FC<ActionStageProps> = ({
  phase,
  players,
  currentUserId,
  isSpectator,
  presidentIndex,
  chancellorIndex,
  eligibleChancellors,
  userVote,
  voteProgress,
  presidentCards,
  chancellorCards,
  canVeto,
  peekCards,
  investigationResult,
  executiveAction,
  onCompleteNight,
  onNominate,
  onVote,
  onPresidentDiscard,
  onChancellorDiscard,
  onChancellorVeto,
  onPresidentVetoResponse,
  onAcknowledgePeek,
  onInvestigate,
  onAcknowledgeInvestigation,
  onSpecialElection,
  onExecute,
  isOfflineMode = false,
  activeActorName = '',
  privacyUnlocked = false,
  onUnlockPrivacy,
  onOpenNightEnvelope,
  onQuickTableVote,
}) => {
  const currentPresident = players[presidentIndex];
  const currentChancellor = chancellorIndex !== null ? players[chancellorIndex] : null;
  const isUserPresident =
    isOfflineMode || (!isSpectator && currentPresident && currentPresident.id === currentUserId);
  const isUserChancellor =
    isOfflineMode || (!isSpectator && currentChancellor && currentChancellor.id === currentUserId);
  const currentUser = players.find((p) => p.id === currentUserId);
  const isUserAlive = isOfflineMode ? true : !isSpectator && currentUser ? currentUser.isAlive : false;

  const votedCount = voteProgress
    ? voteProgress.votesIn
    : players.filter((p) => p.isAlive && p.hasVoted).length;
  const neededCount = voteProgress
    ? voteProgress.votesNeeded
    : players.filter((p) => p.isAlive).length;

  return (
    <div className="w-full bg-[#181411] border-2 border-[#3d332c] rounded-lg p-5 md:p-6 tactile-card-shadow relative">
      {/* Spectator Banner (Online Mode) */}
      {isSpectator && !isOfflineMode && (
        <div className="mb-4 px-3.5 py-2 rounded bg-[#241e1a] border border-[#d4a359]/40 text-xs text-[#d6cfc2] flex items-center justify-between">
          <span className="flex items-center gap-2 font-semibold text-[#d4a359]">
            <Eye className="w-4 h-4" /> Spectator Mode Active
          </span>
          <span className="text-[#a89f91]">
            You joined after the game started and are observing the table live.
          </span>
        </div>
      )}

      {/* Offline Pass-and-Play Device Rotation Banner */}
      {isOfflineMode && activeActorName && (
        <div className="mb-4 px-4 py-2.5 rounded bg-[#261e14] border border-[#d4a359]/60 text-xs text-[#f4efe6] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#d4a359] shrink-0" />
            <span>
              Pass Device To:{' '}
              <strong className="text-[#d4a359] uppercase tracking-wider font-mono-numbers">
                {activeActorName}
              </strong>
            </span>
          </div>
          <span className="text-[11px] text-[#a89f91]">
            Single-Device Pass & Play · Keep secret screens hidden from other players
          </span>
        </div>
      )}

      {/* 0. NIGHT PHASE FALLBACK */}
      {phase === 'NIGHT' && (
        <div className="py-4 text-center space-y-3">
          <div className="text-xs font-mono-numbers uppercase tracking-widest text-[#d4a359]">
            Setup · Secret Role Inspection
          </div>
          <h3 className="text-xl font-woodcut tracking-wider text-[#f4efe6]">
            {isOfflineMode
              ? `Pass Device to ${activeActorName} to Inspect Secret Role`
              : 'Players Are Inspecting Their Secret Envelopes'}
          </h3>
          {isOfflineMode && onOpenNightEnvelope ? (
            <button
              onClick={onOpenNightEnvelope}
              className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-[#12100e] bg-[#d4a359] hover:bg-[#e0b46e] rounded transition-colors cursor-pointer"
            >
              Open {activeActorName}&apos;s Secret Envelope
            </button>
          ) : (
            !isSpectator && (
              <button
                onClick={onCompleteNight}
                className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-[#12100e] bg-[#d4a359] hover:bg-[#e0b46e] rounded transition-colors cursor-pointer"
              >
                Proceed to First Election
              </button>
            )
          )}
        </div>
      )}

      {/* 1. NOMINATION PHASE */}
      {phase === 'NOMINATION' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2e2621] pb-3">
            <div>
              <span className="text-xs uppercase tracking-widest font-mono-numbers text-[#d4a359]">
                Step 1 · Form a Government
              </span>
              <h3 className="text-xl font-woodcut tracking-wider text-[#f4efe6]">
                {isOfflineMode
                  ? `President ${currentPresident?.name}: Nominate a Chancellor`
                  : 'Nominate a Chancellor Candidate'}
              </h3>
            </div>
            <span className="text-xs font-mono-numbers text-[#d6cfc2]">
              Presidential Candidate: <strong className="text-[#d4a359]">{currentPresident?.name}</strong>
            </span>
          </div>

          {isUserPresident ? (
            <div className="space-y-3">
              <p className="text-xs md:text-sm text-[#d6cfc2]">
                {isOfflineMode ? (
                  <>
                    <strong>{currentPresident?.name}</strong>, choose an eligible player to nominate as your Chancellor Candidate:
                  </>
                ) : (
                  'Pass the Chancellor placard to an eligible player. Term-limited players from the last elected government cannot be nominated:'
                )}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {players.map((p, idx) => {
                  if (idx === presidentIndex || !p.isAlive) return null;
                  const isEligible = eligibleChancellors.includes(idx);

                  return (
                    <button
                      key={p.id}
                      onClick={() => onNominate(idx)}
                      disabled={!isEligible}
                      className={`p-3.5 rounded border text-left transition-all ${
                        isEligible
                          ? 'bg-[#241e1a] hover:bg-[#332922] hover:border-[#d4a359] border-[#453930] text-[#f4efe6] cursor-pointer'
                          : 'bg-[#120f0d] border-[#26201c] text-[#6e655c] cursor-not-allowed opacity-55'
                      }`}
                    >
                      <div className="font-bold text-sm truncate">{p.name}</div>
                      <div className="text-[11px] mt-1 font-mono-numbers uppercase">
                        {isEligible ? (
                          <span className="text-[#d4a359]">Select as Chancellor →</span>
                        ) : (
                          <span>Term-Limited</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="py-5 text-center space-y-1.5">
              <div className="text-base text-[#f4efe6]">
                President <strong className="text-[#d4a359]">{currentPresident?.name}</strong> is choosing a Chancellor candidate...
              </div>
              <p className="text-xs text-[#a89f91]">
                Discuss potential governments freely with the table over voice.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 2. VOTING PHASE */}
      {phase === 'VOTING' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2e2621] pb-3">
            <div>
              <span className="text-xs uppercase tracking-widest font-mono-numbers text-[#d4a359]">
                Step 2 · Election Ballot
              </span>
              <h3 className="text-xl font-woodcut tracking-wider text-[#f4efe6]">
                Vote on the Proposed Government
              </h3>
            </div>
            <span className="text-xs font-mono-numbers text-[#d6cfc2]">
              Ballots Sealed: <strong className="text-[#d4a359]">{votedCount}</strong> / {neededCount}
            </span>
          </div>

          <div className="bg-[#120f0d] p-3.5 rounded border border-[#2e2621] text-xs md:text-sm text-[#f4efe6] flex flex-wrap items-center justify-between gap-2">
            <div>
              Proposed Ticket:{' '}
              <strong className="text-[#d4a359]">President {currentPresident?.name}</strong> &{' '}
              <strong className="text-[#76c4de]">Chancellor {currentChancellor?.name}</strong>
            </div>
            <span className="text-xs text-[#a89f91]">
              All ballots are revealed simultaneously once everyone has voted.
            </span>
          </div>

          {isOfflineMode ? (
            <div className="space-y-5 pt-1">
              {!privacyUnlocked ? (
                <div className="p-6 rounded bg-[#14110e] border border-[#3d332c] text-center space-y-3">
                  <div className="text-xs font-mono-numbers uppercase tracking-widest text-[#d4a359]">
                    Secret Ballot ({votedCount + 1} of {neededCount})
                  </div>
                  <h4 className="text-2xl font-woodcut tracking-wider text-[#f4efe6]">
                    Pass Device to {activeActorName}
                  </h4>
                  <p className="text-xs text-[#a89f91] max-w-md mx-auto">
                    <strong>{activeActorName}</strong>, unlock your ballot to cast a secret Ja! or Nein! vote, or use the Quick Table Vote below if your group voted out loud in person.
                  </p>
                  <button
                    onClick={onUnlockPrivacy}
                    className="px-6 py-3 rounded bg-[#d4a359] hover:bg-[#e0b46e] text-[#12100e] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    I am {activeActorName} · Unlock My Ballot
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-center text-xs font-mono-numbers uppercase tracking-wider text-[#d4a359]">
                    Casting Secret Ballot as <strong>{activeActorName}</strong>:
                  </div>
                  <div className="grid grid-cols-2 gap-5 max-w-md mx-auto">
                    <button
                      onClick={() => onVote('JA')}
                      className="p-6 rounded-md bg-[#f4efe6] hover:bg-white text-[#12100e] border-2 border-[#d4a359] tactile-card-shadow transition-transform hover:-translate-y-0.5 flex flex-col items-center justify-center gap-1 cursor-pointer"
                    >
                      <span className="text-3xl md:text-4xl font-woodcut tracking-wider">JA!</span>
                      <span className="text-[10px] uppercase tracking-widest font-mono-numbers text-[#4a3f35] font-bold">
                        Approve Ticket
                      </span>
                    </button>

                    <button
                      onClick={() => onVote('NEIN')}
                      className="p-6 rounded-md bg-[#181311] hover:bg-[#241917] text-[#f4efe6] border-2 border-[#c83228] tactile-card-shadow transition-transform hover:-translate-y-0.5 flex flex-col items-center justify-center gap-1 cursor-pointer"
                    >
                      <span className="text-3xl md:text-4xl font-woodcut tracking-wider text-[#e86f5c]">
                        NEIN!
                      </span>
                      <span className="text-[10px] uppercase tracking-widest font-mono-numbers text-[#c49a93] font-bold">
                        Reject Ticket
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* In-Person Voice / Table Vote Shortcut */}
              {onQuickTableVote && (
                <div className="pt-3 border-t border-[#2e2621] flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="text-[#a89f91] flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#d4a359]" />
                    <span>Voted out loud in person around the table?</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onQuickTableVote(true)}
                      className="px-3 py-1.5 rounded bg-[#241e1a] hover:bg-[#332a24] border border-[#d4a359]/50 text-[#f4efe6] font-semibold transition-colors cursor-pointer"
                    >
                      Table Approved (Majority JA!)
                    </button>
                    <button
                      onClick={() => onQuickTableVote(false)}
                      className="px-3 py-1.5 rounded bg-[#241412] hover:bg-[#381b18] border border-[#c83228]/60 text-[#ffd2c9] font-semibold transition-colors cursor-pointer"
                    >
                      Table Rejected (Majority NEIN!)
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : isSpectator ? (
            <div className="py-4 text-center text-xs text-[#a89f91]">
              Waiting for all active players to cast their Ja! or Nein! ballots...
            </div>
          ) : isUserAlive ? (
            userVote || currentUser?.hasVoted ? (
              <div className="py-5 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#211c18] border border-[#3d332c] text-xs font-mono-numbers text-emerald-400">
                  <CheckCircle className="w-4 h-4" />
                  <span>Your ballot ({userVote || 'SEALED'}) is cast. Waiting for remaining players...</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-5 max-w-md mx-auto pt-2">
                <button
                  onClick={() => onVote('JA')}
                  className="p-6 rounded-md bg-[#f4efe6] hover:bg-white text-[#12100e] border-2 border-[#d4a359] tactile-card-shadow transition-transform hover:-translate-y-0.5 flex flex-col items-center justify-center gap-1 cursor-pointer"
                >
                  <span className="text-3xl md:text-4xl font-woodcut tracking-wider">JA!</span>
                  <span className="text-[10px] uppercase tracking-widest font-mono-numbers text-[#4a3f35] font-bold">
                    Approve Ticket
                  </span>
                </button>

                <button
                  onClick={() => onVote('NEIN')}
                  className="p-6 rounded-md bg-[#181311] hover:bg-[#241917] text-[#f4efe6] border-2 border-[#c83228] tactile-card-shadow transition-transform hover:-translate-y-0.5 flex flex-col items-center justify-center gap-1 cursor-pointer"
                >
                  <span className="text-3xl md:text-4xl font-woodcut tracking-wider text-[#e86f5c]">
                    NEIN!
                  </span>
                  <span className="text-[10px] uppercase tracking-widest font-mono-numbers text-[#c49a93] font-bold">
                    Reject Ticket
                  </span>
                </button>
              </div>
            )
          ) : (
            <div className="py-4 text-center text-xs text-[#a89f91]">
              You have been executed and may no longer vote or hold office.
            </div>
          )}
        </div>
      )}

      {/* 3. LEGISLATIVE - PRESIDENT */}
      {phase === 'LEGISLATIVE_PRESIDENT' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2e2621] pb-3">
            <div>
              <span className="text-xs uppercase tracking-widest font-mono-numbers text-[#d4a359]">
                Step 3 · Legislative Session (President)
              </span>
              <h3 className="text-xl font-woodcut tracking-wider text-[#f4efe6]">
                President Draws 3 Policy Tiles
              </h3>
            </div>
            <span className="text-xs font-mono-numbers text-[#d6cfc2]">
              President: <strong className="text-[#d4a359]">{currentPresident?.name}</strong>
            </span>
          </div>

          {isOfflineMode && !privacyUnlocked ? (
            <div className="p-6 rounded bg-[#14110e] border-2 border-[#d4a359]/60 text-center space-y-3">
              <Lock className="w-8 h-8 text-[#d4a359] mx-auto" />
              <div className="text-xs font-mono-numbers uppercase tracking-widest text-[#d4a359]">
                Strictly Confidential Legislative Draw
              </div>
              <h4 className="text-2xl font-woodcut tracking-wider text-[#f4efe6]">
                Pass Device to President {currentPresident?.name}
              </h4>
              <p className="text-xs text-[#d6cfc2] max-w-md mx-auto">
                <strong>{currentPresident?.name}</strong>, make sure no one else can see the screen before revealing the 3 drawn Policy tiles.
              </p>
              <button
                onClick={onUnlockPrivacy}
                className="px-6 py-3 rounded bg-[#d4a359] hover:bg-[#e0b46e] text-[#12100e] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                I am President {currentPresident?.name} · Reveal 3 Policy Tiles
              </button>
            </div>
          ) : isUserPresident && presidentCards ? (
            <div className="space-y-4">
              <p className="text-xs md:text-sm text-[#d6cfc2]">
                You drew these 3 tiles in secret. <strong>Click ONE tile to discard face-down.</strong> The remaining 2 tiles will be passed to Chancellor {currentChancellor?.name}:
              </p>

              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                {presidentCards.map((policy, idx) => (
                  <button
                    key={`pres-card-${idx}`}
                    onClick={() => onPresidentDiscard(idx)}
                    aria-label={`Discard ${policy} policy tile ${idx + 1}`}
                    className="aspect-[3/4] rounded-md transition-transform hover:-translate-y-1 cursor-pointer group focus:outline-none"
                  >
                    <PolicyTileGraphic policy={policy} subtitle="Click to Discard" size="md" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-6 text-center space-y-1.5">
              <div className="text-base text-[#f4efe6]">
                President <strong className="text-[#d4a359]">{currentPresident?.name}</strong> is secretly discarding 1 of the 3 Policy tiles...
              </div>
              <p className="text-xs text-[#a89f91]">
                The President and Chancellor may not communicate during the Legislative Session.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 4. LEGISLATIVE - CHANCELLOR */}
      {phase === 'LEGISLATIVE_CHANCELLOR' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2e2621] pb-3">
            <div>
              <span className="text-xs uppercase tracking-widest font-mono-numbers text-[#d4a359]">
                Step 3 · Legislative Session (Chancellor)
              </span>
              <h3 className="text-xl font-woodcut tracking-wider text-[#f4efe6]">
                Chancellor Enacts 1 Policy Tile
              </h3>
            </div>
            <span className="text-xs font-mono-numbers text-[#d6cfc2]">
              Chancellor: <strong className="text-[#76c4de]">{currentChancellor?.name}</strong>
            </span>
          </div>

          {isOfflineMode && !privacyUnlocked ? (
            <div className="p-6 rounded bg-[#14110e] border-2 border-[#76c4de]/60 text-center space-y-3">
              <Lock className="w-8 h-8 text-[#76c4de] mx-auto" />
              <div className="text-xs font-mono-numbers uppercase tracking-widest text-[#76c4de]">
                Strictly Confidential Chancellor Hand
              </div>
              <h4 className="text-2xl font-woodcut tracking-wider text-[#f4efe6]">
                Pass Device to Chancellor {currentChancellor?.name}
              </h4>
              <p className="text-xs text-[#d6cfc2] max-w-md mx-auto">
                President <strong>{currentPresident?.name}</strong> discarded 1 tile face-down. Hand the device to Chancellor <strong>{currentChancellor?.name}</strong> to privately inspect the remaining 2 Policy tiles.
              </p>
              <button
                onClick={onUnlockPrivacy}
                className="px-6 py-3 rounded bg-[#76c4de] hover:bg-[#93d5eb] text-[#12100e] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                I am Chancellor {currentChancellor?.name} · Reveal 2 Policy Tiles
              </button>
            </div>
          ) : isUserChancellor && chancellorCards ? (
            <div className="space-y-4">
              <p className="text-xs md:text-sm text-[#d6cfc2]">
                President {currentPresident?.name} passed you these 2 Policy tiles. <strong>Click the Policy tile you wish to ENACT</strong> onto the board:
              </p>

              <div className="grid grid-cols-2 gap-5 max-w-sm mx-auto">
                {chancellorCards.map((policy, idx) => {
                  const discardIdx = idx === 0 ? 1 : 0;
                  return (
                    <button
                      key={`chan-card-${idx}`}
                      onClick={() => onChancellorDiscard(discardIdx)}
                      aria-label={`Enact ${policy} policy tile ${idx + 1}`}
                      className="aspect-[3/4] rounded-md transition-transform hover:-translate-y-1 cursor-pointer focus:outline-none"
                    >
                      <PolicyTileGraphic policy={policy} subtitle="Click to Enact" size="md" />
                    </button>
                  );
                })}
              </div>

              {canVeto && (
                <div className="pt-3 text-center border-t border-[#2e2621]">
                  <button
                    onClick={onChancellorVeto}
                    className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#f4efe6] bg-[#8f1d18] hover:bg-[#a8241e] border border-[#e86f5c] rounded transition-colors cursor-pointer"
                  >
                    Propose Veto (Discard Both Tiles)
                  </button>
                  <p className="text-[11px] text-[#a89f91] mt-1">
                    Requires President {currentPresident?.name}&apos;s consent.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="py-6 text-center space-y-1.5">
              <div className="text-base text-[#f4efe6]">
                Chancellor <strong className="text-[#76c4de]">{currentChancellor?.name}</strong> is selecting 1 of the 2 Policy tiles to enact...
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. VETO PENDING */}
      {phase === 'VETO_PENDING' && (
        <div className="space-y-4">
          <div className="border-b border-[#2e2621] pb-3">
            <span className="text-xs uppercase tracking-widest font-mono-numbers text-[#e86f5c]">
              Executive Veto Power
            </span>
            <h3 className="text-xl font-woodcut tracking-wider text-[#f4efe6]">
              Chancellor Proposed to Veto the Agenda
            </h3>
          </div>

          {isUserPresident ? (
            <div className="space-y-4 text-center max-w-md mx-auto">
              <p className="text-xs md:text-sm text-[#d6cfc2]">
                {isOfflineMode && (
                  <strong className="text-[#d4a359] block mb-1">
                    Pass Device to President {currentPresident?.name}
                  </strong>
                )}
                Chancellor <strong>{currentChancellor?.name}</strong> wishes to discard both remaining Policy tiles. If you consent, the Election Tracker advances by 1:
              </p>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => onPresidentVetoResponse(true)}
                  className="px-4 py-3 rounded bg-[#d4a359] hover:bg-[#e0b46e] text-[#12100e] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Agree to Veto
                </button>
                <button
                  onClick={() => onPresidentVetoResponse(false)}
                  className="px-4 py-3 rounded bg-[#8f1d18] hover:bg-[#a8241e] text-[#f4efe6] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Refuse Veto
                </button>
              </div>
            </div>
          ) : (
            <div className="py-5 text-center text-sm text-[#d6cfc2]">
              Chancellor <strong>{currentChancellor?.name}</strong> proposed a Veto. Waiting for President <strong>{currentPresident?.name}</strong>&apos;s decision...
            </div>
          )}
        </div>
      )}

      {/* 6. EXECUTIVE ACTION */}
      {phase === 'EXECUTIVE_ACTION' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2e2621] pb-3">
            <div>
              <span className="text-xs uppercase tracking-widest font-mono-numbers text-[#e86f5c]">
                Step 4 · Presidential Power
              </span>
              <h3 className="text-xl font-woodcut tracking-wider text-[#f4efe6]">
                Executive Action: {executiveAction.replace(/_/g, ' ')}
              </h3>
            </div>
            <span className="text-xs font-mono-numbers text-[#d6cfc2]">
              Sitting President: <strong className="text-[#d4a359]">{currentPresident?.name}</strong>
            </span>
          </div>

          {isOfflineMode &&
          !privacyUnlocked &&
          (executiveAction === 'PEEK' || executiveAction === 'INVESTIGATE') ? (
            <div className="p-6 rounded bg-[#14110e] border-2 border-[#d4a359]/60 text-center space-y-3">
              <Lock className="w-8 h-8 text-[#d4a359] mx-auto" />
              <div className="text-xs font-mono-numbers uppercase tracking-widest text-[#d4a359]">
                Classified Presidential Intelligence
              </div>
              <h4 className="text-2xl font-woodcut tracking-wider text-[#f4efe6]">
                Pass Device to President {currentPresident?.name}
              </h4>
              <p className="text-xs text-[#d6cfc2] max-w-md mx-auto">
                Make sure only President <strong>{currentPresident?.name}</strong> can see the screen before unlocking this confidential Presidential Power.
              </p>
              <button
                onClick={onUnlockPrivacy}
                className="px-6 py-3 rounded bg-[#d4a359] hover:bg-[#e0b46e] text-[#12100e] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                I am President {currentPresident?.name} · Unlock Presidential Power
              </button>
            </div>
          ) : isUserPresident ? (
            <div>
              {executiveAction === 'PEEK' && (
                <div className="space-y-4">
                  <p className="text-xs md:text-sm text-[#d6cfc2]">
                    <strong>Policy Peek:</strong> Secretly inspect the top 3 Policy tiles on the Draw Deck. They remain in this exact order:
                  </p>

                  {peekCards ? (
                    <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                      {peekCards.map((c, i) => (
                        <div key={`peek-${i}`} className="aspect-[3/4]">
                          <PolicyTileGraphic policy={c} subtitle={`Top #${i + 1}`} size="sm" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-xs text-[#a89f91]">Revealing top 3 tiles...</div>
                  )}

                  <div className="text-center pt-2">
                    <button
                      onClick={onAcknowledgePeek}
                      className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-[#12100e] bg-[#d4a359] hover:bg-[#e0b46e] rounded transition-colors cursor-pointer"
                    >
                      Hide Tiles & Proceed to Next Round
                    </button>
                  </div>
                </div>
              )}

              {executiveAction === 'INVESTIGATE' && (
                <div className="space-y-4">
                  {investigationResult ? (
                    <div className="space-y-4 text-center max-w-md mx-auto">
                      <div className="p-5 rounded bg-[#120f0d] border-2 border-[#d4a359] space-y-2">
                        <span className="text-[10px] uppercase font-mono-numbers tracking-widest text-[#a89f91] block">
                          Party Membership Card
                        </span>
                        <div className="text-lg font-bold text-[#f4efe6]">
                          {investigationResult.targetName}
                        </div>
                        <div className="flex justify-center py-2">
                          {investigationResult.party === 'LIBERAL' ? (
                            <LiberalDoveSVG className="w-12 h-12 text-[#76c4de]" />
                          ) : (
                            <FascistSkullSVG className="w-12 h-12 text-[#e86f5c]" />
                          )}
                        </div>
                        <div
                          className={`text-xl font-woodcut uppercase tracking-wider ${
                            investigationResult.party === 'LIBERAL' ? 'text-[#76c4de]' : 'text-[#e86f5c]'
                          }`}
                        >
                          {investigationResult.party} PARTY
                        </div>
                        <p className="text-[11px] text-[#a89f91]">
                          Hitler&apos;s Party Membership card also shows Fascist. You are free to share or lie about this result.
                        </p>
                      </div>

                      <button
                        onClick={onAcknowledgeInvestigation}
                        className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-[#12100e] bg-[#d4a359] hover:bg-[#e0b46e] rounded transition-colors cursor-pointer"
                      >
                        Close Dossier & Continue
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs md:text-sm text-[#d6cfc2]">
                        Choose one player to secretly inspect their Party Membership card (a player may only be investigated once per game):
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {players.map((p, idx) => {
                          if (idx === presidentIndex || !p.isAlive) return null;
                          const canInvestigate = !p.investigatedByPresident;
                          return (
                            <button
                              key={p.id}
                              onClick={() => onInvestigate(idx)}
                              disabled={!canInvestigate}
                              className={`p-3 rounded border text-left text-xs transition-all ${
                                canInvestigate
                                  ? 'bg-[#241e1a] hover:border-[#d4a359] border-[#453930] text-[#f4efe6] cursor-pointer'
                                  : 'bg-[#120f0d] border-[#26201c] text-[#6e655c] cursor-not-allowed opacity-50'
                              }`}
                            >
                              <div className="font-bold text-sm truncate">{p.name}</div>
                              <div className="text-[10px] text-[#d4a359] font-mono-numbers uppercase mt-1">
                                {p.investigatedByPresident ? 'Already Checked' : 'Inspect Loyalty →'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {executiveAction === 'SPECIAL_ELECTION' && (
                <div className="space-y-3">
                  <p className="text-xs md:text-sm text-[#d6cfc2]">
                    <strong>Call Special Election:</strong> President <strong>{currentPresident?.name}</strong>, choose any other active player to be the next Presidential Candidate:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {players.map((p, idx) => {
                      if (idx === presidentIndex || !p.isAlive) return null;
                      return (
                        <button
                          key={p.id}
                          onClick={() => onSpecialElection(idx)}
                          className="p-3.5 rounded border bg-[#241e1a] hover:border-[#d4a359] border-[#453930] text-left text-xs transition-all cursor-pointer"
                        >
                          <div className="font-bold text-sm text-[#f4efe6] truncate">{p.name}</div>
                          <div className="text-[10px] text-[#d4a359] font-mono-numbers uppercase mt-1">
                            Appoint President →
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {executiveAction === 'EXECUTE' && (
                <div className="space-y-3">
                  <p className="text-xs md:text-sm text-[#d6cfc2]">
                    <strong>Formal Execution:</strong> President <strong>{currentPresident?.name}</strong>, choose one player to execute. If you execute Secret Hitler, the Liberals win immediately!
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {players.map((p, idx) => {
                      if (idx === presidentIndex || !p.isAlive) return null;
                      return (
                        <button
                          key={p.id}
                          onClick={() => onExecute(idx)}
                          className="p-3.5 rounded border bg-[#211311] hover:bg-[#381815] hover:border-[#e86f5c] border-[#59221d] text-left text-xs transition-all cursor-pointer"
                        >
                          <div className="font-bold text-sm text-[#f4efe6] truncate">{p.name}</div>
                          <div className="text-[10px] text-[#e86f5c] font-mono-numbers uppercase mt-1 flex items-center gap-1">
                            <Crosshair className="w-3 h-3" /> Execute Player
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-5 text-center space-y-1.5">
              <div className="text-base text-[#f4efe6]">
                President <strong className="text-[#d4a359]">{currentPresident?.name}</strong> is using Presidential Power: <strong>{executiveAction.replace(/_/g, ' ')}</strong>...
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
