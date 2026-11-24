import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, devBypass, verifySession, type Session } from "./session";

/** 로컬 개발(DEV_BYPASS_AUTH)용 가상 사용자 */
export const DEV_SESSION: Session = { userId: "00000000-0000-4000-8000-000000000000", githubId: "dev", login: "dev" };

export async function getSession(): Promise<Session | null> {
  if (devBypass()) return DEV_SESSION;
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  // 1인 전용: 허용 목록에서 빠진 계정의 기존 세션도 무효
  return session && isAdmin(session.githubId) ? session : null;
}

/** Server Action / Route 내부에서 한 번 더 확인 (proxy 우회 대비) */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error("로그인이 필요합니다.");
  return session;
}

export function isAdmin(githubId: string): boolean {
  return (process.env.ADMIN_GITHUB_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(githubId);
}
