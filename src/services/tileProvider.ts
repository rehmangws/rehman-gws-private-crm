export type MapLayerMode = 'dark' | 'street' | 'satellite' | 'hybrid';

export interface TileLayerConfig {
  id: MapLayerMode;
  name: string;
  description: string;
  url: string;
  attribution: string;
  overlayUrl?: string;
  overlayAttribution?: string;
  maxZoom: number;
  isDarkCssFilter: boolean;
  requiresKey: boolean;
  isConfigured: boolean;
  providerStatus: 'ready' | 'limited' | 'offline';
}

export const MAP_LAYERS: Record<MapLayerMode, TileLayerConfig> = {
  dark: {
    id: 'dark',
    name: 'REHMAN Dark',
    description: 'High-contrast midnight GIS view optimized for CRM marker visibility',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    isDarkCssFilter: true,
    requiresKey: false,
    isConfigured: true,
    providerStatus: 'ready',
  },
  street: {
    id: 'street',
    name: 'Street Map',
    description: 'Standard municipal road and landmark exploration',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    isDarkCssFilter: false,
    requiresKey: false,
    isConfigured: true,
    providerStatus: 'ready',
  },
  satellite: {
    id: 'satellite',
    name: 'Satellite Aerial',
    description: 'High-resolution global satellite photography (Esri World Imagery)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and GIS User Community',
    maxZoom: 19,
    isDarkCssFilter: false,
    requiresKey: false,
    isConfigured: true,
    providerStatus: 'ready',
  },
  hybrid: {
    id: 'hybrid',
    name: 'Hybrid Satellite',
    description: 'Satellite photography with street boundaries and municipal place labels',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    overlayUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, DeLorme, NAVTEQ',
    overlayAttribution: 'Labels &copy; Esri, DeLorme',
    maxZoom: 19,
    isDarkCssFilter: false,
    requiresKey: false,
    isConfigured: true,
    providerStatus: 'ready',
  },
};

export const MapTileProvider = {
  getLayer(id: MapLayerMode): TileLayerConfig {
    return MAP_LAYERS[id] || MAP_LAYERS.dark;
  },

  getAllLayers(): TileLayerConfig[] {
    return Object.values(MAP_LAYERS);
  },
};
