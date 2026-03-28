import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/mint", "/capsule", "/idol", "/history"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // Edge cannot read localStorage; middleware reads the auth token from a cookie.
  const token = req.cookies.get("idol-capsule-token")?.value;
  if (!token) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/mint/:path*", "/capsule/:path*", "/idol/:path*", "/history/:path*"],
};
