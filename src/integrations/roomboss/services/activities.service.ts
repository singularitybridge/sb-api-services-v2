/**
 * RoomBoss Activities Service
 * Handles guest services - vendors, categories, products (GS Purchasing API)
 */

import { executeRoomBossRequest, withRoomBossClient } from '../client';
import {
  Result,
  RoomBossVendor,
  RoomBossCategory,
  RoomBossProduct,
  ListVendorsParams,
  ListCategoriesParams,
  ListProductsParams,
} from '../types';

// ============================================================================
// List Vendors
// ============================================================================

export const listVendors = async (
  companyId: string,
  params: ListVendorsParams,
): Promise<Result<RoomBossVendor[]>> => {
  if (!params.countryCode) {
    return { success: false, error: 'countryCode is required.' };
  }
  if (!params.locationCode) {
    return { success: false, error: 'locationCode is required.' };
  }

  return withRoomBossClient(
    companyId,
    async (client) => {
      const response = await executeRoomBossRequest<{ vendors: RoomBossVendor[] }>(
        client,
        {
          endpoint: '/extws/gs/v1/vendors/list',
          params: {
            countryCode: params.countryCode,
            locationCode: params.locationCode,
          },
        },
        'Failed to list vendors',
      );
      return response.vendors || [];
    },
    'Failed to list vendors',
  );
};

// ============================================================================
// List Categories
// ============================================================================

export const listCategories = async (
  companyId: string,
  params: ListCategoriesParams,
): Promise<Result<RoomBossCategory[]>> => {
  if (!params.vendorId) {
    return { success: false, error: 'vendorId is required.' };
  }

  return withRoomBossClient(
    companyId,
    async (client) => {
      const response = await executeRoomBossRequest<{ categories: RoomBossCategory[] }>(
        client,
        {
          endpoint: '/extws/gs/v1/categories/list',
          params: {
            vendorId: params.vendorId,
            lang: params.lang || 'en',
          },
        },
        'Failed to list categories',
      );
      return response.categories || [];
    },
    'Failed to list categories',
  );
};

// ============================================================================
// List Products
// ============================================================================

export const listProducts = async (
  companyId: string,
  params: ListProductsParams,
): Promise<Result<RoomBossProduct[]>> => {
  if (!params.categoryId) {
    return { success: false, error: 'categoryId is required.' };
  }

  return withRoomBossClient(
    companyId,
    async (client) => {
      const response = await executeRoomBossRequest<{ products: RoomBossProduct[] }>(
        client,
        {
          endpoint: '/extws/gs/v1/products/list',
          params: {
            categoryId: params.categoryId,
            lang: params.lang || 'en',
          },
        },
        'Failed to list products',
      );
      return response.products || [];
    },
    'Failed to list products',
  );
};
