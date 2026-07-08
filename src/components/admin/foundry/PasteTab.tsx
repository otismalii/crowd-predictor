import { useState } from "react";
import Editor from "@monaco-editor/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { parseJsonSafe } from "@/lib/foundry/validate";
import { Wand2 } from "lucide-react";

const SAMPLE = JSON.stringify({
  version: "1.0",
  batchName: "Sample Batch",
  generatedBy: "manual",
  generatedAt: new Date().toISOString(),
  markets: [
    {
      question: "Will Arsenal beat Chelsea on 2026-08-01?",
      category: "sports",
      subcategory: "football",
      outcomes: [{ label: "Yes", initialProbability: 0.55 }, { label: "No", initialProbability: 0.45 }],
      closesAt: "2026-08-01T14:00:00Z",
      resolutionRules: "Resolves to the winner of the 90-minute match per official Premier League site.",
      initialLiquidity: 1000,
    },
  ],
}, null, 2);

type Props = { onLoaded: (payload: unknown) => void };

export const PasteTab = ({ onLoaded }: Props) => {
  const [value, setValue] = useState<string>(SAMPLE);

  const parse = () => {
    const p = parseJsonSafe(value);
    if (!p.ok) { toast.error(`Invalid JSON: ${p.message}`); return; }
    onLoaded(p.data);
  };

  const format = () => {
    const p = parseJsonSafe(value);
    if (!p.ok) { toast.error(`Cannot format: ${p.message}`); return; }
    setValue(JSON.stringify(p.data, null, 2));
  };

  return (
    <Card className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Paste a Pagaza market package. Monaco provides syntax, format, and errors.</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={format} className="gap-1.5"><Wand2 className="h-4 w-4" /> Format</Button>
          <Button size="sm" onClick={parse}>Validate</Button>
        </div>
      </div>
      <div className="h-[520px] border border-border/50 rounded overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage="json"
          value={value}
          onChange={(v) => setValue(v ?? "")}
          theme="vs-dark"
          options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: "on", formatOnPaste: true, scrollBeyondLastLine: false }}
        />
      </div>
    </Card>
  );
};
