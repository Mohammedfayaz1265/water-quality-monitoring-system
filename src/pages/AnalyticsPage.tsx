import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AnalyticsLandscape3D } from '../components/AnalyticsLandscape3D';
import { useWqms } from '../context/WqmsContext';
import { formatDateTime, formatShortDate } from '../utils/classification';

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function AnalyticsPage() {
  const { state } = useWqms();

  const [stationFilter, setStationFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [rangePreset, setRangePreset] = useState<
    'all' | '7d' | '14d' | '30d' | 'custom'
  >('all');

  const stationMap = useMemo(
    () => new Map(state.stations.map((s) => [s.id, s])),
    [state.stations]
  );

  const applyPreset = (preset: 'all' | '7d' | '14d' | '30d') => {
    setRangePreset(preset);
    if (preset === 'all') {
      setFromDate('');
      setToDate('');
    } else if (preset === '7d') {
      setFromDate(isoDateDaysAgo(7));
      setToDate(isoDateDaysAgo(0));
    } else if (preset === '14d') {
      setFromDate(isoDateDaysAgo(14));
      setToDate(isoDateDaysAgo(0));
    } else if (preset === '30d') {
      setFromDate(isoDateDaysAgo(30));
      setToDate(isoDateDaysAgo(0));
    }
  };

  const filteredSamples = useMemo(() => {
    return [...state.samples]
      .filter((s) => {
        if (stationFilter !== 'ALL' && s.stationId !== stationFilter) {
          return false;
        }
        const sampleDay = s.collectionDate.slice(0, 10);
        if (fromDate && sampleDay < fromDate) return false;
        if (toDate && sampleDay > toDate) return false;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(a.collectionDate).getTime() -
          new Date(b.collectionDate).getTime()
      );
  }, [state.samples, stationFilter, fromDate, toDate]);

  const timeSeriesData = useMemo(
    () =>
      filteredSamples.map((s) => ({
        id: s.id,
        dateLabel: formatShortDate(s.collectionDate),
        fullDate: formatDateTime(s.collectionDate),
        station: stationMap.get(s.stationId)?.name ?? s.stationId,
        ph: s.ph,
        turbidity: s.turbidity,
        dissolvedOxygen: s.dissolvedOxygen,
        temperature: s.temperature,
      })),
    [filteredSamples, stationMap]
  );

  const normalVsAbnormalData = useMemo(() => {
    const normal = filteredSamples.filter(
      (s) => s.status === 'Within Configured Thresholds'
    ).length;
    const abnormal = filteredSamples.length - normal;
    return [
      {
        label: 'Within Configured Thresholds',
        count: normal,
        fill: '#10B981',
      },
      {
        label: 'Outside Configured Thresholds',
        count: abnormal,
        fill: '#F43F5E',
      },
    ];
  }, [filteredSamples]);

  const stationComparisonData = useMemo(() => {
    return state.stations
      .filter((st) => stationFilter === 'ALL' || st.id === stationFilter)
      .map((st) => {
        const list = filteredSamples.filter((s) => s.stationId === st.id);
        const normal = list.filter(
          (s) => s.status === 'Within Configured Thresholds'
        ).length;
        const abnormal = list.length - normal;
        return {
          stationId: st.id,
          name: st.name.length > 20 ? `${st.name.slice(0, 18)}…` : st.name,
          fullName: st.name,
          within: normal,
          outside: abnormal,
          total: list.length,
        };
      });
  }, [state.stations, filteredSamples, stationFilter]);

  const animate = state.preferences.animateCharts;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Water Quality Analytics
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            3D multi-parameter matrix, colour-coded parameter trends, and station comparisons
          </p>
        </div>
        <div className="text-xs font-mono text-cyan-950 bg-gradient-to-r from-cyan-50 to-sky-50 border border-cyan-200 rounded-lg px-3.5 py-2 tabular-nums">
          Records Analyzed: <strong>{filteredSamples.length}</strong>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          {(
            [
              { id: 'all', label: 'All Time' },
              { id: '7d', label: 'Last 7 Days' },
              { id: '14d', label: 'Last 14 Days' },
              { id: '30d', label: 'Last 30 Days' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => applyPreset(item.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                rangePreset === item.id
                  ? 'bg-[#0A162B] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 lg:max-w-2xl">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setRangePreset('custom');
              }}
              className="w-full px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setRangePreset('custom');
              }}
              className="w-full px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Station
            </label>
            <select
              value={stationFilter}
              onChange={(e) => setStationFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="ALL">All Monitoring Stations</option>
              {state.stations.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {filteredSamples.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-sm text-slate-500">
          No sample records fall within the selected date range and station filter.
        </div>
      ) : (
        <>
          {/* Interactive 3D Multi-Parameter Matrix */}
          <AnalyticsLandscape3D
            samples={filteredSamples}
            stations={state.stations}
            thresholds={state.thresholds}
            animate={animate}
          />

          {/* 4 Colorful Parameter Trend Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* pH Trend — Electric Cyan / Sky */}
            <div className="bg-white border border-cyan-200/80 rounded-xl p-5 relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-500 to-sky-500" />
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    pH Trend Chart
                  </h3>
                  <p className="text-xs text-cyan-800 font-mono">
                    Demo limits: {state.thresholds.phMin} –{' '}
                    {state.thresholds.phMax}
                  </p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={230}>
                <AreaChart
                  data={timeSeriesData}
                  margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="phGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.38} />
                      <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                  />
                  <YAxis
                    domain={[4, 10]}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0A162B',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                    formatter={(v) => [`${v ?? ''} pH`, 'pH']}
                    labelFormatter={(_, p) =>
                      p?.[0]?.payload
                        ? `${p[0].payload.id} · ${p[0].payload.station}`
                        : ''
                    }
                  />
                  <ReferenceLine
                    y={state.thresholds.phMax}
                    stroke="#F43F5E"
                    strokeDasharray="4 4"
                  />
                  <ReferenceLine
                    y={state.thresholds.phMin}
                    stroke="#F59E0B"
                    strokeDasharray="4 4"
                  />
                  <Area
                    type="monotone"
                    dataKey="ph"
                    stroke="#06B6D4"
                    fill="url(#phGrad)"
                    strokeWidth={2.5}
                    isAnimationActive={animate}
                    dot={{
                      r: 3.5,
                      fill: '#06B6D4',
                      stroke: '#fff',
                      strokeWidth: 1.5,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Turbidity Trend — Indigo / Cobalt */}
            <div className="bg-white border border-indigo-200/80 rounded-xl p-5 relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    Turbidity Trend Chart (NTU)
                  </h3>
                  <p className="text-xs text-indigo-800 font-mono">
                    Demo limit: ≤ {state.thresholds.turbidityMax} NTU
                  </p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={230}>
                <AreaChart
                  data={timeSeriesData}
                  margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="turbGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.38} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0A162B',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                    formatter={(v) => [`${v ?? ''} NTU`, 'Turbidity']}
                    labelFormatter={(_, p) =>
                      p?.[0]?.payload
                        ? `${p[0].payload.id} · ${p[0].payload.station}`
                        : ''
                    }
                  />
                  <ReferenceLine
                    y={state.thresholds.turbidityMax}
                    stroke="#F43F5E"
                    strokeDasharray="4 4"
                  />
                  <Area
                    type="monotone"
                    dataKey="turbidity"
                    stroke="#6366F1"
                    fill="url(#turbGrad)"
                    strokeWidth={2.5}
                    isAnimationActive={animate}
                    dot={{
                      r: 3.5,
                      fill: '#6366F1',
                      stroke: '#fff',
                      strokeWidth: 1.5,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Dissolved Oxygen Trend — Emerald / Teal */}
            <div className="bg-white border border-emerald-200/80 rounded-xl p-5 relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    Dissolved Oxygen Trend Chart (mg/L)
                  </h3>
                  <p className="text-xs text-emerald-800 font-mono">
                    Demo limit: ≥ {state.thresholds.dissolvedOxygenMin} mg/L
                  </p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={230}>
                <AreaChart
                  data={timeSeriesData}
                  margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="doGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.38} />
                      <stop offset="95%" stopColor="#14B8A6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0A162B',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                    formatter={(v) => [`${v ?? ''} mg/L`, 'Dissolved Oxygen']}
                    labelFormatter={(_, p) =>
                      p?.[0]?.payload
                        ? `${p[0].payload.id} · ${p[0].payload.station}`
                        : ''
                    }
                  />
                  <ReferenceLine
                    y={state.thresholds.dissolvedOxygenMin}
                    stroke="#F59E0B"
                    strokeDasharray="4 4"
                  />
                  <Area
                    type="monotone"
                    dataKey="dissolvedOxygen"
                    stroke="#10B981"
                    fill="url(#doGrad)"
                    strokeWidth={2.5}
                    isAnimationActive={animate}
                    dot={{
                      r: 3.5,
                      fill: '#10B981',
                      stroke: '#fff',
                      strokeWidth: 1.5,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Temperature Trend — Amber / Coral Orange */}
            <div className="bg-white border border-amber-200/80 rounded-xl p-5 relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    Temperature Trend Chart (°C)
                  </h3>
                  <p className="text-xs text-amber-800 font-mono">
                    Demo limits: {state.thresholds.temperatureMin} –{' '}
                    {state.thresholds.temperatureMax} °C
                  </p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={230}>
                <AreaChart
                  data={timeSeriesData}
                  margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.38} />
                      <stop offset="95%" stopColor="#F97316" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0A162B',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                    formatter={(v) => [`${v ?? ''} °C`, 'Temperature']}
                    labelFormatter={(_, p) =>
                      p?.[0]?.payload
                        ? `${p[0].payload.id} · ${p[0].payload.station}`
                        : ''
                    }
                  />
                  <ReferenceLine
                    y={state.thresholds.temperatureMax}
                    stroke="#F43F5E"
                    strokeDasharray="4 4"
                  />
                  <ReferenceLine
                    y={state.thresholds.temperatureMin}
                    stroke="#0EA5E9"
                    strokeDasharray="4 4"
                  />
                  <Area
                    type="monotone"
                    dataKey="temperature"
                    stroke="#F59E0B"
                    fill="url(#tempGrad)"
                    strokeWidth={2.5}
                    isAnimationActive={animate}
                    dot={{
                      r: 3.5,
                      fill: '#F59E0B',
                      stroke: '#fff',
                      strokeWidth: 1.5,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Comparison Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Normal vs Abnormal Comparison */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
              <div className="mb-3">
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Normal vs Abnormal Sample Comparison
                </h3>
                <p className="text-xs text-slate-500">
                  Classification counts across filtered dataset
                </p>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={normalVsAbnormalData}
                  margin={{ top: 12, right: 16, left: -16, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#475569' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0A162B',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="count"
                    radius={[8, 8, 0, 0]}
                    isAnimationActive={animate}
                  >
                    {normalVsAbnormalData.map((entry) => (
                      <Cell key={entry.label} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Station-Wise Comparison */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
              <div className="mb-3">
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Station-Wise Comparison
                </h3>
                <p className="text-xs text-slate-500">
                  Within vs Outside Configured Thresholds per monitoring station
                </p>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={stationComparisonData}
                  margin={{ top: 12, right: 16, left: -16, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#475569' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0A162B',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                    labelFormatter={(_, p) =>
                      p?.[0]?.payload?.fullName ?? ''
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar
                    dataKey="within"
                    name="Within Thresholds"
                    fill="#10B981"
                    radius={[6, 6, 0, 0]}
                    isAnimationActive={animate}
                  />
                  <Bar
                    dataKey="outside"
                    name="Outside Thresholds"
                    fill="#F43F5E"
                    radius={[6, 6, 0, 0]}
                    isAnimationActive={animate}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
