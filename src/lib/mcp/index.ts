import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listFixturesTool from "./tools/list-fixtures";
import getWalletTool from "./tools/get-wallet";
import listBetSlipsTool from "./tools/list-bet-slips";

// The OAuth issuer MUST be the direct Supabase host derived from the project
// ref — never SUPABASE_URL (which may be a proxy).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "betwise-mcp",
  title: "Betwise Sportsbook",
  version: "0.2.0",
  instructions:
    "Read-only tools for the Betwise Kenyan sportsbook. Use `list_fixtures` for football fixtures and odds. `get_wallet` and the other user tools return the signed-in user's own data. This server never places bets or moves funds.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
});
