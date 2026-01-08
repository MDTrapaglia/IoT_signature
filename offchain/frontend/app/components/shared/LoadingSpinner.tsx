import { RefreshCw } from 'lucide-react';

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <RefreshCw className="w-8 h-8 text-zinc-400 animate-spin" />
    </div>
  );
}
