/**
 * LMSR (Logarithmic Market Scoring Rule) pricing engine.
 * Single source of truth for all price calculations.
 */

export function lmsrPrice(pools: number[], index: number, b: number): number {
  if (pools.length === 0 || index < 0 || index >= pools.length || b === 0) return 0;
  const maxQ = Math.max(...pools);
  // Subtract max for numerical stability (prevents Infinity from Math.exp)
  const exps = pools.map(q => Math.exp((q - maxQ) / b));
  const total = exps.reduce((s, e) => s + e, 0);
  if (total === 0 || !isFinite(total)) return 1 / pools.length;
  const price = exps[index] / total;
  return Math.max(0, Math.min(1, price));
}

export function lmsrCost(pools: number[], index: number, shares: number, b: number): number {
  if (pools.length === 0 || index < 0 || index >= pools.length || b === 0) return 0;
  const maxQ = Math.max(...pools);
  const exps = pools.map(q => Math.exp((q - maxQ) / b));
  const costBefore = b * Math.log(exps.reduce((s, e) => s + e, 0)) + maxQ;
  const newPools = [...pools];
  newPools[index] += shares;
  const newMax = Math.max(...newPools);
  const newExps = newPools.map(q => Math.exp((q - newMax) / b));
  const costAfter = b * Math.log(newExps.reduce((s, e) => s + e, 0)) + newMax;
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
