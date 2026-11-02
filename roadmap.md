# Roadmap — Betwise overhaul

## Done (Sprint 1)
- [x] Rebrand to Betwise (page title, nav, footer, admin sidebar)
- [x] Pop It page at /crash (live multiplier, bet, cash-out, round feed)
- [x] Bottom nav: Home / My Bets / Pop It / Wallet / Profile
- [x] Wallet limits: withdraw KES 100 min, deposit KES 10–150,000
- [x] Admin nav: removed prediction-market items
- [x] Wallet page: prediction stats → betting stats; agent tools rebranded to sportsbook
- [x] Delete legacy prediction pages/files + 11 dead server functions (pass 1)
- [x] Restore site settings, Betwise Rules page, crest logo + favicon, matchday banner (pass 1)
- [x] Phase 1: Pagaza purge + domain alignment (BASE_URL, GSC tag, manifest, sitemap, PesaPal narratives, storage keys)

## In progress — Admin control panel (ACP remediation)
- [ ] Rewire core metrics (AdminOverviewPage, AdminTodayPage, analyticsService) → platform_matches, bet_slips, crash_rounds, ledger_entries, withdrawal_requests
- [ ] AdminSettlementsPage: live match table + 1-click settle/void with audit reason
- [ ] Pop It telemetry panel: crash rounds, hash validation, RTP, bets/cashouts
- [ ] Treasury: unified M-Pesa withdrawal approval hub (withdrawal_requests, 1-click approve/reject)
- [ ] End-to-end verification of the admin flows

## Next
- [ ] 14-day rolling fixture ingestion + odds seeding
- [ ] Bettor profile hub (replace prediction stats)
- [ ] Drop archived prediction tables from the database (needs user to run SQL — external Supabase)
- [ ] Roulette page
