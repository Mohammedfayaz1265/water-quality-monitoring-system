import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { SampleStatusLabel } from '../components/StatusText';
import { useWqms } from '../context/WqmsContext';
import {
  evaluateSampleParameters,
  generateNextSampleId,
  toLocalInputDateTime,
} from '../utils/classification';

export function AddSamplePage() {
  const { state, addSample, permissions, setActivePage, setRole } = useWqms();

  const [sampleId, setSampleId] = useState(() =>
    generateNextSampleId(state.samples)
  );
  const [stationId, setStationId] = useState(
    () => state.stations[0]?.id ?? ''
  );
  const [collectionDate, setCollectionDate] = useState(() =>
    toLocalInputDateTime()
  );
  const [ph, setPh] = useState('7.2');
  const [turbidity, setTurbidity] = useState('2.1');
  const [dissolvedOxygen, setDissolvedOxygen] = useState('7.6');
  const [temperature, setTemperature] = useState('20.5');
  const [operatorName, setOperatorName] = useState(
    state.preferences.defaultOperatorName || ''
  );
  const [remarks, setRemarks] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const liveEvaluation = useMemo(() => {
    const phNum = Number(ph);
    const turbNum = Number(turbidity);
    const doNum = Number(dissolvedOxygen);
    const tempNum = Number(temperature);
    if (
      ph.trim() === '' ||
      turbidity.trim() === '' ||
      dissolvedOxygen.trim() === '' ||
      temperature.trim() === '' ||
      Number.isNaN(phNum) ||
      Number.isNaN(turbNum) ||
      Number.isNaN(doNum) ||
      Number.isNaN(tempNum)
    ) {
      return null;
    }
    return evaluateSampleParameters(
      {
        ph: phNum,
        turbidity: turbNum,
        dissolvedOxygen: doNum,
        temperature: tempNum,
      },
      state.thresholds
    );
  }, [ph, turbidity, dissolvedOxygen, temperature, state.thresholds]);

  const fillNormalDemo = () => {
    setPh('7.3');
    setTurbidity('1.8');
    setDissolvedOxygen('7.9');
    setTemperature('19.8');
    setRemarks('Simulated normal test entry for prototype demonstration.');
    setFieldErrors({});
    setSubmitError('');
  };

  const fillAbnormalDemo = () => {
    setPh('8.9');
    setTurbidity('7.6');
    setDissolvedOxygen('4.2');
    setTemperature('24.0');
    setRemarks(
      'Simulated abnormal test entry demonstrating multi-parameter threshold alert.'
    );
    setFieldErrors({});
    setSubmitError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.canManageSamples) return;

    const errors: Record<string, string> = {};
    const trimmedId = sampleId.trim().toUpperCase();

    if (!trimmedId) {
      errors.sampleId = 'Sample ID is required.';
    } else if (
      state.samples.some((s) => s.id.toUpperCase() === trimmedId)
    ) {
      errors.sampleId = `Duplicate Sample ID "${trimmedId}" already exists.`;
    }

    if (!stationId) {
      errors.stationId = 'Please select a monitoring station.';
    }
    if (!collectionDate) {
      errors.collectionDate = 'Collection date and time are required.';
    }
    if (!operatorName.trim()) {
      errors.operatorName = 'Operator name is required.';
    }

    const phNum = Number(ph);
    if (ph.trim() === '' || Number.isNaN(phNum)) {
      errors.ph = 'Enter a valid numeric pH value.';
    } else if (phNum < 0 || phNum > 14) {
      errors.ph = 'pH must fall between 0 and 14.';
    }

    const turbNum = Number(turbidity);
    if (turbidity.trim() === '' || Number.isNaN(turbNum)) {
      errors.turbidity = 'Enter a valid numeric turbidity value.';
    } else if (turbNum < 0 || turbNum > 1000) {
      errors.turbidity = 'Turbidity must be between 0 and 1000 NTU.';
    }

    const doNum = Number(dissolvedOxygen);
    if (dissolvedOxygen.trim() === '' || Number.isNaN(doNum)) {
      errors.dissolvedOxygen = 'Enter a valid numeric dissolved oxygen value.';
    } else if (doNum < 0 || doNum > 30) {
      errors.dissolvedOxygen = 'Dissolved Oxygen must be between 0 and 30 mg/L.';
    }

    const tempNum = Number(temperature);
    if (temperature.trim() === '' || Number.isNaN(tempNum)) {
      errors.temperature = 'Enter a valid numeric temperature value.';
    } else if (tempNum < -10 || tempNum > 100) {
      errors.temperature = 'Temperature must be between -10 °C and 100 °C.';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setSubmitError('Please resolve the highlighted validation errors.');
      return;
    }

    setSubmitError('');
    const result = addSample({
      id: trimmedId,
      stationId,
      collectionDate,
      ph: phNum,
      turbidity: turbNum,
      dissolvedOxygen: doNum,
      temperature: tempNum,
      operatorName,
      remarks,
    });

    if (!result.ok) {
      setSubmitError(result.error ?? 'Failed to record water sample.');
      return;
    }

    // Prepare next sequential sample ID for rapid entry
    const nextSamples = result.sample
      ? [result.sample, ...state.samples]
      : state.samples;
    setSampleId(generateNextSampleId(nextSamples));
    setCollectionDate(toLocalInputDateTime());
    setRemarks('');
  };

  if (!permissions.canManageSamples) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6 text-amber-700" />
        </div>
        <h2 className="font-display text-xl font-bold text-slate-900">
          Read-Only Role Active ({state.currentRole})
        </h2>
        <p className="text-sm text-slate-600">
          The Viewer role allows inspecting dashboards, samples, and reports,
          but cannot record new water samples. Switch to Analyst / Operator or
          Administrator to demonstrate sample entry.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => setRole('Analyst / Operator')}
            className="px-4 py-2 rounded-lg bg-[#0A162B] text-white text-sm font-medium hover:bg-slate-800 cursor-pointer"
          >
            Switch to Analyst / Operator
          </button>
          <button
            type="button"
            onClick={() => setActivePage('samples')}
            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 cursor-pointer"
          >
            View Water Samples
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Add New Water Sample
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Record simulated laboratory or field readings for automatic demo threshold evaluation
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={fillNormalDemo}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-medium cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Fill Normal Preset</span>
          </button>
          <button
            type="button"
            onClick={fillAbnormalDemo}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 text-xs font-medium cursor-pointer whitespace-nowrap"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Fill Abnormal Preset</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Column */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          {submitError && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800">
              {submitError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Sample ID *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={sampleId}
                  onChange={(e) => setSampleId(e.target.value)}
                  className={`flex-1 px-3 py-2 text-sm font-mono border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/30 ${
                    fieldErrors.sampleId
                      ? 'border-rose-400 bg-rose-50/30'
                      : 'border-slate-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() =>
                    setSampleId(generateNextSampleId(state.samples))
                  }
                  className="px-2.5 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer"
                  title="Generate next Sample ID"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              {fieldErrors.sampleId && (
                <p className="text-xs text-rose-600 mt-1">
                  {fieldErrors.sampleId}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Monitoring Station *
              </label>
              <select
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                className={`w-full px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30 ${
                  fieldErrors.stationId ? 'border-rose-400' : 'border-slate-200'
                }`}
              >
                {state.stations.length === 0 && (
                  <option value="">No stations configured</option>
                )}
                {state.stations.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.id})
                  </option>
                ))}
              </select>
              {fieldErrors.stationId && (
                <p className="text-xs text-rose-600 mt-1">
                  {fieldErrors.stationId}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Collection Date & Time *
              </label>
              <input
                type="datetime-local"
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
                className={`w-full px-3 py-2 text-sm font-mono border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/30 ${
                  fieldErrors.collectionDate
                    ? 'border-rose-400'
                    : 'border-slate-200'
                }`}
              />
              {fieldErrors.collectionDate && (
                <p className="text-xs text-rose-600 mt-1">
                  {fieldErrors.collectionDate}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Operator Name *
              </label>
              <input
                type="text"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                placeholder="e.g. Dr. Elena Vance"
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/30 ${
                  fieldErrors.operatorName
                    ? 'border-rose-400'
                    : 'border-slate-200'
                }`}
              />
              {fieldErrors.operatorName && (
                <p className="text-xs text-rose-600 mt-1">
                  {fieldErrors.operatorName}
                </p>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <h3 className="text-xs font-semibold text-slate-800 mb-3">
              Measured Water Parameters
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  pH Value (0 – 14) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={ph}
                  onChange={(e) => setPh(e.target.value)}
                  className={`w-full px-3 py-2 text-sm font-mono tabular-nums border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/30 ${
                    fieldErrors.ph ? 'border-rose-400' : 'border-slate-200'
                  }`}
                />
                {fieldErrors.ph ? (
                  <p className="text-xs text-rose-600 mt-1">{fieldErrors.ph}</p>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-1 font-mono">
                    Demo threshold: {state.thresholds.phMin} –{' '}
                    {state.thresholds.phMax}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Turbidity (NTU) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={turbidity}
                  onChange={(e) => setTurbidity(e.target.value)}
                  className={`w-full px-3 py-2 text-sm font-mono tabular-nums border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/30 ${
                    fieldErrors.turbidity
                      ? 'border-rose-400'
                      : 'border-slate-200'
                  }`}
                />
                {fieldErrors.turbidity ? (
                  <p className="text-xs text-rose-600 mt-1">
                    {fieldErrors.turbidity}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-1 font-mono">
                    Demo threshold: ≤ {state.thresholds.turbidityMax} NTU
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Dissolved Oxygen (mg/L) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={dissolvedOxygen}
                  onChange={(e) => setDissolvedOxygen(e.target.value)}
                  className={`w-full px-3 py-2 text-sm font-mono tabular-nums border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/30 ${
                    fieldErrors.dissolvedOxygen
                      ? 'border-rose-400'
                      : 'border-slate-200'
                  }`}
                />
                {fieldErrors.dissolvedOxygen ? (
                  <p className="text-xs text-rose-600 mt-1">
                    {fieldErrors.dissolvedOxygen}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-1 font-mono">
                    Demo threshold: ≥ {state.thresholds.dissolvedOxygenMin} mg/L
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Temperature (°C) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  className={`w-full px-3 py-2 text-sm font-mono tabular-nums border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/30 ${
                    fieldErrors.temperature
                      ? 'border-rose-400'
                      : 'border-slate-200'
                  }`}
                />
                {fieldErrors.temperature ? (
                  <p className="text-xs text-rose-600 mt-1">
                    {fieldErrors.temperature}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-1 font-mono">
                    Demo threshold: {state.thresholds.temperatureMin} –{' '}
                    {state.thresholds.temperatureMax} °C
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Optional Remarks
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Field notes or simulated observation context..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setActivePage('samples')}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#0A162B] hover:bg-slate-800 text-white text-sm font-medium transition-colors cursor-pointer"
            >
              <FlaskConical className="w-4 h-4 text-cyan-400" />
              <span>Save & Evaluate Sample</span>
            </button>
          </div>
        </form>

        {/* Live Evaluation Preview Column */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Live Threshold Evaluation Preview
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Preview classification against configured demonstration thresholds before saving
            </p>
          </div>

          {liveEvaluation ? (
            <div className="space-y-4">
              <div
                className={`p-4 rounded-xl border ${
                  liveEvaluation.status === 'Within Configured Thresholds'
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : 'bg-rose-50/70 border-rose-200'
                }`}
              >
                <SampleStatusLabel status={liveEvaluation.status} />
                <p className="text-xs text-slate-700 mt-2">
                  {liveEvaluation.status === 'Within Configured Thresholds'
                    ? 'All four entered values fall inside the configured demonstration limits.'
                    : `${liveEvaluation.abnormalParameters.length} parameter(s) fall outside configured demonstration limits. Submitting will automatically generate alert(s).`}
                </p>
              </div>

              {liveEvaluation.abnormalParameters.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-800">
                    Detected Abnormal Parameters
                  </div>
                  {liveEvaluation.abnormalParameters.map((ab) => (
                    <div
                      key={ab.parameter}
                      className="p-3 rounded-lg border border-rose-200 bg-white flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-rose-800">
                          {ab.parameter}
                        </div>
                        <div className="text-slate-500 font-mono">
                          Rule: {ab.thresholdRule}
                        </div>
                      </div>
                      <div className="font-mono tabular-nums font-bold text-rose-700 text-sm">
                        {ab.recordedValue} {ab.unit}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-2.5 text-xs text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>No threshold breaches detected for this input.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
              Enter valid numeric values for all four parameters to preview classification.
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-500 leading-relaxed">
            <strong className="text-slate-700">Academic Note:</strong>{' '}
            Classifications indicate compliance only with editable demonstration
            thresholds in Settings and must never be interpreted as drinking-water safety certification.
          </div>
        </div>
      </div>
    </div>
  );
}
