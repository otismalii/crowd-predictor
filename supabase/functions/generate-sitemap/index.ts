// Dynamic sitemap.xml generator for Betwise. Cached for 1h via response headers.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SITE = "https://betwiseke.vercel.app"; // public canonical

const STATIC_URLS: Array<[string, string, string]> = [
  ["", "hourly", "1.0"],
  ["/crash", "daily", "0.9"],
  ["/rules", "monthly", "0.7"],
  ["/leaderboard", "daily", "0.6"],
];

serve(async () => {
  const urls = STATIC_URLS.map(
    ([path, freq, priority]) =>
      `<url><loc>${SITE}${path}</loc><changefreq>${freq}</changefreq><priority>${priority}</priority></url>`
  ).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
