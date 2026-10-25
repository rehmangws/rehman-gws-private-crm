import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  Map as MapIcon,
  Sparkles,
  CheckSquare,
  Clock,
  Kanban,
  Tags,
  Activity,
  BarChart3,
  FileSpreadsheet,
  Settings,
  Plus,
  Search,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Radio,
} from 'lucide-react';

export type ActiveTab =
  | 'command-center'
  | 'leads'
  | 'business-map'
  | 'lead-generator'
  | 'tasks'
  | 'follow-ups'
  | 'pipeline'
  | 'categories'
  | 'activity'
  | 'analytics'
  | 'import-export'
  | 'settings';

interface ShellProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onQuickAddLead: () => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  unreadNotificationsCount: number;
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({
  activeTab,
  onSelectTab,
  onQuickAddLead,
  onOpenSearch,
  onOpenNotifications,
  unreadNotificationsCount,
  children,
}) => {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const navItems = [
    { id: 'command-center', label: 'Command Center', icon: LayoutDashboard },
    { id: 'leads', label: 'Leads', icon: Users },
    { id: 'business-map', label: 'Lead Finder', icon: MapIcon },
    { id: 'lead-generator', label: 'Lead Generator', icon: Sparkles },
    { id: 'tasks', label: "Today's Tasks", icon: CheckSquare },
    { id: 'follow-ups', label: 'Follow-ups', icon: Clock },
    { id: 'pipeline', label: 'Pipeline', icon: Kanban },
    { id: 'categories', label: 'Categories', icon: Tags },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'import-export', label: 'Import / Export', icon: FileSpreadsheet },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  const handleNavClick = (tabId: ActiveTab) => {
    onSelectTab(tabId);
    setMobileDrawerOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#080B11] text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="h-16 bg-[#0E1626]/95 border-b border-[#1E2C4A] sticky top-0 z-40 backdrop-blur-md px-4 lg:px-6 flex items-center justify-between gap-4">
        {/* Left: Mobile hamburger + Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#1E2C4A] lg:hidden cursor-pointer"
            aria-label="Toggle Navigation Drawer"
          >
            {mobileDrawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div
            onClick={() => onSelectTab('command-center')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 p-0.5 shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-[#080B11] rounded-[7px] flex items-center justify-center">
                <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 text-xs tracking-wider">
                  GWS
                </span>
              </div>
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white group-hover:text-cyan-400 transition-colors">
                  REHMAN GWS
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  CRM
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Lead Operations System</p>
            </div>
          </div>
        </div>

        {/* Center: Global Search Bar */}
        <div className="flex-1 max-w-xl mx-2">
          <button
            type="button"
            onClick={onOpenSearch}
            className="w-full flex items-center justify-between px-3.5 py-2 bg-[#080B11] border border-[#1E2C4A] hover:border-cyan-500/50 rounded-xl text-xs text-slate-400 group cursor-pointer transition-all shadow-inner"
          >
            <span className="flex items-center gap-2 truncate">
              <Search className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
              <span className="text-slate-400 group-hover:text-slate-200">
                Search business, contact, phone, domain, tags...
              </span>
            </span>
            <kbd className="hidden md:inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-[#131E33] border border-[#1E2C4A] text-[10px] font-mono text-slate-400">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Actions: Quick Add, Status, Notifications, Admin Pill */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            onClick={onQuickAddLead}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Lead</span>
          </button>

          {/* Sync indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-900/50 text-[11px] text-emerald-400">
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>Ready</span>
          </div>

          {/* Notifications */}
          <button
            onClick={onOpenNotifications}
            className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#1E2C4A] transition-colors cursor-pointer"
            aria-label="Open notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-[#0E1626] animate-pulse" />
            )}
          </button>

          {/* Profile & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-[#1E2C4A]">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 p-0.5 shrink-0">
              <div className="w-full h-full rounded-full bg-[#0E1626] flex items-center justify-center text-xs font-bold text-cyan-300">
                R
              </div>
            </div>
            <div className="hidden xl:block text-left">
              <p className="text-xs font-semibold text-white truncate max-w-[120px]">
                {user?.displayName || 'Admin'}
              </p>
              <div className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-cyan-400" />
                <span className="text-[10px] text-cyan-300 font-medium">Administrator</span>
              </div>
            </div>
            <button
              onClick={() => logout()}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-[#1E2C4A] rounded-lg transition-colors cursor-pointer"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Body with Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <aside
          className={`hidden lg:flex flex-col bg-[#0E1626] border-r border-[#1E2C4A] transition-all duration-200 select-none ${
            collapsed ? 'w-18' : 'w-60'
          }`}
        >
          <div className="p-3 flex items-center justify-end border-b border-[#1E2C4A]/50">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1E2C4A] cursor-pointer"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600/15 text-cyan-300 border border-blue-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-[#131E33]'
                  } ${collapsed ? 'justify-center px-0' : ''}`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]' : ''
                    }`}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>

          {/* Quick Support / Version pill in sidebar */}
          {!collapsed && (
            <div className="p-4 border-t border-[#1E2C4A]/50">
              <div className="p-2.5 rounded-xl bg-[#080B11]/60 border border-[#1E2C4A] text-[11px] text-slate-400 flex items-center justify-between">
                <span className="font-medium text-slate-300">Private Operations</span>
                <span className="text-[10px] text-cyan-400 font-mono">v2.6</span>
              </div>
            </div>
          )}
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setMobileDrawerOpen(false)}
            />
            <div className="relative w-64 max-w-[80vw] bg-[#0E1626] border-r border-[#1E2C4A] p-4 flex flex-col h-full z-10">
              <div className="flex items-center justify-between pb-4 border-b border-[#1E2C4A]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
                    GWS
                  </div>
                  <span className="font-bold text-sm text-white">REHMAN GWS</span>
                </div>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium cursor-pointer ${
                        isActive
                          ? 'bg-blue-600/15 text-cyan-300 border border-blue-500/30'
                          : 'text-slate-400 hover:text-white hover:bg-[#131E33]'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="pt-4 border-t border-[#1E2C4A]">
                <button
                  onClick={() => logout()}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-950/30 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Container */}
        <main className="flex-1 overflow-y-auto bg-[#080B11] p-4 lg:p-6 bg-grid-pattern relative">
          <div className="max-w-[1600px] mx-auto pb-16">{children}</div>
        </main>
      </div>
    </div>
  );
};
