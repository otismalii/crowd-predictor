import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import { Shield, CheckCircle2, AlertTriangle, Scale, Eye, HelpCircle, Info } from "lucide-react";

const FAQS = [
  {
    q: "What is Pagaza?",
    a: "Pagaza is Kenya's prediction market exchange. You buy and sell shares in real-world outcomes — politics, sports, the economy — and prices reflect the crowd's probability estimate.",
  },
  {
    q: "Is this gambling?",
    a: "No. Pagaza is a forecasting platform that uses an LMSR (Logarithmic Market Scoring Rule) market maker. During beta, all trading uses virtual KES — no real-money payouts.",
  },
  {
    q: "How do markets resolve?",
    a: "Each market has a written resolution rule and an evidence panel. Admins resolve markets only after attaching a verifiable source snapshot, and every resolution is logged in an immutable audit trail.",
  },
  {
    q: "Why do I need a +254 phone?",
    a: "A verified Kenyan phone number is required to trade and to withdraw. This keeps the platform local-first and prevents abuse via duplicate accounts.",
  },
  {
    q: "How do I deposit and withdraw?",
    a: "Deposits and withdrawals run through PesaPal / M-Pesa. Withdrawals are reviewed by an admin before payout to prevent fraud.",
  },
  {
    q: "Who built Pagaza?",
    a: "Pagaza is built by LionByte, a Kenyan team focused on transparent, source-backed prediction markets for East Africa.",
  },
];

const Rules = () => (
  <div className="min-h-screen bg-background">
    <SEOHead
      title="Rules & FAQ"
      description="How Pagaza markets work: resolution rules, dispute process, trading guidelines, and frequently asked questions."
      path="/rules"
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }}
    />
    <Navbar />
    <div className="container py-8 max-w-3xl">
      <div className="ke-flag-bar h-1 w-24 mb-6 rounded-full" aria-hidden="true" />
      <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
        Rules & <span className="text-primary">FAQ</span>
      </h1>
      <p className="text-muted-foreground mb-10">Everything you need to know about how Pagaza works.</p>

      <div className="space-y-10 text-sm text-muted-foreground">
        <section id="about">
          <h2 className="font-display text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" /> About Pagaza
          </h2>
          <p>
            Pagaza is a Kenya-first prediction market: a place to forecast outcomes of public events using a transparent
            market-maker. Built by LionByte. Mobile-first. M-Pesa native. Source-backed.
          </p>
        </section>

        <section id="resolution">
          <h2 className="font-display text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
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

        <section id="trading">
          <h2 className="font-display text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
            <Scale className="h-5 w-5 text-accent" /> Trading Rules
          </h2>
          <ul className="space-y-2 list-disc list-inside">
            <li>All trading uses virtual currency (KES) during beta.</li>
            <li>Prices are determined by the LMSR market-maker — share price = probability.</li>
            <li>You buy shares in outcomes you expect. Winning shares pay 1 KES; losing shares pay 0.</li>
            <li>No trading after market close time.</li>
            <li>Trading and withdrawals require a verified +254 Kenyan phone number.</li>
          </ul>
        </section>

        <section id="disputes">
          <h2 className="font-display text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-accent" /> Disputes
          </h2>
          <ul className="space-y-2 list-disc list-inside">
            <li>You can dispute a market resolution within 48 hours of settlement.</li>
            <li>Disputes require a reason and optional evidence.</li>
            <li>Admin reviews all disputes and may confirm, revise, or invalidate.</li>
            <li>All dispute decisions are logged in the audit trail.</li>
          </ul>
        </section>

        <section id="fair-play">
          <h2 className="font-display text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" /> Fair Play
          </h2>
          <ul className="space-y-2 list-disc list-inside">
            <li>Duplicate accounts and wallet manipulation are prohibited.</li>
            <li>Spam predictions and rapid-fire submissions are rate-limited.</li>
            <li>Guest sessions are limited to prevent abuse.</li>
            <li>All admin actions are logged and auditable.</li>
          </ul>
        </section>

        <section id="faq">
          <h2 className="font-display text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" /> Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {FAQS.map((f) => (
              <div key={f.q} className="rounded-lg border border-border bg-card p-4">
                <h3 className="font-display text-base font-semibold text-foreground mb-2">{f.q}</h3>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
    <Footer />
  </div>
);

export default Rules;
