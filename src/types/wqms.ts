export type NavPage =
  | 'dashboard'
  | 'samples'
  | 'add-sample'
  | 'analytics'
  | 'alerts'
  | 'stations'
  | 'reports'
  | 'settings';

export type UserRole = 'Administrator' | 'Analyst / Operator' | 'Viewer';

export type SampleStatus =
  | 'Within Configured Thresholds'
  | 'Outside Configured Thresholds';

export type AlertStatus = 'Unacknowledged' | 'Acknowledged';

export type ParameterName =
  | 'pH'
  | 'Turbidity'
  | 'Dissolved Oxygen'
  | 'Temperature';

export interface ThresholdConfig {
  phMin: number;
  phMax: number;
  turbidityMax: number;
  dissolvedOxygenMin: number;
  temperatureMin: number;
  temperatureMax: number;
}

export interface AbnormalDetail {
  parameter: ParameterName;
  recordedValue: number;
  unit: string;
  thresholdRule: string;
  direction: 'low' | 'high';
}

export interface MonitoringStation {
  id: string;
  name: string;
  location: string;
  description: string;
  isSimulatedDemo: boolean;
  createdAt: string;
}

export interface WaterSample {
  id: string;
  stationId: string;
  collectionDate: string; // ISO string YYYY-MM-DDTHH:mm
  ph: number;
  turbidity: number; // NTU
  dissolvedOxygen: number; // mg/L
  temperature: number; // °C
  operatorName: string;
  remarks: string;
  status: SampleStatus;
  abnormalParameters: AbnormalDetail[];
  isSimulatedDemo: boolean;
  createdAt: string;
}

export interface QualityAlert {
  id: string;
  sampleId: string;
  stationId: string;
  parameter: ParameterName;
  recordedValue: number;
  unit: string;
  configuredThreshold: string;
  timestamp: string;
  status: AlertStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  isSimulatedDemo: boolean;
}

export interface AppPreferences {
  defaultOperatorName: string;
  autoGenerateAlerts: boolean;
  animateCharts: boolean;
  showDemoNotices: boolean;
}

export interface WqmsState {
  stations: MonitoringStation[];
  samples: WaterSample[];
  alerts: QualityAlert[];
  thresholds: ThresholdConfig;
  preferences: AppPreferences;
  currentRole: UserRole;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  description?: string;
  actionLabel?: string;
  actionPage?: NavPage;
}
