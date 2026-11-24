/**
 * 블로그 주기 포스팅: 소재 → 초안 (로컬 실행용 — 배포 환경에서는 대시보드 cron 이 사용자별로 실행)
 *   POST_INTERVAL_DAYS (기본 14) · POST_LEAD_DAYS (기본 3) · POST_DEFAULT_MODE (기본 임시저장) · POST_PUBLISH_HOUR_KST (기본 9)
 */
import { draftPostsJob } from "@careersync/core/jobs";
import type { PostMode } from "@careersync/core/notion";
import { envJobContext, report, run } from "./env";

const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d);

run(async () =>
  report(
    await draftPostsJob(envJobContext(), {
      intervalDays: num(process.env.POST_INTERVAL_DAYS, 14),
      leadDays: num(process.env.POST_LEAD_DAYS, 3),
      hourKst: num(process.env.POST_PUBLISH_HOUR_KST, 9),
      mode: (process.env.POST_DEFAULT_MODE ?? "임시저장") as PostMode,
    }),
  ),
);
