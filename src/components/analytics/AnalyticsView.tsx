import React from 'react';
import { Lead, Activity, FollowUp, Category } from '../../types/crm';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  Award,
  Users,
  Phone,
  MessageSquare,
  Mail,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

interface AnalyticsViewProps {
  leads: Lead[];
  activities: Activity[];
  followUps: FollowUp[];
  categories: Category[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  leads,
  activities,
  followUps,
  categories,
}) => {
  const totalLeads = leads.length;

  // Status breakdown
  const statusCounts: Record<string, number> = {};
  leads.forEach((l) => {
    statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
  });

  // Category breakdown (top 5)
  const categoryCounts: Record<string, number> = {};
  leads.forEach((l) => {
    categoryCounts[l.categoryName] = (categoryCounts[l.categoryName] || 0) + 1;
  });
  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Source breakdown
  const sourceCounts: Record<string, number> = {};
  leads.forEach((l) => {
    sourceCounts[l.source] = (sourceCounts[l.source] || 0) + 1;
  });

  // Action counts
  const totalCalls = activities.filter(
    (a) => a.type === 'call_started' || a.type === 'call_recorded'
  ).length;
  const totalWhatsApps = activities.filter(
    (a) => a.type === 'whatsapp_opened' || a.type === 'whatsapp_confirmed'
  ).length;
  const totalEmails = activities.filter(
    (a) => a.type === 'email_opened' || a.type === 'email_confirmed'
  ).length;

  const wonLeads = leads.filter((l) => l.status === 'Won / Client').length;
  const interestedLeads = leads.filter((l) => l.status === 'Interested').length;
  const hotLeads = leads.filter((l) => l.isHot || l.status === 'Hot Lead').length;

  const completedFollowUps = followUps.filter((f) => f.status === 'completed').length;
  const totalFollowUps = followUps.length;
  const followUpRate =
    totalFollowUps > 0 ? Math.round((completedFollowUps / totalFollowUps) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0E1626] border border-[#1E2C4A] p-6 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="p-1.5 rounded-lg bg-blue-500/20 text-cyan-400 border border-blue-500/30">
            <BarChart3 className="w-4 h-4" />
          </span>
          <h2 className="text-lg font-bold text-white">Lead Operations Analytics</h2>
        </div>
        <p className="text-xs text-slate-400">
          Deterministic metrics computed directly from stored leads, follow-ups, and activity records.
        </p>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#0E1626] border border-[#1E2C4A]">
          <span className="text-xs font-semibold text-slate-400">Total Pipeline</span>
          <div className="text-2xl font-black text-white mt-1">{totalLeads}</div>
          <span className="text-[11px] text-cyan-400 mt-1 block">Active stored leads</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#0E1626] border border-[#1E2C4A]">
          <span className="text-xs font-semibold text-slate-400">Clients Won</span>
          <div className="text-2xl font-black text-emerald-400 mt-1">{wonLeads}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0}% Conversion
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-[#0E1626] border border-[#1E2C4A]">
          <span className="text-xs font-semibold text-slate-400">High-Interest Leads</span>
          <div className="text-2xl font-black text-amber-400 mt-1">
            {interestedLeads + hotLeads}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Interested or Hot Leads</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#0E1626] border border-[#1E2C4A]">
          <span className="text-xs font-semibold text-slate-400">Follow-up Completion</span>
          <div className="text-2xl font-black text-cyan-300 mt-1">{followUpRate}%</div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {completedFollowUps} / {totalFollowUps} Tasks Done
          </span>
        </div>
      </div>

      {/* Distribution Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="p-5 rounded-2xl bg-[#0E1626] border border-[#1E2C4A] space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center justify-between">
            <span>Leads by Industry Category</span>
            <span className="text-xs text-slate-500">Top Categories</span>
          </h3>

          <div className="space-y-3">
            {topCategories.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No leads recorded yet.</p>
            ) : (
              topCategories.map(([catName, count]) => {
                const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
                return (
                  <div key={catName} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">{catName}</span>
                      <span className="text-cyan-400 font-mono font-semibold">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#080B11] rounded-full h-2 overflow-hidden border border-[#1E2C4A]">
                      <div
                        className="bg-gradient-to-r from-blue-600 to-cyan-400 h-2 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Lead Source Breakdown */}
        <div className="p-5 rounded-2xl bg-[#0E1626] border border-[#1E2C4A] space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center justify-between">
            <span>Lead Source Channels</span>
            <span className="text-xs text-slate-500">Acquisition</span>
          </h3>

          <div className="space-y-3">
            {Object.keys(sourceCounts).length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No leads recorded yet.</p>
            ) : (
              Object.entries(sourceCounts).map(([src, count]) => {
                const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
                return (
                  <div key={src} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">{src}</span>
                      <span className="text-purple-400 font-mono font-semibold">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#080B11] rounded-full h-2 overflow-hidden border border-[#1E2C4A]">
                      <div
                        className="bg-gradient-to-r from-purple-600 to-cyan-400 h-2 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Outreach Action Volumes */}
      <div className="p-5 rounded-2xl bg-[#0E1626] border border-[#1E2C4A]">
        <h3 className="text-sm font-bold text-white mb-4">Outreach Activity Volume</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#080B11] border border-[#1E2C4A] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-950/60 border border-blue-800 text-blue-400 flex items-center justify-center">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400">Total Calls Logged</span>
              <div className="text-xl font-bold text-white">{totalCalls}</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#080B11] border border-[#1E2C4A] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-400 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400">WhatsApp Actions</span>
              <div className="text-xl font-bold text-white">{totalWhatsApps}</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#080B11] border border-[#1E2C4A] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-800 text-cyan-400 flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400">Emails Sent</span>
              <div className="text-xl font-bold text-white">{totalEmails}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
