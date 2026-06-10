import type { CloudflareTrafficCountry } from "@emergence-devops/shared";
import { useCallback, useEffect, useState } from "react";
import { fetchCloudflareTraffic } from "../lib/cloudflare-traffic";

const REFRESH_INTERVAL_MS = 3_600_000;

export function useCloudflareTraffic() {
  const [countries, setCountries] = useState<CloudflareTrafficCountry[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetchCloudflareTraffic();
      setCountries(response.countries);
      setDate(response.date);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load traffic");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [load]);

  return { countries, date, isLoading, error, refresh: load };
}
