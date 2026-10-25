import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLeadQualityScore } from './leadQualityEngine';

test('calculates high score for candidate with phone, website, address and hours', () => {
  const result = calculateLeadQualityScore({
    businessName: 'Prime Restaurant',
    phone: '+971 4 123 4567',
    website: 'https://primerestaurant.ae',
    address: 'Downtown Boulevard, Dubai',
    openingHours: '09:00 - 23:00',
    businessStatus: 'OPERATIONAL',
  }, false);

  assert.ok(result.score >= 80, `Score should be >= 80, was ${result.score}`);
  assert.equal(result.grade, 'ELITE');
  assert.ok(result.reasons.some(r => r.includes('Direct phone')));
  assert.ok(result.reasons.some(r => r.includes('Website')));
  assert.ok(result.reasons.some(r => r.includes('Fresh candidate')));
});

test('penalizes candidate already saved in CRM', () => {
  const freshResult = calculateLeadQualityScore({
    businessName: 'Apex Logistics',
    phone: '+971 4 881 9900',
    website: 'https://apexgulf.ae',
  }, false);

  const savedResult = calculateLeadQualityScore({
    businessName: 'Apex Logistics',
    phone: '+971 4 881 9900',
    website: 'https://apexgulf.ae',
  }, true);

  assert.ok(savedResult.score < freshResult.score, 'Saved candidate score should be lower than fresh candidate');
  assert.ok(savedResult.penalties.some(p => p.includes('Already recorded in CRM')));
});

test('penalizes candidates with missing phone or website', () => {
  const bareResult = calculateLeadQualityScore({
    businessName: 'Unnamed Stall',
  }, false);

  assert.ok(bareResult.score < 50);
  assert.ok(bareResult.penalties.some(p => p.includes('No direct phone')));
  assert.ok(bareResult.penalties.some(p => p.includes('No website')));
});
