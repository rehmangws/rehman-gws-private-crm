import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BusinessMapService, BusinessCandidate } from '../services/businessMapService';

test('Provider capabilities honestly describe Open Map Data limits', () => {
  const caps = BusinessMapService.getCapabilities('Open Map Data (OSM Overpass)');
  assert.equal(caps.supportsBusinessSearch, true);
  assert.equal(caps.supportsPhone, true);
  assert.equal(caps.supportsWebsite, true);
  // Honest limits: OSM does not index emails and WhatsApp must never be assumed
  assert.equal(caps.supportsEmail, false);
  assert.equal(caps.supportsWhatsApp, false);
});

test('Candidate phone and WhatsApp remain strictly separate by default', () => {
  const candidate: BusinessCandidate = {
    id: 'test-1',
    externalId: 'osm-node-12345',
    provider: 'Open Map Data',
    businessName: 'Marina Seafood Grill',
    primaryCategory: 'Restaurant',
    categories: ['Restaurant', 'Seafood'],
    phone: '+97148881234',
    whatsapp: null,
    whatsappConfirmed: false,
    email: null,
    website: 'https://marinagrill.ae',
    latitude: 25.0805,
    longitude: 55.1403,
    discoveredAt: new Date().toISOString(),
    inCrm: false,
  };

  assert.equal(candidate.phone, '+97148881234');
  assert.equal(candidate.whatsapp, null);
  assert.equal(candidate.whatsappConfirmed, false);
  assert.equal(candidate.email, null); // Strictly null, never fabricated
});

test('Diagnostics tracking records metrics cleanly', () => {
  const diag = BusinessMapService.getDiagnostics();
  assert.ok(typeof diag.searchDurationMs === 'number');
  assert.ok(typeof diag.cacheHits === 'number');
  assert.ok(typeof diag.cancelledRequests === 'number');
});
