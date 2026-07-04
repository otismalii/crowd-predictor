import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Shield, XCircle } from "lucide-react";

// Only same-origin relative paths are safe as a post-login redirect target.
function safeRelative(next: string | null): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

type OAuthClient = { supabase_client?: { name?: string; logo?: string } | null } & Record<string, unknown>;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<OAuthClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        // Preserve the FULL consent URL so auth returns the user here.
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      // Beta namespace — cast to any so this compiles without newer types.
      const anyAuth = supabase.auth as unknown as {
        oauth: {
          getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
          approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
          denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
        };
      };
      const { data, error } = await anyAuth.oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message ?? "Could not load authorization details");
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const anyAuth = supabase.auth as unknown as {
      oauth: {
        approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
        denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
      };
    };
    const { data, error } = approve
      ? await anyAuth.oauth.approveAuthorization(authorizationId)
      : await anyAuth.oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message ?? "Request failed");
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Authorization error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading authorization…
        </div>
      </main>
    );
  }

  const clientName = (details as any).client?.name ?? "an app";

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Connect {clientName} to your account</CardTitle>
          <CardDescription>
            This lets {clientName} use Pagaza tools as you. You can revoke access anytime from your account settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
            Deny
          </Button>
          <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

// re-export helper for tests
export { safeRelative };
