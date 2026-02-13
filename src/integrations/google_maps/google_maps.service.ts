import axios from 'axios';
import { getApiKey } from '../../services/api.key.service';
import { TestConnectionResult } from '../../services/integration-config.service';

const PLACES_API_BASE = 'https://places.googleapis.com/v1';
const ROUTES_API_BASE = 'https://routes.googleapis.com';
const GEOCODING_API_BASE = 'https://maps.googleapis.com/maps/api/geocode';
const TIMEZONE_API_BASE = 'https://maps.googleapis.com/maps/api/timezone';
const DISTANCE_MATRIX_API_BASE = 'https://maps.googleapis.com/maps/api/distancematrix';
const STATIC_MAP_BASE = 'https://maps.googleapis.com/maps/api/staticmap';
const STREET_VIEW_BASE = 'https://maps.googleapis.com/maps/api/streetview';

export async function getGoogleMapsApiKey(companyId: string): Promise<string> {
  const key = await getApiKey(companyId, 'google_maps_api_key');
  if (!key) {
    throw new Error('Google Maps API key is not configured. Please set it in integration settings.');
  }
  return key;
}

// ── Places API (New) ──────────────────────────────────────────

export async function placesTextSearch(
  companyId: string,
  textQuery: string,
  fieldMask: string,
  opts?: { maxResultCount?: number; languageCode?: string; includedType?: string },
): Promise<any> {
  const apiKey = await getGoogleMapsApiKey(companyId);
  const body: Record<string, any> = { textQuery };
  if (opts?.maxResultCount) body.maxResultCount = opts.maxResultCount;
  if (opts?.languageCode) body.languageCode = opts.languageCode;
  if (opts?.includedType) body.includedType = opts.includedType;

  const response = await axios.post(`${PLACES_API_BASE}/places:searchText`, body, {
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
    timeout: 15000,
  });
  return response.data;
}

export async function getPlaceDetails(
  companyId: string,
  placeId: string,
  fieldMask: string,
  languageCode?: string,
): Promise<any> {
  const apiKey = await getGoogleMapsApiKey(companyId);
  const params: Record<string, string> = { languageCode: languageCode || 'en' };

  const response = await axios.get(`${PLACES_API_BASE}/places/${placeId}`, {
    params,
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
    timeout: 15000,
  });
  return response.data;
}

export async function getPlacePhoto(
  companyId: string,
  photoName: string,
  maxWidthPx: number = 800,
): Promise<string> {
  const apiKey = await getGoogleMapsApiKey(companyId);
  // Returns the photo media URI directly
  const response = await axios.get(
    `${PLACES_API_BASE}/${photoName}/media`,
    {
      params: { key: apiKey, maxWidthPx, skipHttpRedirect: true },
      timeout: 15000,
    },
  );
  return response.data.photoUri;
}

export async function searchNearby(
  companyId: string,
  lat: number,
  lng: number,
  radius: number,
  includedTypes: string[],
  fieldMask: string,
  maxResultCount?: number,
): Promise<any> {
  const apiKey = await getGoogleMapsApiKey(companyId);
  const body: Record<string, any> = {
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius,
      },
    },
    includedTypes,
  };
  if (maxResultCount) body.maxResultCount = maxResultCount;

  const response = await axios.post(`${PLACES_API_BASE}/places:searchNearby`, body, {
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
    timeout: 15000,
  });
  return response.data;
}

// ── Routes API ────────────────────────────────────────────────

export async function computeRoutes(
  companyId: string,
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  travelMode: string,
): Promise<any> {
  const apiKey = await getGoogleMapsApiKey(companyId);
  const body = {
    origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
    destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
    travelMode,
  };

  const response = await axios.post(`${ROUTES_API_BASE}/directions/v2:computeRoutes`, body, {
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.description,routes.legs.distanceMeters,routes.legs.duration,routes.legs.startLocation,routes.legs.endLocation,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.navigationInstruction,routes.legs.steps.travelMode',
    },
    timeout: 15000,
  });
  return response.data;
}

// ── Geocoding API ─────────────────────────────────────────────

export async function geocode(companyId: string, address: string): Promise<any> {
  const apiKey = await getGoogleMapsApiKey(companyId);
  const response = await axios.get(`${GEOCODING_API_BASE}/json`, {
    params: { address, key: apiKey },
    timeout: 10000,
  });
  return response.data;
}

export async function reverseGeocode(companyId: string, lat: number, lng: number): Promise<any> {
  const apiKey = await getGoogleMapsApiKey(companyId);
  const response = await axios.get(`${GEOCODING_API_BASE}/json`, {
    params: { latlng: `${lat},${lng}`, key: apiKey },
    timeout: 10000,
  });
  return response.data;
}

// ── Timezone API ──────────────────────────────────────────────

export async function getTimezone(
  companyId: string,
  lat: number,
  lng: number,
  timestamp?: number,
): Promise<any> {
  const apiKey = await getGoogleMapsApiKey(companyId);
  const response = await axios.get(`${TIMEZONE_API_BASE}/json`, {
    params: {
      location: `${lat},${lng}`,
      timestamp: timestamp || Math.floor(Date.now() / 1000),
      key: apiKey,
    },
    timeout: 10000,
  });
  return response.data;
}

// ── Distance Matrix API ───────────────────────────────────────

export async function getDistanceMatrix(
  companyId: string,
  origins: string[],
  destinations: string[],
  mode: string,
): Promise<any> {
  const apiKey = await getGoogleMapsApiKey(companyId);
  const response = await axios.get(`${DISTANCE_MATRIX_API_BASE}/json`, {
    params: {
      origins: origins.join('|'),
      destinations: destinations.join('|'),
      mode,
      key: apiKey,
    },
    timeout: 15000,
  });
  return response.data;
}

// ── Static Map / Street View URL builders ─────────────────────

export function buildStaticMapUrl(
  apiKey: string,
  center: string,
  zoom: number,
  size: string,
  markers?: string[],
  mapType?: string,
): string {
  const params = new URLSearchParams({
    center,
    zoom: String(zoom),
    size,
    key: apiKey,
  });
  if (mapType) params.set('maptype', mapType);
  if (markers) {
    for (const m of markers) {
      params.append('markers', m);
    }
  }
  return `${STATIC_MAP_BASE}?${params.toString()}`;
}

export function buildStreetViewUrl(
  apiKey: string,
  location: string,
  size: string,
  heading?: number,
  pitch?: number,
  fov?: number,
): string {
  const params = new URLSearchParams({
    location,
    size,
    key: apiKey,
  });
  if (heading !== undefined) params.set('heading', String(heading));
  if (pitch !== undefined) params.set('pitch', String(pitch));
  if (fov !== undefined) params.set('fov', String(fov));
  return `${STREET_VIEW_BASE}?${params.toString()}`;
}

// ── Connection validation ─────────────────────────────────────

export async function validateConnection(
  apiKeys: Record<string, string>,
): Promise<TestConnectionResult> {
  const apiKey = apiKeys.google_maps_api_key;
  if (!apiKey) {
    return { success: false, error: 'Google Maps API key is not configured' };
  }

  try {
    const response = await axios.post(
      `${PLACES_API_BASE}/places:searchText`,
      { textQuery: 'Eiffel Tower', maxResultCount: 1 },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.displayName',
        },
        timeout: 10000,
      },
    );
    if (response.status === 200 && response.data.places?.length) {
      return { success: true, message: 'Connected to Google Maps Platform' };
    }
    return { success: false, error: 'Unexpected response from Places API' };
  } catch (error: any) {
    if (error.response?.status === 403) {
      return { success: false, error: 'API key is invalid or Places API is not enabled' };
    }
    return { success: false, error: error.message || 'Connection failed' };
  }
}
