import React, { useState } from 'react';
import { FollowUp, Lead } from '../../types/crm';
import { CRMStorage } from '../../services/crmStorage';
import {
  Clock,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Phone,
  MessageSquare,
  Mail,
  Plus,
  X,
} from 'lucide-react';

interface TasksViewProps {
  followUps: FollowUp[];
  leads: Lead[];
  onOpenLeadProfile: (lead: Lead) => void;
  onRefreshData: () => Promise<void>;
}

export const TasksView: React.FC<TasksViewProps> = ({
  followUps,
  leads,
  onOpenLeadProfile,
  onRefreshData,
}) => {
  const [timeView, setTimeView] = useState<
    'today' | 'tomorrow' | 'this-week' | 'overdue' | 'completed' | 'all'
  >('today');

  const now = new Date();
  const todayStr = now.toDateString();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrow.toDateString();
  const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const filteredTasks = followUps.filter((task) => {
    const taskDate = new Date(task.dateTime);
    const isPast = taskDate.getTime() < now.getTime() && taskDate.toDateString() !== todayStr;
    const isCompleted = task.status === 'completed';

    if (timeView === 'completed') return isCompleted;
    if (isCompleted) return false;

    if (timeView === 'overdue') return isPast;
    if (timeView === 'today') return taskDate.toDateString() === todayStr;
    if (timeView === 'tomorrow') return taskDate.toDateString() === tomorrowStr;
    if (timeView === 'this-week') return taskDate <= endOfWeek && !isPast;
    return true;
  });

  const handleComplete = async (taskId: string) => {
    await CRMStorage.completeFollowUp(taskId, 'admin');
    await onRefreshData();
  };

  const overdueCount = followUps.filter(
    (f) =>
      f.status === 'pending' &&
      new Date(f.dateTime).getTime() < now.getTime() &&
      new Date(f.dateTime).toDateString() !== todayStr
  ).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0E1626] border border-[#1E2C4A] p-4 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Follow-up & Task Engine</span>
            {overdueCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 font-mono font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {overdueCount} Overdue
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400">
            Deterministic follow-up schedules. Tasks are never deleted automatically when passing deadlines.
          </p>
        </div>
      </div>

      {/* Time Bucket Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(
          [
            { id: 'today', label: 'Today' },
            { id: 'tomorrow', label: 'Tomorrow' },
            { id: 'this-week', label: 'This Week' },
            { id: 'overdue', label: `Overdue (${overdueCount})` },
            { id: 'completed', label: 'Completed' },
            { id: 'all', label: 'All Upcoming' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            onClick={() => setTimeView(item.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
              timeView === item.id
                ? item.id === 'overdue'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/50'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                : 'bg-[#0E1626] text-slate-400 hover:text-white border border-[#1E2C4A]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#0E1626] border border-[#1E2C4A]">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">No tasks in this view</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              You are all caught up on follow-up tasks for this time frame.
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const associatedLead = leads.find((l) => l.id === task.leadId);
            const isOverdue =
              task.status === 'pending' && new Date(task.dateTime).getTime() < Date.now();

            return (
              <div
                key={task.id}
                className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
                  task.status === 'completed'
                    ? 'bg-[#080B11]/50 border-emerald-950/40 text-slate-400'
                    : isOverdue
                    ? 'bg-[#0E1626] border-red-500/40 shadow-sm shadow-red-950/20'
                    : 'bg-[#0E1626] border-[#1E2C4A]'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        task.status === 'completed'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : isOverdue
                          ? 'bg-red-950 text-red-300 border border-red-800'
                          : 'bg-blue-950 text-blue-300 border border-blue-800'
                      }`}
                    >
                      {task.status === 'completed'
                        ? 'Done'
                        : isOverdue
                        ? 'Overdue'
                        : task.actionType}
                    </span>

                    <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {new Date(task.dateTime).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <h4
                    onClick={() => associatedLead && onOpenLeadProfile(associatedLead)}
                    className="text-sm font-bold text-white hover:text-cyan-300 cursor-pointer transition-colors"
                  >
                    {task.leadBusinessName}
                  </h4>

                  {task.notes && (
                    <p className="text-xs text-slate-300 mt-1 italic">"{task.notes}"</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                  {associatedLead?.phone && (
                    <a
                      href={`tel:${associatedLead.phone}`}
                      className="p-2 rounded-lg bg-[#080B11] border border-[#1E2C4A] text-blue-400 hover:bg-blue-600 hover:text-white transition-colors"
                      title="Call"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  )}

                  {(associatedLead?.whatsapp || associatedLead?.phone) && (
                    <a
                      href={`https://wa.me/${(
                        associatedLead.whatsapp || associatedLead.phone
                      )?.replace(/[^\d]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-lg bg-[#080B11] border border-[#1E2C4A] text-emerald-400 hover:bg-emerald-600 hover:text-white transition-colors"
                      title="WhatsApp"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </a>
                  )}

                  {task.status !== 'completed' && (
                    <button
                      onClick={() => handleComplete(task.id)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Complete</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
