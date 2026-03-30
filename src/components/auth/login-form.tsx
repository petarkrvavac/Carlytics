"use client";

import { LogIn } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const korisnickoIme = String(formData.get("korisnickoIme") ?? "");
    const lozinka = String(formData.get("lozinka") ?? "");

    startTransition(async () => {
      setErrorMessage(null);

      const result = await signIn("credentials", {
        redirect: false,
        callbackUrl,
        korisnickoIme,
        lozinka,
      });

      if (!result || result.error) {
        setErrorMessage("Neispravno korisničko ime ili lozinka.");
        return;
      }

      router.replace(result.url ?? callbackUrl);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-border bg-surface/95 p-6"
    >
      <div>
        <label
          htmlFor="korisnickoIme"
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
        >
          Korisničko ime
        </label>
        <input
          id="korisnickoIme"
          name="korisnickoIme"
          required
          autoComplete="username"
          className="mt-2 w-full rounded-xl border border-border bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          placeholder="npr. petar.k"
        />
      </div>

      <div>
        <label
          htmlFor="lozinka"
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
        >
          Lozinka
        </label>
        <input
          id="lozinka"
          name="lozinka"
          type="password"
          required
          autoComplete="current-password"
          className="mt-2 w-full rounded-xl border border-border bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          placeholder="••••••••"
        />
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/12 px-3 py-2 text-sm text-rose-200">
          {errorMessage}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/16 text-sm font-medium text-cyan-200 transition hover:border-cyan-400/70 hover:bg-cyan-500/22 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <LogIn size={16} />
        {isPending ? "Provjera..." : "Prijavi se"}
      </button>
    </form>
  );
}
