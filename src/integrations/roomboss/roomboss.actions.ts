/**
 * RoomBoss Actions
 * Action definitions for AI agent integration with RoomBoss hotel management API
 */

import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import { executeAction } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';

import * as hotelsService from './services/hotels.service';
import * as bookingsService from './services/bookings.service';
import * as activitiesService from './services/activities.service';

import {
  RoomBossHotel,
  RoomBossHotelImages,
  RoomBossHotelDescription,
  RoomBossRatePlanDescription,
  RoomBossBooking,
  RoomBossVendor,
  RoomBossCategory,
  RoomBossProduct,
  ListHotelsParams,
  SearchAvailabilityParams,
  ListImagesParams,
  ListDescriptionParams,
  ListRatePlanParams,
  ListBookingsByDateParams,
  CreateBookingParams,
  GetBookingParams,
  CancelBookingParams,
  ListVendorsParams,
  ListCategoriesParams,
  ListProductsParams,
} from './types';

interface ServiceLambdaResponse<R = unknown> {
  success: boolean;
  data?: R;
  error?: string;
  description?: string;
}

const SERVICE_NAME = 'RoomBossService';

export const createRoomBossActions = (
  context: ActionContext,
): FunctionFactory => ({
  // ============================================================================
  // Hotel Actions
  // ============================================================================

  listHotels: {
    description:
      'List available hotels from RoomBoss by country and location. Use country codes (JP, NZ, CA, etc.) and location codes (NISEKO, HAKUBA, QUEENSTOWN, etc.).',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        countryCode: {
          type: 'string',
          description:
            'ISO country code (JP=Japan, NZ=New Zealand, CA=Canada, AU=Australia, US=USA, TH=Thailand, ID=Indonesia, CL=Chile)',
        },
        locationCode: {
          type: 'string',
          description:
            'Location code within the country (e.g., NISEKO, HAKUBA, FURANO for Japan; QUEENSTOWN, WANAKA for NZ)',
        },
      },
      required: ['countryCode', 'locationCode'],
      additionalProperties: false,
    },
    function: async (
      params: ListHotelsParams,
    ): Promise<StandardActionResult<RoomBossHotel[]>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing.');
      }

      return executeAction<RoomBossHotel[], ServiceLambdaResponse<RoomBossHotel[]>>(
        'listHotels',
        async () => {
          const res = await hotelsService.listHotels(context.companyId!, params);
          return { ...res, description: res.error };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  searchAvailability: {
    description:
      'Search for available hotel rooms. Requires hotel IDs, check-in/check-out dates (yyyyMMdd format), and number of guests.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        hotelIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of hotel IDs to search for availability',
        },
        checkIn: {
          type: 'string',
          description: 'Check-in date in yyyyMMdd format (e.g., 20250315)',
        },
        checkOut: {
          type: 'string',
          description: 'Check-out date in yyyyMMdd format (e.g., 20250320)',
        },
        numberGuests: {
          type: 'number',
          description: 'Total number of guests',
        },
        numberAdults: {
          type: 'number',
          description: 'Number of adults (optional)',
        },
        numberChildren: {
          type: 'number',
          description: 'Number of children (optional)',
        },
        numberInfants: {
          type: 'number',
          description: 'Number of infants (optional)',
        },
        rate: {
          type: 'string',
          description: "Rate type, use 'ota' for OTA rates (optional)",
        },
        discountCode: {
          type: 'string',
          description: 'Discount code if applicable (optional)',
        },
      },
      required: ['hotelIds', 'checkIn', 'checkOut', 'numberGuests'],
      additionalProperties: false,
    },
    function: async (
      params: SearchAvailabilityParams,
    ): Promise<StandardActionResult<RoomBossHotel[]>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing.');
      }

      return executeAction<RoomBossHotel[], ServiceLambdaResponse<RoomBossHotel[]>>(
        'searchAvailability',
        async () => {
          const res = await hotelsService.searchAvailability(context.companyId!, params);
          return { ...res, description: res.error };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  listHotelImages: {
    description: 'Get all images for a specific hotel including room type images.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        hotelId: {
          type: 'string',
          description: 'The hotel ID to get images for',
        },
      },
      required: ['hotelId'],
      additionalProperties: false,
    },
    function: async (
      params: ListImagesParams,
    ): Promise<StandardActionResult<RoomBossHotelImages>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing.');
      }

      return executeAction<RoomBossHotelImages, ServiceLambdaResponse<RoomBossHotelImages>>(
        'listHotelImages',
        async () => {
          const res = await hotelsService.listImages(context.companyId!, params);
          return { ...res, description: res.error };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  getHotelDescription: {
    description:
      'Get detailed description for a hotel in a specific language. Includes room type descriptions.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        hotelId: {
          type: 'string',
          description: 'The hotel ID to get description for',
        },
        locale: {
          type: 'string',
          description: 'Language code: en (English), ja (Japanese), zh (Chinese), ko (Korean). Default: en',
        },
      },
      required: ['hotelId'],
      additionalProperties: false,
    },
    function: async (
      params: ListDescriptionParams,
    ): Promise<StandardActionResult<RoomBossHotelDescription>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing.');
      }

      return executeAction<RoomBossHotelDescription, ServiceLambdaResponse<RoomBossHotelDescription>>(
        'getHotelDescription',
        async () => {
          const res = await hotelsService.listDescription(context.companyId!, params);
          return { ...res, description: res.error };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  listRatePlans: {
    description: 'Get rate plan descriptions for a hotel including meal plans and policies.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        hotelId: {
          type: 'string',
          description: 'The hotel ID to get rate plans for',
        },
        locale: {
          type: 'string',
          description: 'Language code: en, ja, zh, ko. Default: en',
        },
      },
      required: ['hotelId'],
      additionalProperties: false,
    },
    function: async (
      params: ListRatePlanParams,
    ): Promise<StandardActionResult<RoomBossRatePlanDescription>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing.');
      }

      return executeAction<RoomBossRatePlanDescription, ServiceLambdaResponse<RoomBossRatePlanDescription>>(
        'listRatePlans',
        async () => {
          const res = await hotelsService.listRatePlanDescription(context.companyId!, params);
          return { ...res, description: res.error };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // ============================================================================
  // Booking Actions
  // ============================================================================

  createBooking: {
    description:
      'Create a new hotel booking. Requires hotel ID, room type, rate plan, dates, guest info, and price.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        hotelId: {
          type: 'string',
          description: 'The hotel ID to book',
        },
        roomTypeId: {
          type: 'string',
          description: 'The room type ID to book',
        },
        ratePlanId: {
          type: 'number',
          description: 'The rate plan ID to use',
        },
        checkIn: {
          type: 'string',
          description: 'Check-in date in yyyyMMdd format',
        },
        checkOut: {
          type: 'string',
          description: 'Check-out date in yyyyMMdd format',
        },
        numberGuests: {
          type: 'number',
          description: 'Total number of guests',
        },
        numberAdults: {
          type: 'number',
          description: 'Number of adults (optional)',
        },
        numberChildren: {
          type: 'number',
          description: 'Number of children (optional)',
        },
        numberInfants: {
          type: 'number',
          description: 'Number of infants (optional)',
        },
        guestGivenName: {
          type: 'string',
          description: 'Guest first/given name',
        },
        guestFamilyName: {
          type: 'string',
          description: 'Guest last/family name',
        },
        guestEmail: {
          type: 'string',
          description: 'Guest email address (optional)',
        },
        contactNumber: {
          type: 'string',
          description: 'Guest phone number (optional)',
        },
        priceRetailMax: {
          type: 'number',
          description: 'Maximum retail price for the booking',
        },
        bookingExtent: {
          type: 'string',
          description:
            'Booking type: RESERVATION (confirmed), REQUEST (pending approval), REQUEST_INTERNAL. Default: RESERVATION',
        },
        comment: {
          type: 'string',
          description: 'Special requests or comments (optional)',
        },
      },
      required: [
        'hotelId',
        'roomTypeId',
        'ratePlanId',
        'checkIn',
        'checkOut',
        'numberGuests',
        'guestGivenName',
        'guestFamilyName',
        'priceRetailMax',
      ],
      additionalProperties: false,
    },
    function: async (
      params: CreateBookingParams,
    ): Promise<StandardActionResult<RoomBossBooking>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing.');
      }

      return executeAction<RoomBossBooking, ServiceLambdaResponse<RoomBossBooking>>(
        'createBooking',
        async () => {
          const res = await bookingsService.createBooking(context.companyId!, params);
          return { ...res, description: res.error };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  listBookings: {
    description: 'List all bookings for a hotel on a specific date.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        hotelId: {
          type: 'string',
          description: 'The hotel ID to list bookings for',
        },
        date: {
          type: 'string',
          description: 'Date to list bookings for in yyyyMMdd format',
        },
      },
      required: ['hotelId', 'date'],
      additionalProperties: false,
    },
    function: async (
      params: ListBookingsByDateParams,
    ): Promise<StandardActionResult<RoomBossBooking[]>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing.');
      }

      return executeAction<RoomBossBooking[], ServiceLambdaResponse<RoomBossBooking[]>>(
        'listBookings',
        async () => {
          const res = await bookingsService.listBookingsByDate(context.companyId!, params);
          return { ...res, description: res.error };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  getBooking: {
    description: 'Get details of a specific booking by ID.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        bookingId: {
          type: 'string',
          description: 'The booking ID to retrieve',
        },
      },
      required: ['bookingId'],
      additionalProperties: false,
    },
    function: async (
      params: GetBookingParams,
    ): Promise<StandardActionResult<RoomBossBooking>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing.');
      }

      return executeAction<RoomBossBooking, ServiceLambdaResponse<RoomBossBooking>>(
        'getBooking',
        async () => {
          const res = await bookingsService.getBooking(context.companyId!, params);
          return { ...res, description: res.error };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  cancelBooking: {
    description: 'Cancel an existing booking.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        bookingId: {
          type: 'string',
          description: 'The booking ID to cancel',
        },
      },
      required: ['bookingId'],
      additionalProperties: false,
    },
    function: async (
      params: CancelBookingParams,
    ): Promise<StandardActionResult<{ bookingId: string; status: string; message: string }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing.');
      }

      return executeAction<
        { bookingId: string; status: string; message: string },
        ServiceLambdaResponse<{ bookingId: string; status: string; message: string }>
      >(
        'cancelBooking',
        async () => {
          const res = await bookingsService.cancelBooking(context.companyId!, params);
          return { ...res, description: res.error };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // ============================================================================
  // Guest Services Actions
  // ============================================================================

  listVendors: {
    description:
      'List activity/experience vendors (ground services providers) by location. These provide tours, rentals, lessons, etc.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        countryCode: {
          type: 'string',
          description: 'ISO country code (JP, NZ, CA, etc.)',
        },
        locationCode: {
          type: 'string',
          description: 'Location code (NISEKO, HAKUBA, QUEENSTOWN, etc.)',
        },
      },
      required: ['countryCode', 'locationCode'],
      additionalProperties: false,
    },
    function: async (
      params: ListVendorsParams,
    ): Promise<StandardActionResult<RoomBossVendor[]>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing.');
      }

      return executeAction<RoomBossVendor[], ServiceLambdaResponse<RoomBossVendor[]>>(
        'listVendors',
        async () => {
          const res = await activitiesService.listVendors(context.companyId!, params);
          return { ...res, description: res.error };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  listCategories: {
    description:
      'List product/service categories for a specific vendor. Categories may have nested subcategories.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        vendorId: {
          type: 'string',
          description: 'The vendor ID to list categories for',
        },
        lang: {
          type: 'string',
          description: 'Language code (en, ja, etc.). Default: en',
        },
      },
      required: ['vendorId'],
      additionalProperties: false,
    },
    function: async (
      params: ListCategoriesParams,
    ): Promise<StandardActionResult<RoomBossCategory[]>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing.');
      }

      return executeAction<RoomBossCategory[], ServiceLambdaResponse<RoomBossCategory[]>>(
        'listCategories',
        async () => {
          const res = await activitiesService.listCategories(context.companyId!, params);
          return { ...res, description: res.error };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  listProducts: {
    description:
      'List products/services within a category. Includes pricing, options, and availability.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        categoryId: {
          type: 'string',
          description: 'The category ID to list products for',
        },
        lang: {
          type: 'string',
          description: 'Language code (en, ja, etc.). Default: en',
        },
      },
      required: ['categoryId'],
      additionalProperties: false,
    },
    function: async (
      params: ListProductsParams,
    ): Promise<StandardActionResult<RoomBossProduct[]>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing.');
      }

      return executeAction<RoomBossProduct[], ServiceLambdaResponse<RoomBossProduct[]>>(
        'listProducts',
        async () => {
          const res = await activitiesService.listProducts(context.companyId!, params);
          return { ...res, description: res.error };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },
});
