import React, { useState } from 'react';
import { Lead, Category } from '../../types/crm';
import { DiscoveryProvider, DiscoverySearchResult } from '../../services/discoveryProvider';
import { CRMStorage } from '../../services/crmStorage';
import {
  Sparkles,
  Search,
  AlertCircle,
  Building2,
  CheckCircle,
  Download,
  ExternalLink,
  MapPin,
  Settings,
} from 'lucide-react';

interface LeadGeneratorProps {
  categories: Category[];
  existingLeads: Lead[];
  onNavigateToSettings: () => void;
  onRefreshData: () => Promise<void>;
}

export const LeadGenerator: React.FC<LeadGeneratorProps> = ({
  categories,
  existingLeads,
  onNavigateToSettings,
  onRefreshData,
}) => {
  const isConfigured = DiscoveryProvider.isPlacesConfigured();
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('Dubai');
  const [country, setCountry] = useState('United Arab Emirates');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<DiscoverySearchResult | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchResult(null);
    setSuccessMsg(null);
    const result = await DiscoveryProvider.searchBusinesses({
      query,
      city,
      country,
      existingLeads,
    });
    setSearchResult(result);
    setSearching(false);
  };

  const handleToggleSelect = (idx: number) => {
    const next = new Set(selectedIndices);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedIndices(next);
  };

  const handleImportSelected = async () => {
    if (!searchResult || selectedIndices.size === 0) return;
    setImporting(true);

    let count = 0;
    for (const idx of Array.from(selectedIndices)) {
      const item = searchResult.results[idx];
      if (!item) continue;
      const bus = item.business;

      await CRMStorage.saveLead(
        {
          id: '',
          businessName: bus.name,
          businessNameNormalized: bus.name.toLowerCase().trim(),
          categoryId: 'cat-1',
          categoryName: bus.category || 'General Business',
          phone: bus.phone,
          address: bus.address,
          city: bus.city || city,
          country: bus.country || country,
          latitude: bus.latitude,
          longitude: bus.longitude,
          externalPlaceId: bus.placeId,
          googlePlaceId: bus.placeId,
          source: 'Google Places',
          status: 'New',
          priority: 'Normal',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'admin',
          updatedBy: 'admin',
        },
        'admin'
      );
      count++;
    }

    setImporting(false);
    setSelectedIndices(new Set());
    setSuccessMsg(`Successfully imported ${count} discovered leads into your CRM database.`);
    await onRefreshData();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0E1626] border border-[#1E2C4A] p-6 rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-blue-500/20 text-cyan-400 border border-blue-500/30">
                <Sparkles className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-white">Automated Lead Generator</h2>
            </div>
            <p className="text-xs text-slate-400 max-w-xl">
              Targeted business discovery integration. Discover and review legitimate businesses by
              category, city, and area with built-in duplicate filtering prior to import.
            </p>
          </div>

          {!isConfigured && (
            <button
              onClick={onNavigateToSettings}
              className="px-3.5 py-2 rounded-xl bg-[#131E33] hover:bg-[#1E2C4A] border border-[#1E2C4A] text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4 text-cyan-400" />
              <span>Configure Places API</span>
            </button>
          )}
        </div>
      </div>

      {/* Integration Notice if unconfigured */}
      {!isConfigured && (
        <div className="p-5 rounded-2xl bg-[#0E1626] border border-[#1E2C4A] space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <h4 className="font-bold text-white">External Lead Discovery Not Configured</h4>
              <p className="text-slate-400">
                Per the <strong>Cost-First Architecture</strong>, the core CRM works completely
                free without paid APIs. To enable automated discovery via Google Places API, add your
                Google Places API key in Settings &rarr; Google API Configuration.
              </p>
              <p className="text-cyan-400 font-medium pt-1">
                Tip: You can always use the World Lead Map to browse locations and manually capture
                verified leads with auto-coordinates for free.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search Input Form */}
      <form
        onSubmit={handleSearch}
        className="p-5 rounded-2xl bg-[#0E1626] border border-[#1E2C4A] space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Search Query / Category
            </label>
            <input
              type="text"
              required
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Restaurants, Dental Clinics, IT Consulting"
              className="w-full p-2.5 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">City / Region</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Dubai"
              className="w-full p-2.5 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Country</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. United Arab Emirates"
              className="w-full p-2.5 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-[11px] text-slate-500">
            Strict No-Fake-Data Policy: Results returned strictly from legitimate search providers.
          </span>
          <button
            type="submit"
            disabled={searching}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{searching ? 'Discovering...' : 'Discover Leads'}</span>
          </button>
        </div>
      </form>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Results View */}
      {searchResult && (
        <div className="space-y-4">
          {searchResult.statusMessage && (
            <div className="p-4 rounded-xl bg-[#0E1626] border border-[#1E2C4A] text-xs text-slate-300">
              {searchResult.statusMessage}
            </div>
          )}

          {searchResult.results.length > 0 && (
            <div className="p-4 rounded-2xl bg-[#0E1626] border border-[#1E2C4A] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">
                  {searchResult.results.length} Genuine Candidates Discovered
                </span>
                <button
                  onClick={handleImportSelected}
                  disabled={selectedIndices.size === 0 || importing}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {importing ? 'Importing...' : `Import ${selectedIndices.size} Selected`}
                  </span>
                </button>
              </div>

              <div className="space-y-2">
                {searchResult.results.map((r, i) => {
                  const isChecked = selectedIndices.has(i);
                  const isDup = r.duplicateStatus === 'Duplicate';
                  return (
                    <div
                      key={i}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                        isDup
                          ? 'bg-[#080B11]/50 border-amber-900/40 text-slate-400'
                          : 'bg-[#080B11] border-[#1E2C4A] text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          disabled={isDup}
                          checked={isChecked}
                          onChange={() => handleToggleSelect(i)}
                          className="rounded border-[#1E2C4A] text-cyan-500 focus:ring-0 cursor-pointer"
                        />
                        <div>
                          <div className="font-bold text-white flex items-center gap-2">
                            <span>{r.business.name}</span>
                            {r.duplicateStatus !== 'Unique' && (
                              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                                {r.duplicateStatus}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {r.business.address || `${city}, ${country}`}
                          </p>
                          {r.duplicateReason && (
                            <p className="text-[10px] text-amber-400/90 mt-0.5 font-medium">
                              {r.duplicateReason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
