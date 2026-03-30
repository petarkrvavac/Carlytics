export type VehicleStatus = "Slobodno" | "Zauzeto" | "Na servisu";

export type AlertSeverity = "kriticno" | "upozorenje" | "info";

export interface VehicleListItem {
  id: number;
  make: string;
  model: string;
  plate: string;
  km: number;
  fuelCapacity: number;
  serviceDueKm: number;
  status: VehicleStatus;
  registrationExpiryDays: number | null;
  openFaultCount: number;
}

export interface FleetHealthSummary {
  total: number;
  operational: number;
  occupied: number;
  inService: number;
  percentage: number;
}

export interface CostSeriesPoint {
  monthKey: string;
  monthLabel: string;
  fuelCost: number;
  serviceCost: number;
}

export interface CriticalAlert {
  id: string;
  type: "registracija" | "servis" | "kvar";
  title: string;
  description: string;
  severity: AlertSeverity;
  createdAtIso: string;
}

export interface DashboardData {
  fleetHealth: FleetHealthSummary;
  costSeries: CostSeriesPoint[];
  criticalAlerts: CriticalAlert[];
  criticalAlertCount: number;
  vehicles: VehicleListItem[];
  activeFaultCount: number;
  lastUpdatedIso: string;
  isUsingFallbackData: boolean;
}

export interface AppShellMetrics {
  activeFaultCount: number;
  hasCriticalAlerts: boolean;
}
