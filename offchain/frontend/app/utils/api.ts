const DEFAULT_API_URL = process.env.NODE_ENV === 'production' ? '/iot' : 'http://localhost:3001';

export const API_ACCESS_TOKEN = process.env.NEXT_PUBLIC_ACCESS_TOKEN || 'gaelito2025';

export function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  const isBrowser = typeof window !== 'undefined';

  // When running on the public domain, prefer same-origin to avoid mixed content or localhost leaks
  if (isBrowser) {
    const isLocalhost =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (!isLocalhost) {
      if (envUrl && !envUrl.includes('localhost')) {
        return envUrl;
      }
      return `${window.location.origin}/iot`;
    }
  }

  return envUrl || DEFAULT_API_URL;
}
