'use client';

import { Cpu, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useFetchData } from '../../hooks/useFetchData';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { ErrorAlert } from '../shared/ErrorAlert';
import { EmptyState } from '../shared/EmptyState';
import { TimeInfo } from '../shared/TimeInfo';
import type { Sensor } from '../types';
import { formatDateTime } from '@/app/utils/format';

export function SensorListView() {
  const {
    data: sensors,
    loading,
    refreshing,
    error,
    lastUpdated,
    refetch
  } = useFetchData<Sensor[]>('/api/sensors');

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} />;
  if (!sensors || sensors.length === 0) return <EmptyState message="No active sensors" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100">Active Sensors</h2>
          <p className="text-sm text-zinc-400">Configuration stored in the backend</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-400">{sensors.length} sensors</span>
          <button
            onClick={refetch}
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-zinc-700 text-zinc-100 hover:bg-zinc-600 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={refreshing}
          >
            <RefreshCw className="w-4 h-4" />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>
      <TimeInfo lastUpdated={lastUpdated} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sensors.map((sensor) => (
          <div key={sensor.id} className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Cpu className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100">{sensor.sensor_id}</h3>
                  {sensor.name && <p className="text-sm text-zinc-400">{sensor.name}</p>}
                </div>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                sensor.is_active
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-zinc-700 text-zinc-400'
              }`}>
                {sensor.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-zinc-400 mb-1">NFT</p>
                <p className="font-mono text-xs text-zinc-300 truncate">
                  {sensor.nft_policy_id && sensor.nft_asset_name
                    ? `${sensor.nft_policy_id.substring(0, 16)}...`
                    : 'Not configured'}
                </p>
              </div>

              {sensor.latest_measurement && (
                <div className="pt-3 border-t border-zinc-700">
                  <p className="text-zinc-400 mb-2">Latest Measurement</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {sensor.latest_measurement.verified ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                      <span className="text-zinc-300">
                        {sensor.latest_measurement.temperature && sensor.latest_measurement.humidity
                          ? `${sensor.latest_measurement.temperature / 10}°C, ${sensor.latest_measurement.humidity / 10}%`
                          : 'No data'}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-500">
                      {formatDateTime(sensor.latest_measurement.received_at)}
                    </span>
                  </div>
                </div>
              )}

              {sensor._count && (
                <div className="pt-3 border-t border-zinc-700 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-zinc-400">Measurements</p>
                    <p className="text-xl font-semibold text-zinc-100">{sensor._count.measurements}</p>
                  </div>
                  <div>
                    <p className="text-zinc-400">Transactions</p>
                    <p className="text-xl font-semibold text-zinc-100">{sensor._count.oracle_transactions}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
