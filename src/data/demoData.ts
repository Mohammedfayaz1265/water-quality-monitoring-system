import {
  AppPreferences,
  MonitoringStation,
  QualityAlert,
  ThresholdConfig,
  WaterSample,
  WqmsState,
} from '../types/wqms';
import {
  evaluateSampleParameters,
  toLocalInputDateTime,
} from '../utils/classification';

export const DEFAULT_DEMO_THRESHOLDS: ThresholdConfig = {
  phMin: 6.5,
  phMax: 8.5,
  turbidityMax: 5.0,
  dissolvedOxygenMin: 5.0,
  temperatureMin: 10.0,
  temperatureMax: 35.0,
};

export const DEFAULT_PREFERENCES: AppPreferences = {
  defaultOperatorName: 'Dr. Elena Vance',
  autoGenerateAlerts: true,
  animateCharts: true,
  showDemoNotices: true,
};

function daysAgoIso(days: number, hour: number, minute: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return toLocalInputDateTime(d);
}

export function createInitialDemoState(): WqmsState {
  const year = new Date().getFullYear();

  const stations: MonitoringStation[] = [
    {
      id: 'STN-001',
      name: 'North River Intake Point',
      location: 'Sector A · Mile 14.2 Upstream',
      description:
        'Simulated freshwater river intake monitoring location tracking raw inflow stability and sediment load.',
      isSimulatedDemo: true,
      createdAt: daysAgoIso(30, 8, 0),
    },
    {
      id: 'STN-002',
      name: 'Central Reservoir Basin',
      location: 'Sector B · Primary Storage Basin',
      description:
        'Simulated mid-basin retention checkpoint evaluating thermal stratification and dissolved oxygen balance.',
      isSimulatedDemo: true,
      createdAt: daysAgoIso(30, 8, 15),
    },
    {
      id: 'STN-003',
      name: 'East Filtration Outfall',
      location: 'Sector C · Post-Clarification Channel',
      description:
        'Simulated discharge monitoring point used to demonstrate turbidity clarity and pH neutralization checks.',
      isSimulatedDemo: true,
      createdAt: daysAgoIso(30, 8, 30),
    },
    {
      id: 'STN-004',
      name: 'South Tributary Confluence',
      location: 'Sector D · Agricultural Runoff Junction',
      description:
        'Simulated seasonal tributary point demonstrating high-variance runoff turbidity and oxygen depletion events.',
      isSimulatedDemo: true,
      createdAt: daysAgoIso(25, 9, 0),
    },
  ];

  const rawSamples: Array<{
    id: string;
    stationId: string;
    collectionDate: string;
    ph: number;
    turbidity: number;
    dissolvedOxygen: number;
    temperature: number;
    operatorName: string;
    remarks: string;
  }> = [
    {
      id: `SMP-${year}-001`,
      stationId: 'STN-001',
      collectionDate: daysAgoIso(13, 9, 15),
      ph: 7.2,
      turbidity: 2.4,
      dissolvedOxygen: 7.8,
      temperature: 18.4,
      operatorName: 'Dr. Elena Vance',
      remarks: 'Preloaded simulated baseline morning sample.',
    },
    {
      id: `SMP-${year}-002`,
      stationId: 'STN-002',
      collectionDate: daysAgoIso(12, 11, 30),
      ph: 7.4,
      turbidity: 1.8,
      dissolvedOxygen: 8.1,
      temperature: 19.2,
      operatorName: 'Marcus Chen',
      remarks: 'Simulated mid-basin stability check.',
    },
    {
      id: `SMP-${year}-003`,
      stationId: 'STN-004',
      collectionDate: daysAgoIso(11, 14, 20),
      ph: 6.1,
      turbidity: 7.4,
      dissolvedOxygen: 4.3,
      temperature: 22.8,
      operatorName: 'Priya Nair',
      remarks: 'Simulated storm-runoff scenario showing elevated turbidity and acidic shift.',
    },
    {
      id: `SMP-${year}-004`,
      stationId: 'STN-003',
      collectionDate: daysAgoIso(9, 10, 5),
      ph: 7.3,
      turbidity: 1.5,
      dissolvedOxygen: 7.6,
      temperature: 20.1,
      operatorName: 'Dr. Elena Vance',
      remarks: 'Simulated post-clarification clarity verification.',
    },
    {
      id: `SMP-${year}-005`,
      stationId: 'STN-001',
      collectionDate: daysAgoIso(8, 16, 45),
      ph: 7.5,
      turbidity: 3.1,
      dissolvedOxygen: 7.2,
      temperature: 21.0,
      operatorName: 'Marcus Chen',
      remarks: 'Simulated afternoon intake log.',
    },
    {
      id: `SMP-${year}-006`,
      stationId: 'STN-002',
      collectionDate: daysAgoIso(6, 9, 40),
      ph: 8.9,
      turbidity: 2.9,
      dissolvedOxygen: 6.4,
      temperature: 23.5,
      operatorName: 'Priya Nair',
      remarks: 'Simulated alkaline drift scenario above pH upper demo limit.',
    },
    {
      id: `SMP-${year}-007`,
      stationId: 'STN-003',
      collectionDate: daysAgoIso(5, 13, 10),
      ph: 7.1,
      turbidity: 1.9,
      dissolvedOxygen: 7.9,
      temperature: 19.8,
      operatorName: 'Dr. Elena Vance',
      remarks: 'Simulated routine midday verification.',
    },
    {
      id: `SMP-${year}-008`,
      stationId: 'STN-004',
      collectionDate: daysAgoIso(4, 15, 50),
      ph: 7.0,
      turbidity: 6.8,
      dissolvedOxygen: 5.8,
      temperature: 24.2,
      operatorName: 'Marcus Chen',
      remarks: 'Simulated suspended sediment spike following upstream flow increase.',
    },
    {
      id: `SMP-${year}-009`,
      stationId: 'STN-002',
      collectionDate: daysAgoIso(3, 10, 25),
      ph: 7.4,
      turbidity: 2.1,
      dissolvedOxygen: 7.5,
      temperature: 36.4,
      operatorName: 'Priya Nair',
      remarks: 'Simulated thermal anomaly exceeding 35°C demo threshold.',
    },
    {
      id: `SMP-${year}-010`,
      stationId: 'STN-001',
      collectionDate: daysAgoIso(2, 8, 55),
      ph: 7.3,
      turbidity: 2.6,
      dissolvedOxygen: 8.0,
      temperature: 18.9,
      operatorName: 'Dr. Elena Vance',
      remarks: 'Simulated morning intake baseline.',
    },
    {
      id: `SMP-${year}-011`,
      stationId: 'STN-004',
      collectionDate: daysAgoIso(1, 14, 15),
      ph: 6.9,
      turbidity: 4.2,
      dissolvedOxygen: 4.1,
      temperature: 25.1,
      operatorName: 'Marcus Chen',
      remarks: 'Simulated low dissolved oxygen event in slow-moving tributary section.',
    },
    {
      id: `SMP-${year}-012`,
      stationId: 'STN-003',
      collectionDate: daysAgoIso(0, 8, 30),
      ph: 7.2,
      turbidity: 1.4,
      dissolvedOxygen: 8.3,
      temperature: 19.4,
      operatorName: 'Dr. Elena Vance',
      remarks: 'Latest preloaded simulated sample within demo thresholds.',
    },
  ];

  const thresholds = { ...DEFAULT_DEMO_THRESHOLDS };

  const samples: WaterSample[] = rawSamples.map((raw) => {
    const evaluation = evaluateSampleParameters(
      {
        ph: raw.ph,
        turbidity: raw.turbidity,
        dissolvedOxygen: raw.dissolvedOxygen,
        temperature: raw.temperature,
      },
      thresholds
    );
    return {
      ...raw,
      status: evaluation.status,
      abnormalParameters: evaluation.abnormalParameters,
      isSimulatedDemo: true,
      createdAt: raw.collectionDate,
    };
  });

  const alerts: QualityAlert[] = [];
  let alertSeq = 1;

  for (const sample of samples) {
    for (const ab of sample.abnormalParameters) {
      const id = `ALT-${String(alertSeq).padStart(3, '0')}`;
      // Mark earliest alerts as acknowledged for realistic demonstration history, keep recent ones unacknowledged
      const isHistoricalAcknowledged = alertSeq <= 3;
      alerts.push({
        id,
        sampleId: sample.id,
        stationId: sample.stationId,
        parameter: ab.parameter,
        recordedValue: ab.recordedValue,
        unit: ab.unit,
        configuredThreshold: ab.thresholdRule,
        timestamp: sample.collectionDate,
        status: isHistoricalAcknowledged ? 'Acknowledged' : 'Unacknowledged',
        acknowledgedBy: isHistoricalAcknowledged ? 'Dr. Elena Vance' : undefined,
        acknowledgedAt: isHistoricalAcknowledged
          ? daysAgoIso(8, 12, 0)
          : undefined,
        isSimulatedDemo: true,
      });
      alertSeq += 1;
    }
  }

  return {
    stations,
    samples,
    alerts,
    thresholds,
    preferences: { ...DEFAULT_PREFERENCES },
    currentRole: 'Administrator',
  };
}
