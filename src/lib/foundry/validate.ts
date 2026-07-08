import {
  ALLOWED_CATEGORIES, MarketInputSchema, MarketPackageSchema,
  type Issue, type MarketInput, type MarketPackage, type RowResult,
} from "./schema";
import { slugify, normalizeQuestion, sha256 } from "./slug";

export type PackageValidation = {
  package?: MarketPackage;
  rows: RowResult[];
  fatal?: Issue[];
  summary: { total: number; ready: number; warning: number; error: number };
};

export type JsonParseResult = { ok: true; data: unknown; message?: undefined } | { ok: false; message: string; data?: undefined };
export function parseJsonSafe(text: string): JsonParseResult {
  try { return { ok: true, data: JSON.parse(text) }; }
  catch (e: any) { return { ok: false, message: e?.message ?? "Invalid JSON" }; }
}

const ALLOWED = new Set<string>(ALLOWED_CATEGORIES as readonly string[]);

function normalizeMarket(raw: any): { normalized?: MarketInput; issues: Issue[] } {
  const issues: Issue[] = [];
  const parsed = MarketInputSchema.safeParse(raw);
  if (!parsed.success) {
    for (const err of parsed.error.issues) {
      issues.push({ code: "schema", severity: "error", message: err.message, field: err.path.join(".") });
    }
    return { issues };
  }
  const m = { ...parsed.data };

  // Auto-derive marketType
  if (!m.marketType) m.marketType = m.outcomes.length === 2 ? "binary" : "multi";
  if (m.marketType === "binary" && m.outcomes.length !== 2) {
    issues.push({ code: "binary_outcomes", severity: "error", message: "Binary markets need exactly 2 outcomes", field: "outcomes" });
  }

  // Category check
  if (!ALLOWED.has(m.category.toLowerCase())) {
    issues.push({ code: "category", severity: "warning", message: `Unknown category "${m.category}" — will default to match_result`, field: "category" });
    m.category = "match_result";
  } else {
    m.category = m.category.toLowerCase();
  }

  // Dates
  const closes = new Date(m.closesAt);
  if (isNaN(closes.getTime())) {
    issues.push({ code: "closesAt", severity: "error", message: "closesAt is not a valid date", field: "closesAt" });
  } else if (closes.getTime() <= Date.now()) {
    issues.push({ code: "closesAt_past", severity: "error", message: "closesAt must be in the future", field: "closesAt" });
  }
  if (m.resolvesAt) {
    const res = new Date(m.resolvesAt);
    if (isNaN(res.getTime())) issues.push({ code: "resolvesAt", severity: "error", message: "resolvesAt is not a valid date", field: "resolvesAt" });
    else if (res.getTime() < closes.getTime()) issues.push({ code: "resolvesAt_before_close", severity: "error", message: "resolvesAt must be ≥ closesAt", field: "resolvesAt" });
  }

  // Probabilities
  const withProbs = m.outcomes.filter((o) => typeof o.initialProbability === "number");
  if (withProbs.length > 0 && withProbs.length !== m.outcomes.length) {
    issues.push({ code: "prob_partial", severity: "warning", message: "Mixed initialProbability — remaining will default to uniform", field: "outcomes" });
  } else if (withProbs.length === m.outcomes.length) {
    const sum = withProbs.reduce((s, o) => s + (o.initialProbability ?? 0), 0);
    if (Math.abs(sum - 1) > 0.02) {
      issues.push({ code: "prob_sum", severity: "warning", message: `Probabilities sum to ${sum.toFixed(2)} — will be normalized`, field: "outcomes" });
      const scale = 1 / sum;
      m.outcomes = m.outcomes.map((o) => ({ ...o, initialProbability: (o.initialProbability ?? 0) * scale }));
    }
    for (const o of m.outcomes) {
      const p = o.initialProbability!;
      if (p < 0.01 || p > 0.99) {
        issues.push({ code: "prob_bounds", severity: "warning", message: `Outcome "${o.label}" probability ${p.toFixed(2)} outside [0.01, 0.99]`, field: "outcomes" });
      }
    }
  }

  // Liquidity
  if (m.initialLiquidity == null) m.initialLiquidity = 500;

  // Slug
  if (!m.slug) m.slug = slugify(m.question);
  else m.slug = slugify(m.slug);

  return { normalized: m, issues };
}

export async function validatePackage(raw: unknown): Promise<PackageValidation> {
  const pkg = MarketPackageSchema.safeParse(raw);
  if (!pkg.success) {
    return {
      rows: [],
      fatal: pkg.error.issues.map((e) => ({ code: "pkg", severity: "error", message: e.message, field: e.path.join(".") })),
      summary: { total: 0, ready: 0, warning: 0, error: 0 },
    };
  }
  const rows: RowResult[] = [];
  const seenSlugs = new Map<string, number>();
  const seenHashes = new Map<string, number>();

  for (let i = 0; i < pkg.data.markets.length; i++) {
    const raw = pkg.data.markets[i];
    const { normalized, issues } = normalizeMarket(raw);
    let slug: string | undefined;
    let qhash: string | undefined;
    if (normalized) {
      slug = normalized.slug!;
      qhash = await sha256(normalizeQuestion(normalized.question));
      const dupSlugIdx = seenSlugs.get(slug);
      if (dupSlugIdx != null) {
        issues.push({ code: "dup_slug_batch", severity: "error", message: `Duplicate slug within batch (also row ${dupSlugIdx + 1})`, field: "slug" });
      } else seenSlugs.set(slug, i);
      const dupHashIdx = seenHashes.get(qhash);
      if (dupHashIdx != null) {
        issues.push({ code: "dup_question_batch", severity: "warning", message: `Similar question to row ${dupHashIdx + 1}`, field: "question" });
      } else seenHashes.set(qhash, i);
    }
    const hasError = issues.some((x) => x.severity === "error");
    const hasWarn = issues.some((x) => x.severity === "warning");
    rows.push({
      rowIndex: i,
      raw,
      normalized: hasError ? undefined : normalized,
      slug,
      questionHash: qhash,
      status: hasError ? "error" : hasWarn ? "warning" : "ready",
      issues,
    });
  }

  const summary = {
    total: rows.length,
    ready: rows.filter((r) => r.status === "ready").length,
    warning: rows.filter((r) => r.status === "warning").length,
    error: rows.filter((r) => r.status === "error").length,
  };
  return { package: pkg.data, rows, summary };
}
