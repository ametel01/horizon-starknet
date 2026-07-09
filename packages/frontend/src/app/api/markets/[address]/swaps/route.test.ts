import { describe, expect, test } from 'bun:test';

import { paginateSwaps, parseMarketSwapsQuery, type SwapEvent } from './route';

function swap(overrides: Partial<SwapEvent>): SwapEvent {
  const base: SwapEvent = {
    id: 'swap-1',
    type: 'pt',
    blockNumber: 1,
    blockTimestamp: '2026-01-01T00:00:00.000Z',
    transactionHash: '0xtx1',
    sender: '0xsender',
    receiver: '0xreceiver',
    ptIn: '0',
    syIn: '0',
    ptOut: '0',
    syOut: '0',
  };

  return { ...base, ...overrides };
}

describe('paginateSwaps', () => {
  test('sorts merged swaps newest first', () => {
    const result = paginateSwaps(
      [
        swap({
          id: 'market-old',
          transactionHash: '0xmarketold',
          blockTimestamp: '2026-01-01T00:00:00.000Z',
        }),
        swap({
          id: 'router-new',
          transactionHash: '0xrouternew',
          blockTimestamp: '2026-01-03T00:00:00.000Z',
        }),
        swap({
          id: 'yt-middle',
          type: 'yt',
          transactionHash: '0xytmiddle',
          blockTimestamp: '2026-01-02T00:00:00.000Z',
          ytIn: '10',
          ytOut: '0',
        }),
      ],
      { limit: 10, offset: 0 }
    );

    expect(result.swaps.map((item) => item.id)).toEqual(['router-new', 'yt-middle', 'market-old']);
  });

  test('prefers duplicate transaction entries with rate data', () => {
    const result = paginateSwaps(
      [
        swap({
          id: 'router-copy',
          transactionHash: '0xdupe',
          blockTimestamp: '2026-01-02T00:00:00.000Z',
        }),
        swap({
          id: 'market-copy',
          transactionHash: '0xdupe',
          blockTimestamp: '2026-01-02T00:00:00.000Z',
          impliedRateBefore: '100',
          impliedRateAfter: '101',
          exchangeRate: '200',
        }),
      ],
      { limit: 10, offset: 0 }
    );

    expect(result.swaps).toHaveLength(1);
    expect(result.swaps[0]?.id).toBe('market-copy');
    expect(result.swaps[0]?.impliedRateAfter).toBe('101');
  });

  test('limits results and reports hasMore from merged unique rows', () => {
    const result = paginateSwaps(
      [
        swap({ id: 'newest', transactionHash: '0x1', blockTimestamp: '2026-01-03T00:00:00.000Z' }),
        swap({ id: 'middle', transactionHash: '0x2', blockTimestamp: '2026-01-02T00:00:00.000Z' }),
        swap({ id: 'oldest', transactionHash: '0x3', blockTimestamp: '2026-01-01T00:00:00.000Z' }),
      ],
      { limit: 2, offset: 0 }
    );

    expect(result.swaps.map((item) => item.id)).toEqual(['newest', 'middle']);
    expect(result.total).toBe(2);
    expect(result.hasMore).toBe(true);
  });

  test('applies offset after sorting and deduplication', () => {
    const result = paginateSwaps(
      [
        swap({ id: 'newest', transactionHash: '0x1', blockTimestamp: '2026-01-03T00:00:00.000Z' }),
        swap({ id: 'middle', transactionHash: '0x2', blockTimestamp: '2026-01-02T00:00:00.000Z' }),
        swap({ id: 'oldest', transactionHash: '0x3', blockTimestamp: '2026-01-01T00:00:00.000Z' }),
      ],
      { limit: 1, offset: 1 }
    );

    expect(result.swaps.map((item) => item.id)).toEqual(['middle']);
    expect(result.total).toBe(1);
    expect(result.hasMore).toBe(true);
  });
});

describe('parseMarketSwapsQuery', () => {
  test('defaults pagination params', () => {
    const result = parseMarketSwapsQuery(new URLSearchParams());

    expect(result).not.toBeInstanceOf(Response);
    if (result instanceof Response) {
      throw new Error('expected valid market swaps query');
    }
    expect(result).toEqual({ limit: 50, offset: 0 });
  });

  test('rejects invalid limit and offset values', async () => {
    const invalidLimit = parseMarketSwapsQuery(new URLSearchParams({ limit: 'abc' }));
    const invalidOffset = parseMarketSwapsQuery(new URLSearchParams({ offset: '-1' }));

    expect(invalidLimit).toBeInstanceOf(Response);
    expect(invalidOffset).toBeInstanceOf(Response);
    if (!(invalidLimit instanceof Response) || !(invalidOffset instanceof Response)) {
      throw new Error('expected validation errors');
    }

    expect(invalidLimit.status).toBe(400);
    expect(invalidOffset.status).toBe(400);
    await expect(invalidLimit.json()).resolves.toMatchObject({
      error: 'Validation Error',
    });
  });
});
