import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCheck,
  CheckCircle2,
  Eye,
  Search,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { AlertStatusLabel, SampleStatusLabel } from '../components/StatusText';
import { useWqms } from '../context/WqmsContext';
import { AlertStatus, ParameterName, QualityAlert } from '../types/wqms';
import { formatDateTime } from '../utils/classification';

export function AlertsPage() {
  const {
    state,
    acknowledgeAlert,
    acknowledgeAllAlerts,
    permissions,
  } = useWqms();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | AlertStatus>('ALL');
  const [paramFilter, setParamFilter] = useState<'ALL' | ParameterName>('ALL');
  const [selectedAlert, setSelectedAlert] = useState<QualityAlert | null>(null);

  const stationMap = useMemo(
    () => new Map(state.stations.map((s) => [s.id, s])),
    [state.stations]
  );

  const sampleMap = useMemo(
    () => new Map(state.samples.map((s) => [s.id, s])),
    [state.samples]
  );

  const summary = useMemo(() => {
    const total = state.alerts.length;
    const unack = state.alerts.filter(
      (a) => a.status === 'Unacknowledged'
    ).length;
    const ack = total - unack;
    return { total, unack, ack };
  }, [state.alerts]);

  const filteredAlerts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...state.alerts]
      .filter((a) => {
        if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
        if (paramFilter !== 'ALL' && a.parameter !== paramFilter) return false;
        if (q) {
          const stName =
            stationMap.get(a.stationId)?.name.toLowerCase() ?? '';
          const match =
            a.id.toLowerCase().includes(q) ||
            a.sampleId.toLowerCase().includes(q) ||
            a.parameter.toLowerCase().includes(q) ||
            stName.includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === 'Unacknowledged' ? -1 : 1;
        }
        return (
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      });
  }, [state.alerts, statusFilter, paramFilter, searchQuery, stationMap]);

  const selectedAlertSample = selectedAlert
    ? sampleMap.get(selectedAlert.sampleId) ?? null
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Alerts Management
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Automatically generated notifications when sample readings breach configured demo thresholds
          </p>
        </div>

        {permissions.canAcknowledgeAlerts && summary.unack > 0 && (
          <button
            type="button"
            onClick={acknowledgeAllAlerts}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0A162B] hover:bg-slate-800 text-white text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <CheckCheck className="w-4 h-4 text-cyan-400" />
            <span>Acknowledge All ({summary.unack})</span>
          </button>
        )}
      </div>

      {/* Alert Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Alerts</p>
            <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">
              {summary.total}
            </p>
          </div>
          <AlertTriangle className="w-5 h-5 text-slate-400" />
        </div>

        <div
          className={`rounded-xl p-4 flex items-center justify-between border ${
            summary.unack > 0
              ? 'bg-rose-50/70 border-rose-200'
              : 'bg-white border-slate-200'
          }`}
        >
          <div>
            <p className="text-xs font-medium text-rose-800">
              Unacknowledged (Critical)
            </p>
            <p className="font-mono tabular-nums text-2xl font-bold text-rose-700 mt-1">
              {summary.unack}
            </p>
          </div>
          <AlertTriangle className="w-5 h-5 text-rose-600" />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Acknowledged</p>
            <p className="font-mono tabular-nums text-2xl font-bold text-emerald-700 mt-1">
              {summary.ack}
            </p>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Alert ID, Sample ID, Station..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as 'ALL' | AlertStatus)
          }
          aria-label="Filter by alert status"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
        >
          <option value="ALL">All Alert Statuses</option>
          <option value="Unacknowledged">Unacknowledged</option>
          <option value="Acknowledged">Acknowledged</option>
        </select>

        <select
          value={paramFilter}
          onChange={(e) =>
            setParamFilter(e.target.value as 'ALL' | ParameterName)
          }
          aria-label="Filter by abnormal parameter"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
        >
          <option value="ALL">All Parameters</option>
          <option value="pH">pH</option>
          <option value="Turbidity">Turbidity</option>
          <option value="Dissolved Oxygen">Dissolved Oxygen</option>
          <option value="Temperature">Temperature</option>
        </select>
      </div>

      {/* Alerts Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-600">
                <th className="py-3 px-4">Alert ID</th>
                <th className="py-3 px-4">Sample ID</th>
                <th className="py-3 px-4">Station</th>
                <th className="py-3 px-4">Abnormal Parameter</th>
                <th className="py-3 px-4 text-right">Recorded Value</th>
                <th className="py-3 px-4">Configured Threshold</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Alert Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No threshold alerts match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alert) => {
                  const isUnack = alert.status === 'Unacknowledged';
                  return (
                    <tr
                      key={alert.id}
                      className={`transition-colors ${
                        isUnack
                          ? 'bg-rose-50/60 hover:bg-rose-50'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {alert.id}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-cyan-800 whitespace-nowrap">
                        {alert.sampleId}
                      </td>
                      <td className="py-3 px-4 text-slate-800">
                        {stationMap.get(alert.stationId)?.name ??
                          alert.stationId}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {alert.parameter}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono tabular-nums font-bold ${
                          isUnack ? 'text-rose-700' : 'text-slate-800'
                        }`}
                      >
                        {alert.recordedValue} {alert.unit}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {alert.configuredThreshold}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {formatDateTime(alert.timestamp)}
                      </td>
                      <td className="py-3 px-4">
                        <AlertStatusLabel status={alert.status} />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedAlert(alert)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Details</span>
                          </button>
                          {isUnack && permissions.canAcknowledgeAlerts && (
                            <button
                              type="button"
                              onClick={() => acknowledgeAlert(alert.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#0A162B] hover:bg-slate-800 text-white text-xs font-medium cursor-pointer"
                            >
                              Acknowledge
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alert Details Modal */}
      <Modal
        open={Boolean(selectedAlert)}
        onClose={() => setSelectedAlert(null)}
        title={
          selectedAlert ? `Alert Details — ${selectedAlert.id}` : 'Alert Details'
        }
        subtitle={
          selectedAlert
            ? `Sample ${selectedAlert.sampleId} · ${
                stationMap.get(selectedAlert.stationId)?.name ??
                selectedAlert.stationId
              }`
            : undefined
        }
      >
        {selectedAlert && (
          <div className="space-y-4 text-sm">
            <div
              className={`p-4 rounded-xl border ${
                selectedAlert.status === 'Unacknowledged'
                  ? 'bg-rose-50 border-rose-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <AlertStatusLabel status={selectedAlert.status} />
                <span className="text-xs font-mono text-slate-500">
                  {formatDateTime(selectedAlert.timestamp)}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">
                    Abnormal Parameter
                  </span>
                  <span className="font-semibold text-slate-900">
                    {selectedAlert.parameter}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Recorded Value</span>
                  <span className="font-mono font-bold text-rose-700">
                    {selectedAlert.recordedValue} {selectedAlert.unit}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">
                    Configured Demo Threshold
                  </span>
                  <span className="font-mono text-slate-800">
                    {selectedAlert.configuredThreshold}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Data Origin</span>
                  <span className="text-slate-800">
                    {selectedAlert.isSimulatedDemo
                      ? 'Simulated Demo Record'
                      : 'User-Entered Record'}
                  </span>
                </div>
              </div>
            </div>

            {selectedAlertSample && (
              <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">
                    Associated Sample Context ({selectedAlertSample.id})
                  </span>
                  <SampleStatusLabel
                    status={selectedAlertSample.status}
                    compact
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono pt-1">
                  <div className="p-2 rounded bg-slate-50">
                    <span className="text-slate-500 block font-sans">pH</span>
                    <strong>{selectedAlertSample.ph.toFixed(2)}</strong>
                  </div>
                  <div className="p-2 rounded bg-slate-50">
                    <span className="text-slate-500 block font-sans">
                      Turbidity
                    </span>
                    <strong>
                      {selectedAlertSample.turbidity.toFixed(2)} NTU
                    </strong>
                  </div>
                  <div className="p-2 rounded bg-slate-50">
                    <span className="text-slate-500 block font-sans">DO</span>
                    <strong>
                      {selectedAlertSample.dissolvedOxygen.toFixed(2)} mg/L
                    </strong>
                  </div>
                  <div className="p-2 rounded bg-slate-50">
                    <span className="text-slate-500 block font-sans">Temp</span>
                    <strong>
                      {selectedAlertSample.temperature.toFixed(1)} °C
                    </strong>
                  </div>
                </div>
                {selectedAlertSample.remarks && (
                  <p className="text-xs text-slate-600 pt-1">
                    Remarks: {selectedAlertSample.remarks}
                  </p>
                )}
              </div>
            )}

            {selectedAlert.status === 'Acknowledged' && (
              <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                Acknowledged by{' '}
                <strong>{selectedAlert.acknowledgedBy ?? 'Operator'}</strong>
                {selectedAlert.acknowledgedAt
                  ? ` on ${formatDateTime(selectedAlert.acknowledgedAt)}`
                  : ''}
                .
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              {selectedAlert.status === 'Unacknowledged' &&
                permissions.canAcknowledgeAlerts && (
                  <button
                    type="button"
                    onClick={() => {
                      acknowledgeAlert(selectedAlert.id);
                      setSelectedAlert(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-[#0A162B] text-white text-xs font-medium hover:bg-slate-800 cursor-pointer"
                  >
                    Mark as Acknowledged
                  </button>
                )}
              <button
                type="button"
                onClick={() => setSelectedAlert(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
