# Market Foundry v2 — JSON-First Import Pipeline

Replace the current "New Market" form with an operations-grade import center. Operators generate JSON anywhere (ChatGPT, GLM, Gemini, scripts, feeds) and publish hundreds of markets in minutes.

## 1. Canonical Pagaza Market Package Schema

One schema, provider-agnostic. Version-locked.

```json
{
  "version": "1.0",
  "batchName": "EPL Matchweek 20",
  "generatedBy": "chatgpt|glm|gemini|claude|deepseek|script|api|manual",
  "generatedAt": "2026-07-08T10:00:00Z",
  "description": "optional",
  "markets": [
    {
      "question": "Will Arsenal beat Chelsea on 2026-07-15?",
      "slug": "arsenal-chelsea-2026-07-15",         // optional, auto-generated
      "category": "sports",                           // must match allowed set
      "subcategory": "football",
      "marketType": "binary|multi",
      "outcomes": [{ "label": "Yes", "initialProbability": 0.55 }, ...],
      "closesAt": "2026-07-15T16:00:00Z",
      "resolvesAt": "2026-07-15T18:00:00Z",
      "resolutionRules": "text",
      "initialLiquidity": 1000,
      "sources": [{ "url": "...", "publisher": "..." }],  // optional
      "tags": ["epl","football"]
    }
  ]
}
```

## 2. Route + IA changes

- `/admin/markets/new` becomes **Import Markets** (three tabs only: Upload · Paste · History).
- Legacy `MarketBuilder` form is removed from that route. It stays available only as an internal component behind an "Advanced / Single Market" collapsed panel — no top-level UI.
- Sidebar label: "New Market" → "Import Markets".

## 3. New tables (one migration)

- `market_import_batches` — id, batch_name, generated_by, generated_at, description, operator_id, source_mode (upload|paste|api), raw_payload (jsonb), markets_total, markets_ready, markets_warned, markets_failed, markets_published, status (parsing|validated|publishing|completed|rolled_back), processing_ms, created_at.
- `market_import_rows` — id, batch_id, row_index, raw_market (jsonb), normalized_market (jsonb), slug, status (ready|warning|error|published|rejected), issues (jsonb array of `{code,severity,message,field}`), published_market_id (nullable fk markets), created_at.
- `market_import_audit` — id, batch_id, row_id (nullable), operator_id, action (import|validate|edit|publish|reject|rollback|delete), payload (jsonb), created_at.

RLS: readable + writable only by roles admin, super_admin, market_manager. Service_role full access. All three tables get standard GRANTs, updated_at trigger where relevant, and indexes on (batch_id), (status), (created_at desc).

## 4. Validation engine (`src/lib/foundry/validate.ts`)

Pure client-side + server-side (edge function reuses same module via shared code). Rules:

- Schema shape (zod).
- Required fields per market.
- `closesAt` in future, `resolvesAt >= closesAt`.
- Slug uniqueness — within batch AND against existing `markets.slug`.
- Duplicate question detection within batch (normalized text hash).
- Category in allowed enum (from existing category list).
- Outcomes: binary needs exactly 2; multi needs 2–8; probabilities sum ≈ 1.0 (±0.02); each in [0.01, 0.99].
- Liquidity: number, min 100, max from `app_settings`.
- Duplicate batch detection: hash of `raw_payload` vs last 30 days.
- Auto-fixes: trim strings, generate missing slug, normalize probabilities to sum 1, strip HTML.

Output per market: `{ status: 'ready'|'warning'|'error', issues: [...] }`. Errors block publish; warnings don't.

## 5. Import UI (`/admin/markets/new`)

Three tabs, no other UI:

**Upload tab**
- Drag-drop `.json` file(s), max 5MB each.
- On drop → parse → create batch (client-side preview, not persisted until user clicks "Save Batch") → render preview grid.

**Paste tab**
- Monaco Editor (`@monaco-editor/react`, add dep) with JSON language, schema hint, live validation gutter markers, format shortcut, auto-complete via injected JSON schema.
- "Validate" button runs the engine; "Save Batch" persists.

**History tab**
- Table of `market_import_batches` — batch name, operator, date, totals, status, actions (View · Rollback · Export errors).
- Filters: operator, date range, status.

## 6. Preview grid (shared, appears below tabs after validation)

- Summary bar: `✓ 187 Ready  ⚠ 8 Warnings  ✖ 3 Errors`.
- Virtualized grid of preview cards (question, category, close time, market type, liquidity, top-outcome probability, status pill, warning badges).
- Row actions: Publish · Edit (inline dialog to fix one field) · Reject.
- Bulk actions: Publish All Ready · Publish Selected · Reject Selected · Export Errors (CSV).
- Publishing runs in chunks of 25 via edge function `import-markets-publish`, with live progress bar and per-row status updates via realtime subscription on `market_import_rows`.

## 7. Edge functions

- `import-markets-validate` — accepts a batch payload, runs the shared validator, upserts `market_import_batches` + `market_import_rows`, returns summary. Idempotent by client-generated batch idempotency key.
- `import-markets-publish` — takes `batch_id` + optional `row_ids`. For each ready row: inserts `markets` + `market_outcomes` + sources inside a transaction (RPC), updates row status, writes `market_import_audit`. Chunked, resumable.
- `import-markets-rollback` — soft-deletes markets created by a batch (uses existing `markets.deleted_at` from Wave 4 migration), marks batch `rolled_back`, audits.

All three: role-gated (admin/super_admin/market_manager), zod-validated input, CORS, structured envelope responses.

## 8. GLM as one JSON provider (optional helper)

- `supabase/functions/foundry-generate/index.ts` — thin helper that calls NVIDIA GLM (uses existing `NVIDIA_API_KEY`) or GLM direct (uses new `GLM_API_KEY`) with a prompt template and returns Pagaza JSON. Output flows back through the same Upload/Paste path — never bypasses validation. Purely optional; platform works without it.

## 9. Files touched

**New**
- `src/lib/foundry/schema.ts` (zod), `src/lib/foundry/validate.ts`, `src/lib/foundry/normalize.ts`, `src/lib/foundry/slug.ts`
- `src/pages/admin/AdminMarketsImportPage.tsx` (replaces new-page content)
- `src/components/admin/foundry/UploadTab.tsx`, `PasteTab.tsx`, `HistoryTab.tsx`, `PreviewGrid.tsx`, `PreviewCard.tsx`, `IssueBadge.tsx`, `BatchProgressBar.tsx`, `BatchDetailDrawer.tsx`
- `supabase/functions/import-markets-validate/index.ts`, `import-markets-publish/index.ts`, `import-markets-rollback/index.ts`, `foundry-generate/index.ts`
- `supabase/functions/_shared/foundry-validate.ts` (mirror of client validator for edge)

**Edited**
- `src/App.tsx` — route `/admin/markets/new` → `AdminMarketsImportPage`
- `src/components/admin/shell/adminNav.ts` — relabel "New Market" → "Import Markets"
- `src/pages/admin/AdminMarketsNewPage.tsx` — delete or convert to redirect
- One DB migration for the three new tables + GRANTs + RLS + indexes + triggers

**Deps**
- `@monaco-editor/react`, `monaco-editor`, `react-window` (virtualized preview), `papaparse` (CSV export)

## 10. Out of scope for this wave

- Sports/election/crypto automation generators (they will output the same JSON later).
- AI-driven publishing (Oracle stays advisory).
- Import from URL / RSS.

## Approval gates
- One DB migration.
- Three dependencies added.
- Zero new secrets (GLM_API_KEY already added).
