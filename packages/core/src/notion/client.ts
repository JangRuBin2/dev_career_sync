import { Client } from "./sdk";
import { DB_ENV, type DbKey } from "./schema";

export type DataSourceIds = Record<DbKey, string>;

export function createNotion(token = process.env.NOTION_TOKEN): Client {
  if (!token) throw new Error("NOTION_TOKEN 이 설정되지 않았습니다.");
  // SDK 기본 버전은 2025-09-03 (data source 기반). 명시적으로 고정한다.
  return new Client({
    auth: token,
    notionVersion: "2025-09-03",
    // 로컬 개발용 mock 서버(pnpm mock:notion)를 가리킬 때만 설정
    ...(process.env.NOTION_BASE_URL ? { baseUrl: process.env.NOTION_BASE_URL } : {}),
  });
}

/** 환경변수에서 data source ID 를 읽는다 */
export function dataSourceIdsFromEnv(env: Record<string, string | undefined> = process.env): DataSourceIds {
  const out = {} as DataSourceIds;
  const missing: string[] = [];
  for (const [key, envName] of Object.entries(DB_ENV) as [DbKey, string][]) {
    const v = env[envName];
    if (!v) missing.push(envName);
    else out[key] = v;
  }
  if (missing.length) {
    throw new Error(`Notion data source 환경변수가 없습니다: ${missing.join(", ")} (pnpm setup:notion 결과를 확인하세요)`);
  }
  return out;
}
