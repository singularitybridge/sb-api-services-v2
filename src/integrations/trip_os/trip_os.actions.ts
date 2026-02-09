import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import { executeAction } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';
import { tripOsGet, tripOsPost, validateConnection } from './trip_os.service';

export { validateConnection };

export const createTripOsActions = (context: ActionContext): FunctionFactory => ({

  // ── Destinations ──────────────────────────────────────────────

  searchDestinations: {
    description: 'Search travel destinations. Returns destinations with name, country, highlights, weather, and practical info. Available destinations: Rome, Paris, New York.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Free text search (name, country)',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (args: { search?: string }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      const params: Record<string, string> = { limit: '10' };
      if (args.search) params.search = args.search;
      return executeAction('searchDestinations', async () => {
        const data = await tripOsGet(context.companyId, '/api/data/destinations', params);
        return { success: true, data: data.results, description: `Found ${data.total} destinations` };
      }, { serviceName: 'tripOs' });
    },
  },

  getDestination: {
    description: 'Get full details of a specific destination by its ID (MongoDB ObjectId)',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        destinationId: { type: 'string', description: 'The destination MongoDB _id' },
      },
      required: ['destinationId'],
      additionalProperties: false,
    },
    function: async (args: { destinationId: string }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      if (!args.destinationId) throw new ActionValidationError('destinationId is required.');
      return executeAction('getDestination', async () => {
        const data = await tripOsGet(context.companyId, `/api/data/destinations/${args.destinationId}`);
        return { success: true, data };
      }, { serviceName: 'tripOs' });
    },
  },

  // ── Restaurants ───────────────────────────────────────────────

  searchRestaurants: {
    description: 'Search restaurants at a destination. Can filter by kosher, cuisine type, and price range. Returns name, address, cuisine, rating, kosher status, and opening hours.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        destinationSlug: {
          type: 'string',
          description: 'Destination slug: "rome", "paris", or "new-york"',
        },
        kosher: {
          type: 'string',
          enum: ['true', 'false'],
          description: 'Filter by kosher status',
        },
        cuisine: {
          type: 'string',
          description: 'Cuisine type filter (e.g. "italian", "french", "japanese")',
        },
        priceRange: {
          type: 'string',
          description: 'Price range filter (e.g. "$", "$$", "$$$")',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (args: {
      destinationSlug?: string;
      kosher?: string;
      cuisine?: string;
      priceRange?: string;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      const params: Record<string, string> = { limit: '20' };
      if (args.destinationSlug) params.destinationSlug = args.destinationSlug;
      if (args.kosher) params.kosher = args.kosher;
      if (args.cuisine) params.cuisine = args.cuisine;
      if (args.priceRange) params.priceRange = args.priceRange;
      return executeAction('searchRestaurants', async () => {
        const data = await tripOsGet(context.companyId, '/api/data/restaurants', params);
        return { success: true, data: data.results, description: `Found ${data.total} restaurants` };
      }, { serviceName: 'tripOs' });
    },
  },

  // ── Attractions ───────────────────────────────────────────────

  searchAttractions: {
    description: 'Search attractions and landmarks at a destination. Returns name, category, price, duration, rating, and description.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        destinationSlug: {
          type: 'string',
          description: 'Destination slug: "rome", "paris", or "new-york"',
        },
        category: {
          type: 'string',
          description: 'Category filter (e.g. "landmark", "museum", "nature", "entertainment")',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (args: {
      destinationSlug?: string;
      category?: string;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      const params: Record<string, string> = { limit: '20' };
      if (args.destinationSlug) params.destinationSlug = args.destinationSlug;
      if (args.category) params.category = args.category;
      return executeAction('searchAttractions', async () => {
        const data = await tripOsGet(context.companyId, '/api/data/attractions', params);
        return { success: true, data: data.results, description: `Found ${data.total} attractions` };
      }, { serviceName: 'tripOs' });
    },
  },

  // ── Activities ────────────────────────────────────────────────

  searchActivities: {
    description: 'Search bookable activities and experiences (tours, cooking classes, etc). Returns name, type, duration, price, family-friendliness, and provider.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        destinationSlug: {
          type: 'string',
          description: 'Destination slug: "rome", "paris", or "new-york"',
        },
        type: {
          type: 'string',
          description: 'Activity type (e.g. "walking-tour", "cooking-class", "wine-tasting")',
        },
        familyFriendly: {
          type: 'string',
          enum: ['true', 'false'],
          description: 'Filter for family-friendly activities',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (args: {
      destinationSlug?: string;
      type?: string;
      familyFriendly?: string;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      const params: Record<string, string> = { limit: '20' };
      if (args.destinationSlug) params.destinationSlug = args.destinationSlug;
      if (args.type) params.type = args.type;
      if (args.familyFriendly) params.familyFriendly = args.familyFriendly;
      return executeAction('searchActivities', async () => {
        const data = await tripOsGet(context.companyId, '/api/data/activities', params);
        return { success: true, data: data.results, description: `Found ${data.total} activities` };
      }, { serviceName: 'tripOs' });
    },
  },

  // ── Hotels ────────────────────────────────────────────────────

  searchHotels: {
    description: 'Search hotels at a destination. Can filter by star rating and max price per night. Returns name, stars, price, amenities, kosher food availability, and rating.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        destinationSlug: {
          type: 'string',
          description: 'Destination slug: "rome", "paris", or "new-york"',
        },
        stars: {
          type: 'string',
          description: 'Minimum star rating (3, 4, or 5)',
        },
        maxPrice: {
          type: 'string',
          description: 'Maximum price per night in USD',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (args: {
      destinationSlug?: string;
      stars?: string;
      maxPrice?: string;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      const params: Record<string, string> = { limit: '20' };
      if (args.destinationSlug) params.destinationSlug = args.destinationSlug;
      if (args.stars) params.stars = args.stars;
      if (args.maxPrice) params.maxPrice = args.maxPrice;
      return executeAction('searchHotels', async () => {
        const data = await tripOsGet(context.companyId, '/api/data/hotels', params);
        return { success: true, data: data.results, description: `Found ${data.total} hotels` };
      }, { serviceName: 'tripOs' });
    },
  },

  // ── Flights ───────────────────────────────────────────────────

  searchFlights: {
    description: 'Search flights from Tel Aviv (TLV) to a destination. Returns airline, flight number, departure/arrival times, duration, and prices for economy/business/first class.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        destinationSlug: {
          type: 'string',
          description: 'Destination slug: "rome", "paris", or "new-york"',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (args: { destinationSlug?: string }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      const params: Record<string, string> = { limit: '20' };
      if (args.destinationSlug) params.destinationSlug = args.destinationSlug;
      return executeAction('searchFlights', async () => {
        const data = await tripOsGet(context.companyId, '/api/data/flights', params);
        return { success: true, data: data.results, description: `Found ${data.total} flights` };
      }, { serviceName: 'tripOs' });
    },
  },

  // ── Car Rentals ───────────────────────────────────────────────

  searchCarRentals: {
    description: 'Search car rental options at a destination. Returns company, car model, type, price per day, transmission, seats, and pickup location.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        destinationSlug: {
          type: 'string',
          description: 'Destination slug: "rome", "paris", or "new-york"',
        },
        carType: {
          type: 'string',
          description: 'Car type filter (e.g. "Economy", "Compact", "SUV", "Luxury")',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (args: {
      destinationSlug?: string;
      carType?: string;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      const params: Record<string, string> = { limit: '20' };
      if (args.destinationSlug) params.destinationSlug = args.destinationSlug;
      if (args.carType) params.carType = args.carType;
      return executeAction('searchCarRentals', async () => {
        const data = await tripOsGet(context.companyId, '/api/data/car-rentals', params);
        return { success: true, data: data.results, description: `Found ${data.total} car rentals` };
      }, { serviceName: 'tripOs' });
    },
  },

  // ── Insurance ─────────────────────────────────────────────────

  searchInsurance: {
    description: 'Search travel insurance plans. Returns provider, plan name, coverage level, price per day, and what is covered (medical, luggage, cancellation, adventure sports).',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        coverage: {
          type: 'string',
          enum: ['basic', 'standard', 'premium', 'extreme'],
          description: 'Coverage level filter',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (args: { coverage?: string }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      const params: Record<string, string> = { limit: '20' };
      if (args.coverage) params.coverage = args.coverage;
      return executeAction('searchInsurance', async () => {
        const data = await tripOsGet(context.companyId, '/api/data/insurance', params);
        return { success: true, data: data.results, description: `Found ${data.total} insurance plans` };
      }, { serviceName: 'tripOs' });
    },
  },

  // ── Shopping ──────────────────────────────────────────────────

  searchShopping: {
    description: 'Search shopping destinations (malls, markets, luxury streets, outlets). Returns name, type, price range, address, and rating.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        destinationSlug: {
          type: 'string',
          description: 'Destination slug: "rome", "paris", or "new-york"',
        },
        type: {
          type: 'string',
          description: 'Shopping type (e.g. "mall", "market", "luxury-street", "outlet", "department-store")',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (args: {
      destinationSlug?: string;
      type?: string;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      const params: Record<string, string> = { limit: '20' };
      if (args.destinationSlug) params.destinationSlug = args.destinationSlug;
      if (args.type) params.type = args.type;
      return executeAction('searchShopping', async () => {
        const data = await tripOsGet(context.companyId, '/api/data/shopping', params);
        return { success: true, data: data.results, description: `Found ${data.total} shopping spots` };
      }, { serviceName: 'tripOs' });
    },
  },

  // ── Transport ─────────────────────────────────────────────────

  getTransportOptions: {
    description: 'Get local transport options at a destination (public transit, taxi, bike rental). Returns name, type, price, duration, route, and frequency.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        destinationSlug: {
          type: 'string',
          description: 'Destination slug: "rome", "paris", or "new-york"',
        },
        type: {
          type: 'string',
          description: 'Transport type (e.g. "public-transit", "taxi", "bike-rental")',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (args: {
      destinationSlug?: string;
      type?: string;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      const params: Record<string, string> = { limit: '20' };
      if (args.destinationSlug) params.destinationSlug = args.destinationSlug;
      if (args.type) params.type = args.type;
      return executeAction('getTransportOptions', async () => {
        const data = await tripOsGet(context.companyId, '/api/data/transport', params);
        return { success: true, data: data.results, description: `Found ${data.total} transport options` };
      }, { serviceName: 'tripOs' });
    },
  },

  // ── Customers ─────────────────────────────────────────────────

  getCustomerProfile: {
    description: 'Get a customer profile by ID. Returns name, email, phone, passport, tier (standard/silver/gold/platinum), preferences (kosher, seat, room), and frequent flyer info.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Customer MongoDB _id' },
      },
      required: ['customerId'],
      additionalProperties: false,
    },
    function: async (args: { customerId: string }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      if (!args.customerId) throw new ActionValidationError('customerId is required.');
      return executeAction('getCustomerProfile', async () => {
        const data = await tripOsGet(context.companyId, `/api/data/customers/${args.customerId}`);
        return { success: true, data };
      }, { serviceName: 'tripOs' });
    },
  },

  // ── Bookings ──────────────────────────────────────────────────

  getCustomerBookings: {
    description: 'Get all bookings for a customer. Returns booking reference, type (flight/hotel/car-rental/activity/insurance/package), status, dates, price, and details.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Customer MongoDB _id' },
      },
      required: ['customerId'],
      additionalProperties: false,
    },
    function: async (args: { customerId: string }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      if (!args.customerId) throw new ActionValidationError('customerId is required.');
      return executeAction('getCustomerBookings', async () => {
        const data = await tripOsGet(context.companyId, `/api/data/customers/${args.customerId}/bookings`);
        return { success: true, data: data.results, description: `Found ${data.total} bookings` };
      }, { serviceName: 'tripOs' });
    },
  },

  // ── Recommendations ───────────────────────────────────────────

  updateRecommendations: {
    description: 'Admin action: Update the featured/recommended status of an entity (restaurant, hotel, attraction, etc).',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        entityType: {
          type: 'string',
          enum: ['restaurants', 'attractions', 'activities', 'hotels', 'shopping'],
          description: 'The type of entity to update',
        },
        entityId: { type: 'string', description: 'The entity MongoDB _id' },
        featured: { type: 'boolean', description: 'Whether the entity should be featured/recommended' },
      },
      required: ['entityType', 'entityId', 'featured'],
      additionalProperties: false,
    },
    function: async (args: {
      entityType: string;
      entityId: string;
      featured: boolean;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      return executeAction('updateRecommendations', async () => {
        const data = await tripOsPost(context.companyId, '/api/data/recommendations', args);
        return { success: true, data, description: `Updated ${args.entityType} ${args.entityId} featured=${args.featured}` };
      }, { serviceName: 'tripOs' });
    },
  },
});
