import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Lead, Category } from '../../types/crm';
import {
  BusinessCandidate,
  BusinessMapService,
  MapBounds,
  SavedProspectingArea,
  RecentSearchItem,
  SearchPreset,
  DiscoveryDiagnostics,
} from '../../services/businessMapService';
import { OpenStreetMapProvider } from '../../services/mapProvider';
import { MapLayerMode, MapTileProvider, TileLayerConfig } from '../../services/tileProvider';
import { clusterPoints } from '../../utils/clusterEngine';
import { calculateLeadQualityScore } from '../../utils/leadQualityEngine';
import { parseNaturalQuery } from '../../utils/naturalQueryParser';
import { boundsFromRadius } from '../../utils/geoScanner';
import { CRMStorage } from '../../services/crmStorage';
import { LeadHuntModal } from './LeadHuntModal';
import { AreaScannerModal } from './AreaScannerModal';
import L from 'leaflet';
import {
  Search,
  Plus,
  Compass,
  Filter,
  Layers,
  MapPin,
  Phone,
  MessageSquare,
  Mail,
  Globe,
  Calendar,
  X,
  Maximize2,
  Minimize2,
  Check,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  List,
  Columns,
  Map as MapIcon,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Radar,
  Navigation,
  Crosshair,
  Zap,
  Info,
  Activity,
  Sliders,
} from 'lucide-react';

interface BusinessMapProps {
  leads: Lead[];
  categories: Category[];
  onOpenLeadProfile: (lead: Lead) => void;
  onAddLeadAtCoordinates: (coords: { lat: number; lng: number; address?: string; city?: string; country?: string }) => void;
  onCustomizeAddLead: (prefill: Partial<Lead>) => void;
  onRefreshData: () => Promise<void>;
}

export type MapMode = 'discover' | 'crm' | 'combined';
export type ViewLayout = 'map' | 'list' | 'split';
export type CandidatesTab = 'best' | 'all' | 'new' | 'phone' | 'website' | 'crm' | 'skipped';
export type ContactFilterMode = 'all' | 'phone' | 'website' | 'email' | 'whatsapp' | 'any';

const MAX_VISIBLE_RESULTS = 150;

const POPULAR_CATEGORY_CHIPS = [
  'Restaurants',
  'Hotels',
  'Real Estate',
  'Cleaning',
  'Warehouses',
  'Logistics',
  'Construction',
  'Recruitment',
  'Salons',
  'Clinics',
  'Retail',
  'IT & Tech',
  'Marketing',
  'Security',
];

export const BusinessMap: React.FC<BusinessMapProps> = ({
  leads,
  categories,
  onOpenLeadProfile,
  onAddLeadAtCoordinates,
  onCustomizeAddLead,
  onRefreshData,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayTileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const coverageLayerRef = useRef<L.LayerGroup | null>(null);
  const tempMarkerRef = useRef<L.Marker | null>(null);

  // Search Cancellation & ID tracking
  const activeSearchControllerRef = useRef<AbortController | null>(null);
  const searchIdRef = useRef<number>(0);
  const lazyDetailControllerRef = useRef<AbortController | null>(null);

  // Map & GIS Layer State
  const [activeLayerMode, setActiveLayerMode] = useState<MapLayerMode>('dark');
  const [viewLayout, setViewLayout] = useState<ViewLayout>('map');
  const [mapMode, setMapMode] = useState<MapMode>('combined');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(13);

  // Quick Find & Search State
  const [quickWhere, setQuickWhere] = useState('Dubai Marina');
  const [quickWhat, setQuickWhat] = useState('Restaurants');
  const [quickLimit, setQuickLimit] = useState(100);
  const [naturalQueryInput, setNaturalQueryInput] = useState('');
  const [parsedConfirmation, setParsedConfirmation] = useState<string | null>(null);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);

  // Discovery State
  const [discoveredBusinesses, setDiscoveredBusinesses] = useState<BusinessCandidate[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [discoveryProviderName, setDiscoveryProviderName] = useState('Open Map Data (OSM Overpass)');
  const [showSearchThisAreaPrompt, setShowSearchThisAreaPrompt] = useState(false);
  const [searchedCoverage, setSearchedCoverage] = useState<MapBounds[]>([]);

  // Selection & Right Drawer
  const [selectedCandidate, setSelectedCandidate] = useState<BusinessCandidate | null>(null);
  const [selectedCrmLead, setSelectedCrmLead] = useState<Lead | null>(null);
  const [candidatesTab, setCandidatesTab] = useState<CandidatesTab>('best');
  const [sortBy, setSortBy] = useState<'quality' | 'name' | 'category'>('quality');

  // Contactability & State Filters
  const [contactFilter, setContactFilter] = useState<ContactFilterMode>('all');
  const [newOnlyFilter, setNewOnlyFilter] = useState(false);

  // Session Tracking & Metrics
  const [addedThisSession, setAddedThisSession] = useState(0);
  const [skippedThisSession, setSkippedThisSession] = useState(0);

  // Modals & Presets
  const [isHuntModalOpen, setIsHuntModalOpen] = useState(false);
  const [huntIndex, setHuntIndex] = useState(0);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [isRadiusMenuOpen, setIsRadiusMenuOpen] = useState(false);
  const [savedAreas, setSavedAreas] = useState<SavedProspectingArea[]>(BusinessMapService.getSavedAreas());
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>(BusinessMapService.getRecentSearches());
  const [presets] = useState<SearchPreset[]>(BusinessMapService.getPresets());

  // Diagnostics & Dev Info
  const [diagnostics, setDiagnostics] = useState<DiscoveryDiagnostics>(BusinessMapService.getDiagnostics());
  const [showDevPanel, setShowDevPanel] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Switch Map Tile Layer dynamically
  const switchMapLayer = (mode: MapLayerMode) => {
    setActiveLayerMode(mode);
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
      baseTileLayerRef.current = null;
    }
    if (overlayTileLayerRef.current) {
      map.removeLayer(overlayTileLayerRef.current);
      overlayTileLayerRef.current = null;
    }

    const config: TileLayerConfig = MapTileProvider.getLayer(mode);

    const container = mapContainerRef.current;
    if (container) {
      const tilePane = container.querySelector('.leaflet-tile-pane') as HTMLElement | null;
      if (tilePane) {
        if (config.isDarkCssFilter) {
          tilePane.style.filter = 'brightness(0.65) invert(1) contrast(3.5) hue-rotate(200deg) saturate(0.3)';
        } else {
          tilePane.style.filter = 'none';
        }
      }
    }

    const newBase = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
    }).addTo(map);
    baseTileLayerRef.current = newBase;

    if (config.overlayUrl) {
      const newOverlay = L.tileLayer(config.overlayUrl, {
        attribution: config.overlayAttribution || '',
        maxZoom: config.maxZoom,
      }).addTo(map);
      overlayTileLayerRef.current = newOverlay;
    }
  };

  // Initialize Map strictly ONCE
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = 25.0805; // Dubai Marina
    const initialLng = 55.1403;
    const initialZoom = 14;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: false,
    });
    mapInstanceRef.current = map;

    // Set initial dark layer
    const config = MapTileProvider.getLayer('dark');
    const tileLayer = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
    }).addTo(map);
    baseTileLayerRef.current = tileLayer;

    // Dark CSS filter
    setTimeout(() => {
      const tilePane = mapContainerRef.current?.querySelector('.leaflet-tile-pane') as HTMLElement | null;
      if (tilePane) {
        tilePane.style.filter = 'brightness(0.65) invert(1) contrast(3.5) hue-rotate(200deg) saturate(0.3)';
      }
    }, 100);

    // Marker layers
    const coverageLayer = L.layerGroup().addTo(map);
    coverageLayerRef.current = coverageLayer;

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;

    // Zoom & Move listeners: NEVER automatically search! Only prompt "Search This Area"
    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
      setShowSearchThisAreaPrompt(true);
    });

    map.on('moveend', () => {
      setShowSearchThisAreaPrompt(true);
    });

    // Map Click: adds lead at coordinates
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (tempMarkerRef.current) tempMarkerRef.current.remove();

      const tempMarker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'temp-marker',
          html: `
            <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
              <div style="position: absolute; width: 22px; height: 22px; border-radius: 50%; background-color: #38BDF8; opacity: 0.3;"></div>
              <div style="width: 14px; height: 14px; border-radius: 50%; background-color: #38BDF8; border: 2.5px solid #080B11; box-shadow: 0 0 10px #38BDF8;"></div>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      }).addTo(map);
      tempMarkerRef.current = tempMarker;

      const geo = await OpenStreetMapProvider.reverse(lat, lng);
      onAddLeadAtCoordinates({
        lat,
        lng,
        address: geo?.address,
        city: geo?.city,
        country: geo?.country,
      });
    });

    // Setup ResizeObserver to fix the map container resize freeze!
    let resizeObserver: ResizeObserver | null = null;
    if (mapContainerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      if (activeSearchControllerRef.current) {
        activeSearchControllerRef.current.abort();
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Invalidate map size on layout / panel changes to prevent container lockups
  useEffect(() => {
    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [selectedCandidate, selectedCrmLead, viewLayout, isFullscreen]);

  // Update CRM status on candidates when CRM leads change
  useEffect(() => {
    setDiscoveredBusinesses((prev) =>
      prev.map((b) => {
        const matched = leads.find(
          (l) =>
            (l.externalPlaceId && l.externalPlaceId === b.externalId) ||
            (b.phone && l.phoneNormalized && l.phoneNormalized === b.phone.replace(/[^\d+]/g, '')) ||
            (l.businessName.toLowerCase() === b.businessName.toLowerCase())
        );
        const inCrm = Boolean(matched);
        const quality = calculateLeadQualityScore(b, inCrm);
        return {
          ...b,
          inCrm,
          crmLead: matched,
          leadQualityScore: quality.score,
          leadQualityGrade: quality.grade,
          leadQualityLabel: quality.label,
          leadQualityReasons: quality.reasons,
          leadQualityPenalties: quality.penalties,
        };
      })
    );
  }, [leads]);

  // Execute Search in Bounds with AbortController and Request ID Protection
  const executeDiscovery = async (bounds: MapBounds, category: string) => {
    // Area Too Large Protection (Section 35)
    if (mapInstanceRef.current && mapInstanceRef.current.getZoom() < 11) {
      setDiscoveryError('Zoom in to a city district or commercial area to find businesses faster.');
      return;
    }

    // Cancel any previous in-flight search
    if (activeSearchControllerRef.current) {
      activeSearchControllerRef.current.abort();
      BusinessMapService.recordCancelledRequest();
    }

    const currentSearchId = ++searchIdRef.current;
    const controller = new AbortController();
    activeSearchControllerRef.current = controller;

    setIsDiscovering(true);
    setDiscoveryError(null);
    setShowSearchThisAreaPrompt(false);

    try {
      const res = await BusinessMapService.searchInBounds(
        bounds,
        category,
        leads,
        controller.signal,
        quickLimit
      );

      // Check if this response has been superseded by a newer search
      if (searchIdRef.current !== currentSearchId) {
        return;
      }

      setIsDiscovering(false);
      setDiscoveryProviderName(res.provider);
      setDiagnostics(BusinessMapService.getDiagnostics());

      if (res.error) {
        setDiscoveryError(res.error);
      } else {
        // Merge & deduplicate
        setDiscoveredBusinesses((prev) => {
          const existingIds = new Set(prev.map((p) => p.externalId));
          const newItems = res.candidates.filter((c) => !existingIds.has(c.externalId));
          return [...newItems, ...prev].slice(0, 300); // Keep memory bounded
        });

        // Add to coverage
        setSearchedCoverage((prev) => [bounds, ...prev.slice(0, 10)]);

        if (res.candidates.length > 0) {
          showToast(`Found ${res.candidates.length} business candidates in this area.`);
        } else {
          setDiscoveryError('No businesses returned by the data source for this area. Try changing category or zooming out slightly.');
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return; // Normal cancellation, do nothing
      }
      if (searchIdRef.current === currentSearchId) {
        setIsDiscovering(false);
        setDiscoveryError('Search request timed out. Try zooming into a smaller commercial district.');
      }
    } finally {
      if (searchIdRef.current === currentSearchId) {
        setIsDiscovering(false);
      }
    }
  };

  // Search This Area Button Action
  const handleSearchThisArea = async () => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    if (map.getZoom() < 11) {
      setDiscoveryError('Zoom in closer to a district or street level to discover individual businesses.');
      return;
    }

    const b = map.getBounds();
    const mapBounds: MapBounds = {
      south: b.getSouth(),
      west: b.getWest(),
      north: b.getNorth(),
      east: b.getEast(),
    };

    await executeDiscovery(mapBounds, quickWhat);
  };

  // Quick Find Action
  const handleQuickFind = async () => {
    if (!mapInstanceRef.current) return;
    setIsSearchingLocation(true);

    try {
      const geocodeResults = await OpenStreetMapProvider.search(quickWhere);
      setIsSearchingLocation(false);

      if (geocodeResults.length > 0) {
        const top = geocodeResults[0];
        mapInstanceRef.current.flyTo([top.latitude, top.longitude], 15, { duration: 1.0 });

        const radiusMeters = quickLimit > 50 ? 2500 : 1200;
        const bounds = boundsFromRadius(top.latitude, top.longitude, radiusMeters);

        setTimeout(() => {
          executeDiscovery(bounds, quickWhat);
        }, 1100);

        BusinessMapService.addRecentSearch(
          `${quickWhat} in ${quickWhere}`,
          quickWhere,
          quickWhat
        );
        setRecentSearches(BusinessMapService.getRecentSearches());
      } else {
        handleSearchThisArea();
      }
    } catch {
      setIsSearchingLocation(false);
      handleSearchThisArea();
    }
  };

  // Natural Language Search Parser
  const handleNaturalSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!naturalQueryInput.trim()) return;

    const parsed = parseNaturalQuery(naturalQueryInput);
    setParsedConfirmation(parsed.confirmationLabel);
    setQuickWhat(parsed.category);
    if (parsed.location && parsed.location !== 'Current Map Area') {
      setQuickWhere(parsed.location);
    }

    if (parsed.location && parsed.location !== 'Current Map Area') {
      setIsSearchingLocation(true);
      const results = await OpenStreetMapProvider.search(parsed.location);
      setIsSearchingLocation(false);

      if (results.length > 0) {
        const top = results[0];
        mapInstanceRef.current?.flyTo([top.latitude, top.longitude], 15, { duration: 1.0 });
        const radiusMeters = parsed.radiusKm ? parsed.radiusKm * 1000 : 1500;
        const bounds = boundsFromRadius(top.latitude, top.longitude, radiusMeters);
        setTimeout(() => {
          executeDiscovery(bounds, parsed.category);
        }, 1100);
      }
    } else {
      handleSearchThisArea();
    }
  };

  // Stage B: On-Demand Lazy Detail Fetch when Candidate is Selected
  const handleSelectCandidate = async (candidate: BusinessCandidate) => {
    setSelectedCandidate(candidate);
    setSelectedCrmLead(candidate.crmLead || null);

    // If details already loaded, nothing further needed
    if (candidate.detailsLoaded) return;

    // Mark as loading details in local state
    setSelectedCandidate((prev) => (prev?.id === candidate.id ? { ...prev, isDetailsLoading: true } : prev));

    if (lazyDetailControllerRef.current) {
      lazyDetailControllerRef.current.abort();
    }
    const controller = new AbortController();
    lazyDetailControllerRef.current = controller;

    try {
      const details = await BusinessMapService.fetchBusinessDetails(candidate, controller.signal);
      setDiagnostics(BusinessMapService.getDiagnostics());

      // Update candidate in state
      setDiscoveredBusinesses((prev) =>
        prev.map((c) =>
          c.id === candidate.id
            ? {
                ...c,
                ...details,
                detailsLoaded: true,
                isDetailsLoading: false,
              }
            : c
        )
      );

      setSelectedCandidate((prev) =>
        prev?.id === candidate.id
          ? {
              ...prev,
              ...details,
              detailsLoaded: true,
              isDetailsLoading: false,
            }
          : prev
      );
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setSelectedCandidate((prev) => (prev?.id === candidate.id ? { ...prev, isDetailsLoading: false } : prev));
    }
  };

  // WhatsApp Confirmation: Explicit admin confirmation action
  const handleConfirmWhatsapp = (candidate: BusinessCandidate) => {
    if (!candidate.phone) return;
    const updated: BusinessCandidate = {
      ...candidate,
      whatsapp: candidate.phone,
      whatsappConfirmed: true,
    };

    setDiscoveredBusinesses((prev) =>
      prev.map((c) => (c.id === candidate.id ? updated : c))
    );

    if (selectedCandidate?.id === candidate.id) {
      setSelectedCandidate(updated);
    }

    showToast(`Phone number confirmed as WhatsApp contact.`);
  };

  // Ranked & Filtered Candidates
  const rankedCandidates = useMemo(() => {
    let list = [...discoveredBusinesses];

    if (newOnlyFilter) {
      list = list.filter((c) => !c.inCrm);
    }

    // Contactability Filters
    if (contactFilter === 'phone') {
      list = list.filter((c) => Boolean(c.phone));
    } else if (contactFilter === 'website') {
      list = list.filter((c) => Boolean(c.website));
    } else if (contactFilter === 'email') {
      list = list.filter((c) => Boolean(c.email));
    } else if (contactFilter === 'whatsapp') {
      list = list.filter((c) => Boolean(c.whatsappConfirmed));
    } else if (contactFilter === 'any') {
      list = list.filter((c) => Boolean(c.phone || c.website || c.email));
    }

    // Tab filters
    if (candidatesTab === 'best') {
      list = list.filter((c) => !c.inCrm && !c.isSkipped && !c.isDismissed);
    } else if (candidatesTab === 'new') {
      list = list.filter((c) => !c.inCrm);
    } else if (candidatesTab === 'phone') {
      list = list.filter((c) => Boolean(c.phone));
    } else if (candidatesTab === 'website') {
      list = list.filter((c) => Boolean(c.website));
    } else if (candidatesTab === 'crm') {
      list = list.filter((c) => c.inCrm);
    } else if (candidatesTab === 'skipped') {
      list = list.filter((c) => c.isSkipped || c.isDismissed);
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'quality') {
        return (b.leadQualityScore || 0) - (a.leadQualityScore || 0);
      } else if (sortBy === 'name') {
        return a.businessName.localeCompare(b.businessName);
      }
      return a.primaryCategory.localeCompare(b.primaryCategory);
    });

    return list.slice(0, MAX_VISIBLE_RESULTS);
  }, [discoveredBusinesses, contactFilter, newOnlyFilter, candidatesTab, sortBy]);

  // Active Map Items: Hard Result Limit & Viewport Culling
  const activeMapItems = useMemo(() => {
    const points: Array<
      | { type: 'business'; data: BusinessCandidate; latitude: number; longitude: number; id: string }
      | { type: 'crmLead'; data: Lead; latitude: number; longitude: number; id: string }
    > = [];

    if (mapMode === 'discover' || mapMode === 'combined') {
      rankedCandidates.forEach((b) => {
        points.push({
          type: 'business',
          data: b,
          latitude: b.latitude,
          longitude: b.longitude,
          id: b.id,
        });
      });
    }

    if (mapMode === 'crm' || mapMode === 'combined') {
      leads.slice(0, 80).forEach((l) => {
        if (l.latitude && l.longitude) {
          points.push({
            type: 'crmLead',
            data: l,
            latitude: l.latitude,
            longitude: l.longitude,
            id: l.id,
          });
        }
      });
    }

    BusinessMapService.setMarkersRenderedCount(points.length);
    return points;
  }, [mapMode, rankedCandidates, leads]);

  // Render Clustered & Lightweight Dot Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    const markersLayer = markersLayerRef.current;
    markersLayer.clearLayers();

    // Render Searched Coverage Rectangles if any
    if (coverageLayerRef.current) {
      coverageLayerRef.current.clearLayers();
      searchedCoverage.forEach((cov) => {
        const bounds = [
          [cov.south, cov.west],
          [cov.north, cov.east],
        ] as L.LatLngBoundsExpression;
        L.rectangle(bounds, {
          color: '#06B6D4',
          weight: 1,
          opacity: 0.35,
          fillColor: '#06B6D4',
          fillOpacity: 0.04,
          dashArray: '4, 4',
        }).addTo(coverageLayerRef.current!);
      });
    }

    const clusters = clusterPoints(activeMapItems, currentZoom, 50);

    clusters.forEach((clusterOrSingle) => {
      if (clusterOrSingle.isCluster) {
        // Cluster Badge
        const cluster = clusterOrSingle;
        const count = cluster.count;
        const icon = L.divIcon({
          className: 'custom-cluster-badge',
          html: `
            <div style="background: rgba(14, 22, 38, 0.95); border: 1.5px solid #10B981; box-shadow: 0 0 12px rgba(16, 185, 129, 0.35); border-radius: 9999px; padding: 3px 9px; display: flex; align-items: center; gap: 4px; color: #FFFFFF; font-size: 11px; font-weight: 800; cursor: pointer; white-space: nowrap;">
              <span style="width: 6px; height: 6px; border-radius: 50%; background: #10B981; display: inline-block;"></span>
              <span>${count}</span>
            </div>
          `,
          iconSize: [46, 24],
          iconAnchor: [23, 12],
        });

        const marker = L.marker([cluster.latitude, cluster.longitude], { icon });
        marker.on('click', () => {
          if (mapInstanceRef.current) {
            const bounds = L.latLngBounds(
              [cluster.bounds.minLat, cluster.bounds.minLng],
              [cluster.bounds.maxLat, cluster.bounds.maxLng]
            );
            mapInstanceRef.current.fitBounds(bounds, { padding: [35, 35], maxZoom: 16 });
          }
        });
        marker.addTo(markersLayer);
      } else {
        // Individual Lightweight Dot
        const single = clusterOrSingle.item;
        let dotColor = '#10B981'; // Emerald Green Dot (Available Candidate)
        let title = '';
        let category = '';
        let hasPhone = false;
        let hasWeb = false;
        let stateBadge = 'NEW CANDIDATE';

        if (single.type === 'business') {
          title = single.data.businessName;
          category = single.data.primaryCategory;
          hasPhone = Boolean(single.data.phone);
          hasWeb = Boolean(single.data.website);

          if (single.data.isDismissed) {
            dotColor = '#64748B';
            stateBadge = 'NOT RELEVANT';
          } else if (single.data.inCrm) {
            dotColor = '#06B6D4'; // Cyan
            stateBadge = 'IN CRM';
          }
        } else {
          title = single.data.businessName;
          category = single.data.categoryName;
          hasPhone = Boolean(single.data.phone);
          hasWeb = Boolean(single.data.website);
          const l = single.data;

          if (l.priority === 'Urgent' || (l.nextFollowUpAt && new Date(l.nextFollowUpAt) < new Date())) {
            dotColor = '#EF4444'; // Red
            stateBadge = 'OVERDUE CRM';
          } else if (l.isHot || l.status === 'Hot Lead') {
            dotColor = '#A855F7'; // Purple
            stateBadge = 'HOT CRM LEAD';
          } else if (l.status === 'Follow-up') {
            dotColor = '#F59E0B'; // Amber
            stateBadge = 'FOLLOW-UP';
          } else {
            dotColor = '#06B6D4'; // Cyan
            stateBadge = 'SAVED LEAD';
          }
        }

        const isSelected =
          (selectedCandidate && single.id === selectedCandidate.id) ||
          (selectedCrmLead && single.id === selectedCrmLead.id);

        const icon = L.divIcon({
          className: 'individual-business-dot',
          html: `
            <div style="position: relative; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
              <div style="position: absolute; width: ${isSelected ? '24px' : '16px'}; height: ${isSelected ? '24px' : '16px'}; border-radius: 50%; background-color: ${dotColor}; opacity: ${isSelected ? '0.45' : '0.2'};"></div>
              <div style="width: ${isSelected ? '13px' : '10px'}; height: ${isSelected ? '13px' : '10px'}; border-radius: 50%; background-color: ${dotColor}; border: 1.5px solid ${isSelected ? '#FFFFFF' : '#080B11'}; box-shadow: 0 0 ${isSelected ? '10px' : '5px'} ${dotColor};"></div>
            </div>
          `,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });

        const marker = L.marker([single.latitude, single.longitude], { icon });

        // Compact Hover Tooltip
        marker.bindTooltip(
          `
          <div style="font-weight: 800; font-size: 11px; color: #FFFFFF;">${title}</div>
          <div style="font-size: 10px; color: #94A3B8; margin-top: 1px;">${category}</div>
          <div style="font-size: 9px; margin-top: 3px; display: flex; gap: 6px; font-weight: 600;">
            <span style="color: ${hasPhone ? '#10B981' : '#64748B'};">☎ ${hasPhone ? 'Phone' : 'No Phone'}</span>
            <span style="color: ${hasWeb ? '#38BDF8' : '#64748B'};">🌐 ${hasWeb ? 'Web' : 'No Web'}</span>
          </div>
          <div style="font-size: 9px; color: ${dotColor}; font-weight: 800; margin-top: 3px; text-transform: uppercase;">
            ● ${stateBadge}
          </div>
          `,
          {
            direction: 'top',
            offset: [0, -10],
            className: 'map-hover-tooltip',
          }
        );

        marker.on('click', () => {
          if (single.type === 'business') {
            handleSelectCandidate(single.data);
          } else {
            setSelectedCrmLead(single.data);
            setSelectedCandidate(null);
          }
        });

        marker.addTo(markersLayer);
      }
    });
  }, [activeMapItems, currentZoom, selectedCandidate, selectedCrmLead, searchedCoverage]);

  // Fast ADD TO CRM: Local state update first, background Firestore sync (Section 40)
  const handleAddCandidateToCrm = async (candidate: BusinessCandidate): Promise<Lead> => {
    const newLead: Lead = {
      id: `lead-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      businessName: candidate.businessName,
      businessNameNormalized: candidate.businessName.toLowerCase().trim(),
      categoryId: 'cat-1',
      categoryName: candidate.primaryCategory,
      phone: candidate.phone || undefined,
      phoneNormalized: candidate.phone ? candidate.phone.replace(/[^\d+]/g, '') : undefined,
      whatsapp: candidate.whatsapp || undefined,
      whatsappNormalized: candidate.whatsapp ? candidate.whatsapp.replace(/[^\d+]/g, '') : undefined,
      whatsappConfirmed: candidate.whatsappConfirmed || false,
      email: candidate.email || undefined,
      emailNormalized: candidate.email?.toLowerCase().trim(),
      website: candidate.website || undefined,
      websiteDomain: candidate.websiteDomain || undefined,
      address: candidate.address || undefined,
      area: candidate.area || undefined,
      city: candidate.city || 'Dubai',
      country: candidate.country || 'United Arab Emirates',
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      externalPlaceId: candidate.externalId,
      source: candidate.provider === 'Google Places' ? 'Google Places' : 'Map',
      status: 'New',
      priority: (candidate.leadQualityScore || 50) >= 80 ? 'High' : 'Normal',
      tags: [(candidate.primaryCategory || 'Commercial').replace(/\s+/g, '')],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'admin',
      updatedBy: 'admin',
    };

    // 1. Immediately update local candidate state -> Cyan marker immediately
    setDiscoveredBusinesses((prev) =>
      prev.map((c) =>
        c.id === candidate.id ? { ...c, inCrm: true, crmLead: newLead } : c
      )
    );

    if (selectedCandidate?.id === candidate.id) {
      setSelectedCandidate({ ...selectedCandidate, inCrm: true, crmLead: newLead });
      setSelectedCrmLead(newLead);
    }

    setAddedThisSession((prev) => prev + 1);

    // 2. Perform background Firestore sync with rollback if failed
    CRMStorage.saveLead(newLead, 'admin').catch((err) => {
      console.error('Background Firestore lead save error:', err);
      // Rollback
      setDiscoveredBusinesses((prev) =>
        prev.map((c) => (c.id === candidate.id ? { ...c, inCrm: false, crmLead: undefined } : c))
      );
      showToast('Could not save lead to CRM. Please check connection.');
    });

    return newLead;
  };

  // ADD & NEXT Action (Core Lead Finding Machine workflow)
  const handleAddAndNext = async (candidate: BusinessCandidate) => {
    await handleAddCandidateToCrm(candidate);
    showToast(`Lead saved: ${candidate.businessName}! Next candidate loaded.`);

    const remaining = rankedCandidates.filter(
      (c) => c.id !== candidate.id && !c.inCrm && !c.isSkipped && !c.isDismissed
    );

    if (remaining.length > 0) {
      const next = remaining[0];
      handleSelectCandidate(next);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.panTo([next.latitude, next.longitude]);
      }
    } else {
      showToast('All candidates in this view have been processed!');
    }
  };

  // SKIP & NEXT Action
  const handleSkipAndNext = (candidate: BusinessCandidate) => {
    setDiscoveredBusinesses((prev) =>
      prev.map((c) => (c.id === candidate.id ? { ...c, isSkipped: true } : c))
    );
    setSkippedThisSession((prev) => prev + 1);

    const remaining = rankedCandidates.filter(
      (c) => c.id !== candidate.id && !c.inCrm && !c.isSkipped && !c.isDismissed
    );

    if (remaining.length > 0) {
      const next = remaining[0];
      handleSelectCandidate(next);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.panTo([next.latitude, next.longitude]);
      }
    }
  };

  // NOT RELEVANT (Dismiss Candidate)
  const handleNotRelevant = (candidate: BusinessCandidate) => {
    setDiscoveredBusinesses((prev) =>
      prev.map((c) => (c.id === candidate.id ? { ...c, isDismissed: true } : c))
    );
    showToast(`Marked "${candidate.businessName}" as not relevant.`);

    const remaining = rankedCandidates.filter(
      (c) => c.id !== candidate.id && !c.inCrm && !c.isSkipped && !c.isDismissed
    );

    if (remaining.length > 0) {
      handleSelectCandidate(remaining[0]);
    }
  };

  // One-Click Fast # PHONE LEADS Preset (Section 38)
  const handleActivatePhoneFirstPreset = () => {
    setContactFilter('phone');
    setNewOnlyFilter(true);
    setCandidatesTab('best');
    setSortBy('quality');
    showToast('# PHONE LEADS preset active: showing candidates with verified phone numbers.');
  };

  // Computed Counts
  const newCount = discoveredBusinesses.filter((b) => !b.inCrm).length;
  const inCrmCount = discoveredBusinesses.filter((b) => b.inCrm).length;
  const withPhoneCount = discoveredBusinesses.filter((b) => Boolean(b.phone)).length;
  const withWebCount = discoveredBusinesses.filter((b) => Boolean(b.website)).length;

  const capabilities = BusinessMapService.getCapabilities(discoveryProviderName);

  return (
    <div
      className={`space-y-3.5 ${
        isFullscreen ? 'fixed inset-0 z-50 bg-[#080B11] p-3 flex flex-col h-screen' : 'relative'
      }`}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-[9999] px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-2xl flex items-center gap-2 animate-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header: Module Title, Quick Presets & Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#0E1626] border border-[#1E2C4A] p-4 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <Crosshair className="w-5 h-5 text-cyan-400" />
              <span>LEAD FINDER</span>
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold">
              MACHINE V3
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold hidden sm:inline">
              FAST STABLE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Discover, qualify and capture business leads from one workspace.
          </p>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* One-Click Fast # PHONE LEADS Preset Button */}
          <button
            onClick={handleActivatePhoneFirstPreset}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border transition-all ${
              contactFilter === 'phone' && newOnlyFilter
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                : 'bg-[#080B11] text-slate-300 hover:text-white border-[#1E2C4A]'
            }`}
            title="Show only new leads with direct callable phone numbers"
          >
            <Phone className="w-3.5 h-3.5 text-emerald-400" />
            <span># PHONE LEADS</span>
          </button>

          {/* Rapid Lead Hunt Trigger */}
          <button
            onClick={() => {
              setHuntIndex(0);
              setIsHuntModalOpen(true);
            }}
            disabled={rankedCandidates.length === 0}
            className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
          >
            <Zap className="w-3.5 h-3.5 fill-white" />
            <span>START LEAD HUNT</span>
          </button>

          {/* Dev Diagnostics Toggle */}
          <button
            onClick={() => {
              setDiagnostics(BusinessMapService.getDiagnostics());
              setShowDevPanel(!showDevPanel);
            }}
            className="p-2 bg-[#080B11] hover:bg-[#131E33] border border-[#1E2C4A] text-slate-400 hover:text-cyan-300 rounded-xl cursor-pointer"
            title="Toggle Search Diagnostic Panel"
          >
            <Activity className="w-4 h-4" />
          </button>

          {/* Full Screen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 bg-[#080B11] hover:bg-[#131E33] border border-[#1E2C4A] text-slate-300 rounded-xl cursor-pointer"
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen Map'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Development Diagnostic Panel (Section 32) */}
      {showDevPanel && (
        <div className="bg-[#080B11] border border-cyan-500/30 p-3.5 rounded-2xl text-xs font-mono space-y-2 text-slate-300">
          <div className="flex items-center justify-between border-b border-[#1E2C4A] pb-2">
            <span className="font-bold text-cyan-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              <span>SEARCH DIAGNOSTIC BASELINE</span>
            </span>
            <span className="text-[10px] text-slate-500">Live Telemetry</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
            <div>
              <span className="text-slate-500 block">Active Provider:</span>
              <span className="text-emerald-400 font-bold">{discoveryProviderName}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Last Search Duration:</span>
              <span className="text-white font-bold">{diagnostics.searchDurationMs} ms</span>
            </div>
            <div>
              <span className="text-slate-500 block">Candidates Returned:</span>
              <span className="text-white font-bold">{diagnostics.businessesReturned}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Markers Rendered:</span>
              <span className="text-white font-bold">{diagnostics.markersRendered}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Cache Hits / Misses:</span>
              <span className="text-cyan-400 font-bold">{diagnostics.cacheHits} / {diagnostics.cacheMisses}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Cancelled Searches:</span>
              <span className="text-amber-400 font-bold">{diagnostics.cancelledRequests}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Current Map Zoom:</span>
              <span className="text-white font-bold">{currentZoom}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Provider Note:</span>
              <span className="text-slate-400 truncate block">{capabilities.rateLimitNote}</span>
            </div>
          </div>
        </div>
      )}

      {/* QUICK FIND & NATURAL SEARCH WORKSPACE */}
      <div className="bg-[#0E1626] border border-[#1E2C4A] p-4 rounded-2xl shadow-sm space-y-3">
        {/* Row 1: Quick Find Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          {/* WHERE */}
          <div className="sm:col-span-4 space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              WHERE? (Location / Area)
            </label>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={quickWhere}
                onChange={(e) => setQuickWhere(e.target.value)}
                placeholder="e.g. Dubai Marina, Business Bay..."
                className="w-full pl-8 pr-3 py-1.5 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* WHAT BUSINESS */}
          <div className="sm:col-span-4 space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              WHAT BUSINESS? (Category)
            </label>
            <input
              type="text"
              value={quickWhat}
              onChange={(e) => setQuickWhat(e.target.value)}
              placeholder="e.g. Restaurants, Warehouses, Clinics..."
              className="w-full px-3 py-1.5 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* HOW MANY */}
          <div className="sm:col-span-2 space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              MAX RESULTS
            </label>
            <select
              value={quickLimit}
              onChange={(e) => setQuickLimit(Number(e.target.value))}
              className="w-full px-3 py-1.5 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value={50}>50 leads</option>
              <option value={100}>100 leads (Recommended)</option>
              <option value={150}>150 leads</option>
            </select>
          </div>

          {/* FIND LEADS BUTTON */}
          <div className="sm:col-span-2">
            <button
              onClick={handleQuickFind}
              disabled={isDiscovering || isSearchingLocation}
              className="w-full py-2 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-xs rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{isDiscovering ? 'SEARCHING...' : 'FIND LEADS'}</span>
            </button>
          </div>
        </div>

        {/* Row 2: Natural Query Box */}
        <form onSubmit={handleNaturalSearchSubmit} className="flex items-center gap-2 pt-1 border-t border-[#1E2C4A]/60">
          <div className="relative flex-1">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={naturalQueryInput}
              onChange={(e) => setNaturalQueryInput(e.target.value)}
              placeholder="Tell Lead Finder what you need (e.g. Restaurants in Dubai Marina, Warehouses in Al Quoz)..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            type="submit"
            disabled={isDiscovering}
            className="px-4 py-1.5 bg-[#131E33] hover:bg-[#1E2C4A] border border-[#1E2C4A] text-cyan-300 font-semibold text-xs rounded-xl cursor-pointer"
          >
            Parse & Find
          </button>
        </form>

        {/* Row 3: Frequently Used Category Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
            Quick Categories:
          </span>
          {POPULAR_CATEGORY_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => {
                setQuickWhat(chip);
                handleSearchThisArea();
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                quickWhat.toLowerCase() === chip.toLowerCase()
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-[#080B11] text-slate-400 hover:text-white border border-[#1E2C4A]'
              }`}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Error / Area Alert Banner */}
      {discoveryError && (
        <div className="px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{discoveryError}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => mapInstanceRef.current?.zoomIn()}
              className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 rounded text-[11px] font-bold cursor-pointer"
            >
              Zoom In
            </button>
            <button
              onClick={handleSearchThisArea}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-bold cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* FLOATING SESSION DASHBOARD */}
      <div className="bg-[#0E1626] border border-[#1E2C4A] px-4 py-2 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">LOCATION:</span>
            <span className="font-bold text-white">{quickWhere}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">CATEGORY:</span>
            <span className="font-bold text-cyan-300">{quickWhat}</span>
          </div>
          <div className="h-3 w-px bg-[#1E2C4A] hidden sm:block"></div>
          <div className="flex items-center gap-3">
            <span className="text-slate-400">
              Found: <strong className="text-white">{discoveredBusinesses.length}</strong>
            </span>
            <span className="text-emerald-400">
              New: <strong className="text-white">{newCount}</strong>
            </span>
            <span className="text-cyan-400">
              In CRM: <strong className="text-white">{inCrmCount}</strong>
            </span>
            <span className="text-slate-400">
              With Phone: <strong className="text-white">{withPhoneCount}</strong>
            </span>
            <span className="text-slate-400">
              With Web: <strong className="text-white">{withWebCount}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-emerald-400 font-semibold">
            Added Today: <strong className="font-bold text-white">{addedThisSession}</strong>
          </span>
          <span className="text-slate-400 font-semibold">
            Skipped: <strong className="font-bold text-white">{skippedThisSession}</strong>
          </span>
        </div>
      </div>

      {/* MAIN 3-PANEL WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 flex-1 min-h-[580px]">
        {/* LEFT PANEL: Filters, Imagery & Ranked Candidates (Cols 1-3) */}
        <div className="lg:col-span-3 space-y-3 flex flex-col">
          {/* Layer Imagery & Contact Filters Box */}
          <div className="bg-[#0E1626] border border-[#1E2C4A] p-3 rounded-2xl space-y-2.5 shadow-sm">
            {/* Map Imagery Switcher */}
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                Map Layer Imagery
              </span>
              <div className="grid grid-cols-4 gap-1 p-0.5 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-[11px] font-bold">
                {(['dark', 'street', 'satellite', 'hybrid'] as MapLayerMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => switchMapLayer(mode)}
                    className={`py-1 rounded-lg capitalize transition-colors cursor-pointer ${
                      activeLayerMode === mode
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Contactable Leads Filter (Section 22) */}
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                Contactability Filter
              </span>
              <div className="grid grid-cols-3 gap-1 text-[10px] font-semibold">
                <button
                  onClick={() => setContactFilter('all')}
                  className={`py-1 rounded-lg cursor-pointer ${
                    contactFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-[#080B11] text-slate-400 border border-[#1E2C4A]'
                  }`}
                >
                  All Leads
                </button>
                <button
                  onClick={() => setContactFilter('phone')}
                  className={`py-1 rounded-lg cursor-pointer ${
                    contactFilter === 'phone' ? 'bg-emerald-600 text-white' : 'bg-[#080B11] text-slate-400 border border-[#1E2C4A]'
                  }`}
                >
                  Has Phone
                </button>
                <button
                  onClick={() => setContactFilter('website')}
                  className={`py-1 rounded-lg cursor-pointer ${
                    contactFilter === 'website' ? 'bg-cyan-600 text-white' : 'bg-[#080B11] text-slate-400 border border-[#1E2C4A]'
                  }`}
                >
                  Has Web
                </button>
              </div>
            </div>

            {/* Layout switch */}
            <div className="flex items-center justify-between pt-1 border-t border-[#1E2C4A]/60">
              <span className="text-xs text-slate-400 font-medium">Layout View</span>
              <div className="flex items-center gap-1 bg-[#080B11] p-1 border border-[#1E2C4A] rounded-xl">
                <button
                  onClick={() => setViewLayout('map')}
                  className={`p-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    viewLayout === 'map' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400'
                  }`}
                  title="Full Map"
                >
                  <MapIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewLayout('split')}
                  className={`p-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    viewLayout === 'split' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400'
                  }`}
                  title="Split Map + List"
                >
                  <Columns className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewLayout('list')}
                  className={`p-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    viewLayout === 'list' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400'
                  }`}
                  title="Candidate Table List"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* BEST LEADS FIRST RANKING PANEL */}
          <div className="bg-[#0E1626] border border-[#1E2C4A] rounded-2xl flex-1 flex flex-col overflow-hidden shadow-sm">
            <div className="p-3 border-b border-[#1E2C4A] bg-[#131E33] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  CANDIDATES ({rankedCandidates.length})
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Max {MAX_VISIBLE_RESULTS}</span>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 p-1.5 bg-[#080B11] border-b border-[#1E2C4A] overflow-x-auto scrollbar-none text-[11px] font-medium">
              {(['best', 'new', 'phone', 'website', 'all', 'crm'] as CandidatesTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setCandidatesTab(tab)}
                  className={`px-2.5 py-1 rounded-lg capitalize whitespace-nowrap cursor-pointer ${
                    candidatesTab === tab
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab === 'best' ? '★ Best' : tab}
                </button>
              ))}
            </div>

            {/* Candidates List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#1E2C4A]/40 max-h-[460px]">
              {rankedCandidates.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                  <p>No candidates match current filters.</p>
                  <button
                    onClick={handleSearchThisArea}
                    className="mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs cursor-pointer"
                  >
                    Scan Visible Area
                  </button>
                </div>
              ) : (
                rankedCandidates.map((cand, idx) => {
                  const isSelected = selectedCandidate?.id === cand.id;
                  const score = cand.leadQualityScore || 50;
                  return (
                    <div
                      key={cand.id}
                      onClick={() => handleSelectCandidate(cand)}
                      className={`p-3 transition-colors cursor-pointer flex items-center justify-between gap-2.5 ${
                        isSelected ? 'bg-[#131E33] border-l-2 border-cyan-400' : 'hover:bg-[#131E33]/50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-slate-500 font-bold">
                            #{idx + 1}
                          </span>
                          <h4 className="text-xs font-bold text-white truncate">{cand.businessName}</h4>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span className="truncate">{cand.primaryCategory}</span>
                        </div>
                        {/* Contact Badges Row */}
                        <div className="flex items-center gap-1.5 text-[9px] font-mono mt-1">
                          <span className={cand.phone ? 'text-emerald-400' : 'text-slate-600'}>
                            P:{cand.phone ? '✓' : '—'}
                          </span>
                          <span className={cand.website ? 'text-cyan-400' : 'text-slate-600'}>
                            W:{cand.website ? '✓' : '—'}
                          </span>
                          <span className={cand.email ? 'text-blue-400' : 'text-slate-600'}>
                            E:{cand.email ? '✓' : '—'}
                          </span>
                          <span className={cand.whatsappConfirmed ? 'text-emerald-400' : 'text-slate-600'}>
                            WA:{cand.whatsappConfirmed ? '✓' : '—'}
                          </span>
                        </div>
                      </div>

                      {/* Quality Score & Fast Action */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-xs font-black px-1.5 py-0.5 rounded font-mono ${
                            score >= 80
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : score >= 60
                              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {score}
                        </span>

                        {cand.inCrm ? (
                          <span className="text-[10px] text-cyan-400 font-semibold px-1.5 py-0.5 rounded bg-cyan-950/40">
                            Saved
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddCandidateToCrm(cand);
                            }}
                            className="p-1 px-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-lg text-[10px] font-bold cursor-pointer"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* CENTER PANEL: Large GIS Interactive Map */}
        <div
          className={`${
            selectedCandidate || selectedCrmLead ? 'lg:col-span-6' : 'lg:col-span-9'
          } rounded-2xl overflow-hidden border border-[#1E2C4A] relative bg-[#080B11] shadow-xl flex flex-col min-h-[500px]`}
        >
          {/* Leaflet Map Surface */}
          <div ref={mapContainerRef} className="w-full h-full flex-1 z-0" />

          {/* Floating SEARCH THIS AREA Prompt (Section 3 requirement) */}
          {showSearchThisAreaPrompt && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
              <button
                onClick={handleSearchThisArea}
                disabled={isDiscovering}
                className="px-5 py-2.5 bg-[#0E1626]/95 hover:bg-[#131E33] border border-cyan-400 text-white font-bold text-xs rounded-full shadow-2xl backdrop-blur-md flex items-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isDiscovering ? 'animate-spin' : ''}`} />
                <span>Search This Area</span>
              </button>
            </div>
          )}

          {/* Floating Zoom Controls */}
          <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5">
            <button
              onClick={() => mapInstanceRef.current?.zoomIn()}
              className="w-8 h-8 rounded-xl bg-[#0E1626]/90 border border-[#1E2C4A] text-white hover:bg-[#131E33] flex items-center justify-center font-bold text-sm cursor-pointer shadow-md"
            >
              +
            </button>
            <button
              onClick={() => mapInstanceRef.current?.zoomOut()}
              className="w-8 h-8 rounded-xl bg-[#0E1626]/90 border border-[#1E2C4A] text-white hover:bg-[#131E33] flex items-center justify-center font-bold text-sm cursor-pointer shadow-md"
            >
              −
            </button>
          </div>

          {/* Bottom Floating Legend */}
          <div className="absolute bottom-3 left-3 z-20 bg-[#0E1626]/90 backdrop-blur-md border border-[#1E2C4A] px-3 py-1.5 rounded-xl flex items-center gap-3 text-[10px] text-slate-300 font-medium shadow-lg">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10B981]"></span>
              <span>Available</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06B6D4]"></span>
              <span>In CRM</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#F59E0B]"></span>
              <span>Follow-up</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-[0_0_8px_#EF4444]"></span>
              <span>Overdue</span>
            </span>
          </div>
        </div>

        {/* RIGHT PANEL: Business Intelligence & Lead Qualification Drawer */}
        {(selectedCandidate || selectedCrmLead) && (
          <div className="lg:col-span-3 bg-[#0E1626] border border-[#1E2C4A] rounded-2xl flex flex-col overflow-hidden shadow-2xl max-h-[680px]">
            {/* Header */}
            <div className="p-4 border-b border-[#1E2C4A] bg-[#131E33] flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider block">
                  Business Intelligence
                </span>
                <h3 className="text-sm font-bold text-white truncate max-w-[200px]">
                  {selectedCandidate?.businessName || selectedCrmLead?.businessName}
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedCandidate(null);
                  setSelectedCrmLead(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Intelligence Details */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Quality Score Card */}
              {selectedCandidate && (
                <div className="p-3.5 rounded-xl bg-[#080B11] border border-[#1E2C4A] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400">LEAD QUALITY</span>
                    <span className="text-lg font-black text-emerald-400 font-mono">
                      {selectedCandidate.leadQualityScore || 50} / 100
                    </span>
                  </div>
                  <div className="space-y-1">
                    {(selectedCandidate.leadQualityReasons || []).slice(0, 3).map((r, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
                        <Check className="w-3 h-3 shrink-0" />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Factual Verified Contact Details (Sections 17-20) */}
              <div className="p-3.5 rounded-xl bg-[#080B11] border border-[#1E2C4A] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Contact & Presence</span>
                  {selectedCandidate?.isDetailsLoading && (
                    <span className="text-[10px] font-mono text-cyan-400 animate-pulse">Enriching...</span>
                  )}
                </div>

                {/* Direct Phone */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-slate-400">Phone:</span>
                  </div>
                  {selectedCandidate?.phone || selectedCrmLead?.phone ? (
                    <a
                      href={`tel:${selectedCandidate?.phone || selectedCrmLead?.phone}`}
                      className="font-semibold text-emerald-400 hover:underline"
                    >
                      {selectedCandidate?.phone || selectedCrmLead?.phone}
                    </a>
                  ) : (
                    <span className="text-slate-500">Not Available</span>
                  )}
                </div>

                {/* WhatsApp Status & Confirmation (Section 20 requirement) */}
                <div className="flex items-center justify-between pt-1 border-t border-[#1E2C4A]/40">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-slate-400">WhatsApp:</span>
                  </div>
                  {selectedCandidate?.whatsappConfirmed || selectedCrmLead?.whatsappConfirmed ? (
                    <span className="font-semibold text-emerald-400">Confirmed ✓</span>
                  ) : selectedCandidate?.phone ? (
                    <button
                      onClick={() => selectedCandidate && handleConfirmWhatsapp(selectedCandidate)}
                      className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold cursor-pointer"
                    >
                      Use Phone as WA
                    </button>
                  ) : (
                    <span className="text-slate-500">Not Confirmed</span>
                  )}
                </div>

                {/* Website */}
                <div className="flex items-center justify-between pt-1 border-t border-[#1E2C4A]/40">
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-slate-400">Website:</span>
                  </div>
                  {selectedCandidate?.website || selectedCrmLead?.website ? (
                    <a
                      href={selectedCandidate?.website || selectedCrmLead?.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-cyan-400 hover:underline truncate max-w-[130px]"
                    >
                      Visit &rarr;
                    </a>
                  ) : (
                    <span className="text-slate-500">Not Available</span>
                  )}
                </div>

                {/* Email (Honest POI explanation) */}
                <div className="flex items-center justify-between pt-1 border-t border-[#1E2C4A]/40">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-slate-400">Email:</span>
                  </div>
                  {selectedCandidate?.email || selectedCrmLead?.email ? (
                    <a
                      href={`mailto:${selectedCandidate?.email || selectedCrmLead?.email}`}
                      className="font-semibold text-blue-400 hover:underline"
                    >
                      {selectedCandidate?.email || selectedCrmLead?.email}
                    </a>
                  ) : (
                    <span className="text-slate-500" title="OSM POI database does not index business emails">
                      Not Available
                    </span>
                  )}
                </div>

                {/* Opening Hours */}
                {selectedCandidate?.openingHours && (
                  <div className="flex items-center justify-between pt-1 border-t border-[#1E2C4A]/40">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-slate-400">Hours:</span>
                    </div>
                    <span className="text-slate-300 font-mono text-[10px]">
                      {selectedCandidate.openingHours}
                    </span>
                  </div>
                )}

                {/* Physical Address */}
                <div className="pt-1.5 border-t border-[#1E2C4A]/60 text-slate-400">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <span className="text-[11px] leading-relaxed text-slate-300">
                      {[
                        selectedCandidate?.address || selectedCrmLead?.address,
                        selectedCandidate?.city || selectedCrmLead?.city,
                        selectedCandidate?.country || selectedCrmLead?.country,
                      ]
                        .filter(Boolean)
                        .join(', ') || 'Address Not Available'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Primary Actions */}
              <div className="space-y-2 pt-2">
                {selectedCandidate && !selectedCandidate.inCrm ? (
                  <>
                    <button
                      onClick={() => handleAddAndNext(selectedCandidate)}
                      className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>ADD & NEXT</span>
                    </button>

                    <button
                      onClick={() => handleSkipAndNext(selectedCandidate)}
                      className="w-full py-2 bg-[#080B11] hover:bg-[#131E33] border border-[#1E2C4A] text-slate-300 font-semibold text-xs rounded-xl cursor-pointer"
                    >
                      Skip & Next
                    </button>

                    <button
                      onClick={() =>
                        onCustomizeAddLead({
                          businessName: selectedCandidate.businessName,
                          phone: selectedCandidate.phone || undefined,
                          whatsapp: selectedCandidate.whatsapp || undefined,
                          whatsappConfirmed: selectedCandidate.whatsappConfirmed || false,
                          website: selectedCandidate.website || undefined,
                          email: selectedCandidate.email || undefined,
                          address: selectedCandidate.address || undefined,
                          city: selectedCandidate.city || undefined,
                          country: selectedCandidate.country || undefined,
                          latitude: selectedCandidate.latitude,
                          longitude: selectedCandidate.longitude,
                          externalPlaceId: selectedCandidate.externalId,
                          categoryName: selectedCandidate.primaryCategory,
                        })
                      }
                      className="w-full py-1.5 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium text-center cursor-pointer"
                    >
                      Customize Before Saving
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      if (selectedCrmLead) onOpenLeadProfile(selectedCrmLead);
                      else if (selectedCandidate?.crmLead) onOpenLeadProfile(selectedCandidate.crmLead);
                    }}
                    className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>VIEW CRM LEAD PROFILE</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RAPID PROSPECTING MODAL ("START LEAD HUNT") */}
      <LeadHuntModal
        isOpen={isHuntModalOpen}
        onClose={() => setIsHuntModalOpen(false)}
        candidates={rankedCandidates}
        currentIndex={huntIndex}
        onSelectIndex={setHuntIndex}
        onAddAndNext={async (cand) => {
          await handleAddCandidateToCrm(cand);
          if (huntIndex < rankedCandidates.length - 1) {
            setHuntIndex(huntIndex + 1);
          }
        }}
        onSkipAndNext={(cand) => {
          handleSkipAndNext(cand);
          if (huntIndex < rankedCandidates.length - 1) {
            setHuntIndex(huntIndex + 1);
          }
        }}
        onNotRelevant={(cand) => {
          handleNotRelevant(cand);
          if (huntIndex < rankedCandidates.length - 1) {
            setHuntIndex(huntIndex + 1);
          }
        }}
        sessionStats={{
          added: addedThisSession,
          skipped: skippedThisSession,
        }}
      />

      {/* AUTOMATED AREA SCANNER MODAL */}
      {mapInstanceRef.current && (
        <AreaScannerModal
          isOpen={isScannerModalOpen}
          onClose={() => setIsScannerModalOpen(false)}
          currentBounds={{
            south: mapInstanceRef.current.getBounds().getSouth(),
            west: mapInstanceRef.current.getBounds().getWest(),
            north: mapInstanceRef.current.getBounds().getNorth(),
            east: mapInstanceRef.current.getBounds().getEast(),
          }}
          categoryFilter={quickWhat}
          existingLeads={leads}
          onScanCompleted={(additions) => {
            setDiscoveredBusinesses((prev) => {
              const ids = new Set(prev.map((p) => p.externalId));
              const newItems = additions.filter((a) => !ids.has(a.externalId));
              return [...newItems, ...prev];
            });
            showToast(`Area scanner captured ${additions.length} candidate businesses.`);
          }}
        />
      )}
    </div>
  );
};
