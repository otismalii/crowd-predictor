import { CheckCircle2, AlertTriangle } from "lucide-react";

interface ReconciliationBadgeProps {
  walletBalance: number;
  ledgerBalance: number | null;
}

const ReconciliationBadge = ({ walletBalance, ledgerBalance }: ReconciliationBadgeProps) => {
  if (ledgerBalance === null) return null;
  const drift = Math.abs(walletBalance - ledgerBalance);
  const ok = drift < 0.01;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
        ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
      }`}
      title={ok ? "Wallet matches ledger" : `Drift: ${drift.toFixed(2)} KES`}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {ok ? "Reconciled" : "Drift detected"}
    </div>
  );
};

export default ReconciliationBadge;
