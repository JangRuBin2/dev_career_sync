import { NextResponse, type NextRequest } from "next/server";
import { getPrivateImage, ownsCapture } from "@/lib/blob";
import { getUserContext } from "@/lib/context";

/** 비공개 캡처 열람 — 본인 경로(users/<id>/captures/)만. 관리자는 1인용 시절 경로(captures/)도 열람 가능 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const pathname = path.map(decodeURIComponent).join("/");
  const user = await getUserContext();
  const legacy = user.admin && pathname.startsWith("captures/") && !pathname.includes("..");
  if (!ownsCapture(user.userId, pathname) && !legacy) return NextResponse.json({ error: "not found" }, { status: 404 });

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
