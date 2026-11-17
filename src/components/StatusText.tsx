import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { AlertStatus, SampleStatus } from '../types/wqms';

export function SampleStatusLabel({
  status,
  compact = false,
}: {
  status: SampleStatus;
  compact?: boolean;
}) {
  const isNormal = status === 'Within Configured Thresholds';

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${
        isNormal ? 'text-emerald-700' : 'text-rose-700'
      }`}
    >
      {isNormal ? (
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
      ) : (
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
      )}
      <span>
        {compact
          ? isNormal
            ? 'Within Thresholds'
            : 'Outside Thresholds'
          : status}
      </span>
    </span>
  );
}

export function AlertStatusLabel({ status }: { status: AlertStatus }) {
  const isUnack = status === 'Unacknowledged';

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${
        isUnack ? 'text-rose-700' : 'text-slate-600'
      }`}
    >
      {isUnack ? (
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
      ) : (
        <Clock className="w-3.5 h-3.5 shrink-0 text-slate-400" />
      )}
      <span>{status}</span>
    </span>
  );
}
