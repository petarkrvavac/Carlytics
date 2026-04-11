import {
  CarFront,
  Fuel,
  LayoutDashboard,
  TriangleAlert,
  Users,
  UserCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type NavigationSection = "glavno" | "operativa";

export interface AppNavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
  section: NavigationSection;
}

export const APP_NAVIGATION_ITEMS: AppNavigationItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    section: "glavno",
  },
  {
    href: "/flota",
    label: "Flota",
    icon: CarFront,
    section: "glavno",
  },
  {
    href: "/zaduzenja",
    label: "Zaduženja",
    icon: UserCheck,
    section: "glavno",
  },
  {
    href: "/zaposlenici",
    label: "Zaposlenici",
    icon: Users,
    section: "glavno",
  },
  {
    href: "/povijest-servisa",
    label: "Povijest servisa",
    icon: Wrench,
    section: "glavno",
  },
  {
    href: "/prijava-kvara",
    label: "Prijava kvara",
    icon: TriangleAlert,
    section: "operativa",
  },
  {
    href: "/gorivo",
    label: "Gorivo",
    icon: Fuel,
    section: "operativa",
  },
];
