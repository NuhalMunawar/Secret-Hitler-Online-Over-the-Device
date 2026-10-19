import React, { useState } from 'react';
import { useGameSocket } from './hooks/useGameSocket.js';
import { useOfflineGame } from './hooks/useOfflineGame.js';
import { Header } from './components/Header.js';
import { LobbyView } from './components/LobbyView.js';
import { PolicyTracks } from './components/PolicyTracks.js';
import { PlayerRoster } from './components/PlayerRoster.js';
import { ActionStage } from './components/ActionStage.js';
import { NightModal } from './components/NightModal.js';
import { GameOverModal } from './components/GameOverModal.js';
import { RulesModal } from './components/RulesModal.js';
import { DiagnosticsModal } from './components/DiagnosticsModal.js';
import { GameLog } from './components/GameLog.js';
import { AlertCircle, CheckCircle, Info, Eye, Smartphone } from 'lucide-react';

export default function App() {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [localVote, setLocalVote] = useState<'JA' | 'NEIN' | null>(null);

  const online = useGameSocket();
  const offline = useOfflineGame(online.showNotification);

  const isOffline = offline.isOfflineMode;
  const activeGameState = isOffline ? offline.gameState : online.gameState;
  const activeIsSpectator = isOffline ? false : online.isSpectator;
  const activePlayerId = isOffline ? offline.activeActorId : online.playerId;

  React.useEffect(() => {
    if (activeGameState && activeGameState.phase !== 'VOTING') {
      setLocalVote(null);
    }
  }, [activeGameState?.phase]);

  const handleCastVote = (vote: 'JA' | 'NEIN') => {
    if (isOffline) {
      offline.castOfflineVote(vote);
    } else {
      setLocalVote(vote);
      online.castVote(vote);
    }
  };

  const isNightPhase = activeGameState?.phase === 'NIGHT';
  const hasGameActive = Boolean(activeGameState && activeGameState.phase !== 'LOBBY');

  // Compute Night Modal props for Online vs Offline Pass & Play
  const humanPlayersInOffline = isOffline && activeGameState
    ? activeGameState.players.filter((p) => !p.isBot)
    : [];
  const currentOfflineNightPlayer =
    isOffline && activeGameState ? activeGameState.players[offline.nightPlayerIndex] : null;
  const offlineNightStepIndex =
    currentOfflineNightPlayer && humanPlayersInOffline.length > 0
      ? humanPlayersInOffline.findIndex((p) => p.id === currentOfflineNightPlayer.id) + 1
      : 1;

  const activeNightInfo = isOffline
    ? currentOfflineNightPlayer
      ? offline.getNightInfoForPlayerId(currentOfflineNightPlayer.id)
      : null
    : online.nightInfo;

  const activeNightPlayerName = isOffline
    ? currentOfflineNightPlayer?.name || ''
    : online.playerName;

  const activeGameOverData = isOffline ? offline.gameOverData : online.gameOverData;

  return (
    <div className="min-h-screen bg-[#12100e] text-[#f4efe6] flex flex-col font-sans selection:bg-[#d4a359] selection:text-[#12100e]">
      {/* Header */}
      <Header
        roomCode={online.roomCode}
        isOfflineMode={isOffline}
        isSpectator={activeIsSpectator}
        onOpenRules={() => setRulesOpen(true)}
        onOpenDossier={() => setIdentityOpen(true)}
        onOpenDiagnostics={() => setDiagnosticsOpen(true)}
        onLeaveRoom={isOffline ? offline.exitOfflineMode : online.leaveRoom}
        hasRole={Boolean(online.nightInfo || isOffline)}
      />

      {/* Toast Notification */}
      {online.notification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50">
          <div
            className={`px-4 py-2 rounded shadow-xl border text-xs font-semibold flex items-center gap-2 ${
              online.notification.type === 'alert'
                ? 'bg-[#3b1412] border-[#c83228] text-[#ffd2c9]'
                : online.notification.type === 'success'
                ? 'bg-[#112e22] border-emerald-500 text-emerald-100'
                : 'bg-[#1f1a16] border-[#4a3e35] text-[#f4efe6]'
            }`}
          >
            {online.notification.type === 'alert' ? (
              <AlertCircle className="w-4 h-4 text-[#e86f5c]" />
            ) : online.notification.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            ) : (
              <Info className="w-4 h-4 text-[#d4a359]" />
            )}
            <span>{online.notification.message}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-6">
        {!hasGameActive ? (
          <LobbyView
            roomCode={online.roomCode}
            playerName={online.playerName}
            isHost={online.isHost}
            isSpectator={online.isSpectator}
            players={online.players}
            spectators={online.spectators}
            onCreateRoom={online.createRoom}
            onJoinRoom={online.joinRoom}
            onAddBot={online.addBot}
            onRemoveBot={online.removeBot}
            onStartGame={online.startGame}
            onStartOfflineGame={offline.startOfflineGame}
            onOpenRules={() => setRulesOpen(true)}
            onOpenDiagnostics={() => setDiagnosticsOpen(true)}
          />
        ) : (
          <div className="space-y-6 animate-fade-in">
            {/* Round & Phase Status Strip */}
            <div className="bg-[#181411] border border-[#2e2621] rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-mono-numbers uppercase text-[#d4a359] font-bold tracking-wider">
                  Round {activeGameState!.roundNumber}
                </span>
                <span className="text-[#453930]">|</span>
                <span className="font-woodcut text-sm uppercase tracking-wider text-[#f4efe6]">
                  {activeGameState!.phase.replace(/_/g, ' ')}
                </span>
                {isOffline && (
                  <>
                    <span className="text-[#453930]">|</span>
                    <span className="text-[#d4a359] flex items-center gap-1 font-mono-numbers uppercase">
                      <Smartphone className="w-3.5 h-3.5" /> Pass & Play
                    </span>
                  </>
                )}
                {activeIsSpectator && (
                  <>
                    <span className="text-[#453930]">|</span>
                    <span className="text-[#d4a359] flex items-center gap-1 font-mono-numbers uppercase">
                      <Eye className="w-3.5 h-3.5" /> Spectating Only
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-[#d6cfc2] font-mono-numbers">
                <span>
                  President:{' '}
                  <strong className="text-[#d4a359]">
                    {activeGameState!.players[activeGameState!.presidentIndex]?.name}
                  </strong>
                </span>
                {activeGameState!.chancellorIndex !== null && (
                  <span>
                    Chancellor:{' '}
                    <strong className="text-[#76c4de]">
                      {activeGameState!.players[activeGameState!.chancellorIndex]?.name}
                    </strong>
                  </span>
                )}
              </div>
            </div>

            {/* Interactive Action Stage */}
            <ActionStage
              phase={activeGameState!.phase}
              players={activeGameState!.players}
              currentUserId={activePlayerId}
              isSpectator={activeIsSpectator}
              presidentIndex={activeGameState!.presidentIndex}
              chancellorIndex={activeGameState!.chancellorIndex}
              eligibleChancellors={activeGameState!.eligibleChancellors}
              userVote={localVote}
              voteProgress={isOffline ? null : online.voteProgress}
              presidentCards={isOffline ? offline.presidentCards : online.presidentCards}
              chancellorCards={isOffline ? offline.chancellorCards : online.chancellorCards}
              canVeto={isOffline ? offline.canVeto : online.canVeto}
              peekCards={isOffline ? offline.peekCards : online.peekCards}
              investigationResult={
                isOffline ? offline.investigationResult : online.investigationResult
              }
              executiveAction={activeGameState!.executiveAction}
              onCompleteNight={isOffline ? offline.advanceOfflineNightPlayer : online.completeNight}
              onNominate={isOffline ? offline.nominateChancellor : online.nominateChancellor}
              onVote={handleCastVote}
              onPresidentDiscard={isOffline ? offline.presidentDiscard : online.presidentDiscard}
              onChancellorDiscard={isOffline ? offline.chancellorDiscard : online.chancellorDiscard}
              onChancellorVeto={isOffline ? offline.chancellorVeto : online.chancellorVeto}
              onPresidentVetoResponse={
                isOffline ? offline.presidentVetoResponse : online.presidentVetoResponse
              }
              onAcknowledgePeek={isOffline ? offline.acknowledgePeek : online.acknowledgePeek}
              onInvestigate={isOffline ? offline.investigatePlayer : online.investigatePlayer}
              onAcknowledgeInvestigation={
                isOffline ? offline.acknowledgeInvestigation : online.acknowledgeInvestigation
              }
              onSpecialElection={isOffline ? offline.specialElection : online.specialElection}
              onExecute={isOffline ? offline.executePlayer : online.executePlayer}
              isOfflineMode={isOffline}
              activeActorName={offline.activeActorName}
              privacyUnlocked={offline.privacyUnlocked}
              onUnlockPrivacy={offline.unlockPrivacy}
              onOpenNightEnvelope={() => setIdentityOpen(true)}
              onQuickTableVote={isOffline ? offline.resolveQuickTableVote : undefined}
            />

            {/* Liberal & Fascist Policy Tracks */}
            <PolicyTracks
              liberalPolicies={activeGameState!.liberalPolicies}
              fascistPolicies={activeGameState!.fascistPolicies}
              electionTracker={activeGameState!.electionTracker}
              deckCount={activeGameState!.deckCount}
              discardCount={activeGameState!.discardCount}
              playerCount={activeGameState!.players.length}
            />

            {/* Seated Players & Spectators */}
            <PlayerRoster
              players={activeGameState!.players}
              spectators={isOffline ? [] : online.spectators}
              currentUserId={activePlayerId}
              lastVotes={
                isOffline
                  ? offline.lastElectionVotes?.votes || null
                  : online.lastElectionVotes?.votes || null
              }
              isVotingPhase={activeGameState!.phase === 'VOTING'}
            />

            {/* Session Log */}
            <GameLog entries={activeGameState!.log} />
          </div>
        )}
      </main>

      {/* Rulebook Modal */}
      <RulesModal isOpen={rulesOpen} onClose={() => setRulesOpen(false)} />

      {/* Rule Verification Agents Modal */}
      <DiagnosticsModal
        isOpen={diagnosticsOpen}
        onClose={() => setDiagnosticsOpen(false)}
        liveState={activeGameState}
        onRequestServerDiagnostics={isOffline ? undefined : online.runServerDiagnostics}
      />

      {/* Secret Envelope Modal */}
      <NightModal
        isOpen={
          isOffline
            ? isNightPhase || identityOpen
            : (!online.isSpectator && online.showNightModal) || identityOpen
        }
        onClose={() => {
          online.setShowNightModal(false);
          setIdentityOpen(false);
        }}
        nightInfo={activeNightInfo}
        playerName={activeNightPlayerName}
        isNightPhase={isNightPhase}
        onConfirmNight={() => {
          if (isOffline) {
            offline.advanceOfflineNightPlayer();
          } else {
            online.completeNight();
            setIdentityOpen(false);
          }
        }}
        isOfflineMode={isOffline}
        nightStepCurrent={offlineNightStepIndex}
        nightStepTotal={humanPlayersInOffline.length || 5}
        allPlayers={activeGameState?.players || []}
        getOfflineNightInfo={offline.getNightInfoForPlayerId}
      />

      {/* Game Over Modal */}
      {activeGameOverData && (
        <GameOverModal
          isOpen={true}
          winner={activeGameOverData.winner}
          winReason={activeGameOverData.winReason}
          roles={activeGameOverData.roles}
          isHost={isOffline ? true : online.isHost}
          onRestart={isOffline ? offline.restartOfflineGame : online.restartGame}
        />
      )}
    </div>
  );
}
