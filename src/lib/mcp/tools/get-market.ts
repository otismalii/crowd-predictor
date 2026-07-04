import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "get_market",
  title: "Get market",
  description: "Fetch a single Pagaza market with its outcomes and current odds.",
  inputSchema: {
    market_id: z.string().uuid().describe("The market id."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ market_id }) => {
    const supabase = supabaseAnon();
    const { data, error } = await supabase
      .from("markets")
      .select("*, market_outcomes(*)")
      .eq("id", market_id)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Market not found" }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { market: data },
    };
  },
});
