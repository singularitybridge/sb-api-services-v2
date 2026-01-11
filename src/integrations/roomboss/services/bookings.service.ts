/**
 * RoomBoss Bookings Service
 * Handles booking creation, retrieval, listing, and cancellation
 */

import { executeRoomBossRequest, withRoomBossClient } from '../client';
import {
  Result,
  RoomBossBooking,
  CreateBookingParams,
  GetBookingParams,
  CancelBookingParams,
  ListBookingsByDateParams,
} from '../types';

// ============================================================================
// Create Booking
// ============================================================================

export const createBooking = async (
  companyId: string,
  params: CreateBookingParams,
): Promise<Result<RoomBossBooking>> => {
  // Validate required fields
  if (!params.hotelId) {
    return { success: false, error: 'hotelId is required.' };
  }
  if (!params.roomTypeId) {
    return { success: false, error: 'roomTypeId is required.' };
  }
  if (!params.ratePlanId) {
    return { success: false, error: 'ratePlanId is required.' };
  }
  if (!params.checkIn) {
    return { success: false, error: 'checkIn date is required (yyyyMMdd format).' };
  }
  if (!params.checkOut) {
    return { success: false, error: 'checkOut date is required (yyyyMMdd format).' };
  }
  if (!params.guestGivenName) {
    return { success: false, error: 'guestGivenName is required.' };
  }
  if (!params.guestFamilyName) {
    return { success: false, error: 'guestFamilyName is required.' };
  }
  if (!params.priceRetailMax) {
    return { success: false, error: 'priceRetailMax is required.' };
  }

  return withRoomBossClient(
    companyId,
    async (client) => {
      const response = await executeRoomBossRequest<{ order: RoomBossBooking }>(
        client,
        {
          endpoint: '/extws/hotel/v1/createBooking',
          params: {
            hotelId: params.hotelId,
            roomTypeId: params.roomTypeId,
            ratePlanId: params.ratePlanId,
            checkIn: params.checkIn,
            checkOut: params.checkOut,
            numberGuests: params.numberGuests,
            numberAdults: params.numberAdults,
            numberChildren: params.numberChildren,
            numberInfants: params.numberInfants,
            guestGivenName: params.guestGivenName,
            guestFamilyName: params.guestFamilyName,
            guestEmail: params.guestEmail,
            contactNumber: params.contactNumber,
            priceRetailMax: params.priceRetailMax,
            bookingExtent: params.bookingExtent || 'RESERVATION',
            comment: params.comment,
          },
        },
        'Failed to create booking',
      );

      // Extract booking from the order response
      if (response.order?.bookings?.[0]) {
        return response.order.bookings[0];
      }

      // Return as-is if structure differs
      return response as unknown as RoomBossBooking;
    },
    'Failed to create booking',
  );
};

// ============================================================================
// List Bookings by Date
// ============================================================================

export const listBookingsByDate = async (
  companyId: string,
  params: ListBookingsByDateParams,
): Promise<Result<RoomBossBooking[]>> => {
  if (!params.hotelId) {
    return { success: false, error: 'hotelId is required.' };
  }
  if (!params.date) {
    return { success: false, error: 'date is required (yyyyMMdd format).' };
  }

  return withRoomBossClient(
    companyId,
    async (client) => {
      const response = await executeRoomBossRequest<{ bookings: RoomBossBooking[] }>(
        client,
        {
          endpoint: '/extws/hotel/v1/listBookings',
          params: {
            hotelId: params.hotelId,
            date: params.date,
          },
        },
        'Failed to list bookings',
      );
      return response.bookings || [];
    },
    'Failed to list bookings',
  );
};

// ============================================================================
// Get Booking by ID
// ============================================================================

export const getBooking = async (
  companyId: string,
  params: GetBookingParams,
): Promise<Result<RoomBossBooking>> => {
  if (!params.bookingId) {
    return { success: false, error: 'bookingId is required.' };
  }

  return withRoomBossClient(
    companyId,
    async (client) => {
      const response = await executeRoomBossRequest<{ order: { bookings: RoomBossBooking[] } }>(
        client,
        {
          endpoint: '/extws/hotel/v1/listBooking',
          params: { bookingId: params.bookingId },
        },
        'Failed to get booking',
      );

      // Extract first booking from the order
      if (response.order?.bookings?.[0]) {
        return response.order.bookings[0];
      }

      throw new Error(`Booking ${params.bookingId} not found`);
    },
    'Failed to get booking',
  );
};

// ============================================================================
// Cancel Booking
// ============================================================================

export const cancelBooking = async (
  companyId: string,
  params: CancelBookingParams,
): Promise<Result<{ bookingId: string; status: string; message: string }>> => {
  if (!params.bookingId) {
    return { success: false, error: 'bookingId is required.' };
  }

  return withRoomBossClient(
    companyId,
    async (client) => {
      const response = await executeRoomBossRequest<{
        success?: boolean;
        message?: string;
        status?: string;
      }>(
        client,
        {
          endpoint: '/extws/hotel/v1/cancelBooking',
          params: { bookingId: params.bookingId },
        },
        'Failed to cancel booking',
      );

      return {
        bookingId: params.bookingId,
        status: response.status || 'cancelled',
        message: response.message || `Booking ${params.bookingId} has been cancelled.`,
      };
    },
    'Failed to cancel booking',
  );
};
