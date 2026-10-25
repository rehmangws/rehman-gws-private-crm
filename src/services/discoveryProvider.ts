import { Lead } from '../types/crm';
import { checkDuplicateLead } from '../utils/normalizer';

export interface DiscoveredBusiness {
  placeId: string;
  name: string;
  category?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  reviewCount?: number;
  businessStatus?: string;
}

export interface DiscoverySearchResult {
  provider: string;
  isConfigured: boolean;
  statusMessage?: string;
  results: {
    business: DiscoveredBusiness;
    duplicateStatus: 'Unique' | 'Possible Duplicate' | 'Duplicate';
    duplicateReason?: string;
  }[];
}

export const DiscoveryProvider = {
  isPlacesConfigured(): boolean {
    const key = localStorage.getItem('rehman_gws_google_places_key') || import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
    return Boolean(key && key.trim().length > 10);
  },

  async searchBusinesses(params: {
    query: string;
    city?: string;
    country?: string;
    existingLeads: Lead[];
  }): Promise<DiscoverySearchResult> {
    const isConfigured = this.isPlacesConfigured();

    if (!isConfigured) {
      return {
        provider: 'Google Places API',
        isConfigured: false,
        statusMessage:
          'External Lead Discovery Not Configured. To enable automated business discovery, provide an official Google Places API key in Settings -> Google API Configuration. In the meantime, you can capture leads directly via the World Map or Add Lead form.',
        results: [],
      };
    }

    const apiKey = localStorage.getItem('rehman_gws_google_places_key') || import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

    try {
      const fullQuery = [params.query, params.city, params.country].filter(Boolean).join(' ');
      // Official Google Places TextSearch endpoint via client or proxy
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
        fullQuery
      )}&key=${apiKey}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(data.error_message || `Places API status: ${data.status}`);
      }

      const results = (data.results || []).map((item: any) => {
        const bus: DiscoveredBusiness = {
          placeId: item.place_id,
          name: item.name,
          category: item.types?.[0]?.replace(/_/g, ' ') || 'Business',
          address: item.formatted_address,
          latitude: item.geometry?.location?.lat,
          longitude: item.geometry?.location?.lng,
          rating: item.rating,
          reviewCount: item.user_ratings_total,
          businessStatus: item.business_status,
        };

        const dupCheck = checkDuplicateLead(
          {
            googlePlaceId: bus.placeId,
            businessName: bus.name,
            address: bus.address,
            city: params.city,
          },
          params.existingLeads
        );

        return {
          business: bus,
          duplicateStatus: dupCheck.status,
          duplicateReason: dupCheck.reason,
        };
      });

      return {
        provider: 'Google Places API',
        isConfigured: true,
        results,
      };
    } catch (err: any) {
      return {
        provider: 'Google Places API',
        isConfigured: true,
        statusMessage: `Discovery lookup error: ${err.message || 'Network/CORS error'}. Note: For production use, configure a server-side proxy route or valid API key permissions.`,
        results: [],
      };
    }
  },
};
