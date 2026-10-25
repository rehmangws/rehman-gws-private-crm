import React from 'react';
import { Lead, FollowUp, Activity, DailyTargets } from '../../types/crm';
import { evaluateLeadPriorityAndNextAction } from '../../utils/priorityEngine';
import {
  Users,
  Target,
  Clock,
  AlertTriangle,
  Flame,
  ThumbsUp,
  Trophy,
  Play,
  ArrowRight,
  Phone,
  MessageSquare,
  Mail,
  MapPin,
  Calendar,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

interface CommandCenterProps {
  leads: Lead[];
  followUps: FollowUp[];
  activities: Activity[];
  dailyTargets: DailyTargets;
  onStartMyDay: () => void;
  onSelectLead: (lead: Lead) => void;
  onNavigateToTab: (tab: any) => void;
  todayStats: {
    completedToday: number;
    callsToday: number;
    whatsAppsToday: number;
    emailsToday: number;
    followUpsCompletedToday: number;
    uniqueLeadsContactedToday: number;
    target: number;
  };
}

export const CommandCenter: React.FC<CommandCenterProps> = ({
  leads,
  followUps,
  activities,
  dailyTargets,
  onStartMyDay,
  onSelectLead,
  onNavigateToTab,
  todayStats,
}) => {
  // Dynamic Greeting based on current hour
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12
      ? 'Good Morning'
      : currentHour < 17
      ? 'Good Afternoon'
      : 'Good Evening';

  // Real KPIs (zero fabricated)
  const totalLeadsCount = leads.length;
  const newLeadsCount = leads.filter((l) => l.status === 'New').length;
  const hotLeadsCount = leads.filter((l) => l.isHot || l.status === 'Hot Lead').length;
  const interestedCount = leads.filter((l) => l.status === 'Interested').length;
  const wonClientsCount = leads.filter((l) => l.status === 'Won / Client').length;

  const todayStr = new Date().toDateString();
  const nowTime = new Date().getTime();

  // Pending follow-ups today vs overdue
  const pendingFollowUps = followUps.filter((f) => f.status === 'pending');
  const followUpsToday = pendingFollowUps.filter(
    (f) => new Date(f.dateTime).toDateString() === todayStr
  );
  const overdueFollowUps = pendingFollowUps.filter(
    (f) => new Date(f.dateTime).getTime() < nowTime && new Date(f.dateTime).toDateString() !== todayStr
  );

  // Target progress
  const targetNumber = dailyTargets.dailyContactTarget || 50;
  const completedNumber = todayStats.completedToday;
  const remainingNumber = Math.max(0, targetNumber - completedNumber);
  const progressPercent = Math.min(100, Math.round((completedNumber / targetNumber) * 100));

  // Build Priority Queue using deterministic engine
  const queueItems = leads
    .filter((l) => l.status !== 'Won / Client' && l.status !== 'Do Not Contact')
    .map((lead) => {
      const evaluation = evaluateLeadPriorityAndNextAction(lead, undefined, followUps);
      return {
        lead,
        evaluation,
      };
    })
    .sort((a, b) => {
      const priorityWeights: Record<string, number> = {
        Urgent: 4,
        High: 3,
        Medium: 2,
        Normal: 1,
        Low: 0,
      };
      return priorityWeights[b.evaluation.priority] - priorityWeights[a.evaluation.priority];
    })
    .slice(0, 8); // Top priority leads for today's queue

  return (
    <div className="space-y-6">
      {/* Hero Welcome & Start My Day Banner */}
      <div className="relative rounded-2xl bg-gradient-to-r from-[#0E1626] via-[#111C33] to-[#0E1626] border border-[#1E2C4A] p-6 lg:p-8 overflow-hidden shadow-xl">
        <div className="absolute right-0 top-0 w-96 h-full bg-gradient-to-l from-blue-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs uppercase font-bold tracking-widest text-cyan-400">
                Command Center &bull; Live Operations
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {greeting}, Rehman GWS Admin
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-xl">
              Here’s what needs your attention today. Work the highest-priority lead, record the action,
              and let the CRM automatically organize the next steps.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto shrink-0">
            <button
              onClick={onStartMyDay}
              className="py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-sm shadow-xl shadow-cyan-500/20 flex items-center justify-center gap-3 transition-all cursor-pointer active:scale-95 group"
            >
              <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Play className="w-3.5 h-3.5 fill-white" />
              </div>
              <span>START MY DAY</span>
            </button>

            <button
              onClick={() => onNavigateToTab('business-map')}
              className="py-3.5 px-4 rounded-xl bg-[#080B11] hover:bg-[#131E33] border border-[#1E2C4A] text-slate-200 text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <MapPin className="w-4 h-4 text-cyan-400" />
              <span>Lead Finder</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Leads */}
        <div
          onClick={() => onNavigateToTab('leads')}
          className="p-4 rounded-xl bg-[#0E1626] border border-[#1E2C4A] hover:border-blue-500/40 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Total Leads</span>
            <Users className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors" />
          </div>
          <div className="text-2xl font-black text-white">{totalLeadsCount}</div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-blue-400 font-semibold">{newLeadsCount}</span> new leads in pipeline
          </div>
        </div>

        {/* Daily Contact Target */}
        <div className="p-4 rounded-xl bg-[#0E1626] border border-[#1E2C4A] hover:border-cyan-500/40 transition-all shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Today's Target</span>
            <Target className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{completedNumber}</span>
            <span className="text-xs font-medium text-slate-400">/ {targetNumber}</span>
            <span className="text-xs font-bold text-cyan-400 ml-auto">{progressPercent}%</span>
          </div>
          <div className="w-full bg-[#131E33] rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-cyan-400 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            {remainingNumber > 0 ? `${remainingNumber} remaining today` : 'Daily target achieved!'}
          </div>
        </div>

        {/* Follow-ups Today */}
        <div
          onClick={() => onNavigateToTab('follow-ups')}
          className="p-4 rounded-xl bg-[#0E1626] border border-[#1E2C4A] hover:border-amber-500/40 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Follow-ups Today</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">{followUpsToday.length}</div>
          <div className="text-[11px] text-amber-400/90 mt-1 flex items-center gap-1">
            <span>{followUpsToday.length > 0 ? 'Action required today' : 'All caught up'}</span>
          </div>
        </div>

        {/* Overdue Follow-ups */}
        <div
          onClick={() => onNavigateToTab('follow-ups')}
          className={`p-4 rounded-xl bg-[#0E1626] border transition-all cursor-pointer group shadow-sm ${
            overdueFollowUps.length > 0
              ? 'border-red-500/50 bg-red-950/10'
              : 'border-[#1E2C4A] hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Overdue</span>
            <AlertTriangle
              className={`w-4 h-4 ${
                overdueFollowUps.length > 0 ? 'text-red-400 animate-bounce' : 'text-slate-500'
              }`}
            />
          </div>
          <div
            className={`text-2xl font-black ${
              overdueFollowUps.length > 0 ? 'text-red-400' : 'text-slate-300'
            }`}
          >
            {overdueFollowUps.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {overdueFollowUps.length > 0 ? 'Immediate action required' : 'Zero overdue items'}
          </div>
        </div>

        {/* Hot Leads */}
        <div
          onClick={() => onNavigateToTab('leads')}
          className="p-4 rounded-xl bg-[#0E1626] border border-[#1E2C4A] hover:border-amber-500/40 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Hot Leads</span>
            <Flame className="w-4 h-4 text-orange-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-orange-400">{hotLeadsCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {interestedCount} marked Interested
          </div>
        </div>
      </div>

      {/* Main Grid: Priority Queue (Today's Work) + Today's Performance Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Priority Queue */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Today's Priority Work Queue</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Deterministic recommendations based on status, follow-up deadlines, and contact rules.
              </p>
            </div>
            <button
              onClick={() => onNavigateToTab('leads')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold cursor-pointer"
            >
              <span>View All Leads</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {queueItems.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#0E1626] border border-[#1E2C4A] text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">No pending queue items</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                All scheduled outreach is complete, or no leads are currently stored. Add a new lead or
                browse the World Map to build your pipeline.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {queueItems.map(({ lead, evaluation }) => {
                const priorityBadge =
                  evaluation.priority === 'Urgent'
                    ? 'bg-red-500/20 text-red-400 border-red-500/40'
                    : evaluation.priority === 'High'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : evaluation.priority === 'Medium'
                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                    : 'bg-slate-700/30 text-slate-300 border-slate-600/40';

                return (
                  <div
                    key={lead.id}
                    className="p-4 rounded-xl bg-[#0E1626] border border-[#1E2C4A] hover:border-cyan-500/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${priorityBadge}`}
                        >
                          {evaluation.priority} Priority
                        </span>
                        <span className="text-xs text-slate-400">&bull; {lead.categoryName}</span>
                        {lead.city && (
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-500" />
                            {lead.city}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                        {lead.businessName}
                      </h4>

                      {/* Recommended Action + Why Reason */}
                      <div className="mt-2 text-xs bg-[#080B11]/70 p-2 rounded-lg border border-[#1E2C4A]/80">
                        <div className="font-semibold text-cyan-400 flex items-center gap-1.5">
                          {evaluation.actionType === 'WhatsApp' && <MessageSquare className="w-3.5 h-3.5" />}
                          {evaluation.actionType === 'Call' && <Phone className="w-3.5 h-3.5" />}
                          {evaluation.actionType === 'Email' && <Mail className="w-3.5 h-3.5" />}
                          {evaluation.actionType === 'Meeting' && <Calendar className="w-3.5 h-3.5" />}
                          <span>Next: {evaluation.recommendedAction}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-2">
                          <span className="font-medium text-slate-500">Why?</span>
                          {evaluation.reasons.map((r, i) => (
                            <span key={i} className="text-slate-300">
                              &bull; {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                      <button
                        onClick={() => onSelectLead(lead)}
                        className="flex-1 sm:flex-initial px-3.5 py-2 rounded-lg bg-[#131E33] hover:bg-cyan-950/40 hover:text-cyan-300 hover:border-cyan-500/40 border border-[#1E2C4A] text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                      >
                        Work Lead
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Col: Today's Performance Breakdown & Targets */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-[#0E1626] border border-[#1E2C4A] shadow-md">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
              <span>Today's Actions Recorded</span>
              <span className="text-xs text-slate-400">Actual Counts</span>
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#080B11] border border-[#1E2C4A]">
                <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                  <Phone className="w-3.5 h-3.5 text-blue-400" />
                  <span>Calls Placed</span>
                </div>
                <span className="text-sm font-bold text-white">{todayStats.callsToday}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#080B11] border border-[#1E2C4A]">
                <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>WhatsApp Outreach</span>
                </div>
                <span className="text-sm font-bold text-white">{todayStats.whatsAppsToday}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#080B11] border border-[#1E2C4A]">
                <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                  <Mail className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Emails Sent</span>
                </div>
                <span className="text-sm font-bold text-white">{todayStats.emailsToday}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#080B11] border border-[#1E2C4A]">
                <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Follow-ups Completed</span>
                </div>
                <span className="text-sm font-bold text-white">
                  {todayStats.followUpsCompletedToday}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#080B11] border border-[#1E2C4A]">
                <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                  <Users className="w-3.5 h-3.5 text-purple-400" />
                  <span>Unique Leads Touched</span>
                </div>
                <span className="text-sm font-bold text-purple-300">
                  {todayStats.uniqueLeadsContactedToday}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="p-5 rounded-2xl bg-[#0E1626] border border-[#1E2C4A]">
            <h3 className="text-sm font-bold text-white mb-3">Quick Navigation</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => onNavigateToTab('leads')}
                className="p-2.5 rounded-xl bg-[#080B11] hover:bg-[#131E33] border border-[#1E2C4A] text-left text-slate-300 font-medium cursor-pointer"
              >
                Lead Database
              </button>
              <button
                onClick={() => onNavigateToTab('business-map')}
                className="p-2.5 rounded-xl bg-[#080B11] hover:bg-[#131E33] border border-[#1E2C4A] text-left text-slate-300 font-medium cursor-pointer"
              >
                Lead Finder
              </button>
              <button
                onClick={() => onNavigateToTab('pipeline')}
                className="p-2.5 rounded-xl bg-[#080B11] hover:bg-[#131E33] border border-[#1E2C4A] text-left text-slate-300 font-medium cursor-pointer"
              >
                Sales Pipeline
              </button>
              <button
                onClick={() => onNavigateToTab('import-export')}
                className="p-2.5 rounded-xl bg-[#080B11] hover:bg-[#131E33] border border-[#1E2C4A] text-left text-slate-300 font-medium cursor-pointer"
              >
                CSV Import
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
