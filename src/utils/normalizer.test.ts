import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePhone,
  normalizeEmail,
  extractDomain,
  normalizeWebsite,
  normalizeBusinessName,
  checkDuplicateLead,
} from './normalizer';
import { Lead } from '../types/crm';

test('normalizePhone cleans formatted numbers and handles international prefixes', () => {
  assert.equal(normalizePhone('+971 (50) 123-4567'), '+971501234567');
  assert.equal(normalizePhone('00971501234567'), '+971501234567');
  assert.equal(normalizePhone(''), '');
  assert.equal(normalizePhone(null), '');
});

test('normalizeEmail trims and converts to lowercase', () => {
  assert.equal(normalizeEmail('  Contact@RehmanGWS.COM  '), 'contact@rehmangws.com');
  assert.equal(normalizeEmail(undefined), '');
});

test('extractDomain correctly strips protocol, www, and query params', () => {
  assert.equal(extractDomain('https://www.rehmangws.com/services?ref=crm'), 'rehmangws.com');
  assert.equal(extractDomain('http://dubai-restaurant.ae/#about'), 'dubai-restaurant.ae');
});

test('normalizeBusinessName cleans special characters and whitespace', () => {
  assert.equal(normalizeBusinessName('  Al-Rehman  GWS & Trading LLC!  '), 'alrehman gws trading llc');
});

test('checkDuplicateLead identifies exact Google Place ID matches', () => {
  const existing: Lead[] = [
    {
      id: 'lead-1',
      businessName: 'Royal Bistro Dubai',
      businessNameNormalized: 'royal bistro dubai',
      categoryId: 'cat-1',
      categoryName: 'Restaurants',
      googlePlaceId: 'ChIJ1234567890',
      source: 'Google Places',
      status: 'Contacted',
      priority: 'Normal',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'admin',
      updatedBy: 'admin',
    },
  ];

  const result = checkDuplicateLead(
    {
      businessName: 'Royal Bistro',
      googlePlaceId: 'ChIJ1234567890',
    },
    existing
  );

  assert.equal(result.status, 'Duplicate');
  assert.equal(result.field, 'googlePlaceId');
  assert.equal(result.matchedLead?.id, 'lead-1');
});

test('checkDuplicateLead detects matching normalized phone numbers', () => {
  const existing: Lead[] = [
    {
      id: 'lead-2',
      businessName: 'Apex Logistics',
      businessNameNormalized: 'apex logistics',
      categoryId: 'cat-2',
      categoryName: 'Logistics',
      phone: '+971501112233',
      phoneNormalized: '+971501112233',
      source: 'Manual',
      status: 'New',
      priority: 'Normal',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'admin',
      updatedBy: 'admin',
    },
  ];

  const result = checkDuplicateLead(
    {
      businessName: 'Apex Transport',
      phone: '+971 (50) 111-2233',
    },
    existing
  );

  assert.equal(result.status, 'Duplicate');
  assert.equal(result.field, 'phone');
});

test('checkDuplicateLead returns Unique for distinct leads', () => {
  const existing: Lead[] = [
    {
      id: 'lead-3',
      businessName: 'Unique Tech Solutions',
      businessNameNormalized: 'unique tech solutions',
      categoryId: 'cat-3',
      categoryName: 'IT Companies',
      phone: '+971509998877',
      phoneNormalized: '+971509998877',
      websiteDomain: 'uniquetech.ae',
      source: 'Manual',
      status: 'New',
      priority: 'Normal',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'admin',
      updatedBy: 'admin',
    },
  ];

  const result = checkDuplicateLead(
    {
      businessName: 'Global Dental Clinic',
      phone: '+971502223344',
      website: 'https://globaldental.com',
    },
    existing
  );

  assert.equal(result.status, 'Unique');
});
