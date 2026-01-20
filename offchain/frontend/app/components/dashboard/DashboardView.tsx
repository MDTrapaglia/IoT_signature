'use client';

import { CheckCircle, XCircle, Clock, Cpu, Link, RefreshCw } from 'lucide-react';
import { useFetchData } from '../../hooks/useFetchData';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { ErrorAlert } from '../shared/ErrorAlert';
import type { Statistics, Measurement, OracleTransaction } from '../types';
import { StatsCard } from './StatsCard';

export function DashboardView() {
  const {
    data: stats,
    loading: statsLoading,
    refreshing: statsRefreshing,
    error: statsError,
    lastUpdated: statsUpdated,
    currentTime: statsCurrentTime,
    timeZone: statsTimeZone,
    refetch: refetchStats
  } = useFetchData<Statistics>('/api/statistics');
  const {
    data: measurements,
    loading: measurementsLoading,
    refreshing: measurementsRefreshing,
    error: measurementsError,
    lastUpdated: measurementsUpdated,
    currentTime: measurementsCurrentTime,
    timeZone: measurementsTimeZone,
    refetch: refetchMeasurements
  } = useFetchData<Measurement[]>('/api/measurements?limit=5');
  const {
    data: transactions,
    loading: transactionsLoading,
    refreshing: transactionsRefreshing,
    error: transactionsError,
    lastUpdated: transactionsUpdated,
    currentTime: transactionsCurrentTime,
    timeZone: transactionsTimeZone,
    refetch: refetchTransactions
  } = useFetchData<OracleTransaction[]>('/api/transactions?limit=5');

  const isLoading = statsLoading || measurementsLoading || transactionsLoading;
  const isBusy = isLoading || statsRefreshing || measurementsRefreshing || transactionsRefreshing;
  const timeZone = statsTimeZone || measurementsTimeZone || transactionsTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const currentTime =
    statsCurrentTime || measurementsCurrentTime || transactionsCurrentTime || new Date();
  const lastUpdated = [statsUpdated, measurementsUpdated, transactionsUpdated].reduce<Date | null>((latest, current) => {
    if (!current) return latest;
    if (!latest || current > latest) return current;
    return latest;
  }, null);
  const formatDateTime = (date: Date | null) =>
    date
      ? new Intl.DateTimeFormat('es-ES', {
          dateStyle: 'short',
          timeStyle: 'short',
          timeZone
        }).format(date)
      : 'Nunca';

  const handleRefresh = () => {
    refetchStats();
    refetchMeasurements();
    refetchTransactions();
  };

  if (statsLoading && measurementsLoading && transactionsLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100">Panel de Control</h2>
          <p className="text-sm text-zinc-400">Datos más recientes del backend y la blockchain</p>
        </div>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 px-3 py-2 rounded bg-zinc-700 text-zinc-100 hover:bg-zinc-600 disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={isBusy}
        >
          <RefreshCw className="w-4 h-4" />
          {isBusy ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>
      <p className="text-sm text-zinc-400">
        Última actualización: <span className="text-zinc-200">{formatDateTime(lastUpdated)}</span> · Hora actual:{' '}
        <span className="text-zinc-200">{formatDateTime(currentTime)}</span> ({timeZone})
      </p>

      {/* Stats Grid */}
      {statsError && <ErrorAlert message={statsError} />}

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Mediciones Totales"
            value={stats.measurements.total}
            subtitle={`${stats.measurements.verified} verificadas`}
            icon={CheckCircle}
            color="green"
          />
          <StatsCard
            title="Sensores Activos"
            value={stats.sensors.active}
            subtitle={`${stats.sensors.total} total`}
            icon={Cpu}
            color="blue"
          />
          <StatsCard
            title="Tx Pendientes"
            value={stats.transactions.pending}
            subtitle={`${stats.transactions.retrying} reintentando`}
            icon={Clock}
            color="yellow"
          />
          <StatsCard
            title="Tx Confirmadas"
            value={stats.transactions.confirmed}
            subtitle={`${stats.transactions.failed} fallidas`}
            icon={Link}
            color={stats.transactions.confirmed > 0 ? 'green' : 'red'}
          />
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Measurements */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-zinc-100 mb-4">Últimas Mediciones</h3>
          {measurementsError && <ErrorAlert message={measurementsError} />}
          {measurements && measurements.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-4">No hay mediciones</p>
          )}
          <div className="space-y-3">
            {measurements?.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 bg-zinc-900 rounded border border-zinc-700">
                <div className="flex items-center gap-3">
                  {m.verified ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{m.sensor_id}</p>
                    <p className="text-xs text-zinc-400">
                      {m.temperature && m.humidity
                        ? `${m.temperature / 10}°C, ${m.humidity / 10}%`
                        : 'Sin datos'}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-zinc-500">
                  {new Date(m.received_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-zinc-100 mb-4">Últimas Transacciones</h3>
          {transactionsError && <ErrorAlert message={transactionsError} />}
          {transactions && transactions.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-4">No hay transacciones</p>
          )}
          <div className="space-y-3">
            {transactions?.map((tx) => {
              const statusColors = {
                PENDING: 'text-yellow-400 bg-yellow-500/10',
                CONFIRMED: 'text-green-400 bg-green-500/10',
                FAILED: 'text-red-400 bg-red-500/10',
                RETRYING: 'text-orange-400 bg-orange-500/10',
              };

              return (
                <div key={tx.id} className="flex items-center justify-between p-3 bg-zinc-900 rounded border border-zinc-700">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[tx.status]}`}>
                      {tx.type}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{tx.sensor_id}</p>
                      <p className="text-xs text-zinc-400">{tx.status}</p>
                    </div>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {new Date(tx.submitted_at).toLocaleTimeString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
