import React, { useState, useMemo } from 'react';
import { Lead, Category, LeadStatus, LeadPriority, LeadSource } from '../../types/crm';
import { ALL_LEAD_STATUSES, DEFAULT_SAVED_VIEWS } from '../../constants/seedData';
import { CRMStorage } from '../../services/crmStorage';
import {
  Search,
  Filter,
  Plus,
  ArrowUpDown,
  MoreVertical,
  Phone,
  MessageSquare,
  Mail,
  ExternalLink,
  Flame,
  Clock,
  Trash2,
  Edit,
  Download,
  Calendar,
  Layers,
  CheckSquare,
  Square,
  X,
  AlertCircle,
} from 'lucide-react';

interface LeadsViewProps {
  leads: Lead[];
  categories: Category[];
  onOpenLeadProfile: (lead: Lead) => void;
  onEditLead: (lead: Lead) => void;
  onAddNewLead: () => void;
  onRefreshData: () => Promise<void>;
  onExportCsv: (leadsToExport: Lead[]) => void;
}

export const LeadsView: React.FC<LeadsViewProps> = ({
  leads,
  categories,
  onOpenLeadProfile,
  onEditLead,
  onAddNewLead,
  onRefreshData,
  onExportCsv,
}) => {
  const [search, setSearch] = useState('');
  const [selectedViewId, setSelectedViewId] = useState('view-all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterHasPhone, setFilterHasPhone] = useState(false);
  const [filterHasWhatsapp, setFilterHasWhatsapp] = useState(false);
  const [filterHasEmail, setFilterHasEmail] = useState(false);
  const [filterOverdueOnly, setFilterOverdueOnly] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<keyof Lead>('createdAt');
  const [sortAsc, setSortAsc] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<LeadStatus>('Contacted');
  const [bulkPriority, setBulkPriority] = useState<LeadPriority>('High');
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Handle saved view change
  const handleSavedViewSelect = (viewId: string) => {
    setSelectedViewId(viewId);
    setPage(1);
    const view = DEFAULT_SAVED_VIEWS.find((v) => v.id === viewId);
    if (!view) return;

    // Reset standard filters
    setFilterCategory('all');
    setFilterStatus('all');
    setFilterPriority('all');
    setFilterSource('all');
    setFilterHasPhone(false);
    setFilterHasWhatsapp(false);
    setFilterHasEmail(false);
    setFilterOverdueOnly(false);

    if (view.filters.status && view.filters.status.length === 1) {
      setFilterStatus(view.filters.status[0]);
    }
    if (view.filters.isHot) {
      // hot filter
    }
    if (view.filters.overdueOnly) {
      setFilterOverdueOnly(true);
    }
  };

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = lead.businessName.toLowerCase().includes(q);
        const matchContact = lead.contactPerson?.toLowerCase().includes(q);
        const matchPhone = lead.phone?.includes(q) || lead.whatsapp?.includes(q);
        const matchEmail = lead.email?.toLowerCase().includes(q);
        const matchCity = lead.city?.toLowerCase().includes(q);
        const matchTags = lead.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchName && !matchContact && !matchPhone && !matchEmail && !matchCity && !matchTags) {
          return false;
        }
      }

      // Saved view overrides
      if (selectedViewId === 'view-new' && lead.status !== 'New') return false;
      if (selectedViewId === 'view-need-contact' && !['New', 'To Contact'].includes(lead.status)) return false;
      if (selectedViewId === 'view-no-response' && lead.status !== 'No Answer') return false;
      if (selectedViewId === 'view-followup-today') {
        const todayStr = new Date().toDateString();
        if (!lead.nextFollowUpAt || new Date(lead.nextFollowUpAt).toDateString() !== todayStr) return false;
      }
      if (selectedViewId === 'view-overdue') {
        if (!lead.nextFollowUpAt || new Date(lead.nextFollowUpAt).getTime() >= Date.now()) return false;
      }
      if (selectedViewId === 'view-interested' && lead.status !== 'Interested') return false;
      if (selectedViewId === 'view-hot' && !lead.isHot && lead.status !== 'Hot Lead') return false;
      if (selectedViewId === 'view-won' && lead.status !== 'Won / Client') return false;
      if (selectedViewId === 'view-never-contacted' && lead.lastContactAt) return false;

      // Dropdown filters
      if (filterCategory !== 'all' && lead.categoryId !== filterCategory) return false;
      if (filterStatus !== 'all' && lead.status !== filterStatus) return false;
      if (filterPriority !== 'all' && lead.priority !== filterPriority) return false;
      if (filterSource !== 'all' && lead.source !== filterSource) return false;
      if (filterHasPhone && !lead.phone) return false;
      if (filterHasWhatsapp && !lead.whatsapp && !lead.phone) return false;
      if (filterHasEmail && !lead.email) return false;
      if (filterOverdueOnly) {
        if (!lead.nextFollowUpAt || new Date(lead.nextFollowUpAt).getTime() >= Date.now()) return false;
      }

      return true;
    });
  }, [
    leads,
    search,
    selectedViewId,
    filterCategory,
    filterStatus,
    filterPriority,
    filterSource,
    filterHasPhone,
    filterHasWhatsapp,
    filterHasEmail,
    filterOverdueOnly,
  ]);

  // Sorted Leads
  const sortedLeads = useMemo(() => {
    return [...filteredLeads].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredLeads, sortField, sortAsc]);

  // Paged
  const totalPages = Math.ceil(sortedLeads.length / pageSize) || 1;
  const pagedLeads = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedLeads.slice(start, start + pageSize);
  }, [sortedLeads, page, pageSize]);

  // Selection toggles
  const handleSelectAll = () => {
    if (selectedIds.size === pagedLeads.length && pagedLeads.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pagedLeads.map((l) => l.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Bulk execution
  const handleBulkStatusUpdate = async () => {
    if (selectedIds.size === 0) return;
    for (const id of Array.from(selectedIds)) {
      await CRMStorage.updateLeadStatus(id, bulkStatus, 'admin');
    }
    setSelectedIds(new Set());
    await onRefreshData();
  };

  const handleBulkArchive = async () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Archive ${selectedIds.size} selected leads?`)) {
      for (const id of Array.from(selectedIds)) {
        await CRMStorage.archiveLead(id, 'admin');
      }
      setSelectedIds(new Set());
      await onRefreshData();
    }
  };

  const handleSort = (field: keyof Lead) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0E1626] border border-[#1E2C4A] p-4 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Lead Database</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-mono font-medium">
              {filteredLeads.length} total
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Real-time verified leads directory with cursor filtering and bulk actions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onExportCsv(selectedIds.size > 0 ? leads.filter((l) => selectedIds.has(l.id)) : filteredLeads)}
            className="px-3.5 py-2 rounded-xl bg-[#080B11] hover:bg-[#131E33] border border-[#1E2C4A] text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onAddNewLead}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* Saved Views Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {DEFAULT_SAVED_VIEWS.map((sv) => (
          <button
            key={sv.id}
            onClick={() => handleSavedViewSelect(sv.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 cursor-pointer transition-colors ${
              selectedViewId === sv.id
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'bg-[#0E1626] text-slate-400 hover:text-white border border-[#1E2C4A]'
            }`}
          >
            {sv.name}
          </button>
        ))}
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-[#0E1626] border border-[#1E2C4A] space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search business, contact person, phone, WhatsApp, domain, tags..."
              className="w-full pl-10 pr-4 py-2 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Page size */}
          <div className="flex items-center gap-2 shrink-0 text-xs text-slate-400">
            <span>Show:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="p-1.5 bg-[#080B11] border border-[#1E2C4A] rounded-lg text-white"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Multi-Filters Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 pt-1 text-xs">
          <select
            value={filterCategory}
            onChange={(e) => {
              setFilterCategory(e.target.value);
              setPage(1);
            }}
            className="p-2 bg-[#080B11] border border-[#1E2C4A] rounded-lg text-slate-300"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
            className="p-2 bg-[#080B11] border border-[#1E2C4A] rounded-lg text-slate-300"
          >
            <option value="all">All Statuses</option>
            {ALL_LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={filterPriority}
            onChange={(e) => {
              setFilterPriority(e.target.value);
              setPage(1);
            }}
            className="p-2 bg-[#080B11] border border-[#1E2C4A] rounded-lg text-slate-300"
          >
            <option value="all">All Priorities</option>
            <option value="Low">Low</option>
            <option value="Normal">Normal</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>

          <select
            value={filterSource}
            onChange={(e) => {
              setFilterSource(e.target.value);
              setPage(1);
            }}
            className="p-2 bg-[#080B11] border border-[#1E2C4A] rounded-lg text-slate-300"
          >
            <option value="all">All Sources</option>
            <option value="Manual">Manual</option>
            <option value="Map">Map</option>
            <option value="Google Places">Google Places</option>
            <option value="Website">Website</option>
            <option value="CSV Import">CSV Import</option>
          </select>

          <label className="flex items-center gap-2 p-2 rounded-lg bg-[#080B11] border border-[#1E2C4A] text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={filterHasWhatsapp}
              onChange={(e) => setFilterHasWhatsapp(e.target.checked)}
              className="rounded border-[#1E2C4A] text-emerald-500 focus:ring-0"
            />
            <span>Has WhatsApp</span>
          </label>

          <label className="flex items-center gap-2 p-2 rounded-lg bg-[#080B11] border border-[#1E2C4A] text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={filterHasEmail}
              onChange={(e) => setFilterHasEmail(e.target.checked)}
              className="rounded border-[#1E2C4A] text-cyan-500 focus:ring-0"
            />
            <span>Has Email</span>
          </label>
        </div>
      </div>

      {/* Bulk Selection Bar if any checked */}
      {selectedIds.size > 0 && (
        <div className="p-3 bg-blue-950/40 border border-blue-800/60 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in">
          <div className="flex items-center gap-2 text-cyan-300 font-semibold">
            <CheckSquare className="w-4 h-4 text-cyan-400" />
            <span>{selectedIds.size} leads selected</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as any)}
              className="p-1.5 bg-[#080B11] border border-[#1E2C4A] rounded-lg text-white"
            >
              {ALL_LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  Change to {s}
                </option>
              ))}
            </select>
            <button
              onClick={handleBulkStatusUpdate}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg cursor-pointer"
            >
              Apply Status
            </button>
            <button
              onClick={handleBulkArchive}
              className="px-3 py-1.5 bg-red-900/60 hover:bg-red-800 text-red-200 border border-red-700/60 font-semibold rounded-lg cursor-pointer"
            >
              Archive
            </button>
          </div>
        </div>
      )}

      {/* Leads Table */}
      <div className="rounded-2xl bg-[#0E1626] border border-[#1E2C4A] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1E2C4A] bg-[#111C33]/60 text-slate-400 font-semibold select-none">
                <th className="p-3 w-10 text-center">
                  <button
                    onClick={handleSelectAll}
                    className="p-1 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {selectedIds.size === pagedLeads.length && pagedLeads.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th
                  onClick={() => handleSort('businessName')}
                  className="p-3 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Business / Lead</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="p-3">Category</th>
                <th className="p-3">Contact Person</th>
                <th className="p-3">Communication</th>
                <th className="p-3">Location</th>
                <th
                  onClick={() => handleSort('status')}
                  className="p-3 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('priority')}
                  className="p-3 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Priority</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('nextFollowUpAt')}
                  className="p-3 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Next Follow-up</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2C4A]/60">
              {pagedLeads.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-400">
                    <div className="max-w-sm mx-auto space-y-2">
                      <AlertCircle className="w-8 h-8 text-slate-500 mx-auto" />
                      <p className="text-sm font-semibold text-white">No leads match these filters</p>
                      <p className="text-xs text-slate-500">
                        Try resetting filters or click "+ Add Lead" to create a new record.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                pagedLeads.map((lead) => {
                  const isChecked = selectedIds.has(lead.id);
                  const isOverdue =
                    lead.nextFollowUpAt && new Date(lead.nextFollowUpAt).getTime() < Date.now();

                  return (
                    <tr
                      key={lead.id}
                      className={`hover:bg-[#131E33]/60 transition-colors ${
                        isChecked ? 'bg-blue-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleToggleSelect(lead.id)}
                          className="p-1 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-cyan-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Business Name */}
                      <td className="p-3">
                        <div
                          onClick={() => onOpenLeadProfile(lead)}
                          className="cursor-pointer group"
                        >
                          <div className="font-bold text-white group-hover:text-cyan-300 transition-colors flex items-center gap-1.5">
                            <span>{lead.businessName}</span>
                            {lead.isHot && (
                              <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                            )}
                          </div>
                          {lead.website && (
                            <span className="text-[11px] text-slate-500 hover:text-cyan-400 truncate max-w-[180px] block">
                              {lead.websiteDomain || lead.website}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="p-3">
                        <span className="text-slate-300 font-medium">{lead.categoryName}</span>
                      </td>

                      {/* Contact Person */}
                      <td className="p-3">
                        <span className="text-slate-300">
                          {lead.contactPerson || <span className="text-slate-600">—</span>}
                        </span>
                      </td>

                      {/* Phone & WhatsApp Quick Icons */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          {lead.phone && (
                            <a
                              href={`tel:${lead.phone}`}
                              title={`Call ${lead.phone}`}
                              className="p-1.5 rounded-lg bg-[#080B11] hover:bg-blue-600 hover:text-white text-blue-400 border border-[#1E2C4A] transition-colors"
                            >
                              <Phone className="w-3 h-3" />
                            </a>
                          )}
                          {(lead.whatsapp || lead.phone) && (
                            <a
                              href={`https://wa.me/${(lead.whatsapp || lead.phone)?.replace(
                                /[^\d]/g,
                                ''
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Open WhatsApp"
                              className="p-1.5 rounded-lg bg-[#080B11] hover:bg-emerald-600 hover:text-white text-emerald-400 border border-[#1E2C4A] transition-colors"
                            >
                              <MessageSquare className="w-3 h-3" />
                            </a>
                          )}
                          {lead.email && (
                            <a
                              href={`mailto:${lead.email}`}
                              title={`Email ${lead.email}`}
                              className="p-1.5 rounded-lg bg-[#080B11] hover:bg-cyan-600 hover:text-white text-cyan-400 border border-[#1E2C4A] transition-colors"
                            >
                              <Mail className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Location */}
                      <td className="p-3">
                        <span className="text-slate-300">
                          {lead.city || lead.country || <span className="text-slate-600">—</span>}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md bg-[#080B11] border border-[#1E2C4A] text-slate-300 font-medium">
                          {lead.status}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="p-3">
                        <span
                          className={`font-semibold ${
                            lead.priority === 'Urgent'
                              ? 'text-red-400'
                              : lead.priority === 'High'
                              ? 'text-amber-400'
                              : lead.priority === 'Medium'
                              ? 'text-blue-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {lead.priority}
                        </span>
                      </td>

                      {/* Next Follow-up */}
                      <td className="p-3">
                        {lead.nextFollowUpAt ? (
                          <div
                            className={`flex items-center gap-1 font-mono text-[11px] ${
                              isOverdue ? 'text-red-400 font-bold' : 'text-slate-300'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            <span>
                              {new Date(lead.nextFollowUpAt).toLocaleDateString()}{' '}
                              {isOverdue && '(Overdue)'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenLeadProfile(lead)}
                            className="px-2.5 py-1 rounded-lg bg-[#131E33] hover:bg-blue-600 hover:text-white text-slate-300 font-semibold text-[11px] cursor-pointer transition-colors"
                          >
                            Profile
                          </button>
                          <button
                            onClick={() => onEditLead(lead)}
                            className="p-1 rounded-lg hover:bg-[#131E33] text-slate-400 hover:text-white cursor-pointer"
                            title="Edit"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3 border-t border-[#1E2C4A] bg-[#111C33]/40 flex items-center justify-between text-xs text-slate-400">
          <span>
            Showing {(page - 1) * pageSize + 1} to{' '}
            {Math.min(page * pageSize, sortedLeads.length)} of {sortedLeads.length} leads
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded-lg bg-[#080B11] border border-[#1E2C4A] text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
            >
              Previous
            </button>
            <span className="font-semibold text-white">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded-lg bg-[#080B11] border border-[#1E2C4A] text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
