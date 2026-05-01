import { Link } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

interface TradeSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: "buy" | "sell";
  shares: number;
  pricePerShare: number;
  totalCost: number;
  outcomeLabel: string;
  newPricePct: number | null;
}

const TradeSuccessDialog = ({
  open, onOpenChange, side, shares, pricePerShare, totalCost, outcomeLabel, newPricePct,
}: TradeSuccessDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle className="flex items-center gap-2 font-display tracking-wider">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          🦅 {side === "buy" ? "Shares Acquired" : "Shares Sold"}
        </AlertDialogTitle>
        <AlertDialogDescription asChild>
          <div className="space-y-3 pt-2">
            <div className="rounded-lg border border-border/30 bg-muted/20 p-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Outcome</span>
                <span className="font-semibold text-foreground">{outcomeLabel}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{side === "buy" ? "Shares bought" : "Shares sold"}</span>
                <span className="font-display font-bold tabular-nums">{shares.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Avg price</span>
                <span className="font-display font-bold tabular-nums">{pricePerShare.toFixed(2)} KES</span>
              </div>
              <div className="flex justify-between text-xs border-t border-border/30 pt-1.5">
                <span className="text-muted-foreground">{side === "buy" ? "Total cost" : "You received"}</span>
                <span className="font-display font-bold text-primary tabular-nums">{totalCost.toFixed(2)} KES</span>
              </div>
              {newPricePct !== null && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">New odds</span>
                  <span className="font-display font-bold text-primary tabular-nums">{newPricePct}¢</span>
                </div>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              Settlement recorded on the immutable ledger.
            </p>
          </div>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="gap-2">
        <Link to="/portfolio" className="flex-1">
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            View position
          </Button>
        </Link>
        <AlertDialogAction className="flex-1 neon-glow">Keep trading</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default TradeSuccessDialog;
