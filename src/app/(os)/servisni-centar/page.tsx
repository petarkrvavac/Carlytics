import { redirect } from "next/navigation";

interface LegacyServisniCentarPageProps {
  searchParams?: Promise<{ vozilo?: string; stranica?: string }>;
}

export default async function LegacyServisniCentarPage({
  searchParams,
}: LegacyServisniCentarPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const query = new URLSearchParams();

  if (resolvedSearchParams?.vozilo) {
    query.set("vozilo", resolvedSearchParams.vozilo);
  }

  if (resolvedSearchParams?.stranica) {
    query.set("stranica", resolvedSearchParams.stranica);
  }

  const queryString = query.toString();

  redirect(queryString ? `/povijest-servisa?${queryString}` : "/povijest-servisa");
}
