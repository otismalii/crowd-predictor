// UserService — profile, wallet, positions, notifications for the authenticated caller.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export class UserService {
  constructor(private db: SupabaseClient) {}

  async publicProfile(userId: string) {
    const { data, error } = await this.db
      .from("profiles")
      .select("id, username, avatar_url, bio, reputation_score, accuracy_rate, current_streak, best_streak, followers_count, created_at")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async ownProfile(userId: string) {
    const { data, error } = await this.db
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async wallet(userId: string) {
    const { data, error } = await this.db
      .from("wallets")
      .select("id, balance, pending_balance, locked_balance, bonus_balance, escrow_balance, currency, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async positions(userId: string) {
    const { data, error } = await this.db
      .from("positions")
      .select("id, shares, avg_price, total_cost, updated_at, market:markets ( id, slug, title, status ), outcome:market_outcomes ( id, label, is_winner )")
      .eq("user_id", userId)
      .gt("shares", 0)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async trades(userId: string, limit = 50) {
    const { data, error } = await this.db
      .from("trades")
      .select("id, side, shares, price_per_share, total_cost, created_at, market:markets ( id, slug, title ), outcome:market_outcomes ( id, label )")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 200));
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async notifications(userId: string, limit = 30) {
    const { data, error } = await this.db
      .from("notifications")
      .select("id, type, title, message, link, is_read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 100));
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async markNotificationsRead(userId: string, ids?: string[]) {
    let query = this.db.from("notifications").update({ is_read: true }).eq("user_id", userId);
    if (ids?.length) query = query.in("id", ids);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { updated: ids?.length ?? null };
  }

  async leaderboard(limit = 50) {
    const { data, error } = await this.db
      .from("profiles")
      .select("id, username, avatar_url, reputation_score, accuracy_rate, current_streak, best_streak")
      .order("reputation_score", { ascending: false })
      .limit(Math.min(limit, 200));
    if (error) throw new Error(error.message);
    return data ?? [];
  }
}
