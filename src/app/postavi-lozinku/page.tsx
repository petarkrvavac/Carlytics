import Link from "next/link";

import { SetPasswordForm } from "@/components/auth/set-password-form";
import { Card } from "@/components/ui/card";
import { getInviteTokenStatus } from "@/lib/employees/invitation-service";

interface SetPasswordPageProps {
  searchParams?: Promise<{ token?: string | string[] }>;
}

function getTokenFromSearchParams(
  params: { token?: string | string[] } | undefined,
) {
  if (!params?.token) {
    return "";
  }

  if (Array.isArray(params.token)) {
    return params.token[0] ?? "";
  }

  return params.token;
}

function formatExpiry(isoDate: string | null) {
  if (!isoDate) {
    return null;
  }

  const parsed = new Date(isoDate);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export default async function PostaviLozinkuPage({
  searchParams,
}: SetPasswordPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const token = getTokenFromSearchParams(resolvedSearchParams).trim();

  const tokenStatus = token
    ? await getInviteTokenStatus(token)
    : {
        isValid: false,
        message: "Nedostaje token pozivnice.",
        expiresAtIso: null,
      };

  const formattedExpiry = formatExpiry(tokenStatus.expiresAtIso);

  return (
    <div className="ambient-bg min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-8">
        <div className="w-full space-y-5">
          <div className="space-y-2 text-center">
            <p className="text-xs uppercase tracking-[0.26em] text-cyan-300">Carlytics</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-100">Postava računa</h1>
            <p className="text-sm text-muted">
              Unesi korisničko ime i lozinku za dovršetak registracije.
            </p>
          </div>

          {!tokenStatus.isValid ? (
            <Card className="space-y-3 p-5">
              <p className="text-sm text-rose-300">{tokenStatus.message}</p>
              <Link
                href="/prijava"
                className="inline-flex h-10 items-center rounded-xl border border-cyan-500/35 bg-cyan-500/16 px-4 text-sm font-medium text-cyan-200 transition hover:border-cyan-400/70 hover:bg-cyan-500/22"
              >
                Povratak na prijavu
              </Link>
            </Card>
          ) : (
            <>
              {formattedExpiry ? (
                <Card className="p-3 text-sm text-slate-300">
                  Pozivnica vrijedi do: <span className="font-semibold text-slate-100">{formattedExpiry}</span>
                </Card>
              ) : null}
              <SetPasswordForm token={token} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
