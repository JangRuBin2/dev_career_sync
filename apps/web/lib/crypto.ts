import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * 민감 값(Notion 토큰, DENYLIST, 알림 웹훅 URL) 암호화 — AES-256-GCM.
 * ENCRYPTION_KEY: 32자 이상 임의 문자열 (openssl rand -base64 32). SHA-256 으로 32바이트 키를 만든다.
 * 형식: v1.<iv>.<tag>.<ciphertext> (base64url)
 */
function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length < 32) throw new Error("ENCRYPTION_KEY 는 32자 이상이어야 합니다 (openssl rand -base64 32).");
  return createHash("sha256").update(raw).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decrypt(token: string): string {
  const [v, iv, tag, data] = token.split(".");
  if (v !== "v1" || !iv || !tag || data === undefined) throw new Error("암호문 형식이 올바르지 않습니다.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export const encryptOrNull = (v: string | null | undefined) => (v ? encrypt(v) : null);
export const decryptOrNull = (v: string | null | undefined) => (v ? decrypt(v) : null);
