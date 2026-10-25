import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLeadPriorityAndNextAction } from './priorityEngine';
import { Lead } from '../types/crm';

test('evaluateLeadPriorityAndNextAction marks overdue follow-up as Urgent with explanation', () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const lead: Lead = {
    id: 'lead-test-1',
    businessName: 'Al-Barsha Cafe',
    businessNameNormalized: 'albarsha cafe',
    categoryId: 'cat-cafe',
    categoryName: 'Cafes',
    source: 'Map',
    status: 'Interested',
    priority: 'Normal',
    nextFollowUpAt: yesterday,
    phone: '+971501239999',
    whatsapp: '+971501239999',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'admin',
    updatedBy: 'admin',
  };

  const evalResult = evaluateLeadPriorityAndNextAction(lead);
  assert.equal(evalResult.priority, 'Urgent');
  assert.equal(evalResult.isOverdue, true);
  assert.ok(evalResult.reasons.some((r) => r.includes('Follow-up overdue')));
});

test('evaluateLeadPriorityAndNextAction sets High priority for Hot Lead awaiting response', () => {
  const lead: Lead = {
    id: 'lead-test-2',
    businessName: 'Marina Yacht Club',
    businessNameNormalized: 'marina yacht club',
    categoryId: 'cat-tourism',
    categoryName: 'Tourism',
    source: 'Manual',
    status: 'Hot Lead',
    priority: 'Normal',
    isHot: true,
    whatsapp: '+971508887766',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'admin',
    updatedBy: 'admin',
  };

  const evalResult = evaluateLeadPriorityAndNextAction(lead);
  assert.equal(evalResult.priority, 'High');
  assert.ok(evalResult.reasons.some((r) => r.includes('Marked as Hot Lead')));
});

test('evaluateLeadPriorityAndNextAction handles New uncontacted lead with recommended channel', () => {
  const lead: Lead = {
    id: 'lead-test-3',
    businessName: 'Desert Bloom Flower Boutique',
    businessNameNormalized: 'desert bloom flower boutique',
    categoryId: 'cat-retail',
    categoryName: 'Retail',
    source: 'Map',
    status: 'New',
    priority: 'Normal',
    whatsapp: '+971551234567',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'admin',
    updatedBy: 'admin',
  };

  const evalResult = evaluateLeadPriorityAndNextAction(lead);
  assert.equal(evalResult.actionType, 'WhatsApp');
  assert.ok(evalResult.reasons.some((r) => r.includes('New lead, never contacted')));
});
