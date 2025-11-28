import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useEnvironmentalImpact() {
  const impact = useQuery(api.environmentalImpact.getImpactValues, { label: "default" });
  return {
    energyPerTokenWh: impact?.energyPerTokenWh ?? 0,
    co2PerWh: impact?.co2PerWh ?? 0,
    ready: Boolean(impact),
  };
}
