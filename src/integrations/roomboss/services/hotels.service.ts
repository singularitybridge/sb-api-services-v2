/**
 * RoomBoss Hotels Service
 * Handles hotel listing, availability search, images, descriptions, and rate plans
 */

import { executeRoomBossRequest, withRoomBossClient } from '../client';
import {
  Result,
  RoomBossHotel,
  RoomBossHotelImages,
  RoomBossHotelDescription,
  RoomBossRatePlanDescription,
  ListHotelsParams,
  SearchAvailabilityParams,
  ListImagesParams,
  ListDescriptionParams,
  ListRatePlanParams,
} from '../types';

// ============================================================================
// List Hotels
// ============================================================================

export const listHotels = async (
  companyId: string,
  params: ListHotelsParams,
): Promise<Result<RoomBossHotel[]>> => {
  if (!params.countryCode) {
    return { success: false, error: 'countryCode is required.' };
  }
  if (!params.locationCode) {
    return { success: false, error: 'locationCode is required.' };
  }

  return withRoomBossClient(
    companyId,
    async (client) => {
      const response = await executeRoomBossRequest<{ hotels: RoomBossHotel[] }>(
        client,
        {
          endpoint: '/extws/hotel/v1/list',
          params: {
            countryCode: params.countryCode,
            locationCode: params.locationCode,
          },
        },
        'Failed to list hotels',
      );
      return response.hotels || [];
    },
    'Failed to list hotels',
  );
};

// ============================================================================
// Search Availability
// ============================================================================

export const searchAvailability = async (
  companyId: string,
  params: SearchAvailabilityParams,
): Promise<Result<RoomBossHotel[]>> => {
  if (!params.hotelIds?.length) {
    return { success: false, error: 'At least one hotelId is required.' };
  }
  if (!params.checkIn) {
    return { success: false, error: 'checkIn date is required (yyyyMMdd format).' };
  }
  if (!params.checkOut) {
    return { success: false, error: 'checkOut date is required (yyyyMMdd format).' };
  }
  if (!params.numberGuests || params.numberGuests < 1) {
    return { success: false, error: 'numberGuests must be at least 1.' };
  }

  return withRoomBossClient(
    companyId,
    async (client) => {
      // RoomBoss expects hotelIds[] as repeated params
      const queryParams: Record<string, unknown> = {
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        numberGuests: params.numberGuests,
        numberAdults: params.numberAdults,
        numberChildren: params.numberChildren,
        numberInfants: params.numberInfants,
        rate: params.rate,
        discountCode: params.discountCode,
      };

      // Add hotelIds as array notation for query string
      params.hotelIds.forEach((id, index) => {
        queryParams[`hotelIds[${index}]`] = id;
      });

      const response = await executeRoomBossRequest<{ hotels: RoomBossHotel[] }>(
        client,
        {
          endpoint: '/extws/hotel/v1/listAvailable',
          params: queryParams,
        },
        'Failed to search availability',
      );
      return response.hotels || [];
    },
    'Failed to search availability',
  );
};

// ============================================================================
// List Images
// ============================================================================

export const listImages = async (
  companyId: string,
  params: ListImagesParams,
): Promise<Result<RoomBossHotelImages>> => {
  if (!params.hotelId) {
    return { success: false, error: 'hotelId is required.' };
  }

  return withRoomBossClient(
    companyId,
    async (client) => {
      const response = await executeRoomBossRequest<RoomBossHotelImages>(
        client,
        {
          endpoint: '/extws/hotel/v1/listImage',
          params: { hotelId: params.hotelId },
        },
        'Failed to list images',
      );
      return response;
    },
    'Failed to list images',
  );
};

// ============================================================================
// List Description
// ============================================================================

export const listDescription = async (
  companyId: string,
  params: ListDescriptionParams,
): Promise<Result<RoomBossHotelDescription>> => {
  if (!params.hotelId) {
    return { success: false, error: 'hotelId is required.' };
  }

  return withRoomBossClient(
    companyId,
    async (client) => {
      const response = await executeRoomBossRequest<RoomBossHotelDescription>(
        client,
        {
          endpoint: '/extws/hotel/v1/listDescription',
          params: {
            hotelId: params.hotelId,
            locale: params.locale || 'en',
          },
        },
        'Failed to get hotel description',
      );
      return response;
    },
    'Failed to get hotel description',
  );
};

// ============================================================================
// List Rate Plan Descriptions
// ============================================================================

export const listRatePlanDescription = async (
  companyId: string,
  params: ListRatePlanParams,
): Promise<Result<RoomBossRatePlanDescription>> => {
  if (!params.hotelId) {
    return { success: false, error: 'hotelId is required.' };
  }

  return withRoomBossClient(
    companyId,
    async (client) => {
      const response = await executeRoomBossRequest<RoomBossRatePlanDescription>(
        client,
        {
          endpoint: '/extws/hotel/v1/listRatePlanDescription',
          params: {
            hotelId: params.hotelId,
            locale: params.locale || 'en',
          },
        },
        'Failed to list rate plans',
      );
      return response;
    },
    'Failed to list rate plans',
  );
};
