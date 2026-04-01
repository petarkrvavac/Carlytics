import { PageHeader } from "@/components/ui/page-header";
import { ProfileDetailsCard } from "@/components/profile/profile-details-card";
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

export default async function ProfilPage() {
  const sessionUser = await requireSessionUser({
    allowedRoles: ["admin", "voditelj_flote"],
    redirectTo: "/prijava",
    forbiddenRedirectTo: "/m",
  });

  const profileFromDatabase = await getEmployeeProfileDetails(sessionUser.employeeId);
  const profile = profileFromDatabase ?? buildFallbackProfile(sessionUser);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Profil"
        description="Pregled korisničkih podataka računa i osnovne lokacijske pripadnosti zaposlenika."
      />

      {!profileFromDatabase ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Neki podaci profila trenutno nisu dostupni iz baze. Prikazuje se sigurni fallback iz aktivne sesije.
        </p>
      ) : null}

      <ProfileDetailsCard profile={profile} />
    </div>
  );
}
