'use client';

import { CheckCircle, XCircle, Send, Anchor, ArrowRight, RefreshCw } from 'lucide-react';
import { useFetchData } from '../../hooks/useFetchData';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { ErrorAlert } from '../shared/ErrorAlert';
import { EmptyState } from '../shared/EmptyState';
import { TimeInfo } from '../shared/TimeInfo';
import type { Measurement } from '../types';
import { formatDateTime, formatTime } from '@/app/utils/format';

export function MeasurementTimelineView() {
  const {
    data: measurements,
    loading,
    refreshing,
    error,
    lastUpdated,
    refetch
  } = useFetchData<Measurement[]>('/api/measurements?limit=20');

  if (loading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-zinc-400">Loading measurements from the backend...</p>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <ErrorAlert message={error} />
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
          <p className="text-sm text-zinc-400 mb-2">Debug info:</p>
          <p className="text-xs font-mono text-zinc-500">
            Check the browser console (F12) for more details.
          </p>
          <p className="text-xs font-mono text-zinc-500 mt-2">
            API URL: {process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? '/iot' : 'http://localhost:3001')}
          </p>
        </div>
      </div>
    );
  }

  if (!measurements || measurements.length === 0) return <EmptyState message="No measurements available" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-100">Measurement Timeline</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-400">{measurements.length} measurements</span>
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

      <div className="space-y-4">
        {measurements.map((measurement) => {
          const hasTransaction = !!measurement.oracle_transaction_id;
          const isConfirmed = measurement.oracle_transaction?.status === 'CONFIRMED';

          return (
            <div key={measurement.id} className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100">{measurement.sensor_id}</h3>
                  <p className="text-sm text-zinc-400">{formatDateTime(measurement.received_at)}</p>
                </div>
                {measurement.temperature && measurement.humidity && (
                  <div className="text-right">
                    <p className="text-sm text-zinc-400">Temperature / Humidity</p>
                    <p className="text-lg font-semibold text-zinc-100">
                      {measurement.temperature / 10}°C / {measurement.humidity / 10}%
                    </p>
                  </div>
                )}
              </div>

              {/* Status Flow */}
              <div className="flex items-center gap-3 mb-4 p-4 bg-zinc-900 rounded-lg overflow-x-auto">
                {/* Received */}
                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-xs text-zinc-400">Received</span>
                  <span className="text-xs text-zinc-500">{formatTime(measurement.received_at)}</span>
                </div>

                <ArrowRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />

                {/* Verified */}
                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                  {measurement.verified ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400" />
                  )}
                  <span className="text-xs text-zinc-400">Verified</span>
                  <span className={`text-xs ${measurement.verified ? 'text-green-400' : 'text-red-400'}`}>
                    {measurement.verified ? 'Valid' : 'Invalid'}
                  </span>
                </div>

                <ArrowRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />

                {/* Submitted */}
                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                  {hasTransaction ? (
                    <Send className="w-5 h-5 text-blue-400" />
                  ) : (
                    <Send className="w-5 h-5 text-zinc-600" />
                  )}
                  <span className="text-xs text-zinc-400">Submitted</span>
                  <span className={`text-xs ${hasTransaction ? 'text-blue-400' : 'text-zinc-600'}`}>
                    {hasTransaction ? 'Yes' : 'No'}
                  </span>
                </div>

                <ArrowRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />

                {/* Confirmed */}
                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                  {isConfirmed ? (
                    <Anchor className="w-5 h-5 text-green-400" />
                  ) : (
                    <Anchor className="w-5 h-5 text-zinc-600" />
                  )}
                  <span className="text-xs text-zinc-400">Confirmed</span>
                  <span className={`text-xs ${isConfirmed ? 'text-green-400' : 'text-zinc-600'}`}>
                    {isConfirmed ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-zinc-400 mb-1">Hash</p>
                  <code className="text-xs font-mono text-zinc-300 break-all">
                    {measurement.hash.substring(0, 32)}...
                  </code>
                </div>
                <div>
                  <p className="text-zinc-400 mb-1">Signature</p>
                  <code className="text-xs font-mono text-zinc-300 break-all">
                    {measurement.signature.substring(0, 32)}...
                  </code>
                </div>
              </div>

              {/* Transaction Info */}
              {measurement.oracle_transaction && (
                <div className="mt-4 pt-4 border-t border-zinc-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-zinc-400">Blockchain Transaction</p>
                      <p className="text-sm font-medium text-zinc-100">
                        {measurement.oracle_transaction.type} - {measurement.oracle_transaction.status}
                      </p>
                    </div>
                    {measurement.oracle_transaction.tx_hash && (
                      <a
                        href={`https://preprod.cardanoscan.io/transaction/${measurement.oracle_transaction.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:underline"
                      >
                        View in Explorer →
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Verification Error */}
              {measurement.verification_error && (
                <div className="mt-4 p-3 bg-red-950/30 border border-red-700 rounded text-sm text-red-400">
                  <p className="font-medium">Verification error:</p>
                  <p className="text-xs mt-1">{measurement.verification_error}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
