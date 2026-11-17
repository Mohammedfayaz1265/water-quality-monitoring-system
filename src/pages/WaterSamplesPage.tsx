import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Edit3,
  Eye,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { SampleStatusLabel } from '../components/StatusText';
import { useWqms } from '../context/WqmsContext';
import { SampleStatus, WaterSample } from '../types/wqms';
import {
  formatDateTime,
  isParameterAbnormal,
} from '../utils/classification';

export function WaterSamplesPage() {
  const {
    state,
    sampleStationFilter,
    setSampleStationFilter,
    setActivePage,
    updateSample,
    deleteSample,
    permissions,
  } = useWqms();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SampleStatus>('ALL');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const [viewingSample, setViewingSample] = useState<WaterSample | null>(null);
  const [editingSample, setEditingSample] = useState<WaterSample | null>(null);
  const [deletingSample, setDeletingSample] = useState<WaterSample | null>(
    null
  );

  // Edit form state
  const [editForm, setEditForm] = useState({
    stationId: '',
    collectionDate: '',
    ph: '',
    turbidity: '',
    dissolvedOxygen: '',
    temperature: '',
    operatorName: '',
    remarks: '',
  });
  const [editError, setEditError] = useState('');

  const stationMap = useMemo(
    () => new Map(state.stations.map((s) => [s.id, s])),
    [state.stations]
  );

  const filteredSamples = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...state.samples]
      .filter((s) => {
        if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
        if (
          sampleStationFilter !== 'ALL' &&
          s.stationId !== sampleStationFilter
        )
          return false;
        if (q) {
          const stationName =
            stationMap.get(s.stationId)?.name.toLowerCase() ?? '';
          const match =
            s.id.toLowerCase().includes(q) ||
            stationName.includes(q) ||
            s.operatorName.toLowerCase().includes(q) ||
            s.remarks.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const ta = new Date(a.collectionDate).getTime();
        const tb = new Date(b.collectionDate).getTime();
        return sortOrder === 'desc' ? tb - ta : ta - tb;
      });
  }, [
    state.samples,
    statusFilter,
    sampleStationFilter,
    searchQuery,
    sortOrder,
    stationMap,
  ]);

  const openEditModal = (sample: WaterSample) => {
    setEditingSample(sample);
    setEditForm({
      stationId: sample.stationId,
      collectionDate: sample.collectionDate.slice(0, 16),
      ph: String(sample.ph),
      turbidity: String(sample.turbidity),
      dissolvedOxygen: String(sample.dissolvedOxygen),
      temperature: String(sample.temperature),
      operatorName: sample.operatorName,
      remarks: sample.remarks,
    });
    setEditError('');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSample) return;

    const ph = Number(editForm.ph);
    const turbidity = Number(editForm.turbidity);
    const dissolvedOxygen = Number(editForm.dissolvedOxygen);
    const temperature = Number(editForm.temperature);

    if (
      !editForm.stationId ||
      !editForm.collectionDate ||
      !editForm.operatorName.trim()
    ) {
      setEditError('Station, collection date, and operator name are required.');
      return;
    }
    if (
      Number.isNaN(ph) ||
      Number.isNaN(turbidity) ||
      Number.isNaN(dissolvedOxygen) ||
      Number.isNaN(temperature)
    ) {
      setEditError('All water parameter readings must be valid numbers.');
      return;
    }
    if (ph < 0 || ph > 14) {
      setEditError('pH must be between 0 and 14.');
      return;
    }
    if (turbidity < 0 || dissolvedOxygen < 0) {
      setEditError('Turbidity and Dissolved Oxygen cannot be negative.');
      return;
    }
    if (temperature < -10 || temperature > 100) {
      setEditError('Temperature must be between -10 °C and 100 °C.');
      return;
    }

    const res = updateSample(editingSample.id, {
      stationId: editForm.stationId,
      collectionDate: editForm.collectionDate,
      ph,
      turbidity,
      dissolvedOxygen,
      temperature,
      operatorName: editForm.operatorName,
      remarks: editForm.remarks,
    });

    if (!res.ok) {
      setEditError(res.error ?? 'Failed to update sample.');
      return;
    }
    setEditingSample(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Water Sample Management
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Search, filter, inspect, edit, and manage simulated water-quality sample records
          </p>
        </div>
        {permissions.canManageSamples && (
          <button
            type="button"
            onClick={() => setActivePage('add-sample')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0A162B] hover:bg-slate-800 text-white text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 text-cyan-400" />
            <span>Add New Sample</span>
          </button>
        )}
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ID, station, operator..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as 'ALL' | SampleStatus)
          }
          aria-label="Filter by status"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
        >
          <option value="ALL">All Classification Statuses</option>
          <option value="Within Configured Thresholds">
            Within Configured Thresholds
          </option>
          <option value="Outside Configured Thresholds">
            Outside Configured Thresholds
          </option>
        </select>

        <select
          value={sampleStationFilter}
          onChange={(e) => setSampleStationFilter(e.target.value)}
          aria-label="Filter by station"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-600"
        >
          <option value="ALL">All Monitoring Stations</option>
          {state.stations.map((st) => (
            <option key={st.id} value={st.id}>
              {st.name} ({st.id})
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() =>
            setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))
          }
          className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer whitespace-nowrap"
        >
          <ArrowUpDown className="w-4 h-4 text-slate-500" />
          <span>
            Date: {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
          </span>
        </button>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          Showing{' '}
          <strong className="font-mono text-slate-800">
            {filteredSamples.length}
          </strong>{' '}
          of{' '}
          <strong className="font-mono text-slate-800">
            {state.samples.length}
          </strong>{' '}
          records (Preloaded entries are labeled Simulated Demo)
        </span>
        {(searchQuery ||
          statusFilter !== 'ALL' ||
          sampleStationFilter !== 'ALL') && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('ALL');
              setSampleStationFilter('ALL');
            }}
            className="text-cyan-700 font-medium hover:underline cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Samples Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-600">
                <th className="py-3 px-4">Sample ID</th>
                <th className="py-3 px-4">Station Name</th>
                <th className="py-3 px-4">Collection Date</th>
                <th className="py-3 px-3 text-right">pH</th>
                <th className="py-3 px-3 text-right">Turbidity (NTU)</th>
                <th className="py-3 px-3 text-right">DO (mg/L)</th>
                <th className="py-3 px-3 text-right">Temp (°C)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredSamples.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No water samples match the current filters.
                  </td>
                </tr>
              ) : (
                filteredSamples.map((sample) => {
                  const phBad = isParameterAbnormal(sample, 'pH');
                  const turbBad = isParameterAbnormal(sample, 'Turbidity');
                  const doBad = isParameterAbnormal(
                    sample,
                    'Dissolved Oxygen'
                  );
                  const tempBad = isParameterAbnormal(sample, 'Temperature');

                  return (
                    <tr
                      key={sample.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono font-semibold text-slate-900">
                          {sample.id}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {sample.isSimulatedDemo
                            ? 'Simulated Demo'
                            : 'Logged Entry'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">
                          {stationMap.get(sample.stationId)?.name ??
                            sample.stationId}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Op: {sample.operatorName}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {formatDateTime(sample.collectionDate)}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-mono tabular-nums font-medium ${
                          phBad ? 'text-rose-700 font-bold' : 'text-slate-800'
                        }`}
                      >
                        {sample.ph.toFixed(2)}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-mono tabular-nums font-medium ${
                          turbBad ? 'text-rose-700 font-bold' : 'text-slate-800'
                        }`}
                      >
                        {sample.turbidity.toFixed(2)}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-mono tabular-nums font-medium ${
                          doBad ? 'text-rose-700 font-bold' : 'text-slate-800'
                        }`}
                      >
                        {sample.dissolvedOxygen.toFixed(2)}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-mono tabular-nums font-medium ${
                          tempBad ? 'text-rose-700 font-bold' : 'text-slate-800'
                        }`}
                      >
                        {sample.temperature.toFixed(1)}
                      </td>
                      <td className="py-3 px-4">
                        <SampleStatusLabel status={sample.status} compact />
                        {sample.abnormalParameters.length > 0 && (
                          <div className="text-[11px] text-rose-700 mt-0.5">
                            {sample.abnormalParameters
                              .map((a) => a.parameter)
                              .join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingSample(sample)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-cyan-800 hover:bg-cyan-50 cursor-pointer"
                            title="View sample details"
                            aria-label={`View sample ${sample.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {permissions.canManageSamples && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditModal(sample)}
                                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                                title="Edit sample"
                                aria-label={`Edit sample ${sample.id}`}
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingSample(sample)}
                                className="p-1.5 rounded-lg text-slate-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                                title="Delete sample"
                                aria-label={`Delete sample ${sample.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
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

      {/* View Sample Details Modal */}
      <Modal
        open={Boolean(viewingSample)}
        onClose={() => setViewingSample(null)}
        title={
          viewingSample ? `Sample Record — ${viewingSample.id}` : 'Sample'
        }
        subtitle={
          viewingSample
            ? `${
                stationMap.get(viewingSample.stationId)?.name ??
                viewingSample.stationId
              } · Collected ${formatDateTime(viewingSample.collectionDate)}`
            : undefined
        }
      >
        {viewingSample && (
          <div className="space-y-4 text-sm">
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
              <SampleStatusLabel status={viewingSample.status} />
              <span className="text-xs text-slate-500">
                {viewingSample.isSimulatedDemo
                  ? 'Simulated Demonstration Record'
                  : 'User-Entered Demo Record'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-500">
                  pH (Demo: {state.thresholds.phMin}–{state.thresholds.phMax})
                </div>
                <div
                  className={`font-mono tabular-nums text-lg font-bold mt-1 ${
                    isParameterAbnormal(viewingSample, 'pH')
                      ? 'text-rose-700'
                      : 'text-slate-900'
                  }`}
                >
                  {viewingSample.ph.toFixed(2)}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-500">
                  Turbidity (Demo: ≤ {state.thresholds.turbidityMax} NTU)
                </div>
                <div
                  className={`font-mono tabular-nums text-lg font-bold mt-1 ${
                    isParameterAbnormal(viewingSample, 'Turbidity')
                      ? 'text-rose-700'
                      : 'text-slate-900'
                  }`}
                >
                  {viewingSample.turbidity.toFixed(2)} NTU
                </div>
              </div>
              <div className="p-3 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-500">
                  Dissolved Oxygen (Demo: ≥{' '}
                  {state.thresholds.dissolvedOxygenMin} mg/L)
                </div>
                <div
                  className={`font-mono tabular-nums text-lg font-bold mt-1 ${
                    isParameterAbnormal(viewingSample, 'Dissolved Oxygen')
                      ? 'text-rose-700'
                      : 'text-slate-900'
                  }`}
                >
                  {viewingSample.dissolvedOxygen.toFixed(2)} mg/L
                </div>
              </div>
              <div className="p-3 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-500">
                  Temperature (Demo: {state.thresholds.temperatureMin}–
                  {state.thresholds.temperatureMax} °C)
                </div>
                <div
                  className={`font-mono tabular-nums text-lg font-bold mt-1 ${
                    isParameterAbnormal(viewingSample, 'Temperature')
                      ? 'text-rose-700'
                      : 'text-slate-900'
                  }`}
                >
                  {viewingSample.temperature.toFixed(1)} °C
                </div>
              </div>
            </div>

            {viewingSample.abnormalParameters.length > 0 && (
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 space-y-1">
                <div className="text-xs font-semibold text-rose-800">
                  Abnormal Parameters Triggered
                </div>
                {viewingSample.abnormalParameters.map((ab) => (
                  <div
                    key={ab.parameter}
                    className="text-xs text-rose-700 font-mono"
                  >
                    {ab.parameter}: {ab.recordedValue} {ab.unit} (Demo limit:{' '}
                    {ab.thresholdRule})
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1.5 text-xs text-slate-600 pt-1">
              <div>
                <span className="font-semibold text-slate-800">Operator:</span>{' '}
                {viewingSample.operatorName}
              </div>
              <div>
                <span className="font-semibold text-slate-800">Remarks:</span>{' '}
                {viewingSample.remarks || 'None'}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Sample Modal */}
      <Modal
        open={Boolean(editingSample)}
        onClose={() => setEditingSample(null)}
        title={
          editingSample ? `Edit Sample — ${editingSample.id}` : 'Edit Sample'
        }
        subtitle="Re-evaluates classification and alerts automatically on save"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          {editError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
              {editError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Station
              </label>
              <select
                value={editForm.stationId}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, stationId: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                {state.stations.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Collection Date & Time
              </label>
              <input
                type="datetime-local"
                value={editForm.collectionDate}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, collectionDate: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                pH
              </label>
              <input
                type="number"
                step="0.01"
                value={editForm.ph}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, ph: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Turbidity (NTU)
              </label>
              <input
                type="number"
                step="0.01"
                value={editForm.turbidity}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, turbidity: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Dissolved Oxygen (mg/L)
              </label>
              <input
                type="number"
                step="0.01"
                value={editForm.dissolvedOxygen}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    dissolvedOxygen: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Temperature (°C)
              </label>
              <input
                type="number"
                step="0.1"
                value={editForm.temperature}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, temperature: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Operator Name
            </label>
            <input
              type="text"
              value={editForm.operatorName}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, operatorName: e.target.value }))
              }
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Remarks
            </label>
            <textarea
              rows={2}
              value={editForm.remarks}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, remarks: e.target.value }))
              }
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingSample(null)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#0A162B] text-white text-xs font-medium hover:bg-slate-800 cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={Boolean(deletingSample)}
        onClose={() => setDeletingSample(null)}
        title="Confirm Sample Deletion"
        subtitle="This action cannot be undone"
      >
        {deletingSample && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Are you sure you want to delete water sample{' '}
              <span className="font-mono font-semibold text-slate-900">
                {deletingSample.id}
              </span>
              ? Any alerts generated specifically for this sample will also be
              removed.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingSample(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteSample(deletingSample.id);
                  setDeletingSample(null);
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 cursor-pointer"
              >
                Delete Sample
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
