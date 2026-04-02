/**
 * LMSR (Logarithmic Market Scoring Rule) pricing engine.
 * Single source of truth for all price calculations.
 */

export function lmsrPrice(pools: number[], index: number, b: number): number {
  const exps = pools.map(q => Math.exp(q / b));
  const total = exps.reduce((s, e) => s + e, 0);
  return exps[index] / total;
}

export function lmsrCost(pools: number[], index: number, shares: number, b: number): number {
  const exps = pools.map(q => Math.exp(q / b));
  const costBefore = b * Math.log(exps.reduce((s, e) => s + e, 0));
  const newPools = [...pools];
  newPools[index] += shares;
  const newExps = newPools.map(q => Math.exp(q / b));
  const costAfter = b * Math.log(newExps.reduce((s, e) => s + e, 0));
  return costAfter - costBefore;
}

export function lmsrSellReturn(pools: number[], index: number, shares: number, b: number): number {
  const exps = pools.map(q => Math.exp(q / b));
  const costBefore = b * Math.log(exps.reduce((s, e) => s + e, 0));
  const newPools = [...pools];
  newPools[index] -= shares;
  const newExps = newPools.map(q => Math.exp(q / b));
  const costAfter = b * Math.log(newExps.reduce((s, e) => s + e, 0));
  return costBefore - costAfter;
}

export function lmsrPrices(pools: number[], b: number): number[] {
  return pools.map((_, i) => lmsrPrice(pools, i, b));
}
