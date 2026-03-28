import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, AlertTriangle, CheckCircle2, Eye, RefreshCw, Layers } from "lucide-react";
import { motion } from "framer-motion";
import SpotlightCard from "@/components/reactbits/SpotlightCard";

const CATEGORIES = ["politics", "economics", "social", "local", "regional", "international", "sports"];
const MARKET_TYPES = ["yes_no", "multiple_choice", "over_under"];
const RISK_LEVELS = ["low", "medium", "high"];

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

interface MarketBuilderProps {
  onCreated: () => void;
}

const MarketBuilder = ({ onCreated }: MarketBuilderProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("politics");
  const [subcategory, setSubcategory] = useState("");
  const [marketType, setMarketType] = useState("yes_no");
  const [outcomes, setOutcomes] = useState([{ label: "Yes" }, { label: "No" }]);
  const [closesAt, setClosesAt] = useState("");
  const [resolutionRule, setResolutionRule] = useState("");
  const [resolutionSource, setResolutionSource] = useState("");
  const [riskLevel, setRiskLevel] = useState("medium");
  const [confidenceScore, setConfidenceScore] = useState(50);
  const [imageUrl, setImageUrl] = useState("");
  const [altText, setAltText] = useState("");
  const [tags, setTags] = useState("");

  // Validation warnings
  const warnings = useMemo(() => {
    const w: string[] = [];
    if (title.length < 10) w.push("Title is too short (min 10 chars)");
    if (title.length > 200) w.push("Title is too long (max 200 chars)");
    if (!resolutionRule.trim()) w.push("Resolution rule is missing");
    if (!resolutionSource.trim()) w.push("Resolution source is missing");
    if (!closesAt) w.push("Close time not set");
    if (outcomes.length < 2) w.push("Need at least 2 outcomes");
    if (outcomes.some(o => !o.label.trim())) w.push("Some outcomes are empty");
    const labels = outcomes.map(o => o.label.toLowerCase().trim());
    if (new Set(labels).size !== labels.length) w.push("Duplicate outcome labels");
    if (!description.trim()) w.push("Description is empty");
    return w;
  }, [title, resolutionRule, resolutionSource, closesAt, outcomes, description]);

  useEffect(() => {
    setSlug(slugify(title));
  }, [title]);

  useEffect(() => {
    if (marketType === "yes_no") {
      setOutcomes([{ label: "Yes" }, { label: "No" }]);
    }
  }, [marketType]);

  const reset = () => {
    setTitle(""); setSlug(""); setDescription(""); setCategory("politics");
    setSubcategory(""); setMarketType("yes_no"); setOutcomes([{ label: "Yes" }, { label: "No" }]);
    setClosesAt(""); setResolutionRule(""); setResolutionSource("");
    setRiskLevel("medium"); setConfidenceScore(50); setImageUrl(""); setAltText(""); setTags("");
  };

  const handleSave = async () => {
    if (warnings.length > 0) {
      toast({ title: "Fix warnings before publishing", description: warnings[0], variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Insert market
      const { data: market, error: marketError } = await supabase.from("markets").insert({
        title,
        slug: slug || slugify(title),
        description,
        category,
        subcategory: subcategory || null,
        status: "open" as any,
        closes_at: new Date(closesAt).toISOString(),
        resolution_rule: resolutionRule,
        resolution_source: resolutionSource,
        risk_level: riskLevel,
        confidence_score: confidenceScore,
        image_url: imageUrl || null,
        image_source_type: imageUrl ? "real" : "none",
        alt_text: altText || null,
        tags: tags ? tags.split(",").map(t => t.trim()) : [],
        created_by: user?.id,
      }).select("id").single();

      if (marketError) throw marketError;

      // Insert outcomes
      const outcomeInserts = outcomes.map((o, i) => ({
        market_id: market.id,
        label: o.label,
        sort_order: i,
      }));
      const { error: outcomeError } = await supabase.from("market_outcomes").insert(outcomeInserts);
      if (outcomeError) throw outcomeError;

      // Insert source record
      if (resolutionSource) {
        await supabase.from("market_sources").insert({
          market_id: market.id,
          source_type: "official",
          source_name: resolutionSource,
          confidence: confidenceScore,
        });
      }

      // Insert audit log
      await supabase.from("market_audit_log").insert({
        market_id: market.id,
        action: "market_created",
        details: { title, category, outcomes: outcomes.map(o => o.label) },
        performed_by: user!.id,
      });

      toast({ title: "✅ Market created!", description: title });
      reset();
      setOpen(false);
      onCreated();
    } catch (e: any) {
      toast({ title: "Failed to create market", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="neon-glow gap-2">
          <Plus className="h-4 w-4" /> Create Market
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Market Builder Studio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-1">
              {warnings.map((w, i) => (
                <p key={i} className="text-xs text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" /> {w}
                </p>
              ))}
            </div>
          )}

          {/* Type + Category */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Market Type</Label>
              <Select value={marketType} onValueChange={setMarketType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes_no">Yes / No</SelectItem>
                  <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                  <SelectItem value="over_under">Over / Under</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Subcategory</Label>
              <Input value={subcategory} onChange={e => setSubcategory(e.target.value)} placeholder="e.g. County Elections" />
            </div>
          </div>

          {/* Title + Slug */}
          <div>
            <Label className="text-xs">Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Will X happen before Y?" />
            <p className="text-[10px] text-muted-foreground mt-1">Slug: /markets/{slug || "..."}</p>
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Clear context for this market..." rows={3} />
          </div>

          {/* Outcomes */}
          <div>
            <Label className="text-xs">Outcomes *</Label>
            <div className="space-y-2">
              {outcomes.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={o.label}
                    onChange={e => {
                      const next = [...outcomes];
                      next[i] = { label: e.target.value };
                      setOutcomes(next);
                    }}
                    placeholder={`Outcome ${i + 1}`}
                  />
                  {outcomes.length > 2 && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setOutcomes(outcomes.filter((_, j) => j !== i))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              {marketType !== "yes_no" && (
                <Button variant="outline" size="sm" onClick={() => setOutcomes([...outcomes, { label: "" }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add Outcome
                </Button>
              )}
            </div>
          </div>

          {/* Resolution */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Resolution Rule *</Label>
              <Textarea value={resolutionRule} onChange={e => setResolutionRule(e.target.value)} placeholder="This market resolves YES if..." rows={2} />
            </div>
            <div>
              <Label className="text-xs">Primary Source *</Label>
              <Input value={resolutionSource} onChange={e => setResolutionSource(e.target.value)} placeholder="e.g. IEBC Official Results" />
            </div>
          </div>

          {/* Time + Risk */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Closes At *</Label>
              <Input type="datetime-local" value={closesAt} onChange={e => setClosesAt(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Risk Level</Label>
              <Select value={riskLevel} onValueChange={setRiskLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RISK_LEVELS.map(r => <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Confidence ({confidenceScore}%)</Label>
              <Input type="range" min={0} max={100} value={confidenceScore} onChange={e => setConfidenceScore(Number(e.target.value))} />
            </div>
          </div>

          {/* Image + Tags */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Image URL</Label>
              <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label className="text-xs">Tags (comma-separated)</Label>
              <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="kenya, elections, 2027" />
            </div>
          </div>

          {imageUrl && (
            <div>
              <Label className="text-xs">Alt Text</Label>
              <Input value={altText} onChange={e => setAltText(e.target.value)} placeholder="Describe the image" />
            </div>
          )}

          {/* Preview card */}
          {title && (
            <div>
              <Label className="text-xs mb-2 block">Preview</Label>
              <SpotlightCard spotlightColor="rgba(120, 255, 120, 0.08)" className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px]">{category}</Badge>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">OPEN</span>
                </div>
                <h3 className="font-display text-sm font-bold">{title}</h3>
                {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
                <div className="flex gap-2 mt-3">
                  {outcomes.filter(o => o.label).map((o, i) => (
                    <span key={i} className="text-xs px-3 py-1.5 rounded-lg border border-border/30 bg-muted/20">{o.label}</span>
                  ))}
                </div>
              </SpotlightCard>
            </div>
          )}

          {/* Submit */}
          <Button
            onClick={handleSave}
            disabled={saving || warnings.length > 0}
            className="w-full neon-glow font-display tracking-wider"
          >
            {saving ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : (
              <><CheckCircle2 className="mr-2 h-4 w-4" /> Publish Market</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MarketBuilder;
