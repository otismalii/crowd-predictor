import { describe, it, expect } from "vitest";
import { dedupeFixtures, normalizeTeam } from "@/lib/fixtureDedup";

const fx = (id: string, h: string, a: string, status: string, k = "2026-11-06T19:00:00Z") =>
  ({ id, kickoff_at: k, status, home_team: { name: h }, away_team: { name: a } });

describe("fixture dedup", () => {
  it("treats provider name variants as the same team", () => {
    expect(normalizeTeam("Everton FC")).toBe(normalizeTeam("Everton"));
    expect(normalizeTeam("Heart of Midlothian")).toBe(normalizeTeam("Hearts"));
    expect(normalizeTeam("Hamburger SV")).toBe(normalizeTeam("Hamburg"));
  });

  it("keeps the finished copy over a postponed clone", () => {
    const out = dedupeFixtures([fx("a", "Aberdeen", "Falkirk", "postponed"), fx("b", "Aberdeen", "Falkirk", "finished")]);
    expect(out.map((f) => f.id)).toEqual(["b"]);
  });

  it("collapses two upcoming copies to one", () => {
    expect(dedupeFixtures([fx("a", "Venezia FC", "Udinese Calcio", "upcoming"), fx("b", "Venezia", "Udinese", "upcoming")])).toHaveLength(1);
  });

  it("keeps different matches", () => {
    expect(dedupeFixtures([fx("a", "Everton", "Chelsea", "upcoming"), fx("b", "Everton", "Coventry City", "upcoming")])).toHaveLength(2);
  });
});
