import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import { Shield, CheckCircle2, AlertTriangle, Scale, Eye, HelpCircle, Info, Wallet } from "lucide-react";
import {
  BET_MIN_KES,
  DEPOSIT_MAX_KES,
  DEPOSIT_MIN_KES,
  WITHDRAW_DAILY_CAP_KES,
  WITHDRAW_MIN_KES,
} from "@/lib/constants";

const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

const FAQS = [
  {
    q: "What is Betwise?",
    a: "Betwise is a Kenyan sportsbook and casino. Bet on live and upcoming football and play Pop It, with M-Pesa deposits and withdrawals.",
  },
  {
    q: "How are bets settled?",
    a: "Results come from official football data feeds. When a match finishes, your slip is settled automatically and winnings go straight to your wallet.",
  },
  {
    q: "What happens if a match is postponed or cancelled?",
    a: "Selections on postponed or cancelled matches are voided. A single bet is refunded; on an accumulator that leg counts at odds 1.00.",
  },
  {
    q: "Why do I need a +254 phone?",
    a: "A verified Kenyan phone number is required to withdraw. It keeps accounts real and stops duplicate-account abuse.",
  },
  {
    q: "How fast are withdrawals?",
    a: `Most withdrawals up to KES 5,000 are paid to M-Pesa automatically. Larger amounts are checked by our team first. Minimum ${kes(WITHDRAW_MIN_KES)}, daily limit ${kes(WITHDRAW_DAILY_CAP_KES)}.`,
  },
  {
    q: "Is Pop It fair?",
    a: "Yes. Every round's crash point is fixed before it starts and locked with a SHA-256 fingerprint you can check after the round.",
  },
];

const Section = ({ id, icon: Icon, title, children }: { id: string; icon: typeof Info; title: string; children: React.ReactNode }) => (
  <section id={id}>
    <h2 className="font-display text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
      <Icon className="h-5 w-5 text-primary" /> {title}
    </h2>
    {children}
  </section>
);

const Rules = () => (
  <div className="min-h-screen bg-background">
    <SEOHead
      title="Rules & FAQ"
      description="Betwise betting rules: settlement, voids, Pop It fairness, M-Pesa deposits and withdrawals, and responsible play."
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
      <p className="text-muted-foreground mb-10">How betting, payouts and Pop It work on Betwise.</p>

      <div className="space-y-10 text-sm text-muted-foreground">
        <Section id="about" icon={Info} title="About Betwise">
          <p>Betwise is a Kenya-first sportsbook and casino. Mobile-first, M-Pesa native, every shilling recorded in a ledger. Strictly 18+.</p>
        </Section>

        <Section id="betting" icon={Scale} title="Betting Rules">
          <ul className="space-y-2 list-disc list-inside">
            <li>Minimum stake is {kes(BET_MIN_KES)} per slip.</li>
            <li>Singles and accumulators are supported. Accumulator odds multiply across legs.</li>
            <li>Odds can change before you place a slip — you'll be asked to confirm new odds.</li>
            <li>No bets are accepted on a selection after it is suspended or the match has started (unless live).</li>
          </ul>
        </Section>

        <Section id="settlement" icon={CheckCircle2} title="Settlement">
          <ul className="space-y-2 list-disc list-inside">
            <li>Results come from official data feeds, never typed in by hand.</li>
            <li>Slips settle automatically within minutes of the final whistle.</li>
            <li>Winnings are credited to your wallet instantly on settlement.</li>
            <li>Postponed or cancelled matches are voided and stakes refunded.</li>
          </ul>
        </Section>

        <Section id="money" icon={Wallet} title="Deposits & Withdrawals">
          <ul className="space-y-2 list-disc list-inside">
            <li>Deposits via M-Pesa: {kes(DEPOSIT_MIN_KES)} – {kes(DEPOSIT_MAX_KES)}. Your wallet is credited once payment is confirmed.</li>
            <li>Withdrawals: minimum {kes(WITHDRAW_MIN_KES)}, daily limit {kes(WITHDRAW_DAILY_CAP_KES)}, to a verified +254 number.</li>
            <li>Small low-risk withdrawals are paid automatically; larger ones are reviewed first.</li>
          </ul>
        </Section>

        <Section id="popit" icon={Shield} title="Pop It">
          <ul className="space-y-2 list-disc list-inside">
            <li>Place a stake before the round starts, then cash out before it pops.</li>
            <li>Set an optional auto cash-out multiplier.</li>
            <li>Crash points are committed in advance with a verifiable SHA-256 fingerprint.</li>
          </ul>
        </Section>

        <Section id="fair-play" icon={Eye} title="Fair Play">
          <ul className="space-y-2 list-disc list-inside">
            <li>One account per person. Duplicate accounts are closed.</li>
            <li>Repeated rapid submissions are blocked.</li>
            <li>All admin actions are logged and auditable.</li>
          </ul>
        </Section>

        <Section id="responsible" icon={AlertTriangle} title="Play Responsibly">
          <p>Only bet what you can afford to lose. If betting stops being fun, take a break or contact support to limit your account.</p>
        </Section>

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
