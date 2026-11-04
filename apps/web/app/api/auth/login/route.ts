import { NextResponse, type NextRequest } from "next/server";
import { STATE_COOKIE } from "@/lib/session";

export async function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    const url = new URL("/login", request.url);
    url.searchParams.set(
      "error",
      process.env.NODE_ENV === "production"
        ? "GITHUB_CLIENT_ID 가 설정되지 않았어요 (Vercel 환경변수 확인)"
        : "GITHUB_CLIENT_ID 가 없어요. 로컬에서는 루트 .env 에 DEV_BYPASS_AUTH=1 을 넣고 pnpm dev 를 다시 실행하면 로그인 없이 볼 수 있어요",
    );
    return NextResponse.redirect(url);
  }

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
