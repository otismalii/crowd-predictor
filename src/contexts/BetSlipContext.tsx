import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { SlipSelection } from "@/types/sportsbook";

const STORAGE_KEY = "pagaza.betslip.v1";

type BetSlipContextValue = {
  selections: SlipSelection[];
  stake: number;
  setStake: (value: number) => void;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggleSelection: (selection: SlipSelection) => void;
  removeSelection: (matchId: string, market: string, selection: string, line: number | null) => void;
  /** Replace the slip wholesale — used when live prices are accepted. */
  replaceSelections: (next: SlipSelection[]) => void;
  clear: () => void;
  has: (matchId: string, market: string, selection: string, line: number | null) => boolean;

  combinedOdds: number;
  potentialPayout: number;
  slipType: "single" | "acca";
};

const BetSlipContext = createContext<BetSlipContextValue | null>(null);

const keyOf = (matchId: string, market: string, selection: string, line: number | null) =>
  `${matchId}|${market}|${selection}|${line ?? ""}`;

export const BetSlipProvider = ({ children }: { children: React.ReactNode }) => {
  const [selections, setSelections] = useState<SlipSelection[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as SlipSelection[]) : [];
    } catch {
      return [];
    }
  });
  const [stake, setStake] = useState(100);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selections));
    } catch { /* storage unavailable — slip stays in memory */ }
  }, [selections]);

  const toggleSelection = useCallback((next: SlipSelection) => {
    setSelections((current) => {
      const key = keyOf(next.matchId, next.market, next.selection, next.line);
      if (current.some((s) => keyOf(s.matchId, s.market, s.selection, s.line) === key)) {
        return current.filter((s) => keyOf(s.matchId, s.market, s.selection, s.line) !== key);
      }
      // One selection per match: picking another market on the same match replaces it.
      const withoutMatch = current.filter((s) => s.matchId !== next.matchId);
      return [...withoutMatch, next];
    });
    setIsOpen(true);
  }, []);

  const removeSelection = useCallback((matchId: string, market: string, selection: string, line: number | null) => {
    const key = keyOf(matchId, market, selection, line);
    setSelections((current) => current.filter((s) => keyOf(s.matchId, s.market, s.selection, s.line) !== key));
  }, []);

  const has = useCallback(
    (matchId: string, market: string, selection: string, line: number | null) =>
      selections.some((s) => keyOf(s.matchId, s.market, s.selection, s.line) === keyOf(matchId, market, selection, line)),
    [selections],
  );

  const clear = useCallback(() => setSelections([]), []);

  const combinedOdds = useMemo(
    () => (selections.length === 0 ? 0 : Number(selections.reduce((acc, s) => acc * s.odds, 1).toFixed(2))),
    [selections],
  );

  const value: BetSlipContextValue = {
    selections,
    stake,
    setStake,
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggleSelection,
    removeSelection,
    replaceSelections: (next: SlipSelection[]) => setSelections(next),

    clear,
    has,
    combinedOdds,
    potentialPayout: Number((stake * combinedOdds).toFixed(2)),
    slipType: selections.length > 1 ? "acca" : "single",
  };

  return <BetSlipContext.Provider value={value}>{children}</BetSlipContext.Provider>;
};

export const useBetSlip = () => {
  const ctx = useContext(BetSlipContext);
  if (!ctx) throw new Error("useBetSlip must be used inside a BetSlipProvider");
  return ctx;
};
