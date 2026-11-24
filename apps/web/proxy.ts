import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, devBypass, verifySession } from "@/lib/session";

/**
 * /dashboard 와 내부 API 를 본인 계정으로만 접근 가능하게 막는다.
 * - /api/auth/*, /api/revalidate(시크릿 검증), /api/notion-webhook(서명 검증), /api/cron(CRON_SECRET)은 제외
 */
export async function proxy(request: NextRequest) {
  if (devBypass()) return NextResponse.next();
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*", "/onboarding", "/api/((?!auth|revalidate|notion-webhook|cron).*)"],
};
