'use client';

import { ExternalLink, Copy, RefreshCw } from 'lucide-react';
import { useFetchData } from '../../hooks/useFetchData';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { ErrorAlert } from '../shared/ErrorAlert';
import { EmptyState } from '../shared/EmptyState';
import { StatusBadge } from './StatusBadge';
import { TimeInfo } from '../shared/TimeInfo';
import type { OracleTransaction } from '../types';

const EXPLORER_URL = 'https://preprod.cardanoscan.io';

export function TransactionHistoryView() {
  const {
    data: transactions,
    loading,
    refreshing,
    error,
    lastUpdated,
    refetch
  } = useFetchData<OracleTransaction[]>('/api/transactions?limit=20');

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} />;
  if (!transactions || transactions.length === 0) return <EmptyState message="No hay transacciones blockchain" />;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100">Historial de Transacciones</h2>
          <p className="text-sm text-zinc-400">Últimas operaciones enviadas a Cardano</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-400">{transactions.length} transacciones</span>
          <button
            onClick={refetch}
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-zinc-700 text-zinc-100 hover:bg-zinc-600 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={refreshing}
          >
            <RefreshCw className="w-4 h-4" />
            {refreshing ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </div>
      <TimeInfo lastUpdated={lastUpdated} />

      <div className="bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-900 border-b border-zinc-700">
              <tr className="text-left text-xs text-zinc-400">
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Sensor</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">TX Hash</th>
                <th className="px-4 py-3">Block</th>
                <th className="px-4 py-3">Enviada</th>
                <th className="px-4 py-3">Confirmada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-700">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-zinc-900/50">
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-zinc-300">{tx.type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-zinc-300">{tx.sensor_id}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={tx.status} />
                  </td>
                  <td className="px-4 py-3">
                    {tx.tx_hash ? (
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-zinc-400 font-mono">
                          {tx.tx_hash.substring(0, 12)}...
                        </code>
                        <button
                          onClick={() => copyToClipboard(tx.tx_hash!)}
                          className="p-1 hover:bg-zinc-700 rounded"
                          title="Copiar"
                        >
                          <Copy className="w-3 h-3 text-zinc-400" />
                        </button>
                        <a
                          href={`${EXPLORER_URL}/transaction/${tx.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:bg-zinc-700 rounded"
                          title="Ver en explorer"
                        >
                          <ExternalLink className="w-3 h-3 text-blue-400" />
                        </a>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {tx.block_height ? (
                      <span className="text-sm text-zinc-400">{tx.block_height}</span>
                    ) : (
                      <span className="text-xs text-zinc-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-zinc-400">
                      {new Date(tx.submitted_at).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {tx.confirmed_at ? (
                      <span className="text-xs text-zinc-400">
                        {new Date(tx.confirmed_at).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-500">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
