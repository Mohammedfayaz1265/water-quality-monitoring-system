import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FlaskConical,
  Info,
  MapPin,
  Plus,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Modal } from '../components/Modal';
import { AlertStatusLabel, SampleStatusLabel } from '../components/StatusText';
import { WaterBasin3D } from '../components/WaterBasin3D';
import { useWqms } from '../context/WqmsContext';
import { ParameterName, WaterSample } from '../types/wqms';
import { formatDateTime, formatShortDate } from '../utils/classification';

const PARAMETER_META: Record<
  ParameterName,
  {
    key: keyof Pick<
      WaterSample,
      'ph' | 'turbidity' | 'dissolvedOxygen' | 'temperature'
    >;
    unit: string;
    color: string;
    secondaryColor: string;
    label: string;
  }
> = {
  pH: {
    key: 'ph',
    unit: 'pH',
    color: '#06B6D4',
    secondaryColor: '#3B82F6',
    label: 'pH Level',
  },
  Turbidity: {
    key: 'turbidity',
    unit: 'NTU',
    color: '#6366F1',
    secondaryColor: '#0EA5E9',
    label: 'Turbidity',
  },
  'Dissolved Oxygen': {
    key: 'dissolvedOxygen',
    unit: 'mg/L',
    color: '#10B981',
    secondaryColor: '#14B8A6',
    label: 'Dissolved Oxygen',
  },
  Temperature: {
    key: 'temperature',
    unit: '°C',
    color: '#F59E0B',
    secondaryColor: '#F97316',
    label: 'Temperature',
  },
};

export function DashboardPage() {
  const {
    state,
    setActivePage,
    setSampleStationFilter,
    acknowledgeAlert,
    permissions,
  } = useWqms();

  const [selectedParam, setSelectedParam] = useState<ParameterName>('pH');
  const [selectedSample, setSelectedSample] = useState<WaterSample | null>(null);

  const stationMap = useMemo(
    () => new Map(state.stations.map((s) => [s.id, s])),
    [state.stations]
  );

  const stats = useMemo(() => {
    const total = state.samples.length;
    const normal = state.samples.filter(
      (s) => s.status === 'Within Configured Thresholds'
    ).length;
    const abnormal = total - normal;
    const unackAlerts = state.alerts.filter(
      (a) => a.status === 'Unacknowledged'
    ).length;
    return {
      total,
      normal,
      abnormal,
      stations: state.stations.length,
      unackAlerts,
      normalRate: total > 0 ? Math.round((normal / total) * 100) : 0,
    };
  }, [state.samples, state.alerts, state.stations.length]);

  const sortedSamplesDesc = useMemo(
    () =>
      [...state.samples].sort(
        (a, b) =>
          new Date(b.collectionDate).getTime() -
          new Date(a.collectionDate).getTime()
      ),
    [state.samples]
  );

  const trendData = useMemo(() => {
    return [...state.samples]
      .sort(
        (a, b) =>
          new Date(a.collectionDate).getTime() -
          new Date(b.collectionDate).getTime()
      )
      .map((s) => ({
        id: s.id,
        dateLabel: formatShortDate(s.collectionDate),
        fullDate: formatDateTime(s.collectionDate),
        station: stationMap.get(s.stationId)?.name ?? s.stationId,
        ph: s.ph,
        turbidity: s.turbidity,
        dissolvedOxygen: s.dissolvedOxygen,
        temperature: s.temperature,
      }));
  }, [state.samples, stationMap]);

  const distributionData = useMemo(
    () => [
      {
        name: 'Within Configured Thresholds',
        value: stats.normal,
        color: '#10B981',
      },
      {
        name: 'Outside Configured Thresholds',
        value: stats.abnormal,
        color: '#F43F5E',
      },
    ],
    [stats.normal, stats.abnormal]
  );

  const stationSummaries = useMemo(() => {
    return state.stations.map((station) => {
      const stSamples = sortedSamplesDesc.filter(
        (s) => s.stationId === station.id
      );
      const normalCount = stSamples.filter(
        (s) => s.status === 'Within Configured Thresholds'
      ).length;
      const abnormalCount = stSamples.length - normalCount;
      const latest = stSamples[0] ?? null;
      return {
        station,
        total: stSamples.length,
        normalCount,
        abnormalCount,
        latest,
      };
    });
  }, [state.stations, sortedSamplesDesc]);

  const recentAlerts = useMemo(
    () =>
      [...state.alerts]
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
        .slice(0, 5),
    [state.alerts]
  );

  const paramMeta = PARAMETER_META[selectedParam];

  const thresholdBounds = useMemo(() => {
    const t = state.thresholds;
    switch (selectedParam) {
      case 'pH':
        return { min: t.phMin, max: t.phMax, label: `${t.phMin} – ${t.phMax}` };
      case 'Turbidity':
        return {
          min: undefined,
          max: t.turbidityMax,
          label: `≤ ${t.turbidityMax} NTU`,
        };
      case 'Dissolved Oxygen':
        return {
          min: t.dissolvedOxygenMin,
          max: undefined,
          label: `≥ ${t.dissolvedOxygenMin} mg/L`,
        };
      case 'Temperature':
        return {
          min: t.temperatureMin,
          max: t.temperatureMax,
          label: `${t.temperatureMin} – ${t.temperatureMax} °C`,
        };
    }
  }, [selectedParam, state.thresholds]);

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Operations Overview
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Interactive 3D hydro-telemetry basin, threshold checks, and water-quality trend analytics
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {permissions.canManageSamples && (
            <button
              type="button"
              onClick={() => setActivePage('add-sample')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#0A162B] to-sky-900 hover:from-slate-800 hover:to-sky-800 text-white text-sm font-medium transition-all cursor-pointer whitespace-nowrap shadow-sm"
            >
              <Plus className="w-4 h-4 text-cyan-400" />
              <span>Add New Sample</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActivePage('reports')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-cyan-200 bg-cyan-50/60 hover:bg-cyan-100/70 text-cyan-950 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>Generate Report</span>
          </button>
        </div>
      </div>

      {state.preferences.showDemoNotices && (
        <div className="bg-gradient-to-r from-cyan-50 via-sky-50 to-teal-50 border border-cyan-200 rounded-xl p-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-cyan-700 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-700 leading-relaxed">
            <span className="font-semibold text-slate-900">
              Academic Simulation Prototype:
            </span>{' '}
            Preloaded records represent simulated demonstration data with no physical sensors connected.
            Parameter limits in Settings are illustrative demonstration thresholds (not official regulatory limits or drinking-water safety certifications).
          </div>
        </div>
      )}

      {/* Vibrant KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.16 }}
          className="bg-gradient-to-br from-white to-cyan-50/70 border border-cyan-200/80 rounded-xl p-5 overflow-hidden relative"
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-500 to-sky-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">
              Total Water Samples
            </span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
              <FlaskConical className="w-4 h-4 text-cyan-700" />
            </div>
          </div>
          <div className="mt-3 font-mono tabular-nums text-3xl font-bold text-slate-900">
            {stats.total}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Simulated & logged sample records
          </p>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.16 }}
          className="bg-gradient-to-br from-white to-emerald-50/70 border border-emerald-200/80 rounded-xl p-5 overflow-hidden relative"
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">
              Normal Readings
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono tabular-nums text-3xl font-bold text-slate-900">
              {stats.normal}
            </span>
            <span className="font-mono tabular-nums text-xs font-bold text-emerald-700">
              {stats.normalRate}%
            </span>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Within Configured Thresholds
          </p>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.16 }}
          className="bg-gradient-to-br from-white to-rose-50/70 border border-rose-200/80 rounded-xl p-5 overflow-hidden relative"
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-500 to-amber-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">
              Abnormal Readings
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-rose-700" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono tabular-nums text-3xl font-bold text-slate-900">
              {stats.abnormal}
            </span>
            <span className="font-mono tabular-nums text-xs font-bold text-rose-700">
              {stats.unackAlerts} active alerts
            </span>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Outside Configured Thresholds
          </p>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.16 }}
          className="bg-gradient-to-br from-white to-indigo-50/70 border border-indigo-200/80 rounded-xl p-5 overflow-hidden relative"
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 to-cyan-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">
              Monitoring Stations
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-indigo-700" />
            </div>
          </div>
          <div className="mt-3 font-mono tabular-nums text-3xl font-bold text-slate-900">
            {stats.stations}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Configured demonstration checkpoints
          </p>
        </motion.div>
      </div>

      {/* Interactive 3D Hydro-Telemetry Basin */}
      <WaterBasin3D
        stations={state.stations}
        samples={state.samples}
        animate={state.preferences.animateCharts}
        onSelectStationSamples={(stationId) => {
          setSampleStationFilter(stationId);
          setActivePage('samples');
        }}
      />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Parameter Trend Chart */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Parameter Trend Analysis
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Demo threshold range:{' '}
                <span className="font-mono font-medium text-slate-700">
                  {thresholdBounds.label}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
              {(Object.keys(PARAMETER_META) as ParameterName[]).map((param) => {
                const isSelected = selectedParam === param;
                return (
                  <button
                    key={param}
                    type="button"
                    onClick={() => setSelectedParam(param)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? 'bg-[#0A162B] text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {param}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 min-h-[260px]">
            {trendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                No sample data recorded yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart
                  data={trendData}
                  margin={{ top: 10, right: 16, left: -12, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="paramGradientFill"
                      x1="0"
                      y1="0"
                      x2="1"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor={paramMeta.color}
                        stopOpacity={0.34}
                      />
                      <stop
                        offset="55%"
                        stopColor={paramMeta.secondaryColor}
                        stopOpacity={0.14}
                      />
                      <stop
                        offset="100%"
                        stopColor={paramMeta.secondaryColor}
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                    <linearGradient
                      id="paramStroke"
                      x1="0"
                      y1="0"
                      x2="1"
                      y2="0"
                    >
                      <stop offset="0%" stopColor={paramMeta.color} />
                      <stop offset="100%" stopColor={paramMeta.secondaryColor} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0A162B',
                      border: '1px solid #1E293B',
                      borderRadius: '8px',
                      color: '#F8FAFC',
                      fontSize: '12px',
                    }}
                    formatter={(value) => [
                      `${value ?? ''} ${paramMeta.unit}`,
                      paramMeta.label,
                    ]}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload;
                      return row
                        ? `${row.id} · ${row.station} (${row.fullDate})`
                        : '';
                    }}
                  />
                  {thresholdBounds.max !== undefined && (
                    <ReferenceLine
                      y={thresholdBounds.max}
                      stroke="#F43F5E"
                      strokeDasharray="4 4"
                      label={{
                        value: `Max ${thresholdBounds.max}`,
                        position: 'insideTopRight',
                        fill: '#E11D48',
                        fontSize: 10,
                      }}
                    />
                  )}
                  {thresholdBounds.min !== undefined && (
                    <ReferenceLine
                      y={thresholdBounds.min}
                      stroke="#F59E0B"
                      strokeDasharray="4 4"
                      label={{
                        value: `Min ${thresholdBounds.min}`,
                        position: 'insideBottomRight',
                        fill: '#D97706',
                        fontSize: 10,
                      }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey={paramMeta.key}
                    stroke="url(#paramStroke)"
                    strokeWidth={2.75}
                    fillOpacity={1}
                    fill="url(#paramGradientFill)"
                    isAnimationActive={state.preferences.animateCharts}
                    dot={{
                      r: 4,
                      fill: paramMeta.color,
                      stroke: '#FFFFFF',
                      strokeWidth: 1.5,
                    }}
                    activeDot={{ r: 6, fill: paramMeta.secondaryColor }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Status Distribution Chart */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Threshold Classification
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Sample distribution vs demo thresholds
            </p>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center min-h-[210px]">
            {stats.total === 0 ? (
              <p className="text-sm text-slate-500">No samples available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={82}
                    paddingAngle={4}
                    dataKey="value"
                    isAnimationActive={state.preferences.animateCharts}
                  >
                    {distributionData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0A162B',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="space-y-2.5 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-700">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shrink-0" />
                Within Configured Thresholds
              </span>
              <span className="font-mono tabular-nums font-semibold text-emerald-700">
                {stats.normal} ({stats.normalRate}%)
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-700">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 shrink-0" />
                Outside Configured Thresholds
              </span>
              <span className="font-mono tabular-nums font-semibold text-rose-700">
                {stats.abnormal} ({100 - stats.normalRate}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Samples & Recent Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Samples */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-cyan-50/40">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Recent Sample Records
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Latest simulated and logged entries
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('samples')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:text-cyan-900 cursor-pointer whitespace-nowrap"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-4">Sample ID</th>
                  <th className="py-2.5 px-4">Station</th>
                  <th className="py-2.5 px-4 text-right">pH</th>
                  <th className="py-2.5 px-4 text-right">Turbidity</th>
                  <th className="py-2.5 px-4 text-right">DO</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {sortedSamplesDesc.slice(0, 6).map((sample) => (
                  <tr
                    key={sample.id}
                    onClick={() => setSelectedSample(sample)}
                    className="hover:bg-cyan-50/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {sample.id}
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-[170px] truncate">
                      {stationMap.get(sample.stationId)?.name ?? sample.stationId}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-cyan-800 font-medium">
                      {sample.ph.toFixed(1)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-indigo-800 font-medium">
                      {sample.turbidity.toFixed(1)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-800 font-medium">
                      {sample.dissolvedOxygen.toFixed(1)}
                    </td>
                    <td className="py-3 px-4">
                      <SampleStatusLabel status={sample.status} compact />
                    </td>
                  </tr>
                ))}
                {sortedSamplesDesc.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-slate-500 text-sm"
                    >
                      No water samples available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-rose-50/40">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Recent Alerts
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Triggered when readings breach demo thresholds
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('alerts')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:text-cyan-900 cursor-pointer whitespace-nowrap"
            >
              <span>Manage Alerts</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100 flex-1">
            {recentAlerts.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No threshold alerts recorded.
              </div>
            ) : (
              recentAlerts.map((alert) => {
                const isUnack = alert.status === 'Unacknowledged';
                return (
                  <div
                    key={alert.id}
                    className={`p-4 flex items-start justify-between gap-3 ${
                      isUnack ? 'bg-rose-50/45' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono font-semibold text-slate-900">
                          {alert.id}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <AlertStatusLabel status={alert.status} />
                      </div>
                      <p className="text-xs font-medium text-slate-800 mt-1">
                        {alert.parameter}:{' '}
                        <span className="font-mono font-semibold text-rose-700">
                          {alert.recordedValue} {alert.unit}
                        </span>{' '}
                        <span className="text-slate-500">
                          (Demo limit: {alert.configuredThreshold})
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {stationMap.get(alert.stationId)?.name ?? alert.stationId}{' '}
                        · {alert.sampleId} · {formatDateTime(alert.timestamp)}
                      </p>
                    </div>
                    {isUnack && permissions.canAcknowledgeAlerts && (
                      <button
                        type="button"
                        onClick={() => acknowledgeAlert(alert.id)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-medium text-slate-800 cursor-pointer shrink-0"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Station-Wise Sample Summary */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-indigo-50/35">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Station-Wise Sample Summary
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Breakdown across configured demonstration monitoring points
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActivePage('stations')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:text-cyan-900 cursor-pointer whitespace-nowrap"
          >
            <span>Manage Stations</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 px-5">Station</th>
                <th className="py-2.5 px-4">Location</th>
                <th className="py-2.5 px-4 text-right">Samples</th>
                <th className="py-2.5 px-4 text-right">Within Thresholds</th>
                <th className="py-2.5 px-4 text-right">Outside Thresholds</th>
                <th className="py-2.5 px-4">Latest Sample</th>
                <th className="py-2.5 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {stationSummaries.map(
                ({ station, total, normalCount, abnormalCount, latest }) => (
                  <tr key={station.id} className="hover:bg-slate-50">
                    <td className="py-3 px-5">
                      <div className="font-semibold text-slate-900">
                        {station.name}
                      </div>
                      <div className="font-mono text-[11px] text-cyan-700">
                        {station.id}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {station.location}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {total}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                      {normalCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-rose-700 font-semibold">
                      {abnormalCount}
                    </td>
                    <td className="py-3 px-4">
                      {latest ? (
                        <div className="space-y-0.5">
                          <SampleStatusLabel status={latest.status} compact />
                          <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                            {formatDateTime(latest.collectionDate)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">No samples</span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSampleStationFilter(station.id);
                          setActivePage('samples');
                        }}
                        className="text-xs font-medium text-cyan-700 hover:text-cyan-900 cursor-pointer whitespace-nowrap"
                      >
                        Inspect Samples
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Sample Detail Modal */}
      <Modal
        open={Boolean(selectedSample)}
        onClose={() => setSelectedSample(null)}
        title={
          selectedSample
            ? `Sample Details — ${selectedSample.id}`
            : 'Sample Details'
        }
        subtitle={
          selectedSample
            ? `${
                stationMap.get(selectedSample.stationId)?.name ??
                selectedSample.stationId
              } · ${formatDateTime(selectedSample.collectionDate)}`
            : undefined
        }
      >
        {selectedSample && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
              <SampleStatusLabel status={selectedSample.status} />
              <span className="text-xs text-slate-500">
                {selectedSample.isSimulatedDemo
                  ? 'Preloaded Simulated Demo Data'
                  : 'User-Entered Demo Record'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-cyan-200 bg-cyan-50/40">
                <div className="text-xs text-cyan-900 font-medium">pH Level</div>
                <div className="font-mono tabular-nums text-lg font-bold text-slate-900 mt-1">
                  {selectedSample.ph.toFixed(2)}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-indigo-200 bg-indigo-50/40">
                <div className="text-xs text-indigo-900 font-medium">
                  Turbidity
                </div>
                <div className="font-mono tabular-nums text-lg font-bold text-slate-900 mt-1">
                  {selectedSample.turbidity.toFixed(2)}{' '}
                  <span className="text-xs font-normal text-slate-500">NTU</span>
                </div>
              </div>
              <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/40">
                <div className="text-xs text-emerald-900 font-medium">
                  Dissolved Oxygen
                </div>
                <div className="font-mono tabular-nums text-lg font-bold text-slate-900 mt-1">
                  {selectedSample.dissolvedOxygen.toFixed(2)}{' '}
                  <span className="text-xs font-normal text-slate-500">mg/L</span>
                </div>
              </div>
              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/40">
                <div className="text-xs text-amber-900 font-medium">
                  Temperature
                </div>
                <div className="font-mono tabular-nums text-lg font-bold text-slate-900 mt-1">
                  {selectedSample.temperature.toFixed(1)}{' '}
                  <span className="text-xs font-normal text-slate-500">°C</span>
                </div>
              </div>
            </div>

            {selectedSample.abnormalParameters.length > 0 && (
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-800">
                  <Activity className="w-3.5 h-3.5" />
                  <span>Triggered Demo Threshold Deviations</span>
                </div>
                {selectedSample.abnormalParameters.map((ab) => (
                  <div
                    key={ab.parameter}
                    className="text-xs text-rose-700 font-mono tabular-nums"
                  >
                    {ab.parameter}: {ab.recordedValue} {ab.unit} (Demo rule:{' '}
                    {ab.thresholdRule})
                  </div>
                ))}
              </div>
            )}

            <div className="text-xs text-slate-600 space-y-1">
              <div>
                <span className="font-medium text-slate-800">Operator:</span>{' '}
                {selectedSample.operatorName}
              </div>
              <div>
                <span className="font-medium text-slate-800">Remarks:</span>{' '}
                {selectedSample.remarks || 'None'}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
