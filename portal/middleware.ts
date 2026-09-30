import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const TOKEN_KEY = "massicloud_token"

// Routes that don't require authentication
const publicRoutes = ["/login", "/register", "/forgot-password", "/reset"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(TOKEN_KEY)?.value

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    // If already logged in, redirect to dashboard — except /reset, which is
    // reached from an emailed link and must work even with a stale session.
    if (token && !pathname.startsWith("/reset")) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
    return NextResponse.next()
  }

  // Protect all other routes
  if (!token) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname + request.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - auth (calls meant for the backend API origin, misrouted here if
     *   NEXT_PUBLIC_API_URL isn't baked into the client bundle — let those
     *   fail as 404 instead of being silently redirected into a 405)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!api|auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
