import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * API Validation Schemas
 *
 * Zod schemas for validating API route query parameters.
 * Use with `validateQuery()` helper for consistent error handling.
 */

// =============================================================================
// Common Schema Components
// =============================================================================

/**
 * Starknet address validation (0x + 1-64 hex chars)
 */
export const starknetAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{1,64}$/, 'Invalid Starknet address format');

/**
 * Pagination parameters
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Date range parameter (days of history)
 */
export const dateRangeSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

/**
 * Sort order parameter
 */
export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc');

// =============================================================================
// API Route Schemas
// =============================================================================

/**
 * GET /api/markets query params
 */
export const marketsQuerySchema = z.object({
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  underlying: starknetAddressSchema.optional(),
  sort: z.enum(['volume', 'tvl', 'expiry', 'created']).default('volume'),
  order: sortOrderSchema,
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type MarketsQuery = z.infer<typeof marketsQuerySchema>;

/**
 * GET /api/analytics/volume query params
 */
export const analyticsVolumeQuerySchema = dateRangeSchema;

export type AnalyticsVolumeQuery = z.infer<typeof analyticsVolumeQuerySchema>;

/**
 * GET /api/analytics/fees query params
 */
export const analyticsFeesQuerySchema = dateRangeSchema;

export type AnalyticsFeesQuery = z.infer<typeof analyticsFeesQuerySchema>;

/**
 * GET /api/markets/[address]/swaps query params
 */
export const marketSwapsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type MarketSwapsQuery = z.infer<typeof marketSwapsQuerySchema>;

/**
 * GET /api/markets/[address]/tvl query params
 */
export const marketTvlQuerySchema = dateRangeSchema;

export type MarketTvlQuery = z.infer<typeof marketTvlQuerySchema>;

/**
 * GET /api/users/[address]/history query params
 */
export const userHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  type: z.enum(['all', 'swap', 'mint', 'redeem', 'liquidity']).default('all'),
});

export type UserHistoryQuery = z.infer<typeof userHistoryQuerySchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validation error response format
 */
interface ValidationErrorResponse {
  error: 'Validation Error';
  details: {
    path: string;
    message: string;
  }[];
}

/**
 * Parse and validate query parameters from URLSearchParams.
 * Returns typed params on success, or a NextResponse error on failure.
 *
 * @example
 * ```ts
 * const result = validateQuery(searchParams, marketsQuerySchema);
 * if (result instanceof NextResponse) return result; // Validation failed
 * const { limit, offset, sort } = result; // Typed params
 * ```
 */
export function validateQuery<T extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: T
): z.infer<T> | NextResponse<ValidationErrorResponse> {
  const params = Object.fromEntries(searchParams.entries());
  const result = schema.safeParse(params);

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join('.') || 'query',
      message: issue.message,
    }));

    return NextResponse.json(
      {
        error: 'Validation Error' as const,
        details,
      },
      { status: 400 }
    );
  }

  return result.data;
}

/**
 * Validate a route parameter (e.g., [address]).
 * Returns normalized value on success, or a NextResponse error on failure.
 *
 * @example
 * ```ts
 * const address = validateParam(params.address, starknetAddressSchema, 'address');
 * if (address instanceof NextResponse) return address;
 * ```
 */
export function validateParam<T extends z.ZodType>(
  value: string | undefined,
  schema: T,
  paramName: string
): z.infer<T> | NextResponse<ValidationErrorResponse> {
  const result = schema.safeParse(value);

  if (!result.success) {
    return NextResponse.json(
      {
        error: 'Validation Error' as const,
        details: [
          {
            path: paramName,
            message: result.error.issues[0]?.message ?? 'Invalid parameter',
          },
        ],
      },
      { status: 400 }
    );
  }

  return result.data;
}

/**
 * Normalize a Starknet address to lowercase with 0x prefix and full padding.
 * Use after validation for database lookups.
 */
export function normalizeStarknetAddress(address: string): string {
  const hex = address.toLowerCase().replace(/^0x/, '');
  const padded = hex.padStart(64, '0');
  return `0x${padded}`;
}
