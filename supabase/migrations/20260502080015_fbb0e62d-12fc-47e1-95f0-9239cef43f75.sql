
-- =========================================
-- PHASE 1: Reconciliation + Risk + Trends + Payment Failures
-- PHASE 3: Role enum extension
-- =========================================

-- Extend app_role enum with new tiers
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'verified_user';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'risk_flagged';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'market_operator';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'super_admin';
