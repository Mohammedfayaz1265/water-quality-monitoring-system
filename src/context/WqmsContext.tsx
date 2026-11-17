import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createInitialDemoState } from '../data/demoData';
import {
  AppPreferences,
  MonitoringStation,
  NavPage,
  QualityAlert,
  ThresholdConfig,
  ToastMessage,
  UserRole,
  WaterSample,
  WqmsState,
} from '../types/wqms';
import {
  evaluateSampleParameters,
  generateNextAlertId,
} from '../utils/classification';

const STORAGE_KEY = 'wqms_academic_prototype_v1';

interface RolePermissions {
  canManageSamples: boolean;
  canManageStations: boolean;
  canAcknowledgeAlerts: boolean;
  canEditThresholds: boolean;
  canResetDemo: boolean;
}

interface WqmsContextValue {
  state: WqmsState;
  activePage: NavPage;
  setActivePage: (page: NavPage) => void;
  sampleStationFilter: string;
  setSampleStationFilter: (stationId: string) => void;
  permissions: RolePermissions;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  setRole: (role: UserRole) => void;
  addSample: (input: {
    id: string;
    stationId: string;
    collectionDate: string;
    ph: number;
    turbidity: number;
    dissolvedOxygen: number;
    temperature: number;
    operatorName: string;
    remarks: string;
  }) => { ok: boolean; error?: string; sample?: WaterSample; alertsCreated: number };
  updateSample: (
    sampleId: string,
    updates: {
      stationId: string;
      collectionDate: string;
      ph: number;
      turbidity: number;
      dissolvedOxygen: number;
      temperature: number;
      operatorName: string;
      remarks: string;
    }
  ) => { ok: boolean; error?: string };
  deleteSample: (sampleId: string) => void;
  acknowledgeAlert: (alertId: string) => void;
  acknowledgeAllAlerts: () => void;
  addStation: (station: {
    id: string;
    name: string;
    location: string;
    description: string;
  }) => { ok: boolean; error?: string };
  updateStation: (
    stationId: string,
    updates: {
      name: string;
      location: string;
      description: string;
    }
  ) => void;
  deleteStation: (stationId: string) => void;
  updateThresholds: (newThresholds: ThresholdConfig) => void;
  updatePreferences: (newPrefs: Partial<AppPreferences>) => void;
  resetDemoData: () => void;
}

const WqmsContext = createContext<WqmsContextValue | null>(null);

function loadPersistedState(): WqmsState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialDemoState();
    const parsed = JSON.parse(raw) as Partial<WqmsState>;
    if (
      !parsed ||
      !Array.isArray(parsed.stations) ||
      !Array.isArray(parsed.samples) ||
      !Array.isArray(parsed.alerts) ||
      !parsed.thresholds
    ) {
      return createInitialDemoState();
    }
    const fallback = createInitialDemoState();
    return {
      stations: parsed.stations,
      samples: parsed.samples,
      alerts: parsed.alerts,
      thresholds: { ...fallback.thresholds, ...parsed.thresholds },
      preferences: { ...fallback.preferences, ...(parsed.preferences ?? {}) },
      currentRole: parsed.currentRole ?? 'Administrator',
    };
  } catch {
    return createInitialDemoState();
  }
}

export function WqmsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WqmsState>(() => loadPersistedState());
  const [activePage, setActivePage] = useState<NavPage>('dashboard');
  const [sampleStationFilter, setSampleStationFilter] = useState<string>('ALL');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors in restricted preview contexts
    }
  }, [state]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
      window.setTimeout(() => {
        dismissToast(id);
      }, 5500);
    },
    [dismissToast]
  );

  const permissions = useMemo<RolePermissions>(() => {
    switch (state.currentRole) {
      case 'Administrator':
        return {
          canManageSamples: true,
          canManageStations: true,
          canAcknowledgeAlerts: true,
          canEditThresholds: true,
          canResetDemo: true,
        };
      case 'Analyst / Operator':
        return {
          canManageSamples: true,
          canManageStations: false,
          canAcknowledgeAlerts: true,
          canEditThresholds: false,
          canResetDemo: false,
        };
      case 'Viewer':
      default:
        return {
          canManageSamples: false,
          canManageStations: false,
          canAcknowledgeAlerts: false,
          canEditThresholds: false,
          canResetDemo: false,
        };
    }
  }, [state.currentRole]);

  const setRole = useCallback(
    (role: UserRole) => {
      setState((prev) => ({ ...prev, currentRole: role }));
      addToast({
        type: 'info',
        title: `Active Role Changed to ${role}`,
        description:
          role === 'Viewer'
            ? 'Read-only inspection mode enabled.'
            : role === 'Analyst / Operator'
            ? 'Sample logging, editing, and alert acknowledgement enabled.'
            : 'Full administrative access enabled.',
      });
    },
    [addToast]
  );

  const addSample: WqmsContextValue['addSample'] = useCallback(
    (input) => {
      const trimmedId = input.id.trim().toUpperCase();
      if (state.samples.some((s) => s.id.toUpperCase() === trimmedId)) {
        return {
          ok: false,
          error: `Sample ID "${trimmedId}" already exists. Please use a unique Sample ID.`,
          alertsCreated: 0,
        };
      }

      const evaluation = evaluateSampleParameters(
        {
          ph: input.ph,
          turbidity: input.turbidity,
          dissolvedOxygen: input.dissolvedOxygen,
          temperature: input.temperature,
        },
        state.thresholds
      );

      const newSample: WaterSample = {
        id: trimmedId,
        stationId: input.stationId,
        collectionDate: input.collectionDate,
        ph: input.ph,
        turbidity: input.turbidity,
        dissolvedOxygen: input.dissolvedOxygen,
        temperature: input.temperature,
        operatorName: input.operatorName.trim(),
        remarks: input.remarks.trim(),
        status: evaluation.status,
        abnormalParameters: evaluation.abnormalParameters,
        isSimulatedDemo: false,
        createdAt: new Date().toISOString(),
      };

      const generatedAlerts: QualityAlert[] = [];
      if (
        state.preferences.autoGenerateAlerts &&
        evaluation.abnormalParameters.length > 0
      ) {
        let rollingAlerts = [...state.alerts];
        for (const ab of evaluation.abnormalParameters) {
          const alertId = generateNextAlertId(rollingAlerts);
          const alert: QualityAlert = {
            id: alertId,
            sampleId: newSample.id,
            stationId: newSample.stationId,
            parameter: ab.parameter,
            recordedValue: ab.recordedValue,
            unit: ab.unit,
            configuredThreshold: ab.thresholdRule,
            timestamp: newSample.collectionDate,
            status: 'Unacknowledged',
            isSimulatedDemo: false,
          };
          generatedAlerts.push(alert);
          rollingAlerts = [alert, ...rollingAlerts];
        }
      }

      setState((prev) => ({
        ...prev,
        samples: [newSample, ...prev.samples],
        alerts: [...generatedAlerts, ...prev.alerts],
      }));

      if (generatedAlerts.length > 0) {
        addToast({
          type: 'warning',
          title: `Sample ${newSample.id} Saved — Outside Configured Thresholds`,
          description: `${generatedAlerts.length} threshold alert(s) generated for ${evaluation.abnormalParameters
            .map((a) => a.parameter)
            .join(', ')}.`,
          actionLabel: 'View Alerts',
          actionPage: 'alerts',
        });
      } else {
        addToast({
          type: 'success',
          title: `Sample ${newSample.id} Recorded`,
          description: 'All measured parameters are within configured demonstration thresholds.',
          actionLabel: 'View Samples',
          actionPage: 'samples',
        });
      }

      return {
        ok: true,
        sample: newSample,
        alertsCreated: generatedAlerts.length,
      };
    },
    [state.samples, state.thresholds, state.preferences.autoGenerateAlerts, state.alerts, addToast]
  );

  const updateSample: WqmsContextValue['updateSample'] = useCallback(
    (sampleId, updates) => {
      const existing = state.samples.find((s) => s.id === sampleId);
      if (!existing) {
        return { ok: false, error: 'Sample record not found.' };
      }

      const evaluation = evaluateSampleParameters(
        {
          ph: updates.ph,
          turbidity: updates.turbidity,
          dissolvedOxygen: updates.dissolvedOxygen,
          temperature: updates.temperature,
        },
        state.thresholds
      );

      const updatedSample: WaterSample = {
        ...existing,
        stationId: updates.stationId,
        collectionDate: updates.collectionDate,
        ph: updates.ph,
        turbidity: updates.turbidity,
        dissolvedOxygen: updates.dissolvedOxygen,
        temperature: updates.temperature,
        operatorName: updates.operatorName.trim(),
        remarks: updates.remarks.trim(),
        status: evaluation.status,
        abnormalParameters: evaluation.abnormalParameters,
      };

      setState((prev) => {
        const remainingAlerts = prev.alerts.filter((a) => a.sampleId !== sampleId);
        let nextAlerts = [...remainingAlerts];

        if (
          prev.preferences.autoGenerateAlerts &&
          evaluation.abnormalParameters.length > 0
        ) {
          for (const ab of evaluation.abnormalParameters) {
            const previousSameParam = prev.alerts.find(
              (a) => a.sampleId === sampleId && a.parameter === ab.parameter
            );
            const alertId =
              previousSameParam?.id ?? generateNextAlertId(nextAlerts);
            nextAlerts = [
              {
                id: alertId,
                sampleId: updatedSample.id,
                stationId: updatedSample.stationId,
                parameter: ab.parameter,
                recordedValue: ab.recordedValue,
                unit: ab.unit,
                configuredThreshold: ab.thresholdRule,
                timestamp: updatedSample.collectionDate,
                status: 'Unacknowledged',
                isSimulatedDemo: updatedSample.isSimulatedDemo,
              },
              ...nextAlerts,
            ];
          }
        }

        return {
          ...prev,
          samples: prev.samples.map((s) =>
            s.id === sampleId ? updatedSample : s
          ),
          alerts: nextAlerts,
        };
      });

      addToast({
        type:
          evaluation.status === 'Outside Configured Thresholds'
            ? 'warning'
            : 'success',
        title: `Sample ${sampleId} Updated`,
        description: `Re-evaluated status: ${evaluation.status}.`,
      });

      return { ok: true };
    },
    [state.samples, state.thresholds, addToast]
  );

  const deleteSample = useCallback(
    (sampleId: string) => {
      setState((prev) => ({
        ...prev,
        samples: prev.samples.filter((s) => s.id !== sampleId),
        alerts: prev.alerts.filter((a) => a.sampleId !== sampleId),
      }));
      addToast({
        type: 'info',
        title: `Sample ${sampleId} Deleted`,
        description: 'Sample record and associated alerts removed.',
      });
    },
    [addToast]
  );

  const acknowledgeAlert = useCallback(
    (alertId: string) => {
      setState((prev) => ({
        ...prev,
        alerts: prev.alerts.map((a) =>
          a.id === alertId
            ? {
                ...a,
                status: 'Acknowledged',
                acknowledgedBy: prev.preferences.defaultOperatorName || prev.currentRole,
                acknowledgedAt: new Date().toISOString(),
              }
            : a
        ),
      }));
      addToast({
        type: 'success',
        title: `Alert ${alertId} Acknowledged`,
      });
    },
    [addToast]
  );

  const acknowledgeAllAlerts = useCallback(() => {
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      alerts: prev.alerts.map((a) =>
        a.status === 'Unacknowledged'
          ? {
              ...a,
              status: 'Acknowledged',
              acknowledgedBy: prev.preferences.defaultOperatorName || prev.currentRole,
              acknowledgedAt: now,
            }
          : a
      ),
    }));
    addToast({
      type: 'success',
      title: 'All Active Alerts Acknowledged',
    });
  }, [addToast]);

  const addStation: WqmsContextValue['addStation'] = useCallback(
    (station) => {
      const trimmedId = station.id.trim().toUpperCase();
      if (state.stations.some((s) => s.id.toUpperCase() === trimmedId)) {
        return {
          ok: false,
          error: `Station ID "${trimmedId}" already exists.`,
        };
      }
      const newStation: MonitoringStation = {
        id: trimmedId,
        name: station.name.trim(),
        location: station.location.trim(),
        description: station.description.trim(),
        isSimulatedDemo: false,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        stations: [...prev.stations, newStation],
      }));
      addToast({
        type: 'success',
        title: `Station ${newStation.name} Added`,
      });
      return { ok: true };
    },
    [state.stations, addToast]
  );

  const updateStation: WqmsContextValue['updateStation'] = useCallback(
    (stationId, updates) => {
      setState((prev) => ({
        ...prev,
        stations: prev.stations.map((st) =>
          st.id === stationId
            ? {
                ...st,
                name: updates.name.trim(),
                location: updates.location.trim(),
                description: updates.description.trim(),
              }
            : st
        ),
      }));
      addToast({
        type: 'success',
        title: `Station ${stationId} Updated`,
      });
    },
    [addToast]
  );

  const deleteStation = useCallback(
    (stationId: string) => {
      setState((prev) => {
        const removedSampleIds = new Set(
          prev.samples
            .filter((s) => s.stationId === stationId)
            .map((s) => s.id)
        );
        return {
          ...prev,
          stations: prev.stations.filter((st) => st.id !== stationId),
          samples: prev.samples.filter((s) => s.stationId !== stationId),
          alerts: prev.alerts.filter(
            (a) => a.stationId !== stationId && !removedSampleIds.has(a.sampleId)
          ),
        };
      });
      addToast({
        type: 'info',
        title: `Station ${stationId} Deleted`,
      });
    },
    [addToast]
  );

  const updateThresholds = useCallback(
    (newThresholds: ThresholdConfig) => {
      setState((prev) => {
        const reevaluatedSamples = prev.samples.map((sample) => {
          const evaluation = evaluateSampleParameters(
            {
              ph: sample.ph,
              turbidity: sample.turbidity,
              dissolvedOxygen: sample.dissolvedOxygen,
              temperature: sample.temperature,
            },
            newThresholds
          );
          return {
            ...sample,
            status: evaluation.status,
            abnormalParameters: evaluation.abnormalParameters,
          };
        });

        let updatedAlerts = [...prev.alerts];
        if (prev.preferences.autoGenerateAlerts) {
          for (const sample of reevaluatedSamples) {
            for (const ab of sample.abnormalParameters) {
              const alreadyExists = updatedAlerts.some(
                (a) =>
                  a.sampleId === sample.id &&
                  a.parameter === ab.parameter &&
                  a.status === 'Unacknowledged'
              );
              if (!alreadyExists) {
                updatedAlerts = [
                  {
                    id: generateNextAlertId(updatedAlerts),
                    sampleId: sample.id,
                    stationId: sample.stationId,
                    parameter: ab.parameter,
                    recordedValue: ab.recordedValue,
                    unit: ab.unit,
                    configuredThreshold: ab.thresholdRule,
                    timestamp: sample.collectionDate,
                    status: 'Unacknowledged',
                    isSimulatedDemo: sample.isSimulatedDemo,
                  },
                  ...updatedAlerts,
                ];
              }
            }
          }
        }

        return {
          ...prev,
          thresholds: newThresholds,
          samples: reevaluatedSamples,
          alerts: updatedAlerts,
        };
      });

      addToast({
        type: 'success',
        title: 'Demo Thresholds Updated',
        description:
          'All existing sample classifications have been re-evaluated against the new demonstration thresholds.',
      });
    },
    [addToast]
  );

  const updatePreferences = useCallback(
    (newPrefs: Partial<AppPreferences>) => {
      setState((prev) => ({
        ...prev,
        preferences: { ...prev.preferences, ...newPrefs },
      }));
      addToast({
        type: 'success',
        title: 'Application Preferences Saved',
      });
    },
    [addToast]
  );

  const resetDemoData = useCallback(() => {
    const fresh = createInitialDemoState();
    setState(fresh);
    setSampleStationFilter('ALL');
    addToast({
      type: 'info',
      title: 'Demonstration Data Reset',
      description:
        'Preloaded simulated stations, 12 sample records, alerts, and default thresholds restored.',
    });
  }, [addToast]);

  const value = useMemo<WqmsContextValue>(
    () => ({
      state,
      activePage,
      setActivePage,
      sampleStationFilter,
      setSampleStationFilter,
      permissions,
      toasts,
      dismissToast,
      addToast,
      setRole,
      addSample,
      updateSample,
      deleteSample,
      acknowledgeAlert,
      acknowledgeAllAlerts,
      addStation,
      updateStation,
      deleteStation,
      updateThresholds,
      updatePreferences,
      resetDemoData,
    }),
    [
      state,
      activePage,
      sampleStationFilter,
      permissions,
      toasts,
      dismissToast,
      addToast,
      setRole,
      addSample,
      updateSample,
      deleteSample,
      acknowledgeAlert,
      acknowledgeAllAlerts,
      addStation,
      updateStation,
      deleteStation,
      updateThresholds,
      updatePreferences,
      resetDemoData,
    ]
  );

  return <WqmsContext.Provider value={value}>{children}</WqmsContext.Provider>;
}

export function useWqms(): WqmsContextValue {
  const ctx = useContext(WqmsContext);
  if (!ctx) {
    throw new Error('useWqms must be used within WqmsProvider');
  }
  return ctx;
}
