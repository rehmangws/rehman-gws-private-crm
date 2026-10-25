export type LeadStatus =
  | 'New'
  | 'To Contact'
  | 'Contacted'
  | 'Called'
  | 'No Answer'
  | 'WhatsApp Opened'
  | 'WhatsApp Sent/Confirmed'
  | 'Email Opened'
  | 'Email Sent/Confirmed'
  | 'Follow-up'
  | 'Interested'
  | 'Hot Lead'
  | 'Qualified'
  | 'Meeting Scheduled'
  | 'Proposal Sent'
  | 'Negotiating'
  | 'Not Interested'
  | 'Won / Client'
  | 'Lost'
  | 'Do Not Contact';

export type LeadPriority = 'Low' | 'Normal' | 'Medium' | 'High' | 'Urgent';

export type LeadSource =
  | 'Manual'
  | 'Map'
  | 'Google Places'
  | 'Website'
  | 'Facebook'
  | 'Instagram'
  | 'Referral'
  | 'CSV Import'
  | 'Other';

export interface Lead {
  id: string;
  businessName: string;
  businessNameNormalized: string;
  contactPerson?: string;
  categoryId: string;
  categoryName: string;
  phone?: string;
  phoneNormalized?: string;
  whatsapp?: string;
  whatsappNormalized?: string;
  whatsappConfirmed?: boolean;
  email?: string;
  emailNormalized?: string;
  website?: string;
  websiteDomain?: string;
  address?: string;
  area?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  externalPlaceId?: string;
  googlePlaceId?: string;
  googleMapsUrl?: string;
  source: LeadSource;
  status: LeadStatus;
  priority: LeadPriority;
  isHot?: boolean;
  tags?: string[];
  notesSummary?: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  lastContactAt?: string;
  nextFollowUpAt?: string;
  wonAt?: string;
  lostAt?: string;
  archivedAt?: string;
  createdBy: string;
  updatedBy: string;
}

export type ActivityType =
  | 'lead_created'
  | 'lead_updated'
  | 'status_changed'
  | 'priority_changed'
  | 'call_started'
  | 'call_recorded'
  | 'whatsapp_opened'
  | 'whatsapp_confirmed'
  | 'email_opened'
  | 'email_confirmed'
  | 'note_added'
  | 'followup_created'
  | 'followup_updated'
  | 'followup_completed'
  | 'lead_won'
  | 'lead_lost'
  | 'imported'
  | 'duplicate_detected'
  | 'map_location_updated';

export interface Activity {
  id: string;
  leadId: string;
  leadName?: string;
  type: ActivityType;
  timestamp: string; // ISO string
  actorId: string;
  actorEmail?: string;
  metadata?: Record<string, unknown>;
  previousValue?: string;
  newValue?: string;
  details?: string;
}

export type FollowUpActionType = 'Call' | 'WhatsApp' | 'Email' | 'Meeting' | 'General Follow-up' | 'Custom';
export type FollowUpStatus = 'pending' | 'completed' | 'cancelled';

export interface FollowUp {
  id: string;
  leadId: string;
  leadBusinessName: string;
  leadPhone?: string;
  leadWhatsapp?: string;
  leadEmail?: string;
  dateTime: string; // ISO string
  actionType: FollowUpActionType;
  notes?: string;
  priority: LeadPriority;
  status: FollowUpStatus;
  createdAt: string;
  completedAt?: string;
}

export interface Note {
  id: string;
  leadId: string;
  author: string;
  createdAt: string;
  content: string;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  leadCount?: number;
  isCustom?: boolean;
  isArchived?: boolean;
}

export interface DailyTargets {
  dailyContactTarget: number;
  callTarget: number;
  whatsappTarget: number;
  emailTarget: number;
  newLeadReviewTarget: number;
  followUpTarget: number;
}

export interface FollowUpRules {
  noAnswerDays: number;
  whatsappDays: number;
  emailDays: number;
  interestedDays: number;
}

export interface CRMNotification {
  id: string;
  title: string;
  message: string;
  type: 'followup_due' | 'overdue' | 'urgent' | 'milestone' | 'discovery' | 'import' | 'system';
  timestamp: string;
  read: boolean;
  leadId?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'staff';
  lastLogin: string;
}

export interface SavedView {
  id: string;
  name: string;
  filters: {
    status?: LeadStatus[];
    priority?: LeadPriority[];
    source?: LeadSource[];
    categoryId?: string;
    hasPhone?: boolean;
    hasWhatsapp?: boolean;
    hasEmail?: boolean;
    neverContacted?: boolean;
    isHot?: boolean;
    overdueOnly?: boolean;
  };
}

export interface AutomationSettings {
  autoLeadDiscoveryEnabled: boolean;
  targetCountries: string[];
  targetCities: string[];
  targetCategories: string[];
  maxLeadsPerRun: number;
  schedule: 'Manual' | 'Daily' | 'Selected Days' | 'Weekly';
  duplicateProtection: boolean;
}

export interface AutomationRun {
  id: string;
  startedAt: string;
  completedAt: string;
  status: 'success' | 'failed' | 'partial';
  provider: string;
  requestedCount: number;
  createdCount: number;
  duplicateCount: number;
  errorCount: number;
  errorSummary?: string;
}
