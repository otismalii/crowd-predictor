import { z } from "zod";

export const ALLOWED_CATEGORIES = [
  "politics", "economics", "sports", "social", "local", "regional", "international",
  "match_result", "over_under", "entertainment", "technology", "crypto", "weather",
] as const;

export const ALLOWED_GENERATORS = [
  "chatgpt", "glm", "nvidia", "gemini", "claude", "deepseek",
  "script", "api", "manual", "sports-feed", "election-feed", "other",
] as const;

const OutcomeSchema = z.object({
  label: z.string().trim().min(1).max(80),
  initialProbability: z.number().min(0).max(1).optional(),
});

const SourceSchema = z.object({
  url: z.string().url().optional(),
  publisher: z.string().trim().max(120).optional(),
  sourceType: z.string().trim().max(40).optional(),
});

export const MarketInputSchema = z.object({
  question: z.string().trim().min(8).max(300),
  description: z.string().trim().max(2000).optional(),
  slug: z.string().trim().max(120).optional(),
  category: z.string().trim().min(1),
  subcategory: z.string().trim().max(60).optional(),
  marketType: z.enum(["binary", "multi"]).optional(),
  outcomes: z.array(OutcomeSchema).min(2).max(8),
  closesAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
  resolvesAt: z.string().datetime({ offset: true }).or(z.string().datetime()).optional(),
  resolutionRules: z.string().trim().max(2000).optional(),
  initialLiquidity: z.number().min(100).max(1_000_000).optional(),
  sources: z.array(SourceSchema).optional(),
  tags: z.array(z.string().trim().max(30)).max(10).optional(),
  imageUrl: z.string().url().optional(),
});

export const MarketPackageSchema = z.object({
  version: z.string().default("1.0"),
  batchName: z.string().trim().min(3).max(120),
  generatedBy: z.string().trim().min(1),
  generatedAt: z.string().optional(),
  description: z.string().max(500).optional(),
  markets: z.array(z.any()).min(1).max(1000),
});

export type MarketInput = z.infer<typeof MarketInputSchema>;
export type MarketPackage = z.infer<typeof MarketPackageSchema>;

export type IssueSeverity = "error" | "warning" | "info";
export type Issue = { code: string; severity: IssueSeverity; message: string; field?: string };

export type RowResult = {
  rowIndex: number;
  raw: unknown;
  normalized?: MarketInput;
  slug?: string;
  questionHash?: string;
  status: "ready" | "warning" | "error";
  issues: Issue[];
};
