# Carlytics

Fleet management aplikacija za praćenje vozila, zaduženja, goriva, kvarova, servisnih intervencija i zaposlenika.

Projekt je napravljen kao role-aware sustav:
- admin i serviser rade u desktop modulu Fleet OS
- radnik koristi mobilni modul za prijavu kvara i unos goriva

## Što aplikacija radi

Glavne funkcionalnosti:
- Dashboard: pregled KPI-jeva, upozorenja i operativnog feeda
- Flota: pregled i upravljanje vozilima
- Zaduženja: praćenje aktivnih i povijesnih zaduženja
- Gorivo: evidencija točenja, cijena i kilometraže
- Prijava kvara: unos i praćenje statusa kvarova
- Servisni centar: timeline intervencija i prioritetne stavke
- Zaposlenici: upravljanje aktivacijom i invitation tok za postavu lozinke

## Tehnologije

- Next.js 16 (App Router, Server Components)
- React 19 + TypeScript (strict)
- Supabase (PostgreSQL + typed klijent)
- NextAuth (credentials prijava + JWT session)
- Tailwind CSS v4
- Zod (validacija ulaza)
- Argon2 i bcryptjs (lozinke/hash kompatibilnost)

## Arhitektura projekta

Ključne mape:
- src/app: rute (desktop Fleet OS, mobilni modul, auth i API)
- src/components: UI i feature komponente
- src/lib: auth, akcije, servisi, navigacija i pomoćni utili
- src/types: generirani i ručno definirani tipovi
- scripts: pomoćne skripte (npr. generiranje Supabase tipova)

Važni route segmenti:
- src/app/(os): desktop aplikacija za admin/serviser role
- src/app/m: mobilni modul za radnik rolu
- src/app/api/auth/[...nextauth]: auth endpoint

## Preduvjeti

Prije pokretanja osiguraj:
- Node.js 20+
- npm 10+
- pristup Supabase projektu s postojećom shemom

## Konfiguracija okoline

Kreiraj datoteku .env.local u rootu projekta:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-a-long-random-secret
```

Napomena:
- bez NEXT_PUBLIC_SUPABASE_URL i NEXT_PUBLIC_SUPABASE_ANON_KEY aplikacija ne može čitati podatke
- SUPABASE_SERVICE_ROLE_KEY je preporučen za server-side tokove i stabilniji rad kroz RLS
- NEXTAUTH_SECRET je obavezan za sigurnu JWT sesiju

## Pokretanje projekta

1. Instalacija ovisnosti

```bash
npm install
```

2. Pokretanje development servera

```bash
npm run dev
```

3. Otvori aplikaciju

```text
http://localhost:3000
```

Prijava:
- koristi postojeće zaposlenike iz baze (tablica zaposlenici)
- role mapping se radi prema tablici uloge

## Dostupne skripte

```bash
npm run dev        # lokalni razvoj
npm run build      # produkcijski build
npm run start      # start produkcijske verzije
npm run lint       # ESLint provjera
npm run typecheck  # TypeScript provjera bez emitiranja
npm run gen:types  # generiranje Supabase tipova u src/types/database.ts
```

## Kako koristiti aplikaciju

Tipičan tok za admin/serviser korisnika:
1. Prijava kroz stranicu /prijava
2. Pregled KPI-ja na /dashboard
3. Upravljanje vozilima i statusima u /flota
4. Praćenje servisa i kvarova kroz /servisni-centar i /prijava-kvara
5. Upravljanje korisnicima kroz /zaposlenici (aktivacija/deaktivacija, invite link)

Tipičan tok za radnik korisnika:
1. Prijava
2. Preusmjeravanje na mobilni modul /m
3. Brzi unos goriva i prijava kvara

## UX i loading ponašanje

- route-level loading skeletoni su implementirani za dashboard i ključne operativne rute
- servisni centar koristi sekcijski Suspense (header/timeline/prioriteti) za fluidnije učitavanje
- zaposlenici učitavaju form context na zahtjev pri otvaranju modala

## Najčešći problemi

Ako npm run dev ne podigne aplikaciju:
- provjeri da su .env.local varijable postavljene
- pokreni npm run typecheck i npm run lint
- potvrdi da Supabase projekt i shema odgovaraju tipovima u src/types/database.ts

Ako auth ne radi:
- provjeri NEXTAUTH_URL i NEXTAUTH_SECRET
- provjeri da postoji zaposlenik s valjanim korisničkim imenom i lozinkom

## Dodatno

Za ažuriranje DB tipova nakon promjene sheme koristi:

```bash
npm run gen:types
```

Nakon toga preporuka je pokrenuti:

```bash
npm run typecheck
```
