import "server-only";
import { notify, parseDenylist } from "@careersync/core";
import { draftPostsJob, syncRssJob, weeklyDigestJob, type JobContext, type JobResult } from "@careersync/core/jobs";
import { createAnthropic } from "@careersync/core/llm";
import { CareerRepo } from "@careersync/core/notion";
import { AiQuotaError, aiMonthlyLimit } from "./ai";
import { isAdmin } from "./auth";
import { revalidateUser, type Tag } from "./data";
import {
  getNotionConnection,
  getSettings,
  getUser,
  lastSuccessfulRun,
  recordJobRun,
  releaseAiUsage,
  reserveAiUsage,
  type JobName,
  type UserSettings,
} from "./db/store";
import { notionForUser } from "./notion-oauth";

export const JOB_NAMES: JobName[] = ["weekly-digest", "draft-posts", "sync-rss"];
export const JOB_LABEL: Record<JobName, string> = { "weekly-digest": "주간 정리", "draft-posts": "블로그 초안", "sync-rss": "velog 동기화" };

const HOUR = 3600_000;
const isFridayKst = (d: Date) => new Date(d.getTime() + 9 * HOUR).getUTCDay() === 5;

/** cron 이 이 사용자에게 지금 작업을 돌려야 하는지 */
export function isDue(job: JobName, settings: UserSettings, lastOk: Date | null, now = new Date()): boolean {
  if (job === "weekly-digest") {
    if (!settings.autoDigest) return false;
    // 처음엔 금요일에, 이후로는 직전 실행 후 6.5일이 지나면 (cron 은 매일 18:00 KST)
    return lastOk ? now.getTime() - lastOk.getTime() >= 6.5 * 24 * HOUR : isFridayKst(now);
  }
  if (job === "sync-rss" && !settings.velogUsername) return false;
  return !lastOk || now.getTime() - lastOk.getTime() >= 20 * HOUR;
}

/**
 * 사용자 한 명에게 작업 실행 + 기록.
 * force=false 면 isDue 를 확인한다 (cron), true 면 바로 실행 (설정 화면의 "지금 실행").
 */
export async function runJobForUser(userId: string, job: JobName, opts: { force?: boolean } = {}): Promise<JobResult & { ran: boolean }> {
  const startedAt = new Date();
  const [user, conn, settings] = await Promise.all([getUser(userId), getNotionConnection(userId), getSettings(userId)]);
  if (!user || !conn?.dataSources) return { ran: false, status: "skipped", message: "Notion 연결 전" };
  if (!opts.force && !isDue(job, settings, await lastSuccessfulRun(userId, job), startedAt)) {
    return { ran: false, status: "skipped", message: "아직 실행할 때가 아님" };
  }

  const limit = aiMonthlyLimit({ admin: isAdmin(user.githubId) });
  const ctx: JobContext = {
    repo: new CareerRepo(notionForUser(userId, conn), conn.dataSources),
    anthropic: createAnthropic,
    rules: parseDenylist(settings.denylist),
    notify: (text) => notify(text, settings.notifyWebhookUrl || undefined),
    revalidate: (tags) => revalidateUser(userId, tags as Tag[]),
    withAi: async (kind, fn) => {
      const r = await reserveAiUsage(userId, kind, limit);
      if (!r.ok) throw new AiQuotaError(`이번 달 AI 사용 한도(${limit}회)를 모두 써서 건너뛰었어요`);
      try {
        return await fn();
      } catch (err) {
        await releaseAiUsage(r.id!);
        throw err;
      }
    },
    log: () => {},
  };

  try {
    const result =
      job === "weekly-digest"
        ? await weeklyDigestJob(ctx)
        : job === "draft-posts"
          ? await draftPostsJob(ctx, { intervalDays: settings.postIntervalDays, leadDays: settings.postLeadDays })
          : await syncRssJob(ctx, { velogUsername: settings.velogUsername });
    await recordJobRun(userId, job, result.status, result.message, startedAt);
    return { ran: true, ...result };
  } catch (err) {
    // 한도 초과는 실패가 아니라 이번 주기 건너뛰기
    if (err instanceof AiQuotaError) {
      await recordJobRun(userId, job, "skipped", err.message, startedAt);
      await ctx.notify(`⏸ ${JOB_LABEL[job]}: ${err.message}`);
      return { ran: true, status: "skipped", message: err.message };
    }
    console.error(`[job] ${job} user=${userId}`, err);
    await recordJobRun(userId, job, "error", err instanceof Error ? err.message : String(err), startedAt);
    throw err;
  }
}
