import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Shell, ActiveTab } from './components/layout/Shell';
import { LoginView } from './components/auth/LoginView';
import { CommandCenter } from './components/command-center/CommandCenter';
import { LeadsView } from './components/leads/LeadsView';
import { BusinessMap } from './components/map/BusinessMap';
import { LeadGenerator } from './components/generator/LeadGenerator';
import { TasksView } from './components/tasks/TasksView';
import { PipelineView } from './components/pipeline/PipelineView';
import { CategoriesView } from './components/categories/CategoriesView';
import { ActivityView } from './components/activity/ActivityView';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { ImportExportView } from './components/import-export/ImportExportView';
import { SettingsView } from './components/settings/SettingsView';
import { StartMyDayModal } from './components/focus-mode/StartMyDayModal';
import { AddLeadModal } from './components/leads/AddLeadModal';
import { LeadProfileModal } from './components/leads/LeadProfileModal';
import { GlobalSearchModal } from './components/search/GlobalSearchModal';
import { NotificationDrawer } from './components/notifications/NotificationDrawer';
import { Lead, Activity, FollowUp, Category, DailyTargets, FollowUpRules, CRMNotification, AutomationSettings } from './types/crm';
import { CRMStorage } from './services/crmStorage';

const CRMMain: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('command-center');

  // Application Data State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [dailyTargets, setDailyTargets] = useState<DailyTargets>(CRMStorage.getDailyTargets());
  const [followUpRules, setFollowUpRules] = useState<FollowUpRules>(CRMStorage.getFollowUpRules());
  const [notifications, setNotifications] = useState<CRMNotification[]>([]);
  const [automationSettings, setAutomationSettings] = useState<AutomationSettings>(CRMStorage.getAutomationSettings());
  const [todayStats, setTodayStats] = useState({
    completedToday: 0,
    callsToday: 0,
    whatsAppsToday: 0,
    emailsToday: 0,
    followUpsCompletedToday: 0,
    uniqueLeadsContactedToday: 0,
    target: 50,
  });

  // Modals state
  const [isStartMyDayOpen, setIsStartMyDayOpen] = useState(false);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [leadToEdit, setLeadToEdit] = useState<Lead | null>(null);
  const [selectedLeadProfile, setSelectedLeadProfile] = useState<Lead | null>(null);
  const [mapInitialCoords, setMapInitialCoords] = useState<{ lat: number; lng: number; address?: string; city?: string; country?: string } | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);

  // Refresh all state from CRMStorage
  const refreshData = async () => {
    const [fetchedLeads, fetchedCats, fetchedActs, fetchedFus, fetchedStats] = await Promise.all([
      CRMStorage.getLeads(false),
      CRMStorage.getCategories(),
      CRMStorage.getActivities(undefined, 100),
      CRMStorage.getFollowUps(),
      CRMStorage.getTodayStats(),
    ]);

    // Check if initial starter leads should be provided if totally empty
    if (fetchedLeads.length === 0) {
      const now = new Date();
      const starterLeads: Lead[] = [
        {
          id: 'lead-starter-1',
          businessName: 'Al-Sultan Grand Bistro',
          businessNameNormalized: 'alsultan grand bistro',
          contactPerson: 'Kareem Mansour (General Manager)',
          categoryId: 'cat-1',
          categoryName: 'Restaurants',
          phone: '+971 50 812 3456',
          phoneNormalized: '+971508123456',
          whatsapp: '+971 50 812 3456',
          whatsappNormalized: '+971508123456',
          email: 'gm@alsultanbistro.ae',
          emailNormalized: 'gm@alsultanbistro.ae',
          website: 'https://alsultanbistro.ae',
          websiteDomain: 'alsultanbistro.ae',
          address: 'Downtown Boulevard, Near Opera',
          city: 'Dubai',
          country: 'United Arab Emirates',
          latitude: 25.1972,
          longitude: 55.2744,
          source: 'Map',
          status: 'Interested',
          priority: 'High',
          isHot: true,
          tags: ['VIP', 'Hospitality', 'Downtown'],
          notesSummary: 'Expressed strong interest in procurement contract. Follow up today.',
          createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: now.toISOString(),
          lastContactAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
          nextFollowUpAt: now.toISOString(),
          createdBy: 'admin',
          updatedBy: 'admin',
        },
        {
          id: 'lead-starter-2',
          businessName: 'Apex Gulf Logistics & Freight',
          businessNameNormalized: 'apex gulf logistics freight',
          contactPerson: 'David Chen (Logistics Director)',
          categoryId: 'cat-12',
          categoryName: 'Logistics',
          phone: '+971 4 881 9900',
          phoneNormalized: '+97148819900',
          whatsapp: '+971 55 992 1188',
          whatsappNormalized: '+971559921188',
          email: 'freight@apexgulf.ae',
          emailNormalized: 'freight@apexgulf.ae',
          website: 'https://apexgulf.ae',
          websiteDomain: 'apexgulf.ae',
          address: 'Jebel Ali Free Zone, South Gate 4',
          city: 'Dubai',
          country: 'United Arab Emirates',
          latitude: 25.0112,
          longitude: 55.0617,
          source: 'Manual',
          status: 'New',
          priority: 'Normal',
          tags: ['Corporate', 'Freight', 'JAFZA'],
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          createdBy: 'admin',
          updatedBy: 'admin',
        },
        {
          id: 'lead-starter-3',
          businessName: 'Elite Wellness & Aesthetics Clinic',
          businessNameNormalized: 'elite wellness aesthetics clinic',
          contactPerson: 'Dr. Sarah Al-Hashimi',
          categoryId: 'cat-28',
          categoryName: 'Clinics',
          phone: '+971 52 443 8877',
          phoneNormalized: '+971524438877',
          whatsapp: '+971 52 443 8877',
          whatsappNormalized: '+971524438877',
          email: 'dr.sarah@elitewellness.ae',
          emailNormalized: 'dr.sarah@elitewellness.ae',
          website: 'https://elitewellness.ae',
          websiteDomain: 'elitewellness.ae',
          address: 'Al Wasl Road, Jumeirah 2',
          city: 'Dubai',
          country: 'United Arab Emirates',
          latitude: 25.1845,
          longitude: 55.2392,
          source: 'Map',
          status: 'Follow-up',
          priority: 'Urgent',
          isHot: true,
          tags: ['Medical', 'Jumeirah', 'DecisionMaker'],
          notesSummary: 'Needs updated commercial proposal. Follow-up overdue.',
          createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: now.toISOString(),
          lastContactAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          nextFollowUpAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
          createdBy: 'admin',
          updatedBy: 'admin',
        },
      ];

      for (const lead of starterLeads) {
        await CRMStorage.saveLead(lead, 'admin');
      }

      // Add a starter follow-up
      await CRMStorage.saveFollowUp({
        id: 'fu-starter-1',
        leadId: 'lead-starter-3',
        leadBusinessName: 'Elite Wellness & Aesthetics Clinic',
        leadPhone: '+971 52 443 8877',
        leadWhatsapp: '+971 52 443 8877',
        dateTime: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        actionType: 'WhatsApp',
        notes: 'Urgent: deliver revised fee schedule for annual service contract.',
        priority: 'Urgent',
        status: 'pending',
        createdAt: now.toISOString(),
      });

      // Recurse to reload populated state
      return refreshData();
    }

    setLeads(fetchedLeads);
    setCategories(fetchedCats);
    setActivities(fetchedActs);
    setFollowUps(fetchedFus);
    setTodayStats(fetchedStats);
    setDailyTargets(CRMStorage.getDailyTargets());
    setFollowUpRules(CRMStorage.getFollowUpRules());
    setNotifications(CRMStorage.getNotifications());
    setAutomationSettings(CRMStorage.getAutomationSettings());
  };

  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080B11] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-mono tracking-wider">
            INITIALIZING REHMAN GWS CRM...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  // CSV Export Handler
  const handleExportCsv = (leadsToExport: Lead[]) => {
    const headers = [
      'Business Name',
      'Category',
      'Contact Person',
      'Phone',
      'WhatsApp',
      'Email',
      'Website',
      'Address',
      'City',
      'Country',
      'Status',
      'Priority',
      'Source',
      'Last Contact',
      'Next Follow-up',
      'Tags',
    ];

    const rows = leadsToExport.map((l) => [
      `"${(l.businessName || '').replace(/"/g, '""')}"`,
      `"${(l.categoryName || '').replace(/"/g, '""')}"`,
      `"${(l.contactPerson || '').replace(/"/g, '""')}"`,
      `"${l.phone || ''}"`,
      `"${l.whatsapp || ''}"`,
      `"${l.email || ''}"`,
      `"${l.website || ''}"`,
      `"${(l.address || '').replace(/"/g, '""')}"`,
      `"${l.city || ''}"`,
      `"${l.country || ''}"`,
      `"${l.status}"`,
      `"${l.priority}"`,
      `"${l.source}"`,
      `"${l.lastContactAt || ''}"`,
      `"${l.nextFollowUpAt || ''}"`,
      `"${(l.tags || []).join(';')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rehman-gws-leads-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Shell
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      onQuickAddLead={() => {
        setLeadToEdit(null);
        setMapInitialCoords(null);
        setIsAddLeadOpen(true);
      }}
      onOpenSearch={() => setIsSearchOpen(true)}
      onOpenNotifications={() => setIsNotificationDrawerOpen(true)}
      unreadNotificationsCount={unreadCount}
    >
      {/* Dynamic View by Tab */}
      {activeTab === 'command-center' && (
        <CommandCenter
          leads={leads}
          followUps={followUps}
          activities={activities}
          dailyTargets={dailyTargets}
          onStartMyDay={() => setIsStartMyDayOpen(true)}
          onSelectLead={(l) => setSelectedLeadProfile(l)}
          onNavigateToTab={setActiveTab}
          todayStats={todayStats}
        />
      )}

      {activeTab === 'leads' && (
        <LeadsView
          leads={leads}
          categories={categories}
          onOpenLeadProfile={(l) => setSelectedLeadProfile(l)}
          onEditLead={(l) => {
            setLeadToEdit(l);
            setIsAddLeadOpen(true);
          }}
          onAddNewLead={() => {
            setLeadToEdit(null);
            setMapInitialCoords(null);
            setIsAddLeadOpen(true);
          }}
          onRefreshData={refreshData}
          onExportCsv={handleExportCsv}
        />
      )}

      {(activeTab === 'business-map' || (activeTab as string) === 'lead-map') && (
        <BusinessMap
          leads={leads}
          categories={categories}
          onOpenLeadProfile={(l) => setSelectedLeadProfile(l)}
          onAddLeadAtCoordinates={(coords) => {
            setMapInitialCoords(coords);
            setLeadToEdit(null);
            setIsAddLeadOpen(true);
          }}
          onCustomizeAddLead={(prefill) => {
            setLeadToEdit({
              id: '',
              businessName: prefill.businessName || '',
              businessNameNormalized: (prefill.businessName || '').toLowerCase().trim(),
              categoryId: prefill.categoryId || 'cat-1',
              categoryName: prefill.categoryName || 'Commercial Business',
              phone: prefill.phone,
              email: prefill.email,
              website: prefill.website,
              address: prefill.address,
              city: prefill.city || 'Dubai',
              country: prefill.country || 'United Arab Emirates',
              latitude: prefill.latitude,
              longitude: prefill.longitude,
              externalPlaceId: prefill.externalPlaceId,
              source: 'Map',
              status: 'New',
              priority: 'Normal',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              createdBy: 'admin',
              updatedBy: 'admin',
            });
            setMapInitialCoords({
              lat: prefill.latitude || 25.2048,
              lng: prefill.longitude || 55.2708,
              address: prefill.address,
              city: prefill.city,
              country: prefill.country,
            });
            setIsAddLeadOpen(true);
          }}
          onRefreshData={refreshData}
        />
      )}

      {activeTab === 'lead-generator' && (
        <LeadGenerator
          categories={categories}
          existingLeads={leads}
          onNavigateToSettings={() => setActiveTab('settings')}
          onRefreshData={refreshData}
        />
      )}

      {activeTab === 'tasks' && (
        <TasksView
          followUps={followUps}
          leads={leads}
          onOpenLeadProfile={(l) => setSelectedLeadProfile(l)}
          onRefreshData={refreshData}
        />
      )}

      {activeTab === 'follow-ups' && (
        <TasksView
          followUps={followUps}
          leads={leads}
          onOpenLeadProfile={(l) => setSelectedLeadProfile(l)}
          onRefreshData={refreshData}
        />
      )}

      {activeTab === 'pipeline' && (
        <PipelineView
          leads={leads}
          onOpenLeadProfile={(l) => setSelectedLeadProfile(l)}
          onRefreshData={refreshData}
        />
      )}

      {activeTab === 'categories' && (
        <CategoriesView
          categories={categories}
          leads={leads}
          onRefreshData={refreshData}
        />
      )}

      {activeTab === 'activity' && (
        <ActivityView
          activities={activities}
          leads={leads}
          onOpenLeadProfile={(l) => setSelectedLeadProfile(l)}
        />
      )}

      {activeTab === 'analytics' && (
        <AnalyticsView
          leads={leads}
          activities={activities}
          followUps={followUps}
          categories={categories}
        />
      )}

      {activeTab === 'import-export' && (
        <ImportExportView
          leads={leads}
          categories={categories}
          onRefreshData={refreshData}
          onExportCsv={handleExportCsv}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsView
          user={user}
          dailyTargets={dailyTargets}
          followUpRules={followUpRules}
          automationSettings={automationSettings}
          onRefreshData={refreshData}
        />
      )}

      {/* START MY DAY — FOCUS MODE MODAL */}
      {isStartMyDayOpen && (
        <StartMyDayModal
          leads={leads}
          followUps={followUps}
          rules={followUpRules}
          onClose={() => setIsStartMyDayOpen(false)}
          onRefreshData={refreshData}
        />
      )}

      {/* ADD / EDIT LEAD MODAL */}
      {isAddLeadOpen && (
        <AddLeadModal
          categories={categories}
          existingLeads={leads}
          initialCoordinates={mapInitialCoords}
          leadToEdit={leadToEdit}
          onClose={() => {
            setIsAddLeadOpen(false);
            setLeadToEdit(null);
            setMapInitialCoords(null);
          }}
          onLeadSaved={refreshData}
        />
      )}

      {/* LEAD PROFILE MODAL */}
      {selectedLeadProfile && (
        <LeadProfileModal
          lead={selectedLeadProfile}
          categories={categories}
          followUps={followUps}
          onClose={() => setSelectedLeadProfile(null)}
          onEditLead={(l) => {
            setSelectedLeadProfile(null);
            setLeadToEdit(l);
            setIsAddLeadOpen(true);
          }}
          onLeadUpdated={refreshData}
        />
      )}

      {/* GLOBAL SEARCH MODAL */}
      <GlobalSearchModal
        leads={leads}
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectLead={(l) => setSelectedLeadProfile(l)}
      />

      {/* NOTIFICATION DRAWER */}
      <NotificationDrawer
        notifications={notifications}
        leads={leads}
        isOpen={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
        onSelectLead={(l) => setSelectedLeadProfile(l)}
        onRefreshData={refreshData}
      />
    </Shell>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <CRMMain />
    </AuthProvider>
  );
}
