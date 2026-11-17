import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Info,
  RotateCcw,
  Save,
  Shield,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { useWqms } from '../context/WqmsContext';
import { DEFAULT_DEMO_THRESHOLDS } from '../data/demoData';
import { UserRole } from '../types/wqms';

const ROLE_OPTIONS: Array<{
  role: UserRole;
  summary: string;
  capabilities: string[];
}> = [
  {
    role: 'Administrator',
    summary: 'Full administrative control over thresholds, stations, samples, alerts, and reset.',
    capabilities: [
      'Add, edit, and delete water samples',
      'Acknowledge and manage alerts',
      'Add, edit, and delete monitoring stations',
      'Edit demonstration thresholds & reset demo dataset',
    ],
  },
  {
    role: 'Analyst / Operator',
    summary: 'Operational access for recording water samples, handling alerts, and generating reports.',
    capabilities: [
      'Add, edit, and delete water samples',
      'Acknowledge active alerts',
      'View analytics and export reports',
      'Read-only access to stations and demo thresholds',
    ],
  },
  {
    role: 'Viewer',
    summary: 'Read-only inspection role for faculty, reviewers, and audit observers.',
    capabilities: [
      'View dashboard KPIs and charts',
      'Inspect sample records, alerts, and stations',
      'Filter analytics and download CSV / print reports',
      'All edit, delete, and configuration actions locked',
    ],
  },
];

export function SettingsPage() {
  const {
    state,
    permissions,
    setRole,
    updateThresholds,
    updatePreferences,
    resetDemoData,
  } = useWqms();

  const [thresholdsForm, setThresholdsForm] = useState({
    phMin: String(state.thresholds.phMin),
    phMax: String(state.thresholds.phMax),
    turbidityMax: String(state.thresholds.turbidityMax),
    dissolvedOxygenMin: String(state.thresholds.dissolvedOxygenMin),
    temperatureMin: String(state.thresholds.temperatureMin),
    temperatureMax: String(state.thresholds.temperatureMax),
  });
  const [thresholdError, setThresholdError] = useState('');

  const [prefsForm, setPrefsForm] = useState({
    defaultOperatorName: state.preferences.defaultOperatorName,
    autoGenerateAlerts: state.preferences.autoGenerateAlerts,
    animateCharts: state.preferences.animateCharts,
    showDemoNotices: state.preferences.showDemoNotices,
  });

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  useEffect(() => {
    setThresholdsForm({
      phMin: String(state.thresholds.phMin),
      phMax: String(state.thresholds.phMax),
      turbidityMax: String(state.thresholds.turbidityMax),
      dissolvedOxygenMin: String(state.thresholds.dissolvedOxygenMin),
      temperatureMin: String(state.thresholds.temperatureMin),
      temperatureMax: String(state.thresholds.temperatureMax),
    });
  }, [state.thresholds]);

  useEffect(() => {
    setPrefsForm({
      defaultOperatorName: state.preferences.defaultOperatorName,
      autoGenerateAlerts: state.preferences.autoGenerateAlerts,
      animateCharts: state.preferences.animateCharts,
      showDemoNotices: state.preferences.showDemoNotices,
    });
  }, [state.preferences]);

  const handleSaveThresholds = (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.canEditThresholds) return;

    const phMin = Number(thresholdsForm.phMin);
    const phMax = Number(thresholdsForm.phMax);
    const turbidityMax = Number(thresholdsForm.turbidityMax);
    const dissolvedOxygenMin = Number(thresholdsForm.dissolvedOxygenMin);
    const temperatureMin = Number(thresholdsForm.temperatureMin);
    const temperatureMax = Number(thresholdsForm.temperatureMax);

    if (
      [
        phMin,
        phMax,
        turbidityMax,
        dissolvedOxygenMin,
        temperatureMin,
        temperatureMax,
      ].some((v) => Number.isNaN(v))
    ) {
      setThresholdError('All threshold fields must contain valid numbers.');
      return;
    }

    if (phMin < 0 || phMax > 14 || phMin >= phMax) {
      setThresholdError(
        'pH minimum must be lower than pH maximum within 0 – 14.'
      );
      return;
    }
    if (turbidityMax <= 0) {
      setThresholdError('Turbidity maximum must be greater than 0 NTU.');
      return;
    }
    if (dissolvedOxygenMin < 0) {
      setThresholdError('Dissolved Oxygen minimum cannot be negative.');
      return;
    }
    if (temperatureMin >= temperatureMax) {
      setThresholdError(
        'Temperature minimum must be lower than temperature maximum.'
      );
      return;
    }

    setThresholdError('');
    updateThresholds({
      phMin,
      phMax,
      turbidityMax,
      dissolvedOxygenMin,
      temperatureMin,
      temperatureMax,
    });
  };

  const handleRestoreDefaultThresholds = () => {
    if (!permissions.canEditThresholds) return;
    setThresholdError('');
    updateThresholds({ ...DEFAULT_DEMO_THRESHOLDS });
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    updatePreferences({
      defaultOperatorName: prefsForm.defaultOperatorName.trim() || 'Demo User',
      autoGenerateAlerts: prefsForm.autoGenerateAlerts,
      animateCharts: prefsForm.animateCharts,
      showDemoNotices: prefsForm.showDemoNotices,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
          System Settings & Demo Configuration
        </h2>
        <p className="text-sm text-slate-600 mt-0.5">
          Configure demonstration thresholds, switch active user roles, customize preferences, or reset demo data
        </p>
      </div>

      {/* Role Switcher Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-cyan-700" />
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Demonstration User Role Selection
            </h3>
            <p className="text-xs text-slate-500">
              Switch roles to test permission boundaries during the academic demonstration
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ROLE_OPTIONS.map((opt) => {
            const isActive = state.currentRole === opt.role;
            return (
              <button
                key={opt.role}
                type="button"
                onClick={() => setRole(opt.role)}
                className={`text-left p-4 rounded-xl border transition-colors cursor-pointer flex flex-col justify-between gap-3 ${
                  isActive
                    ? 'bg-[#0A162B] text-white border-[#0A162B]'
                    : 'bg-slate-50/70 hover:bg-slate-100 text-slate-800 border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-bold text-sm">
                      {opt.role}
                    </span>
                    {isActive && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-300">
                        <Check className="w-3.5 h-3.5" />
                        Active
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-xs mt-1.5 leading-relaxed ${
                      isActive ? 'text-slate-300' : 'text-slate-600'
                    }`}
                  >
                    {opt.summary}
                  </p>
                </div>
                <ul
                  className={`text-[11px] space-y-1 pt-2 border-t ${
                    isActive
                      ? 'border-slate-700 text-slate-300'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {opt.capabilities.map((cap) => (
                    <li key={cap}>• {cap}</li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      </div>

      {/* Editable Demo Threshold Configuration */}
      <form
        onSubmit={handleSaveThresholds}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Demonstration Threshold Configuration
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Changes immediately re-evaluate all stored sample classifications against these illustrative values
            </p>
          </div>
          {permissions.canEditThresholds && (
            <button
              type="button"
              onClick={handleRestoreDefaultThresholds}
              className="text-xs font-medium text-cyan-700 hover:text-cyan-900 cursor-pointer whitespace-nowrap"
            >
              Restore Example Defaults
            </button>
          )}
        </div>

        <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
          <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <span>
            <strong>Important:</strong> These limits are illustrative
            demonstration thresholds for prototype testing only—not official
            regulatory standards or a declaration of drinking-water safety.
          </span>
        </div>

        {thresholdError && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
            {thresholdError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              pH Minimum
            </label>
            <input
              type="number"
              step="0.1"
              disabled={!permissions.canEditThresholds}
              value={thresholdsForm.phMin}
              onChange={(e) =>
                setThresholdsForm((f) => ({ ...f, phMin: e.target.value }))
              }
              className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              pH Maximum
            </label>
            <input
              type="number"
              step="0.1"
              disabled={!permissions.canEditThresholds}
              value={thresholdsForm.phMax}
              onChange={(e) =>
                setThresholdsForm((f) => ({ ...f, phMax: e.target.value }))
              }
              className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Turbidity Maximum (NTU)
            </label>
            <input
              type="number"
              step="0.1"
              disabled={!permissions.canEditThresholds}
              value={thresholdsForm.turbidityMax}
              onChange={(e) =>
                setThresholdsForm((f) => ({
                  ...f,
                  turbidityMax: e.target.value,
                }))
              }
              className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Dissolved Oxygen Minimum (mg/L)
            </label>
            <input
              type="number"
              step="0.1"
              disabled={!permissions.canEditThresholds}
              value={thresholdsForm.dissolvedOxygenMin}
              onChange={(e) =>
                setThresholdsForm((f) => ({
                  ...f,
                  dissolvedOxygenMin: e.target.value,
                }))
              }
              className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Temperature Minimum (°C)
            </label>
            <input
              type="number"
              step="0.5"
              disabled={!permissions.canEditThresholds}
              value={thresholdsForm.temperatureMin}
              onChange={(e) =>
                setThresholdsForm((f) => ({
                  ...f,
                  temperatureMin: e.target.value,
                }))
              }
              className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Temperature Maximum (°C)
            </label>
            <input
              type="number"
              step="0.5"
              disabled={!permissions.canEditThresholds}
              value={thresholdsForm.temperatureMax}
              onChange={(e) =>
                setThresholdsForm((f) => ({
                  ...f,
                  temperatureMax: e.target.value,
                }))
              }
              className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>
        </div>

        {permissions.canEditThresholds ? (
          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0A162B] hover:bg-slate-800 text-white text-xs font-medium cursor-pointer"
            >
              <Save className="w-4 h-4 text-cyan-400" />
              <span>Save & Re-evaluate Records</span>
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Switch to <strong>Administrator</strong> role above to edit demonstration thresholds.
          </p>
        )}
      </form>

      {/* Preferences & Reset Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Application Preferences */}
        <form
          onSubmit={handleSavePreferences}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <h3 className="font-display text-base font-semibold text-slate-900">
            Application Preferences
          </h3>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Default Operator Display Name
            </label>
            <input
              type="text"
              value={prefsForm.defaultOperatorName}
              onChange={(e) =>
                setPrefsForm((p) => ({
                  ...p,
                  defaultOperatorName: e.target.value,
                }))
              }
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>

          <div className="space-y-3 pt-1">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefsForm.autoGenerateAlerts}
                onChange={(e) =>
                  setPrefsForm((p) => ({
                    ...p,
                    autoGenerateAlerts: e.target.checked,
                  }))
                }
                className="mt-0.5 rounded border-slate-300 text-cyan-700 focus:ring-cyan-500"
              />
              <span className="text-xs text-slate-700">
                <strong className="block text-slate-900">
                  Automatically Generate Alerts
                </strong>
                Create alert records whenever a logged sample exceeds configured demo thresholds.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefsForm.animateCharts}
                onChange={(e) =>
                  setPrefsForm((p) => ({
                    ...p,
                    animateCharts: e.target.checked,
                  }))
                }
                className="mt-0.5 rounded border-slate-300 text-cyan-700 focus:ring-cyan-500"
              />
              <span className="text-xs text-slate-700">
                <strong className="block text-slate-900">
                  Enable Chart Transitions
                </strong>
                Animate trend and comparison visualizations when switching views.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefsForm.showDemoNotices}
                onChange={(e) =>
                  setPrefsForm((p) => ({
                    ...p,
                    showDemoNotices: e.target.checked,
                  }))
                }
                className="mt-0.5 rounded border-slate-300 text-cyan-700 focus:ring-cyan-500"
              />
              <span className="text-xs text-slate-700">
                <strong className="block text-slate-900">
                  Show Academic Prototype Banner on Dashboard
                </strong>
                Display simulation disclaimer notice directly on the overview dashboard.
              </span>
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-medium cursor-pointer"
            >
              Save Preferences
            </button>
          </div>
        </form>

        {/* Reset Demo Data Card */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Reset Demonstration Data
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Restore all preloaded simulated monitoring stations, 12 baseline water samples, initial alerts, and default demonstration thresholds stored in browser localStorage.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              disabled={!permissions.canResetDemo}
              onClick={() => setResetConfirmOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-500 text-white text-xs font-medium transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Demo Data to Initial State</span>
            </button>
            {!permissions.canResetDemo && (
              <p className="text-[11px] text-slate-500 mt-2">
                Only the Administrator role can reset demonstration data.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      <Modal
        open={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        title="Confirm Demo Data Reset"
        subtitle="Restores preloaded academic dataset"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            This will erase any custom samples, stations, or threshold changes you created and restore the initial simulated demonstration dataset. Continue?
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setResetConfirmOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                resetDemoData();
                setResetConfirmOpen(false);
              }}
              className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 cursor-pointer"
            >
              Confirm Reset
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
