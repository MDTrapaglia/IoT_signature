import { useCurrentTime } from '../../hooks/useCurrentTime';

interface Props {
  lastUpdated: Date | null;
  timeZone?: string;
}

export function TimeInfo({ lastUpdated, timeZone }: Props) {
  const { currentTime, timeZone: localTimeZone } = useCurrentTime();
  const tz = timeZone || localTimeZone;

  const formatDateTime = (date: Date | null) =>
    date
      ? new Intl.DateTimeFormat('es-ES', {
          dateStyle: 'short',
          timeStyle: 'short',
          timeZone: tz
        }).format(date)
      : 'Nunca';

  return (
    <p className="text-sm text-zinc-400">
      Última actualización: <span className="text-zinc-200">{formatDateTime(lastUpdated)}</span> · Hora actual:{' '}
      <span className="text-zinc-200">{formatDateTime(currentTime)}</span> ({tz})
    </p>
  );
}
