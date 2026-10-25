import React, { useState, useEffect } from 'react';
import { Lead } from '../../types/crm';
import { Search, X, MapPin, Phone, MessageSquare, Flame } from 'lucide-react';

interface GlobalSearchModalProps {
  leads: Lead[];
  isOpen: boolean;
  onClose: () => void;
  onSelectLead: (lead: Lead) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  leads,
  isOpen,
  onClose,
  onSelectLead,
}) => {
  const [query, setQuery] = useState('');

  // Handle Cmd+K / Esc shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const results = query.trim()
    ? leads.filter((l) => {
        const q = query.toLowerCase();
        return (
          l.businessName.toLowerCase().includes(q) ||
          l.contactPerson?.toLowerCase().includes(q) ||
          l.phone?.includes(q) ||
          l.whatsapp?.includes(q) ||
          l.email?.toLowerCase().includes(q) ||
          l.city?.toLowerCase().includes(q) ||
          l.country?.toLowerCase().includes(q) ||
          l.website?.toLowerCase().includes(q) ||
          l.notesSummary?.toLowerCase().includes(q) ||
          l.tags?.some((t) => t.toLowerCase().includes(q))
        );
      })
    : [];

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-20 p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-2xl bg-[#0E1626] border border-[#1E2C4A] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Input Bar */}
        <div className="p-4 border-b border-[#1E2C4A] flex items-center gap-3">
          <Search className="w-5 h-5 text-cyan-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search business, contact person, phone, WhatsApp, email, tags..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results list */}
        <div className="max-h-96 overflow-y-auto p-2">
          {query.trim() === '' ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Type keywords to search across all {leads.length} stored CRM leads...
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No matching leads found for "{query}".
            </div>
          ) : (
            results.map((lead) => (
              <div
                key={lead.id}
                onClick={() => {
                  onSelectLead(lead);
                  onClose();
                }}
                className="p-3 rounded-xl hover:bg-[#131E33] cursor-pointer flex items-center justify-between gap-3 group transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white group-hover:text-cyan-300">
                      {lead.businessName}
                    </span>
                    <span className="text-[10px] text-slate-400 bg-[#080B11] px-1.5 py-0.5 rounded border border-[#1E2C4A]">
                      {lead.categoryName}
                    </span>
                    {lead.isHot && <Flame className="w-3 h-3 text-orange-400" />}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-3">
                    {lead.contactPerson && <span>{lead.contactPerson}</span>}
                    {lead.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {lead.city}
                      </span>
                    )}
                    {lead.phone && (
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3 text-slate-500" />
                        {lead.phone}
                      </span>
                    )}
                  </div>
                </div>

                <span className="text-[11px] px-2 py-0.5 rounded bg-[#080B11] border border-[#1E2C4A] text-slate-300 font-medium">
                  {lead.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
