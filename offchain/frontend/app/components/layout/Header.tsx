import { Cpu } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b border-zinc-700 bg-zinc-800/50">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center gap-3">
          <Cpu className="w-8 h-8 text-blue-400" />
          <div>
            <h1 className="text-xl font-bold text-zinc-100">ESP32 IoT Dashboard</h1>
            <p className="text-sm text-zinc-400">Sensor data with blockchain certification</p>
          </div>
        </div>
      </div>
    </header>
  );
}
