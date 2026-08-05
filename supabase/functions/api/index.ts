// Platform API gateway — the single versioned surface shared by Pagaza Markets and LOGIK Betwise.
// Every handler delegates to a service in ../_shared/services/*. No business rules live here.
import { apiErr, apiOk, cached } from "../_shared/api.ts";
import { ADMIN_ROLES, apiCorsHeaders, Caller, hasAnyRole, identify, rateLimit, serviceClient } from "../_shared/security.ts";
import { FootballService } from "../_shared/services/football.ts";
import { MarketService } from "../_shared/services/markets.ts";
import { UserService } from "../_shared/services/users.ts";
import { IntelligenceService } from "../_shared/services/intelligence.ts";
import { SystemService } from "../_shared/services/system.ts";

function segments(pathname: string): string[] {
  const parts = pathname.split("/").filter(Boolean);
  const versionIndex = parts.indexOf("v1");
  return versionIndex >= 0 ? parts.slice(versionIndex + 1) : parts.filter((p) => p !== "api");
}

function intParam(url: URL, key: string): number | undefined {
  const raw = url.searchParams.get(key);
  if (!raw) return undefined;
  const value = parseInt(raw, 10);
  return Number.isNaN(value) ? undefined : value;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: apiCorsHeaders });

  const url = new URL(req.url);
  const path = segments(url.pathname);
  if (!path.length) return apiErr("Unknown endpoint", 404);

  const db = serviceClient();
  let caller: Caller;
  try {
    caller = await identify(req, db);
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : "Auth failed", 401);
  }

  const limit = await rateLimit(db, caller, caller.kind === "anon" ? "anon" : "auth", caller.kind === "anon" ? 120 : 600);
  if (!limit.allowed) return apiErr("Rate limit exceeded", 429, { remaining: 0 });

  const requireUser = () => {
    if (!caller.userId) throw Object.assign(new Error("Authentication required"), { status: 401 });
    return caller.userId;
  };
  const requireAdmin = () => {
    requireUser();
    if (!hasAnyRole(caller, ADMIN_ROLES)) throw Object.assign(new Error("Forbidden"), { status: 403 });
  };

  const football = new FootballService(db);
  const markets = new MarketService(db);
  const users = new UserService(db);
  const intelligence = new IntelligenceService(db);
  const system = new SystemService(db);
  const meta = { caller: caller.kind, product: caller.product, remaining: limit.remaining };

  try {
    const [root, second, third] = path;

    switch (root) {
      // ---------- auth / profile ----------
      case "auth":
        if (second === "session") {
          return apiOk(
            caller.userId
              ? { authenticated: true, user_id: caller.userId, roles: caller.roles }
              : { authenticated: false, user_id: null, roles: [] },
            meta,
          );
        }
        break;

      case "profile": {
        const userId = requireUser();
        if (req.method === "GET") return apiOk(await users.ownProfile(userId), meta);
        break;
      }

      case "wallet":
        return apiOk(await users.wallet(requireUser()), meta);

      case "positions":
        return apiOk(await users.positions(requireUser()), meta);

      case "trades":
        return apiOk(await users.trades(requireUser(), intParam(url, "limit")), meta);

      case "notifications": {
        const userId = requireUser();
        if (req.method === "POST") {
          const body = await req.json().catch(() => ({}));
          return apiOk(await users.markNotificationsRead(userId, body.ids), meta);
        }
        return apiOk(await users.notifications(userId, intParam(url, "limit")), meta);
      }

      case "users":
        if (second) return apiOk(await users.publicProfile(second), meta);
        break;

      case "leaderboard":
        return apiOk(await users.leaderboard(intParam(url, "limit")), meta);

      // ---------- football core ----------
      case "leagues":
      case "competitions": {
        const { value, hit } = await cached(db, "api:competitions", ["football", "competitions"], 300, () =>
          football.listCompetitions(),
        );
        return apiOk(value, { ...meta, cache: hit ? "hit" : "miss" });
      }

      case "teams":
        if (second) return apiOk(await football.getTeam(second), meta);
        return apiOk(await football.listTeams(url.searchParams.get("search") ?? undefined, intParam(url, "limit")), meta);

      case "matches": {
        if (second && third === "events") return apiOk(await football.listMatchEvents(second), meta);
        if (second && third === "markets") return apiOk(await markets.list({ match: second }), meta);
        if (second) {
          const match = await football.getMatch(second);
          return match ? apiOk(match, meta) : apiErr("Match not found", 404);
        }
        const query = {
          status: url.searchParams.get("status") ?? undefined,
          competition: url.searchParams.get("competition") ?? undefined,
          team: url.searchParams.get("team") ?? undefined,
          from: url.searchParams.get("from") ?? undefined,
          to: url.searchParams.get("to") ?? undefined,
          limit: intParam(url, "limit"),
          offset: intParam(url, "offset"),
        };
        const key = `api:matches:${JSON.stringify(query)}`;
        const { value, hit } = await cached(db, key, ["football", "matches"], 30, () => football.listMatches(query));
        return apiOk(value, { ...meta, cache: hit ? "hit" : "miss" });
      }

      case "events":
        if (second) return apiOk(await football.listMatchEvents(second), meta);
        break;

      // ---------- markets ----------
      case "markets": {
        if (second && third === "trades") return apiOk(await markets.recentTrades(second, intParam(url, "limit")), meta);
        if (second && third === "trends") return apiOk(await markets.trends(second), meta);
        if (second && third === "comments") return apiOk(await markets.comments(second, intParam(url, "limit")), meta);
        if (second && third === "intelligence") return apiOk(await intelligence.forMarket(second), meta);
        if (second && third === "sources") return apiOk(await intelligence.sources(second), meta);
        if (second) {
          const market = await markets.get(second);
          return market ? apiOk(market, meta) : apiErr("Market not found", 404);
        }
        const query = {
          status: url.searchParams.get("status") ?? undefined,
          category: url.searchParams.get("category") ?? undefined,
          match: url.searchParams.get("match") ?? undefined,
          search: url.searchParams.get("search") ?? undefined,
          sort: (url.searchParams.get("sort") as any) ?? undefined,
          limit: intParam(url, "limit"),
          offset: intParam(url, "offset"),
        };
        const key = `api:markets:${JSON.stringify(query)}`;
        const { value, hit } = await cached(db, key, ["markets"], 20, () => markets.list(query));
        return apiOk(value, { ...meta, cache: hit ? "hit" : "miss" });
      }

      // ---------- intelligence ----------
      case "intelligence":
        if (second === "runs") {
          requireAdmin();
          return apiOk(await intelligence.recentRuns(intParam(url, "limit")), meta);
        }
        if (second) return apiOk(await intelligence.forMarket(second), meta);
        break;

      // ---------- platform system ----------
      case "system":
        if (second === "health" || !second) return apiOk(await system.health(), meta);
        if (second === "flags") return apiOk(await system.featureFlags(caller.product), meta);
        break;

      case "flags":
        return apiOk(await system.featureFlags(caller.product), meta);

      case "search": {
        const term = url.searchParams.get("q");
        if (!term || term.length < 2) return apiErr("Query must be at least 2 characters", 400);
        return apiOk(await system.search(term, intParam(url, "limit")), meta);
      }

      case "providers":
        requireAdmin();
        return apiOk(await system.providers(), meta);

      case "admin":
        requireAdmin();
        if (second === "providers") return apiOk(await system.providers(), meta);
        if (second === "sync-logs") return apiOk(await system.syncLogs(intParam(url, "limit")), meta);
        if (second === "sync-jobs") return apiOk(await system.syncJobs(intParam(url, "limit")), meta);
        if (second === "flags") return apiOk(await system.featureFlags("all"), meta);
        break;
    }

    return apiErr(`Unknown endpoint: /${path.join("/")}`, 404);
  } catch (e: any) {
    const status = e?.status ?? 500;
    if (status >= 500) console.error("[api]", path.join("/"), e);
    return apiErr(e?.message ?? "Unexpected error", status, meta);
  }
});
