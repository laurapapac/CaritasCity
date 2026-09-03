import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router";
import { ApiError, scanQr, type ScanResponse } from "../../lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import logoUrl from "../../assets/logo-caritas-crvena.png";

type State =
  | { phase: "loading" }
  | { phase: "ready"; data: ScanResponse }
  | { phase: "unknown" }
  | { phase: "error" };

function useCountdown(expiresAt: string): string {
  const [remaining, setRemaining] = useState(() => Date.parse(expiresAt) - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(Date.parse(expiresAt) - Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const totalSeconds = Math.max(0, Math.floor(remaining / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function CodeCard({ data }: { data: ScanResponse }) {
  const countdown = useCountdown(data.expiresAt);
  const expired = countdown === "0:00";

  return (
    <Card className="w-full max-w-sm">
      <CardContent className="flex flex-col items-center gap-4 pt-6">
        <p className="text-center font-bold">
          Posjetite na računalu web stranicu
          <br />
          gradimir.caritas.hr
        </p>
        <p className="text-muted-foreground text-center text-sm">
          Upišite kod prikazan na vašem telefonu.
        </p>
        <div className="text-6xl font-extrabold tracking-[0.3em]">{data.code}</div>
        <p className={expired ? "text-destructive" : "text-muted-foreground"}>
          {expired ? "This code has expired" : `Valid for ${countdown}`}
        </p>
      </CardContent>
    </Card>
  );
}

export default function ScanLanding() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>({ phase: "loading" });

  const load = useCallback(() => {
    if (!token) return;
    setState({ phase: "loading" });
    scanQr(token)
      .then((data) => setState({ phase: "ready", data }))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setState({ phase: "unknown" });
        } else {
          setState({ phase: "error" });
        }
      });
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 bg-background px-4 pt-12 pb-8">
      <img src={logoUrl} alt="GRADiMIR" className="h-20 w-auto" />

      {state.phase === "loading" && <p className="text-muted-foreground">Loading…</p>}

      {state.phase === "ready" && <CodeCard data={state.data} />}

      {state.phase === "unknown" && (
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>QR code not recognized</CardTitle>
            <CardDescription>
              This code doesn't match any block we know about. Try scanning again, or ask a
              volunteer for help.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {state.phase === "error" && (
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>Couldn't get a code right now.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={load}>Try again</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
