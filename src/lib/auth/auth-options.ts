import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";

import { authenticateEmployeeByCredentials } from "@/lib/auth/credentials";

const credentialsSchema = z.object({
  korisnickoIme: z.string().trim().min(1),
  lozinka: z.string().min(1),
});

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/prijava",
  },
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Carlytics",
      credentials: {
        korisnickoIme: { label: "Korisničko ime", type: "text" },
        lozinka: { label: "Lozinka", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);

        if (!parsed.success) {
          return null;
        }

        const employee = await authenticateEmployeeByCredentials(
          parsed.data.korisnickoIme,
          parsed.data.lozinka,
        );

        if (!employee) {
          return null;
        }

        return {
          id: String(employee.employeeId),
          name: employee.fullName,
          employeeId: employee.employeeId,
          username: employee.username,
          role: employee.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.employeeId = user.employeeId;
        token.username = user.username;
        token.role = user.role;
        token.name = user.name;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.employeeId = Number(token.employeeId ?? 0);
        session.user.username = String(token.username ?? "");
        session.user.role = token.role ?? "zaposlenik";
      }

      return session;
    },
  },
};
