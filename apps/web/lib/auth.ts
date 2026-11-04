import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, devBypass, verifySession } from "./session";

/** Server Action 내부에서 한 번 더 확인 (proxy 우회 대비) */
export async function requireSession() {
  if (devBypass()) return { githubId: "dev", login: "dev" };
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) throw new Error("로그인이 필요합니다.");
  return session;
}
