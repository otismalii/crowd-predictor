import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import { Database, ExternalLink } from "lucide-react";

const sourceTiers = [
  {
    tier: "Tier 1 — Official Sources",
    desc: "Government agencies, election commissions, central banks, official league/association results.",
    examples: ["IEBC (Kenya)", "Central Bank of Kenya", "Kenya National Bureau of Statistics", "FIFA/CAF Official Results"],
  },
  {
    tier: "Tier 2 — Institutional Sources",
    desc: "Reputable institutional data providers and international organizations.",
    examples: ["World Bank", "IMF", "UN agencies", "Reuters", "Bloomberg"],
  },
  {
    tier: "Tier 3 — Public Data APIs",
    desc: "Structured, machine-readable data from trusted API providers.",
    examples: ["SportMonks", "Trading Economics API", "Open Exchange Rates"],
  },
  {
    tier: "Tier 4 — Trusted Media",
    desc: "Reputable media outlets used for confirmation, not primary resolution.",
    examples: ["Nation Media", "Standard Media", "BBC Africa", "Al Jazeera"],
  },
  {
    tier: "Tier 5 — Manual Review",
    desc: "Admin-driven resolution used only as a last resort with full evidence logging.",
    examples: ["Admin review with documented evidence and audit trail"],
  },
];

const Sources = () => (
  <div className="min-h-screen bg-background">
    <SEOHead title="Source Transparency" description="How Pagaza resolves markets. See our source hierarchy and commitment to transparent, evidence-based resolution." path="/sources" />
    <Navbar />
    <div className="container py-8 max-w-3xl">
      <h1 className="font-display text-3xl font-bold tracking-wider mb-2">
        <Database className="inline h-8 w-8 text-primary mr-2" />
        Source <span className="text-primary">Transparency</span>
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Every Pagaza market is resolved using a ranked source hierarchy. Higher-tier sources are always preferred.
      </p>

      <div className="space-y-6">
        {sourceTiers.map((tier, i) => (
          <div key={i} className="border border-border/30 rounded-xl p-5 bg-card/50">
            <h2 className="font-display text-sm font-bold text-foreground mb-1">{tier.tier}</h2>
            <p className="text-xs text-muted-foreground mb-3">{tier.desc}</p>
            <div className="flex flex-wrap gap-2">
              {tier.examples.map((ex) => (
                <span key={ex} className="text-[11px] px-2.5 py-1 rounded-full bg-muted/50 text-muted-foreground border border-border/30">
                  {ex}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
    <Footer />
  </div>
);

export default Sources;
