import React, { useState } from 'react';
import { Activity, Lead } from '../../types/crm';
import { Activity as ActivityIcon, Search, Calendar, User, ArrowRight } from 'lucide-react';

interface ActivityViewProps {
  activities: Activity[];
  leads: Lead[];
  onOpenLeadProfile: (lead: Lead) => void;
}

export const ActivityView: React.FC<ActivityViewProps> = ({
  activities,
  leads,
  onOpenLeadProfile,
}) => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  const filtered = activities.filter((act) => {
    if (filterType !== 'all' && act.type !== filterType) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchLead = act.leadName?.toLowerCase().includes(q);
      const matchDetails = act.details?.toLowerCase().includes(q);
      const matchType = act.type.toLowerCase().includes(q);
      if (!matchLead && !matchDetails && !matchType) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0E1626] border border-[#1E2C4A] p-6 rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-blue-500/20 text-cyan-400 border border-blue-500/30">
                <ActivityIcon className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-white">System Activity & Audit Log</h2>
            </div>
            <p className="text-xs text-slate-400">
              Immutable chronological record of outreach, status progressions, and lead creation events.
            </p>
          </div>
          <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800 px-3 py-1 rounded-xl self-start sm:self-auto">
            {activities.length} Recorded Events
          </span>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search activity by lead name, details, or actor..."
            className="w-full pl-10 pr-4 py-2 bg-[#0E1626] border border-[#1E2C4A] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="p-2 bg-[#0E1626] border border-[#1E2C4A] rounded-xl text-xs text-slate-300"
        >
          <option value="all">All Action Types</option>
          <option value="lead_created">Lead Created</option>
          <option value="status_changed">Status Changed</option>
          <option value="call_started">Call Started</option>
          <option value="whatsapp_opened">WhatsApp Opened</option>
          <option value="whatsapp_confirmed">WhatsApp Confirmed</option>
          <option value="email_opened">Email Opened</option>
          <option value="email_confirmed">Email Confirmed</option>
          <option value="followup_created">Follow-up Created</option>
          <option value="followup_completed">Follow-up Completed</option>
          <option value="note_added">Note Added</option>
        </select>
      </div>

      {/* Audit Feed */}
      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#0E1626] border border-[#1E2C4A] text-slate-500 text-xs">
            No activity records match your filter criteria.
          </div>
        ) : (
          filtered.map((act) => {
            const associatedLead = leads.find((l) => l.id === act.leadId);

            return (
              <div
                key={act.id}
                className="p-4 rounded-xl bg-[#0E1626] border border-[#1E2C4A] hover:border-cyan-500/30 transition-colors flex items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#080B11] border border-[#1E2C4A] text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                    <ActivityIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white capitalize">
                        {act.type.replace(/_/g, ' ')}
                      </span>
                      {act.leadName && (
                        <span className="text-xs font-medium text-cyan-300">
                          &bull; {act.leadName}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">{act.details}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500 font-mono">
                      <span>{new Date(act.timestamp).toLocaleString()}</span>
                      {act.actorId && <span>Actor: {act.actorId}</span>}
                    </div>
                  </div>
                </div>

                {associatedLead && (
                  <button
                    onClick={() => onOpenLeadProfile(associatedLead)}
                    className="px-3 py-1.5 rounded-lg bg-[#131E33] hover:bg-[#1E2C4A] border border-[#1E2C4A] text-[11px] font-semibold text-slate-300 hover:text-white shrink-0 cursor-pointer"
                  >
                    View Lead
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
