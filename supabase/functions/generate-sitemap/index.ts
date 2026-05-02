// Dynamic sitemap.xml generator. Cached for 1h via response headers.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serviceClient } from "../_shared/envelope.ts";

const SITE = "https://pagaza.app"; // public canonical

serve(async () => {
  try {
    const db = serviceClient();
    const { data: markets } = await db.from("markets")
      .select("id, slug, created_at").in("status", ["open", "closed", "resolved"]).limit(5000);

    const staticUrls = ["", "/markets", "/leaderboard", "/rules", "/sources"];
    const urls = [
      ...staticUrls.map(p => `<url><loc>${SITE}${p}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`),
      ...(markets || []).map(m =>
        `<url><loc>${SITE}/markets/${m.slug || m.id}</loc><lastmod>${new Date(m.created_at).toISOString()}</lastmod><changefreq>hourly</changefreq><priority>0.6</priority></url>`
      ),
    ].join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return new Response(`error: ${e instanceof Error ? e.message : "unknown"}`, { status: 500 });
  }
});
