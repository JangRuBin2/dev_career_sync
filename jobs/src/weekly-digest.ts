/**
 * 주간 다이제스트 (로컬 실행용 — 배포 환경에서는 대시보드 cron 이 사용자별로 실행)
 * 미처리 Work Log → 마스킹 → LLM 정리 → Records/Metrics(초안) + Achievements(추천됨) + Posts(소재)
 */
import { weeklyDigestJob } from "@careersync/core/jobs";
import { envJobContext, report, run } from "./env";

run(async () => report(await weeklyDigestJob(envJobContext())));
