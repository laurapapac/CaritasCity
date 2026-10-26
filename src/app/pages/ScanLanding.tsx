import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Check, Copy } from "lucide-react";
import { ApiError, scanQr, type ScanResponse } from "../../lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import logoUrl from "../../assets/logo-gradimir-blue.png";

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

// navigator.clipboard only exists in secure contexts (HTTPS/localhost), so
// fall back to execCommand for phones hitting the dev server over LAN HTTP.
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  return ok;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={copied ? "Kod kopiran" : "Kopiraj kod"}
      onClick={() => copyText(text).then(setCopied)}
    >
      {copied ? <Check className="text-green-600" /> : <Copy />}
    </Button>
  );
}

function CodeCard({ data }: { data: ScanResponse }) {
  const countdown = useCountdown(data.expiresAt);
  const expired = countdown === "0:00";

  return (
    <Card className="w-full max-w-sm">
      <CardContent className="flex flex-col items-center gap-4 pt-6">
        <img src={logoUrl} alt="GRADiMIR" className="h-auto max-h-[200px] w-auto max-w-full -mt-[73px]" />
        <p className="text-center font-bold">
          Posjetite na računalu web stranicu
          <br />
          gradimir.caritas.hr
        </p>
        <p className="text-muted-foreground text-center text-sm">
          Upišite kod prikazan na vašem telefonu.
        </p>
        <div className="flex items-center gap-2">
          <div className="text-3xl font-extrabold tracking-[0.3em]">{data.code}</div>
          <CopyButton text={data.code} />
        </div>
        <p className={expired ? "text-destructive" : "text-muted-foreground"}>
          {expired ? "Ovaj kod je istekao" : `Kod vrijedi još ${countdown}`}
        </p>
        <Button asChild className="w-full">
          <Link to="/">Idi na gradilište</Link>
        </Button>
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4 py-8">
      {state.phase === "loading" && <p className="text-muted-foreground">Učitavanje…</p>}

      {state.phase === "ready" && <CodeCard data={state.data} />}

      {state.phase === "unknown" && (
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>QR kod nije prepoznat</CardTitle>
            <CardDescription>
              Ovaj kod ne odgovara nijednoj kockici. Pokušajte ga ponovno skenirati.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {state.phase === "error" && (
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Nešto je pošlo po zlu</CardTitle>
            <CardDescription>Trenutačno nije moguće dobiti kod.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={load}>Pokušaj ponovno</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
