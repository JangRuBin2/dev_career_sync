import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "cs_session";
export const STATE_COOKIE = "cs_oauth_state";
const MAX_AGE_SEC = 60 * 60 * 24 * 7;

export interface Session {
  githubId: string;
  login: string;
}

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET 은 32자 이상이어야 합니다.");
  return new TextEncoder().encode(secret);
}

export async function signSession(session: Session): Promise<string> {
  return new SignJWT({ login: session.login })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.githubId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub || payload.sub !== process.env.ALLOWED_GITHUB_ID) return null;
    return { githubId: payload.sub, login: String(payload.login ?? "") };
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

/** 로컬 개발에서만 인증 우회 (DEV_BYPASS_AUTH=1) */
export const devBypass = () => process.env.NODE_ENV !== "production" && process.env.DEV_BYPASS_AUTH === "1";
