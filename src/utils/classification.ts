import {
  AbnormalDetail,
  MonitoringStation,
  ParameterName,
  QualityAlert,
  SampleStatus,
  ThresholdConfig,
  WaterSample,
} from '../types/wqms';

export function evaluateSampleParameters(
  readings: {
    ph: number;
    turbidity: number;
    dissolvedOxygen: number;
    temperature: number;
  },
  thresholds: ThresholdConfig
): {
  status: SampleStatus;
  abnormalParameters: AbnormalDetail[];
} {
  const abnormalParameters: AbnormalDetail[] = [];

  if (readings.ph < thresholds.phMin) {
    abnormalParameters.push({
      parameter: 'pH',
      recordedValue: readings.ph,
      unit: 'pH',
      thresholdRule: `${thresholds.phMin.toFixed(1)} – ${thresholds.phMax.toFixed(1)}`,
      direction: 'low',
    });
  } else if (readings.ph > thresholds.phMax) {
    abnormalParameters.push({
      parameter: 'pH',
      recordedValue: readings.ph,
      unit: 'pH',
      thresholdRule: `${thresholds.phMin.toFixed(1)} – ${thresholds.phMax.toFixed(1)}`,
      direction: 'high',
    });
  }

  if (readings.turbidity > thresholds.turbidityMax) {
    abnormalParameters.push({
      parameter: 'Turbidity',
      recordedValue: readings.turbidity,
      unit: 'NTU',
      thresholdRule: `≤ ${thresholds.turbidityMax.toFixed(1)} NTU`,
      direction: 'high',
    });
  }

  if (readings.dissolvedOxygen < thresholds.dissolvedOxygenMin) {
    abnormalParameters.push({
      parameter: 'Dissolved Oxygen',
      recordedValue: readings.dissolvedOxygen,
      unit: 'mg/L',
      thresholdRule: `≥ ${thresholds.dissolvedOxygenMin.toFixed(1)} mg/L`,
      direction: 'low',
    });
  }

  if (readings.temperature < thresholds.temperatureMin) {
    abnormalParameters.push({
      parameter: 'Temperature',
      recordedValue: readings.temperature,
      unit: '°C',
      thresholdRule: `${thresholds.temperatureMin.toFixed(1)} – ${thresholds.temperatureMax.toFixed(1)} °C`,
      direction: 'low',
    });
  } else if (readings.temperature > thresholds.temperatureMax) {
    abnormalParameters.push({
      parameter: 'Temperature',
      recordedValue: readings.temperature,
      unit: '°C',
      thresholdRule: `${thresholds.temperatureMin.toFixed(1)} – ${thresholds.temperatureMax.toFixed(1)} °C`,
      direction: 'high',
    });
  }

  return {
    status:
      abnormalParameters.length === 0
        ? 'Within Configured Thresholds'
        : 'Outside Configured Thresholds',
    abnormalParameters,
  };
}

export function isParameterAbnormal(
  sample: WaterSample,
  parameter: ParameterName
): boolean {
  return sample.abnormalParameters.some((item) => item.parameter === parameter);
}

export function generateNextSampleId(existingSamples: WaterSample[]): string {
  const year = new Date().getFullYear();
  let maxNum = 0;
  for (const s of existingSamples) {
    const match = s.id.match(/(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (!Number.isNaN(n) && n > maxNum) {
        maxNum = n;
      }
    }
  }
  const nextNum = String(maxNum + 1).padStart(3, '0');
  return `SMP-${year}-${nextNum}`;
}

export function generateNextAlertId(existingAlerts: QualityAlert[]): string {
  let maxNum = 0;
  for (const a of existingAlerts) {
    const match = a.id.match(/(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (!Number.isNaN(n) && n > maxNum) {
        maxNum = n;
      }
    }
  }
  const nextNum = String(maxNum + 1).padStart(3, '0');
  return `ALT-${nextNum}`;
}

export function generateNextStationId(
  existingStations: MonitoringStation[]
): string {
  let maxNum = 0;
  for (const st of existingStations) {
    const match = st.id.match(/(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (!Number.isNaN(n) && n > maxNum) {
        maxNum = n;
      }
    }
  }
  const nextNum = String(maxNum + 1).padStart(3, '0');
  return `STN-${nextNum}`;
}

export function formatDateTime(isoString: string): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatShortDate(isoString: string): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
  });
}

export function toLocalInputDateTime(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportSamplesToCsv(
  samples: WaterSample[],
  stations: MonitoringStation[]
): string {
  const stationMap = new Map(stations.map((s) => [s.id, s.name]));
  const headers = [
    'Sample ID',
    'Station ID',
    'Station Name',
    'Collection Date',
    'pH',
    'Turbidity (NTU)',
    'Dissolved Oxygen (mg/L)',
    'Temperature (°C)',
    'Classification Status',
    'Abnormal Parameters',
    'Operator Name',
    'Remarks',
    'Data Type',
  ];

  const rows = samples.map((sample) => [
    sample.id,
    sample.stationId,
    stationMap.get(sample.stationId) ?? sample.stationId,
    formatDateTime(sample.collectionDate),
    sample.ph.toFixed(2),
    sample.turbidity.toFixed(2),
    sample.dissolvedOxygen.toFixed(2),
    sample.temperature.toFixed(1),
    sample.status,
    sample.abnormalParameters.length > 0
      ? sample.abnormalParameters
          .map((a) => `${a.parameter} (${a.recordedValue} ${a.unit})`)
          .join('; ')
      : 'None',
    sample.operatorName,
    sample.remarks || '',
    sample.isSimulatedDemo ? 'Simulated Demo Data' : 'User Entered (Demo Mode)',
  ]);

  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n');
}
