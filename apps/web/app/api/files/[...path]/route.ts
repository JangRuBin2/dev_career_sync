import { NextResponse, type NextRequest } from "next/server";
import { getPrivateImage } from "@/lib/blob";

/** 비공개 캡처 열람 (proxy.ts 가 로그인 여부를 확인한 뒤에만 도달) */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const pathname = path.map(decodeURIComponent).join("/");
  if (!pathname.startsWith("captures/")) return NextResponse.json({ error: "not found" }, { status: 404 });

  const result = await getPrivateImage(pathname);
  if (!result || result.statusCode !== 200) return NextResponse.json({ error: "not found" }, { status: 404 });

  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType,
      // 브라우저에만 짧게 캐시, 공유 캐시(CDN)에는 저장 금지
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
