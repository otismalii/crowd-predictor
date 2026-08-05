// MarketService — prediction-market reads for every product. Writes stay in their dedicated functions.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const MARKET_SELECT = `
  id, slug, title, description, category, subcategory, status, total_volume,
  liquidity_param, closes_at, resolved_at, created_at, image_url, alt_text, tags,
  risk_level, confidence_score, resolution_rule, resolution_source,
  platform_match_id, match_id,
  outcomes:market_outcomes ( id, label, pool_shares, is_winner, sort_order )
`;

export interface MarketQuery {
  status?: string;
  category?: string;
  match?: string;
  search?: string;
  sort?: "trending" | "closing" | "newest" | "volume";
  limit?: number;
  offset?: number;
}

export class MarketService {
  constructor(private db: SupabaseClient) {}

  async list(q: MarketQuery) {
    const limit = Math.min(q.limit ?? 30, 100);
    const offset = q.offset ?? 0;
    let query = this.db.from("markets").select(MARKET_SELECT).range(offset, offset + limit - 1);

    query = q.status
      ? query.eq("status", q.status)
      : query.in("status", ["open", "published", "active", "closed", "resolved"]);
    if (q.category) query = query.eq("category", q.category);
    if (q.match) query = query.eq("platform_match_id", q.match);
    if (q.search) query = query.ilike("title", `%${q.search}%`);

    switch (q.sort) {
      case "closing":
        query = query.order("closes_at", { ascending: true, nullsFirst: false });
        break;
      case "volume":
      case "trending":
        query = query.order("total_volume", { ascending: false });
        break;
      default:
        query = query.order("created_at", { ascending: false });
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async get(idOrSlug: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(idOrSlug);
    const { data, error } = await this.db
      .from("markets")
      .select(MARKET_SELECT)
      .eq(isUuid ? "id" : "slug", idOrSlug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async recentTrades(marketId: string, limit = 30) {
    const { data, error } = await this.db.rpc("get_market_recent_trades", {
      p_market_id: marketId,
      p_limit: Math.min(limit, 100),
    });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async trends(marketId: string) {
    const { data, error } = await this.db
      .from("market_trends")
      .select("window, volume_delta, price_delta, unique_traders, trade_count, computed_at")
      .eq("market_id", marketId)
      .order("computed_at", { ascending: false })
      .limit(6);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async comments(marketId: string, limit = 50) {
    const { data, error } = await this.db
      .from("market_comments")
      .select("id, content, parent_id, created_at, user_id, profiles:profiles ( username, avatar_url )")
      .eq("market_id", marketId)
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 200));
    if (error) throw new Error(error.message);
    return data ?? [];
  }
}
