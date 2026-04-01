import Image from "next/image";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getOptionalSessionUser } from "@/lib/auth/session";

export default async function LoginPage() {
  const sessionUser = await getOptionalSessionUser();

  if (sessionUser) {
    redirect(sessionUser.role === "zaposlenik" ? "/m" : "/dashboard");
  }

  return (
    <div className="ambient-bg min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-8">
        <div className="w-full space-y-5">
          <div className="rounded-2xl border border-cyan-500/25 bg-surface/75 p-5 text-center shadow-[0_14px_34px_rgba(2,8,23,0.38)] backdrop-blur-sm">
            <div className="mx-auto inline-flex h-24 w-24 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/12 p-3 shadow-[0_16px_32px_rgba(6,182,212,0.2)]">
              <Image
                src="/carlytics-logo.png"
                alt="Carlytics"
                width={88}
                height={88}
                className="h-full w-full rounded-xl object-contain"
                priority
              />
            </div>

            <p className="mt-4 text-xs uppercase tracking-[0.26em] text-cyan-300">Carlytics Fleet OS</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">Prijava u sustav</h1>
            <p className="text-sm text-muted">
              Role-aware pristup za administraciju, voditelja flote i terenski unos zaposlenika.
            </p>
          </div>

          <LoginForm />
        </div>
      </div>
    </div>
  );
}
