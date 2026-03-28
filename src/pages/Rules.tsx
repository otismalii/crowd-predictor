import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import { Shield, CheckCircle2, AlertTriangle, Scale, Eye } from "lucide-react";

const Rules = () => (
  <div className="min-h-screen bg-background">
    <SEOHead title="Platform Rules" description="How Pagaza markets work: resolution rules, dispute process, and trading guidelines." path="/rules" />
    <Navbar />
    <div className="container py-8 max-w-3xl">
      <h1 className="font-display text-3xl font-bold tracking-wider mb-6">
        <Shield className="inline h-8 w-8 text-primary mr-2" />
        Platform <span className="text-primary">Rules</span>
      </h1>

      <div className="space-y-8 text-sm text-muted-foreground">
        <section>
          <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" /> Market Resolution
          </h2>
          <ul className="space-y-2 list-disc list-inside">
            <li>Every market has a clear resolution rule defined at creation time.</li>
            <li>Markets are resolved using official sources first, then trusted public data.</li>
            <li>Resolution sources are displayed on each market page for transparency.</li>
            <li>Markets lock after resolution — no retroactive changes without a full audit trail.</li>
            <li>If a market cannot be objectively resolved, it may be invalidated with full refunds.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <Scale className="h-5 w-5 text-accent" /> Trading Rules
          </h2>
          <ul className="space-y-2 list-disc list-inside">
            <li>All trading uses virtual currency (KES) during beta.</li>
            <li>Prices are determined by the LMSR (Logarithmic Market Scoring Rule) algorithm.</li>
            <li>You buy shares in outcomes you believe will occur. Share prices reflect probability.</li>
            <li>Winning shares pay out at 1 KES per share. Losing shares become worthless.</li>
            <li>No trading after market close time.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" /> Disputes
          </h2>
          <ul className="space-y-2 list-disc list-inside">
            <li>You can dispute a market resolution within 48 hours of settlement.</li>
            <li>Disputes require a reason and optional evidence.</li>
            <li>Admin reviews all disputes and may confirm, revise, or invalidate.</li>
            <li>All dispute decisions are logged in the audit trail.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" /> Fair Play
          </h2>
          <ul className="space-y-2 list-disc list-inside">
            <li>Duplicate accounts and wallet manipulation are prohibited.</li>
            <li>Spam predictions and rapid-fire submissions are rate-limited.</li>
            <li>Guest sessions are limited to prevent abuse.</li>
            <li>All admin actions are logged and auditable.</li>
          </ul>
        </section>
      </div>
    </div>
    <Footer />
  </div>
);

export default Rules;
