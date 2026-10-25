import {
  Lead,
  Activity,
  FollowUp,
  Category,
  Note,
  DailyTargets,
  FollowUpRules,
  CRMNotification,
  AutomationSettings,
  AutomationRun,
} from '../types/crm';
import {
  SEED_CATEGORIES,
  DEFAULT_DAILY_TARGETS,
  DEFAULT_FOLLOW_UP_RULES,
} from '../constants/seedData';
import { db, isFirebaseConfigured } from './firebaseConfig';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
} from 'firebase/firestore';

const LOCAL_STORAGE_KEYS = {
  LEADS: 'rehman_gws_leads',
  ACTIVITIES: 'rehman_gws_activities',
  FOLLOW_UPS: 'rehman_gws_followups',
  CATEGORIES: 'rehman_gws_categories',
  NOTES: 'rehman_gws_notes',
  DAILY_TARGETS: 'rehman_gws_daily_targets',
  FOLLOW_UP_RULES: 'rehman_gws_follow_up_rules',
  NOTIFICATIONS: 'rehman_gws_notifications',
  AUTOMATION_SETTINGS: 'rehman_gws_automation_settings',
  AUTOMATION_RUNS: 'rehman_gws_automation_runs',
};

// Helper for local storage read/write
function readLocal<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Error reading ${key} from storage:`, e);
    return defaultValue;
  }
}

function writeLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error writing ${key} to storage:`, e);
  }
}

// Ensure initial seed categories exist locally
function initStorage() {
  const existingCats = readLocal<Category[]>(LOCAL_STORAGE_KEYS.CATEGORIES, []);
  if (existingCats.length === 0) {
    writeLocal(LOCAL_STORAGE_KEYS.CATEGORIES, SEED_CATEGORIES);
  }
  const existingTargets = readLocal<DailyTargets | null>(LOCAL_STORAGE_KEYS.DAILY_TARGETS, null);
  if (!existingTargets) {
    writeLocal(LOCAL_STORAGE_KEYS.DAILY_TARGETS, DEFAULT_DAILY_TARGETS);
  }
  const existingRules = readLocal<FollowUpRules | null>(LOCAL_STORAGE_KEYS.FOLLOW_UP_RULES, null);
  if (!existingRules) {
    writeLocal(LOCAL_STORAGE_KEYS.FOLLOW_UP_RULES, DEFAULT_FOLLOW_UP_RULES);
  }
}
initStorage();

export const CRMStorage = {
  // --- LEADS ---
  async getLeads(includeArchived = false): Promise<Lead[]> {
    if (isFirebaseConfigured && db) {
      try {
        const leadsCol = collection(db, 'leads');
        const q = includeArchived
          ? query(leadsCol, orderBy('createdAt', 'desc'))
          : query(leadsCol, where('archivedAt', '==', null));
        const snap = await getDocs(q);
        return snap.docs.map((d) => d.data() as Lead);
      } catch (err) {
        console.warn('Firestore fetch failed, falling back to local storage', err);
      }
    }
    const all = readLocal<Lead[]>(LOCAL_STORAGE_KEYS.LEADS, []);
    return includeArchived ? all : all.filter((l) => !l.archivedAt);
  },

  async getLeadById(id: string): Promise<Lead | null> {
    if (isFirebaseConfigured && db) {
      try {
        const d = await getDoc(doc(db, 'leads', id));
        if (d.exists()) return d.data() as Lead;
      } catch (err) {
        console.warn('Firestore getLeadById failed, trying local', err);
      }
    }
    const all = readLocal<Lead[]>(LOCAL_STORAGE_KEYS.LEADS, []);
    return all.find((l) => l.id === id) || null;
  },

  async saveLead(lead: Lead, actorId = 'admin'): Promise<void> {
    const isNew = !lead.id || !(await this.getLeadById(lead.id));
    const now = new Date().toISOString();
    const finalLead: Lead = {
      ...lead,
      id: lead.id || `lead-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: lead.createdAt || now,
      updatedAt: now,
      createdBy: lead.createdBy || actorId,
      updatedBy: actorId,
    };

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'leads', finalLead.id), finalLead);
      } catch (err) {
        console.error('Failed to save lead to Firestore', err);
        throw err;
      }
    }

    // Always mirror to local storage for instant responsiveness & offline resilience
    const all = readLocal<Lead[]>(LOCAL_STORAGE_KEYS.LEADS, []);
    const idx = all.findIndex((l) => l.id === finalLead.id);
    if (idx >= 0) {
      all[idx] = finalLead;
    } else {
      all.unshift(finalLead);
    }
    writeLocal(LOCAL_STORAGE_KEYS.LEADS, all);

    // Record activity audit trail
    await this.recordActivity({
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      leadId: finalLead.id,
      leadName: finalLead.businessName,
      type: isNew ? 'lead_created' : 'lead_updated',
      timestamp: now,
      actorId,
      metadata: { source: finalLead.source, status: finalLead.status },
      details: isNew
        ? `Lead "${finalLead.businessName}" created via ${finalLead.source}.`
        : `Lead "${finalLead.businessName}" details updated.`,
    });
  },

  async updateLeadStatus(
    leadId: string,
    newStatus: Lead['status'],
    actorId = 'admin',
    additionalUpdates?: Partial<Lead>
  ): Promise<void> {
    const lead = await this.getLeadById(leadId);
    if (!lead) return;

    const previousStatus = lead.status;
    const now = new Date().toISOString();
    const isWon = newStatus === 'Won / Client';
    const isLost = newStatus === 'Lost';

    const updatedLead: Lead = {
      ...lead,
      ...additionalUpdates,
      status: newStatus,
      updatedAt: now,
      updatedBy: actorId,
      wonAt: isWon ? now : lead.wonAt,
      lostAt: isLost ? now : lead.lostAt,
    };

    await this.saveLead(updatedLead, actorId);

    // Log status changed activity
    await this.recordActivity({
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      leadId,
      leadName: lead.businessName,
      type: isWon ? 'lead_won' : isLost ? 'lead_lost' : 'status_changed',
      timestamp: now,
      actorId,
      previousValue: previousStatus,
      newValue: newStatus,
      details: `Status changed from "${previousStatus}" to "${newStatus}".`,
    });
  },

  async archiveLead(id: string, actorId = 'admin'): Promise<void> {
    const lead = await this.getLeadById(id);
    if (!lead) return;
    const now = new Date().toISOString();
    lead.archivedAt = now;
    lead.updatedAt = now;
    lead.updatedBy = actorId;
    await this.saveLead(lead, actorId);
  },

  async deleteLeadPermanently(id: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        const { deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, 'leads', id));
      } catch (e) {
        console.warn('Firestore delete failed', e);
      }
    }
    const all = readLocal<Lead[]>(LOCAL_STORAGE_KEYS.LEADS, []);
    writeLocal(LOCAL_STORAGE_KEYS.LEADS, all.filter((l) => l.id !== id));
  },

  // --- ACTIVITIES ---
  async getActivities(leadId?: string, max = 50): Promise<Activity[]> {
    if (isFirebaseConfigured && db) {
      try {
        const actsCol = collection(db, 'activities');
        const q = leadId
          ? query(actsCol, where('leadId', '==', leadId), orderBy('timestamp', 'desc'), firestoreLimit(max))
          : query(actsCol, orderBy('timestamp', 'desc'), firestoreLimit(max));
        const snap = await getDocs(q);
        return snap.docs.map((d) => d.data() as Activity);
      } catch (err) {
        console.warn('Firestore getActivities failed', err);
      }
    }
    const all = readLocal<Activity[]>(LOCAL_STORAGE_KEYS.ACTIVITIES, []);
    const filtered = leadId ? all.filter((a) => a.leadId === leadId) : all;
    return filtered
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, max);
  },

  async recordActivity(activity: Activity): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'activities', activity.id), activity);
      } catch (err) {
        console.warn('Firestore recordActivity failed', err);
      }
    }
    const all = readLocal<Activity[]>(LOCAL_STORAGE_KEYS.ACTIVITIES, []);
    all.unshift(activity);
    writeLocal(LOCAL_STORAGE_KEYS.ACTIVITIES, all.slice(0, 1000)); // Cap local history
  },

  // --- FOLLOW-UPS ---
  async getFollowUps(): Promise<FollowUp[]> {
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(collection(db, 'followUps'));
        return snap.docs.map((d) => d.data() as FollowUp);
      } catch (err) {
        console.warn('Firestore getFollowUps failed', err);
      }
    }
    return readLocal<FollowUp[]>(LOCAL_STORAGE_KEYS.FOLLOW_UPS, []);
  },

  async saveFollowUp(followUp: FollowUp, actorId = 'admin'): Promise<void> {
    const isNew = !followUp.id;
    const finalFollowUp: FollowUp = {
      ...followUp,
      id: followUp.id || `fu-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: followUp.createdAt || new Date().toISOString(),
    };

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'followUps', finalFollowUp.id), finalFollowUp);
      } catch (e) {
        console.warn('Firestore saveFollowUp failed', e);
      }
    }

    const all = readLocal<FollowUp[]>(LOCAL_STORAGE_KEYS.FOLLOW_UPS, []);
    const idx = all.findIndex((f) => f.id === finalFollowUp.id);
    if (idx >= 0) all[idx] = finalFollowUp;
    else all.push(finalFollowUp);
    writeLocal(LOCAL_STORAGE_KEYS.FOLLOW_UPS, all);

    // Update lead's nextFollowUpAt if pending
    if (finalFollowUp.status === 'pending') {
      const lead = await this.getLeadById(finalFollowUp.leadId);
      if (lead) {
        lead.nextFollowUpAt = finalFollowUp.dateTime;
        await this.saveLead(lead, actorId);
      }
    }

    await this.recordActivity({
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      leadId: finalFollowUp.leadId,
      leadName: finalFollowUp.leadBusinessName,
      type: isNew ? 'followup_created' : 'followup_updated',
      timestamp: new Date().toISOString(),
      actorId,
      details: `${finalFollowUp.actionType} follow-up scheduled for ${new Date(
        finalFollowUp.dateTime
      ).toLocaleString()}.`,
    });
  },

  async completeFollowUp(id: string, actorId = 'admin'): Promise<void> {
    const all = readLocal<FollowUp[]>(LOCAL_STORAGE_KEYS.FOLLOW_UPS, []);
    const target = all.find((f) => f.id === id);
    if (!target) return;

    target.status = 'completed';
    target.completedAt = new Date().toISOString();

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'followUps', id), {
          status: 'completed',
          completedAt: target.completedAt,
        });
      } catch (e) {
        console.warn('Firestore update followUp failed', e);
      }
    }
    writeLocal(LOCAL_STORAGE_KEYS.FOLLOW_UPS, all);

    // Clear nextFollowUpAt on lead or set to next upcoming pending
    const remainingPending = all
      .filter((f) => f.leadId === target.leadId && f.status === 'pending')
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

    const lead = await this.getLeadById(target.leadId);
    if (lead) {
      lead.nextFollowUpAt = remainingPending.length > 0 ? remainingPending[0].dateTime : undefined;
      await this.saveLead(lead, actorId);
    }

    await this.recordActivity({
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      leadId: target.leadId,
      leadName: target.leadBusinessName,
      type: 'followup_completed',
      timestamp: new Date().toISOString(),
      actorId,
      details: `Completed ${target.actionType} follow-up task.`,
    });
  },

  // --- NOTES ---
  async getNotes(leadId: string): Promise<Note[]> {
    const all = readLocal<Note[]>(LOCAL_STORAGE_KEYS.NOTES, []);
    return all
      .filter((n) => n.leadId === leadId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async addNote(leadId: string, content: string, author = 'Admin'): Promise<void> {
    const lead = await this.getLeadById(leadId);
    const newNote: Note = {
      id: `note-${Date.now()}`,
      leadId,
      author,
      content,
      createdAt: new Date().toISOString(),
    };
    const all = readLocal<Note[]>(LOCAL_STORAGE_KEYS.NOTES, []);
    all.unshift(newNote);
    writeLocal(LOCAL_STORAGE_KEYS.NOTES, all);

    // Update notesSummary on lead for quick search
    if (lead) {
      lead.notesSummary = content.substring(0, 120);
      await this.saveLead(lead, author);
    }

    await this.recordActivity({
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      leadId,
      leadName: lead?.businessName,
      type: 'note_added',
      timestamp: new Date().toISOString(),
      actorId: author,
      details: `Note added: "${content.substring(0, 60)}${content.length > 60 ? '...' : ''}"`,
    });
  },

  // --- CATEGORIES ---
  async getCategories(): Promise<Category[]> {
    return readLocal<Category[]>(LOCAL_STORAGE_KEYS.CATEGORIES, SEED_CATEGORIES);
  },

  async saveCategory(cat: Category): Promise<void> {
    const all = await this.getCategories();
    const idx = all.findIndex((c) => c.id === cat.id);
    if (idx >= 0) all[idx] = cat;
    else all.push(cat);
    writeLocal(LOCAL_STORAGE_KEYS.CATEGORIES, all);
  },

  // --- DAILY TARGETS & RULES ---
  getDailyTargets(): DailyTargets {
    return readLocal<DailyTargets>(LOCAL_STORAGE_KEYS.DAILY_TARGETS, DEFAULT_DAILY_TARGETS);
  },

  saveDailyTargets(targets: DailyTargets): void {
    writeLocal(LOCAL_STORAGE_KEYS.DAILY_TARGETS, targets);
  },

  getFollowUpRules(): FollowUpRules {
    return readLocal<FollowUpRules>(LOCAL_STORAGE_KEYS.FOLLOW_UP_RULES, DEFAULT_FOLLOW_UP_RULES);
  },

  saveFollowUpRules(rules: FollowUpRules): void {
    writeLocal(LOCAL_STORAGE_KEYS.FOLLOW_UP_RULES, rules);
  },

  // --- NOTIFICATIONS ---
  getNotifications(): CRMNotification[] {
    return readLocal<CRMNotification[]>(LOCAL_STORAGE_KEYS.NOTIFICATIONS, []);
  },

  saveNotification(n: CRMNotification): void {
    const all = this.getNotifications();
    all.unshift(n);
    writeLocal(LOCAL_STORAGE_KEYS.NOTIFICATIONS, all.slice(0, 50));
  },

  markNotificationRead(id: string): void {
    const all = this.getNotifications();
    const item = all.find((n) => n.id === id);
    if (item) item.read = true;
    writeLocal(LOCAL_STORAGE_KEYS.NOTIFICATIONS, all);
  },

  markAllNotificationsRead(): void {
    const all = this.getNotifications().map((n) => ({ ...n, read: true }));
    writeLocal(LOCAL_STORAGE_KEYS.NOTIFICATIONS, all);
  },

  // --- AUTOMATION ---
  getAutomationSettings(): AutomationSettings {
    return readLocal<AutomationSettings>(LOCAL_STORAGE_KEYS.AUTOMATION_SETTINGS, {
      autoLeadDiscoveryEnabled: false,
      targetCountries: ['United Arab Emirates', 'Saudi Arabia', 'Qatar', 'United Kingdom', 'United States'],
      targetCities: ['Dubai', 'Abu Dhabi', 'Riyadh', 'London', 'New York'],
      targetCategories: ['Restaurants', 'Real Estate Agencies', 'Clinics', 'IT Companies'],
      maxLeadsPerRun: 25,
      schedule: 'Manual',
      duplicateProtection: true,
    });
  },

  saveAutomationSettings(settings: AutomationSettings): void {
    writeLocal(LOCAL_STORAGE_KEYS.AUTOMATION_SETTINGS, settings);
  },

  getAutomationRuns(): AutomationRun[] {
    return readLocal<AutomationRun[]>(LOCAL_STORAGE_KEYS.AUTOMATION_RUNS, []);
  },

  recordAutomationRun(run: AutomationRun): void {
    const all = this.getAutomationRuns();
    all.unshift(run);
    writeLocal(LOCAL_STORAGE_KEYS.AUTOMATION_RUNS, all.slice(0, 100));
  },

  // --- COMPUTED REAL STATS (Zero Fabricated Data) ---
  async getTodayStats(): Promise<{
    completedToday: number;
    callsToday: number;
    whatsAppsToday: number;
    emailsToday: number;
    followUpsCompletedToday: number;
    uniqueLeadsContactedToday: number;
    target: number;
  }> {
    const todayStr = new Date().toISOString().split('T')[0];
    const activities = await this.getActivities(undefined, 500);
    const todayActs = activities.filter((a) => a.timestamp.startsWith(todayStr));

    const contactActionTypes: Activity['type'][] = [
      'call_started',
      'call_recorded',
      'whatsapp_opened',
      'whatsapp_confirmed',
      'email_opened',
      'email_confirmed',
    ];

    const todayContactActs = todayActs.filter((a) => contactActionTypes.includes(a.type));
    const uniqueLeadIds = new Set(todayContactActs.map((a) => a.leadId));

    const calls = todayActs.filter((a) => a.type === 'call_started' || a.type === 'call_recorded').length;
    const whatsApps = todayActs.filter((a) => a.type === 'whatsapp_opened' || a.type === 'whatsapp_confirmed').length;
    const emails = todayActs.filter((a) => a.type === 'email_opened' || a.type === 'email_confirmed').length;
    const followUpsCompleted = todayActs.filter((a) => a.type === 'followup_completed').length;

    const targets = this.getDailyTargets();

    return {
      completedToday: todayContactActs.length + followUpsCompleted,
      callsToday: calls,
      whatsAppsToday: whatsApps,
      emailsToday: emails,
      followUpsCompletedToday: followUpsCompleted,
      uniqueLeadsContactedToday: uniqueLeadIds.size,
      target: targets.dailyContactTarget,
    };
  },
};
