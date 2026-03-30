import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

interface EnvStatusItem {
  key: string;
  isSet: boolean;
  required: boolean;
  scope: "public" | "server";
  source: string;
  note: string;
}

function getSupabaseHost(url: string | undefined) {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).host;
  } catch {
    return "Neispravan URL";
  }
}

export default function PostavkePage() {
  const envItems: EnvStatusItem[] = [
    {
      key: "NEXTAUTH_SECRET",
      isSet: Boolean(process.env.NEXTAUTH_SECRET),
      required: true,
      scope: "server",
      source: "Generiraj lokalno (npr. openssl rand -base64 32)",
      note: "Koristi se za potpis JWT tokena i session kolačića.",
    },
    {
      key: "NEXTAUTH_URL",
      isSet: Boolean(process.env.NEXTAUTH_URL),
      required: true,
      scope: "server",
      source: "Lokalno http://localhost:3000, produkcija stvarni domen",
      note: "Canonical URL aplikacije za auth callback i redirect tokove.",
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      isSet: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      required: true,
      scope: "public",
      source: "Supabase Dashboard -> Project Settings -> API",
      note: "Javni URL tvog Supabase projekta.",
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      isSet: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      required: true,
      scope: "public",
      source: "Supabase Dashboard -> Project Settings -> API",
      note: "Javni anon key za klijentske i server read tokove pod RLS pravilima.",
    },
    {
      key: "SUPABASE_SERVICE_ROLE_KEY",
      isSet: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      required: true,
      scope: "server",
      source: "Supabase Dashboard -> Project Settings -> API",
      note: "Server-only ključ s povišenim privilegijama. Nikad u client kod.",
    },
    {
      key: "SUPABASE_PROJECT_ID",
      isSet: Boolean(process.env.SUPABASE_PROJECT_ID),
      required: false,
      scope: "server",
      source: "Supabase Dashboard ili URL projekta",
      note: "Koristi se samo za npm run gen:types skriptu.",
    },
  ];

  const missingRequiredCount = envItems.filter(
    (item) => item.required && !item.isSet,
  ).length;
  const supabaseHost = getSupabaseHost(process.env.NEXT_PUBLIC_SUPABASE_URL);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Postavke"
        description="Operativni setup za autentikaciju, Supabase konekciju i sigurnosne ključeve po okruženju."
        actions={
          <Badge variant={missingRequiredCount === 0 ? "success" : "warning"}>
            Nedostaje: {missingRequiredCount}
          </Badge>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
            Konfiguracija po varijablama
          </h2>

          <ul className="mt-4 space-y-2.5">
            {envItems.map((item) => (
              <li
                key={item.key}
                className="rounded-xl border border-border bg-slate-950/55 px-3 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="data-font text-sm font-semibold text-slate-100">{item.key}</p>
                    <p className="mt-1 text-xs text-muted">{item.note}</p>
                    <p className="mt-1 text-xs text-slate-400">Izvor: {item.source}</p>
                  </div>

                  <div className="flex gap-2">
                    <Badge variant={item.scope === "public" ? "info" : "neutral"}>
                      {item.scope === "public" ? "Public" : "Server"}
                    </Badge>
                    <Badge
                      variant={
                        item.isSet ? "success" : item.required ? "danger" : "warning"
                      }
                    >
                      {item.isSet ? "Postavljeno" : item.required ? "Nedostaje" : "Opcionalno"}
                    </Badge>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-5">
          <Card>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
              Trenutni data layer
            </h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-border bg-slate-950/55 px-3 py-2">
                <dt className="text-muted">Baza</dt>
                <dd className="font-semibold text-slate-100">Supabase Postgres</dd>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-slate-950/55 px-3 py-2">
                <dt className="text-muted">Data client</dt>
                <dd className="font-semibold text-cyan-200">@supabase/supabase-js</dd>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-slate-950/55 px-3 py-2">
                <dt className="text-muted">ORM layer</dt>
                <dd className="font-semibold text-emerald-200">Bez Prisme (supabase-js)</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
              Supabase endpoint
            </h3>
            <p className="mt-3 text-sm text-muted">
              {supabaseHost
                ? `Povezano na host: ${supabaseHost}`
                : "NEXT_PUBLIC_SUPABASE_URL još nije postavljen."}
            </p>
            <p className="mt-3 text-xs text-slate-400">
              Ključevi se postavljaju u .env.local za lokalni razvoj i u deployment provider env postavkama za produkciju.
            </p>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
              Brzi setup checklist
            </h3>
            <ol className="mt-3 space-y-2 text-sm text-slate-300">
              <li>1. Kopiraj .env.example u .env.local i popuni sva required polja.</li>
              <li>2. U Supabase dashboardu uzmi URL, anon key i service role key.</li>
              <li>3. Generiraj NEXTAUTH_SECRET i postavi NEXTAUTH_URL prema okruženju.</li>
              <li>4. Pokreni npm run gen:types pa npm run lint i npm run typecheck.</li>
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
