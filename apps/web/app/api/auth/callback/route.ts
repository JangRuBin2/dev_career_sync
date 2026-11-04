import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, STATE_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const saved = request.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || state !== saved) return fail(request, "state 불일치");

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: new URL("/api/auth/callback", request.url).toString(),
    }),
  });
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) return fail(request, "토큰 교환 실패");

  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "careersync" },
  });
  const user = (await userRes.json()) as { id?: number; login?: string };
  if (!user.id || String(user.id) !== process.env.ALLOWED_GITHUB_ID) return fail(request, "허용되지 않은 계정");

  const next = state.split("|")[1] ?? "/dashboard";
  const res = NextResponse.redirect(new URL(next, request.url));
  res.cookies.set(SESSION_COOKIE, await signSession({ githubId: String(user.id), login: user.login ?? "" }), sessionCookieOptions);
  res.cookies.delete(STATE_COOKIE);
  return res;
}

function fail(request: NextRequest, reason: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url);
}
