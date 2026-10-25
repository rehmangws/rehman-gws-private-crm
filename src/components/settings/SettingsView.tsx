import React, { useState } from 'react';
import { DailyTargets, FollowUpRules, AutomationSettings, UserProfile } from '../../types/crm';
import { CRMStorage } from '../../services/crmStorage';
import { isFirebaseConfigured } from '../../services/firebaseConfig';
import {
  Settings,
  Shield,
  Target,
  Clock,
  MapPin,
  Sparkles,
  Database,
  Key,
  CheckCircle,
  Save,
  Download,
  Trash2,
} from 'lucide-react';

interface SettingsViewProps {
  user: UserProfile | null;
  dailyTargets: DailyTargets;
  followUpRules: FollowUpRules;
  automationSettings: AutomationSettings;
  onRefreshData: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  dailyTargets,
  followUpRules,
  automationSettings,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<
    'profile' | 'targets' | 'rules' | 'integrations' | 'automation' | 'data'
  >('profile');

  // Targets state
  const [targetsDraft, setTargetsDraft] = useState<DailyTargets>({ ...dailyTargets });

  // Rules state
  const [rulesDraft, setRulesDraft] = useState<FollowUpRules>({ ...followUpRules });

  // Google Places API Key
  const [googleKey, setGoogleKey] = useState(
    localStorage.getItem('rehman_gws_google_places_key') || ''
  );

  // Automation
  const [autoDraft, setAutoDraft] = useState<AutomationSettings>({ ...automationSettings });

  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveTargets = () => {
    CRMStorage.saveDailyTargets(targetsDraft);
    showToast('Daily Targets updated successfully.');
    onRefreshData();
  };

  const handleSaveRules = () => {
    CRMStorage.saveFollowUpRules(rulesDraft);
    showToast('Follow-up Rules updated successfully.');
    onRefreshData();
  };

  const handleSaveGoogleKey = () => {
    if (googleKey.trim()) {
      localStorage.setItem('rehman_gws_google_places_key', googleKey.trim());
      showToast('Google Places API key saved.');
    } else {
      localStorage.removeItem('rehman_gws_google_places_key');
      showToast('Google Places API key removed.');
    }
  };

  const handleSaveAutomation = () => {
    CRMStorage.saveAutomationSettings(autoDraft);
    showToast('Automation settings saved.');
    onRefreshData();
  };

  const handleDownloadBackup = async () => {
    const leads = await CRMStorage.getLeads(true);
    const acts = await CRMStorage.getActivities(undefined, 1000);
    const fus = await CRMStorage.getFollowUps();

    const backup = {
      version: '2.6.0',
      exportedAt: new Date().toISOString(),
      leads,
      activities: acts,
      followUps: fus,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rehman-gws-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup JSON downloaded successfully.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0E1626] border border-[#1E2C4A] p-6 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="p-1.5 rounded-lg bg-blue-500/20 text-cyan-400 border border-blue-500/30">
            <Settings className="w-4 h-4" />
          </span>
          <h2 className="text-lg font-bold text-white">System Settings & Configuration</h2>
        </div>
        <p className="text-xs text-slate-400">
          Configure operational quotas, deterministic scheduling rules, and provider integrations.
        </p>
      </div>

      {toast && (
        <div className="p-3 rounded-xl bg-cyan-950/70 border border-cyan-800 text-xs text-cyan-300 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Tabs Layout */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left Subnav */}
        <div className="w-full md:w-56 bg-[#0E1626] border border-[#1E2C4A] rounded-2xl p-3 space-y-1 shrink-0">
          {[
            { id: 'profile', label: 'Admin Profile & Security', icon: Shield },
            { id: 'targets', label: 'Daily Target Quotas', icon: Target },
            { id: 'rules', label: 'Follow-up Interval Rules', icon: Clock },
            { id: 'integrations', label: 'Integrations & Google API', icon: Key },
            { id: 'automation', label: 'Lead Automation Engine', icon: Sparkles },
            { id: 'data', label: 'Data & Backup', icon: Database },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-blue-600/20 text-cyan-300 border border-blue-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-[#131E33]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Tab Content */}
        <div className="flex-1 bg-[#0E1626] border border-[#1E2C4A] rounded-2xl p-6">
          {/* PROFILE & SECURITY */}
          {activeTab === 'profile' && (
            <div className="space-y-5">
              <h3 className="text-sm font-bold text-white pb-2 border-b border-[#1E2C4A]">
                Administrator Account & Access Control
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-[#080B11] border border-[#1E2C4A] space-y-1">
                  <span className="text-slate-500">Authenticated Email</span>
                  <div className="font-bold text-white font-mono">{user?.email}</div>
                </div>

                <div className="p-4 rounded-xl bg-[#080B11] border border-[#1E2C4A] space-y-1">
                  <span className="text-slate-500">Role & Security Policy</span>
                  <div className="font-bold text-cyan-400 capitalize">
                    {user?.role} (Allowlist Enforced)
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-900/40 text-xs text-slate-300 space-y-2">
                <h4 className="font-bold text-cyan-300 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <span>Private Access Architecture</span>
                </h4>
                <p>
                  This system operates under private allowlist rules. Only approved administrators
                  can access, view, or modify stored CRM leads. Public sign-up is disabled at the
                  database and rules layer.
                </p>
                <div className="text-[11px] text-slate-400 font-mono mt-1">
                  Firebase Connected: {isFirebaseConfigured ? 'Yes (Live Cloud Sync)' : 'Local-First Production Mode'}
                </div>
              </div>
            </div>
          )}

          {/* DAILY TARGET QUOTAS */}
          {activeTab === 'targets' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-2 border-b border-[#1E2C4A]">
                <div>
                  <h3 className="text-sm font-bold text-white">Daily Target Quotas</h3>
                  <p className="text-xs text-slate-400">
                    Defines your daily outreach benchmark displayed on the Command Center progress meter.
                  </p>
                </div>
                <button
                  onClick={handleSaveTargets}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Targets</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Daily Overall Contact Target (Leads)
                  </label>
                  <input
                    type="number"
                    value={targetsDraft.dailyContactTarget}
                    onChange={(e) =>
                      setTargetsDraft({
                        ...targetsDraft,
                        dailyContactTarget: Number(e.target.value),
                      })
                    }
                    className="w-full p-2.5 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Daily Phone Calls Target
                  </label>
                  <input
                    type="number"
                    value={targetsDraft.callTarget}
                    onChange={(e) =>
                      setTargetsDraft({ ...targetsDraft, callTarget: Number(e.target.value) })
                    }
                    className="w-full p-2.5 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Daily WhatsApp Target
                  </label>
                  <input
                    type="number"
                    value={targetsDraft.whatsappTarget}
                    onChange={(e) =>
                      setTargetsDraft({ ...targetsDraft, whatsappTarget: Number(e.target.value) })
                    }
                    className="w-full p-2.5 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Daily Follow-up Completed Target
                  </label>
                  <input
                    type="number"
                    value={targetsDraft.followUpTarget}
                    onChange={(e) =>
                      setTargetsDraft({ ...targetsDraft, followUpTarget: Number(e.target.value) })
                    }
                    className="w-full p-2.5 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-white font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* FOLLOW-UP RULES */}
          {activeTab === 'rules' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-2 border-b border-[#1E2C4A]">
                <div>
                  <h3 className="text-sm font-bold text-white">Smart Follow-up Interval Rules</h3>
                  <p className="text-xs text-slate-400">
                    Defines the interval (in days) used by the Smart Next Action Engine and Focus Mode.
                  </p>
                </div>
                <button
                  onClick={handleSaveRules}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Rules</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-[#080B11] border border-[#1E2C4A] space-y-2">
                  <label className="block text-slate-300 font-bold">
                    No Answer &rarr; Retry Interval (+Days)
                  </label>
                  <input
                    type="number"
                    value={rulesDraft.noAnswerDays}
                    onChange={(e) =>
                      setRulesDraft({ ...rulesDraft, noAnswerDays: Number(e.target.value) })
                    }
                    className="w-full p-2 bg-[#0E1626] border border-[#1E2C4A] rounded-lg text-white font-mono"
                  />
                  <p className="text-[11px] text-slate-500">
                    When marked "No Answer", schedules follow-up in +X days.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#080B11] border border-[#1E2C4A] space-y-2">
                  <label className="block text-slate-300 font-bold">
                    WhatsApp Outreach &rarr; Follow-up Interval (+Days)
                  </label>
                  <input
                    type="number"
                    value={rulesDraft.whatsappDays}
                    onChange={(e) =>
                      setRulesDraft({ ...rulesDraft, whatsappDays: Number(e.target.value) })
                    }
                    className="w-full p-2 bg-[#0E1626] border border-[#1E2C4A] rounded-lg text-white font-mono"
                  />
                  <p className="text-[11px] text-slate-500">
                    When WhatsApp message is sent, prompts re-engagement in +X days.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#080B11] border border-[#1E2C4A] space-y-2">
                  <label className="block text-slate-300 font-bold">
                    Email Sent &rarr; Follow-up Interval (+Days)
                  </label>
                  <input
                    type="number"
                    value={rulesDraft.emailDays}
                    onChange={(e) =>
                      setRulesDraft({ ...rulesDraft, emailDays: Number(e.target.value) })
                    }
                    className="w-full p-2 bg-[#0E1626] border border-[#1E2C4A] rounded-lg text-white font-mono"
                  />
                  <p className="text-[11px] text-slate-500">
                    When email outreach is recorded, schedule review in +X days.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#080B11] border border-[#1E2C4A] space-y-2">
                  <label className="block text-slate-300 font-bold">
                    Interested &rarr; Priority Outreach (+Days)
                  </label>
                  <input
                    type="number"
                    value={rulesDraft.interestedDays}
                    onChange={(e) =>
                      setRulesDraft({ ...rulesDraft, interestedDays: Number(e.target.value) })
                    }
                    className="w-full p-2 bg-[#0E1626] border border-[#1E2C4A] rounded-lg text-white font-mono"
                  />
                  <p className="text-[11px] text-slate-500">
                    When marked "Interested", urgently follow up within +X days.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* INTEGRATIONS & GOOGLE API */}
          {activeTab === 'integrations' && (
            <div className="space-y-5">
              <h3 className="text-sm font-bold text-white pb-2 border-b border-[#1E2C4A]">
                External Providers & API Configurations
              </h3>

              {/* World Lead Map Provider */}
              <div className="p-4 rounded-xl bg-[#080B11] border border-[#1E2C4A] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">World Lead Map Provider</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                    Active &bull; Zero Cost
                  </span>
                </div>
                <p className="text-slate-400">
                  Powered by OpenStreetMap and CartoDB Dark Matter. Full global city search,
                  pinpoint coordinates, and lead placement without any paid Google Maps API billing.
                </p>
              </div>

              {/* Optional Google Places API */}
              <div className="p-4 rounded-xl bg-[#080B11] border border-[#1E2C4A] space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Google Places API (Optional)</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      googleKey
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {googleKey ? 'Configured' : 'Not Configured'}
                  </span>
                </div>
                <p className="text-slate-400">
                  Enables automated lead discovery in the Lead Generator tab. Enter your official Google
                  Maps Platform Places API key:
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={googleKey}
                    onChange={(e) => setGoogleKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="flex-1 p-2 bg-[#0E1626] border border-[#1E2C4A] rounded-xl text-white font-mono text-xs"
                  />
                  <button
                    onClick={handleSaveGoogleKey}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Save Key
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* AUTOMATION ENGINE */}
          {activeTab === 'automation' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-2 border-b border-[#1E2C4A]">
                <div>
                  <h3 className="text-sm font-bold text-white">Lead Automation Engine</h3>
                  <p className="text-xs text-slate-400">
                    Configure scheduled lead discovery routines and budget safeguards.
                  </p>
                </div>
                <button
                  onClick={handleSaveAutomation}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  Save Automation
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <label className="flex items-center gap-2 p-3 rounded-xl bg-[#080B11] border border-[#1E2C4A] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoDraft.autoLeadDiscoveryEnabled}
                    onChange={(e) =>
                      setAutoDraft({ ...autoDraft, autoLeadDiscoveryEnabled: e.target.checked })
                    }
                    className="rounded border-[#1E2C4A] text-cyan-500 focus:ring-0"
                  />
                  <span className="font-semibold text-white">Enable Automated Scheduled Discovery</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Max Leads Per Routine</label>
                    <input
                      type="number"
                      value={autoDraft.maxLeadsPerRun}
                      onChange={(e) =>
                        setAutoDraft({ ...autoDraft, maxLeadsPerRun: Number(e.target.value) })
                      }
                      className="w-full p-2 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Schedule Frequency</label>
                    <select
                      value={autoDraft.schedule}
                      onChange={(e) => setAutoDraft({ ...autoDraft, schedule: e.target.value as any })}
                      className="w-full p-2 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-white"
                    >
                      <option value="Manual">Manual Trigger Only</option>
                      <option value="Daily">Daily</option>
                      <option value="Selected Days">Selected Weekdays</option>
                      <option value="Weekly">Weekly</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DATA & BACKUP */}
          {activeTab === 'data' && (
            <div className="space-y-5">
              <h3 className="text-sm font-bold text-white pb-2 border-b border-[#1E2C4A]">
                Data Safety & Complete System Backup
              </h3>

              <div className="p-4 rounded-xl bg-[#080B11] border border-[#1E2C4A] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div>
                  <h4 className="font-bold text-white">Download Raw JSON Snapshot</h4>
                  <p className="text-slate-400 mt-0.5">
                    Exports all leads, activities, and follow-ups in pristine JSON format.
                  </p>
                </div>
                <button
                  onClick={handleDownloadBackup}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Backup</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
