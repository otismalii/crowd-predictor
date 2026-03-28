import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";

const faqs = [
  { q: "What is Pagaza?", a: "Pagaza is a prediction market platform where you forecast real-world outcomes across politics, economics, sports, and more. It's Kenya-first but covers regional and international events too." },
  { q: "Do I need an account to browse?", a: "No! You can browse all markets, outcomes, and resolved results without signing up. Creating an account lets you save your history, compete on leaderboards, and access cross-device syncing." },
  { q: "Is this real money?", a: "No. During beta, all trading uses virtual currency (KES). No real-money deposits or withdrawals are enabled yet." },
  { q: "How are markets resolved?", a: "Each market has a resolution rule and source defined at creation. We use official sources first, then trusted public data. All resolution evidence is visible on the market page." },
  { q: "What is LMSR pricing?", a: "LMSR (Logarithmic Market Scoring Rule) is a proven market maker algorithm. Prices reflect the probability of each outcome. Buying shares in an outcome increases its price." },
  { q: "Can I dispute a resolution?", a: "Yes. You can flag a market within 48 hours of resolution. Provide your reason and evidence, and an admin will review it." },
  { q: "What categories are available?", a: "Politics, Economics, Social, Local (Kenya), Regional (East Africa), International, and Sports." },
  { q: "How do I earn credits?", a: "Guest users start with 1,000 virtual KES. Registered users also receive starter credits. You earn more by making correct predictions." },
  { q: "Is my data safe?", a: "Yes. We use Supabase for secure data storage with row-level security. Guest sessions are anonymous and limited." },
];

const FAQ = () => (
  <div className="min-h-screen bg-background">
    <SEOHead title="FAQ" description="Frequently asked questions about Pagaza prediction markets — how it works, resolution, trading, and more." path="/faq" />
    <Navbar />
    <div className="container py-8 max-w-3xl">
      <h1 className="font-display text-3xl font-bold tracking-wider mb-6">
        <HelpCircle className="inline h-8 w-8 text-primary mr-2" />
        Frequently Asked <span className="text-primary">Questions</span>
      </h1>

      <Accordion type="single" collapsible className="space-y-2">
        {faqs.map((faq, i) => (
          <AccordionItem key={i} value={`faq-${i}`} className="border border-border/30 rounded-lg px-4 bg-card/50">
            <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline">
              {faq.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              {faq.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
    <Footer />
  </div>
);

export default FAQ;
