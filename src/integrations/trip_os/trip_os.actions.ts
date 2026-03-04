import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import { executeAction } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';
import { tripOsGet, tripOsPost, tripOsPatch, validateConnection } from './trip_os.service';

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
    description: 'Search TripOS curated restaurants at a destination. Can filter by kosher, cuisine type, and price range. Returns name, address, cuisine, rating, kosher status, opening hours, and any active coupons/discounts. Each result includes a `coupons` array — if non-empty, the restaurant has TripOS exclusive deals (discount code, percentage/fixed discount, validity).',
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
    description: 'Search TripOS curated attractions and landmarks at a destination. Returns name, category, price, duration, rating, description, and any active coupons/discounts. Each result includes a `coupons` array with TripOS exclusive deals if available.',
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
    description: 'Search TripOS curated activities and experiences (tours, cooking classes, etc). Returns name, type, duration, price, family-friendliness, provider, and any active coupons/discounts. Each result includes a `coupons` array with TripOS exclusive deals if available.',
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
    description: 'Search TripOS curated hotels at a destination. Can filter by star rating and max price per night. Returns name, stars, price, amenities, kosher food availability, rating, and any active coupons/discounts. Each result includes a `coupons` array with TripOS exclusive deals if available.',
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
    description: 'Search TripOS curated shopping destinations (malls, markets, luxury streets, outlets). Returns name, type, price range, address, rating, and any active coupons/discounts. Each result includes a `coupons` array with TripOS exclusive deals if available.',
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

  // ── Customer Lookup ──────────────────────────────────────────

  resolveCurrentCustomer: {
    description: 'Look up the current user\'s TripOS customer profile automatically based on their session channel. Zero parameters — reads channel and channelUserId from session context. Returns customer profile if found, or guidance to create one if not found.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async (): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      if (!context.channel || !context.channelUserId) {
        return {
          success: true,
          data: { found: false, message: 'Session does not have channel identity information' },
        };
      }
      // tripos-web channelUserId is the customer MongoDB _id (direct lookup)
      // Other channels use field-based query (heraldId, email, phone)
      const paramMap: Record<string, string> = {
        herald: 'heraldId',
        web: 'email',
        whatsapp: 'phone',
      };
      const paramKey = paramMap[context.channel];
      if (!paramKey) {
        // tripos-web or unknown channel — try direct customer _id lookup
        return executeAction('resolveCurrentCustomer', async () => {
          try {
            const data = await tripOsGet(context.companyId, `/api/data/customers/${context.channelUserId}`);
            if (data) {
              return { success: true, data: { found: true, customer: data }, description: `Found customer by ID: ${data.firstName} ${data.lastName}` };
            }
          } catch {
            // Not a valid customer ID — fall through
          }
          return {
            success: true,
            data: { found: false, channel: context.channel, channelUserId: context.channelUserId, message: `No TripOS customer found for ${context.channel} user ${context.channelUserId}` },
          };
        }, { serviceName: 'tripOs' });
      }
      return executeAction('resolveCurrentCustomer', async () => {
        const data = await tripOsGet(context.companyId, '/api/data/customers', { [paramKey]: context.channelUserId });
        const customer = data.results?.[0];
        if (!customer) {
          return {
            success: true,
            data: { found: false, channel: context.channel, channelUserId: context.channelUserId, message: `No TripOS customer found for ${context.channel} user ${context.channelUserId}` },
          };
        }
        return { success: true, data: { found: true, customer }, description: `Found customer: ${customer.firstName} ${customer.lastName}` };
      }, { serviceName: 'tripOs' });
    },
  },

  lookupCustomerByChannel: {
    description: 'Look up a TripOS customer by their contact identifier. Works across all channels: herald (by Herald ID), web (by email), WhatsApp (by phone), tripos-web (by Clerk ID).',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          enum: ['herald', 'web', 'whatsapp', 'tripos-web'],
          description: 'The channel type',
        },
        channelId: {
          type: 'string',
          description: 'The contact identifier (Herald ID, email, phone number, or Clerk ID)',
        },
      },
      required: ['channel', 'channelId'],
      additionalProperties: false,
    },
    function: async (args: { channel: string; channelId: string }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      if (!args.channelId) throw new ActionValidationError('channelId is required.');
      const paramMap: Record<string, string> = { herald: 'heraldId', web: 'email', whatsapp: 'phone', 'tripos-web': 'clerkId' };
      const paramKey = paramMap[args.channel];
      if (!paramKey) throw new ActionValidationError(`Unsupported channel: ${args.channel}`);
      return executeAction('lookupCustomerByChannel', async () => {
        const data = await tripOsGet(context.companyId, '/api/data/customers', { [paramKey]: args.channelId });
        const customer = data.results?.[0];
        if (!customer) {
          return { success: true, data: null, description: `No TripOS customer found for ${args.channel} ID: ${args.channelId}` };
        }
        return { success: true, data: customer, description: `Found customer: ${customer.firstName} ${customer.lastName}` };
      }, { serviceName: 'tripOs' });
    },
  },

  // ── Customer Creation ────────────────────────────────────────

  createOrLinkCustomer: {
    description: 'Create or link a TripOS customer for the current user. Automatically links to the user\'s session channel (Telegram/WhatsApp/Web/TripOS-Web). Accepts optional personal details (name, email, phone, nationality, language) — if not provided, falls back to session metadata. TripOS API handles upsert (creates if new, links if exists). Returns the customer profile.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        firstName: { type: 'string', description: 'First name (optional, falls back to channelMetadata)' },
        lastName: { type: 'string', description: 'Last name (optional, falls back to channelMetadata)' },
        email: { type: 'string', description: 'Email address (optional, falls back to channelMetadata)' },
        phone: { type: 'string', description: 'Phone number (optional, falls back to channelMetadata)' },
        nationality: { type: 'string', description: 'Nationality (optional)' },
        preferredLanguage: { type: 'string', enum: ['he', 'en'], description: 'Preferred language (default: he)' },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (args: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      nationality?: string;
      preferredLanguage?: string;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      if (!context.channel || !context.channelUserId) {
        throw new ActionValidationError('Session does not have channel identity information');
      }
      return executeAction('createOrLinkCustomer', async () => {
        const customerData: Record<string, any> = {
          firstName: args.firstName || context.channelMetadata?.name?.split(' ')[0] || 'User',
          lastName: args.lastName || context.channelMetadata?.name?.split(' ').slice(1).join(' ') || '',
          preferredLanguage: args.preferredLanguage || 'he',
        };
        // Auto-populate channel identifier
        // tripos-web uses customer MongoDB _id as channelUserId — no field mapping needed
        const channelFieldMap: Record<string, string> = {
          herald: 'heraldId',
          web: 'email',
          whatsapp: 'phone',
        };
        const channelField = channelFieldMap[context.channel];
        if (channelField) {
          customerData[channelField] = context.channelUserId;
        }
        // Add optional fields
        if (args.email || context.channelMetadata?.email) {
          customerData.email = args.email || context.channelMetadata.email;
        }
        if (args.phone || context.channelMetadata?.phone) {
          customerData.phone = args.phone || context.channelMetadata.phone;
        }
        if (args.nationality) {
          customerData.nationality = args.nationality;
        }
        const data = await tripOsPost(context.companyId, '/api/data/customers', customerData);
        return { success: true, data, description: `Customer created/linked: ${data.firstName} ${data.lastName}` };
      }, { serviceName: 'tripOs' });
    },
  },

  createCustomer: {
    description: 'Create a new TripOS customer profile. Use this when a new user is not yet registered. Returns the created customer with their _id.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        firstName: { type: 'string', description: 'First name in English' },
        lastName: { type: 'string', description: 'Last name in English' },
        firstNameHe: { type: 'string', description: 'First name in Hebrew (if known)' },
        lastNameHe: { type: 'string', description: 'Last name in Hebrew (if known)' },
        email: { type: 'string', description: 'Email address (optional)' },
        phone: { type: 'string', description: 'Phone number (optional)' },
        heraldId: { type: 'string', description: 'Agent Herald ID to link this customer to their Herald conversation' },
        clerkId: { type: 'string', description: 'Clerk user ID to link this customer to their authenticated web account (used for tripos-web channel)' },
        preferredLanguage: { type: 'string', enum: ['he', 'en'], description: 'Preferred language (default: he)' },
      },
      required: ['firstName', 'lastName'],
      additionalProperties: false,
    },
    function: async (args: {
      firstName: string;
      lastName: string;
      firstNameHe?: string;
      lastNameHe?: string;
      email?: string;
      phone?: string;
      heraldId?: string;
      clerkId?: string;
      preferredLanguage?: string;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      if (!args.firstName || !args.lastName) throw new ActionValidationError('firstName and lastName are required.');
      return executeAction('createCustomer', async () => {
        const data = await tripOsPost(context.companyId, '/api/data/customers', args);
        return { success: true, data, description: `Created customer: ${args.firstName} ${args.lastName}` };
      }, { serviceName: 'tripOs' });
    },
  },

  // ── Customers ─────────────────────────────────────────────────

  getCustomerProfile: {
    description: 'Get a customer profile by ID. Returns name, email, phone, passport, nationality, and bio (free-text field with all personal info, family members, dietary needs, travel style, and preferences).',
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

  // ── Customer Bio ─────────────────────────────────────────────

  updateCustomerBio: {
    description: 'Update a customer\'s PERSONAL PROFILE bio — persistent info about WHO they are. Only include: family members (names, ages, gender), dietary needs, travel pace/style, interests, personality traits, memorable travel stories. NEVER include trip-specific details: dates, destinations, events, who\'s joining a specific trip, itinerary items, or logistics. Those belong in the trip, not the profile.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Customer MongoDB _id' },
        bio: {
          type: 'string',
          description: 'Personal profile bio ONLY. Include: family (names, ages), dietary needs, travel pace, interests, personality. Do NOT include trip-specific data (dates, destinations, events, guests joining a trip, logistics).',
        },
      },
      required: ['customerId', 'bio'],
      additionalProperties: false,
    },
    function: async (args: {
      customerId: string;
      bio: string;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      if (!args.customerId) throw new ActionValidationError('customerId is required.');

      return executeAction('updateCustomerBio', async () => {
        const data = await tripOsPatch(context.companyId, `/api/data/customers/${args.customerId}`, { bio: args.bio });
        return { success: true, data: { bio: data.bio }, description: 'Customer bio updated' };
      }, { serviceName: 'tripOs' });
    },
  },

  // ── Trip (Active Trip Model) ─────────────────────────────────
  // Only one trip can be active per customer. Trips are created by the UI,
  // not by agents. Agents read/write the active trip only.

  getActiveTrip: {
    description: 'Get the current user\'s active trip. Returns the trip with status "created", "planning", or "active" (most recent). This is the trip the user is currently working on. Returns null if no active trip exists — the user needs to create one from the app UI.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async (): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      if (!context.channel || !context.channelUserId) {
        return {
          success: true,
          data: { found: false, message: 'No session identity — cannot resolve active trip' },
        };
      }
      return executeAction('getActiveTrip', async () => {
        // tripos-web channelUserId is the customer MongoDB _id
        const customerIdParam = context.channel === 'tripos-web' ? context.channelUserId : undefined;
        if (!customerIdParam) {
          return { success: true, data: { found: false, message: `Channel ${context.channel} not supported for trip lookup` } };
        }
        // Find most recent planning or active trip
        const data = await tripOsGet(context.companyId, '/api/data/trips', {
          customerId: customerIdParam,
          limit: '5',
        });
        const trip = (data.results || []).find((t: any) => t.status === 'created' || t.status === 'planning' || t.status === 'active');
        if (!trip) {
          return { success: true, data: { found: false, message: 'No active trip. The user needs to create a new trip from the app.' } };
        }
        return { success: true, data: { found: true, tripId: trip._id, trip }, description: `Active trip: ${trip._id} (${trip.destination || 'no destination'})` };
      }, { serviceName: 'tripOs' });
    },
  },

  getTrip: {
    description: 'Get full details of a specific trip by its ID. Use getActiveTrip instead when you want the current trip.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        tripId: { type: 'string', description: 'The trip MongoDB _id' },
      },
      required: ['tripId'],
      additionalProperties: false,
    },
    function: async (args: { tripId: string }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      if (!args.tripId) throw new ActionValidationError('tripId is required.');
      return executeAction('getTrip', async () => {
        const data = await tripOsGet(context.companyId, `/api/data/trips/${args.tripId}`);
        return { success: true, data };
      }, { serviceName: 'tripOs' });
    },
  },

  updateTrip: {
    description: 'Update the active trip. Supports two modes:\n1. **Structured update**: Pass specific fields (destination, dates, travelers, etc.) to apply directly.\n2. **Instruction mode**: Pass an `instruction` string to delegate complex work (research, planning, itinerary building) to the trip-manager agent. The instruction is processed asynchronously — the trip will update in the background.\n\nIf no tripId is provided, automatically finds and updates the user\'s active trip.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        tripId: { type: 'string', description: 'The trip MongoDB _id. Optional — if omitted, uses the active trip.' },
        instruction: { type: 'string', description: 'Natural language instruction for the trip-manager agent (e.g. "Build a 3-day itinerary for family with kids, kosher meals, focus on beaches"). Processed asynchronously.' },
        destination: { type: 'string', description: 'Destination name in Hebrew (e.g. "רומא")' },
        title: { type: 'string', description: 'Trip title in Hebrew (e.g. "חופשה ברומא")' },
        startDate: { type: 'string', description: 'Trip start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'Trip end date (YYYY-MM-DD)' },
        travelers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Traveler name' },
              age: { type: 'number', description: 'Traveler age' },
            },
            required: ['name', 'age'],
            additionalProperties: false,
          },
          description: 'List of travelers with name and age',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Trip tags (e.g. ["כשר", "משפחה", "תרבות"])',
        },
        heroImage: { type: 'string', description: 'URL for trip hero image' },
        days: {
          type: 'array',
          description: 'Full array of trip days — replaces existing days.',
          items: {
            type: 'object',
            properties: {
              dayNum: { type: 'number', description: 'Day number (1, 2, 3, ...)' },
              date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
              titleHe: { type: 'string', description: 'Day title in Hebrew (e.g. "יום 1 — מרכז רומא ההיסטורי")' },
              brief: { type: 'string', description: 'Brief day description in Hebrew (1 sentence)' },
              stops: {
                type: 'array',
                description: 'Ordered list of stops for the day (5-8 stops, including meals)',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'Unique stop ID (e.g. "d1-s1" for day 1 stop 1)' },
                    time: { type: 'string', description: 'Time in HH:MM format (e.g. "09:00")' },
                    title: { type: 'string', description: 'Stop name in Hebrew' },
                    icon: { type: 'string', description: 'One of: landmark, food, coffee, camera, activity, shopping, nature, church, swords' },
                    description: { type: 'string', description: 'Brief description in Hebrew (1-2 sentences)' },
                    duration: { type: 'string', description: 'Duration in Hebrew (e.g. "2 שעות")' },
                    image: { type: 'string', description: 'Photo URL from searchPlaces results' },
                    address: { type: 'string', description: 'Full street address' },
                    rating: { type: 'number', description: 'Rating 1.0-5.0' },
                    price: { type: 'string', description: 'Price: "חינם", "$", "$$", "$$$"' },
                    hours: { type: 'string', description: 'Opening hours (e.g. "09:00-18:00")' },
                    tip: { type: 'string', description: 'Practical tip in Hebrew' },
                    about: { type: 'string', description: 'Background about the place in Hebrew (2-3 sentences)' },
                    kosher: { type: 'boolean', description: 'Whether kosher (food stops)' },
                    personalNote: { type: 'string', description: 'Personal note for the travelers in Hebrew' },
                    walkAfter: { type: 'number', description: 'Walking minutes to next stop (0 if driving/last)' },
                  },
                  required: ['id', 'time', 'title', 'icon', 'description', 'duration', 'address', 'about'],
                  additionalProperties: false,
                },
              },
            },
            required: ['dayNum', 'date', 'titleHe', 'brief', 'stops'],
            additionalProperties: false,
          },
        },
        status: {
          type: 'string',
          enum: ['planning', 'draft', 'active', 'completed'],
          description: 'Trip status. Set to "active" when the plan is complete.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (args: {
      tripId?: string;
      instruction?: string;
      destination?: string;
      title?: string;
      startDate?: string;
      endDate?: string;
      travelers?: { name: string; age: number }[];
      tags?: string[];
      heroImage?: string;
      days?: Record<string, unknown>[];
      status?: string;
    }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      return executeAction('updateTrip', async () => {
        let tripId = args.tripId;

        // Auto-resolve active trip if no tripId provided
        if (!tripId) {
          if (!context.channel || !context.channelUserId) {
            throw new ActionValidationError('No tripId provided and no session identity to resolve active trip.');
          }
          if (context.channel === 'tripos-web') {
            const data = await tripOsGet(context.companyId, '/api/data/trips', {
              customerId: context.channelUserId,
              limit: '5',
            });
            const active = (data.results || []).find((t: any) => t.status === 'created' || t.status === 'planning' || t.status === 'active');
            if (!active) {
              return { success: false, description: 'No active trip found. The user needs to create a new trip from the app.' };
            }
            tripId = active._id;
          } else {
            throw new ActionValidationError(`Channel ${context.channel} not supported for auto trip resolution.`);
          }
        }

        const { tripId: _, ...updates } = args;
        const body: Record<string, any> = {};
        for (const [key, value] of Object.entries(updates)) {
          if (value !== undefined) body[key] = value;
        }
        const data = await tripOsPatch(context.companyId, `/api/data/trips/${tripId}`, body);
        const isAsync = !!args.instruction;
        return {
          success: true,
          data: { ...data, processing: isAsync },
          description: isAsync
            ? `Instruction sent to trip-manager for trip ${tripId}. The trip will update in the background.`
            : `Updated trip ${tripId}`,
        };
      }, { serviceName: 'tripOs' });
    },
  },

  // ── Per-Day Update ─────────────────────────────────────────────

  updateTripDay: {
    description: 'Update a single day in a trip. Used by day-planner agents to save their planned day directly. Concurrent-safe — multiple days can be written in parallel. The day is inserted if it doesn\'t exist, or replaced if it does.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        tripId: { type: 'string', description: 'The trip MongoDB _id' },
        dayNum: { type: 'number', description: 'Day number (1, 2, 3, ...)' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        titleHe: { type: 'string', description: 'Day title in Hebrew' },
        brief: { type: 'string', description: 'Brief day description in Hebrew (1 sentence)' },
        heroCandidate: { type: 'string', description: 'URL of the most iconic photo from this day (for hero image selection)' },
        stops: {
          type: 'array',
          description: 'Ordered list of stops for the day',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique stop ID (e.g. "d1-s1")' },
              time: { type: 'string', description: 'Time in HH:MM format' },
              title: { type: 'string', description: 'Stop name in Hebrew' },
              icon: { type: 'string', description: 'One of: landmark, food, coffee, camera, activity, shopping, nature, church, swords' },
              description: { type: 'string', description: 'Brief description in Hebrew' },
              duration: { type: 'string', description: 'Duration in Hebrew' },
              image: { type: 'string', description: 'Photo URL from searchPlaces' },
              address: { type: 'string', description: 'Full street address' },
              rating: { type: 'number', description: 'Rating 1.0-5.0' },
              price: { type: 'string', description: 'Price indicator' },
              hours: { type: 'string', description: 'Opening hours' },
              tip: { type: 'string', description: 'Practical tip in Hebrew' },
              about: { type: 'string', description: 'Background in Hebrew (2-3 sentences)' },
              kosher: { type: 'boolean', description: 'Whether kosher (food stops)' },
              personalNote: { type: 'string', description: 'Personal note for travelers in Hebrew' },
              walkAfter: { type: 'number', description: 'Walking minutes to next stop' },
            },
            required: ['id', 'time', 'title', 'icon', 'description', 'duration', 'address', 'about'],
            additionalProperties: false,
          },
        },
      },
      required: ['tripId', 'dayNum', 'date', 'titleHe', 'brief', 'stops'],
      additionalProperties: false,
    },
    function: async (args: {
      tripId: string;
      dayNum: number;
      date: string;
      titleHe: string;
      brief: string;
      heroCandidate?: string;
      stops: Record<string, unknown>[];
    }): Promise<StandardActionResult> => {
      if (!context.companyId) throw new ActionValidationError('Company ID is missing.');
      if (!args.tripId) throw new ActionValidationError('tripId is required.');
      if (!args.dayNum || args.dayNum < 1) throw new ActionValidationError('dayNum must be a positive integer.');

      return executeAction('updateTripDay', async () => {
        const { tripId, dayNum, ...dayData } = args;
        const data = await tripOsPatch(context.companyId, `/api/data/trips/${tripId}/days/${dayNum}`, dayData);
        return {
          success: true,
          data: { tripId, dayNum, action: data.action },
          description: `Saved day ${dayNum} to trip ${tripId}`,
        };
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

  // ── Onboarding ────────────────────────────────────────────────

  markOnboardingComplete: {
    description: 'Mark a customer onboarding as complete. Call this after saving the customer bio during onboarding.',
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
      return executeAction('markOnboardingComplete', async () => {
        const data = await tripOsPatch(context.companyId, `/api/data/customers/${args.customerId}/onboarding`, {});
        return { success: true, data, description: `Marked customer ${args.customerId} onboarding as complete` };
      }, { serviceName: 'tripOs' });
    },
  },
});
