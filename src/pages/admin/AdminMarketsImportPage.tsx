import { useEffect, useState } from "react";
import { AdminPageHeader, AdminPageBody } from "@/components/admin/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { UploadCloud, ClipboardPaste, History, Upload } from "lucide-react";
import { UploadTab } from "@/components/admin/foundry/UploadTab";
import { PasteTab } from "@/components/admin/foundry/PasteTab";
import { HistoryTab } from "@/components/admin/foundry/HistoryTab";
import { PreviewGrid } from "@/components/admin/foundry/PreviewGrid";
import { validatePackage } from "@/lib/foundry/validate";
import type { RowResult } from "@/lib/foundry/schema";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const AdminMarketsImportPage = () => {
  const [tab, setTab] = useState("upload");
  const [rows, setRows] = useState<RowResult[]>([]);
  const [pkg, setPkg] = useState<any>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const handleLoaded = async (payload: unknown) => {
    setBatchId(null);
    const result = await validatePackage(payload);
    if (result.fatal?.length) {
      toast.error(`Package invalid: ${result.fatal[0].message}`);
      setRows([]);
      setPkg(null);
      return;
    }
    setPkg(result.package);
    setRows(result.rows);
    toast.success(`${result.summary.ready} ready · ${result.summary.warning} warning · ${result.summary.error} error`);
  };

  const saveBatch = async () => {
    if (!pkg || !rows.length) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("import-markets-validate", {
      body: {
        pkg,
        rows: rows.map((r) => ({
          rowIndex: r.rowIndex, raw: r.raw, normalized: r.normalized ?? null,
          slug: r.slug ?? null, questionHash: r.questionHash ?? null,
          status: r.status, issues: r.issues,
        })),
      },
    });
    setSaving(false);
    if (error || (data as any)?.error) { toast.error(error?.message || (data as any)?.error); return; }
    setBatchId((data as any).batchId);
    toast.success("Batch saved");
  };

  const publishRows = async (rowIndexes: number[]) => {
    if (!batchId) { await saveBatch(); }
    const id = batchId;
    if (!id) return;
    setPublishing(true);
    const { data, error } = await supabase.functions.invoke("import-markets-publish", {
      body: { batchId: id, rowIndexes },
    });
    setPublishing(false);
    if (error || (data as any)?.error) { toast.error(error?.message || (data as any)?.error); return; }
    const res = data as any;
    toast.success(`Published ${res.published} · Failed ${res.failed}`);
    setRows((prev) => prev.map((r) => {
      const updated = res.rowResults?.find((x: any) => x.rowIndex === r.rowIndex);
      if (!updated) return r;
      return { ...r, status: updated.status };
    }));
  };

  const rejectRows = (rowIndexes: number[]) => {
    const idx = new Set(rowIndexes);
    setRows((prev) => prev.map((r) => idx.has(r.rowIndex) ? { ...r, status: "error" as const, issues: [...r.issues, { code: "rejected", severity: "error", message: "Rejected by operator" }] } : r));
    toast.success(`Rejected ${rowIndexes.length}`);
  };

  const viewBatch = async (id: string) => {
    setBatchId(id);
    const { data, error } = await supabase.from("market_import_rows")
      .select("row_index,raw_market,normalized_market,slug,question_hash,status,issues")
      .eq("batch_id", id).order("row_index", { ascending: true });
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []).map((d: any) => ({
      rowIndex: d.row_index, raw: d.raw_market, normalized: d.normalized_market ?? undefined,
      slug: d.slug ?? undefined, questionHash: d.question_hash ?? undefined,
      status: d.status, issues: d.issues ?? [],
    })));
    setTab("upload");
    toast.success("Loaded batch");
  };

  return (
    <>
      <AdminPageHeader
        icon={Upload}
        title="Import Markets"
        subtitle="Upload · Paste · History — publish hundreds of markets from any JSON provider"
      />
      <AdminPageBody>
        <div className="space-y-6">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="upload" className="gap-1.5"><UploadCloud className="h-4 w-4" /> Upload</TabsTrigger>
              <TabsTrigger value="paste" className="gap-1.5"><ClipboardPaste className="h-4 w-4" /> Paste</TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5"><History className="h-4 w-4" /> History</TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="mt-4">
              <UploadTab onLoaded={(payload) => handleLoaded(payload)} />
            </TabsContent>
            <TabsContent value="paste" className="mt-4">
              <PasteTab onLoaded={handleLoaded} />
            </TabsContent>
            <TabsContent value="history" className="mt-4">
              <HistoryTab onView={viewBatch} />
            </TabsContent>
          </Tabs>

          {rows.length > 0 && (
            <div className="space-y-3">
              <Card className="flex items-center justify-between p-3">
                <div className="text-sm">
                  <span className="font-medium">{pkg?.batchName ?? "Batch preview"}</span>
                  <span className="text-muted-foreground"> · {rows.length} markets</span>
                  {batchId && <span className="text-muted-foreground"> · saved</span>}
                </div>
                {!batchId && (
                  <Button size="sm" variant="outline" onClick={saveBatch} disabled={saving}>
                    {saving ? "Saving…" : "Save batch"}
                  </Button>
                )}
              </Card>
              <PreviewGrid rows={rows} onPublish={publishRows} onReject={rejectRows} publishing={publishing} />
            </div>
          )}
        </div>
      </AdminPageBody>
    </>
  );
};

export default AdminMarketsImportPage;
