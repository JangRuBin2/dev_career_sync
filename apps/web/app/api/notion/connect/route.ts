import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { notionAuthorizeUrl } from "@/lib/notion-oauth";
import { NOTION_STATE_COOKIE } from "@/lib/session";

/** "Notion 연결" → Notion 동의 화면 (사용자가 CareerSync 에 공유할 페이지를 고른다) */
export async function GET(request: NextRequest) {
  await requireSession();
  const state = crypto.randomUUID();
  let url: string;
  try {
    url = notionAuthorizeUrl(new URL("/api/notion/callback", request.url).toString(), state);
  } catch (err) {
    const back = new URL("/onboarding", request.url);
    back.searchParams.set("error", err instanceof Error ? err.message : String(err));
    return NextResponse.redirect(back);
  }
  const res = NextResponse.redirect(url);
  res.cookies.set(NOTION_STATE_COOKIE, state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
