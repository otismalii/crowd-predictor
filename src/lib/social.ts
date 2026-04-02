import { BASE_URL, SITE_NAME } from "./constants";

export interface ShareData {
  url: string;
  title: string;
  text?: string;
}

export function buildShareUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

export function shareToWhatsApp(data: ShareData): string {
  const text = `${data.title}${data.text ? ` — ${data.text}` : ""} ${data.url}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function shareToTwitter(data: ShareData): string {
  const text = `${data.title}${data.text ? ` — ${data.text}` : ""}`;
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(data.url)}`;
}

export function shareToFacebook(data: ShareData): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(data.url)}`;
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function buildMarketShareData(market: { title: string; id: string }): ShareData {
  return {
    url: buildShareUrl(`/markets/${market.id}`),
    title: market.title,
    text: `Check out this prediction market on ${SITE_NAME}`,
  };
}

export function buildProfileShareData(username: string, userId: string): ShareData {
  return {
    url: buildShareUrl(`/profile/${userId}`),
    title: `@${username} on ${SITE_NAME}`,
    text: `Think you can beat this prediction record?`,
  };
}

export function buildLeaderboardShareData(): ShareData {
  return {
    url: buildShareUrl("/leaderboard"),
    title: `${SITE_NAME} Leaderboard`,
    text: "Think you can beat this leaderboard score?",
  };
}
