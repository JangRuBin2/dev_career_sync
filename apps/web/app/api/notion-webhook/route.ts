import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhookSignature } from "@careersync/core/notion";
import { revalidateUser } from "@/lib/data";
import { hasDatabase } from "@/lib/db/client";
import { usersByWorkspace } from "@/lib/db/store";

/**
 * Notion 공개 통합 webhook (통합 하나에 구독 하나 — 모든 사용자 워크스페이스 이벤트가 여기로 온다).
 * 1) 구독 생성 시 Notion 이 { verification_token } 을 보낸다 → 로그에서 확인 후 NOTION_WEBHOOK_TOKEN 으로 등록
 * 2) 이후 이벤트는 X-Notion-Signature 를 검증하고, 이벤트의 workspace_id 에 연결된 사용자들의 캐시만 무효화한다
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const body = JSON.parse(raw || "{}") as { verification_token?: string; type?: string; workspace_id?: string };

  const token = process.env.NOTION_WEBHOOK_TOKEN;
  if (!token) {
    if (body.verification_token) {
      console.log(`[notion-webhook] verification_token 수신 — Notion 화면에서 검증 후 환경변수 NOTION_WEBHOOK_TOKEN 에 등록하세요.`);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "NOTION_WEBHOOK_TOKEN 미설정" }, { status: 503 });
  }

  const ok = await verifyWebhookSignature({ body: raw, signature: request.headers.get("x-notion-signature"), verificationToken: token });
  if (!ok) return NextResponse.json({ error: "invalid signature" }, { status: 401 });

  if (!body.workspace_id || !hasDatabase()) return NextResponse.json({ ok: true, type: body.type, users: 0 });
  // 어떤 DB 의 변경인지는 추가 조회가 필요하므로, 해당 사용자들의 태그를 모두 무효화한다
  const users = await usersByWorkspace(body.workspace_id);
  for (const userId of users) revalidateUser(userId);
  return NextResponse.json({ ok: true, type: body.type, users: users.length });
}
