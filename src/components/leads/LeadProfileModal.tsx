import React, { useState, useEffect } from 'react';
import { Lead, Activity, FollowUp, Note, Category } from '../../types/crm';
import { CRMStorage } from '../../services/crmStorage';
import { evaluateLeadPriorityAndNextAction } from '../../utils/priorityEngine';
import { ALL_LEAD_STATUSES } from '../../constants/seedData';
import {
  X,
  Phone,
  MessageSquare,
  Mail,
  Globe,
  MapPin,
  Clock,
  Calendar,
  Sparkles,
  FileText,
  Activity as ActivityIcon,
  Flame,
  Edit,
  Trash2,
  CheckCircle,
  Plus,
  Send,
} from 'lucide-react';

interface LeadProfileModalProps {
  lead: Lead;
  categories: Category[];
  followUps: FollowUp[];
  onClose: () => void;
  onEditLead: (lead: Lead) => void;
  onLeadUpdated: () => Promise<void>;
}

export const LeadProfileModal: React.FC<LeadProfileModalProps> = ({
  lead,
  categories,
  followUps,
  onClose,
  onEditLead,
  onLeadUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'notes' | 'followups'>(
    'overview'
  );
  const [activities, setActivities] = useState<Activity[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [statusDraft, setStatusDraft] = useState<Lead['status']>(lead.status);

  // Quick Follow-up Form
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [fuDate, setFuDate] = useState(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [fuTime, setFuTime] = useState('11:00');
  const [fuAction, setFuAction] = useState<FollowUp['actionType']>('WhatsApp');
  const [fuNotes, setFuNotes] = useState('');

  const evaluation = evaluateLeadPriorityAndNextAction(lead, undefined, followUps);

  const fetchLeadData = async () => {
    const [actList, noteList] = await Promise.all([
      CRMStorage.getActivities(lead.id, 50),
      CRMStorage.getNotes(lead.id),
    ]);
    setActivities(actList);
    setNotes(noteList);
  };

  useEffect(() => {
    fetchLeadData();
  }, [lead.id]);

  const handleStatusChange = async (newStatus: Lead['status']) => {
    setStatusDraft(newStatus);
    await CRMStorage.updateLeadStatus(lead.id, newStatus, 'admin');
    await onLeadUpdated();
    await fetchLeadData();
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    setIsSubmittingNote(true);
    await CRMStorage.addNote(lead.id, newNoteText.trim(), 'Admin');
    setNewNoteText('');
    setIsSubmittingNote(false);
    await fetchLeadData();
    await onLeadUpdated();
  };

  const handleCreateFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fuDate) return;
    const isoDateTime = new Date(`${fuDate}T${fuTime || '11:00'}:00`).toISOString();
    await CRMStorage.saveFollowUp({
      id: `fu-${Date.now()}`,
      leadId: lead.id,
      leadBusinessName: lead.businessName,
      leadPhone: lead.phone,
      leadWhatsapp: lead.whatsapp,
      leadEmail: lead.email,
      dateTime: isoDateTime,
      actionType: fuAction,
      notes: fuNotes || 'Scheduled from Lead Profile',
      priority: lead.priority,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    setShowFollowUpForm(false);
    setFuNotes('');
    await fetchLeadData();
    await onLeadUpdated();
  };

  const handleArchive = async () => {
    if (confirm(`Are you sure you want to archive lead "${lead.businessName}"?`)) {
      await CRMStorage.archiveLead(lead.id, 'admin');
      await onLeadUpdated();
      onClose();
    }
  };

  const leadFollowUps = followUps.filter((f) => f.leadId === lead.id);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-4xl bg-[#0E1626] border border-[#1E2C4A] rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header Bar */}
        <div className="p-4 sm:p-6 border-b border-[#1E2C4A] bg-[#111C33]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-xs font-bold text-cyan-400 px-2.5 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-800">
                {lead.categoryName}
              </span>
              <span className="text-xs text-slate-400 px-2 py-0.5 rounded bg-[#131E33] border border-[#1E2C4A]">
                Source: {lead.source}
              </span>
              {lead.isHot && (
                <span className="text-xs font-bold text-orange-400 px-2 py-0.5 rounded bg-orange-950/60 border border-orange-800 flex items-center gap-1">
                  <Flame className="w-3 h-3" />
                  Hot Lead
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              {lead.businessName}
            </h2>

            {lead.contactPerson && (
              <p className="text-xs text-slate-300 mt-1">
                Contact: <strong className="text-white">{lead.contactPerson}</strong>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Status Selector */}
            <select
              value={statusDraft}
              onChange={(e) => handleStatusChange(e.target.value as any)}
              className="px-3 py-1.5 bg-[#080B11] border border-cyan-500/40 rounded-xl text-xs text-cyan-300 font-semibold focus:outline-none"
            >
              {ALL_LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <button
              onClick={() => onEditLead(lead)}
              className="p-2 rounded-xl bg-[#131E33] border border-[#1E2C4A] text-slate-300 hover:text-white hover:border-slate-500 cursor-pointer"
              title="Edit Lead"
            >
              <Edit className="w-4 h-4" />
            </button>

            <button
              onClick={handleArchive}
              className="p-2 rounded-xl bg-[#131E33] border border-[#1E2C4A] text-slate-400 hover:text-red-400 hover:border-red-900 cursor-pointer"
              title="Archive Lead"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-[#131E33] border border-[#1E2C4A] text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Shortcut Bar */}
        <div className="p-3 bg-[#080B11] border-b border-[#1E2C4A] flex items-center gap-2 overflow-x-auto text-xs">
          {lead.phone && (
            <a
              href={`tel:${lead.phone}`}
              className="px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/30 font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call ({lead.phone})</span>
            </a>
          )}

          {(lead.whatsapp || lead.phone) && (
            <a
              href={`https://wa.me/${(lead.whatsapp || lead.phone)?.replace(/[^\d]/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
          )}

          {lead.email && (
            <a
              href={`mailto:${lead.email}`}
              className="px-3 py-1.5 rounded-lg bg-[#131E33] text-cyan-300 hover:bg-cyan-950/40 border border-cyan-800/40 font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email ({lead.email})</span>
            </a>
          )}

          {lead.website && (
            <a
              href={lead.website}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-[#131E33] text-slate-300 hover:text-white border border-[#1E2C4A] font-medium flex items-center gap-1.5 shrink-0"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Website</span>
            </a>
          )}

          <button
            onClick={() => setShowFollowUpForm(!showFollowUpForm)}
            className="px-3 py-1.5 rounded-lg bg-amber-600/20 text-amber-400 hover:bg-amber-600 hover:text-white border border-amber-500/30 font-semibold flex items-center gap-1.5 shrink-0 ml-auto cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>+ Follow-up</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#1E2C4A] bg-[#0E1626] px-4 sm:px-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Overview & Details
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'timeline'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <ActivityIcon className="w-3.5 h-3.5" />
            <span>Activity Audit ({activities.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'notes'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Notes ({notes.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('followups')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'followups'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Follow-ups ({leadFollowUps.length})</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Follow-up Quick Drawer if toggled */}
          {showFollowUpForm && (
            <form
              onSubmit={handleCreateFollowUp}
              className="p-4 rounded-xl bg-[#080B11] border border-amber-500/40 space-y-3"
            >
              <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>Schedule Lead Follow-up</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={fuDate}
                    onChange={(e) => setFuDate(e.target.value)}
                    className="w-full p-2 bg-[#0E1626] border border-[#1E2C4A] rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Time</label>
                  <input
                    type="time"
                    value={fuTime}
                    onChange={(e) => setFuTime(e.target.value)}
                    className="w-full p-2 bg-[#0E1626] border border-[#1E2C4A] rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Action Type</label>
                  <select
                    value={fuAction}
                    onChange={(e) => setFuAction(e.target.value as any)}
                    className="w-full p-2 bg-[#0E1626] border border-[#1E2C4A] rounded-lg text-xs text-white"
                  >
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Call">Call</option>
                    <option value="Email">Email</option>
                    <option value="Meeting">Meeting</option>
                    <option value="General Follow-up">General Follow-up</option>
                  </select>
                </div>
              </div>
              <input
                type="text"
                value={fuNotes}
                onChange={(e) => setFuNotes(e.target.value)}
                placeholder="Follow-up objective / notes..."
                className="w-full p-2 bg-[#0E1626] border border-[#1E2C4A] rounded-lg text-xs text-white placeholder-slate-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFollowUpForm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs cursor-pointer"
                >
                  Confirm Follow-up
                </button>
              </div>
            </form>
          )}

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Next Best Action Card */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/40 via-[#0E1626] to-[#0E1626] border border-cyan-500/40">
                <div className="flex items-center gap-2 text-xs uppercase font-bold tracking-wider text-cyan-400 mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Next Recommended Action</span>
                </div>
                <div className="text-base font-bold text-white mt-1">
                  {evaluation.recommendedAction}
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Determinant Factors: </span>
                  {evaluation.reasons.join(' &bull; ')}
                </div>
              </div>

              {/* Contact Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#080B11] border border-[#1E2C4A] space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Contact & Communication
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">Phone:</span>
                      <span className="font-medium">{lead.phone || 'Not Available'}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">WhatsApp:</span>
                      <span className="font-medium text-emerald-400">
                        {lead.whatsapp || lead.phone || 'Not Available'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">Email:</span>
                      <span className="font-medium">{lead.email || 'Not Available'}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">Website:</span>
                      <span className="font-medium truncate max-w-[200px]">
                        {lead.website || 'Not Available'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#080B11] border border-[#1E2C4A] space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Location & Metadata
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">Address:</span>
                      <span className="font-medium text-right max-w-[220px]">
                        {lead.address || 'Not Available'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">City / Country:</span>
                      <span className="font-medium">
                        {lead.city || 'Global'}, {lead.country || 'Global'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">Coordinates:</span>
                      <span className="font-mono text-cyan-400">
                        {lead.latitude && lead.longitude
                          ? `${lead.latitude.toFixed(4)}, ${lead.longitude.toFixed(4)}`
                          : 'Not Placed'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">Created:</span>
                      <span className="font-medium">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tags and Notes Preview */}
              {lead.tags && lead.tags.length > 0 && (
                <div className="p-4 rounded-xl bg-[#080B11] border border-[#1E2C4A]">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Tags</h4>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {lead.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-md bg-[#131E33] border border-[#1E2C4A] text-xs text-cyan-300"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TIMELINE TAB */}
          {activeTab === 'timeline' && (
            <div className="space-y-3">
              {activities.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No activity recorded for this lead yet.
                </div>
              ) : (
                activities.map((act) => (
                  <div
                    key={act.id}
                    className="p-3.5 rounded-xl bg-[#080B11] border border-[#1E2C4A] flex items-start gap-3"
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-950/60 border border-blue-800 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                      <ActivityIcon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white capitalize">
                          {act.type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(act.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{act.details}</p>
                      {act.actorId && (
                        <p className="text-[10px] text-slate-500 mt-0.5">Actor: {act.actorId}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* NOTES TAB */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <form onSubmit={handleAddNote} className="space-y-2">
                <textarea
                  required
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Record call discussion, business needs, pricing quotes, key contacts..."
                  rows={3}
                  className="w-full p-3 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmittingNote}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmittingNote ? 'Adding...' : 'Post Note'}</span>
                  </button>
                </div>
              </form>

              <div className="space-y-2.5">
                {notes.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No notes added yet.</p>
                ) : (
                  notes.map((note) => (
                    <div
                      key={note.id}
                      className="p-3.5 rounded-xl bg-[#080B11] border border-[#1E2C4A] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-semibold text-cyan-300">{note.author}</span>
                        <span>{new Date(note.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-200 whitespace-pre-wrap">{note.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* FOLLOW-UPS TAB */}
          {activeTab === 'followups' && (
            <div className="space-y-3">
              {leadFollowUps.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No follow-ups recorded. Click "+ Follow-up" above to schedule one.
                </div>
              ) : (
                leadFollowUps.map((fu) => {
                  const isPast = new Date(fu.dateTime).getTime() < Date.now();
                  const isDone = fu.status === 'completed';
                  return (
                    <div
                      key={fu.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                        isDone
                          ? 'bg-[#080B11]/50 border-emerald-900/40 text-slate-400'
                          : isPast
                          ? 'bg-red-950/20 border-red-900/60 text-red-200'
                          : 'bg-[#080B11] border-[#1E2C4A] text-slate-200'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{fu.actionType}</span>
                          <span
                            className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                              isDone
                                ? 'bg-emerald-950 text-emerald-400'
                                : isPast
                                ? 'bg-red-900 text-red-300'
                                : 'bg-blue-950 text-blue-300'
                            }`}
                          >
                            {isDone ? 'Completed' : isPast ? 'Overdue' : 'Scheduled'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">{fu.notes}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                          {new Date(fu.dateTime).toLocaleString()}
                        </p>
                      </div>

                      {!isDone && (
                        <button
                          onClick={async () => {
                            await CRMStorage.completeFollowUp(fu.id, 'admin');
                            await onLeadUpdated();
                            await fetchLeadData();
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0 cursor-pointer"
                        >
                          Mark Done
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
