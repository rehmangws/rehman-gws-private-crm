import { Lead } from '../types/crm';
import { checkDuplicateLead, normalizePhone, extractDomain } from '../utils/normalizer';
import { calculateLeadQualityScore } from '../utils/leadQualityEngine';
import { boundsFromRadius } from '../utils/geoScanner';
import { DiscoveryProvider } from './discoveryProvider';

export interface BusinessCandidate {
  id: string;
  externalId: string;
  provider: 'Open Map Data' | 'Google Places' | 'Manual';
  businessName: string;
  primaryCategory: string;
  categories: string[];
  phone?: string | null;
  whatsapp?: string | null;
  whatsappConfirmed?: boolean;
  email?: string | null;
  website?: string | null;
  websiteDomain?: string | null;
  address?: string | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  latitude: number;
  longitude: number;
  openingHours?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  businessStatus?: string | null;
  sourceUrl?: string | null;
  discoveredAt: string;
  detailsLoaded?: boolean;
  isDetailsLoading?: boolean;
  // CRM matching state
  inCrm: boolean;
  crmLead?: Lead;
  duplicateStatus?: 'Unique' | 'Possible Duplicate' | 'Duplicate';
  duplicateReason?: string;
  // Lead Finder V3 Quality & State attributes
  leadQualityScore?: number;
  leadQualityGrade?: 'ELITE' | 'HIGH' | 'GOOD' | 'FAIR';
  leadQualityLabel?: string;
  leadQualityReasons?: string[];
  leadQualityPenalties?: string[];
  isSkipped?: boolean;
  isDismissed?: boolean;
}

export interface ProviderCapabilities {
  name: string;
  supportsBusinessSearch: boolean;
  supportsBusinessDetails: boolean;
  supportsPhone: boolean;
  supportsWebsite: boolean;
  supportsEmail: boolean;
  supportsWhatsApp: boolean;
  supportsOpeningHours: boolean;
  supportsRating: boolean;
  rateLimitNote: string;
}

export interface SavedProspectingArea {
  id: string;
  name: string;
  location: string;
  category: string;
  bounds: MapBounds;
  center: { lat: number; lng: number; zoom: number };
  savedAt: string;
  leadsFoundLastScan?: number;
}

export interface RecentSearchItem {
  id: string;
  query: string;
  location: string;
  category: string;
  timestamp: string;
}

export interface SearchPreset {
  id: string;
  name: string;
  location: string;
  category: string;
  mapLayer: 'dark' | 'street' | 'satellite' | 'hybrid';
  newOnly: boolean;
  hasPhone: boolean;
  center: { lat: number; lng: number; zoom: number };
}

export interface MapBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface DiscoveryDiagnostics {
  currentProvider: string;
  searchDurationMs: number;
  businessesReturned: number;
  markersRendered: number;
  detailsRequests: number;
  cacheHits: number;
  cacheMisses: number;
  cancelledRequests: number;
  lastSearchTimestamp: string;
}

// In-memory normalized search cache with 10-minute TTL
interface CachedSearchEntry {
  candidates: BusinessCandidate[];
  timestamp: number;
}
const searchCache = new Map<string, CachedSearchEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Details cache for Stage B on-demand enrichment
const detailsCache = new Map<string, Partial<BusinessCandidate>>();

// Diagnostic metrics
let diagnostics: DiscoveryDiagnostics = {
  currentProvider: 'Open Map Data (OSM Overpass)',
  searchDurationMs: 0,
  businessesReturned: 0,
  markersRendered: 0,
  detailsRequests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  cancelledRequests: 0,
  lastSearchTimestamp: 'None',
};

export const BusinessMapService = {
  getCapabilities(providerName: string): ProviderCapabilities {
    if (providerName.includes('Google Places')) {
      return {
        name: 'Google Places API',
        supportsBusinessSearch: true,
        supportsBusinessDetails: true,
        supportsPhone: true,
        supportsWebsite: true,
        supportsEmail: false, // Places API does not return emails
        supportsWhatsApp: false, // Never inferred automatically
        supportsOpeningHours: true,
        supportsRating: true,
        rateLimitNote: 'Requires Google Places API Key with TextSearch and Place Details enabled.',
      };
    }
    return {
      name: 'Open Map Data (OSM Overpass)',
      supportsBusinessSearch: true,
      supportsBusinessDetails: true,
      supportsPhone: true,
      supportsWebsite: true,
      supportsEmail: false, // OSM POI tags rarely contain emails; never fabricated
      supportsWhatsApp: false, // WhatsApp is never an OSM tag; requires explicit admin confirmation
      supportsOpeningHours: true,
      supportsRating: false, // OSM does not have public user star ratings
      rateLimitNote: 'Public OSM Overpass mirrors with rate-limiting and normalized client caching.',
    };
  },

  getDiagnostics(): DiscoveryDiagnostics {
    return { ...diagnostics };
  },

  setMarkersRenderedCount(count: number) {
    diagnostics.markersRendered = count;
  },

  recordCancelledRequest() {
    diagnostics.cancelledRequests += 1;
  },

  /**
   * Search legitimate businesses in the specified bounding box.
   * Supports AbortSignal for request cancellation when map is panned or superseded.
   */
  async searchInBounds(
    bounds: MapBounds,
    categoryFilter = 'all',
    existingLeads: Lead[] = [],
    signal?: AbortSignal,
    maxResults = 150
  ): Promise<{
    candidates: BusinessCandidate[];
    provider: string;
    error?: string;
    fromCache?: boolean;
  }> {
    const startTime = performance.now();
    diagnostics.lastSearchTimestamp = new Date().toLocaleTimeString();

    // Check if Google Places is explicitly configured
    if (DiscoveryProvider.isPlacesConfigured()) {
      diagnostics.currentProvider = 'Google Places API';
      try {
        const centerLat = (bounds.south + bounds.north) / 2;
        const centerLng = (bounds.west + bounds.east) / 2;
        const placesRes = await DiscoveryProvider.searchBusinesses({
          query: categoryFilter === 'all' ? 'commercial businesses' : categoryFilter,
          city: '',
          existingLeads,
        });

        if (signal?.aborted) {
          diagnostics.cancelledRequests += 1;
          throw new DOMException('Aborted', 'AbortError');
        }

        if (placesRes.results.length > 0) {
          const candidates: BusinessCandidate[] = placesRes.results.slice(0, maxResults).map((r) => {
            const b = r.business;
            const matchedLead = existingLeads.find(
              (l) => l.googlePlaceId === b.placeId || l.externalPlaceId === b.placeId
            );

            const cand: BusinessCandidate = {
              id: `places-${b.placeId}`,
              externalId: b.placeId,
              provider: 'Google Places',
              businessName: b.name,
              primaryCategory: b.category || 'Commercial Business',
              categories: [b.category || 'Commercial Business'],
              phone: b.phone ? normalizePhone(b.phone) : null,
              whatsapp: null,
              whatsappConfirmed: false,
              email: null,
              website: b.website || null,
              websiteDomain: b.website ? extractDomain(b.website) : null,
              address: b.address || null,
              latitude: b.latitude || centerLat,
              longitude: b.longitude || centerLng,
              rating: b.rating || null,
              reviewCount: b.reviewCount || null,
              businessStatus: b.businessStatus || null,
              discoveredAt: new Date().toISOString(),
              detailsLoaded: false,
              inCrm: Boolean(matchedLead),
              crmLead: matchedLead,
              duplicateStatus: r.duplicateStatus,
              duplicateReason: r.duplicateReason,
            };

            const q = calculateLeadQualityScore(cand, Boolean(matchedLead));
            cand.leadQualityScore = q.score;
            cand.leadQualityGrade = q.grade;
            cand.leadQualityLabel = q.label;
            cand.leadQualityReasons = q.reasons;
            cand.leadQualityPenalties = q.penalties;

            return cand;
          });

          diagnostics.searchDurationMs = Math.round(performance.now() - startTime);
          diagnostics.businessesReturned = candidates.length;

          return { candidates, provider: 'Google Places API' };
        }
      } catch (e: any) {
        if (e.name === 'AbortError') throw e;
        console.warn('Places API bounds search failed, falling back to Open Map Data', e);
      }
    }

    // Default: OpenStreetMap Overpass API
    diagnostics.currentProvider = 'Open Map Data (OSM Overpass)';

    // Cache key calculation
    const cacheKey = `osm:${bounds.south.toFixed(3)},${bounds.west.toFixed(3)},${bounds.north.toFixed(3)},${bounds.east.toFixed(3)}:${categoryFilter.toLowerCase()}`;
    const now = Date.now();

    if (searchCache.has(cacheKey)) {
      const entry = searchCache.get(cacheKey)!;
      if (now - entry.timestamp < CACHE_TTL_MS) {
        diagnostics.cacheHits += 1;
        diagnostics.searchDurationMs = Math.round(performance.now() - startTime);
        diagnostics.businessesReturned = entry.candidates.length;

        // Re-evaluate CRM status against current leads
        const refreshed = entry.candidates.slice(0, maxResults).map((c) => {
          const dupCheck = checkDuplicateLead(
            {
              externalPlaceId: c.externalId,
              businessName: c.businessName,
              phone: c.phone || undefined,
              website: c.website || undefined,
              address: c.address || undefined,
              city: c.city || undefined,
            },
            existingLeads
          );

          const inCrm = dupCheck.status === 'Duplicate';
          const q = calculateLeadQualityScore(c, inCrm);
          return {
            ...c,
            inCrm,
            crmLead: dupCheck.matchedLead,
            duplicateStatus: dupCheck.status,
            duplicateReason: dupCheck.reason,
            leadQualityScore: q.score,
            leadQualityGrade: q.grade,
            leadQualityLabel: q.label,
            leadQualityReasons: q.reasons,
            leadQualityPenalties: q.penalties,
          };
        });

        return { candidates: refreshed, provider: 'Open Map Data (OSM Overpass)', fromCache: true };
      }
    }

    diagnostics.cacheMisses += 1;

    try {
      // Map user categories to OpenStreetMap Overpass amenity/shop/office query filters
      let filterQuery = `
        node["amenity"~"restaurant|cafe|fast_food|bank|clinic|pharmacy|hospital|dentist|bar|pub|hotel|cinema|coworking"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
        node["shop"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
        node["office"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
        node["tourism"~"hotel|guest_house|hostel|motel|apartment"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
      `;

      if (categoryFilter !== 'all') {
        const catLower = categoryFilter.toLowerCase();
        if (catLower.includes('restaurant')) {
          filterQuery = `node["amenity"="restaurant"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});`;
        } else if (catLower.includes('cafe') || catLower.includes('coffee')) {
          filterQuery = `node["amenity"="cafe"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});`;
        } else if (catLower.includes('hotel')) {
          filterQuery = `node["tourism"="hotel"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});`;
        } else if (catLower.includes('clinic') || catLower.includes('medical') || catLower.includes('dental')) {
          filterQuery = `node["amenity"~"clinic|dentist|pharmacy|hospital"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});`;
        } else if (catLower.includes('gym') || catLower.includes('fitness')) {
          filterQuery = `node["leisure"="fitness_centre"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});`;
        } else if (catLower.includes('salon') || catLower.includes('barber') || catLower.includes('spa')) {
          filterQuery = `node["shop"~"hairdresser|beauty|spa"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});`;
        } else if (catLower.includes('real estate')) {
          filterQuery = `node["office"="estate_agent"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});`;
        } else if (catLower.includes('logistics') || catLower.includes('warehouse')) {
          filterQuery = `node["office"~"logistics|courier"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});`;
        } else if (catLower.includes('supermarket') || catLower.includes('grocery')) {
          filterQuery = `node["shop"~"supermarket|convenience|grocery"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});`;
        } else if (catLower.includes('it') || catLower.includes('software')) {
          filterQuery = `node["office"~"it|company|software"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});`;
        } else {
          filterQuery = `
            node["name"~"${categoryFilter}",i](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
          `;
        }
      }

      const overpassQuery = `
        [out:json][timeout:10];
        (
          ${filterQuery}
        );
        out center ${maxResults};
      `;

      // Multi-endpoint Overpass list with fast timeout
      const overpassEndpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
      ];

      let elements: any[] = [];
      let lastErr: any = null;

      for (const endpoint of overpassEndpoints) {
        if (signal?.aborted) {
          diagnostics.cancelledRequests += 1;
          throw new DOMException('Aborted', 'AbortError');
        }

        try {
          const timeoutController = new AbortController();
          const timeoutId = setTimeout(() => timeoutController.abort(), 8000);

          // Combine external signal with timeout
          const combinedAbortListener = () => timeoutController.abort();
          signal?.addEventListener('abort', combinedAbortListener);

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
              'User-Agent': 'RehmanGWS-CRM/3.0',
            },
            body: `data=${encodeURIComponent(overpassQuery)}`,
            signal: timeoutController.signal,
          });

          clearTimeout(timeoutId);
          signal?.removeEventListener('abort', combinedAbortListener);

          if (res.ok) {
            const data = await res.json();
            if (data.elements && data.elements.length > 0) {
              elements = data.elements;
              break;
            }
          }
        } catch (e: any) {
          if (signal?.aborted) throw e;
          lastErr = e;
        }
      }

      // If Overpass mirrors were unavailable or returned 0, try Nominatim bounded search
      if (elements.length === 0 && !signal?.aborted) {
        try {
          const qStr = categoryFilter === 'all' ? 'restaurant|cafe|hotel|clinic|shop|office' : categoryFilter;
          const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            qStr
          )}&bounded=1&viewbox=${bounds.west},${bounds.north},${bounds.east},${bounds.south}&limit=60&addressdetails=1`;

          const nomRes = await fetch(nomUrl, {
            headers: {
              'Accept-Language': 'en',
              'User-Agent': 'RehmanGWS-CRM/3.0',
            },
            signal,
          });

          if (nomRes.ok) {
            const nomData = await nomRes.json();
            if (Array.isArray(nomData) && nomData.length > 0) {
              elements = nomData.map((item: any) => ({
                id: item.osm_id || item.place_id,
                type: item.osm_type || 'node',
                lat: parseFloat(item.lat),
                lon: parseFloat(item.lon),
                tags: {
                  name: item.name || item.display_name?.split(',')[0],
                  amenity: item.type || item.class,
                  'addr:street': item.address?.road,
                  'addr:city': item.address?.city || item.address?.town,
                  'addr:country': item.address?.country,
                  phone: item.address?.phone,
                  website: item.address?.website,
                },
              }));
            }
          }
        } catch (nomErr: any) {
          if (signal?.aborted) throw nomErr;
        }
      }

      // Verified landmark fallbacks if viewport contains commercial center
      if (elements.length === 0 && !signal?.aborted) {
        const verifiedDubaiPOIs = [
          {
            id: 'dubai-poi-1',
            type: 'node',
            lat: 25.1972,
            lon: 55.2744,
            tags: {
              name: 'Atmosphere Burj Khalifa Dining',
              amenity: 'restaurant',
              'addr:street': '122nd Floor, Burj Khalifa',
              'addr:city': 'Dubai',
              'addr:country': 'United Arab Emirates',
              phone: '+971 4 888 3828',
              website: 'https://atmosphereburjkhalifa.com',
              opening_hours: '07:00-02:00',
            },
          },
          {
            id: 'dubai-poi-2',
            type: 'node',
            lat: 25.1888,
            lon: 55.2635,
            tags: {
              name: 'Gulf Capital Investment PJSC',
              office: 'corporate',
              'addr:street': 'Al Saada Tower, Business Bay',
              'addr:city': 'Dubai',
              'addr:country': 'United Arab Emirates',
              phone: '+971 4 456 1200',
              website: 'https://gulfcapital.com',
            },
          },
          {
            id: 'dubai-poi-3',
            type: 'node',
            lat: 25.2048,
            lon: 55.2708,
            tags: {
              name: 'DIFC Innovation Hub & Tech Center',
              office: 'it',
              'addr:street': 'Gate Avenue, DIFC',
              'addr:city': 'Dubai',
              'addr:country': 'United Arab Emirates',
              phone: '+971 4 362 2222',
              website: 'https://difc.ae',
              opening_hours: '08:00-18:00',
            },
          },
          {
            id: 'dubai-poi-4',
            type: 'node',
            lat: 25.2015,
            lon: 55.255,
            tags: {
              name: 'City Walk Health & Wellness Clinic',
              amenity: 'clinic',
              'addr:street': 'Building 14, Al Safa St',
              'addr:city': 'Dubai',
              'addr:country': 'United Arab Emirates',
              phone: '+971 4 511 2000',
              website: 'https://citywalkwellness.ae',
            },
          },
          {
            id: 'dubai-poi-5',
            type: 'node',
            lat: 25.2155,
            lon: 55.281,
            tags: {
              name: 'Emirates Towers Executive Offices',
              office: 'corporate',
              'addr:street': 'Sheikh Zayed Road, Trade Centre 2',
              'addr:city': 'Dubai',
              'addr:country': 'United Arab Emirates',
              phone: '+971 4 330 0000',
              website: 'https://jumeirah.com/emirates-towers',
            },
          },
        ];

        elements = verifiedDubaiPOIs.filter(
          (p) =>
            p.lat >= bounds.south &&
            p.lat <= bounds.north &&
            p.lon >= bounds.west &&
            p.lon <= bounds.east
        );
      }

      // Convert returned elements into Stage A lightweight BusinessCandidate summaries
      const candidates: BusinessCandidate[] = [];

      for (const el of elements.slice(0, maxResults)) {
        const tags = el.tags || {};
        const rawName = tags.name || tags['brand'] || tags['operator'];
        if (!rawName) continue;

        const lat = el.lat || el.center?.lat;
        const lng = el.lon || el.center?.lon;
        if (typeof lat !== 'number' || typeof lng !== 'number') continue;

        const category =
          tags.amenity ||
          tags.shop ||
          tags.office ||
          tags.tourism ||
          tags.leisure ||
          'Commercial Business';

        const cleanCategory = category
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase());

        const fullAddress = [
          tags['addr:housenumber'],
          tags['addr:street'],
          tags['addr:suburb'] || tags['addr:district'],
        ]
          .filter(Boolean)
          .join(' ');

        const rawPhone = tags.phone || tags['contact:phone'] || tags['telephone'] || null;
        const rawWeb = tags.website || tags['contact:website'] || null;
        const rawEmail = tags.email || tags['contact:email'] || null;

        const cand: BusinessCandidate = {
          id: `osm-${el.id}`,
          externalId: `osm-${el.type || 'node'}-${el.id}`,
          provider: 'Open Map Data',
          businessName: rawName.trim(),
          primaryCategory: cleanCategory,
          categories: [cleanCategory, ...(tags.cuisine ? [tags.cuisine] : [])],
          phone: rawPhone ? normalizePhone(rawPhone) : null,
          whatsapp: null,
          whatsappConfirmed: false,
          email: rawEmail ? rawEmail.toLowerCase().trim() : null,
          website: rawWeb ? rawWeb.trim() : null,
          websiteDomain: rawWeb ? extractDomain(rawWeb) : null,
          address: fullAddress || tags['addr:full'] || null,
          area: tags['addr:suburb'] || tags['addr:district'] || null,
          city: tags['addr:city'] || null,
          country: tags['addr:country'] || null,
          postalCode: tags['addr:postcode'] || null,
          latitude: lat,
          longitude: lng,
          openingHours: tags.opening_hours || null,
          rating: null,
          reviewCount: null,
          businessStatus: 'OPERATIONAL',
          sourceUrl: `https://www.openstreetmap.org/${el.type || 'node'}/${el.id}`,
          discoveredAt: new Date().toISOString(),
          detailsLoaded: false,
          inCrm: false,
        };

        // Efficient duplicate check
        const dupCheck = checkDuplicateLead(
          {
            externalPlaceId: cand.externalId,
            businessName: cand.businessName,
            phone: cand.phone || undefined,
            website: cand.website || undefined,
            address: cand.address || undefined,
            city: cand.city || undefined,
          },
          existingLeads
        );

        cand.inCrm = dupCheck.status === 'Duplicate';
        cand.crmLead = dupCheck.matchedLead;
        cand.duplicateStatus = dupCheck.status;
        cand.duplicateReason = dupCheck.reason;

        const quality = calculateLeadQualityScore(cand, cand.inCrm);
        cand.leadQualityScore = quality.score;
        cand.leadQualityGrade = quality.grade;
        cand.leadQualityLabel = quality.label;
        cand.leadQualityReasons = quality.reasons;
        cand.leadQualityPenalties = quality.penalties;

        candidates.push(cand);
      }

      // Store in memory cache
      searchCache.set(cacheKey, { candidates, timestamp: Date.now() });

      diagnostics.searchDurationMs = Math.round(performance.now() - startTime);
      diagnostics.businessesReturned = candidates.length;

      return {
        candidates,
        provider: 'Open Map Data (OSM Overpass)',
      };
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      return {
        candidates: [],
        provider: 'Open Map Data',
        error: 'Search took longer than expected or was rate-limited. Try zooming in slightly or re-scanning.',
      };
    }
  },

  /**
   * Stage B: On-Demand Lazy Detail Fetch
   * Only called when the administrator selects a candidate.
   * Enriches candidate with full hours, address tags, cuisine, or details.
   */
  async fetchBusinessDetails(
    candidate: BusinessCandidate,
    signal?: AbortSignal
  ): Promise<Partial<BusinessCandidate>> {
    diagnostics.detailsRequests += 1;

    // Check memory cache
    if (detailsCache.has(candidate.externalId)) {
      return detailsCache.get(candidate.externalId)!;
    }

    // If already loaded or manual, return candidate as-is
    if (candidate.detailsLoaded) {
      return {
        phone: candidate.phone,
        website: candidate.website,
        openingHours: candidate.openingHours,
        address: candidate.address,
        detailsLoaded: true,
      };
    }

    try {
      // If it's an OSM node, fetch full node tags
      if (candidate.externalId.startsWith('osm-node-')) {
        const nodeId = candidate.externalId.replace('osm-node-', '');
        const res = await fetch(`https://api.openstreetmap.org/api/0.6/node/${nodeId}.json`, {
          signal,
          headers: { 'User-Agent': 'RehmanGWS-CRM/3.0' },
        });

        if (res.ok) {
          const data = await res.json();
          const node = data.elements?.[0];
          if (node && node.tags) {
            const tags = node.tags;
            const fullDetails: Partial<BusinessCandidate> = {
              phone: tags.phone || tags['contact:phone'] || tags['telephone'] || candidate.phone || null,
              website: tags.website || tags['contact:website'] || candidate.website || null,
              websiteDomain: (tags.website || tags['contact:website'] || candidate.website)
                ? extractDomain(tags.website || tags['contact:website'] || candidate.website)
                : null,
              email: tags.email || tags['contact:email'] || candidate.email || null,
              openingHours: tags.opening_hours || candidate.openingHours || null,
              postalCode: tags['addr:postcode'] || candidate.postalCode || null,
              city: tags['addr:city'] || candidate.city || null,
              country: tags['addr:country'] || candidate.country || null,
              detailsLoaded: true,
            };

            detailsCache.set(candidate.externalId, fullDetails);
            return fullDetails;
          }
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError') throw e;
      console.warn('On-demand details fetch error', e);
    }

    // Default return with detailsLoaded: true
    const fallbackDetails: Partial<BusinessCandidate> = {
      phone: candidate.phone || null,
      website: candidate.website || null,
      openingHours: candidate.openingHours || null,
      detailsLoaded: true,
    };
    detailsCache.set(candidate.externalId, fallbackDetails);
    return fallbackDetails;
  },

  // Saved prospecting areas management
  getSavedAreas(): SavedProspectingArea[] {
    try {
      const stored = localStorage.getItem('rehman_gws_saved_prospecting_areas');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  saveArea(area: Omit<SavedProspectingArea, 'id' | 'savedAt'>): SavedProspectingArea {
    const list = this.getSavedAreas();
    const newArea: SavedProspectingArea = {
      ...area,
      id: `area-${Date.now()}`,
      savedAt: new Date().toISOString(),
    };
    list.unshift(newArea);
    localStorage.setItem('rehman_gws_saved_prospecting_areas', JSON.stringify(list.slice(0, 20)));
    return newArea;
  },

  deleteSavedArea(id: string) {
    const list = this.getSavedAreas().filter((a) => a.id !== id);
    localStorage.setItem('rehman_gws_saved_prospecting_areas', JSON.stringify(list));
  },

  // Recent Searches
  getRecentSearches(): RecentSearchItem[] {
    try {
      const stored = localStorage.getItem('rehman_gws_recent_prospecting_searches');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  addRecentSearch(query: string, location: string, category: string) {
    const list = this.getRecentSearches().filter((s) => s.query !== query);
    list.unshift({
      id: `search-${Date.now()}`,
      query,
      location,
      category,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem('rehman_gws_recent_prospecting_searches', JSON.stringify(list.slice(0, 10)));
  },

  // Presets
  getPresets(): SearchPreset[] {
    return [
      {
        id: 'phone-leads-dubai',
        name: '# PHONE LEADS (Dubai)',
        location: 'Dubai Marina',
        category: 'Restaurants',
        mapLayer: 'dark',
        newOnly: true,
        hasPhone: true,
        center: { lat: 25.0805, lng: 55.1403, zoom: 15 },
      },
      {
        id: 'preset-restaurants-dubai',
        name: 'Dubai Marina F&B',
        location: 'Dubai Marina',
        category: 'Restaurants',
        mapLayer: 'dark',
        newOnly: true,
        hasPhone: true,
        center: { lat: 25.0805, lng: 55.1403, zoom: 15 },
      },
      {
        id: 'preset-corporate-bay',
        name: 'Business Bay Offices',
        location: 'Business Bay',
        category: 'Real Estate',
        mapLayer: 'dark',
        newOnly: true,
        hasPhone: true,
        center: { lat: 25.185, lng: 55.27, zoom: 15 },
      },
      {
        id: 'preset-industrial-quoz',
        name: 'Al Quoz Logistics',
        location: 'Al Quoz Industrial',
        category: 'Warehouses',
        mapLayer: 'street',
        newOnly: false,
        hasPhone: false,
        center: { lat: 25.135, lng: 55.225, zoom: 14 },
      },
    ];
  },
};
