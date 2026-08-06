import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/_next", "/api"];
const STATIC_EXTS = /\.(svg|png|jpg|jpeg|gif|ico|css|js|woff2?)$/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and static assets
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    STATIC_EXTS.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Check for token in cookie or Authorization header
  const token =
    request.cookies.get("latribu_token")?.value ||
    request.headers.get("Authorization")?.replace("Bearer ", "");

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */ 
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};