import "server-only";
import { del, get, list, put } from "@vercel/blob";

/**
 * 두 개의 Blob store 를 쓴다.
 * - private: 원본 캡처 (인증된 /api/files 라우트로만 열람)
 * - public : 마스킹 확인 후 공개 승격된 이미지 (velog·포트폴리오용 영구 URL)
 */
const privateToken = () => process.env.BLOB_PRIVATE_READ_WRITE_TOKEN;
const publicToken = () => process.env.BLOB_PUBLIC_READ_WRITE_TOKEN;

export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel 함수 요청 본문 한도(4.5MB) 아래

function safeName(name: string) {
  return name.replace(/[^\w.-]+/g, "_").slice(-80) || "image";
}

/** 사용자별 비공개 경로: users/<userId>/... */
export const userPrefix = (userId: string) => `users/${userId}/`;

/** 이 사용자가 열람할 수 있는 비공개 캡처 경로인지 */
export function ownsCapture(userId: string, pathname: string): boolean {
  return pathname.startsWith(`${userPrefix(userId)}captures/`) && !pathname.includes("..");
}

export async function putPrivateImage(userId: string, file: File, folder: string) {
  const res = await put(`${userPrefix(userId)}captures/${safeName(folder)}/${Date.now()}-${safeName(file.name)}`, file, {
    access: "private",
    contentType: file.type,
    addRandomSuffix: true,
    token: privateToken(),
  });
  return res.pathname;
}

export async function getPrivateImage(pathname: string) {
  return get(pathname, { access: "private", token: privateToken() });
}

/** private → public 복사 (store 가 달라 copy() 대신 스트림 재업로드) */
export async function promoteToPublic(pathname: string): Promise<string> {
  const src = await getPrivateImage(pathname);
  if (!src || src.statusCode !== 200) throw new Error("원본 이미지를 찾을 수 없습니다.");
  // 공개 경로에는 사용자 ID 를 남기지 않는다 (addRandomSuffix 로 추측 불가)
  const res = await put(`public/${pathname.split("/").pop()}`, src.stream, {
    access: "public",
    contentType: src.blob.contentType,
    addRandomSuffix: true,
    token: publicToken(),
  });
  return res.url;
}

/** 계정 삭제: 이 사용자의 비공개 파일(캡처·이력서 스냅샷·맞춤본) 전부 삭제 */
export async function deleteUserBlobs(userId: string): Promise<number> {
  if (!privateToken()) return 0;
  let cursor: string | undefined;
  let count = 0;
  do {
    const page = await list({ prefix: userPrefix(userId), token: privateToken(), cursor, limit: 1000 });
    if (page.blobs.length) await del(page.blobs.map((b) => b.url), { token: privateToken() });
    count += page.blobs.length;
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return count;
}
