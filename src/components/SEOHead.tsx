import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

interface SEOHeadProps {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  type?: string;
  jsonLd?: Record<string, any>;
  /** Force noindex regardless of route heuristics. */
  noindex?: boolean;
}

const SITE_NAME = "Betwise";
const BASE_URL = "https://betwiseke.vercel.app";
const DEFAULT_DESC = "Kenya's sportsbook. Live football odds, Pop It, M-Pesa deposits and fast payouts.";
const DEFAULT_IMAGE = `${BASE_URL}/og-image.jpg`;

/** Authenticated / private surfaces must never be indexed. */
const PRIVATE_PATH_PREFIXES = [
  "/wallet",
  "/my-bets",
  "/profile",
  "/account",
  "/admin",
  "/auth",
  "/reset-password",
];

const SEOHead = ({
  title,
  description = DEFAULT_DESC,
  path,
  image = DEFAULT_IMAGE,
  type = "website",
  jsonLd,
  noindex,
}: SEOHeadProps) => {
  const location = useLocation();

  // Canonical integrity: derive the path from the live route unless a page
  // explicitly passes one — sub-routes must never collapse to "/".
  const canonicalPath = (path ?? location.pathname.split(/[?#]/)[0]) || "/";
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Kenya's Sportsbook & Pop It`;
  const fullUrl = `${BASE_URL}${canonicalPath}`;

  const isPrivate =
    noindex ??
    PRIVATE_PATH_PREFIXES.some(
      (p) => canonicalPath === p || canonicalPath.startsWith(`${p}/`)
    );

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={isPrivate ? "noindex, nofollow" : "index, follow"} />
      <link rel="canonical" href={fullUrl} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content={SITE_NAME} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* JSON-LD */}
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
};

export default SEOHead;
