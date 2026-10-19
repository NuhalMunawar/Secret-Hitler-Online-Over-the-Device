import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
import { AgentCheckResult, PublicGameState } from '../game/types.js';
import { DebugAgents } from '../game/DebugAgents.js';
import { sound } from '../utils/sound.js';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  liveState: PublicGameState | null;
  onRequestServerDiagnostics?: () => Promise<AgentCheckResult[] | null>;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  isOpen,
  onClose,
  liveState,
  onRequestServerDiagnostics,
}) => {
  const [results, setResults] = useState<AgentCheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const [lastRunTime, setLastRunTime] = useState<string>('');

  const executeAgents = async () => {
    setRunning(true);
    sound.playClick();
    let report: AgentCheckResult[] | null = null;
    if (onRequestServerDiagnostics) {
      report = await onRequestServerDiagnostics();
    }
    if (!report) {
      report = DebugAgents.runAllDiagnostics(liveState);
    }
    setResults(report);
    setLastRunTime(new Date().toLocaleTimeString());
    setRunning(false);
  };

  useEffect(() => {
    if (isOpen) {
      executeAgents();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalChecks = results.reduce((acc, r) => acc + r.checksRun, 0);
  const allPassed = results.length > 0 && results.every((r) => r.status === 'PASS');

  return (
    <div
      role="dialog"
      aria-label="Rule & State Verification Agents"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-3xl max-h-[88vh] overflow-y-auto bg-[#171412] border-2 border-[#3d332c] rounded-lg shadow-2xl p-6 md:p-8 text-[#f4efe6]">
        <button
          onClick={() => {
            sound.playClick();
            onClose();
          }}
          aria-label="Close verification panel"
          className="absolute top-5 right-5 text-[#a89f91] hover:text-[#f4efe6] transition-colors p-1.5 rounded hover:bg-[#26201c] cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="border-b border-[#2e2621] pb-4 mb-5">
          <div className="flex items-center gap-2 text-xs font-mono-numbers uppercase tracking-widest text-[#d4a359]">
            <ShieldCheck className="w-4 h-4" />
            <span>Automated QA & Rule Verification Suite</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-woodcut tracking-wider text-[#f4efe6] mt-1">
            Game Engine Verification Agents
          </h2>
          <p className="text-xs text-[#a89f91] mt-1">
            Five autonomous verification agents continuously audit the live table invariants, 17-tile conservation, term-limit rules, and full-game Monte Carlo simulations.
          </p>
        </div>

        {/* Summary Strip */}
        <div className="mb-5 p-3.5 rounded bg-[#1f1a17] border border-[#362e28] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {allPassed ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            )}
            <div className="text-xs">
              <strong className="text-[#f4efe6]">
                {allPassed ? 'All 5 Agents Reporting 100% Rule Compliance' : 'Audit In Progress'}
              </strong>
              <span className="text-[#a89f91] ml-2 font-mono-numbers">
                · {totalChecks} assertions verified {lastRunTime ? `at ${lastRunTime}` : ''}
              </span>
            </div>
          </div>

          <button
            onClick={executeAgents}
            disabled={running}
            className="px-3.5 py-1.5 rounded bg-[#d4a359] hover:bg-[#e0b46e] text-[#12100e] font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
            <span>{running ? 'Auditing...' : 'Re-Run All Agents'}</span>
          </button>
        </div>

        {/* Agents List */}
        <div className="space-y-3">
          {results.map((agent) => (
            <div
              key={agent.agentName}
              className="p-4 rounded bg-[#1b1714] border border-[#2e2621] space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-woodcut tracking-wide text-[#f4efe6]">
                    {agent.agentName}
                  </h3>
                  <p className="text-[11px] text-[#a89f91]">{agent.role}</p>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`text-xs font-mono-numbers font-bold uppercase tracking-wider ${
                      agent.status === 'PASS' ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {agent.status} · {agent.checksRun} Checks
                  </span>
                </div>
              </div>

              <ul className="space-y-1 pt-2 border-t border-[#26201c] text-xs text-[#d6cfc2]">
                {agent.details.map((detail, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-400 font-sans font-bold">✓</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-[#2e2621] flex justify-end">
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-[#12100e] bg-[#d4a359] hover:bg-[#e0b46e] rounded transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
