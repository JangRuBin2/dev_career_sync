import "server-only";
import { get, put } from "@vercel/blob";

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

export async function putPrivateImage(file: File, folder: string) {
  const res = await put(`captures/${folder}/${Date.now()}-${safeName(file.name)}`, file, {
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
  const res = await put(pathname.replace(/^captures\//, "public/"), src.stream, {
    access: "public",
    contentType: src.blob.contentType,
    addRandomSuffix: true,
    token: publicToken(),
  });
  return res.url;
}
