import { ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "./ui/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

// Privacy notice (2026-10-13). The app sets no cookies and no tracking; the
// only personal data is the IP address — in the web servers' access logs,
// and for a few minutes in memory after a wrong code (codeFailureLimiter.ts).
// GDPR art. 13 still requires telling visitors that, so this covers who is
// responsible, what/why, legal basis, recipients, retention and rights.
//
// TODO before going live — fill these in (they show up in the dialog as-is):
const CONTROLLER = "[Naziv organizacije, adresa]";
const CONTACT_EMAIL = "caritas.croatia@caritas.hr";
const HOSTING_PROVIDER = "[naziv pružatelja hostinga]";
const LOG_RETENTION = "14 dana"; // must match how long the server logs are really kept

/** White counterpart of the red "Unesi kod" button; opens the privacy dialog. */
export function PrivacyButton({ className }: { className?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          size="lg"
          className={cn("bg-white text-black shadow-xl hover:bg-neutral-100", className)}
        >
          <ShieldCheck />
          {/* Icon-only on small phones so it fits next to "Unesi kod". */}
          <span className="max-sm:sr-only">Privatnost</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Privatnost</DialogTitle>
          <DialogDescription>
            Ova stranica ne koristi kolačiće, analitiku ni alate za praćenje i ne traži nikakve
            osobne podatke.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          <p>
            <span className="font-semibold">Što se obrađuje: </span>
            Kao i svaki web poslužitelj, naš poslužitelj bilježi IP adresu i vrstu preglednika pri
            svakom posjetu (zapisi poslužitelja). Pri pogrešno unesenom kodu IP adresa se nakratko
            pamti u radnoj memoriji (nekoliko minuta) kako bi se spriječilo pogađanje kodova.
          </p>
          <p>
            <span className="font-semibold">Zašto: </span>
            Isključivo radi sigurnog i ispravnog rada stranice (legitimni interes, čl. 6. st. 1.
            t. (f) GDPR-a).
          </p>
          <p>
            <span className="font-semibold">Koliko dugo: </span>
            Zapisi poslužitelja brišu se nakon {LOG_RETENTION}.
          </p>
          <p>
            <span className="font-semibold">U pregledniku </span>
            se spremaju samo vaše postavke (zvuk uključen/isključen, prikaz uputa), i to tek kad ih
            sami promijenite.
          </p>
          <p>
            Za sva pitanja vezana uz zaštitu osobnih podataka možete se obratiti na sljedeću e-mail adresu: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
