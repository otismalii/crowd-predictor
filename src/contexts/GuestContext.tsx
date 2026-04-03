import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface GuestContextType {
  guestId: string | null;
  isGuest: boolean;
  guestCredits: number;
  refreshGuest: () => Promise<void>;
  convertGuestToUser: () => Promise<void>;
}

const GuestContext = createContext<GuestContextType | undefined>(undefined);

function generateGuestId(): string {
  return "guest_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

export const GuestProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [guestId, setGuestId] = useState<string | null>(null);
  const [guestCredits, setGuestCredits] = useState(1000);

  useEffect(() => {
    if (user) {
      // Authenticated user — no guest session needed
      setGuestId(null);
      return;
    }

    // Check for existing guest_id
    let stored = localStorage.getItem("pagaza_guest_id");
    if (!stored) {
      stored = generateGuestId();
      localStorage.setItem("pagaza_guest_id", stored);
      document.cookie = `pagaza_guest_id=${stored};path=/;max-age=${60 * 60 * 24 * 30}`;
    }
    setGuestId(stored);

    // Upsert guest session in DB
    const initGuest = async () => {
      const { data } = await supabase
        .from("guest_sessions")
        .select("credits, expired")
        .eq("guest_id", stored!)
        .maybeSingle();

      if (data) {
        if (data.expired) {
          // Session expired, create new one
          const newId = generateGuestId();
          localStorage.setItem("pagaza_guest_id", newId);
          document.cookie = `pagaza_guest_id=${newId};path=/;max-age=${60 * 60 * 24 * 30}`;
          setGuestId(newId);
          await supabase.from("guest_sessions").insert({ guest_id: newId });
          setGuestCredits(1000);
        } else {
          setGuestCredits(Number(data.credits));
          await supabase
            .from("guest_sessions")
            .update({ last_active_at: new Date().toISOString() })
            .eq("guest_id", stored!);
        }
      } else {
        await supabase.from("guest_sessions").insert({ guest_id: stored! });
        setGuestCredits(1000);
      }
    };

    initGuest();
  }, [user]);

  const refreshGuest = useCallback(async () => {
    if (!guestId) return;
    const { data } = await supabase
      .from("guest_sessions")
      .select("credits")
      .eq("guest_id", guestId)
      .maybeSingle();
    if (data) setGuestCredits(Number(data.credits));
  }, [guestId]);

  const convertGuestToUser = useCallback(async () => {
    if (!guestId || !user) return;
    await supabase
      .from("guest_sessions")
      .update({ converted_user_id: user.id, expired: true })
      .eq("guest_id", guestId);
    localStorage.removeItem("pagaza_guest_id");
    setGuestId(null);
  }, [guestId, user]);

  return (
    <GuestContext.Provider
      value={{
        guestId,
        isGuest: !user && !!guestId,
        guestCredits,
        refreshGuest,
        convertGuestToUser,
      }}
    >
      {children}
    </GuestContext.Provider>
  );
};

export const useGuest = () => {
  const context = useContext(GuestContext);
  if (!context) throw new Error("useGuest must be used within GuestProvider");
  return context;
};
