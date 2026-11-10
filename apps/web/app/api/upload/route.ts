import { NextResponse, type NextRequest } from "next/server";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, putPrivateImage } from "@/lib/blob";
import { requireReady } from "@/lib/context";
import { TAGS, revalidateUser } from "@/lib/data";

/**
 * 캡처 업로드 (브라우저에서 블러·EXIF 제거·리사이즈를 마친 이미지)
 * multipart: file, caption?, projectId?, recordId?
 */
export async function POST(request: NextRequest) {
  const ctx = await requireReady();
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file 이 없습니다" }, { status: 400 });
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return NextResponse.json({ error: "이미지 형식만 업로드할 수 있어요" }, { status: 415 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "4MB 이하로 업로드해 주세요" }, { status: 413 });

  const projectId = (form.get("projectId") as string) || null;
  const recordId = (form.get("recordId") as string) || null;
  const caption = (form.get("caption") as string) || "";

  const pathname = await putPrivateImage(ctx.userId, file, projectId ?? "unsorted");
  const id = await ctx.repo.createImageAttachment({ name: caption || file.name, blobPath: pathname, caption, projectId, recordId });
  revalidateUser(ctx.userId, [TAGS.attachments]);
  return NextResponse.json({ id, pathname });
}
