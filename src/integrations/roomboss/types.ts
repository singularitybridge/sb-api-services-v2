/**
 * RoomBoss Integration Types
 * Type definitions for the RoomBoss hotel management API integration
 */

// ============================================================================
// Core Result Type
// ============================================================================

export interface Result<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ============================================================================
// Hotel Types
// ============================================================================

export interface RoomBossHotel {
  hotelId: string;
  hotelName: string;
  countryCode: string;
  locationCode: string;
  latitude?: number;
  longitude?: number;
  currencyCode: string;
  url?: string;
  internalInventory: boolean;
  recordGuestType: boolean;
  maxAgeChildren: number;
  maxAgeInfants: number;
  attributes?: string[];
  roomTypes: RoomBossRoomType[];
}

export interface RoomBossRoomType {
  roomTypeId: string;
  roomTypeName: string;
  maxNumberGuests: number;
  numberBedrooms: number;
  numberBathrooms: number;
  maxNumberAdults: number;
  maxNumberChildren: number;
  maxNumberInfants: number;
  attributes?: string[];
  quantityAvailable?: number;
  priceRetail?: number;
  priceRack?: number;
  priceNet?: number;
  priceNumberGuests?: number;
  ratePlan?: RoomBossRatePlan;
}

export interface RoomBossRatePlan {
  ratePlanId: number;
  ratePlanName?: string;
  priceRetail: number;
  mealsIncluded: boolean;
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
  rateRestrictionIgnored: boolean;
  discountCode?: string;
  description?: string;
  cancellationPolicy?: string;
}

// ============================================================================
// Image & Description Types
// ============================================================================

export interface RoomBossHotelImages {
  hotelId: string;
  hotelImages: Record<string, string>;
  roomTypes: {
    roomTypeId: string;
    roomTypeImages?: Record<string, string>;
  }[];
}

export interface RoomBossHotelDescription {
  hotelId: string;
  hotelName: string;
  hotelDescription: string;
  roomTypes: {
    roomTypeId: string;
    roomTypeName: string;
    roomTypeDescription: string;
  }[];
}

export interface RoomBossRatePlanDescription {
  hotelId: string;
  ratePlans: {
    ratePlanId: number;
    ratePlanName: string;
    ratePlanDescription?: string;
    mealsIncluded?: boolean;
    breakfast?: boolean;
    lunch?: boolean;
    dinner?: boolean;
  }[];
}

// ============================================================================
// Booking Types
// ============================================================================

export interface RoomBossBooking {
  bookingId: string;
  customId?: string;
  active: boolean;
  extent: 'RESERVATION' | 'REQUEST' | 'REQUEST_INTERNAL';
  roomStatus?: string;
  createdDate: string;
  lastModifiedDate?: string;
  bookingType: string;
  bookingSource?: string;
  notes?: string;
  guestIntranetUrl?: string;
  hotel: RoomBossHotel;
  items: RoomBossBookingItem[];
  leadGuest?: RoomBossLeadGuest;
  invoicePayments?: RoomBossInvoicePayment[];
}

export interface RoomBossBookingItem {
  itemId: string;
  roomType: RoomBossRoomType;
  checkIn: string;
  checkOut: string;
  numberGuests: number;
  numberAdults: number;
  numberChildren: number;
  numberInfants: number;
  priceRetail: number;
  priceRack: number;
  priceNet: number;
  roomNumber?: string;
  checkedIn?: boolean;
  checkedOut?: boolean;
}

export interface RoomBossLeadGuest {
  givenName: string;
  familyName: string;
  email?: string;
  phoneNumber?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  nationality?: string;
  dateOfBirth?: string;
  country?: string;
  city?: string;
  address1?: string;
  postcode?: string;
}

export interface RoomBossInvoicePayment {
  invoiceNumber: string;
  invoiceId: string;
  invoiceDate: string;
  invoiceAmount: number;
  invoiceDueDate: string;
  paymentAmount: number;
  paymentMethod?: string;
  paymentDate?: string;
}

// ============================================================================
// Guest Services Types
// ============================================================================

export interface RoomBossVendor {
  id: string;
  name: string;
  image?: string;
  description?: string;
  url?: string;
  countryCode: string;
  locationCode: string;
  latitude?: number;
  longitude?: number;
  currencyCode: string;
  vendorType: string;
  bookingPermission: string;
  bookAndPayEnabled: boolean;
}

export interface RoomBossCategory {
  id: string;
  name: string;
  image?: string;
  description?: string;
  sequence: number;
  active: boolean;
  hasOffers: boolean;
  children: RoomBossCategory[];
}

export interface RoomBossProduct {
  id: string;
  name: string;
  description?: string;
  image?: string;
  sequence: number;
  hasOffers: boolean;
  guestImageRequired: boolean;
  productOptions: RoomBossProductOption[];
  unbookableDates: { startDate: string; endDate: string }[];
}

export interface RoomBossProductOption {
  id: string;
  position: string;
  label: string;
  inputType: 'DROP_DOWN' | 'FREE_TEXT' | 'FIXED';
  compulsory: boolean;
  value?: string | number;
  selectItems?: { label: string; value: string | number }[];
}

// ============================================================================
// Request Parameter Types
// ============================================================================

export interface ListHotelsParams {
  countryCode: string;
  locationCode: string;
}

export interface SearchAvailabilityParams {
  hotelIds: string[];
  checkIn: string; // yyyyMMdd format
  checkOut: string; // yyyyMMdd format
  numberGuests: number;
  numberAdults?: number;
  numberChildren?: number;
  numberInfants?: number;
  rate?: string;
  discountCode?: string;
}

export interface ListImagesParams {
  hotelId: string;
}

export interface ListDescriptionParams {
  hotelId: string;
  locale?: string; // en, ja, zh, ko
}

export interface ListRatePlanParams {
  hotelId: string;
  locale?: string;
}

export interface ListBookingsByDateParams {
  hotelId: string;
  date: string; // yyyyMMdd format
}

export interface CreateBookingParams {
  hotelId: string;
  roomTypeId: string;
  ratePlanId: number;
  checkIn: string; // yyyyMMdd format
  checkOut: string; // yyyyMMdd format
  numberGuests: number;
  numberAdults?: number;
  numberChildren?: number;
  numberInfants?: number;
  guestGivenName: string;
  guestFamilyName: string;
  guestEmail?: string;
  contactNumber?: string;
  priceRetailMax: number;
  bookingExtent?: 'RESERVATION' | 'REQUEST' | 'REQUEST_INTERNAL';
  comment?: string;
}

export interface GetBookingParams {
  bookingId: string;
}

export interface CancelBookingParams {
  bookingId: string;
}

export interface ListVendorsParams {
  countryCode: string;
  locationCode: string;
}

export interface ListCategoriesParams {
  vendorId: string;
  lang?: string;
}

export interface ListProductsParams {
  categoryId: string;
  lang?: string;
}
