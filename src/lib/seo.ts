import { SITE_NAME, BASE_URL, DEFAULT_DESC } from "./constants";

export interface PageMeta {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  type?: string;
  jsonLd?: Record<string, any>;
}

export function buildTitle(title?: string): string {
  return title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Prediction Markets for Kenya & Beyond`;
}

export function buildUrl(path = "/"): string {
  return `${BASE_URL}${path}`;
}

export function buildMarketMeta(market: { title: string; description?: string | null; id: string }): PageMeta {
  return {
    title: market.title,
    description: market.description || `Trade on "${market.title}" — view odds, track volume, and predict the outcome.`,
    path: `/markets/${market.id}`,
    type: "article",
  };
}

export function buildLeaderboardMeta(): PageMeta {
  return {
    title: "Leaderboard",
    description: "See who's leading the prediction markets. Rankings by reputation, accuracy, and streaks.",
    path: "/leaderboard",
  };
}

export const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.jpg`;
