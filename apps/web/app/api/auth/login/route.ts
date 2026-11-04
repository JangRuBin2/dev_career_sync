import { NextResponse, type NextRequest } from "next/server";
import { STATE_COOKIE } from "@/lib/session";

export async function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "GITHUB_CLIENT_ID 미설정" }, { status: 500 });

  const next = request.nextUrl.searchParams.get("next") ?? "/dashboard";
  const state = `${crypto.randomUUID()}|${next.startsWith("/") ? next : "/dashboard"}`;
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", new URL("/api/auth/callback", request.url).toString());
  authorize.searchParams.set("scope", "read:user");
  authorize.searchParams.set("state", state);

  const res = NextResponse.redirect(authorize);
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
