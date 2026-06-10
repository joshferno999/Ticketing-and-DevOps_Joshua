export type CloudflareTrafficCountry = {
  countryCode: string;
  countryName: string;
  count: number;
  lat: number;
  lng: number;
  altitude: number;
};

export type CloudflareTrafficResponse = {
  countries: CloudflareTrafficCountry[];
  fetchedAt: string;
  cacheExpiresAt: string;
  date: string;
};
