import { supabase } from "@/integrations/supabase/client";
import { safeFetch } from "@/lib/api";

// ============ Audited admin actions ============
// All privileged mutations run through edge functions that enforce the admin
// role + a mandatory reason and write the immutable audit_logs entry.

export type AdminActionFn =
  | "admin-sportsbook-actions"
  | "admin-finance-actions"
  | "admin-audit-log";

export async function adminAction<T = any>(
  fn: AdminActionFn,
  body: Record<string, unknown>
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke(fn, { body });
    if (error) return { ok: false, error: error.message };
    if (data && typeof data === "object" && "error" in (data as any)) {
      return { ok: false, error: String((data as any).error) };
    }
    return { ok: true, data: data as T };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Action failed" };
  }
}

/** Record an admin action in the immutable audit log (client-side actions). */
export function auditLog(action: string, targetType: string, targetId: string | null, metadata: Record<string, unknown>) {
  return adminAction("admin-audit-log", { action, target_type: targetType, target_id: targetId, metadata });
}

// ============ Sportsbook console ============

export interface ConsoleMatch {
  id: string;
  kickoff_at: string;
  status: string;
  minute: number | null;
  home_score: number | null;
  away_score: number | null;
  home_team: { name: string; short_name: string; logo_url: string | null } | null;
  away_team: { name: string; short_name: string; logo_url: string | null } | null;
  competition: { name: string } | null;
}

export interface ConsoleOdds {
  id: string;
  match_id: string;
  market: string;
  selection: string;
  line: number | null;
  generated_odds: number;
  override_odds: number | null;
  is_suspended: boolean;
}

export async function fetchMatchConsole(statuses: string[], limit = 60) {
  return safeFetch(
    supabase
      .from("platform_matches")
      .select(
        `id, kickoff_at, status, minute, home_score, away_score,
         home_team:teams!platform_matches_home_team_id_fkey(name, short_name, logo_url),
         away_team:teams!platform_matches_away_team_id_fkey(name, short_name, logo_url),
         competition:competitions(name)`
      )
      .in("status", statuses as any)
      .order("kickoff_at", { ascending: true })
      .limit(limit) as any
  ) as Promise<{ data: ConsoleMatch[] | null; error: string | null }>;
}

export async function fetchMatchOdds(matchId: string) {
  return safeFetch(
    supabase
      .from("match_odds")
      .select("id, match_id, market, selection, line, generated_odds, override_odds, is_suspended")
      .eq("match_id", matchId)
      .order("market", { ascending: true }) as any
  ) as Promise<{ data: ConsoleOdds[] | null; error: string | null }>;
}

// ============ Pop It (crash) telemetry ============

export interface CrashRoundPublic {
  id: string;
  round_no: number;
  game_key: string;
  status: string;
  seed_hash: string;
  server_seed: string | null;
  crash_point: number | null;
  betting_ends_at: string;
  started_at: string | null;
  crashed_at: string | null;
  settled_at: string | null;
  total_staked: number;
  total_paid: number;
}

export interface CrashBet {
  id: string;
  round_id: string;
  user_id: string;
  stake: number;
  auto_cashout: number | null;
  cashout_multiplier: number | null;
  payout: number;
  status: string;
  created_at: string;
  profiles?: { username: string | null } | null;
}

export async function fetchCrashTelemetry() {
  const [roundsRes, betsRes] = await Promise.all([
    safeFetch(
      // Sanitized view: crash_point only on crashed/settled rounds, server_seed only once revealed.
      supabase
        .from("v_crash_rounds_public")
        .select("*")
        .order("round_no", { ascending: false })
        .limit(60) as any
    ),
    safeFetch(
      supabase
        .from("crash_bets")
        .select("id, round_id, user_id, stake, auto_cashout, cashout_multiplier, payout, status, created_at, profiles:profiles!crash_bets_user_id_fkey(username)")
        .order("created_at", { ascending: false })
        .limit(100) as any
    ),
  ]);
  const rounds = (roundsRes.data as CrashRoundPublic[]) || [];
  const bets = (betsRes.data as CrashBet[]) || [];

  const settled = rounds.filter(r => ["crashed", "settled"].includes(r.status) && Number(r.total_staked) > 0);
  const totalStaked = settled.reduce((s, r) => s + Number(r.total_staked), 0);
  const totalPaid = settled.reduce((s, r) => s + Number(r.total_paid), 0);
  const rtp = totalStaked > 0 ? (totalPaid / totalStaked) * 100 : 0;
  const houseHold = totalStaked - totalPaid;
  const avgCrash =
    settled.length > 0
      ? settled.reduce((s, r) => s + Number(r.crash_point || 0), 0) / settled.length
      : 0;
  const active = rounds.find(r => !["crashed", "settled"].includes(r.status)) || null;

  return {
    data: { rounds, bets, rtp, houseHold, totalStaked, totalPaid, avgCrash, active, settledCount: settled.length },
    error: roundsRes.error || betsRes.error,
  };
}

/** Verify a revealed round: SHA-256(server_seed) must equal the published seed_hash. */
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyRoundSeed(serverSeed: string, seedHash: string): Promise<boolean> {
  return (await sha256Hex(serverSeed)) === seedHash;
}

// ============ Withdrawal queue ============

export interface WithdrawalRequestRow {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  phone_number: string | null;
  payment_method: string;
  reviewer_id: string | null;
  review_reason: string | null;
  payout_reference: string | null;
  failure_reason: string | null;
  auto_approved: boolean;
  provider: string | null;
  created_at: string;
  reviewed_at: string | null;
  paid_at: string | null;
  profiles?: {
    username: string | null;
    email: string | null;
    phone_verified: boolean;
    risk_score: number;
  } | null;
}

export async function fetchWithdrawalQueue(limit = 100) {
  return safeFetch(
    supabase
      .from("withdrawal_requests")
      .select("*, profiles!withdrawal_requests_user_id_fkey(username, email, phone_verified, risk_score)")
      .order("created_at", { ascending: false })
      .limit(limit) as any
  ) as Promise<{ data: WithdrawalRequestRow[] | null; error: string | null }>;
}
