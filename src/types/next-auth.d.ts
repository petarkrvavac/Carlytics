import type { DefaultSession } from "next-auth";
import type { AppRole } from "@/lib/auth/roles";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      employeeId: number;
      username: string;
      role: AppRole;
    } & DefaultSession["user"];
  }

  interface User {
    employeeId: number;
    username: string;
    role: AppRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    employeeId?: number;
    username?: string;
    role?: AppRole;
  }
}
