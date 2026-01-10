'use client';

import { CheckCircle, XCircle, Send, Anchor, ArrowRight } from 'lucide-react';
import { usePollData } from '../../hooks/usePollData';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { ErrorAlert } from '../shared/ErrorAlert';
import { EmptyState } from '../shared/EmptyState';
import type { Measurement } from '../types';

export function MeasurementTimelineView() {
  const { data: measurements, loading, error } = usePollData<Measurement[]>('/api/measurements?limit=20', 5000);

  if (loading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-zinc-400">Cargando mediciones desde el backend...</p>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <ErrorAlert message={error} />
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
          <p className="text-sm text-zinc-400 mb-2">Información de debug:</p>
          <p className="text-xs font-mono text-zinc-500">
            Verifica la consola del navegador (F12) para más detalles.
          </p>
          <p className="text-xs font-mono text-zinc-500 mt-2">
            API URL: {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}
          </p>
        </div>
      </div>
    );
  }

  if (!measurements || measurements.length === 0) return <EmptyState message="No hay mediciones" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-100">Timeline de Mediciones</h2>
        <span className="text-sm text-zinc-400">{measurements.length} mediciones</span>
      </div>

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
                  <p className="text-sm text-zinc-400">
                    {new Date(measurement.received_at).toLocaleString()}
                  </p>
                </div>
                {measurement.temperature && measurement.humidity && (
                  <div className="text-right">
                    <p className="text-sm text-zinc-400">Temperatura / Humedad</p>
                    <p className="text-lg font-semibold text-zinc-100">
                      {measurement.temperature / 10}°C / {measurement.humidity / 10}%
                    </p>
                  </div>
                )}
              </div>

              {/* Status Flow */}
              <div className="flex items-center gap-3 mb-4 p-4 bg-zinc-900 rounded-lg overflow-x-auto">
                {/* Recibido */}
                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-xs text-zinc-400">Recibido</span>
                  <span className="text-xs text-zinc-500">
                    {new Date(measurement.received_at).toLocaleTimeString()}
                  </span>
                </div>

                <ArrowRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />

                {/* Verificado */}
                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                  {measurement.verified ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400" />
                  )}
                  <span className="text-xs text-zinc-400">Verificado</span>
                  <span className={`text-xs ${measurement.verified ? 'text-green-400' : 'text-red-400'}`}>
                    {measurement.verified ? 'Válido' : 'Inválido'}
                  </span>
                </div>

                <ArrowRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />

                {/* Enviado */}
                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                  {hasTransaction ? (
                    <Send className="w-5 h-5 text-blue-400" />
                  ) : (
                    <Send className="w-5 h-5 text-zinc-600" />
                  )}
                  <span className="text-xs text-zinc-400">Enviado</span>
                  <span className={`text-xs ${hasTransaction ? 'text-blue-400' : 'text-zinc-600'}`}>
                    {hasTransaction ? 'Sí' : 'No'}
                  </span>
                </div>

                <ArrowRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />

                {/* Confirmado */}
                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                  {isConfirmed ? (
                    <Anchor className="w-5 h-5 text-green-400" />
                  ) : (
                    <Anchor className="w-5 h-5 text-zinc-600" />
                  )}
                  <span className="text-xs text-zinc-400">Confirmado</span>
                  <span className={`text-xs ${isConfirmed ? 'text-green-400' : 'text-zinc-600'}`}>
                    {isConfirmed ? 'Sí' : 'No'}
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
                      <p className="text-sm text-zinc-400">Transacción Blockchain</p>
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
                        Ver en Explorer →
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Verification Error */}
              {measurement.verification_error && (
                <div className="mt-4 p-3 bg-red-950/30 border border-red-700 rounded text-sm text-red-400">
                  <p className="font-medium">Error de verificación:</p>
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
