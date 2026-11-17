import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Check,
  ChevronDown,
  Droplets,
  FileSpreadsheet,
  FlaskConical,
  Info,
  LayoutDashboard,
  MapPin,
  Menu,
  PlusCircle,
  Settings,
  ShieldCheck,
  UserCircle2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useWqms } from '../context/WqmsContext';
import { NavPage, UserRole } from '../types/wqms';
import { formatDateTime } from '../utils/classification';
import { Modal } from './Modal';

interface NavItem {
  id: NavPage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'samples', label: 'Water Samples', icon: FlaskConical },
  { id: 'add-sample', label: 'Add New Sample', icon: PlusCircle },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
  { id: 'stations', label: 'Stations', icon: MapPin },
  { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const ROLES: UserRole[] = ['Administrator', 'Analyst / Operator', 'Viewer'];

export function Layout({ children }: { children: React.ReactNode }) {
  const {
    state,
    activePage,
    setActivePage,
    setSampleStationFilter,
    setRole,
    acknowledgeAlert,
    toasts,
    dismissToast,
    permissions,
  } = useWqms();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);

  const unacknowledgedAlerts = useMemo(
    () => state.alerts.filter((a) => a.status === 'Unacknowledged'),
    [state.alerts]
  );

  const stationMap = useMemo(
    () => new Map(state.stations.map((s) => [s.id, s.name])),
    [state.stations]
  );

  const currentDateLabel = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  }, []);

  const handleNavigate = (page: NavPage) => {
    if (page === 'samples') {
      setSampleStationFilter('ALL');
    }
    setActivePage(page);
    setMobileNavOpen(false);
    setNotifOpen(false);
    setRoleMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#0A162B] text-slate-100 border-r border-slate-800/80 z-30">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800/80">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center shadow-sm shrink-0">
            <Droplets className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-xs font-bold tracking-wider text-white uppercase leading-tight">
              Water Quality
              <br />
              Monitoring System
            </div>
            <div className="text-[11px] text-cyan-300 mt-0.5 truncate">
              Monitor. Analyze. Protect.
            </div>
          </div>
        </div>

        <nav
          className="flex-1 px-3 py-4 space-y-1 overflow-y-auto"
          aria-label="Main navigation"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            const isAlerts = item.id === 'alerts';
            const disabledForViewer =
              item.id === 'add-sample' && !permissions.canManageSamples;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white border border-transparent'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-cyan-400' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {isAlerts && unacknowledgedAlerts.length > 0 && (
                  <span className="font-mono tabular-nums text-[11px] font-semibold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    {unacknowledgedAlerts.length}
                  </span>
                )}
                {disabledForViewer && (
                  <span className="text-[10px] text-slate-500 font-normal">
                    Read-only
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800/80 bg-[#071020]">
          <div className="flex items-start gap-2.5 text-xs text-slate-400 leading-relaxed">
            <Activity className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-slate-200">Academic Prototype</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Software simulation only. No physical IoT sensors connected.
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Slide-Over Sidebar */}
      <AnimatePresence>
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/60"
              onClick={() => setMobileNavOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-72 max-w-[85vw] bg-[#0A162B] text-slate-100 flex flex-col z-10 shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center">
                    <Droplets className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="font-display text-xs font-bold uppercase text-white">
                      WQMS Prototype
                    </div>
                    <div className="text-[11px] text-cyan-300">
                      Monitor. Analyze. Protect.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  aria-label="Close navigation menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  const isAlerts = item.id === 'alerts';
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavigate(item.id)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </span>
                      {isAlerts && unacknowledgedAlerts.length > 0 && (
                        <span className="font-mono tabular-nums text-xs px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">
                          {unacknowledgedAlerts.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="lg:hidden w-8 h-8 rounded-lg bg-[#0A162B] flex items-center justify-center shrink-0">
                <Droplets className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
                  WATER QUALITY MONITORING SYSTEM
                </h1>
                <p className="hidden sm:block text-xs text-slate-500 truncate">
                  Monitor. Analyze. Protect.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Current Date */}
            <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-600 font-mono tabular-nums whitespace-nowrap">
              <span>{currentDateLabel}</span>
            </div>

            {/* Demo Mode – Simulated Data Indicator */}
            <button
              type="button"
              onClick={() => setDemoModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-900 hover:bg-cyan-100 transition-colors text-xs font-medium cursor-pointer whitespace-nowrap shrink-0"
              title="View simulation & academic disclaimer details"
            >
              <Info className="w-3.5 h-3.5 text-cyan-700 shrink-0" />
              <span className="hidden sm:inline">Demo Mode – Simulated Data</span>
              <span className="sm:hidden">Demo Mode</span>
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((prev) => !prev);
                  setRoleMenuOpen(false);
                }}
                className="relative p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unacknowledgedAlerts.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-mono font-bold flex items-center justify-center tabular-nums">
                    {unacknowledgedAlerts.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setNotifOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Threshold Alerts
                        </p>
                        <p className="text-xs text-slate-500">
                          {unacknowledgedAlerts.length} unacknowledged
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleNavigate('alerts')}
                        className="text-xs font-medium text-cyan-700 hover:text-cyan-900 cursor-pointer"
                      >
                        Manage All
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                      {unacknowledgedAlerts.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500">
                          All simulated threshold alerts have been acknowledged.
                        </div>
                      ) : (
                        unacknowledgedAlerts.slice(0, 5).map((alert) => (
                          <div
                            key={alert.id}
                            className="p-3.5 hover:bg-slate-50 flex items-start justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-rose-700">
                                {alert.parameter}: {alert.recordedValue}{' '}
                                {alert.unit}
                              </p>
                              <p className="text-xs text-slate-700 mt-0.5 truncate">
                                {stationMap.get(alert.stationId) ??
                                  alert.stationId}
                              </p>
                              <p className="text-[11px] font-mono text-slate-500 mt-0.5 tabular-nums">
                                {alert.sampleId} · {formatDateTime(alert.timestamp)}
                              </p>
                            </div>
                            {permissions.canAcknowledgeAlerts && (
                              <button
                                type="button"
                                onClick={() => acknowledgeAlert(alert.id)}
                                className="px-2 py-1 rounded text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer shrink-0"
                              >
                                Acknowledge
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User Profile & Role Switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setRoleMenuOpen((prev) => !prev);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <UserCircle2 className="w-5 h-5 text-[#0A162B] shrink-0" />
                <div className="hidden md:block text-left">
                  <div className="text-xs font-semibold text-slate-900 leading-tight whitespace-nowrap">
                    {state.preferences.defaultOperatorName || 'Demo User'}
                  </div>
                  <div className="text-[11px] text-cyan-700 font-medium leading-tight whitespace-nowrap">
                    {state.currentRole}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              {roleMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setRoleMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                      <p className="text-xs font-semibold text-slate-900">
                        Switch Demonstration Role
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Test role-based permissions
                      </p>
                    </div>
                    <div className="p-1.5 space-y-1">
                      {ROLES.map((role) => {
                        const active = state.currentRole === role;
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => {
                              setRole(role);
                              setRoleMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                              active
                                ? 'bg-[#0A162B] text-white'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <span>{role}</span>
                            {active && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                          </button>
                        );
                      })}
                    </div>
                    <div className="border-t border-slate-200 p-1.5">
                      <button
                        type="button"
                        onClick={() => handleNavigate('settings')}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                      >
                        Open Thresholds & Settings
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none no-print">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
              className="pointer-events-auto bg-white border border-slate-200 rounded-xl shadow-lg p-4 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p
                  className={`text-xs font-semibold ${
                    toast.type === 'warning'
                      ? 'text-rose-700'
                      : toast.type === 'success'
                      ? 'text-emerald-700'
                      : toast.type === 'error'
                      ? 'text-rose-700'
                      : 'text-slate-900'
                  }`}
                >
                  {toast.title}
                </p>
                {toast.description && (
                  <p className="text-xs text-slate-600 mt-1">
                    {toast.description}
                  </p>
                )}
                {toast.actionLabel && toast.actionPage && (
                  <button
                    type="button"
                    onClick={() => {
                      handleNavigate(toast.actionPage!);
                      dismissToast(toast.id);
                    }}
                    className="mt-2 text-xs font-semibold text-cyan-700 hover:text-cyan-900 cursor-pointer"
                  >
                    {toast.actionLabel} →
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Demo Mode Academic Prototype Info Modal */}
      <Modal
        open={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
        title="Academic Prototype & Simulation Notice"
        subtitle="Water Quality Monitoring System — Software Engineering Prototype"
      >
        <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <ShieldCheck className="w-4 h-4 text-cyan-700" />
              <span>Software Simulation Disclaimer</span>
            </div>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600">
              <li>
                This application is an academic Software Engineering prototype
                using browser-persisted demonstration data.
              </li>
              <li>
                <strong>No physical IoT sensors</strong> are connected; all
                initial stations, sample readings, and alerts are simulated.
              </li>
              <li>
                Configured parameter limits are{' '}
                <strong>illustrative demonstration thresholds only</strong>, not
                official regulatory water-quality standards.
              </li>
              <li>
                Results are classified strictly as{' '}
                <strong>Within Configured Thresholds</strong> or{' '}
                <strong>Outside Configured Thresholds</strong> and do not certify
                water suitability for human consumption.
              </li>
            </ul>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setDemoModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-[#0A162B] text-white text-xs font-medium hover:bg-slate-800 cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
