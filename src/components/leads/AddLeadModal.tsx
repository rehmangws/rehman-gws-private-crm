import React, { useState, useEffect } from 'react';
import { Lead, Category, LeadSource, LeadStatus, LeadPriority } from '../../types/crm';
import { ALL_LEAD_STATUSES } from '../../constants/seedData';
import {
  normalizePhone,
  normalizeEmail,
  normalizeWebsite,
  extractDomain,
  normalizeBusinessName,
  checkDuplicateLead,
} from '../../utils/normalizer';
import { CRMStorage } from '../../services/crmStorage';
import {
  X,
  AlertTriangle,
  Building2,
  User,
  Phone,
  MessageSquare,
  Mail,
  Globe,
  MapPin,
  Tag,
  Calendar,
  Check,
} from 'lucide-react';

interface AddLeadModalProps {
  categories: Category[];
  existingLeads: Lead[];
  initialCoordinates?: { lat: number; lng: number; address?: string; city?: string; country?: string } | null;
  leadToEdit?: Lead | null;
  onClose: () => void;
  onLeadSaved: () => Promise<void>;
}

export const AddLeadModal: React.FC<AddLeadModalProps> = ({
  categories,
  existingLeads,
  initialCoordinates,
  leadToEdit,
  onClose,
  onLeadSaved,
}) => {
  const [businessName, setBusinessName] = useState(leadToEdit?.businessName || '');
  const [contactPerson, setContactPerson] = useState(leadToEdit?.contactPerson || '');
  const [categoryId, setCategoryId] = useState(leadToEdit?.categoryId || categories[0]?.id || 'cat-1');
  const [phone, setPhone] = useState(leadToEdit?.phone || '');
  const [whatsapp, setWhatsapp] = useState(leadToEdit?.whatsapp || '');
  const [usePhoneAsWhatsapp, setUsePhoneAsWhatsapp] = useState(false);
  const [email, setEmail] = useState(leadToEdit?.email || '');
  const [website, setWebsite] = useState(leadToEdit?.website || '');
  const [address, setAddress] = useState(leadToEdit?.address || initialCoordinates?.address || '');
  const [city, setCity] = useState(leadToEdit?.city || initialCoordinates?.city || 'Dubai');
  const [state, setState] = useState(leadToEdit?.state || '');
  const [country, setCountry] = useState(leadToEdit?.country || initialCoordinates?.country || 'United Arab Emirates');
  const [latitude, setLatitude] = useState<number | undefined>(
    leadToEdit?.latitude ?? initialCoordinates?.lat
  );
  const [longitude, setLongitude] = useState<number | undefined>(
    leadToEdit?.longitude ?? initialCoordinates?.lng
  );
  const [source, setSource] = useState<LeadSource>(
    leadToEdit?.source || (initialCoordinates ? 'Map' : 'Manual')
  );
  const [status, setStatus] = useState<LeadStatus>(leadToEdit?.status || 'New');
  const [priority, setPriority] = useState<LeadPriority>(leadToEdit?.priority || 'Normal');
  const [isHot, setIsHot] = useState<boolean>(leadToEdit?.isHot || false);
  const [tagsString, setTagsString] = useState(leadToEdit?.tags?.join(', ') || '');
  const [initialNote, setInitialNote] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('11:00');

  const [validationError, setValidationError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sync phone to whatsapp if checkbox checked
  useEffect(() => {
    if (usePhoneAsWhatsapp) {
      setWhatsapp(phone);
    }
  }, [phone, usePhoneAsWhatsapp]);

  // Live duplicate check as user types
  useEffect(() => {
    if (!businessName && !phone && !whatsapp && !website) {
      setDuplicateWarning(null);
      return;
    }

    const check = checkDuplicateLead(
      {
        id: leadToEdit?.id,
        businessName,
        phone,
        whatsapp,
        website,
        address,
        city,
      },
      existingLeads
    );

    if (check.status !== 'Unique') {
      setDuplicateWarning(`${check.status}: ${check.reason}`);
    } else {
      setDuplicateWarning(null);
    }
  }, [businessName, phone, whatsapp, website, address, city, existingLeads, leadToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!businessName.trim()) {
      setValidationError('Business Name is required.');
      return;
    }

    // Basic email validation if filled
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setValidationError('Please enter a valid email address.');
      return;
    }

    setIsSaving(true);
    try {
      const selectedCat = categories.find((c) => c.id === categoryId);
      const normPhone = normalizePhone(phone);
      const normWhatsapp = normalizePhone(whatsapp);
      const normEmail = normalizeEmail(email);
      const normWeb = normalizeWebsite(website);
      const normDomain = extractDomain(website);
      const normName = normalizeBusinessName(businessName);

      const tags = tagsString
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      let followUpIso: string | undefined = undefined;
      if (followUpDate) {
        followUpIso = new Date(`${followUpDate}T${followUpTime || '11:00'}:00`).toISOString();
      }

      const leadPayload: Lead = {
        id: leadToEdit?.id || '',
        businessName: businessName.trim(),
        businessNameNormalized: normName,
        contactPerson: contactPerson.trim() || undefined,
        categoryId,
        categoryName: selectedCat?.name || 'General Business',
        phone: phone.trim() || undefined,
        phoneNormalized: normPhone || undefined,
        whatsapp: whatsapp.trim() || undefined,
        whatsappNormalized: normWhatsapp || undefined,
        email: email.trim() || undefined,
        emailNormalized: normEmail || undefined,
        website: normWeb || undefined,
        websiteDomain: normDomain || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        country: country.trim() || undefined,
        latitude,
        longitude,
        source,
        status,
        priority,
        isHot,
        tags,
        notesSummary: initialNote.trim() || leadToEdit?.notesSummary,
        createdAt: leadToEdit?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastContactAt: leadToEdit?.lastContactAt,
        nextFollowUpAt: followUpIso || leadToEdit?.nextFollowUpAt,
        createdBy: leadToEdit?.createdBy || 'admin',
        updatedBy: 'admin',
      };

      await CRMStorage.saveLead(leadPayload, 'admin');

      // Add initial note if provided
      if (initialNote.trim() && leadPayload.id) {
        await CRMStorage.addNote(leadPayload.id, initialNote.trim(), 'Admin');
      }

      // Schedule initial follow-up if date provided
      if (followUpIso && leadPayload.id) {
        await CRMStorage.saveFollowUp({
          id: `fu-${Date.now()}`,
          leadId: leadPayload.id,
          leadBusinessName: leadPayload.businessName,
          leadPhone: leadPayload.phone,
          leadWhatsapp: leadPayload.whatsapp,
          leadEmail: leadPayload.email,
          dateTime: followUpIso,
          actionType: leadPayload.whatsapp ? 'WhatsApp' : 'Call',
          notes: 'Initial scheduled outreach.',
          priority: leadPayload.priority,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });
      }

      await onLeadSaved();
      onClose();
    } catch (err: any) {
      setValidationError(err.message || 'Failed to save lead');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#0E1626] border border-[#1E2C4A] rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#1E2C4A] bg-[#111C33]/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-cyan-400 border border-blue-500/30 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {leadToEdit ? `Edit Lead: ${leadToEdit.businessName}` : 'Add New Lead'}
              </h2>
              <p className="text-xs text-slate-400">
                {initialCoordinates
                  ? 'Capturing from selected World Map coordinate'
                  : 'Enter verified business & contact details'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1E2C4A]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {validationError && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-900 text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {duplicateWarning && (
            <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-800/80 text-xs text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{duplicateWarning}</span>
            </div>
          )}

          {/* Row 1: Business Name & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Business Name <span className="text-cyan-400">*</span>
              </label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Al-Basha Restaurant LLC"
                className="w-full p-2.5 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full p-2.5 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Contact Person & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Contact Person / Decision Maker
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Tariq Rehman (Managing Director)"
                  className="w-full pl-9 pr-3 py-2 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@company.com"
                  className="w-full pl-9 pr-3 py-2 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Row 3: Phone & WhatsApp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+971 50 123 4567"
                  className="w-full pl-9 pr-3 py-2 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">WhatsApp Number</label>
                <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={usePhoneAsWhatsapp}
                    onChange={(e) => setUsePhoneAsWhatsapp(e.target.checked)}
                    className="rounded border-[#1E2C4A] text-cyan-500 focus:ring-0"
                  />
                  <span>Same as phone</span>
                </label>
              </div>
              <div className="relative">
                <MessageSquare className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => {
                    setWhatsapp(e.target.value);
                    setUsePhoneAsWhatsapp(false);
                  }}
                  placeholder="+971 50 123 4567"
                  className="w-full pl-9 pr-3 py-2 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Row 4: Website & Location Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Website URL</label>
              <div className="relative">
                <Globe className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://company.ae"
                  className="w-full pl-9 pr-3 py-2 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Street Address</label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Office 402, Business Bay"
                  className="w-full pl-9 pr-3 py-2 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Row 5: City & Country & Coordinates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Dubai"
                className="w-full p-2 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="United Arab Emirates"
                className="w-full p-2 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Coordinates (Lat, Lng)
              </label>
              <input
                type="text"
                readOnly={Boolean(initialCoordinates)}
                value={
                  latitude && longitude
                    ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
                    : ''
                }
                placeholder="Captured from Map"
                className="w-full p-2 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-cyan-300 font-mono"
              />
            </div>
          </div>

          {/* Row 6: Status & Priority & Source */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full p-2 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white"
              >
                {ALL_LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full p-2 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white"
              >
                <option value="Low">Low</option>
                <option value="Normal">Normal</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Lead Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as any)}
                className="w-full p-2 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white"
              >
                <option value="Manual">Manual</option>
                <option value="Map">Map</option>
                <option value="Google Places">Google Places</option>
                <option value="Website">Website</option>
                <option value="Facebook">Facebook</option>
                <option value="Instagram">Instagram</option>
                <option value="Referral">Referral</option>
                <option value="CSV Import">CSV Import</option>
              </select>
            </div>
          </div>

          {/* Hot Lead Flag & Tags */}
          <div className="p-3 rounded-xl bg-[#080B11] border border-[#1E2C4A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-200">
              <input
                type="checkbox"
                checked={isHot}
                onChange={(e) => setIsHot(e.target.checked)}
                className="rounded border-[#1E2C4A] text-orange-500 focus:ring-0"
              />
              <span className="text-orange-400 font-bold">Mark as Hot Lead</span>
              <span className="text-slate-400 font-normal">(Prioritizes to top of queue)</span>
            </label>

            <div className="flex-1 max-w-sm">
              <input
                type="text"
                value={tagsString}
                onChange={(e) => setTagsString(e.target.value)}
                placeholder="Tags: VIP, DecisionMaker, Enterprise..."
                className="w-full p-1.5 bg-[#0E1626] border border-[#1E2C4A] rounded-lg text-xs text-white placeholder-slate-500"
              />
            </div>
          </div>

          {/* Initial Follow-up & Note */}
          {!leadToEdit && (
            <div className="p-3 rounded-xl bg-[#080B11] border border-[#1E2C4A] space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Initial Follow-up Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full p-1.5 bg-[#0E1626] border border-[#1E2C4A] rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Initial Note / Context
                  </label>
                  <input
                    type="text"
                    value={initialNote}
                    onChange={(e) => setInitialNote(e.target.value)}
                    placeholder="e.g. Sourced from business directory..."
                    className="w-full p-1.5 bg-[#0E1626] border border-[#1E2C4A] rounded-lg text-xs text-white placeholder-slate-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-[#1E2C4A] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-blue-500/20 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : leadToEdit ? 'Update Lead' : 'Save Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
