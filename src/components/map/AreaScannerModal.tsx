import React, { useState, useEffect, useRef } from 'react';
import { MapBounds, BusinessCandidate, BusinessMapService } from '../../services/businessMapService';
import { ScanCell, subdivideBounds } from '../../utils/geoScanner';
import { Lead } from '../../types/crm';
import {
  X,
  Play,
  Pause,
  Square,
  CheckCircle2,
  AlertCircle,
  Radar,
  Sparkles,
  Layers,
} from 'lucide-react';

interface AreaScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBounds: MapBounds;
  categoryFilter: string;
  existingLeads: Lead[];
  onScanCompleted: (newCandidates: BusinessCandidate[]) => void;
}

export const AreaScannerModal: React.FC<AreaScannerModalProps> = ({
  isOpen,
  onClose,
  currentBounds,
  categoryFilter,
  existingLeads,
  onScanCompleted,
}) => {
  const [cells, setCells] = useState<ScanCell[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentCellIndex, setCurrentCellIndex] = useState(0);
  const [foundCandidates, setFoundCandidates] = useState<BusinessCandidate[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isRunningRef = useRef(isRunning);
  isRunningRef.current = isRunning;

  // Initialize cells on open
  useEffect(() => {
    if (isOpen) {
      const generated = subdivideBounds(currentBounds, 2, 3);
      setCells(generated);
      setCurrentCellIndex(0);
      setFoundCandidates([]);
      setNewCount(0);
      setDuplicateCount(0);
      setIsRunning(false);
      setErrorMessage(null);
    }
  }, [isOpen, currentBounds]);

  // Sequential Cell Processing Loop
  const startScan = async () => {
    setIsRunning(true);
    setErrorMessage(null);

    const activeCells = [...cells];
    const accumulated: BusinessCandidate[] = [...foundCandidates];
    let localNew = newCount;
    let localDup = duplicateCount;

    for (let i = currentCellIndex; i < activeCells.length; i++) {
      if (!isRunningRef.current) break;

      setCurrentCellIndex(i);
      activeCells[i].status = 'scanning';
      setCells([...activeCells]);

      try {
        // Query the cell bounds
        const res = await BusinessMapService.searchInBounds(
          activeCells[i].bounds,
          categoryFilter,
          existingLeads
        );

        if (res.candidates) {
          const freshIds = new Set(accumulated.map((c) => c.externalId));
          const additions = res.candidates.filter((c) => !freshIds.has(c.externalId));

          accumulated.push(...additions);
          const newLeadsInCell = additions.filter((c) => !c.inCrm).length;
          const dupsInCell = additions.filter((c) => c.inCrm).length;

          localNew += newLeadsInCell;
          localDup += dupsInCell;
          setNewCount(localNew);
          setDuplicateCount(localDup);

          activeCells[i].status = 'completed';
          activeCells[i].foundCount = additions.length;
        } else {
          activeCells[i].status = 'completed';
          activeCells[i].foundCount = 0;
        }
      } catch (err: any) {
        activeCells[i].status = 'failed';
        setErrorMessage('Scanner encountered a network delay. Resuming safely...');
      }

      setCells([...activeCells]);
      setFoundCandidates([...accumulated]);

      // Respect open provider rate limits (1.2s delay between cells)
      if (i < activeCells.length - 1 && isRunningRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }

    setIsRunning(false);
    onScanCompleted(accumulated);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleStop = () => {
    setIsRunning(false);
    onScanCompleted(foundCandidates);
    onClose();
  };

  if (!isOpen) return null;

  const completedCount = cells.filter((c) => c.status === 'completed').length;
  const progressPct = cells.length > 0 ? Math.round((completedCount / cells.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-[#0E1626] border border-[#1E2C4A] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#1E2C4A] bg-[#131E33] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Radar className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>AUTOMATED AREA SCANNER</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Rate-Safe
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Segmenting area into 6 safe search cells within provider limits
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#080B11] border border-[#1E2C4A] text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Progress Bar & Cell Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-300">
                Area Coverage: <strong className="text-cyan-400">{completedCount} / {cells.length} Cells</strong>
              </span>
              <span className="text-slate-400 font-mono">{progressPct}% Complete</span>
            </div>

            <div className="w-full h-2 rounded-full bg-[#080B11] border border-[#1E2C4A] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Cell Matrix Diagram */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              {cells.map((cell) => {
                let bg = 'bg-[#080B11] border-[#1E2C4A] text-slate-500';
                if (cell.status === 'scanning') {
                  bg = 'bg-cyan-950/60 border-cyan-400 text-cyan-300 animate-pulse';
                } else if (cell.status === 'completed') {
                  bg = 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300';
                } else if (cell.status === 'failed') {
                  bg = 'bg-red-950/40 border-red-500/50 text-red-300';
                }

                return (
                  <div
                    key={cell.id}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${bg}`}
                  >
                    <span className="text-xs font-bold">Cell [{cell.index}]</span>
                    <span className="text-[10px] font-mono mt-0.5">
                      {cell.status === 'scanning'
                        ? 'Scanning...'
                        : cell.status === 'completed'
                        ? `+${cell.foundCount} POIs`
                        : 'Waiting'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Running Results Counter */}
          <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-[#080B11] border border-[#1E2C4A] text-center">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">
                Total Found
              </span>
              <span className="text-xl font-bold text-white mt-1 block">
                {foundCandidates.length}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold block">
                New Candidates
              </span>
              <span className="text-xl font-bold text-emerald-400 mt-1 block">
                {newCount}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-cyan-400 font-bold block">
                In CRM (Skipped)
              </span>
              <span className="text-xl font-bold text-cyan-400 mt-1 block">
                {duplicateCount}
              </span>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="text-[11px] text-slate-400 bg-[#131E33] p-3 rounded-xl border border-[#1E2C4A] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span>
              Provider limits respected. Safe delay prevents IP blocks or query rate throttling.
            </span>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="p-4 bg-[#131E33] border-t border-[#1E2C4A] flex items-center justify-between">
          <button
            onClick={handleStop}
            className="px-4 py-2 rounded-xl bg-[#080B11] hover:bg-[#1E2C4A] text-slate-300 border border-[#1E2C4A] text-xs font-semibold flex items-center gap-2 cursor-pointer"
          >
            <Square className="w-3.5 h-3.5" />
            <span>Stop & Keep Results</span>
          </button>

          <div className="flex items-center gap-2">
            {isRunning ? (
              <button
                onClick={handlePause}
                className="px-5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Pause className="w-4 h-4" />
                <span>Pause Scan</span>
              </button>
            ) : (
              <button
                onClick={startScan}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-black shadow-lg shadow-cyan-500/20 flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{completedCount > 0 ? 'Resume Scan' : 'Start Safe Area Scan'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
