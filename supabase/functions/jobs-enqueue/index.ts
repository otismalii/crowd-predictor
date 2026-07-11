import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Missing auth" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Not authenticated" }, 401);

  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
  const set = new Set((roles ?? []).map((r: any) => r.role));
  if (!set.has("admin") && !set.has("super_admin")) return json({ error: "Forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const jobType = body?.job_type as string;
  if (!jobType) return json({ error: "job_type required" }, 400);

  const { data: def } = await admin.from("job_definitions").select("*").eq("job_type", jobType).maybeSingle();
  if (!def) return json({ error: "Unknown job_type" }, 400);

  const { data: row, error } = await admin.from("system_jobs").insert({
    job_type: jobType,
    payload: body?.payload ?? def.default_payload ?? {},
    scheduled_by: "manual",
    max_attempts: body?.max_attempts ?? 3,
  }).select("id").single();
  if (error) return json({ error: error.message }, 500);

  await admin.from("audit_logs").insert({
    user_id: user.id, action: "job.enqueue",
    resource_type: "system_jobs", resource_id: row.id,
    metadata: { job_type: jobType, reason: body?.reason ?? null },
  }).select();

  return json({ ok: true, job_id: row.id });
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
