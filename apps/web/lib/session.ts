import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "cs_session";
export const STATE_COOKIE = "cs_oauth_state";
export const NOTION_STATE_COOKIE = "cs_notion_state";
const MAX_AGE_SEC = 60 * 60 * 24 * 7;

export interface Session {
  /** CareerSync 사용자 ID (users.id, uuid) */
  userId: string;
  githubId: string;
  login: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET 은 32자 이상이어야 합니다.");
  return new TextEncoder().encode(secret);
}

export async function signSession(session: Session): Promise<string> {
  return new SignJWT({ login: session.login, gh: session.githubId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secretKey());
}

/** 서명·만료 확인. (1인용 시절의 GitHub ID 세션은 sub 가 uuid 가 아니라서 거부 → 다시 로그인) */
export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub || !UUID_RE.test(payload.sub)) return null;
    return { userId: payload.sub, githubId: String(payload.gh ?? ""), login: String(payload.login ?? "") };
  } catch {
    return null;
  }
}
export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_SEC,
};

/** "1", "true", "1 # 메모" 처럼 적어도 켜진 것으로 본다 */
export function isTruthyEnv(v: string | undefined): boolean {
  const first = (v ?? "").trim().replace(/^["']|["']$/g, "").split(/\s/)[0]?.toLowerCase() ?? "";
  return ["1", "true", "yes", "on"].includes(first);
}

/** 로컬 개발에서만 인증 우회 (DEV_BYPASS_AUTH=1). 프로덕션(Vercel)에서는 항상 꺼짐 */
export const devBypass = () => process.env.NODE_ENV !== "production" && isTruthyEnv(process.env.DEV_BYPASS_AUTH);

/** 로그인 후 이동 경로: 같은 사이트의 상대 경로만 허용 (//evil.com 같은 open redirect 차단) */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}
