---
name: LDX v5 Implementation Directive
description: Governance charter for Pagaza LDX v5 — how to sequence, prioritize and structure any refactor
type: constraint
---

# Pagaza LDX v5 — Implementation Directive

Evolve, never rewrite. Preserve stable functionality; extend before rebuilding.

## Methodology (every module)
1. Audit existing implementation
2. Identify redundancy & technical debt
3. Preserve working functionality
4. Design improvement
5. Implement incrementally
6. Validate against existing workflows
7. Refactor shared logic
8. Remove obsolete code **only after** migration
9. Update documentation

Never introduce parallel systems that solve the same problem.

## Priority order (always)
Financial Integrity > Security > Market Integrity > Data Integrity > Performance > User Experience > Intelligence > Growth > Cosmetic. No visual work compromises correctness or trust.

## Phase gates (do not leap-frog)
- Phase 2 — Foundation: financial safety, atomic tx, secure payments, resolution checkpoint, trusted data sources
- Phase 3 — Independent UX: UI modernization, CMS, Identity Hub, liquidity controls
- Phase 4 — Trading: trading UX, resolution engine
- Phase 5 — Finance: treasury, reconciliation, settlement
- Phase 6 — LOGIK v1: prediction explanations, calibration
- Phase 7 — LOGIK Oracle: discovery, suggestions, recursive learning
- Phase 8 — ACP consolidation: workflow-driven admin, navigation cleanup, permission refinement

Do not build later-phase features before prerequisites are complete.

## Subsystem ownership (single authoritative owner)
- Trading Engine — pricing, orders, positions, liquidity
- Finance Engine — wallets, ledger, treasury, settlement
- Resolution Engine — evidence, review, approval, settlement trigger
- LOGIK — discovery, intelligence, suggestions, calibration (advisory only)
- Governance — roles, promotions, permissions, audit

Business logic must not leak across modules.

## Database principles
Single source of truth for balances, positions, markets, outcomes, transactions, reputation, creator scores. Prefer computed views to duplicate tables. Every mutation writes an audit record.

## UX principles
Every screen answers: **What happened? What can I do? What next?**
Every financial screen distinguishes: **Available / Locked / Pending / Completed / Failed.** No ambiguous terms, no hidden balances, no unexplained calculations.

## Trust first
Every market exposes: resolution rules, evidence sources, audit history, confidence, liquidity, creator, resolution timeline. Every financial op exposes: status, timestamp, ledger reference, audit reference. Transparency is a product feature.

## LOGIK
Observes, analyzes, recommends. **Humans decide.** Every recommendation includes confidence, evidence, sources, reasoning, risk. Predictions feed calibration.

## Success metrics
- Users immediately understand their financial position
- Every market has a transparent, auditable resolution path
- Every transaction traceable end-to-end
- LOGIK improves via measured calibration
- ACP is workflow-oriented, not page-oriented
- No redundant systems or duplicated business logic
- Platform scales beyond sports without architectural redesign
