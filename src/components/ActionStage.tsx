import React from 'react';
import { Crosshair, CheckCircle, Eye, Lock, Vote, Check, X } from 'lucide-react';
import {
  ExecutiveAction,
  LastVoteDetails,
  Phase,
  Policy,
  PublicPlayer,
  Vote as VoteType,
} from '../game/types.js';
import { PolicyTileGraphic, LiberalDoveSVG, FascistSkullSVG } from './Artwork.js';

export interface CurrentTabProps {
  phase: Phase;
  players: PublicPlayer[];
  currentUserId: string | null;
  isSpectator: boolean;
  presidentIndex: number;
  chancellorIndex: number | null;
  electionTracker: number;
  eligibleChancellors: number[];
  userVote: VoteType | null;
  voteProgress: { votesIn: number; votesNeeded: number } | null;
  lastVoteDetails: LastVoteDetails | null;
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

export const CurrentTab: React.FC<CurrentTabProps> = ({
  phase,
  players,
  currentUserId,
  isSpectator,
  presidentIndex,
  chancellorIndex,
  electionTracker,
  eligibleChancellors,
  userVote,
  voteProgress,
  lastVoteDetails,
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

  // Compute top centered person address & minimalist action subtitle for currentTab
  const getCurrentTabHeader = (): {
    personLabel: string;
    personColorClass: string;
    subtitle: string;
  } => {
    switch (phase) {
      case 'NIGHT':
        return {
          personLabel: isOfflineMode && activeActorName ? activeActorName : 'All Players',
          personColorClass: 'text-[#f5b942]',
          subtitle: 'Inspect your secret role envelope',
        };
      case 'NOMINATION':
        return {
          personLabel: `President ${currentPresident?.name || ''}`,
          personColorClass: 'text-[#f5b942]',
          subtitle: 'Select a Chancellor candidate',
        };
      case 'VOTING':
        return {
          personLabel:
            isOfflineMode && activeActorName
              ? `${activeActorName} (${votedCount + 1}/${neededCount})`
              : `Table Vote (${votedCount}/${neededCount})`,
          personColorClass: 'text-[#f5b942]',
          subtitle: `Vote on President ${currentPresident?.name} & Chancellor ${currentChancellor?.name}`,
        };
      case 'LEGISLATIVE_PRESIDENT':
        return {
          personLabel: `President ${currentPresident?.name || ''}`,
          personColorClass: 'text-[#f5b942]',
          subtitle: 'Discard 1 policy tile in secret',
        };
      case 'LEGISLATIVE_CHANCELLOR':
        return {
          personLabel: `Chancellor ${currentChancellor?.name || ''}`,
          personColorClass: 'text-[#5cc8e8]',
          subtitle: 'Enact 1 policy tile onto the board',
        };
      case 'VETO_PENDING':
        return {
          personLabel: `President ${currentPresident?.name || ''}`,
          personColorClass: 'text-[#f06455]',
          subtitle: `Accept or refuse Chancellor ${currentChancellor?.name}'s Veto`,
        };
      case 'EXECUTIVE_ACTION': {
        if (executiveAction === 'PEEK') {
          return {
            personLabel: `President ${currentPresident?.name || ''}`,
            personColorClass: 'text-[#f06455]',
            subtitle: 'Inspect the top 3 policy tiles',
          };
        }
        if (executiveAction === 'INVESTIGATE') {
          return {
            personLabel: `President ${currentPresident?.name || ''}`,
            personColorClass: 'text-[#f06455]',
            subtitle: 'Select a player to check party membership',
          };
        }
        if (executiveAction === 'SPECIAL_ELECTION') {
          return {
            personLabel: `President ${currentPresident?.name || ''}`,
            personColorClass: 'text-[#f06455]',
            subtitle: 'Select any player as the next President',
          };
        }
        return {
          personLabel: `President ${currentPresident?.name || ''}`,
          personColorClass: 'text-[#f06455]',
          subtitle: 'Select a player to formally execute',
        };
      }
      default:
        return {
          personLabel: currentPresident?.name || '',
          personColorClass: 'text-[#f5b942]',
          subtitle: '',
        };
    }
  };

  const currentTabHeader = getCurrentTabHeader();

  // Render past government history ticks (green tick for Liberal, red cross for Fascist)
  const renderHistoryMarks = (history: Policy[] = []) => {
    if (!history || history.length === 0) return null;
    return (
      <div className="flex items-center flex-wrap gap-1 shrink-0">
        {history.map((pol, i) =>
          pol === 'LIBERAL' ? (
            <span
              key={`hist-${i}`}
              title="Enacted Liberal Policy in past Government"
              className="w-4 h-4 rounded-full bg-emerald-950 border border-emerald-400 text-emerald-400 inline-flex items-center justify-center shadow-sm"
            >
              <Check className="w-2.5 h-2.5 stroke-[3.5]" />
            </span>
          ) : (
            <span
              key={`hist-${i}`}
              title="Enacted Fascist Policy in past Government"
              className="w-4 h-4 rounded-full bg-red-950 border border-red-400 text-red-400 inline-flex items-center justify-center shadow-sm"
            >
              <X className="w-2.5 h-2.5 stroke-[3.5]" />
            </span>
          )
        )}
      </div>
    );
  };

  return (
    <div id="current-tab" className="w-full space-y-3">
      {/* POST-VOTING BALLOT ROLL CALL BREAKDOWN (Only shown for individual ballots, omitted on Table Approved/Rejected) */}
      {lastVoteDetails && phase !== 'VOTING' && phase !== 'NIGHT' && (
        <div className="w-full bg-[#15120f] border border-[#3d332c] rounded-lg px-4 py-3 tactile-card-shadow animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2.5 border-b border-[#2e2621]">
            <div className="flex items-center gap-2">
              <Vote className="w-3.5 h-3.5 text-[#d4a359]" />
              <span className="text-xs font-woodcut tracking-wider uppercase text-[#f4efe6]">
                Last Vote ({lastVoteDetails.presidentName} &amp; {lastVoteDetails.chancellorName})
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono-numbers">
              <span className="text-emerald-400 font-bold">{lastVoteDetails.jaCount} JA!</span>
              <span className="text-[#6e655c]">/</span>
              <span className="text-red-400 font-bold">{lastVoteDetails.neinCount} NEIN!</span>
              <span
                className={`ml-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                  lastVoteDetails.passed
                    ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500'
                    : 'bg-red-950/90 text-red-300 border-red-500'
                }`}
              >
                {lastVoteDetails.passed ? 'PASSED' : 'REJECTED'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {lastVoteDetails.ballots.map((entry) => {
              const isJa = entry.vote === 'JA';
              return (
                <div
                  key={`ballot-${entry.playerId}`}
                  className={`px-2.5 py-1.5 rounded border flex items-center justify-between gap-1.5 ${
                    isJa
                      ? 'bg-emerald-950/85 border-emerald-500 text-emerald-200'
                      : 'bg-red-950/85 border-red-500 text-red-200'
                  }`}
                >
                  <span className="font-bold text-xs truncate text-[#f4efe6]">
                    {entry.playerName}
                  </span>
                  <span
                    className={`font-woodcut tracking-wider text-xs uppercase shrink-0 ${
                      isJa ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {isJa ? 'JA!' : 'NEIN!'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CURRENT TAB — PRIMARY FOCAL CENTERPIECE */}
      <div className="w-full rounded-xl bg-gradient-to-b from-[#231c16] via-[#1a1511] to-[#14100d] border-2 border-[#d4a359]/80 shadow-[0_14px_40px_rgba(0,0,0,0.85),0_0_28px_rgba(212,163,89,0.14)] overflow-hidden">
        {/* Top Centered Person Address & Action Subtitle */}
        <div className="px-4 pt-5 pb-3.5 text-center border-b border-[#362c24] bg-[#1c1612]/90">
          {isSpectator && !isOfflineMode && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#2b221b] border border-[#d4a359]/40 text-[10px] font-mono-numbers uppercase tracking-widest text-[#d4a359] mb-2">
              <Eye className="w-3 h-3" /> Spectating
            </div>
          )}
          <div
            className={`text-xl md:text-2xl font-woodcut tracking-widest uppercase ${currentTabHeader.personColorClass}`}
          >
            {currentTabHeader.personLabel}
          </div>
          <p className="text-xs md:text-sm text-[#e6dfd3] font-medium mt-1 tracking-wide">
            {currentTabHeader.subtitle}
          </p>
        </div>

        {/* Minimalist Action Body */}
        <div className="p-5 md:p-6">
          {/* 0. NIGHT PHASE */}
          {phase === 'NIGHT' && (
            <div className="text-center py-2">
              {isOfflineMode && onOpenNightEnvelope ? (
                <button
                  onClick={onOpenNightEnvelope}
                  className="px-7 py-3 text-xs font-bold uppercase tracking-widest text-[#12100e] bg-[#d4a359] hover:bg-[#e5b869] rounded-md shadow-lg transition-all cursor-pointer"
                >
                  Open {activeActorName}&apos;s Envelope
                </button>
              ) : (
                !isSpectator && (
                  <button
                    onClick={onCompleteNight}
                    className="px-7 py-3 text-xs font-bold uppercase tracking-widest text-[#12100e] bg-[#d4a359] hover:bg-[#e5b869] rounded-md shadow-lg transition-all cursor-pointer"
                  >
                    Start Election
                  </button>
                )
              )}
            </div>
          )}

          {/* 1. NOMINATION PHASE (Select Chancellor) */}
          {phase === 'NOMINATION' && (
            <div>
              {isUserPresident ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {players.map((p, idx) => {
                    if (idx === presidentIndex || !p.isAlive) return null;
                    const isEligible = eligibleChancellors.includes(idx);

                    return (
                      <button
                        key={p.id}
                        onClick={() => onNominate(idx)}
                        disabled={!isEligible}
                        className={`group relative px-4 py-3.5 rounded-lg border-2 text-left transition-all flex items-center justify-between gap-2 ${
                          isEligible
                            ? 'bg-[#261f19] hover:bg-[#332920] border-[#4f4034] hover:border-[#f5b942] text-[#f4efe6] cursor-pointer shadow-md hover:-translate-y-0.5'
                            : 'bg-[#14110e] border-[#26201c] text-[#6e655c] cursor-not-allowed opacity-45'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-sm md:text-base truncate group-hover:text-[#f5b942] transition-colors">
                            {p.name}
                          </div>
                          {!isEligible && (
                            <div className="text-[10px] font-mono-numbers uppercase text-[#8c7f73]">
                              Term-Limited
                            </div>
                          )}
                        </div>

                        {/* Green Right Tick (Liberal) & Red Cross (Fascist) for past Governments */}
                        {renderHistoryMarks(p.governmentHistory)}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="py-4 text-center text-sm text-[#a89f91]">
                  Waiting for <strong className="text-[#f5b942]">{currentPresident?.name}</strong>...
                </div>
              )}
            </div>
          )}

          {/* 2. VOTING PHASE */}
          {phase === 'VOTING' && (
            <div className="space-y-4">
              {isOfflineMode ? (
                <div className="space-y-4">
                  {!privacyUnlocked ? (
                    <div className="text-center py-2">
                      <button
                        onClick={onUnlockPrivacy}
                        className="px-7 py-3.5 rounded-lg bg-[#f5b942] hover:bg-[#ffca5c] text-[#12100e] text-xs md:text-sm font-bold uppercase tracking-wider shadow-lg transition-all cursor-pointer"
                      >
                        Unlock {activeActorName}&apos;s Ballot
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                      <button
                        onClick={() => onVote('JA')}
                        className="py-5 px-4 rounded-lg bg-emerald-950/90 hover:bg-emerald-900 text-emerald-200 border-2 border-emerald-500 shadow-lg transition-transform hover:-translate-y-0.5 flex flex-col items-center justify-center cursor-pointer"
                      >
                        <span className="text-3xl font-woodcut tracking-wider text-emerald-300">
                          JA!
                        </span>
                      </button>

                      <button
                        onClick={() => onVote('NEIN')}
                        className="py-5 px-4 rounded-lg bg-red-950/90 hover:bg-red-900 text-red-200 border-2 border-red-500 shadow-lg transition-transform hover:-translate-y-0.5 flex flex-col items-center justify-center cursor-pointer"
                      >
                        <span className="text-3xl font-woodcut tracking-wider text-red-300">
                          NEIN!
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Quick Table Vote */}
                  {onQuickTableVote && (
                    <div className="pt-3 border-t border-[#2e2621] flex items-center justify-center gap-3">
                      <button
                        onClick={() => onQuickTableVote(true)}
                        className="px-3.5 py-1.5 rounded bg-emerald-950/75 hover:bg-emerald-900 border border-emerald-500/70 text-emerald-200 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Table Approved (JA!)
                      </button>
                      <button
                        onClick={() => onQuickTableVote(false)}
                        className="px-3.5 py-1.5 rounded bg-red-950/75 hover:bg-red-900 border border-red-500/70 text-red-200 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Table Rejected (NEIN!)
                      </button>
                    </div>
                  )}
                </div>
              ) : isSpectator ? (
                <div className="py-3 text-center text-xs text-[#a89f91]">
                  Waiting for votes...
                </div>
              ) : isUserAlive ? (
                userVote || currentUser?.hasVoted ? (
                  <div className="py-3 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#211c18] border border-[#3d332c] text-xs font-mono-numbers text-emerald-400">
                      <CheckCircle className="w-4 h-4" />
                      <span>Ballot Locked ({userVote || 'SEALED'})</span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                    <button
                      onClick={() => onVote('JA')}
                      className="py-5 px-4 rounded-lg bg-emerald-950/90 hover:bg-emerald-900 text-emerald-200 border-2 border-emerald-500 shadow-lg transition-transform hover:-translate-y-0.5 flex flex-col items-center justify-center cursor-pointer"
                    >
                      <span className="text-3xl font-woodcut tracking-wider text-emerald-300">
                        JA!
                      </span>
                    </button>

                    <button
                      onClick={() => onVote('NEIN')}
                      className="py-5 px-4 rounded-lg bg-red-950/90 hover:bg-red-900 text-red-200 border-2 border-red-500 shadow-lg transition-transform hover:-translate-y-0.5 flex flex-col items-center justify-center cursor-pointer"
                    >
                      <span className="text-3xl font-woodcut tracking-wider text-red-300">
                        NEIN!
                      </span>
                    </button>
                  </div>
                )
              ) : (
                <div className="py-3 text-center text-xs text-[#a89f91]">
                  Executed players cannot vote.
                </div>
              )}
            </div>
          )}

          {/* 3. LEGISLATIVE - PRESIDENT */}
          {phase === 'LEGISLATIVE_PRESIDENT' && (
            <div>
              {isOfflineMode && !privacyUnlocked ? (
                <div className="text-center py-2">
                  <button
                    onClick={onUnlockPrivacy}
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg bg-[#f5b942] hover:bg-[#ffca5c] text-[#12100e] text-xs md:text-sm font-bold uppercase tracking-wider shadow-lg transition-all cursor-pointer"
                  >
                    <Lock className="w-4 h-4" /> Reveal 3 Policy Tiles
                  </button>
                </div>
              ) : isUserPresident && presidentCards ? (
                <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                  {presidentCards.map((policy, idx) => (
                    <button
                      key={`pres-card-${idx}`}
                      onClick={() => onPresidentDiscard(idx)}
                      aria-label={`Discard ${policy} policy tile ${idx + 1}`}
                      className="aspect-[3/4] rounded-md transition-transform hover:-translate-y-1 cursor-pointer focus:outline-none"
                    >
                      <PolicyTileGraphic policy={policy} subtitle="Discard" size="md" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-4 text-center text-sm text-[#a89f91]">
                  Waiting for <strong className="text-[#f5b942]">{currentPresident?.name}</strong>...
                </div>
              )}
            </div>
          )}

          {/* 4. LEGISLATIVE - CHANCELLOR */}
          {phase === 'LEGISLATIVE_CHANCELLOR' && (
            <div className="space-y-4">
              {isOfflineMode && !privacyUnlocked ? (
                <div className="text-center py-2">
                  <button
                    onClick={onUnlockPrivacy}
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg bg-[#5cc8e8] hover:bg-[#7dd7f0] text-[#12100e] text-xs md:text-sm font-bold uppercase tracking-wider shadow-lg transition-all cursor-pointer"
                  >
                    <Lock className="w-4 h-4" /> Reveal 2 Policy Tiles
                  </button>
                </div>
              ) : isUserChancellor && chancellorCards ? (
                <div className="space-y-4">
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
                          <PolicyTileGraphic policy={policy} subtitle="Enact" size="md" />
                        </button>
                      );
                    })}
                  </div>

                  {canVeto && (
                    <div className="text-center pt-2">
                      <button
                        onClick={onChancellorVeto}
                        className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-[#f4efe6] bg-[#8f1d18] hover:bg-[#a8241e] border border-[#e86f5c] rounded transition-colors cursor-pointer"
                      >
                        Propose Veto
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-4 text-center text-sm text-[#a89f91]">
                  Waiting for <strong className="text-[#5cc8e8]">{currentChancellor?.name}</strong>...
                </div>
              )}
            </div>
          )}

          {/* 5. VETO PENDING */}
          {phase === 'VETO_PENDING' && (
            <div>
              {isUserPresident ? (
                <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                  <button
                    onClick={() => onPresidentVetoResponse(true)}
                    className="px-4 py-3 rounded-lg bg-[#f5b942] hover:bg-[#ffca5c] text-[#12100e] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Accept Veto
                  </button>
                  <button
                    onClick={() => onPresidentVetoResponse(false)}
                    className="px-4 py-3 rounded-lg bg-[#8f1d18] hover:bg-[#a8241e] text-[#f4efe6] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Refuse Veto
                  </button>
                </div>
              ) : (
                <div className="py-4 text-center text-sm text-[#a89f91]">
                  Waiting for <strong className="text-[#f5b942]">{currentPresident?.name}</strong>...
                </div>
              )}
            </div>
          )}

          {/* 6. EXECUTIVE ACTION */}
          {phase === 'EXECUTIVE_ACTION' && (
            <div>
              {isOfflineMode &&
              !privacyUnlocked &&
              (executiveAction === 'PEEK' || executiveAction === 'INVESTIGATE') ? (
                <div className="text-center py-2">
                  <button
                    onClick={onUnlockPrivacy}
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg bg-[#f06455] hover:bg-[#f7796b] text-[#12100e] text-xs md:text-sm font-bold uppercase tracking-wider shadow-lg transition-all cursor-pointer"
                  >
                    <Lock className="w-4 h-4" /> Unlock Presidential Power
                  </button>
                </div>
              ) : isUserPresident ? (
                <div>
                  {executiveAction === 'PEEK' && (
                    <div className="space-y-4">
                      {peekCards ? (
                        <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                          {peekCards.map((c, i) => (
                            <div key={`peek-${i}`} className="aspect-[3/4]">
                              <PolicyTileGraphic policy={c} subtitle={`#${i + 1}`} size="sm" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-xs text-[#a89f91]">Revealing...</div>
                      )}

                      <div className="text-center">
                        <button
                          onClick={onAcknowledgePeek}
                          className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-[#12100e] bg-[#f5b942] hover:bg-[#ffca5c] rounded transition-colors cursor-pointer"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}

                  {executiveAction === 'INVESTIGATE' && (
                    <div>
                      {investigationResult ? (
                        <div className="space-y-4 text-center max-w-sm mx-auto">
                          <div className="p-4 rounded-lg bg-[#120f0d] border-2 border-[#d4a359] space-y-2">
                            <div className="text-base font-bold text-[#f4efe6]">
                              {investigationResult.targetName}
                            </div>
                            <div className="flex justify-center py-1">
                              {investigationResult.party === 'LIBERAL' ? (
                                <LiberalDoveSVG className="w-11 h-11 text-[#76c4de]" />
                              ) : (
                                <FascistSkullSVG className="w-11 h-11 text-[#e86f5c]" />
                              )}
                            </div>
                            <div
                              className={`text-lg font-woodcut uppercase tracking-wider ${
                                investigationResult.party === 'LIBERAL'
                                  ? 'text-[#76c4de]'
                                  : 'text-[#e86f5c]'
                              }`}
                            >
                              {investigationResult.party} PARTY
                            </div>
                          </div>

                          <button
                            onClick={onAcknowledgeInvestigation}
                            className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-[#12100e] bg-[#f5b942] hover:bg-[#ffca5c] rounded transition-colors cursor-pointer"
                          >
                            Close Dossier
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {players.map((p, idx) => {
                            if (idx === presidentIndex || !p.isAlive) return null;
                            const canInvestigate = !p.investigatedByPresident;
                            return (
                              <button
                                key={p.id}
                                onClick={() => onInvestigate(idx)}
                                disabled={!canInvestigate}
                                className={`px-4 py-3.5 rounded-lg border-2 text-left transition-all flex items-center justify-between gap-2 ${
                                  canInvestigate
                                    ? 'bg-[#261f19] hover:border-[#f5b942] border-[#4f4034] text-[#f4efe6] cursor-pointer'
                                    : 'bg-[#120f0d] border-[#26201c] text-[#6e655c] cursor-not-allowed opacity-45'
                                }`}
                              >
                                <span className="font-bold text-sm truncate">{p.name}</span>
                                {renderHistoryMarks(p.governmentHistory)}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {executiveAction === 'SPECIAL_ELECTION' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {players.map((p, idx) => {
                        if (idx === presidentIndex || !p.isAlive) return null;
                        return (
                          <button
                            key={p.id}
                            onClick={() => onSpecialElection(idx)}
                            className="px-4 py-3.5 rounded-lg border-2 bg-[#261f19] hover:border-[#f5b942] border-[#4f4034] text-left transition-all flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <span className="font-bold text-sm text-[#f4efe6] truncate">
                              {p.name}
                            </span>
                            {renderHistoryMarks(p.governmentHistory)}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {executiveAction === 'EXECUTE' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {players.map((p, idx) => {
                        if (idx === presidentIndex || !p.isAlive) return null;
                        return (
                          <button
                            key={p.id}
                            onClick={() => onExecute(idx)}
                            className="px-4 py-3.5 rounded-lg border-2 bg-[#261412] hover:bg-[#381815] hover:border-[#f06455] border-[#59221d] text-left transition-all flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Crosshair className="w-3.5 h-3.5 text-[#f06455] shrink-0" />
                              <span className="font-bold text-sm text-[#f4efe6] truncate">
                                {p.name}
                              </span>
                            </div>
                            {renderHistoryMarks(p.governmentHistory)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-4 text-center text-sm text-[#a89f91]">
                  Waiting for <strong className="text-[#f06455]">{currentPresident?.name}</strong>...
                </div>
              )}
            </div>
          )}
        </div>

        {/* ELECTION TRACKER — DIRECTLY BELOW THE NOMINATE CHANCELLOR / CURRENT TAB CONTROLS */}
        <div className="px-5 py-3 bg-[#14100d] border-t border-[#362c24] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-woodcut tracking-wider uppercase text-[#d4a359]">
              Election Tracker
            </span>
            <span className="text-[11px] text-[#8c7f73] hidden sm:inline">
              · 3 Fails = Chaos Policy
            </span>
          </div>

          <div className="flex items-center gap-2">
            {[0, 1, 2, 3].map((step) => {
              const isActive = electionTracker === step;
              const isChaos = step === 3;

              return (
                <div
                  key={`tracker-${step}`}
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-mono-numbers text-xs font-bold transition-all border ${
                    isActive
                      ? isChaos
                        ? 'bg-[#c83228] text-[#f4efe6] border-[#ffd2c9] scale-110 shadow'
                        : 'bg-[#f5b942] text-[#12100e] border-[#f4efe6] scale-110 shadow'
                      : isChaos
                      ? 'bg-[#1f1311] text-[#e86f5c] border-[#59221d]'
                      : 'bg-[#120f0d] text-[#8c7f73] border-[#332a24]'
                  }`}
                >
                  {isChaos ? '3!' : step}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ActionStage = CurrentTab;
