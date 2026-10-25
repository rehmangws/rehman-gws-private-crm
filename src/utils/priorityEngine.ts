import { Lead, FollowUp, FollowUpRules, LeadPriority } from '../types/crm';

export interface NextActionRecommendation {
  priority: LeadPriority;
  recommendedAction: string;
  actionType: 'Call' | 'WhatsApp' | 'Email' | 'Meeting' | 'Review';
  reasons: string[];
  isOverdue: boolean;
  daysOverdue?: number;
  daysSinceLastContact?: number;
}

export function evaluateLeadPriorityAndNextAction(
  lead: Lead,
  rules: FollowUpRules = { noAnswerDays: 1, whatsappDays: 2, emailDays: 3, interestedDays: 1 },
  activeFollowUps: FollowUp[] = []
): NextActionRecommendation {
  const now = new Date();
  const reasons: string[] = [];
  let isOverdue = false;
  let daysOverdue = 0;
  let calculatedPriority: LeadPriority = lead.priority || 'Normal';
  let recommendedAction = 'Contact lead';
  let actionType: 'Call' | 'WhatsApp' | 'Email' | 'Meeting' | 'Review' = 'Call';

  // Find most urgent pending follow-up for this lead
  const leadFollowUps = activeFollowUps.filter(
    (f) => f.leadId === lead.id && f.status === 'pending'
  );
  const pendingFollowUp = leadFollowUps.sort(
    (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
  )[0];

  // Check nextFollowUpAt from lead or pending followUp
  const followUpDateStr = pendingFollowUp ? pendingFollowUp.dateTime : lead.nextFollowUpAt;

  if (followUpDateStr) {
    const fDate = new Date(followUpDateStr);
    const diffMs = now.getTime() - fDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs > 0) {
      isOverdue = true;
      daysOverdue = Math.max(1, diffDays);
      reasons.push(`Follow-up overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}`);
      calculatedPriority = 'Urgent';
    } else {
      const isDueToday = fDate.toDateString() === now.toDateString();
      if (isDueToday) {
        reasons.push('Follow-up scheduled for today');
        if (calculatedPriority !== 'Urgent') {
          calculatedPriority = 'High';
        }
      }
    }
  }

  // Hot lead flag
  if (lead.isHot || lead.status === 'Hot Lead') {
    reasons.push('Marked as Hot Lead');
    if (calculatedPriority !== 'Urgent') {
      calculatedPriority = 'High';
    }
  }

  // Interested status
  if (lead.status === 'Interested') {
    reasons.push('Lead previously indicated interest');
    if (calculatedPriority !== 'Urgent') {
      calculatedPriority = 'High';
    }
  }

  // Days since last contact
  let daysSinceLastContact = 0;
  if (lead.lastContactAt) {
    const lastDate = new Date(lead.lastContactAt);
    daysSinceLastContact = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceLastContact >= 3 && lead.status !== 'Won / Client' && lead.status !== 'Do Not Contact') {
      reasons.push(`No activity for ${daysSinceLastContact} days`);
      if (calculatedPriority === 'Normal' || calculatedPriority === 'Low') {
        calculatedPriority = 'Medium';
      }
    }
  } else {
    reasons.push('New lead, never contacted');
  }

  // Determine specific Recommended Action and Channel
  if (lead.status === 'Do Not Contact') {
    recommendedAction = 'Do not contact (Excluded)';
    actionType = 'Review';
    calculatedPriority = 'Low';
  } else if (lead.status === 'Won / Client') {
    recommendedAction = 'Client account: regular relationship check-in';
    actionType = 'Review';
    calculatedPriority = 'Low';
  } else if (lead.status === 'Proposal Sent') {
    recommendedAction = 'Follow up on proposal feedback';
    actionType = lead.whatsapp ? 'WhatsApp' : lead.phone ? 'Call' : 'Email';
  } else if (lead.status === 'Meeting Scheduled') {
    recommendedAction = 'Prepare presentation & confirm meeting time';
    actionType = 'Meeting';
    calculatedPriority = 'High';
  } else if (lead.status === 'No Answer') {
    if (lead.whatsapp) {
      recommendedAction = `Retry: send personalized WhatsApp introduction (Rule: +${rules.noAnswerDays}d)`;
      actionType = 'WhatsApp';
    } else {
      recommendedAction = `Retry call attempt (Rule: +${rules.noAnswerDays}d)`;
      actionType = 'Call';
    }
  } else if (lead.status === 'WhatsApp Opened' || lead.status === 'WhatsApp Sent/Confirmed') {
    recommendedAction = `Follow up on WhatsApp conversation (Rule: +${rules.whatsappDays}d)`;
    actionType = 'WhatsApp';
  } else if (lead.status === 'Email Opened' || lead.status === 'Email Sent/Confirmed') {
    recommendedAction = `Check for email reply or send follow-up note (Rule: +${rules.emailDays}d)`;
    actionType = 'Email';
  } else if (lead.status === 'Interested') {
    recommendedAction = `High-priority follow-up: schedule discovery call / send portfolio (Rule: +${rules.interestedDays}d)`;
    actionType = lead.whatsapp ? 'WhatsApp' : 'Call';
  } else if (lead.status === 'New' || lead.status === 'To Contact') {
    if (lead.whatsapp) {
      recommendedAction = 'Send introductory WhatsApp message with company profile';
      actionType = 'WhatsApp';
    } else if (lead.phone) {
      recommendedAction = 'Place initial introduction call to qualifying decision maker';
      actionType = 'Call';
    } else if (lead.email) {
      recommendedAction = 'Send personalized introduction email';
      actionType = 'Email';
    } else {
      recommendedAction = 'Find direct phone or email contact info';
      actionType = 'Review';
    }
  }

  // Default fallback reason if list is empty
  if (reasons.length === 0) {
    reasons.push(`Current pipeline status: ${lead.status}`);
  }

  return {
    priority: calculatedPriority,
    recommendedAction,
    actionType,
    reasons,
    isOverdue,
    daysOverdue: isOverdue ? daysOverdue : undefined,
    daysSinceLastContact: lead.lastContactAt ? daysSinceLastContact : undefined,
  };
}
