// sync-content — runs every 30 minutes via jobs-dispatch.
// 1) Backfills missing team badges (teams.logo_url) from the football provider.
// 2) Publishes result headlines for freshly finished fixtures into news_items (dedup by url).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { buildProvider, loadConnections } from "../_shared/providers/index.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BADGE_BATCH = 20;
const NEWS_LOOKBACK_HOURS = 6;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const started = Date.now();
  let failure: string | null = null;
  let badgesFilled = 0;
  let badgesMissing = 0;
  let headlines = 0;

  try {
    // ---- 1. badge backfill
    const connections = await loadConnections(db);
    const provider = connections.map((c) => buildProvider(c)).find((p) => p && typeof p.getTeamBadge === "function");

    if (provider) {
      const { data: teams } = await db
        .from("teams")
        .select("id, name")
        .is("logo_url", null)
        .limit(BADGE_BATCH);

      for (const team of teams ?? []) {
        const badge = await provider.getTeamBadge!(team.name);
        if (!badge) { badgesMissing += 1; continue; }
        const { error } = await db.from("teams").update({ logo_url: badge }).eq("id", team.id);
        if (error) badgesMissing += 1;
        else badgesFilled += 1;
      }
    }

    // ---- 2. result headlines from freshly finished fixtures
    const since = new Date(Date.now() - NEWS_LOOKBACK_HOURS * 3600_000).toISOString();
    const { data: matches } = await db
      .from("platform_matches")
      .select("id, kickoff_at, home_score, away_score, competition:competitions(name), home:home_team_id(name, slug, logo_url), away:away_team_id(name, slug, logo_url)")
      .eq("status", "finished")
      .gte("kickoff_at", since)
      .order("kickoff_at", { ascending: false })
      .limit(40);

    for (const m of (matches ?? []) as any[]) {
      const home = m.home?.name;
      const away = m.away?.name;
      if (!home || !away || m.home_score === null || m.away_score === null) continue;

      const url = `/matches/${m.id}`;
      const { data: existing } = await db.from("news_items").select("id").eq("url", url).maybeSingle();
      if (existing) continue;

      const title = `${home} ${m.home_score}-${m.away_score} ${away}`;
      const comp = m.competition?.name ?? "Football";
      const verdict =
        m.home_score === m.away_score
          ? `${home} and ${away} shared the points`
          : m.home_score > m.away_score
            ? `${home} beat ${away}`
            : `${away} beat ${home}`;

      const { error } = await db.from("news_items").insert({
        source: "thesportsdb",
        title: `${title} — ${comp}`,
        url,
        summary: `Full time in the ${comp}: ${verdict} ${Math.max(m.home_score, m.away_score)}-${Math.min(m.home_score, m.away_score)}.`,
        image_url: m.home?.logo_url ?? m.away?.logo_url ?? null,
        published_at: m.kickoff_at,
        team_tags: [m.home?.slug, m.away?.slug].filter(Boolean),
      });
      if (!error) headlines += 1;
    }
  } catch (e) {
    failure = e instanceof Error ? e.message : String(e);
  }

  const durationMs = Date.now() - started;

  await db.from("ingestion_logs").insert({
    source_name: "job:sync-content",
    status: failure ? "error" : "success",
    records_fetched: badgesFilled + badgesMissing,
    records_processed: badgesFilled + headlines,
    error_message: failure,
    raw_data: { duration_ms: durationMs, badges_filled: badgesFilled, badges_missing: badgesMissing, headlines },
  });

  return new Response(
    JSON.stringify({
      ok: !failure,
      duration_ms: durationMs,
      badges_filled: badgesFilled,
      badges_missing: badgesMissing,
      headlines_created: headlines,
      error: failure,
    }),
    { status: failure ? 500 : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
