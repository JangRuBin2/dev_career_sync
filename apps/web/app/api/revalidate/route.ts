import { NextResponse, type NextRequest } from "next/server";
import { ALL_TAGS, revalidateUser, type Tag } from "@/lib/data";

/** 로컬 배치(CLI)가 Notion 을 갱신한 뒤 특정 사용자 캐시를 무효화할 때 호출 (cron 은 직접 무효화) */
export async function POST(request: NextRequest) {
  if (!process.env.REVALIDATE_SECRET || request.headers.get("x-revalidate-secret") !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { tags?: string[]; userId?: string };
  if (!body.userId) return NextResponse.json({ error: "userId 가 필요합니다" }, { status: 400 });
  const tags = (body.tags ?? ALL_TAGS).filter((t): t is Tag => (ALL_TAGS as string[]).includes(t));
  revalidateUser(body.userId, tags);
  return NextResponse.json({ revalidated: tags });
}
