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
          className={cn(
            "bg-white text-black shadow-xl hover:bg-neutral-100",
            className,
          )}
        >
          <ShieldCheck />
          {/* Icon-only on small phones so it fits next to "Unesi kod". */}
          <span className="max-sm:sr-only">Privatnost</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Privatnost</DialogTitle>
          {/* <DialogDescription>
            Ova stranica ne koristi kolačiće, analitiku ni alate za praćenje i ne traži nikakve
            osobne podatke.
          </DialogDescription> */}
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          <p>
            Voditelj obrade je Hrvatski Caritas. Za pitanja o privatnosti i
            ostvarivanje prava možete nam se obratiti na{" "}
            <a href="mailto:gdpr@caritas.hr">
              <span className="font-semibold">gdpr@caritas.hr</span>
            </a>
            .
          </p>
          <p>
            Aplikacija ne zahtijeva unos imena ni e-mail adrese te ne koristi
            alate za praćenje posjetitelja, analitičke ni marketinške kolačiće.
            Pri korištenju aplikacije obrađuju se tehnički podaci potrebni za
            njezin rad i zaštitu od zlouporabe. Evidentiraju se jedinstveni QR
            kod, odabrana škola, vrijeme i status aktivacije. Ti se podaci
            koriste za evidentiranje doprinosa digitalnom gradilištu i prikaz
            zbirne statistike humanitarne akcije. Aplikacija ne prikuplja ili
            objavljuje identitet pojedinačnih donatora.
          </p>
          <p>
            <span className="font-semibold">Zapisi web poslužitelja.</span> Pri
            pristupu aplikaciji bilježe se datum i vrijeme pristupa, zatražena
            web-adresa, status odgovora poslužitelja te tehnički podaci o
            internetskom pregledniku i operacijskom sustavu. IP adrese
            automatski se anonimiziraju u standardnim zapisima web poslužitelja.
            Zapisi se čuvaju 7 dana, nakon čega se automatski brišu. Podaci se
            koriste isključivo radi osiguravanja dostupnosti i sigurnosti
            aplikacije te otklanjanja tehničkih poteškoća. Obrada podataka koji
            se mogu smatrati osobnim podacima temelji se na legitimnom interesu
            za siguran i pouzdan rad aplikacije, sukladno članku 6. stavku 1.
            točki (f) GDPR-a.
          </p>
          <p>
            <span className="font-semibold">Zaštita od pogađanja kodova.</span>{" "}
            Radi otkrivanja automatiziranih pokušaja obrađuju se IP adrese i
            podaci o neuspješnim unosima kodova. Nakon višestrukih neuspješnih
            pokušaja s iste IP adrese, daljnji pokušaji privremeno se blokiraju.
            Podaci o privremenim blokadama automatski se brišu nakon njihova
            isteka. Pravna osnova obrade je naš legitimni interes za
            sprječavanje neovlaštenog pristupa i zlouporabe aplikacije.
          </p>
          <p>
            Postavke u pregledniku. Kada promijenite postavke zvuka ili prikaza
            uputa, Vaš se odabir pohranjuje lokalno u pregledniku radi primjene
            odabranih postavki. Te se postavke ne šalju na poslužitelj i ne
            koriste se za praćenje korisnika. Čuvaju se do zatvaranja kartice
            preglednika, nakon čega se automatski brišu. Budući da služe
            isključivo primjeni postavki koje ste sami odabrali, za njihovu
            pohranu nije potrebna zasebna privola.
          </p>
          <p>
            <span className="font-semibold">Primatelji i prijenosi.</span>{" "}
            Osobne podatke za potrebe rada aplikacije obrađuju pružatelji usluga
            hostinga i tehničkog održavanja, u okviru svojih ugovorenih obveza.
            Podaci se ne prodaju niti ustupaju za marketing. Osobni podaci ne
            prenose se izvan Europskog gospodarskog prostora (EGP).
          </p>
          <p>
            <span className="font-semibold">Vaša prava.</span> Pod uvjetima
            propisanima GDPR-om možete zatražiti pristup osobnim podacima,
            njihov ispravak ili brisanje te ograničenje obrade. Na obradu
            utemeljenu na legitimnom interesu možete podnijeti prigovor zbog
            razloga povezanih s Vašom posebnom situacijom. Zahtjev pošaljite na
            <a href="mailto:gdpr@caritas.hr">
              <span className="font-semibold">gdpr@caritas.hr</span>
            </a>
            . Imate i pravo podnijeti pritužbu Agenciji za zaštitu osobnih
            podataka (AZOP),{" "}
            <a href="https://azop.hr/">
              <span className="font-semibold">www.azop.hr</span>
            </a>
            .
          </p>
          <p>
            Dostavljanje tehničkih podataka potrebnih za komunikaciju s
            poslužiteljem uvjet je tehničkog pristupa aplikaciji. Ako se
            aktivira sigurnosna blokada, unos kodova s te IP adrese privremeno
            je onemogućen.
          </p>
          <p>Posljednje ažuriranje: 11.11.2026.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
