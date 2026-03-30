import { ProfileDetailsCard } from "@/components/profile/profile-details-card";
import { Card } from "@/components/ui/card";
import { requireSessionUser, type SessionAppUser } from "@/lib/auth/session";
import {
  getEmployeeProfileDetails,
  type EmployeeProfileDetails,
} from "@/lib/employees/employee-service";

function buildFallbackProfile(sessionUser: SessionAppUser): EmployeeProfileDetails {
  const trimmedFullName = sessionUser.fullName.trim();
  const [firstName = "Nije", ...restNameParts] = trimmedFullName
    ? trimmedFullName.split(/\s+/)
    : ["Nije", "dostupno"];

  return {
    id: sessionUser.employeeId,
    firstName,
    lastName: restNameParts.join(" "),
    username: sessionUser.username,
    role: sessionUser.roleLabel,
    email: null,
    city: null,
    county: null,
    country: null,
  };
}

export default async function MobileProfilPage() {
  const sessionUser = await requireSessionUser({
    allowedRoles: ["radnik", "admin"],
    redirectTo: "/prijava",
    forbiddenRedirectTo: "/dashboard",
  });

  const profileFromDatabase = await getEmployeeProfileDetails(sessionUser.employeeId);
  const profile = profileFromDatabase ?? buildFallbackProfile(sessionUser);

  return (
    <div className="space-y-4">
      <Card>
        <h1 className="text-lg font-semibold text-foreground">Profil korisnika</h1>
        <p className="mt-2 text-sm text-muted">
          Pregled osnovnih podataka računa za trenutno prijavljenog korisnika.
        </p>
      </Card>

      {!profileFromDatabase ? (
        <Card>
          <p className="text-sm text-amber-200">
            Neki podaci profila trenutno nisu dostupni iz baze. Prikazuje se sigurni fallback iz aktivne sesije.
          </p>
        </Card>
      ) : null}

      <ProfileDetailsCard profile={profile} />
    </div>
  );
}
