import { useState, useEffect, useCallback } from 'react';
import { getApiBaseUrl, API_ACCESS_TOKEN } from '../utils/api';

const API_URL = getApiBaseUrl();
const ACCESS_TOKEN = API_ACCESS_TOKEN;

export function usePollData<T>(endpoint: string, interval: number = 5000) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const url = `${API_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}token=${ACCESS_TOKEN}`;
      console.log(`[usePollData] Fetching: ${url}`);
      const res = await fetch(url);

      if (!res.ok) {
        console.error(`[usePollData] HTTP Error: ${res.status} ${res.statusText}`);
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      console.log(`[usePollData] Success:`, json);
      setData(json);
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      console.error('[usePollData] Error fetching data:', err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, interval);
    return () => clearInterval(id);
  }, [fetchData, interval]);

  return { data, loading, error, refetch: fetchData };
}
