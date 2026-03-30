import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const desktopProtectedPrefixes = [
  "/dashboard",
  "/flota",
  "/zaduzenja",
  "/zaposlenici",
  "/servisni-centar",
  "/prijava-kvara",
  "/gorivo",
  "/postavke",
];

function isDesktopProtectedPath(pathname: string) {
  return desktopProtectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isDesktopProtectedPath(pathname) && pathname !== "/m" && !pathname.startsWith("/m/")) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const signInUrl = new URL("/prijava", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  const role = token.role;

  if (typeof role !== "string") {
    return NextResponse.redirect(new URL("/prijava", request.url));
  }

  if (pathname === "/m" || pathname.startsWith("/m/")) {
    if (role !== "radnik" && role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  }

  if (role === "admin" || role === "serviser") {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/m", request.url));
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/flota/:path*",
    "/zaduzenja/:path*",
    "/zaposlenici/:path*",
    "/servisni-centar/:path*",
    "/prijava-kvara/:path*",
    "/gorivo/:path*",
    "/postavke/:path*",
    "/m",
    "/m/:path*",
  ],
};