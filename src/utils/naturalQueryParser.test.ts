import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNaturalQuery } from './naturalQueryParser';

test('parses category and location with preposition "in"', () => {
  const result = parseNaturalQuery('Restaurants in Dubai Marina');
  assert.equal(result.category, 'Restaurants');
  assert.equal(result.location, 'Dubai Marina');
  assert.equal(result.confirmationLabel, 'Dubai Marina • Restaurants');
});

test('parses query with "around" and radius', () => {
  const result = parseNaturalQuery('Warehouses around Al Quoz 5km');
  assert.equal(result.category, 'Warehouses');
  assert.equal(result.location, 'Al Quoz');
  assert.equal(result.radiusKm, 5);
  assert.equal(result.confirmationLabel, 'Al Quoz • Warehouses (5km)');
});

test('parses simple multi-word city without preposition', () => {
  const result = parseNaturalQuery('Hotels London');
  assert.equal(result.category, 'Hotels');
  assert.equal(result.location, 'London');
});

test('handles empty or vague search string gracefully', () => {
  const result = parseNaturalQuery('');
  assert.equal(result.category, 'All Commercial Businesses');
  assert.equal(result.confirmationLabel, 'Current Map Area • All Businesses');
});
