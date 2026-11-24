import "server-only";
import type { UserContext } from "./context";
import { releaseAiUsage, reserveAiUsage, monthlyAiUsage, type AiKind } from "./db/store";

/**
 * AI 사용량 한도 (서버 키로 운영자가 비용 부담).
 *  AI_MONTHLY_LIMIT: 사용자당 월 호출 수 (기본 30). ADMIN_GITHUB_IDS 는 무제한.
 */
export function aiMonthlyLimit(ctx: Pick<UserContext, "admin">): number | null {
  if (ctx.admin) return null;
  const n = Number(process.env.AI_MONTHLY_LIMIT);
  return Number.isFinite(n) && n >= 0 && process.env.AI_MONTHLY_LIMIT?.trim() ? n : 30;
}

export async function aiUsageSummary(ctx: UserContext): Promise<{ used: number; limit: number | null }> {
  if (ctx.mode === "env") return { used: 0, limit: null };
  return { used: await monthlyAiUsage(ctx.userId), limit: aiMonthlyLimit(ctx) };
}

export class AiQuotaError extends Error {}

/** 한도 안에서 1회 예약 후 실행. 실패하면 예약을 되돌린다 */
export async function withAiQuota<T>(ctx: UserContext, kind: AiKind, fn: () => Promise<T>): Promise<T> {
  if (ctx.mode === "env") return fn();
  const limit = aiMonthlyLimit(ctx);
  const r = await reserveAiUsage(ctx.userId, kind, limit);
  if (!r.ok) throw new AiQuotaError(`이번 달 AI 사용 한도(${limit}회)를 모두 썼어요. 다음 달 1일에 초기화돼요.`);
  try {
    return await fn();
  } catch (err) {
    await releaseAiUsage(r.id!);
    throw err;
  }
}
