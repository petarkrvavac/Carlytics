import { DatabaseZap } from "lucide-react";

import { Badge } from "@/components/ui/badge";

interface FallbackChipProps {
  isUsingFallbackData: boolean;
}

export function FallbackChip({ isUsingFallbackData }: FallbackChipProps) {
  if (!isUsingFallbackData) {
    return null;
  }

  return (
    <Badge variant="warning">
      <DatabaseZap size={12} className="mr-1" />
      Demo podaci
    </Badge>
  );
}
