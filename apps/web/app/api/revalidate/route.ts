import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { ALL_TAGS } from "@/lib/data";

/** 배치(GitHub Actions) 가 Notion 을 갱신한 뒤 호출 */
export async function POST(request: NextRequest) {
  if (!process.env.REVALIDATE_SECRET || request.headers.get("x-revalidate-secret") !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { tags?: string[] };
  const tags = (body.tags ?? ALL_TAGS).filter((t) => (ALL_TAGS as string[]).includes(t));
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
  return NextResponse.json({ revalidated: tags });
}
