import React, { useState } from 'react';
import { Lead, LeadStatus } from '../../types/crm';
import { PIPELINE_COLUMNS } from '../../constants/seedData';
import { CRMStorage } from '../../services/crmStorage';
import {
  Flame,
  Phone,
  MessageSquare,
  Clock,
  MoreVertical,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface PipelineViewProps {
  leads: Lead[];
  onOpenLeadProfile: (lead: Lead) => void;
  onRefreshData: () => Promise<void>;
}

export const PipelineView: React.FC<PipelineViewProps> = ({
  leads,
  onOpenLeadProfile,
  onRefreshData,
}) => {
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);

  const handleDragStart = (leadId: string) => {
    setDraggedLeadId(leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (newStatus: LeadStatus) => {
    if (!draggedLeadId) return;
    const targetLead = leads.find((l) => l.id === draggedLeadId);
    if (targetLead && targetLead.status !== newStatus) {
      await CRMStorage.updateLeadStatus(draggedLeadId, newStatus, 'admin');
      await onRefreshData();
    }
    setDraggedLeadId(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0E1626] border border-[#1E2C4A] p-4 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Sales & Operations Pipeline</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
              Kanban
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Drag and drop leads across qualification stages to instantly sync status & audit records.
          </p>
        </div>
      </div>

      {/* Kanban Board Horizontal Scroll */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin select-none min-h-[640px]">
        {PIPELINE_COLUMNS.map((colStatus) => {
          const colLeads = leads.filter((l) => l.status === colStatus);
          const isWon = colStatus === 'Won / Client';
          const isLost = colStatus === 'Lost';

          return (
            <div
              key={colStatus}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(colStatus)}
              className={`w-72 shrink-0 rounded-2xl border flex flex-col max-h-[80vh] transition-colors ${
                isWon
                  ? 'bg-emerald-950/15 border-emerald-900/40'
                  : isLost
                  ? 'bg-slate-900/30 border-slate-800'
                  : 'bg-[#0E1626] border-[#1E2C4A]'
              }`}
            >
              {/* Column Header */}
              <div className="p-3.5 border-b border-[#1E2C4A]/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">{colStatus}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#080B11] border border-[#1E2C4A] text-slate-400 font-mono">
                    {colLeads.length}
                  </span>
                </div>
              </div>

              {/* Cards Container */}
              <div className="flex-1 p-2.5 overflow-y-auto space-y-2.5">
                {colLeads.length === 0 ? (
                  <div className="h-28 border border-dashed border-[#1E2C4A] rounded-xl flex items-center justify-center text-[11px] text-slate-600">
                    Drop lead here
                  </div>
                ) : (
                  colLeads.map((lead) => {
                    const isOverdue =
                      lead.nextFollowUpAt && new Date(lead.nextFollowUpAt).getTime() < Date.now();

                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={() => handleDragStart(lead.id)}
                        onClick={() => onOpenLeadProfile(lead)}
                        className="p-3 rounded-xl bg-[#080B11] border border-[#1E2C4A] hover:border-cyan-500/50 shadow-sm cursor-grab active:cursor-grabbing transition-all group"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="text-[10px] font-semibold text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded">
                            {lead.categoryName}
                          </span>
                          {lead.isHot && (
                            <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                          )}
                        </div>

                        <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                          {lead.businessName}
                        </h4>

                        {lead.contactPerson && (
                          <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                            {lead.contactPerson}
                          </p>
                        )}

                        <div className="mt-3 pt-2 border-t border-[#1E2C4A]/60 flex items-center justify-between text-[10px] text-slate-400">
                          <div className="flex items-center gap-1.5">
                            {lead.phone && <Phone className="w-3 h-3 text-blue-400" />}
                            {lead.whatsapp && <MessageSquare className="w-3 h-3 text-emerald-400" />}
                          </div>

                          {lead.nextFollowUpAt && (
                            <span
                              className={`flex items-center gap-1 ${
                                isOverdue ? 'text-red-400 font-bold' : 'text-slate-400'
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              {new Date(lead.nextFollowUpAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
