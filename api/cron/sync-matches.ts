import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests (Vercel cron uses GET)
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify cron secret in production
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: "Missing Supabase configuration" });
    }

    // Call sync-matches Supabase function
    const syncResponse = await fetch(`${supabaseUrl}/functions/v1/sync-matches`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    if (!syncResponse.ok) {
      const errorText = await syncResponse.text();
      console.error("sync-matches failed:", errorText);
      return res.status(syncResponse.status).json({ 
        error: "sync-matches failed", 
        details: errorText 
      });
    }

    const syncData = await syncResponse.json();
    console.log("sync-matches completed:", syncData);

    // Chain resolve-bets for P2P bet settlement
    let resolveData = null;
    try {
      const resolveResponse = await fetch(`${supabaseUrl}/functions/v1/resolve-bets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
      });

      if (resolveResponse.ok) {
        resolveData = await resolveResponse.json();
        console.log("resolve-bets completed:", resolveData);
      } else {
        console.error("resolve-bets failed:", await resolveResponse.text());
      }
    } catch (e) {
      console.error("resolve-bets chain error:", e);
    }

    return res.status(200).json({
      success: true,
      sync: syncData,
      resolve: resolveData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron handler error:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
