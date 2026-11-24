import { NextResponse, type NextRequest } from "next/server";
import { upsertGithubUser } from "@/lib/db/store";
import { SESSION_COOKIE, STATE_COOKIE, safeNext, sessionCookieOptions, signSession } from "@/lib/session";

/** GitHub 로그인 → 사용자 생성/갱신 → 세션 쿠키 (누구나 가입 가능) */
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
  const gh = (await userRes.json()) as { id?: number; login?: string; avatar_url?: string };
  if (!gh.id) return fail(request, "GitHub 사용자 정보를 읽지 못했어요");

  let user;
  try {
    user = await upsertGithubUser({ githubId: String(gh.id), login: gh.login ?? "", avatarUrl: gh.avatar_url ?? null });
  } catch (err) {
    console.error(err);
    return fail(request, "계정 저장 실패 (DATABASE_URL 확인)");
  }

  const res = NextResponse.redirect(new URL(safeNext(state.split("|")[1]), request.url));
  res.cookies.set(SESSION_COOKIE, await signSession({ userId: user.id, githubId: user.githubId, login: user.login }), sessionCookieOptions);
  res.cookies.delete(STATE_COOKIE);
  return res;
}

function fail(request: NextRequest, reason: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url);
}
