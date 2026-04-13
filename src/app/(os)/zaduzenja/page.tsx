import { ZaduzenjaLivePageContent } from "@/components/assignments/zaduzenja-live-page-content";
import { getOperationsOverviewData } from "@/lib/fleet/operations-service";

interface ZaduzenjaPageProps {
  searchParams?: Promise<{
    od?: string;
    do?: string;
    aktivna?: string;
    povijest?: string;
    prikaz?: string;
  }>;
}

export default async function ZaduzenjaPage({ searchParams }: ZaduzenjaPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const operationsData = await getOperationsOverviewData();

  return (
    <ZaduzenjaLivePageContent
      key={`${resolvedSearchParams?.prikaz ?? "aktivna"}-${resolvedSearchParams?.aktivna ?? "1"}-${resolvedSearchParams?.povijest ?? "1"}-${resolvedSearchParams?.od ?? ""}-${resolvedSearchParams?.do ?? ""}`}
      initialOperationsData={operationsData}
      initialSearchParams={resolvedSearchParams}
    />
  );
}
