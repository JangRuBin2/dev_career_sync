import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhookSignature } from "@careersync/core/notion";
import { ALL_TAGS } from "@/lib/data";

/**
 * Notion integration webhook.
 * 1) 구독 생성 시 Notion 이 { verification_token } 을 보낸다 → 로그에서 확인 후 NOTION_WEBHOOK_TOKEN 으로 등록
 * 2) 이후 이벤트는 X-Notion-Signature 를 검증하고 캐시를 무효화한다
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const body = JSON.parse(raw || "{}") as { verification_token?: string; type?: string };

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

  // 어떤 DB 의 변경인지 판별하려면 추가 조회가 필요하므로, 단순하게 전체 태그를 무효화한다 (1인용이라 비용이 작음)
  for (const tag of ALL_TAGS) revalidateTag(tag, { expire: 0 });
  return NextResponse.json({ ok: true, type: body.type });
}
