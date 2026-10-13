// Betwise site settings — single source for brand copy and money limits shown in the UI.
// Server functions enforce the same limits; keep these in sync with finance settings.
export const SITE_NAME = "Betwise";
export const BASE_URL = "https://pagaza.vercel.app";
export const DEFAULT_DESC =
  "Kenya's sportsbook. Live football odds, Pop It, M-Pesa deposits and fast payouts.";

export const CURRENCY = "KES";
export const BET_MIN_KES = 20;
export const DEPOSIT_MIN_KES = 10;
export const DEPOSIT_MAX_KES = 150_000;
export const WITHDRAW_MIN_KES = 100;
export const WITHDRAW_DAILY_CAP_KES = 50_000;
export const WITHDRAW_AUTO_APPROVE_MAX_KES = 5_000;
export const ODDS_MARGIN_PCT = 7;

export const SPORT_MARKETS = [
  { key: "1x2", label: "1X2" },
  { key: "double_chance", label: "Double Chance" },
  { key: "over_under", label: "Over/Under" },
  { key: "btts", label: "Both Teams to Score" },
  { key: "correct_score", label: "Correct Score" },
] as const;

export const PAGE_SIZE = 20;
