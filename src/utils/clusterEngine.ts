export interface GeoPoint {
  id: string;
  latitude: number;
  longitude: number;
  [key: string]: any;
}

export interface Cluster<T extends GeoPoint> {
  id: string;
  isCluster: true;
  latitude: number;
  longitude: number;
  count: number;
  items: T[];
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
}

export interface SinglePoint<T extends GeoPoint> {
  id: string;
  isCluster: false;
  latitude: number;
  longitude: number;
  item: T;
}

export type ClusterResult<T extends GeoPoint> = Cluster<T> | SinglePoint<T>;

/**
 * Projects latitude/longitude to Web Mercator pixel coordinates at a given zoom level
 */
export function latLngToPixel(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const sinY = Math.sin((lat * Math.PI) / 180);
  const clampedSinY = Math.min(Math.max(sinY, -0.9999), 0.9999);
  const scale = 256 * Math.pow(2, zoom);

  const x = scale * (0.5 + lng / 360);
  const y = scale * (0.5 - Math.log((1 + clampedSinY) / (1 - clampedSinY)) / (4 * Math.PI));

  return { x, y };
}

/**
 * High-performance grid-based clustering engine.
 * Clusters markers within a pixel distance threshold at the given zoom level.
 */
export function clusterPoints<T extends GeoPoint>(
  points: T[],
  zoom: number,
  clusterRadiusPixels = 50
): ClusterResult<T>[] {
  if (points.length === 0) return [];
  // If zoomed in close (zoom >= 17), show individual points
  if (zoom >= 17) {
    return points.map((p) => ({
      id: p.id,
      isCluster: false,
      latitude: p.latitude,
      longitude: p.longitude,
      item: p,
    }));
  }

  const clusters: {
    items: T[];
    pixelSumX: number;
    pixelSumY: number;
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  }[] = [];

  for (const point of points) {
    if (typeof point.latitude !== 'number' || typeof point.longitude !== 'number') continue;
    const { x, y } = latLngToPixel(point.latitude, point.longitude, zoom);

    // Find nearest existing cluster
    let closestCluster: (typeof clusters)[0] | null = null;
    let minDistanceSq = clusterRadiusPixels * clusterRadiusPixels;

    for (const cluster of clusters) {
      const clusterPixelX = cluster.pixelSumX / cluster.items.length;
      const clusterPixelY = cluster.pixelSumY / cluster.items.length;
      const dx = x - clusterPixelX;
      const dy = y - clusterPixelY;
      const distSq = dx * dx + dy * dy;

      if (distSq < minDistanceSq) {
        minDistanceSq = distSq;
        closestCluster = cluster;
      }
    }

    if (closestCluster) {
      closestCluster.items.push(point);
      closestCluster.pixelSumX += x;
      closestCluster.pixelSumY += y;
      closestCluster.minLat = Math.min(closestCluster.minLat, point.latitude);
      closestCluster.maxLat = Math.max(closestCluster.maxLat, point.latitude);
      closestCluster.minLng = Math.min(closestCluster.minLng, point.longitude);
      closestCluster.maxLng = Math.max(closestCluster.maxLng, point.longitude);
    } else {
      clusters.push({
        items: [point],
        pixelSumX: x,
        pixelSumY: y,
        minLat: point.latitude,
        maxLat: point.latitude,
        minLng: point.longitude,
        maxLng: point.longitude,
      });
    }
  }

  return clusters.map((c, idx) => {
    if (c.items.length === 1) {
      const single = c.items[0];
      return {
        id: single.id,
        isCluster: false,
        latitude: single.latitude,
        longitude: single.longitude,
        item: single,
      };
    }

    const count = c.items.length;
    const avgLat = c.items.reduce((sum, item) => sum + item.latitude, 0) / count;
    const avgLng = c.items.reduce((sum, item) => sum + item.longitude, 0) / count;

    return {
      id: `cluster-${zoom}-${idx}-${count}`,
      isCluster: true,
      latitude: avgLat,
      longitude: avgLng,
      count,
      items: c.items,
      bounds: {
        minLat: c.minLat,
        maxLat: c.maxLat,
        minLng: c.minLng,
        maxLng: c.maxLng,
      },
    };
  });
}
