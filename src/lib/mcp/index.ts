import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMarketsTool from "./tools/list-markets";
import getMarketTool from "./tools/get-market";
import getWalletTool from "./tools/get-wallet";
import listPositionsTool from "./tools/list-positions";
import listTradesTool from "./tools/list-trades";

// The OAuth issuer MUST be the direct Supabase host derived from the project
// ref — never SUPABASE_URL (which may be a proxy). Vite inlines the project ref
// at build time, keeping this file import-safe.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "pagaza-mcp",
  title: "Pagaza Prediction Markets",
  version: "0.1.0",
  instructions:
    "Tools for the Pagaza Kenya prediction market app. Use `list_markets` and `get_market` to explore markets. `get_wallet`, `list_positions`, and `list_recent_trades` return the signed-in user's own data. This server never places trades or moves funds.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listMarketsTool, getMarketTool, getWalletTool, listPositionsTool, listTradesTool],
});
