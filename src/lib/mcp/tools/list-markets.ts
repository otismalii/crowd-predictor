import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "list_markets",
  title: "List markets",
  description: "List prediction markets on Pagaza, optionally filtered by status or category. Returns up to 25 markets.",
  inputSchema: {
    status: z.enum(["open", "closed", "resolved", "draft"]).optional().describe("Filter by lifecycle status."),
    category: z.string().optional().describe("Filter by category (e.g. sports, politics)."),
    limit: z.number().int().min(1).max(25).optional().describe("Max rows to return (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, category, limit }) => {
    const supabase = supabaseAnon();
    let q = supabase
      .from("markets")
      .select("id, title, category, status, total_volume, closes_at, mqi_score")
      .is("deleted_at", null)
      .order("total_volume", { ascending: false })
      .limit(limit ?? 10);
    if (status) q = q.eq("status", status);
    if (category) q = q.eq("category", category);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { markets: data ?? [] },
    };
  },
});
