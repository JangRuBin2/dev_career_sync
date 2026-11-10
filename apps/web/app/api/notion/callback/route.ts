import { NextResponse, type NextRequest } from "next/server";
import { getUserContext } from "@/lib/context";
import { saveNotionAuth } from "@/lib/db/store";
import { exchangeNotionCode } from "@/lib/notion-oauth";
import { NOTION_STATE_COOKIE } from "@/lib/session";

/** Notion OAuth 완료 → 토큰 암호화 저장 → 온보딩(페이지 선택)으로 */
export async function GET(request: NextRequest) {
  const back = (error?: string) => {
    const url = new URL("/onboarding", request.url);
    if (error) url.searchParams.set("error", error);
    const res = NextResponse.redirect(url);
    res.cookies.delete(NOTION_STATE_COOKIE);
    return res;
  };

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return back(params.get("error") === "access_denied" ? "Notion 연결을 취소했어요" : `Notion 오류: ${params.get("error")}`);
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state || state !== request.cookies.get(NOTION_STATE_COOKIE)?.value) return back("state 불일치 — 다시 시도해 주세요");

  const ctx = await getUserContext();
  if (ctx.mode !== "db") return back("로컬 env 모드에서는 Notion OAuth 를 쓰지 않아요");
  try {
    const t = await exchangeNotionCode(code, new URL("/api/notion/callback", request.url).toString());
    await saveNotionAuth(ctx.userId, {
      accessToken: t.access_token,
      refreshToken: t.refresh_token ?? null,
      botId: t.bot_id,
      workspaceId: t.workspace_id,
      workspaceName: t.workspace_name,
      workspaceIcon: t.workspace_icon,
    });
  } catch (err) {
    console.error(err);
    return back("Notion 토큰 교환에 실패했어요. 다시 시도해 주세요.");
  }
  return back();
}
