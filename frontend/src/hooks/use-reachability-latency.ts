import type { ReachabilityProbe } from "@emergence-devops/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchReachabilityLatency } from "../lib/reachability-latency";

const REFRESH_INTERVAL_MS = 3_600_000;

export function useReachabilityLatency() {
  const [probes, setProbes] = useState<ReachabilityProbe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetchReachabilityLatency();
      setProbes(response.probes);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load reachability");
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

  const probesById = useMemo(
    () => new Map(probes.map((probe) => [probe.id, probe])),
    [probes]
  );

  return { probes, probesById, isLoading, error, refresh: load };
}
