import { useState, useEffect, useCallback } from 'react';
import { getApiBaseUrl, API_ACCESS_TOKEN } from '../utils/api';

const API_URL = getApiBaseUrl();
const ACCESS_TOKEN = API_ACCESS_TOKEN;

export function useFetchData<T>(endpoint: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const url = `${API_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}token=${ACCESS_TOKEN}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      setData(json);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMsg);
    } finally {
      if (isManual) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [endpoint]);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  return {
    data,
    loading,
    refreshing,
    error,
    lastUpdated,
    currentTime,
    timeZone,
    refetch: () => fetchData(true)
  };
}
