import React, { useMemo, useState } from 'react';
import {
  Edit3,
  MapPin,
  Plus,
  Trash2,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { SampleStatusLabel } from '../components/StatusText';
import { useWqms } from '../context/WqmsContext';
import { MonitoringStation } from '../types/wqms';
import {
  formatDateTime,
  generateNextStationId,
} from '../utils/classification';

export function StationsPage() {
  const {
    state,
    addStation,
    updateStation,
    deleteStation,
    setSampleStationFilter,
    setActivePage,
    permissions,
  } = useWqms();

  const [addOpen, setAddOpen] = useState(false);
  const [editingStation, setEditingStation] =
    useState<MonitoringStation | null>(null);
  const [deletingStation, setDeletingStation] =
    useState<MonitoringStation | null>(null);

  const [formState, setFormState] = useState({
    id: '',
    name: '',
    location: '',
    description: '',
  });
  const [formError, setFormError] = useState('');

  const stationRows = useMemo(() => {
    return state.stations.map((station) => {
      const stSamples = [...state.samples]
        .filter((s) => s.stationId === station.id)
        .sort(
          (a, b) =>
            new Date(b.collectionDate).getTime() -
            new Date(a.collectionDate).getTime()
        );
      const latest = stSamples[0] ?? null;
      return {
        station,
        sampleCount: stSamples.length,
        latestDate: latest ? formatDateTime(latest.collectionDate) : '—',
        latestStatus: latest?.status ?? null,
      };
    });
  }, [state.stations, state.samples]);

  const openAddModal = () => {
    setFormState({
      id: generateNextStationId(state.stations),
      name: '',
      location: '',
      description: '',
    });
    setFormError('');
    setAddOpen(true);
  };

  const openEditModal = (station: MonitoringStation) => {
    setFormState({
      id: station.id,
      name: station.name,
      location: station.location,
      description: station.description,
    });
    setFormError('');
    setEditingStation(station);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.id.trim() || !formState.name.trim() || !formState.location.trim()) {
      setFormError('Station ID, Station Name, and Location are required.');
      return;
    }
    const res = addStation(formState);
    if (!res.ok) {
      setFormError(res.error ?? 'Failed to add station.');
      return;
    }
    setAddOpen(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStation) return;
    if (!formState.name.trim() || !formState.location.trim()) {
      setFormError('Station Name and Location are required.');
      return;
    }
    updateStation(editingStation.id, {
      name: formState.name,
      location: formState.location,
      description: formState.description,
    });
    setEditingStation(null);
  };

  const deletingSampleCount = deletingStation
    ? state.samples.filter((s) => s.stationId === deletingStation.id).length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Monitoring Stations
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Manage simulated sampling locations and inspect station-level water quality status
          </p>
        </div>

        {permissions.canManageStations && (
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0A162B] hover:bg-slate-800 text-white text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 text-cyan-400" />
            <span>Add Station</span>
          </button>
        )}
      </div>

      {!permissions.canManageStations && (
        <div className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-700">
          Station creation, editing, and deletion require the{' '}
          <strong>Administrator</strong> role. You are currently viewing as{' '}
          <strong>{state.currentRole}</strong>.
        </div>
      )}

      {/* Stations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {stationRows.map(
          ({ station, sampleCount, latestDate, latestStatus }) => (
            <div
              key={station.id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-mono text-cyan-800 font-semibold">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span>{station.id}</span>
                      {station.isSimulatedDemo && (
                        <>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="font-sans text-[11px] font-normal text-slate-500">
                            Simulated Demo Station
                          </span>
                        </>
                      )}
                    </div>
                    <h3 className="font-display text-lg font-bold text-slate-900 mt-1">
                      {station.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {station.location}
                    </p>
                  </div>

                  {permissions.canManageStations && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditModal(station)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                        title="Edit station"
                        aria-label={`Edit ${station.name}`}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingStation(station)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                        title="Delete station"
                        aria-label={`Delete ${station.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {station.description || 'No description provided.'}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block">Recorded Samples</span>
                    <span className="font-mono tabular-nums font-bold text-slate-900 text-sm">
                      {sampleCount}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block">
                      Latest Sample Date
                    </span>
                    <span className="font-mono tabular-nums text-slate-800 font-medium">
                      {latestDate}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div>
                    {latestStatus ? (
                      <SampleStatusLabel status={latestStatus} compact />
                    ) : (
                      <span className="text-xs text-slate-400">
                        No samples logged yet
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSampleStationFilter(station.id);
                      setActivePage('samples');
                    }}
                    className="text-xs font-semibold text-cyan-700 hover:text-cyan-900 cursor-pointer whitespace-nowrap"
                  >
                    View Station Samples →
                  </button>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* Add Station Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Monitoring Station"
        subtitle="Create a new simulated water sampling checkpoint"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
              {formError}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Station ID *
            </label>
            <input
              type="text"
              value={formState.id}
              onChange={(e) =>
                setFormState((f) => ({ ...f, id: e.target.value }))
              }
              className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Station Name *
            </label>
            <input
              type="text"
              value={formState.name}
              onChange={(e) =>
                setFormState((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="e.g. West Aqueduct Checkpoint"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Location *
            </label>
            <input
              type="text"
              value={formState.location}
              onChange={(e) =>
                setFormState((f) => ({ ...f, location: e.target.value }))
              }
              placeholder="e.g. Sector E · Mile 4.8"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={formState.description}
              onChange={(e) =>
                setFormState((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Brief purpose of this monitoring point..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#0A162B] text-white text-xs font-medium hover:bg-slate-800 cursor-pointer"
            >
              Add Station
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Station Modal */}
      <Modal
        open={Boolean(editingStation)}
        onClose={() => setEditingStation(null)}
        title={
          editingStation
            ? `Edit Station — ${editingStation.id}`
            : 'Edit Station'
        }
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
              {formError}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Station Name *
            </label>
            <input
              type="text"
              value={formState.name}
              onChange={(e) =>
                setFormState((f) => ({ ...f, name: e.target.value }))
              }
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Location *
            </label>
            <input
              type="text"
              value={formState.location}
              onChange={(e) =>
                setFormState((f) => ({ ...f, location: e.target.value }))
              }
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={formState.description}
              onChange={(e) =>
                setFormState((f) => ({ ...f, description: e.target.value }))
              }
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingStation(null)}
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

      {/* Delete Station Confirmation Modal */}
      <Modal
        open={Boolean(deletingStation)}
        onClose={() => setDeletingStation(null)}
        title="Confirm Station Deletion"
        subtitle="Permanent removal of station and linked records"
      >
        {deletingStation && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Are you sure you want to delete{' '}
              <strong>{deletingStation.name}</strong> ({deletingStation.id})?
              {deletingSampleCount > 0 && (
                <span>
                  {' '}
                  This will also remove{' '}
                  <strong className="text-rose-700">
                    {deletingSampleCount} sample record(s)
                  </strong>{' '}
                  and their associated alerts.
                </span>
              )}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingStation(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteStation(deletingStation.id);
                  setDeletingStation(null);
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 cursor-pointer"
              >
                Delete Station
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
