export type VehicleStatus = "Slobodno" | "Zauzeto" | "Na servisu";

export type ServiceDueType = "none" | "mali" | "veliki" | "oba";

export type AlertSeverity = "kriticno" | "upozorenje" | "info";

export interface VehicleListItem {
  id: number;
  make: string;
  model: string;
  plate: string;
  km: number;
  fuelCapacity: number;
  fuelTypeLabel: string | null;
  smallServiceDueKm: number;
  largeServiceDueKm: number;
  serviceDueKm: number;
  serviceDueType: ServiceDueType;
  serviceDueLabel: string;
  serviceProgressIntervalKm: number;
  isServiceDue: boolean;
  status: VehicleStatus;
  registrationExpiryDays: number | null;
  registrationExpiryDateIso: string | null;
  openFaultCount: number;
  isActive: boolean;
  deactivationReason: string | null;
  vin: string | null;
  acquisitionValue: number | null;
  productionYear: number | null;
  registrationCity: string | null;
  locationCity: string | null;
  lastSmallServiceDate: string | null;
  lastSmallServiceKm: number | null;
  lastLargeServiceDate: string | null;
  lastLargeServiceKm: number | null;
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
