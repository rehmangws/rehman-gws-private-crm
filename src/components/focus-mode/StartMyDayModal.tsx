import React, { useState } from 'react';
import { Lead, FollowUp, FollowUpRules } from '../../types/crm';
import { CRMStorage } from '../../services/crmStorage';
import { evaluateLeadPriorityAndNextAction } from '../../utils/priorityEngine';
import {
  X,
  Phone,
  MessageSquare,
  Mail,
  ExternalLink,
  MapPin,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Flame,
  ThumbsUp,
  ThumbsDown,
  PhoneOff,
  CheckCircle,
  PlusCircle,
  Calendar,
  AlertCircle,
  FileText,
} from 'lucide-react';

interface StartMyDayModalProps {
  leads: Lead[];
  followUps: FollowUp[];
  rules: FollowUpRules;
  onClose: () => void;
  onRefreshData: () => Promise<void>;
}

export const StartMyDayModal: React.FC<StartMyDayModalProps> = ({
  leads,
  followUps,
  rules,
  onClose,
  onRefreshData,
}) => {
  // Filter active workable leads (not Won and not Do Not Contact)
  const workableLeads = leads.filter(
    (l) => l.status !== 'Won / Client' && l.status !== 'Do Not Contact'
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [noteText, setNoteText] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showScheduleFollowUp, setShowScheduleFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [followUpTime, setFollowUpTime] = useState('11:00');
  const [followUpAction, setFollowUpAction] = useState<FollowUp['actionType']>('WhatsApp');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  if (workableLeads.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <div className="w-full max-w-md bg-[#0E1626] border border-[#1E2C4A] rounded-2xl p-6 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white">Focus Mode Complete!</h3>
          <p className="text-xs text-slate-400 mt-2">
            No active leads in need of outreach right now. You can add new leads from the database or world map.
          </p>
          <button
            onClick={onClose}
            className="mt-6 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs cursor-pointer"
          >
            Return to Command Center
          </button>
        </div>
      </div>
    );
  }

  const currentLead = workableLeads[currentIndex] || workableLeads[0];
  const totalCount = workableLeads.length;
  const evaluation = evaluateLeadPriorityAndNextAction(currentLead, rules, followUps);

  const handleNext = () => {
    if (currentIndex < totalCount - 1) {
      setCurrentIndex((prev) => prev + 1);
      setShowNoteInput(false);
      setShowScheduleFollowUp(false);
    } else {
      showToast('You have reviewed all available leads in this session!');
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setShowNoteInput(false);
      setShowScheduleFollowUp(false);
    }
  };

  // Channel Actions
  const handleCall = async () => {
    if (!currentLead.phone) {
      showToast('No phone number recorded for this lead.');
      return;
    }
    window.location.href = `tel:${currentLead.phone}`;
    await CRMStorage.recordActivity({
      id: `act-${Date.now()}`,
      leadId: currentLead.id,
      leadName: currentLead.businessName,
      type: 'call_started',
      timestamp: new Date().toISOString(),
      actorId: 'admin',
      details: `Call launched to ${currentLead.phone}.`,
    });
    showToast(`Call initiated. Choose outcome below to record status.`);
    await onRefreshData();
  };

  const handleWhatsApp = async (confirmedOnly = false) => {
    const rawNumber = currentLead.whatsapp || currentLead.phone;
    if (!rawNumber) {
      showToast('No WhatsApp number available for this lead.');
      return;
    }
    const cleanNumber = rawNumber.replace(/[^\d]/g, '');

    if (!confirmedOnly) {
      // Open WhatsApp Web or app
      const url = `https://wa.me/${cleanNumber}`;
      window.open(url, '_blank');
      await CRMStorage.recordActivity({
        id: `act-${Date.now()}`,
        leadId: currentLead.id,
        leadName: currentLead.businessName,
        type: 'whatsapp_opened',
        timestamp: new Date().toISOString(),
        actorId: 'admin',
        details: `WhatsApp chat window opened for ${rawNumber}.`,
      });
      await CRMStorage.updateLeadStatus(currentLead.id, 'WhatsApp Opened', 'admin', {
        lastContactAt: new Date().toISOString(),
      });
      showToast('WhatsApp opened. Click "Confirm Sent" once delivered.');
    } else {
      await CRMStorage.recordActivity({
        id: `act-${Date.now()}`,
        leadId: currentLead.id,
        leadName: currentLead.businessName,
        type: 'whatsapp_confirmed',
        timestamp: new Date().toISOString(),
        actorId: 'admin',
        details: `WhatsApp message transmission confirmed to ${rawNumber}.`,
      });
      await CRMStorage.updateLeadStatus(currentLead.id, 'WhatsApp Sent/Confirmed', 'admin', {
        lastContactAt: new Date().toISOString(),
      });
      setCompletedCount((prev) => prev + 1);
      showToast('WhatsApp confirmed as sent! Activity logged.');
      handleNext();
    }
    await onRefreshData();
  };

  const handleEmail = async (confirmedOnly = false) => {
    if (!currentLead.email) {
      showToast('No email address recorded for this lead.');
      return;
    }
    if (!confirmedOnly) {
      window.location.href = `mailto:${currentLead.email}?subject=Collaboration%20with%20REHMAN%20GWS`;
      await CRMStorage.recordActivity({
        id: `act-${Date.now()}`,
        leadId: currentLead.id,
        leadName: currentLead.businessName,
        type: 'email_opened',
        timestamp: new Date().toISOString(),
        actorId: 'admin',
        details: `Email client opened for ${currentLead.email}.`,
      });
      await CRMStorage.updateLeadStatus(currentLead.id, 'Email Opened', 'admin', {
        lastContactAt: new Date().toISOString(),
      });
      showToast('Email draft opened. Click "Confirm Sent" after sending.');
    } else {
      await CRMStorage.recordActivity({
        id: `act-${Date.now()}`,
        leadId: currentLead.id,
        leadName: currentLead.businessName,
        type: 'email_confirmed',
        timestamp: new Date().toISOString(),
        actorId: 'admin',
        details: `Email transmission confirmed to ${currentLead.email}.`,
      });
      await CRMStorage.updateLeadStatus(currentLead.id, 'Email Sent/Confirmed', 'admin', {
        lastContactAt: new Date().toISOString(),
      });
      setCompletedCount((prev) => prev + 1);
      showToast('Email confirmed as sent! Activity logged.');
      handleNext();
    }
    await onRefreshData();
  };

  // Outcome Quick Actions
  const handleMarkOutcome = async (
    status: Lead['status'],
    isHot = false,
    autoScheduleDays?: number
  ) => {
    const updates: Partial<Lead> = {
      lastContactAt: new Date().toISOString(),
      isHot: isHot || currentLead.isHot,
    };

    if (autoScheduleDays) {
      const followUpDateObj = new Date(Date.now() + autoScheduleDays * 24 * 60 * 60 * 1000);
      updates.nextFollowUpAt = followUpDateObj.toISOString();
      await CRMStorage.saveFollowUp({
        id: `fu-${Date.now()}`,
        leadId: currentLead.id,
        leadBusinessName: currentLead.businessName,
        leadPhone: currentLead.phone,
        leadWhatsapp: currentLead.whatsapp,
        leadEmail: currentLead.email,
        dateTime: followUpDateObj.toISOString(),
        actionType: currentLead.whatsapp ? 'WhatsApp' : 'Call',
        notes: `Auto-scheduled based on "${status}" outcome (+${autoScheduleDays}d).`,
        priority: isHot ? 'High' : 'Normal',
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    }

    await CRMStorage.updateLeadStatus(currentLead.id, status, 'admin', updates);
    setCompletedCount((prev) => prev + 1);
    showToast(`Updated status to "${status}". Next lead loaded.`);
    await onRefreshData();
    handleNext();
  };

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    await CRMStorage.addNote(currentLead.id, noteText.trim(), 'Admin');
    setNoteText('');
    setShowNoteInput(false);
    showToast('Note added to lead timeline.');
    await onRefreshData();
  };

  const handleScheduleCustomFollowUp = async () => {
    if (!followUpDate) return;
    const isoDateTime = new Date(`${followUpDate}T${followUpTime || '11:00'}:00`).toISOString();
    await CRMStorage.saveFollowUp({
      id: `fu-${Date.now()}`,
      leadId: currentLead.id,
      leadBusinessName: currentLead.businessName,
      leadPhone: currentLead.phone,
      leadWhatsapp: currentLead.whatsapp,
      leadEmail: currentLead.email,
      dateTime: isoDateTime,
      actionType: followUpAction,
      notes: `Scheduled during Focus Mode session.`,
      priority: currentLead.isHot ? 'High' : 'Normal',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    setShowScheduleFollowUp(false);
    showToast(`Follow-up scheduled for ${followUpDate} ${followUpTime}.`);
    await onRefreshData();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-3xl bg-[#0E1626] border border-[#1E2C4A] rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-[#1E2C4A] bg-[#111C33]/50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-blue-500/20 text-cyan-400 border border-blue-500/30">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">START MY DAY</h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Focus Mode
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Lead {currentIndex + 1} of {totalCount} &bull;{' '}
                <span className="text-cyan-400 font-semibold">{completedCount}</span> actions recorded this session
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="p-1.5 rounded-lg border border-[#1E2C4A] text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
              title="Previous Lead"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex === totalCount - 1}
              className="p-1.5 rounded-lg border border-[#1E2C4A] text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
              title="Skip / Next Lead"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg border border-[#1E2C4A] text-slate-400 hover:text-red-400 hover:bg-red-950/30 cursor-pointer ml-2"
              title="End Focus Session"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toast feedback */}
        {toastMessage && (
          <div className="bg-cyan-950/80 border-b border-cyan-800/80 px-4 py-2 text-xs text-cyan-300 flex items-center gap-2 animate-in fade-in">
            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Scrollable Lead Card Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Business & Category Card */}
          <div className="p-5 rounded-xl bg-[#080B11] border border-[#1E2C4A] relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-cyan-400 px-2.5 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-800/50">
                    {currentLead.categoryName}
                  </span>
                  <span className="text-xs font-medium text-slate-400 px-2 py-0.5 rounded bg-[#131E33] border border-[#1E2C4A]">
                    {currentLead.status}
                  </span>
                  {currentLead.isHot && (
                    <span className="text-xs font-bold text-orange-400 px-2 py-0.5 rounded bg-orange-950/50 border border-orange-800/50 flex items-center gap-1">
                      <Flame className="w-3 h-3" />
                      Hot Lead
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-extrabold text-white mt-2 tracking-tight">
                  {currentLead.businessName}
                </h3>
                {currentLead.contactPerson && (
                  <p className="text-xs text-slate-300 mt-1">
                    Contact: <span className="font-semibold">{currentLead.contactPerson}</span>
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                  {currentLead.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      {currentLead.city}, {currentLead.country || 'Global'}
                    </span>
                  )}
                  {currentLead.website && (
                    <a
                      href={currentLead.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Visit Website</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Direct Outreach Buttons */}
              <div className="flex sm:flex-col gap-2 shrink-0">
                {currentLead.phone && (
                  <button
                    onClick={handleCall}
                    className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call ({currentLead.phone})</span>
                  </button>
                )}

                {(currentLead.whatsapp || currentLead.phone) && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleWhatsApp(false)}
                      className="flex-1 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      onClick={() => handleWhatsApp(true)}
                      title="Confirm message was delivered/sent"
                      className="px-2 py-2 rounded-xl bg-emerald-950 border border-emerald-700 text-emerald-300 hover:bg-emerald-900 text-[10px] font-semibold cursor-pointer"
                    >
                      Confirm
                    </button>
                  </div>
                )}

                {currentLead.email && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEmail(false)}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-[#131E33] hover:bg-[#1E2C4A] border border-[#1E2C4A] text-slate-200 text-xs font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Email</span>
                    </button>
                    <button
                      onClick={() => handleEmail(true)}
                      title="Confirm email was sent"
                      className="px-2 py-1.5 rounded-lg bg-[#131E33] border border-cyan-800 text-cyan-300 text-[10px] font-semibold cursor-pointer"
                    >
                      Confirm
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Last Contact & Follow-up Row */}
            <div className="mt-4 pt-3 border-t border-[#1E2C4A]/70 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>
                  Last Contact:{' '}
                  <strong className="text-slate-300 font-medium">
                    {currentLead.lastContactAt
                      ? new Date(currentLead.lastContactAt).toLocaleDateString()
                      : 'Never contacted'}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                <span>
                  Scheduled Follow-up:{' '}
                  <strong className="text-amber-300 font-medium">
                    {currentLead.nextFollowUpAt
                      ? new Date(currentLead.nextFollowUpAt).toLocaleString()
                      : 'None scheduled'}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* NEXT BEST ACTION CARD */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/40 via-[#0E1626] to-[#0E1626] border border-cyan-500/30">
            <div className="flex items-center gap-2 text-xs uppercase font-bold tracking-wider text-cyan-400 mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Next Best Action</span>
            </div>
            <div className="text-base font-bold text-white mt-1">
              {evaluation.recommendedAction}
            </div>
            <div className="mt-2 text-xs text-slate-400 space-y-1">
              <span className="font-semibold text-slate-300">Why recommended?</span>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-400">
                {evaluation.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Quick Outcome Recording Buttons */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              Record Outcome & Progress to Next Lead
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => handleMarkOutcome('Contacted')}
                className="p-2.5 rounded-xl bg-[#080B11] hover:bg-[#131E33] border border-[#1E2C4A] text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5 text-blue-400" />
                <span>Contacted</span>
              </button>

              <button
                onClick={() => handleMarkOutcome('No Answer', false, rules.noAnswerDays)}
                className="p-2.5 rounded-xl bg-[#080B11] hover:bg-[#131E33] border border-[#1E2C4A] text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <PhoneOff className="w-3.5 h-3.5 text-slate-400" />
                <span>No Answer (+{rules.noAnswerDays}d)</span>
              </button>

              <button
                onClick={() => handleMarkOutcome('Interested', false, rules.interestedDays)}
                className="p-2.5 rounded-xl bg-[#080B11] hover:bg-emerald-950/40 border border-emerald-900/60 text-xs font-semibold text-emerald-400 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Interested (+{rules.interestedDays}d)</span>
              </button>

              <button
                onClick={() => handleMarkOutcome('Hot Lead', true, 1)}
                className="p-2.5 rounded-xl bg-[#080B11] hover:bg-orange-950/40 border border-orange-900/60 text-xs font-semibold text-orange-400 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span>Hot Lead (+1d)</span>
              </button>

              <button
                onClick={() => handleMarkOutcome('Not Interested')}
                className="p-2.5 rounded-xl bg-[#080B11] hover:bg-slate-800/60 border border-[#1E2C4A] text-xs font-semibold text-slate-400 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
                <span>Not Interested</span>
              </button>

              <button
                onClick={() => setShowNoteInput(!showNoteInput)}
                className="p-2.5 rounded-xl bg-[#080B11] hover:bg-[#131E33] border border-[#1E2C4A] text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span>Add Note</span>
              </button>

              <button
                onClick={() => setShowScheduleFollowUp(!showScheduleFollowUp)}
                className="p-2.5 rounded-xl bg-[#080B11] hover:bg-[#131E33] border border-[#1E2C4A] text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Schedule Follow-up</span>
              </button>

              <button
                onClick={handleNext}
                className="p-2.5 rounded-xl bg-[#080B11] hover:bg-[#131E33] border border-[#1E2C4A] text-xs font-semibold text-slate-400 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Skip</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Conditional Note Drawer */}
          {showNoteInput && (
            <div className="p-4 rounded-xl bg-[#080B11] border border-[#1E2C4A] space-y-3">
              <label className="block text-xs font-semibold text-white">Add Timestamped Note</label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Spoke with manager, requested rate card via WhatsApp..."
                rows={3}
                className="w-full p-3 bg-[#0E1626] border border-[#1E2C4A] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowNoteInput(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNote}
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Save Note
                </button>
              </div>
            </div>
          )}

          {/* Conditional Follow-up Drawer */}
          {showScheduleFollowUp && (
            <div className="p-4 rounded-xl bg-[#080B11] border border-[#1E2C4A] space-y-3">
              <h4 className="text-xs font-semibold text-white">Schedule Custom Follow-up</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Date</label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full p-2 bg-[#0E1626] border border-[#1E2C4A] rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Time</label>
                  <input
                    type="time"
                    value={followUpTime}
                    onChange={(e) => setFollowUpTime(e.target.value)}
                    className="w-full p-2 bg-[#0E1626] border border-[#1E2C4A] rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Channel</label>
                  <select
                    value={followUpAction}
                    onChange={(e) => setFollowUpAction(e.target.value as any)}
                    className="w-full p-2 bg-[#0E1626] border border-[#1E2C4A] rounded-lg text-xs text-white"
                  >
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Call">Call</option>
                    <option value="Email">Email</option>
                    <option value="Meeting">Meeting</option>
                    <option value="General Follow-up">General</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowScheduleFollowUp(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleScheduleCustomFollowUp}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Confirm Schedule
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Bar */}
        <div className="p-4 border-t border-[#1E2C4A] bg-[#111C33]/50 flex items-center justify-between text-xs text-slate-400">
          <span>
            Progress: <strong className="text-white">{currentIndex + 1}</strong> / {totalCount}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              End Session
            </button>
            <button
              onClick={handleNext}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold cursor-pointer flex items-center gap-1.5"
            >
              <span>Next Lead</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
