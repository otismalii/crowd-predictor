import { useState, useEffect, useCallback } from "react";

const TSDB_BASE = "https://www.thesportsdb.com/api/v1/json/123";

// In-memory cache shared across all hook instances
const badgeCache = new Map<string, string | null>();
const pendingRequests = new Map<string, Promise<string | null>>();

export function useTeamBadge(teamName: string): string | null {
  const [badge, setBadge] = useState<string | null>(badgeCache.get(teamName) ?? null);

  useEffect(() => {
    if (!teamName) return;

    // Already cached
    if (badgeCache.has(teamName)) {
      setBadge(badgeCache.get(teamName) ?? null);
      return;
    }

    // Deduplicate concurrent requests for same team
    let request = pendingRequests.get(teamName);
    if (!request) {
      request = fetchBadge(teamName);
      pendingRequests.set(teamName, request);
    }

    request.then((url) => {
      badgeCache.set(teamName, url);
      pendingRequests.delete(teamName);
      setBadge(url);
    });
  }, [teamName]);

  return badge;
}

async function fetchBadge(teamName: string): Promise<string | null> {
  try {
    const res = await fetch(`${TSDB_BASE}/searchteams.php?t=${encodeURIComponent(teamName)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const team = data?.teams?.[0];
    return team?.strBadge ? `${team.strBadge}/tiny` : null;
  } catch {
    return null;
  }
}

// Batch prefetch for multiple teams
export function prefetchTeamBadges(teamNames: string[]) {
  const uncached = teamNames.filter((t) => !badgeCache.has(t) && !pendingRequests.has(t));
  // Stagger requests to avoid rate limit (30/min on free)
  uncached.forEach((name, i) => {
    const delay = i * 200; // 200ms between each
    setTimeout(() => {
      if (!badgeCache.has(name) && !pendingRequests.has(name)) {
        const req = fetchBadge(name);
        pendingRequests.set(name, req);
        req.then((url) => {
          badgeCache.set(name, url);
          pendingRequests.delete(name);
        });
      }
    }, delay);
  });
}
