import { describe, it, expect } from "vitest";
import { computeWinningsTax } from "@/lib/kraTax";

describe("KRA 20% winnings tax", () => {
  it("taxes 20% of net winnings, not the stake", () => {
    const r = computeWinningsTax(100, 500);
    expect(r.tax).toBe(80);
    expect(r.netPayout).toBe(420);
  });
  it("charges no tax when payout does not exceed stake", () => {
    expect(computeWinningsTax(100, 100).tax).toBe(0);
  });
});
