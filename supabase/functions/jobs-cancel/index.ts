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

  const { job_id, reason } = await req.json().catch(() => ({}));
  if (!job_id || !reason) return json({ error: "job_id and reason required" }, 400);

  const { error } = await admin.from("system_jobs").update({
    status: "cancelled",
    finished_at: new Date().toISOString(),
    cancel_reason: reason,
  }).eq("id", job_id).in("status", ["queued", "running"]);
  if (error) return json({ error: error.message }, 500);

  await admin.from("audit_logs").insert({
    user_id: user.id, action: "job.cancel",
    resource_type: "system_jobs", resource_id: job_id,
    metadata: { reason },
  });
  return json({ ok: true });
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
