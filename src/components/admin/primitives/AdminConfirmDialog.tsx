import { useState, ReactNode } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  /** Enforces admin audit protocol: requires a reason ≥6 chars */
  requireReason?: boolean;
  onConfirm: (reason: string) => Promise<void> | void;
};

export const AdminConfirmDialog = ({
  open, onOpenChange, title, description,
  confirmLabel = "Confirm", destructive, requireReason = true, onConfirm,
}: Props) => {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const canSubmit = !requireReason || reason.trim().length >= 6;

  const handle = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try { await onConfirm(reason.trim()); onOpenChange(false); setReason(""); }
    finally { setBusy(false); }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {requireReason && (
          <div className="space-y-1.5">
            <Label htmlFor="reason" className="text-xs">Reason (required, ≥6 chars — written to audit log)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this action is being taken…"
              rows={3}
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handle(); }}
            disabled={!canSubmit || busy}
            className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {busy ? "Processing…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
