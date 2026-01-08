type Status = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'RETRYING';

interface StatusBadgeProps {
  status: Status;
}

const statusConfig = {
  PENDING: {
    label: 'Pendiente',
    className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  },
  CONFIRMED: {
    label: 'Confirmada',
    className: 'bg-green-500/20 text-green-400 border-green-500/50',
  },
  FAILED: {
    label: 'Fallida',
    className: 'bg-red-500/20 text-red-400 border-red-500/50',
  },
  RETRYING: {
    label: 'Reintentando',
    className: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium border ${config.className}`}>
      {config.label}
    </span>
  );
}
