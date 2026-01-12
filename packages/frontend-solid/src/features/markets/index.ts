// Markets feature barrel export
export {
  useMarkets,
  useMarketAddresses,
  useAllMarketAddresses,
  useMarketCount,
  useKnownMarkets,
  useDashboardMarkets,
  marketKeys,
  type MarketInfo,
  type MarketState,
  type MarketTokenMetadata,
  type MarketData,
  type UseMarketsOptions,
  type UseMarketsReturn,
} from './model/useMarkets';

export {
  useMarket,
  useMarketInfo,
  useMarketState,
  type UseMarketOptions,
  type UseMarketReturn,
  type UseMarketInfoReturn,
  type UseMarketStateReturn,
} from './model/useMarket';

export {
  useMarketRates,
  marketRatesKeys,
  type MarketRateDataPoint,
  type MarketRatesResponse,
  type ProcessedRateDataPoint,
  type ProcessedRatesData,
  type UseMarketRatesOptions,
  type UseMarketRatesReturn,
} from './model/useMarketRates';
