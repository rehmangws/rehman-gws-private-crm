import React, { useState } from 'react';
import { Lead, Category } from '../../types/crm';
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
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  FileText,
  Layers,
} from 'lucide-react';

interface ImportExportViewProps {
  leads: Lead[];
  categories: Category[];
  onRefreshData: () => Promise<void>;
  onExportCsv: (leads: Lead[]) => void;
}

export const ImportExportView: React.FC<ImportExportViewProps> = ({
  leads,
  categories,
  onRefreshData,
  onExportCsv,
}) => {
  const [csvText, setCsvText] = useState('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Column mappings
  const [mapping, setMapping] = useState<{
    businessName: string;
    contactPerson: string;
    phone: string;
    whatsapp: string;
    email: string;
    website: string;
    city: string;
    address: string;
    category: string;
  }>({
    businessName: '',
    contactPerson: '',
    phone: '',
    whatsapp: '',
    email: '',
    website: '',
    city: '',
    address: '',
    category: '',
  });

  const [validationSummary, setValidationSummary] = useState<{
    valid: any[];
    duplicates: any[];
    invalid: any[];
  }>({ valid: [], duplicates: [], invalid: [] });

  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  // Parse CSV text into array of objects
  const handleParseCsv = (content: string) => {
    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return;

    // Simple CSV parser supporting quotes
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let cur = '';
      let insideQuote = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          insideQuote = !insideQuote;
        } else if (char === ',' && !insideQuote) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += char;
        }
      }
      result.push(cur.trim());
      return result;
    };

    const hdrs = parseLine(lines[0]);
    setHeaders(hdrs);

    // Auto-guess mapping based on header strings
    const newMap = { ...mapping };
    hdrs.forEach((h) => {
      const lower = h.toLowerCase();
      if (lower.includes('business') || lower.includes('company') || lower.includes('name'))
        newMap.businessName = h;
      else if (lower.includes('contact') || lower.includes('person')) newMap.contactPerson = h;
      else if (lower.includes('whatsapp')) newMap.whatsapp = h;
      else if (lower.includes('phone') || lower.includes('tel')) newMap.phone = h;
      else if (lower.includes('email') || lower.includes('mail')) newMap.email = h;
      else if (lower.includes('web') || lower.includes('site') || lower.includes('url'))
        newMap.website = h;
      else if (lower.includes('city')) newMap.city = h;
      else if (lower.includes('address') || lower.includes('street')) newMap.address = h;
      else if (lower.includes('cat') || lower.includes('industry')) newMap.category = h;
    });
    setMapping(newMap);

    const rows = lines.slice(1).map((line) => {
      const vals = parseLine(line);
      const rowObj: Record<string, string> = {};
      hdrs.forEach((h, idx) => {
        rowObj[h] = vals[idx] || '';
      });
      return rowObj;
    });

    setParsedRows(rows);
    setStep(2);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      handleParseCsv(text);
    };
    reader.readAsText(file);
  };

  // Run validation and duplicate checking
  const handleProceedToValidation = () => {
    const valid: any[] = [];
    const duplicates: any[] = [];
    const invalid: any[] = [];

    parsedRows.forEach((row) => {
      const bName = row[mapping.businessName]?.trim();
      if (!bName) {
        invalid.push({ row, reason: 'Missing Business Name' });
        return;
      }

      const ph = row[mapping.phone];
      const wa = row[mapping.whatsapp];
      const web = row[mapping.website];
      const em = row[mapping.email];
      const cityVal = row[mapping.city];
      const addrVal = row[mapping.address];

      const dupCheck = checkDuplicateLead(
        {
          businessName: bName,
          phone: ph,
          whatsapp: wa,
          website: web,
          address: addrVal,
          city: cityVal,
        },
        leads
      );

      if (dupCheck.status === 'Duplicate') {
        duplicates.push({ row, reason: dupCheck.reason, matchLead: dupCheck.matchedLead });
      } else {
        valid.push({ row, possibleDup: dupCheck.status === 'Possible Duplicate' ? dupCheck.reason : undefined });
      }
    });

    setValidationSummary({ valid, duplicates, invalid });
    setStep(3);
  };

  const handleConfirmImport = async () => {
    setIsImporting(true);
    let count = 0;

    for (const item of validationSummary.valid) {
      const r = item.row;
      const bName = r[mapping.businessName]?.trim();
      const catVal = r[mapping.category]?.trim();
      const matchedCat = categories.find((c) => c.name.toLowerCase() === catVal?.toLowerCase());

      const normPh = normalizePhone(r[mapping.phone]);
      const normWa = normalizePhone(r[mapping.whatsapp]);
      const normEm = normalizeEmail(r[mapping.email]);
      const normWeb = normalizeWebsite(r[mapping.website]);
      const normDom = extractDomain(r[mapping.website]);

      await CRMStorage.saveLead(
        {
          id: '',
          businessName: bName,
          businessNameNormalized: normalizeBusinessName(bName),
          contactPerson: r[mapping.contactPerson]?.trim() || undefined,
          categoryId: matchedCat?.id || 'cat-1',
          categoryName: matchedCat?.name || 'General Business',
          phone: r[mapping.phone]?.trim() || undefined,
          phoneNormalized: normPh || undefined,
          whatsapp: r[mapping.whatsapp]?.trim() || undefined,
          whatsappNormalized: normWa || undefined,
          email: r[mapping.email]?.trim() || undefined,
          emailNormalized: normEm || undefined,
          website: normWeb || undefined,
          websiteDomain: normDom || undefined,
          city: r[mapping.city]?.trim() || undefined,
          address: r[mapping.address]?.trim() || undefined,
          country: 'United Arab Emirates',
          source: 'CSV Import',
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

    setIsImporting(false);
    setImportResult(`Import completed successfully! Added ${count} verified leads to CRM.`);
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
                <FileSpreadsheet className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-white">Data Management: CSV Import & Export</h2>
            </div>
            <p className="text-xs text-slate-400">
              Bulk import leads with interactive column mapping, validation, and automated duplicate
              protection.
            </p>
          </div>

          <button
            onClick={() => onExportCsv(leads)}
            className="px-4 py-2.5 rounded-xl bg-[#080B11] hover:bg-[#131E33] border border-[#1E2C4A] text-slate-200 text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors self-start sm:self-auto"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Export All Leads ({leads.length})</span>
          </button>
        </div>
      </div>

      {importResult && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{importResult}</span>
          </div>
          <button
            onClick={() => {
              setImportResult(null);
              setStep(1);
              setCsvText('');
            }}
            className="text-xs text-emerald-400 underline font-semibold cursor-pointer"
          >
            Start New Import
          </button>
        </div>
      )}

      {/* Step Progress */}
      <div className="flex items-center justify-between max-w-xl mx-auto p-2 bg-[#0E1626] border border-[#1E2C4A] rounded-2xl text-xs">
        <div className={`px-3 py-1.5 rounded-xl font-bold ${step === 1 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-500'}`}>
          1. Upload CSV
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
        <div className={`px-3 py-1.5 rounded-xl font-bold ${step === 2 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-500'}`}>
          2. Map Columns
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
        <div className={`px-3 py-1.5 rounded-xl font-bold ${step === 3 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-500'}`}>
          3. Validate & Import
        </div>
      </div>

      {/* STEP 1: Upload or Paste CSV */}
      {step === 1 && (
        <div className="p-6 rounded-2xl bg-[#0E1626] border border-[#1E2C4A] space-y-4">
          <h3 className="text-sm font-bold text-white">Upload or Paste CSV File</h3>

          <div className="p-8 border-2 border-dashed border-[#1E2C4A] hover:border-cyan-500/50 rounded-2xl text-center bg-[#080B11]/50 cursor-pointer relative">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <Upload className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-white">Click to upload CSV file from computer</p>
            <p className="text-[11px] text-slate-500 mt-1">Supports standard CSV exports with commas and quoted text</p>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-[#1E2C4A]" />
            <span className="flex-shrink mx-4 text-xs text-slate-500 font-semibold uppercase">Or paste raw CSV text</span>
            <div className="flex-grow border-t border-[#1E2C4A]" />
          </div>

          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="Business Name,Contact Person,Phone,WhatsApp,Email,City&#10;Apex Group,Tariq Rehman,+971501112233,+971501112233,tariq@apex.ae,Dubai"
            rows={5}
            className="w-full p-3 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white placeholder-slate-600 font-mono focus:outline-none focus:border-cyan-500"
          />

          <button
            onClick={() => handleParseCsv(csvText)}
            disabled={!csvText.trim()}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-40"
          >
            Parse & Map Columns
          </button>
        </div>
      )}

      {/* STEP 2: Map Columns */}
      {step === 2 && (
        <div className="p-6 rounded-2xl bg-[#0E1626] border border-[#1E2C4A] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Map CSV Columns ({parsedRows.length} rows parsed)</h3>
            <button
              onClick={() => setStep(1)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Back to Upload
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            {Object.keys(mapping).map((field) => (
              <div key={field}>
                <label className="block text-slate-300 font-semibold mb-1 capitalize">
                  {field.replace(/([A-Z])/g, ' $1')} {field === 'businessName' && '*'}
                </label>
                <select
                  value={(mapping as any)[field]}
                  onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                  className="w-full p-2 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-white"
                >
                  <option value="">-- Ignore Field --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-[#1E2C4A] flex justify-end gap-3">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleProceedToValidation}
              disabled={!mapping.businessName}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-xs cursor-pointer disabled:opacity-40"
            >
              Validate & Detect Duplicates
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Review & Finalize Import */}
      {step === 3 && (
        <div className="p-6 rounded-2xl bg-[#0E1626] border border-[#1E2C4A] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Import Audit & Duplicate Review</h3>
            <button
              onClick={() => setStep(2)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Back to Mapping
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-900/50">
              <span className="text-xs text-slate-400">Valid Rows to Import</span>
              <div className="text-xl font-bold text-emerald-400 mt-1">
                {validationSummary.valid.length}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-900/50">
              <span className="text-xs text-slate-400">Duplicates Filtered Out</span>
              <div className="text-xl font-bold text-amber-400 mt-1">
                {validationSummary.duplicates.length}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-red-950/30 border border-red-900/50">
              <span className="text-xs text-slate-400">Invalid Rows</span>
              <div className="text-xl font-bold text-red-400 mt-1">
                {validationSummary.invalid.length}
              </div>
            </div>
          </div>

          {validationSummary.duplicates.length > 0 && (
            <div className="p-4 rounded-xl bg-[#080B11] border border-amber-800/60 space-y-2 text-xs">
              <span className="font-bold text-amber-400">Identified Duplicates (Will Not Overwrite Existing CRM Data):</span>
              <ul className="list-disc list-inside space-y-1 text-slate-400 max-h-36 overflow-y-auto">
                {validationSummary.duplicates.map((d, i) => (
                  <li key={i}>
                    {d.row[mapping.businessName]} &bull; {d.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-4 border-t border-[#1E2C4A] flex justify-end gap-3">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Back
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={validationSummary.valid.length === 0 || isImporting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-blue-500/20 cursor-pointer disabled:opacity-40"
            >
              {isImporting ? 'Importing Rows...' : `Import ${validationSummary.valid.length} Valid Leads`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
