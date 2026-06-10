export type ReachabilityProbe = {
  id: string;
  label: string;
  awsRegion: string;
  lat: number;
  lng: number;
  latencyMs: number | null;
  measuredAt: string | null;
};

export type ReachabilityLatencyResponse = {
  probes: ReachabilityProbe[];
  fetchedAt: string;
  cacheExpiresAt: string;
};
