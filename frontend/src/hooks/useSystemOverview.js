import { useCallback, useEffect, useState } from 'react';

import { fetchBackendVersion, fetchSystemOverview } from '../lib/api';

const emptyOverview = {
  backend: null,
  counts: null,
  backup: null,
  data_quality: null,
};

export function useSystemOverview(isLoggedIn) {
  const [overview, setOverview] = useState(emptyOverview);
  const [version, setVersion] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState('');

  const refreshOverview = useCallback(async () => {
    if (!isLoggedIn) {
      setOverview(emptyOverview);
      setVersion(null);
      return;
    }

    setIsLoading(true);
    try {
      const [versionResponse, overviewResponse] = await Promise.all([
        fetchBackendVersion(),
        fetchSystemOverview(),
      ]);

      if (versionResponse.ok) {
        const versionPayload = await versionResponse.json().catch(() => null);
        setVersion(versionPayload?.backend || null);
      }

      if (overviewResponse.ok) {
        const overviewPayload = await overviewResponse.json().catch(() => emptyOverview);
        setOverview({
          backend: overviewPayload?.backend || null,
          counts: overviewPayload?.counts || null,
          backup: overviewPayload?.backup || null,
          data_quality: overviewPayload?.data_quality || null,
        });
      }

      setLastRefreshedAt(new Date().toISOString());
    } finally {
      setIsLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    refreshOverview();
  }, [refreshOverview]);

  return {
    overview,
    version,
    isLoading,
    lastRefreshedAt,
    refreshOverview,
  };
}
