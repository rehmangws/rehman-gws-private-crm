import { Category, LeadStatus, FollowUpRules, DailyTargets, SavedView } from '../types/crm';

export const SEED_CATEGORIES: Category[] = [
  'Restaurants', 'Cafes', 'Coffee Shops', 'Hotels', 'Salons', 'Beauty Salons', 'Barbers', 'Spas',
  'Real Estate Agencies', 'Property Management', 'Warehouses', 'Logistics', 'Shipping',
  'Construction', 'Contractors', 'Manufacturing', 'Factories', 'Recruitment', 'Staffing',
  'Cleaning', 'Maintenance', 'Security', 'Car Rentals', 'Car Dealers', 'Auto Workshops',
  'Gyms', 'Fitness Centers', 'Clinics', 'Dental Clinics', 'Medical Centers', 'Pharmacies',
  'Schools', 'Nurseries', 'Training Centers', 'Travel Agencies', 'Tourism', 'Supermarkets',
  'Grocery Stores', 'Retail', 'Fashion', 'Electronics', 'Furniture', 'E-commerce', 'Offices',
  'Corporate Companies', 'IT Companies', 'Software Companies', 'Marketing Agencies',
  'Accounting Firms', 'Law Firms', 'Event Companies', 'Catering', 'Laundry', 'Home Services'
].map((name, index) => ({
  id: `cat-${index + 1}`,
  name,
  isCustom: false,
  isArchived: false,
}));

export const ALL_LEAD_STATUSES: LeadStatus[] = [
  'New',
  'To Contact',
  'Contacted',
  'Called',
  'No Answer',
  'WhatsApp Opened',
  'WhatsApp Sent/Confirmed',
  'Email Opened',
  'Email Sent/Confirmed',
  'Follow-up',
  'Interested',
  'Hot Lead',
  'Qualified',
  'Meeting Scheduled',
  'Proposal Sent',
  'Negotiating',
  'Not Interested',
  'Won / Client',
  'Lost',
  'Do Not Contact',
];

export const PIPELINE_COLUMNS: LeadStatus[] = [
  'New',
  'Contacted',
  'Follow-up',
  'Interested',
  'Qualified',
  'Proposal Sent',
  'Negotiating',
  'Won / Client',
  'Lost',
];

export const DEFAULT_DAILY_TARGETS: DailyTargets = {
  dailyContactTarget: 50,
  callTarget: 20,
  whatsappTarget: 25,
  emailTarget: 15,
  newLeadReviewTarget: 15,
  followUpTarget: 10,
};

export const DEFAULT_FOLLOW_UP_RULES: FollowUpRules = {
  noAnswerDays: 1,
  whatsappDays: 2,
  emailDays: 3,
  interestedDays: 1,
};

export const DEFAULT_SAVED_VIEWS: SavedView[] = [
  { id: 'view-all', name: 'All Leads', filters: {} },
  { id: 'view-new', name: 'New Leads', filters: { status: ['New'] } },
  { id: 'view-today', name: "Today's Leads", filters: {} },
  { id: 'view-need-contact', name: 'Need Contact', filters: { status: ['New', 'To Contact'] } },
  { id: 'view-no-response', name: 'No Response', filters: { status: ['No Answer'] } },
  { id: 'view-followup-today', name: 'Follow-up Today', filters: { status: ['Follow-up'] } },
  { id: 'view-overdue', name: 'Overdue', filters: { overdueOnly: true } },
  { id: 'view-interested', name: 'Interested', filters: { status: ['Interested'] } },
  { id: 'view-hot', name: 'Hot Leads', filters: { isHot: true } },
  { id: 'view-won', name: 'Won / Clients', filters: { status: ['Won / Client'] } },
  { id: 'view-never-contacted', name: 'Never Contacted', filters: { neverContacted: true } },
];
