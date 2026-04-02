export const SITE_NAME = "Pagaza";
export const BASE_URL = "https://pagaza.vercel.app";
export const DEFAULT_DESC = "Kenya's premier prediction market platform. Forecast outcomes across politics, economics, sports, and more with source-backed resolution.";

export const CATEGORIES = [
  { key: "all", label: "All", emoji: "🌍" },
  { key: "politics", label: "Politics", emoji: "🏛️" },
  { key: "economics", label: "Economics", emoji: "📈" },
  { key: "sports", label: "Sports", emoji: "⚽" },
  { key: "social", label: "Social", emoji: "🤝" },
  { key: "local", label: "Local", emoji: "🇰🇪" },
  { key: "regional", label: "Regional", emoji: "🌍" },
  { key: "international", label: "Global", emoji: "🌐" },
] as const;

export const MARKET_STATUSES = ["open", "closed", "resolved", "cancelled"] as const;
export type MarketStatus = typeof MARKET_STATUSES[number];

export const TRADE_SIDES = ["buy", "sell"] as const;
export type TradeSide = typeof TRADE_SIDES[number];

export const TRANSACTION_TYPES = ["deposit", "withdrawal", "bet_stake", "bet_win", "bet_refund", "house_fee"] as const;

export const SPORTS_CATEGORIES = ["sports", "match_result", "over_under"];

export const PAGE_SIZE = 20;
