import React, { useEffect, useState } from 'react';
import { BusinessCandidate } from '../../services/businessMapService';
import {
  X,
  Plus,
  ExternalLink,
  Phone,
  Globe,
  MapPin,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  MessageSquare,
  Mail,
  Check,
} from 'lucide-react';

interface LeadHuntModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidates: BusinessCandidate[];
  currentIndex: number;
  onSelectIndex: (index: number) => void;
  onAddAndNext: (candidate: BusinessCandidate) => Promise<void>;
  onSkipAndNext: (candidate: BusinessCandidate) => void;
  onNotRelevant: (candidate: BusinessCandidate) => void;
  sessionStats: {
    added: number;
    skipped: number;
  };
}

export const LeadHuntModal: React.FC<LeadHuntModalProps> = ({
  isOpen,
  onClose,
  candidates,
  currentIndex,
  onSelectIndex,
  onAddAndNext,
  onSkipAndNext,
  onNotRelevant,
  sessionStats,
}) => {
  const currentCandidate = candidates[currentIndex] || null;
  const [candidateState, setCandidateState] = useState<BusinessCandidate | null>(null);

  useEffect(() => {
    setCandidateState(currentCandidate);
  }, [currentCandidate]);

  const handleConfirmWhatsapp = () => {
    if (!candidateState || !candidateState.phone) return;
    setCandidateState({
      ...candidateState,
      whatsapp: candidateState.phone,
      whatsappConfirmed: true,
    });
  };

  // Keyboard shortcuts: A = Add & Next, S = Skip & Next, V = View Website, W = Use Phone as WhatsApp, Esc = Close
  useEffect(() => {
    if (!isOpen || !candidateState) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        onAddAndNext(candidateState);
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        onSkipAndNext(candidateState);
      } else if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        handleConfirmWhatsapp();
      } else if (e.key === 'v' || e.key === 'V') {
        if (candidateState.website) {
          e.preventDefault();
          window.open(candidateState.website, '_blank', 'noopener,noreferrer');
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, candidateState, onAddAndNext, onSkipAndNext, onClose]);

  if (!isOpen) return null;

  const total = candidates.length;
  const remaining = Math.max(0, total - currentIndex - 1);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#0E1626] border border-[#1E2C4A] rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header with Mode & Shortcuts */}
        <div className="p-4 border-b border-[#1E2C4A] bg-[#131E33] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">RAPID LEAD HUNT</h3>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                  Fast Prospecting
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Candidate {total > 0 ? currentIndex + 1 : 0} of {total}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Keyboard hints */}
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400 font-mono">
              <span className="px-1.5 py-0.5 bg-[#080B11] border border-[#1E2C4A] rounded text-slate-300">A</span>
              <span>Add</span>
              <span className="px-1.5 py-0.5 bg-[#080B11] border border-[#1E2C4A] rounded text-slate-300">S</span>
              <span>Skip</span>
              <span className="px-1.5 py-0.5 bg-[#080B11] border border-[#1E2C4A] rounded text-slate-300">W</span>
              <span>WhatsApp</span>
              <span className="px-1.5 py-0.5 bg-[#080B11] border border-[#1E2C4A] rounded text-slate-300">Esc</span>
              <span>Exit</span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#080B11] border border-[#1E2C4A] text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Session Counter Banner */}
        <div className="px-6 py-2.5 bg-[#080B11] border-b border-[#1E2C4A] flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-4">
            <span className="text-emerald-400">
              Added: <strong className="font-bold text-white">{sessionStats.added}</strong>
            </span>
            <span className="text-slate-400">
              Skipped: <strong className="font-bold text-white">{sessionStats.skipped}</strong>
            </span>
            <span className="text-cyan-400">
              Remaining: <strong className="font-bold text-white">{remaining}</strong>
            </span>
          </div>

          {/* Quick Jump Navigator */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onSelectIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="px-2 py-1 text-[11px] bg-[#131E33] hover:bg-[#1E2C4A] disabled:opacity-40 rounded text-slate-300 cursor-pointer"
            >
              &larr; Prev
            </button>
            <button
              onClick={() => onSelectIndex(Math.min(total - 1, currentIndex + 1))}
              disabled={currentIndex >= total - 1}
              className="px-2 py-1 text-[11px] bg-[#131E33] hover:bg-[#1E2C4A] disabled:opacity-40 rounded text-slate-300 cursor-pointer"
            >
              Next &rarr;
            </button>
          </div>
        </div>

        {/* Main Body */}
        {candidateState ? (
          <div className="p-6 space-y-5 overflow-y-auto">
            {/* Top Info + Quality Score Card */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#080B11] border border-[#1E2C4A]">
              <div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-cyan-400 border border-blue-500/20">
                  {candidateState.primaryCategory}
                </span>
                <h2 className="text-xl font-bold text-white mt-1.5">{candidateState.businessName}</h2>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>
                    {[candidateState.address, candidateState.city, candidateState.country]
                      .filter(Boolean)
                      .join(', ') || 'Address Not Available'}
                  </span>
                </div>
              </div>

              {/* Deterministic Quality Score Badge */}
              <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 border-[#1E2C4A] pt-3 sm:pt-0">
                <div className="text-left sm:text-right">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                    Lead Quality
                  </span>
                  <span
                    className={`text-2xl font-black ${
                      (candidateState.leadQualityScore || 50) >= 80
                        ? 'text-emerald-400'
                        : (candidateState.leadQualityScore || 50) >= 60
                        ? 'text-cyan-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {candidateState.leadQualityScore || 50}
                    <span className="text-xs text-slate-500 font-normal"> / 100</span>
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#131E33] text-slate-300 border border-[#1E2C4A] mt-1">
                  {candidateState.leadQualityLabel || 'GOOD CANDIDATE'}
                </span>
              </div>
            </div>

            {/* Contact Badges Row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase font-bold text-slate-500">Contact Channels:</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold flex items-center gap-1 ${
                  candidateState.phone ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500'
                }`}
              >
                PHONE {candidateState.phone ? '✓' : '—'}
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold flex items-center gap-1 ${
                  candidateState.website ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-slate-800 text-slate-500'
                }`}
              >
                WEBSITE {candidateState.website ? '✓' : '—'}
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold flex items-center gap-1 ${
                  candidateState.email ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-slate-800 text-slate-500'
                }`}
              >
                EMAIL {candidateState.email ? '✓' : '—'}
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold flex items-center gap-1 ${
                  candidateState.whatsappConfirmed ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500'
                }`}
              >
                WHATSAPP {candidateState.whatsappConfirmed ? '✓' : '—'}
              </span>
            </div>

            {/* Factual Contact Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Direct Phone */}
              <div className="p-3.5 rounded-xl bg-[#080B11] border border-[#1E2C4A] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Phone className={`w-4 h-4 ${candidateState.phone ? 'text-emerald-400' : 'text-slate-600'}`} />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Direct Phone</span>
                    <span className={`font-semibold ${candidateState.phone ? 'text-white' : 'text-slate-500'}`}>
                      {candidateState.phone || 'Not Available'}
                    </span>
                  </div>
                </div>
                {candidateState.phone && (
                  <a
                    href={`tel:${candidateState.phone}`}
                    className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[11px] font-semibold"
                  >
                    Call
                  </a>
                )}
              </div>

              {/* Website */}
              <div className="p-3.5 rounded-xl bg-[#080B11] border border-[#1E2C4A] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Globe className={`w-4 h-4 ${candidateState.website ? 'text-cyan-400' : 'text-slate-600'}`} />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Website</span>
                    <span className={`font-semibold truncate max-w-[150px] block ${candidateState.website ? 'text-cyan-300' : 'text-slate-500'}`}>
                      {candidateState.website ? candidateState.website.replace(/^https?:\/\//, '') : 'Not Available'}
                    </span>
                  </div>
                </div>
                {candidateState.website && (
                  <a
                    href={candidateState.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded text-[11px] font-semibold flex items-center gap-1"
                  >
                    <span>Visit</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {/* WhatsApp (Separated & Honest) */}
              <div className="p-3.5 rounded-xl bg-[#080B11] border border-[#1E2C4A] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <MessageSquare className={`w-4 h-4 ${candidateState.whatsappConfirmed ? 'text-emerald-400' : 'text-slate-600'}`} />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">WhatsApp Status</span>
                    <span className={`font-semibold ${candidateState.whatsappConfirmed ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {candidateState.whatsappConfirmed ? `Confirmed (${candidateState.whatsapp})` : 'Not Confirmed'}
                    </span>
                  </div>
                </div>
                {candidateState.phone && !candidateState.whatsappConfirmed && (
                  <button
                    onClick={handleConfirmWhatsapp}
                    className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold cursor-pointer"
                  >
                    Use Phone
                  </button>
                )}
              </div>

              {/* Email (OSM limitation explanation) */}
              <div className="p-3.5 rounded-xl bg-[#080B11] border border-[#1E2C4A] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Mail className={`w-4 h-4 ${candidateState.email ? 'text-blue-400' : 'text-slate-600'}`} />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Email Address</span>
                    <span className={`font-semibold ${candidateState.email ? 'text-white' : 'text-slate-500'}`}>
                      {candidateState.email || 'Not Available'}
                    </span>
                  </div>
                </div>
                {!candidateState.email && (
                  <span className="text-[9px] text-slate-500 font-mono">Map POI limit</span>
                )}
              </div>
            </div>

            {/* Quality Determinant Factors */}
            <div className="p-3.5 rounded-xl bg-[#080B11] border border-[#1E2C4A] space-y-2">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>Deterministic Quality Breakdown</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                {(candidateState.leadQualityReasons || []).map((r, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{r}</span>
                  </div>
                ))}
                {(candidateState.leadQualityPenalties || []).map((p, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-slate-500">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-500/70" />
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CRM State Notice */}
            {candidateState.inCrm && (
              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  Already saved in your CRM. Adding will update or link to the existing lead record.
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <h4 className="text-base font-bold text-white">All Candidates Reviewed!</h4>
            <p className="text-xs text-slate-400 mt-1">
              You’ve processed all available discovered leads in this viewport.
            </p>
          </div>
        )}

        {/* Footer Actions */}
        {candidateState && (
          <div className="p-4 bg-[#131E33] border-t border-[#1E2C4A] flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              onClick={() => onNotRelevant(candidateState)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#080B11] hover:bg-[#1E2C4A] text-slate-400 hover:text-slate-200 border border-[#1E2C4A] text-xs font-semibold cursor-pointer"
            >
              Not Relevant
            </button>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={() => onSkipAndNext(candidateState)}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-[#080B11] hover:bg-[#1E2C4A] text-slate-300 border border-[#1E2C4A] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>SKIP & NEXT</span>
                <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">(S)</span>
              </button>

              <button
                onClick={() => onAddAndNext(candidateState)}
                className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-black shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>ADD & NEXT</span>
                <span className="text-[10px] text-emerald-200 font-mono hidden sm:inline">(A)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
