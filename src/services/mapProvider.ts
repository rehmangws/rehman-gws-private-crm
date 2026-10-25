export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface GeocodingProvider {
  search(query: string): Promise<GeocodingResult[]>;
  reverse(lat: number, lng: number): Promise<GeocodingResult | null>;
}

// In-memory cache to prevent redundant network calls & respect provider limits
const geocodeCache = new Map<string, GeocodingResult[]>();
const reverseCache = new Map<string, GeocodingResult>();

let lastRequestTime = 0;
async function rateLimitDelay(ms = 800): Promise<void> {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < ms) {
    await new Promise((resolve) => setTimeout(resolve, ms - timeSinceLast));
  }
  lastRequestTime = Date.now();
}

export const OpenStreetMapProvider: GeocodingProvider = {
  async search(query: string): Promise<GeocodingResult[]> {
    const q = query.trim();
    if (!q || q.length < 2) return [];

    if (geocodeCache.has(q.toLowerCase())) {
      return geocodeCache.get(q.toLowerCase())!;
    }

    try {
      await rateLimitDelay();
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        q
      )}&addressdetails=1&limit=5`;

      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'RehmanGWS-CRM/1.0',
        },
      });

      if (!res.ok) {
        throw new Error(`Nominatim error: ${res.status}`);
      }

      const data = await res.json();
      const results: GeocodingResult[] = data.map((item: any) => ({
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        displayName: item.display_name,
        address: [item.address?.road, item.address?.house_number].filter(Boolean).join(' ') || item.display_name.split(',')[0],
        city: item.address?.city || item.address?.town || item.address?.municipality || item.address?.state_district || '',
        state: item.address?.state || '',
        country: item.address?.country || '',
      }));

      geocodeCache.set(q.toLowerCase(), results);
      return results;
    } catch (err) {
      console.warn('Geocoding search failed, continuing gracefully', err);
      return [];
    }
  },

  async reverse(lat: number, lng: number): Promise<GeocodingResult | null> {
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (reverseCache.has(cacheKey)) {
      return reverseCache.get(cacheKey)!;
    }

    try {
      await rateLimitDelay();
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'RehmanGWS-CRM/1.0',
        },
      });

      if (!res.ok) return null;
      const item = await res.json();

      const result: GeocodingResult = {
        latitude: lat,
        longitude: lng,
        displayName: item.display_name || 'Selected Map Location',
        address: [item.address?.road, item.address?.house_number].filter(Boolean).join(' ') || item.display_name?.split(',')[0] || '',
        city: item.address?.city || item.address?.town || item.address?.suburb || item.address?.county || '',
        state: item.address?.state || '',
        country: item.address?.country || '',
      };

      reverseCache.set(cacheKey, result);
      return result;
    } catch (err) {
      console.warn('Reverse geocoding failed, allowing manual coordinates', err);
      return {
        latitude: lat,
        longitude: lng,
        displayName: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        address: '',
        city: '',
        country: '',
      };
    }
  },
};

export const CartoDarkTileLayer = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  darkUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};
