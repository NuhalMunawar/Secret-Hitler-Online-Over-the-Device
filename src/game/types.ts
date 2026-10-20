export type Role = 'LIBERAL' | 'FASCIST' | 'HITLER';
export type Party = 'LIBERAL' | 'FASCIST';
export type Policy = 'LIBERAL' | 'FASCIST';
export type Vote = 'JA' | 'NEIN';

export type ExecutiveAction = 'PEEK' | 'INVESTIGATE' | 'SPECIAL_ELECTION' | 'EXECUTE' | 'NONE';

export type Phase =
  | 'LOBBY'
  | 'NIGHT'
  | 'NOMINATION'
  | 'VOTING'
  | 'VOTE_REVEAL'
  | 'LEGISLATIVE_PRESIDENT'
  | 'LEGISLATIVE_CHANCELLOR'
  | 'VETO_PENDING'
  | 'EXECUTIVE_ACTION'
  | 'GAME_OVER';

export interface Player {
  id: string;
  name: string;
  role: Role;
  party: Party;
  isAlive: boolean;
  isBot?: boolean;
  governmentHistory: Policy[];
}

export interface Spectator {
  id: string;
  name: string;
}

export interface PublicPlayer {
  id: string;
  name: string;
  isAlive: boolean;
  isPresident: boolean;
  isChancellor: boolean;
  isPreviousPresident: boolean;
  isPreviousChancellor: boolean;
  investigatedByPresident?: boolean;
  hasVoted?: boolean;
  isBot?: boolean;
  isHost?: boolean;
  governmentHistory: Policy[];
}

export interface NightInfo {
  role: Role;
  party: Party;
  teammates?: { name: string; role?: Role }[];
  hitlerName?: string;
  knowsHitler: boolean;
  hitlerKnowsFascists: boolean;
}

export interface GameLogEntry {
  id: string;
  timestamp: number;
  text: string;
  type: 'election' | 'policy' | 'executive' | 'chaos' | 'system';
}

export interface AgentCheckResult {
  agentName: string;
  role: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  checksRun: number;
  details: string[];
}

export interface VoteBallotEntry {
  playerId: string;
  playerName: string;
  vote: Vote;
}

export interface LastVoteDetails {
  roundNumber: number;
  presidentName: string;
  chancellorName: string;
  passed: boolean;
  jaCount: number;
  neinCount: number;
  ballots: VoteBallotEntry[];
}

export interface HitlerSuspenseCheck {
  targetName: string;
  context: 'CHANCELLOR_ELECTED' | 'PLAYER_EXECUTED';
  isHitler: boolean;
}

export interface PublicGameState {
  phase: Phase;
  roundNumber: number;
  liberalPolicies: number;
  fascistPolicies: number;
  electionTracker: number; // 0, 1, 2 (3 triggers chaos)
  deckCount: number;
  discardCount: number;
  reshuffleCount: number;
  inHandCount: number;
  presidentIndex: number;
  chancellorIndex: number | null;
  previousPresidentIndex: number | null;
  previousChancellorIndex: number | null;
  eligibleChancellors: number[];
  votes: Record<string, Vote>;
  lastVotePassed: boolean | null;
  lastVoteDetails: LastVoteDetails | null;
  executiveAction: ExecutiveAction;
  specialElectionReturnIndex: number | null;
  vetoUnlocked: boolean;
  vetoUsedThisRound: boolean;
  winner: 'LIBERAL' | 'FASCIST' | null;
  winReason: string | null;
  players: PublicPlayer[];
  log: GameLogEntry[];
}
