import React, { useEffect, useRef, useState } from 'react';
import { Lead, Category } from '../../types/crm';
import { OpenStreetMapProvider, CartoDarkTileLayer } from '../../services/mapProvider';
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
  Calendar,
  X,
  Maximize2,
  Minimize2,
  Check,
} from 'lucide-react';

interface LeadMapProps {
  leads: Lead[];
  categories: Category[];
  onOpenLeadProfile: (lead: Lead) => void;
  onAddLeadAtCoordinates: (coords: { lat: number; lng: number; address?: string; city?: string; country?: string }) => void;
}

export const LeadMap: React.FC<LeadMapProps> = ({
  leads,
  categories,
  onOpenLeadProfile,
  onAddLeadAtCoordinates,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const tempMarkerRef = useRef<L.Marker | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [clickedLocation, setClickedLocation] = useState<{
    lat: number;
    lng: number;
    address?: string;
    city?: string;
    country?: string;
  } | null>(null);

  // Quick Jump Presets
  const CITY_PRESETS = [
    { name: 'Dubai', lat: 25.2048, lng: 55.2708, zoom: 12 },
    { name: 'Abu Dhabi', lat: 24.4539, lng: 54.3773, zoom: 12 },
    { name: 'Riyadh', lat: 24.7136, lng: 46.6753, zoom: 12 },
    { name: 'Doha', lat: 25.2854, lng: 51.531, zoom: 12 },
    { name: 'London', lat: 51.5074, lng: -0.1278, zoom: 12 },
    { name: 'New York', lat: 40.7128, lng: -74.006, zoom: 12 },
    { name: 'World View', lat: 25.0, lng: 30.0, zoom: 3 },
  ];

  // Helper to get marker color based on lead status
  const getMarkerColor = (lead: Lead) => {
    if (lead.priority === 'Urgent' || (lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) < new Date())) {
      return '#EF4444'; // Red = Overdue / Urgent
    }
    if (lead.status === 'Won / Client' || lead.status === 'Interested') {
      return '#10B981'; // Emerald = Interested / Won
    }
    if (lead.status === 'Follow-up' || lead.status === 'Meeting Scheduled') {
      return '#F59E0B'; // Amber = Follow-up
    }
    if (lead.status === 'Contacted' || lead.status.includes('Opened') || lead.status.includes('Confirmed')) {
      return '#06B6D4'; // Cyan = Contacted
    }
    return '#3B82F6'; // Blue = New
  };

  // Create custom SVG Leaflet Icon
  const createCustomIcon = (color: string, isTemporary = false) => {
    return L.divIcon({
      className: 'custom-lead-marker',
      html: `
        <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 24px; height: 24px; border-radius: 50%; background-color: ${color}; opacity: 0.25; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 18px; height: 18px; border-radius: 50%; background-color: ${color}; border: 2.5px solid #0E1626; box-shadow: 0 0 10px ${color};"></div>
          ${isTemporary ? '<div style="position: absolute; top: -18px; background: #2563EB; color: white; font-size: 9px; font-weight: bold; padding: 2px 5px; border-radius: 4px; white-space: nowrap;">New Target</div>' : ''}
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
    });
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center on Dubai / Global commercial hub
    const map = L.map(mapContainerRef.current, {
      center: [25.2048, 55.2708],
      zoom: 11,
      zoomControl: true,
      attributionControl: true,
    });

    // Dark tiles from CARTO / OSM
    L.tileLayer(CartoDarkTileLayer.darkUrl, {
      attribution: CartoDarkTileLayer.attribution,
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapInstanceRef.current = map;

    // Handle Map Click to Drop Temporary Pin for Lead Creation
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;

      if (tempMarkerRef.current) {
        tempMarkerRef.current.remove();
      }

      const tempMarker = L.marker([lat, lng], {
        icon: createCustomIcon('#38BDF8', true),
      }).addTo(map);
      tempMarkerRef.current = tempMarker;

      // Reverse geocode to get street / city / country
      const geo = await OpenStreetMapProvider.reverse(lat, lng);
      setClickedLocation({
        lat,
        lng,
        address: geo?.address || '',
        city: geo?.city || '',
        country: geo?.country || '',
      });
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update CRM Lead Markers whenever leads or filters change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    const markersLayer = markersLayerRef.current;
    markersLayer.clearLayers();

    const filteredLeads = leads.filter((l) => {
      if (selectedCategory !== 'all' && l.categoryId !== selectedCategory) return false;
      if (selectedStatus !== 'all' && l.status !== selectedStatus) return false;
      return true;
    });

    filteredLeads.forEach((lead) => {
      // Determine coordinates (fall back to mock coordinates based on city if latitude/longitude absent)
      let lat = lead.latitude;
      let lng = lead.longitude;

      if (lat === undefined || lng === undefined) {
        // If city is Dubai, place with slight random offset for testing
        if (lead.city?.toLowerCase().includes('dubai')) {
          lat = 25.2048 + (Math.sin(lead.id.length) * 0.05);
          lng = 55.2708 + (Math.cos(lead.id.length) * 0.05);
        } else {
          return; // Skip leads without geo coords
        }
      }

      const markerColor = getMarkerColor(lead);
      const marker = L.marker([lat, lng], {
        icon: createCustomIcon(markerColor),
      });

      // Bind rich popup card
      const popupHtml = `
        <div style="min-width: 220px; font-family: sans-serif;">
          <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #38BDF8; margin-bottom: 2px;">
            ${lead.categoryName} &bull; ${lead.status}
          </div>
          <div style="font-size: 14px; font-weight: 800; color: #FFFFFF; margin-bottom: 4px;">
            ${lead.businessName}
          </div>
          <div style="font-size: 11px; color: #94A3B8; margin-bottom: 8px;">
            ${lead.address || lead.city || 'Location recorded'}
          </div>
          <div style="font-size: 11px; color: #E2E8F0; margin-bottom: 8px; border-top: 1px solid #1E2C4A; padding-top: 6px;">
            ${lead.phone ? `<div>Phone: <strong>${lead.phone}</strong></div>` : ''}
            ${lead.whatsapp ? `<div>WhatsApp: <strong>${lead.whatsapp}</strong></div>` : ''}
            ${lead.nextFollowUpAt ? `<div style="color: #F59E0B;">Follow-up: ${new Date(lead.nextFollowUpAt).toLocaleDateString()}</div>` : ''}
          </div>
          <button id="view-lead-${lead.id}" style="width: 100%; background: #2563EB; color: #FFF; border: none; border-radius: 6px; padding: 6px 10px; font-size: 11px; font-weight: 600; cursor: pointer;">
            Open Lead Profile
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on('popupopen', () => {
        const btn = document.getElementById(`view-lead-${lead.id}`);
        if (btn) {
          btn.onclick = () => onOpenLeadProfile(lead);
        }
      });

      marker.addTo(markersLayer);
    });
  }, [leads, selectedCategory, selectedStatus, onOpenLeadProfile]);

  // Handle Geocoding Search (City or Area)
  const handleLocationSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !mapInstanceRef.current) return;
    setIsSearchingLocation(true);
    const results = await OpenStreetMapProvider.search(searchQuery);
    setIsSearchingLocation(false);
    if (results.length > 0) {
      const top = results[0];
      mapInstanceRef.current.flyTo([top.latitude, top.longitude], 13, { duration: 1.5 });
    }
  };

  const handlePresetClick = (preset: typeof CITY_PRESETS[0]) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([preset.lat, preset.lng], preset.zoom, { duration: 1.2 });
    }
  };

  const handleConfirmAddLead = () => {
    if (!clickedLocation) return;
    onAddLeadAtCoordinates(clickedLocation);
    setClickedLocation(null);
    if (tempMarkerRef.current) {
      tempMarkerRef.current.remove();
      tempMarkerRef.current = null;
    }
  };

  return (
    <div
      className={`space-y-4 ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-[#080B11] p-4 flex flex-col h-screen'
          : 'relative'
      }`}
    >
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0E1626] border border-[#1E2C4A] p-3.5 rounded-2xl shadow-sm">
        {/* Search Bar for Country/City */}
        <form onSubmit={handleLocationSearch} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Jump to country, city, or area (e.g. Dubai Marina, Riyadh)..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            type="submit"
            disabled={isSearchingLocation}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shrink-0 cursor-pointer disabled:opacity-50"
          >
            {isSearchingLocation ? 'Locating...' : 'Fly To'}
          </button>
        </form>

        {/* Quick Presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
          {CITY_PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => handlePresetClick(p)}
              className="px-2.5 py-1 rounded-lg bg-[#080B11] hover:bg-[#131E33] border border-[#1E2C4A] text-[11px] font-medium text-slate-300 hover:text-white shrink-0 cursor-pointer"
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Fullscreen Toggle */}
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-2 rounded-xl bg-[#080B11] border border-[#1E2C4A] text-slate-400 hover:text-white cursor-pointer shrink-0 hidden sm:flex items-center justify-center"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Map Layout: Left Filters + Center Map Canvas + Bottom Location Action */}
      <div className="flex flex-col lg:flex-row gap-4 relative">
        {/* Left Filter & Status Legend Panel */}
        <div className="w-full lg:w-64 bg-[#0E1626] border border-[#1E2C4A] rounded-2xl p-4 space-y-4 shrink-0 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-[#1E2C4A]">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
              <span>Map Lead Filters</span>
            </span>
            <span className="text-[10px] text-cyan-400 font-mono">
              {leads.length} Leads
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full p-2 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full p-2 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white"
            >
              <option value="all">All Statuses</option>
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Follow-up">Follow-up</option>
              <option value="Interested">Interested</option>
              <option value="Won / Client">Won / Client</option>
            </select>
          </div>

          {/* Color Legend */}
          <div className="pt-2 border-t border-[#1E2C4A]">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Marker Legend
            </span>
            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
                <span>New Lead</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" />
                <span>Contacted / Opened</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
                <span>Follow-up Scheduled</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                <span>Interested / Won</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-sm shadow-red-400/50" />
                <span>Overdue / Urgent</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#1E2C4A] text-[11px] text-slate-400">
            <span className="font-semibold text-slate-300 block mb-1">Manual Capture</span>
            Click anywhere on the world map to drop a pin and capture a lead with coordinates.
          </div>
        </div>

        {/* Center Map Canvas */}
        <div className="flex-1 relative rounded-2xl overflow-hidden border border-[#1E2C4A] min-h-[520px] shadow-xl">
          <div ref={mapContainerRef} className="w-full h-full min-h-[520px] bg-[#080B11]" />

          {/* Add Lead From Selected Map Position Floating Card */}
          {clickedLocation && (
            <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-[1000] w-auto sm:w-80 bg-[#0E1626]/95 border border-cyan-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1E2C4A]">
                <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                  <MapPin className="w-4 h-4" />
                  <span>Map Position Selected</span>
                </div>
                <button
                  onClick={() => {
                    setClickedLocation(null);
                    if (tempMarkerRef.current) tempMarkerRef.current.remove();
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1 text-xs text-slate-300">
                <p className="font-semibold text-white">
                  {clickedLocation.address || 'Custom Coordinate Point'}
                </p>
                {clickedLocation.city && (
                  <p className="text-slate-400">
                    {clickedLocation.city}, {clickedLocation.country}
                  </p>
                )}
                <p className="text-[10px] text-cyan-400 font-mono">
                  {clickedLocation.lat.toFixed(5)}, {clickedLocation.lng.toFixed(5)}
                </p>
              </div>

              <button
                onClick={handleConfirmAddLead}
                className="mt-3 w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Lead From Position</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
