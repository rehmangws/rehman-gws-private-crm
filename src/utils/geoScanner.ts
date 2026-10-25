import { MapBounds } from '../services/businessMapService';

export interface ScanCell {
  id: string;
  index: number;
  total: number;
  bounds: MapBounds;
  center: { lat: number; lng: number };
  status: 'pending' | 'scanning' | 'completed' | 'failed';
  foundCount: number;
}

/**
 * Divides a bounding box into a grid of safe, manageable scan cells.
 * e.g. 2 rows x 3 columns = 6 cells
 */
export function subdivideBounds(
  bounds: MapBounds,
  rows = 2,
  cols = 3
): ScanCell[] {
  const safeRows = Math.max(1, Math.min(rows, 5));
  const safeCols = Math.max(1, Math.min(cols, 5));

  const latSpan = bounds.north - bounds.south;
  const lngSpan = bounds.east - bounds.west;

  const latStep = latSpan / safeRows;
  const lngStep = lngSpan / safeCols;

  const cells: ScanCell[] = [];
  let index = 0;
  const total = safeRows * safeCols;

  for (let r = 0; r < safeRows; r++) {
    for (let c = 0; c < safeCols; c++) {
      const south = bounds.south + r * latStep;
      const north = south + latStep;
      const west = bounds.west + c * lngStep;
      const east = west + lngStep;

      cells.push({
        id: `cell-${r}-${c}`,
        index: index + 1,
        total,
        bounds: { south, west, north, east },
        center: {
          lat: (south + north) / 2,
          lng: (west + east) / 2,
        },
        status: 'pending',
        foundCount: 0,
      });
      index++;
    }
  }

  return cells;
}

/**
 * Calculates a bounding box around a center lat/lng for a given radius in meters.
 */
export function boundsFromRadius(
  centerLat: number,
  centerLng: number,
  radiusMeters: number
): MapBounds {
  // Approximate earth radius: 6378137m
  // 1 degree latitude ~= 111,320m
  const latDelta = radiusMeters / 111320;
  // 1 degree longitude ~= 111,320m * cos(lat)
  const lngDelta = radiusMeters / (111320 * Math.cos((centerLat * Math.PI) / 180));

  return {
    south: centerLat - latDelta,
    north: centerLat + latDelta,
    west: centerLng - lngDelta,
    east: centerLng + lngDelta,
  };
}

/**
 * Haversine formula to calculate distance in meters between two coordinates.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}
