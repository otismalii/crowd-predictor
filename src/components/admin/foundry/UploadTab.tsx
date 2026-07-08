import { useCallback, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileJson } from "lucide-react";
import { toast } from "sonner";
import { parseJsonSafe } from "@/lib/foundry/validate";

type Props = { onLoaded: (payload: unknown, fileName: string) => void };

export const UploadTab = ({ onLoaded }: Props) => {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || !files.length) return;
    const file = files[0];
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large (max 5MB)");
      return;
    }
    const text = await file.text();
    const parsed = parseJsonSafe(text);
    if (!parsed.ok) {
      toast.error(`Invalid JSON: ${parsed.message}`);
      return;
    }
    setFileName(file.name);
    onLoaded(parsed.data, file.name);
  }, [onLoaded]);

  return (
    <Card
      className={`p-10 text-center border-2 border-dashed transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border/50"}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
    >
      <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
      <h3 className="font-semibold">Drop a Pagaza market package</h3>
      <p className="text-sm text-muted-foreground mt-1">.json file up to 5MB · 1–1000 markets</p>
      <div className="mt-4">
        <label className="inline-block">
          <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <Button type="button" variant="outline" onClick={(e) => (e.currentTarget.previousSibling as HTMLInputElement)?.click()}>Choose file</Button>
        </label>
      </div>
      {fileName && (
        <div className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <FileJson className="h-4 w-4" /> {fileName}
        </div>
      )}
    </Card>
  );
};
