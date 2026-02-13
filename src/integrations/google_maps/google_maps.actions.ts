import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import { executeAction } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';
import {
  placesTextSearch,
  getPlaceDetails as getPlaceDetailsSvc,
  getPlacePhoto,
  searchNearby as searchNearbySvc,
  computeRoutes,
  geocode,
  reverseGeocode as reverseGeocodeSvc,
  getGoogleMapsApiKey,
  buildStaticMapUrl,
  buildStreetViewUrl,
  getTimezone as getTimezoneSvc,
  getDistanceMatrix,
  validateConnection,
} from './google_maps.service';

export { validateConnection };

// Lean field mask for search results — includes photos for auto-resolving first image URL per place
const DEFAULT_SEARCH_FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.types,places.websiteUri,places.nationalPhoneNumber,places.currentOpeningHours.openNow,places.location,places.photos';

// Richer field mask when user explicitly wants more detail
const RICH_FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.primaryType,places.editorialSummary,places.regularOpeningHours,places.priceLevel,places.photos,places.websiteUri,places.googleMapsUri';

// ── Response trimming helpers ────────────────────────────────────

/** Trim a single place object: keep first photo name for URL resolution, shorten editorial, drop verbose nested data */
function trimPlaceForSearch(place: any): any {
  if (!place) return place;
  const trimmed = { ...place };

  // Keep first photo name for URL resolution, drop the rest
  if (trimmed.photos && Array.isArray(trimmed.photos) && trimmed.photos.length > 0) {
    trimmed._photoName = trimmed.photos[0].name;
  }
  delete trimmed.photos;

  // Shorten editorialSummary to 200 chars max
  if (trimmed.editorialSummary?.text && trimmed.editorialSummary.text.length > 200) {
    trimmed.editorialSummary = { text: trimmed.editorialSummary.text.slice(0, 200) + '...' };
  }

  // Strip reviews (should not be in search results but just in case)
  delete trimmed.reviews;

  // Strip addressComponents
  delete trimmed.addressComponents;

  // Flatten regularOpeningHours to just weekday text if present
  if (trimmed.regularOpeningHours) {
    trimmed.openingHours = trimmed.regularOpeningHours.weekdayDescriptions || trimmed.regularOpeningHours;
    delete trimmed.regularOpeningHours;
  }

  // Flatten currentOpeningHours to just openNow boolean
  if (trimmed.currentOpeningHours) {
    trimmed.openNow = trimmed.currentOpeningHours.openNow ?? null;
    delete trimmed.currentOpeningHours;
  }

  return trimmed;
}

/** Trim place details: cap reviews at 3, strip addressComponents, trim review text */
function trimPlaceDetails(place: any): any {
  if (!place) return place;
  const trimmed = { ...place };

  // Cap reviews at 3, and trim each review text to 300 chars
  if (trimmed.reviews && Array.isArray(trimmed.reviews)) {
    trimmed.reviews = trimmed.reviews.slice(0, 3).map((r: any) => ({
      authorName: r.authorAttribution?.displayName || r.authorName,
      rating: r.rating,
      relativePublishTimeDescription: r.relativePublishTimeDescription,
      text: r.text?.text
        ? (r.text.text.length > 300 ? r.text.text.slice(0, 300) + '...' : r.text.text)
        : r.text,
    }));
  }

  // Strip addressComponents (verbose, rarely needed for travel planning)
  delete trimmed.addressComponents;

  // Replace photos array with count + first photo name (for later retrieval)
  if (trimmed.photos && Array.isArray(trimmed.photos)) {
    trimmed.photoCount = trimmed.photos.length;
    trimmed.firstPhotoName = trimmed.photos[0]?.name || null;
    delete trimmed.photos;
  }

  // Flatten regularOpeningHours to weekday text
  if (trimmed.regularOpeningHours) {
    trimmed.openingHours = trimmed.regularOpeningHours.weekdayDescriptions || null;
    delete trimmed.regularOpeningHours;
  }

  // Flatten currentOpeningHours to openNow boolean + weekday text
  if (trimmed.currentOpeningHours) {
    trimmed.openNow = trimmed.currentOpeningHours.openNow ?? null;
    if (!trimmed.openingHours && trimmed.currentOpeningHours.weekdayDescriptions) {
      trimmed.openingHours = trimmed.currentOpeningHours.weekdayDescriptions;
    }
    delete trimmed.currentOpeningHours;
  }

  // Shorten editorialSummary
  if (trimmed.editorialSummary?.text && trimmed.editorialSummary.text.length > 300) {
    trimmed.editorialSummary = { text: trimmed.editorialSummary.text.slice(0, 300) + '...' };
  }

  return trimmed;
}

/** Trim route response: strip polyline data, keep only useful navigation info */
function trimRouteResponse(route: any): any {
  if (!route) return route;
  const trimmed: any = {
    distanceMeters: route.distanceMeters,
    duration: route.duration,
    description: route.description,
  };

  if (route.legs && Array.isArray(route.legs)) {
    trimmed.legs = route.legs.map((leg: any) => ({
      distanceMeters: leg.distanceMeters,
      duration: leg.duration,
      startLocation: leg.startLocation?.latLng || leg.startLocation,
      endLocation: leg.endLocation?.latLng || leg.endLocation,
      steps: (leg.steps || []).map((step: any) => ({
        distanceMeters: step.distanceMeters,
        staticDuration: step.staticDuration,
        instruction: step.navigationInstruction?.instructions || null,
        travelMode: step.travelMode,
        // Deliberately omit: step.polyline, step.startLocation, step.endLocation (encoded geometry)
      })),
    }));
  }

  // Deliberately omit: route.polyline (encoded geometry string, very large, useless for AI)
  return trimmed;
}

export const createGoogleMapsActions = (context: ActionContext): FunctionFactory => ({

  // ── Places: Text Search ─────────────────────────────────────

  searchPlaces: {
    description: 'Search for places using a text query (e.g. "kosher restaurants in Rome", "museums near Central Park"). Returns place names, addresses, ratings, and key info. Default returns 5 lean results — use fieldMask for richer data.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (e.g. "best pizza in Naples", "hotels near Eiffel Tower")',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (1-20, default 5)',
        },
        language: {
          type: 'string',
          description: 'Language code for results (e.g. "en", "he", "fr"). Default: "en"',
        },
        type: {
          type: 'string',
          description: 'Filter by place type (e.g. "restaurant", "hotel", "museum", "tourist_attraction", "cafe")',
        },
        fieldMask: {
          type: 'string',
          description: 'Comma-separated fields to return. Default is lean (id, name, address, rating, price, types, phone, openNow, location). Use "rich" for more detail (adds photos, editorial, hours, googleMapsUri). Or specify custom comma-separated fields like "places.reviews,places.photos".',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    function: async (args: {
      query: string;
      maxResults?: number;
      language?: string;
      type?: string;
      fieldMask?: string;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      if (!args.query) throw new ActionValidationError('query is required.');
      return executeAction('searchPlaces', async () => {
        let fieldMask: string;
        if (args.fieldMask === 'rich') {
          fieldMask = RICH_FIELD_MASK;
        } else {
          fieldMask = args.fieldMask || DEFAULT_SEARCH_FIELD_MASK;
        }
        const data = await placesTextSearch(context.companyId, args.query, fieldMask, {
          maxResultCount: args.maxResults || 5,
          languageCode: args.language || 'en',
          includedType: args.type,
        });
        const places = (data.places || []).map(trimPlaceForSearch);

        // Auto-resolve first photo URL for each place (parallel, fast)
        await Promise.all(places.map(async (place: any) => {
          if (place._photoName) {
            try {
              place.photoUrl = await getPlacePhoto(context.companyId, place._photoName, 400);
            } catch {
              // Photo resolution failed — skip silently
            }
            delete place._photoName;
          }
        }));

        return { success: true, data: places, description: `Found ${places.length} places` };
      }, { serviceName: 'googleMaps' });
    },
  },

  // ── Places: Get Details ─────────────────────────────────────

  getPlaceDetails: {
    description: 'Get full details for a place by its Google Place ID. Returns name, address, rating, top 3 reviews, opening hours, phone, website, price level, and service options. Photos are summarized as count + first photo name.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        placeId: {
          type: 'string',
          description: 'Google Place ID (e.g. "ChIJD7fiBh9u5kcRYJSMaMOCCwQ")',
        },
        language: {
          type: 'string',
          description: 'Language code for results (default: "en")',
        },
        fieldMask: {
          type: 'string',
          description: 'Comma-separated fields to return. Default includes core fields + reviews + service options. Provide custom fields to override.',
        },
      },
      required: ['placeId'],
      additionalProperties: false,
    },
    function: async (args: {
      placeId: string;
      language?: string;
      fieldMask?: string;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      if (!args.placeId) throw new ActionValidationError('placeId is required.');
      return executeAction('getPlaceDetails', async () => {
        const fieldMask = args.fieldMask || 'id,displayName,formattedAddress,location,rating,userRatingCount,types,primaryType,editorialSummary,regularOpeningHours,currentOpeningHours,priceLevel,photos,websiteUri,googleMapsUri,internationalPhoneNumber,reviews,servesVegetarianFood,servesBeer,servesWine,dineIn,takeout,delivery,reservable';
        const data = await getPlaceDetailsSvc(context.companyId, args.placeId, fieldMask, args.language);
        return { success: true, data: trimPlaceDetails(data) };
      }, { serviceName: 'googleMaps' });
    },
  },

  // ── Places: Get Photos ──────────────────────────────────────

  getPlacePhotos: {
    description: 'Get photo URLs for a place. First search for a place to get photo references, then use this to get actual image URLs. Each photo includes attribution info.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        placeId: {
          type: 'string',
          description: 'Google Place ID',
        },
        maxPhotos: {
          type: 'number',
          description: 'Maximum number of photos to return (default 5, max 10)',
        },
        maxWidthPx: {
          type: 'number',
          description: 'Maximum width in pixels for photo URLs (default 800)',
        },
      },
      required: ['placeId'],
      additionalProperties: false,
    },
    function: async (args: {
      placeId: string;
      maxPhotos?: number;
      maxWidthPx?: number;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      if (!args.placeId) throw new ActionValidationError('placeId is required.');
      return executeAction('getPlacePhotos', async () => {
        // First fetch the place to get photo references
        const place = await getPlaceDetailsSvc(context.companyId, args.placeId, 'photos');
        const photos = place.photos || [];
        const maxPhotos = Math.min(args.maxPhotos || 5, 10);
        const maxWidth = args.maxWidthPx || 800;

        const photoUrls = await Promise.all(
          photos.slice(0, maxPhotos).map(async (photo: any) => {
            const url = await getPlacePhoto(context.companyId, photo.name, maxWidth);
            return {
              url,
              widthPx: photo.widthPx,
              heightPx: photo.heightPx,
              authorAttributions: photo.authorAttributions,
            };
          }),
        );
        return { success: true, data: photoUrls, description: `Got ${photoUrls.length} photos` };
      }, { serviceName: 'googleMaps' });
    },
  },

  // ── Places: Nearby Search ───────────────────────────────────

  searchNearby: {
    description: 'Search for places near a specific location (lat/lng) within a given radius. Returns lean results by default (5 places). Use fieldMask="rich" for more detail.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        latitude: {
          type: 'number',
          description: 'Latitude of the center point',
        },
        longitude: {
          type: 'number',
          description: 'Longitude of the center point',
        },
        radius: {
          type: 'number',
          description: 'Search radius in meters (max 50000)',
        },
        types: {
          type: 'array',
          items: { type: 'string' },
          description: 'Place types to include (e.g. ["restaurant", "cafe"] or ["tourist_attraction", "museum"])',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (1-20, default 5)',
        },
        fieldMask: {
          type: 'string',
          description: 'Comma-separated fields to return. Default is lean. Use "rich" for photos, editorial, hours, googleMapsUri.',
        },
      },
      required: ['latitude', 'longitude', 'radius', 'types'],
      additionalProperties: false,
    },
    function: async (args: {
      latitude: number;
      longitude: number;
      radius: number;
      types: string[];
      maxResults?: number;
      fieldMask?: string;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      return executeAction('searchNearby', async () => {
        let fieldMask: string;
        if (args.fieldMask === 'rich') {
          fieldMask = RICH_FIELD_MASK;
        } else {
          fieldMask = args.fieldMask || DEFAULT_SEARCH_FIELD_MASK;
        }
        const data = await searchNearbySvc(
          context.companyId,
          args.latitude,
          args.longitude,
          args.radius,
          args.types,
          fieldMask,
          args.maxResults || 5,
        );
        const places = (data.places || []).map(trimPlaceForSearch);

        // Auto-resolve first photo URL for each place (parallel, fast)
        await Promise.all(places.map(async (place: any) => {
          if (place._photoName) {
            try {
              place.photoUrl = await getPlacePhoto(context.companyId, place._photoName, 400);
            } catch {
              // Photo resolution failed — skip silently
            }
            delete place._photoName;
          }
        }));

        return { success: true, data: places, description: `Found ${places.length} nearby places` };
      }, { serviceName: 'googleMaps' });
    },
  },

  // ── Routes: Get Directions ──────────────────────────────────

  getDirections: {
    description: 'Get directions between two points. Returns distance, duration, and step-by-step text instructions. Polyline geometry is stripped to keep responses lean.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        originLat: {
          type: 'number',
          description: 'Origin latitude',
        },
        originLng: {
          type: 'number',
          description: 'Origin longitude',
        },
        destinationLat: {
          type: 'number',
          description: 'Destination latitude',
        },
        destinationLng: {
          type: 'number',
          description: 'Destination longitude',
        },
        travelMode: {
          type: 'string',
          enum: ['DRIVE', 'WALK', 'BICYCLE', 'TRANSIT'],
          description: 'Mode of travel (default: DRIVE)',
        },
      },
      required: ['originLat', 'originLng', 'destinationLat', 'destinationLng'],
      additionalProperties: false,
    },
    function: async (args: {
      originLat: number;
      originLng: number;
      destinationLat: number;
      destinationLng: number;
      travelMode?: string;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      return executeAction('getDirections', async () => {
        const data = await computeRoutes(
          context.companyId,
          { lat: args.originLat, lng: args.originLng },
          { lat: args.destinationLat, lng: args.destinationLng },
          args.travelMode || 'DRIVE',
        );
        const route = data.routes?.[0];
        const trimmed = route ? trimRouteResponse(route) : null;
        return {
          success: true,
          data: trimmed || data,
          description: route
            ? `Route: ${route.distanceMeters}m, ${route.duration}`
            : 'No route found',
        };
      }, { serviceName: 'googleMaps' });
    },
  },

  // ── Geocoding: Address → Coordinates ────────────────────────

  geocodeAddress: {
    description: 'Convert an address to geographic coordinates (latitude/longitude). Useful for getting coordinates to use with other Google Maps actions.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Address to geocode (e.g. "Colosseum, Rome, Italy" or "221B Baker Street, London")',
        },
      },
      required: ['address'],
      additionalProperties: false,
    },
    function: async (args: { address: string }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      if (!args.address) throw new ActionValidationError('address is required.');
      return executeAction('geocodeAddress', async () => {
        const data = await geocode(context.companyId, args.address);
        if (data.status !== 'OK' || !data.results?.length) {
          return { success: true, data: null, description: `Geocoding failed: ${data.status}` };
        }
        const result = data.results[0];
        return {
          success: true,
          data: {
            formattedAddress: result.formatted_address,
            location: result.geometry.location,
            placeId: result.place_id,
            types: result.types,
          },
          description: `Geocoded to ${result.geometry.location.lat},${result.geometry.location.lng}`,
        };
      }, { serviceName: 'googleMaps' });
    },
  },

  // ── Geocoding: Coordinates → Address ────────────────────────

  reverseGeocode: {
    description: 'Convert geographic coordinates to a human-readable address. Useful for understanding what is at a specific location.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        latitude: {
          type: 'number',
          description: 'Latitude',
        },
        longitude: {
          type: 'number',
          description: 'Longitude',
        },
      },
      required: ['latitude', 'longitude'],
      additionalProperties: false,
    },
    function: async (args: { latitude: number; longitude: number }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      return executeAction('reverseGeocode', async () => {
        const data = await reverseGeocodeSvc(context.companyId, args.latitude, args.longitude);
        if (data.status !== 'OK' || !data.results?.length) {
          return { success: true, data: null, description: `Reverse geocoding failed: ${data.status}` };
        }
        const result = data.results[0];
        return {
          success: true,
          data: {
            formattedAddress: result.formatted_address,
            placeId: result.place_id,
            types: result.types,
            addressComponents: result.address_components,
          },
          description: result.formatted_address,
        };
      }, { serviceName: 'googleMaps' });
    },
  },

  // ── Utility: Static Map ─────────────────────────────────────

  getStaticMap: {
    description: 'Generate a static map image URL. The URL can be used directly as an image source. Supports markers and different map types.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        center: {
          type: 'string',
          description: 'Map center as "lat,lng" or an address (e.g. "41.8902,12.4922" or "Colosseum, Rome")',
        },
        zoom: {
          type: 'number',
          description: 'Zoom level (1-20, default 14)',
        },
        size: {
          type: 'string',
          description: 'Image size as "WIDTHxHEIGHT" (e.g. "600x400", default "600x400")',
        },
        markers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Marker definitions (e.g. ["color:red|41.8902,12.4922", "color:blue|label:B|48.8584,2.2945"])',
        },
        mapType: {
          type: 'string',
          enum: ['roadmap', 'satellite', 'terrain', 'hybrid'],
          description: 'Map type (default: roadmap)',
        },
      },
      required: ['center'],
      additionalProperties: false,
    },
    function: async (args: {
      center: string;
      zoom?: number;
      size?: string;
      markers?: string[];
      mapType?: string;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      if (!args.center) throw new ActionValidationError('center is required.');
      return executeAction('getStaticMap', async () => {
        const apiKey = await getGoogleMapsApiKey(context.companyId);
        const url = buildStaticMapUrl(
          apiKey,
          args.center,
          args.zoom || 14,
          args.size || '600x400',
          args.markers,
          args.mapType,
        );
        return { success: true, data: { imageUrl: url }, description: 'Static map URL generated' };
      }, { serviceName: 'googleMaps' });
    },
  },

  // ── Utility: Street View ────────────────────────────────────

  getStreetView: {
    description: 'Generate a Street View image URL for a location. The URL can be used directly as an image source.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'Location as "lat,lng" or an address (e.g. "48.8584,2.2945" or "Eiffel Tower, Paris")',
        },
        size: {
          type: 'string',
          description: 'Image size as "WIDTHxHEIGHT" (e.g. "600x400", default "600x400")',
        },
        heading: {
          type: 'number',
          description: 'Camera heading (0-360 degrees, 0=north)',
        },
        pitch: {
          type: 'number',
          description: 'Camera pitch (-90 to 90, 0=horizontal)',
        },
        fov: {
          type: 'number',
          description: 'Field of view (10-120 degrees, default 90)',
        },
      },
      required: ['location'],
      additionalProperties: false,
    },
    function: async (args: {
      location: string;
      size?: string;
      heading?: number;
      pitch?: number;
      fov?: number;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      if (!args.location) throw new ActionValidationError('location is required.');
      return executeAction('getStreetView', async () => {
        const apiKey = await getGoogleMapsApiKey(context.companyId);
        const url = buildStreetViewUrl(
          apiKey,
          args.location,
          args.size || '600x400',
          args.heading,
          args.pitch,
          args.fov,
        );
        return { success: true, data: { imageUrl: url }, description: 'Street View URL generated' };
      }, { serviceName: 'googleMaps' });
    },
  },

  // ── Utility: Timezone ───────────────────────────────────────

  getTimezone: {
    description: 'Get the timezone for a geographic location. Returns timezone ID, name, and UTC offset.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        latitude: {
          type: 'number',
          description: 'Latitude',
        },
        longitude: {
          type: 'number',
          description: 'Longitude',
        },
        timestamp: {
          type: 'number',
          description: 'Unix timestamp to get timezone for (default: current time). Affects DST offset.',
        },
      },
      required: ['latitude', 'longitude'],
      additionalProperties: false,
    },
    function: async (args: {
      latitude: number;
      longitude: number;
      timestamp?: number;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      return executeAction('getTimezone', async () => {
        const data = await getTimezoneSvc(context.companyId, args.latitude, args.longitude, args.timestamp);
        if (data.status !== 'OK') {
          return { success: true, data: null, description: `Timezone lookup failed: ${data.status}` };
        }
        return {
          success: true,
          data: {
            timeZoneId: data.timeZoneId,
            timeZoneName: data.timeZoneName,
            rawOffset: data.rawOffset,
            dstOffset: data.dstOffset,
          },
          description: `Timezone: ${data.timeZoneId} (${data.timeZoneName})`,
        };
      }, { serviceName: 'googleMaps' });
    },
  },

  // ── Utility: Distance Matrix ────────────────────────────────

  getDistanceMatrix: {
    description: 'Calculate travel time and distance between multiple origins and destinations. Useful for comparing routes or finding the closest point of interest.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        origins: {
          type: 'array',
          items: { type: 'string' },
          description: 'Origin locations as addresses or "lat,lng" (e.g. ["Colosseum, Rome", "41.9029,12.4534"])',
        },
        destinations: {
          type: 'array',
          items: { type: 'string' },
          description: 'Destination locations as addresses or "lat,lng"',
        },
        mode: {
          type: 'string',
          enum: ['driving', 'walking', 'bicycling', 'transit'],
          description: 'Travel mode (default: driving)',
        },
      },
      required: ['origins', 'destinations'],
      additionalProperties: false,
    },
    function: async (args: {
      origins: string[];
      destinations: string[];
      mode?: string;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      if (!args.origins?.length) throw new ActionValidationError('origins must not be empty.');
      if (!args.destinations?.length) throw new ActionValidationError('destinations must not be empty.');
      return executeAction('getDistanceMatrix', async () => {
        const data = await getDistanceMatrix(
          context.companyId,
          args.origins,
          args.destinations,
          args.mode || 'driving',
        );
        if (data.status !== 'OK') {
          return { success: true, data: null, description: `Distance matrix failed: ${data.status}` };
        }
        return {
          success: true,
          data: {
            originAddresses: data.origin_addresses,
            destinationAddresses: data.destination_addresses,
            rows: data.rows,
          },
          description: `Matrix: ${data.origin_addresses.length} origins × ${data.destination_addresses.length} destinations`,
        };
      }, { serviceName: 'googleMaps' });
    },
  },
});
