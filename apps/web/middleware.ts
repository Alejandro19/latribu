import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/therapist-login", "/reset-password", "/_next", "/api", "/icon", "/apple-icon"];
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
    // Se preserva también el query string (no solo el pathname) — sin esto,
    // un cliente que tapea el sticker NFC (/training?m=entrenamiento&a=confirmar)
    // con la sesión vencida perdía la acción pendiente al pasar por /login.
    loginUrl.searchParams.set("from", pathname + request.nextUrl.search);
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