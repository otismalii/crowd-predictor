/** Kenyan withholding tax (KRA) on betting winnings: 20% of net winnings (payout minus stake). */
export const KRA_WINNINGS_TAX_RATE = 0.2;

export function computeWinningsTax(stake: number, grossPayout: number) {
  const netWinnings = Math.max(0, grossPayout - stake);
  const tax = Math.round(netWinnings * KRA_WINNINGS_TAX_RATE * 100) / 100;
  return { grossPayout, netWinnings, tax, netPayout: Math.round((grossPayout - tax) * 100) / 100 };
}
