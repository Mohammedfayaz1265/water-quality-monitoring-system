import { useMemo, useState } from 'react';
import { Download, Printer, RotateCcw } from 'lucide-react';
import { SampleStatusLabel } from '../components/StatusText';
import { useWqms } from '../context/WqmsContext';
import {
  exportSamplesToCsv,
  formatDateTime,
} from '../utils/classification';

export function ReportsPage() {
  const { state, addToast } = useWqms();

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [stationFilter, setStationFilter] = useState('ALL');

  const stationMap = useMemo(
    () => new Map(state.stations.map((s) => [s.id, s])),
    [state.stations]
  );

  const filteredSamples = useMemo(() => {
    return [...state.samples]
      .filter((s) => {
        if (stationFilter !== 'ALL' && s.stationId !== stationFilter)
          return false;
        const day = s.collectionDate.slice(0, 10);
        if (fromDate && day < fromDate) return false;
        if (toDate && day > toDate) return false;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.collectionDate).getTime() -
          new Date(a.collectionDate).getTime()
      );
  }, [state.samples, stationFilter, fromDate, toDate]);

  const counts = useMemo(() => {
    const total = filteredSamples.length;
    const normal = filteredSamples.filter(
      (s) => s.status === 'Within Configured Thresholds'
    ).length;
    const abnormal = total - normal;
    const rate = total > 0 ? Math.round((normal / total) * 100) : 0;
    return { total, normal, abnormal, rate };
  }, [filteredSamples]);

  const parameterSummary = useMemo(() => {
    const compute = (
      label: string,
      unit: string,
      rule: string,
      values: number[],
      paramName: string
    ) => {
      if (values.length === 0) {
        return { label, unit, rule, min: '—', max: '—', avg: '—', abnormal: 0 };
      }
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const abnormal = filteredSamples.filter((s) =>
        s.abnormalParameters.some((ab) => ab.parameter === paramName)
      ).length;
      return {
        label,
        unit,
        rule,
        min: min.toFixed(2),
        max: max.toFixed(2),
        avg: avg.toFixed(2),
        abnormal,
      };
    };

    const t = state.thresholds;
    return [
      compute(
        'pH',
        'pH',
        `${t.phMin} – ${t.phMax}`,
        filteredSamples.map((s) => s.ph),
        'pH'
      ),
      compute(
        'Turbidity',
        'NTU',
        `≤ ${t.turbidityMax} NTU`,
        filteredSamples.map((s) => s.turbidity),
        'Turbidity'
      ),
      compute(
        'Dissolved Oxygen',
        'mg/L',
        `≥ ${t.dissolvedOxygenMin} mg/L`,
        filteredSamples.map((s) => s.dissolvedOxygen),
        'Dissolved Oxygen'
      ),
      compute(
        'Temperature',
        '°C',
        `${t.temperatureMin} – ${t.temperatureMax} °C`,
        filteredSamples.map((s) => s.temperature),
        'Temperature'
      ),
    ];
  }, [filteredSamples, state.thresholds]);

  const stationSummary = useMemo(() => {
    return state.stations
      .filter((st) => stationFilter === 'ALL' || st.id === stationFilter)
      .map((st) => {
        const list = filteredSamples.filter((s) => s.stationId === st.id);
        const normal = list.filter(
          (s) => s.status === 'Within Configured Thresholds'
        ).length;
        const abnormal = list.length - normal;
        const latest = list[0]?.collectionDate
          ? formatDateTime(list[0].collectionDate)
          : '—';
        return {
          station: st,
          total: list.length,
          normal,
          abnormal,
          latest,
        };
      });
  }, [state.stations, filteredSamples, stationFilter]);

  const handleDownloadCsv = () => {
    const csv = exportSamplesToCsv(filteredSamples, state.stations);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute('download', `wqms_report_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast({
      type: 'success',
      title: 'CSV Report Downloaded',
      description: `Exported ${filteredSamples.length} sample record(s).`,
    });
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Print-Only Academic Report Header */}
      <div className="hidden print-only border-b border-slate-300 pb-4 mb-6">
        <h1 className="font-display text-xl font-bold text-slate-900">
          WATER QUALITY MONITORING SYSTEM — SUMMARY REPORT
        </h1>
        <p className="text-xs text-slate-600 mt-1">
          Academic Software Simulation Prototype · Generated{' '}
          {new Date().toLocaleString()} · Demonstration Thresholds Only (Non-Regulatory)
        </p>
      </div>

      {/* Header & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Water Quality Reports
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Filter simulated sample data, inspect statistical summaries, and export CSV or printable PDF reports
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={filteredSamples.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0A162B] hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Download CSV</span>
          </button>
          <button
            type="button"
            onClick={handlePrintReport}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end no-print">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            From Date
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            To Date
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Monitoring Station
          </label>
          <select
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
          >
            <option value="ALL">All Monitoring Stations</option>
            {state.stations.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            setFromDate('');
            setToDate('');
            setStationFilter('ALL');
          }}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Filters</span>
        </button>
      </div>

      {/* Report KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print-break-inside-avoid">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Total Sample Count</div>
          <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">
            {counts.total}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Within Thresholds</div>
          <div className="font-mono tabular-nums text-2xl font-bold text-emerald-700 mt-1">
            {counts.normal}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Outside Thresholds</div>
          <div className="font-mono tabular-nums text-2xl font-bold text-rose-700 mt-1">
            {counts.abnormal}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Demo Threshold Rate</div>
          <div className="font-mono tabular-nums text-2xl font-bold text-cyan-800 mt-1">
            {counts.rate}%
          </div>
        </div>
      </div>

      {/* Parameter Summary */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden print-break-inside-avoid">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Parameter Statistical Summary
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-2.5 px-5">Parameter</th>
                <th className="py-2.5 px-4">Configured Demo Threshold</th>
                <th className="py-2.5 px-4 text-right">Min</th>
                <th className="py-2.5 px-4 text-right">Mean</th>
                <th className="py-2.5 px-4 text-right">Max</th>
                <th className="py-2.5 px-5 text-right">Abnormal Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {parameterSummary.map((row) => (
                <tr key={row.label}>
                  <td className="py-3 px-5 font-semibold text-slate-900">
                    {row.label} ({row.unit})
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">
                    {row.rule}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">
                    {row.min}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-medium">
                    {row.avg}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">
                    {row.max}
                  </td>
                  <td
                    className={`py-3 px-5 text-right font-mono tabular-nums font-semibold ${
                      row.abnormal > 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {row.abnormal}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Station-Wise Summary */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden print-break-inside-avoid">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Station-Wise Summary
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-2.5 px-5">Station ID</th>
                <th className="py-2.5 px-4">Station Name</th>
                <th className="py-2.5 px-4 text-right">Total Samples</th>
                <th className="py-2.5 px-4 text-right">Within Thresholds</th>
                <th className="py-2.5 px-4 text-right">Outside Thresholds</th>
                <th className="py-2.5 px-5">Latest Record</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stationSummary.map((row) => (
                <tr key={row.station.id}>
                  <td className="py-3 px-5 font-mono font-semibold text-slate-900">
                    {row.station.id}
                  </td>
                  <td className="py-3 px-4 text-slate-800 font-medium">
                    {row.station.name}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                    {row.total}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700">
                    {row.normal}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-rose-700">
                    {row.abnormal}
                  </td>
                  <td className="py-3 px-5 font-mono tabular-nums text-slate-600">
                    {row.latest}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Date-Wise Records */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Date-Wise Sample Records ({filteredSamples.length})
          </h3>
          <span className="text-[11px] text-slate-500">
            Simulated & logged academic demonstration data
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-2.5 px-4">Date & Time</th>
                <th className="py-2.5 px-4">Sample ID</th>
                <th className="py-2.5 px-4">Station</th>
                <th className="py-2.5 px-3 text-right">pH</th>
                <th className="py-2.5 px-3 text-right">Turb (NTU)</th>
                <th className="py-2.5 px-3 text-right">DO (mg/L)</th>
                <th className="py-2.5 px-3 text-right">Temp (°C)</th>
                <th className="py-2.5 px-4">Classification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSamples.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No records match the selected report filters.
                  </td>
                </tr>
              ) : (
                filteredSamples.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {formatDateTime(s.collectionDate)}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {s.id}
                    </td>
                    <td className="py-2.5 px-4 text-slate-800">
                      {stationMap.get(s.stationId)?.name ?? s.stationId}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {s.ph.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {s.turbidity.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {s.dissolvedOxygen.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {s.temperature.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-4">
                      <SampleStatusLabel status={s.status} compact />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 text-center pb-2">
        Disclaimer: All figures above are part of an academic software simulation prototype using illustrative demonstration thresholds and must not be used for regulatory compliance or drinking-water safety decisions.
      </p>
    </div>
  );
}
