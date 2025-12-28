"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, RefreshCw, Cpu, Hash, Key } from "lucide-react";

interface Measurement {
  sensor_id: string;
  hash: string;
  signature: string;
  publicKey: string;
  verified?: boolean;
}

export default function Home() {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const ACCESS_TOKEN = process.env.NEXT_PUBLIC_ACCESS_TOKEN || 'gaelito2025';

  const fetchMeasurements = async () => {
    try {
      const res = await fetch(`${API_URL}/api/measurements?token=${ACCESS_TOKEN}`);
      if (!res.ok) throw new Error("Error fetching data");
      const data = await res.json();
      // All measurements that reach the frontend are verified (backend rejects invalid)
      setMeasurements(data.map((m: Measurement) => ({ ...m, verified: true })));
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeasurements();
    const interval = setInterval(fetchMeasurements, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  const truncate = (str: string, len: number = 16) =>
    str.length > len ? str.substring(0, len) + "..." : str;

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 p-8">
      <header className="max-w-4xl mx-auto mb-8">
        <h1 className="text-3xl font-bold mb-2">ESP32 IoT Dashboard</h1>
        <p className="text-zinc-400">
          Monitoreo de firmas ECDSA verificadas
        </p>
        <div className="flex items-center gap-4 mt-4">
          <button
            onClick={fetchMeasurements}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
          {lastUpdate && (
            <span className="text-sm text-zinc-500">
              Última actualización: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto">
        {loading && (
          <div className="text-center py-12 text-zinc-400">Cargando...</div>
        )}

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-4">
            <p className="text-red-300">{error}</p>
            <p className="text-sm text-red-400 mt-1">
              Asegúrate de que el backend esté corriendo en puerto 3001
            </p>
          </div>
        )}

        {!loading && measurements.length === 0 && !error && (
          <div className="text-center py-12 text-zinc-400">
            No hay mediciones registradas. Envía datos usando ./test_signatures.sh
          </div>
        )}

        <div className="space-y-4">
          {measurements.map((m, idx) => (
            <div
              key={idx}
              className="bg-zinc-800 border border-zinc-700 rounded-lg p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Cpu className="w-6 h-6 text-blue-400" />
                  <div>
                    <h3 className="font-semibold">{m.sensor_id}</h3>
                    <p className="text-sm text-zinc-400">Sensor ID</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {m.verified ? (
                    <>
                      <CheckCircle className="w-6 h-6 text-green-400" />
                      <span className="text-green-400 font-medium">
                        Verificado
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-6 h-6 text-red-400" />
                      <span className="text-red-400 font-medium">
                        No Verificado
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="grid gap-3 text-sm">
                <div className="flex items-start gap-2">
                  <Hash className="w-4 h-4 text-zinc-500 mt-0.5" />
                  <div>
                    <p className="text-zinc-400">Hash</p>
                    <p className="font-mono text-xs break-all">{m.hash}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Key className="w-4 h-4 text-zinc-500 mt-0.5" />
                  <div>
                    <p className="text-zinc-400">Signature</p>
                    <p className="font-mono text-xs break-all">
                      {truncate(m.signature, 64)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Key className="w-4 h-4 text-zinc-500 mt-0.5" />
                  <div>
                    <p className="text-zinc-400">Public Key</p>
                    <p className="font-mono text-xs break-all">
                      {truncate(m.publicKey, 64)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {measurements.length > 0 && (
          <div className="mt-6 text-center text-sm text-zinc-500">
            Total: {measurements.length} mediciones verificadas
          </div>
        )}
      </main>
    </div>
  );
}
