/**
 * velog RSS 동기화 (로컬 실행용 — 배포 환경에서는 대시보드 cron 이 사용자별로 실행)
 */
import { syncRssJob } from "@careersync/core/jobs";
import { envJobContext, report, required, run } from "./env";

run(async () => report(await syncRssJob(envJobContext(), { velogUsername: required("VELOG_USERNAME") })));
