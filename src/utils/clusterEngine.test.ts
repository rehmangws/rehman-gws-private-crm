import test from 'node:test';
import assert from 'node:assert/strict';
import { clusterPoints, latLngToPixel, GeoPoint } from './clusterEngine';

test('latLngToPixel projects coordinates deterministically', () => {
  const p1 = latLngToPixel(25.2048, 55.2708, 10);
  const p2 = latLngToPixel(25.2048, 55.2708, 10);
  assert.equal(p1.x, p2.x);
  assert.equal(p1.y, p2.y);
  assert.ok(p1.x > 0);
  assert.ok(p1.y > 0);
});

test('clusterPoints groups nearby points at low zoom', () => {
  const points: GeoPoint[] = [
    { id: 'p1', latitude: 25.2048, longitude: 55.2708 },
    { id: 'p2', latitude: 25.2055, longitude: 55.2715 },
    { id: 'p3', latitude: 25.2062, longitude: 55.2720 },
    // Distant point in Abu Dhabi
    { id: 'p4', latitude: 24.4539, longitude: 54.3773 },
  ];

  const clusters = clusterPoints(points, 8, 60);
  // At zoom 8, Dubai points p1, p2, p3 should be grouped together into 1 cluster, and Abu Dhabi separate
  const clusterItem = clusters.find((c) => c.isCluster);
  assert.ok(clusterItem, 'Expected a cluster to form');
  if (clusterItem && clusterItem.isCluster) {
    assert.equal(clusterItem.count, 3);
  }
});

test('clusterPoints separates points at high zoom (zoom >= 17)', () => {
  const points: GeoPoint[] = [
    { id: 'p1', latitude: 25.2048, longitude: 55.2708 },
    { id: 'p2', latitude: 25.2050, longitude: 55.2710 },
  ];

  const clusters = clusterPoints(points, 18);
  assert.equal(clusters.length, 2);
  assert.equal(clusters[0].isCluster, false);
  assert.equal(clusters[1].isCluster, false);
});
