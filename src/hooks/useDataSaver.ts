import { useEffect, useState } from "react";

const KEY = "betwise.datasaver";
const EVENT = "betwise:datasaver";

export function getDataSaver() {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

/** Data Saver: when on, team crests and heavy images are not downloaded. */
export function useDataSaver() {
  const [on, setOn] = useState(getDataSaver);
  useEffect(() => {
    const sync = () => setOn(getDataSaver());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  const set = (v: boolean) => {
    try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* ignore */ }
    window.dispatchEvent(new Event(EVENT));
  };
  return [on, set] as const;
}
