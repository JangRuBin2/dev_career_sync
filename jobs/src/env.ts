import Anthropic from "@anthropic-ai/sdk";
import { CareerRepo, createNotion, dataSourceIdsFromEnv } from "@careersync/core/notion";
import { parseDenylist } from "@careersync/core";

export function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`환경변수 ${name} 가 필요합니다.`);
  return v;
}

export function makeRepo() {
  return new CareerRepo(createNotion(), dataSourceIdsFromEnv());
}

export function makeAnthropic() {
  // ANTHROPIC_API_KEY 등 환경의 자격 증명을 그대로 사용
  return new Anthropic();
}

export const denylist = () => parseDenylist(process.env.DENYLIST);

export const isDryRun = () => process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";

/** 대시보드 캐시 갱신 요청 (실패해도 job 은 계속) */
export async function revalidateWeb(tags: string[]) {
  const url = process.env.WEB_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!url || !secret) return;
  try {
    const res = await fetch(new URL("/api/revalidate", url), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-revalidate-secret": secret },
      body: JSON.stringify({ tags }),
    });
    if (!res.ok) console.warn(`revalidate 실패: ${res.status}`);
  } catch (err) {
    console.warn("revalidate 요청 오류", err);
  }
}

export function run(main: () => Promise<void>) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
