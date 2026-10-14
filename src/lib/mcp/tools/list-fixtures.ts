import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "list_fixtures",
  title: "List fixtures",
  description: "List Betwise football fixtures by status (upcoming, live, finished). Returns up to 25.",
  inputSchema: {
    status: z.enum(["upcoming", "live", "finished"]).optional().describe("Fixture status (default upcoming)."),
    limit: z.number().int().min(1).max(25).optional().describe("Max rows (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }) => {
    const supabase = supabaseAnon();
    const { data, error } = await supabase
      .from("platform_matches")
      .select("id, kickoff_at, status, minute, home_score, away_score, home_team:teams!platform_matches_home_team_id_fkey(name), away_team:teams!platform_matches_away_team_id_fkey(name), match_odds(market_key, selection_key, odds)")
      .eq("status", status ?? "upcoming")
      .order("kickoff_at", { ascending: status !== "finished" })
      .limit(limit ?? 10);
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data ?? []) }], structuredContent: { fixtures: data ?? [] } };
  },
});
