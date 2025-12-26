// Math utilities - WAD fixed-point, AMM calculations, yield math

export * from './wad';
// fp.ts - exclude functions that are also in amm.ts
export {
  type Fixed,
  CUBIT_ONE,
  MAX_WAD,
  wadToFixed,
  fixedToWad,
  numberToFixed,
  fixedToNumber,
  sqrtWad,
  powWad,
  log2Wad,
  exp2Wad,
  proportionWad,
  percentageChangeWad,
  f128,
} from './fp';
// amm.ts - primary source for exp/ln functions
export * from './amm';
export * from './yield';
export * from './apy-breakdown';
