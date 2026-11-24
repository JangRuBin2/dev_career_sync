import { createAnthropic, explainAuthError } from "@careersync/core/llm";
import { CareerRepo, createNotion, dataSourceIdsFromEnv } from "@careersync/core/notion";
import { notify, parseDenylist } from "@careersync/core";
import type { JobContext, JobResult } from "@careersync/core/jobs";

export function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`환경변수 ${name} 가 필요합니다.`);
  return v;
}

export function makeRepo() {
  return new CareerRepo(createNotion(), dataSourceIdsFromEnv());
}

/** API 키 · WIF · `ant auth login` 프로필 중 설정된 것을 SDK 가 자동 선택 (llm/auth.ts 참고) */
export function makeAnthropic() {
  return createAnthropic();
}

export const denylist = () => parseDenylist(process.env.DENYLIST);

export const isDryRun = () => process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";

/**
 * 대시보드 캐시 갱신 요청 (실패해도 job 은 계속).
 * 대시보드가 여러 사용자용이라 어느 사용자의 캐시인지 CAREERSYNC_USER_ID 로 알려 줘야 한다 (없으면 생략 — 5분 뒤 자동 갱신).
 */
export async function revalidateWeb(tags: string[]) {
  const url = process.env.WEB_URL;
  const secret = process.env.REVALIDATE_SECRET;
  const userId = process.env.CAREERSYNC_USER_ID;
  if (!url || !secret || !userId) return;
  try {
    const res = await fetch(new URL("/api/revalidate", url), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-revalidate-secret": secret },
      body: JSON.stringify({ tags, userId }),
    });
    if (!res.ok) console.warn(`revalidate 실패: ${res.status}`);
  } catch (err) {
    console.warn("revalidate 요청 오류", err);
  }
}

export function run(main: () => Promise<void>) {
  main().catch((err) => {
    const hint = explainAuthError(err);
    if (hint) console.error(`\n❌ ${hint}\n`);
    console.error(err);
    process.exit(1);
  });
}

/** .env 의 Notion·설정으로 배치 컨텍스트 구성 (로컬 실행용) */
export function envJobContext(): JobContext {
  return {
    repo: makeRepo(),
    anthropic: makeAnthropic,
    rules: denylist(),
    notify: (text) => notify(text),
    revalidate: (tags) => revalidateWeb(tags),
    dryRun: isDryRun(),
  };
}

export function report(r: JobResult) {
  console.log(`${r.status === "ok" ? "✔" : "–"} ${r.message}`);
}
