import React from 'react';
import { CRMNotification, Lead } from '../../types/crm';
import { CRMStorage } from '../../services/crmStorage';
import { Bell, X, Check, Clock, AlertTriangle, Sparkles, CheckCircle } from 'lucide-react';

interface NotificationDrawerProps {
  notifications: CRMNotification[];
  leads: Lead[];
  isOpen: boolean;
  onClose: () => void;
  onSelectLead: (lead: Lead) => void;
  onRefreshData: () => Promise<void>;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  notifications,
  leads,
  isOpen,
  onClose,
  onSelectLead,
  onRefreshData,
}) => {
  if (!isOpen) return null;

  const handleMarkAllRead = async () => {
    CRMStorage.markAllNotificationsRead();
    await onRefreshData();
  };

  const handleMarkOneRead = async (id: string) => {
    CRMStorage.markNotificationRead(id);
    await onRefreshData();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex justify-end">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#0E1626] border-l border-[#1E2C4A] h-full flex flex-col z-10 shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-[#1E2C4A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Notifications</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllRead}
              className="text-[11px] text-cyan-400 hover:underline font-semibold cursor-pointer"
            >
              Mark all read
            </button>
            <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No new alerts. You're all caught up!
            </div>
          ) : (
            notifications.map((n) => {
              const matchedLead = n.leadId ? leads.find((l) => l.id === n.leadId) : undefined;

              return (
                <div
                  key={n.id}
                  onClick={() => {
                    handleMarkOneRead(n.id);
                    if (matchedLead) {
                      onSelectLead(matchedLead);
                      onClose();
                    }
                  }}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                    n.read
                      ? 'bg-[#080B11]/50 border-[#1E2C4A] text-slate-400'
                      : 'bg-[#131E33] border-cyan-500/40 text-slate-200 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      {n.type === 'overdue' && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                      {n.type === 'followup_due' && <Clock className="w-3.5 h-3.5 text-amber-400" />}
                      {n.type === 'milestone' && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                      <span>{n.title}</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">{n.message}</p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
