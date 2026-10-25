import test from 'node:test';
import assert from 'node:assert/strict';
import { subdivideBounds, boundsFromRadius, calculateDistanceMeters } from './geoScanner';

test('subdivideBounds creates correct number of cells with valid coordinates', () => {
  const bounds = {
    south: 25.0,
    north: 25.2,
    west: 55.0,
    east: 55.3,
  };

  const cells = subdivideBounds(bounds, 2, 3);
  assert.equal(cells.length, 6);
  assert.equal(cells[0].index, 1);
  assert.equal(cells[0].total, 6);
  assert.ok(cells[0].bounds.south < cells[0].bounds.north);
  assert.ok(cells[0].bounds.west < cells[0].bounds.east);
});

test('boundsFromRadius expands symmetrically around center', () => {
  const centerLat = 25.2048;
  const centerLng = 55.2708;
  const radius = 1000; // 1km

  const bounds = boundsFromRadius(centerLat, centerLng, radius);
  assert.ok(bounds.south < centerLat);
  assert.ok(bounds.north > centerLat);
  assert.ok(bounds.west < centerLng);
  assert.ok(bounds.east > centerLng);

  // Check approximate distance from center to north boundary
  const dist = calculateDistanceMeters(centerLat, centerLng, bounds.north, centerLng);
  assert.ok(Math.abs(dist - radius) < 10, `Expected distance near 1000m, got ${dist}`);
});
