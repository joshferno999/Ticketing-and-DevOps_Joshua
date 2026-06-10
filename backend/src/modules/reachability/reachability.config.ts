export type ReachabilityProbeConfig = {
  id: string;
  label: string;
  awsRegion: string;
  lat: number;
  lng: number;
};

export const REACHABILITY_PROBES: ReachabilityProbeConfig[] = [
  { id: "n-california", label: "N. California", awsRegion: "us-west-1", lat: 37.39, lng: -121.95 },
  { id: "oregon", label: "Oregon", awsRegion: "us-west-2", lat: 45.52, lng: -122.68 },
  { id: "n-virginia", label: "N. Virginia", awsRegion: "us-east-1", lat: 38.75, lng: -77.47 },
  { id: "ireland", label: "Ireland", awsRegion: "eu-west-1", lat: 53.35, lng: -6.26 },
  { id: "sao-paulo", label: "São Paulo", awsRegion: "sa-east-1", lat: -23.55, lng: -46.63 },
  { id: "singapore", label: "Singapore", awsRegion: "ap-southeast-1", lat: 1.35, lng: 103.82 },
  { id: "sydney", label: "Sydney", awsRegion: "ap-southeast-2", lat: -33.87, lng: 151.21 },
  { id: "tokyo", label: "Tokyo", awsRegion: "ap-northeast-1", lat: 35.68, lng: 139.69 }
];
