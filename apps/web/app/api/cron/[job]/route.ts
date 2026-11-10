import { NextResponse, type NextRequest } from "next/server";
import { listReadyUserIds, type JobName } from "@/lib/db/store";
import { JOB_NAMES, runJobForUser } from "@/lib/jobs";

export const maxDuration = 300;
// 새 사용자를 시작하지 않는 시점 (남은 시간은 진행 중인 사용자 마무리용)
const BUDGET_MS = 200_000;

/**
 * Vercel Cron → 모든 사용자에게 배치 실행 (vercel.json).
 * Vercel 은 CRON_SECRET 이 있으면 Authorization: Bearer <CRON_SECRET> 을 붙여 호출한다.
 * 시간 안에 못 끝낸 사용자는 isDue 가 그대로라 다음 cron 에서 이어서 처리된다.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { job } = await params;
  if (!(JOB_NAMES as string[]).includes(job)) return NextResponse.json({ error: "unknown job" }, { status: 404 });

  const started = Date.now();
  const summary = { job, users: 0, ran: 0, ok: 0, skipped: 0, errors: 0, deferred: 0 };
  const users = await listReadyUserIds();
  summary.users = users.length;

  // Notion API 한도(통합당 평균 초당 3회)를 넘지 않도록 사용자를 순서대로 처리
  for (const userId of users) {
    if (Date.now() - started > BUDGET_MS) {
      summary.deferred++;
      continue;
    }
    try {
      const r = await runJobForUser(userId, job as JobName);
      if (!r.ran) continue;
      summary.ran++;
      if (r.status === "ok") summary.ok++;
      else summary.skipped++;
    } catch {
      summary.errors++;
    }
  }
  console.log(`[cron] ${JSON.stringify(summary)}`);
  return NextResponse.json(summary);
}
