/**
 * Notion 워크스페이스 초기 셋업.
 *   NOTION_TOKEN, NOTION_PARENT_PAGE_ID 필요
 *   pnpm setup:notion
 * 출력된 환경변수를 .env / Vercel / GitHub Secrets 에 등록한다.
 */
import { createNotion, setupNotionWorkspace } from "@careersync/core/notion";
import { run } from "./env";

const HELP = `
NOTION_PARENT_PAGE_ID 에 DB 를 만들 Notion 페이지의 링크 또는 ID 를 넣어 주세요.
  예) NOTION_PARENT_PAGE_ID=https://www.notion.so/CareerSync-1a2b3c4d5e6f47a8b9c0d1e2f3a4b5c6
  예) NOTION_PARENT_PAGE_ID=1a2b3c4d5e6f47a8b9c0d1e2f3a4b5c6
링크는 페이지 우측 상단 '···' → '링크 복사' 로 얻을 수 있어요.`;

/** 페이지 링크·ID 어느 쪽이든 32자리 ID 를 뽑아낸다 (쿼리스트링 ?v=, ?pvs= 등은 무시) */
export function parsePageId(raw: string): string | null {
  const path = (raw.trim().split(/[?#]/)[0] ?? "").replace(/\/+$/, "");
  const lastSegment = path.split("/").pop() ?? "";
  // "CareerSync-1a2b…" 처럼 제목이 붙은 링크도 있으므로 끝의 32자리만 사용
  const hex = lastSegment.replace(/-/g, "").match(/[0-9a-f]{32}$/i)?.[0];
  if (!hex) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`.toLowerCase();
}

run(async () => {
  const raw = process.env.NOTION_PARENT_PAGE_ID ?? "";
  if (!process.env.NOTION_TOKEN) throw new Error("NOTION_TOKEN 이 비어 있어요. .env 에 통합 토큰(ntn_…)을 넣어 주세요.");
  if (!raw.trim()) throw new Error(`NOTION_PARENT_PAGE_ID 가 비어 있어요.${HELP}`);
  const parent = parsePageId(raw);
  if (!parent) throw new Error(`NOTION_PARENT_PAGE_ID 에서 페이지 ID(32자리)를 찾지 못했어요: "${raw}"${HELP}`);

  console.log(`상위 페이지: ${parent}`);
  const notion = createNotion();
  const { env } = await setupNotionWorkspace(notion, parent).catch((err: { code?: string; message?: string }) => {
    // 자주 나오는 Notion 오류를 해결 방법과 함께 안내
    if (err.code === "unauthorized") throw new Error("NOTION_TOKEN 이 올바르지 않아요. 통합 페이지에서 토큰을 다시 복사해 주세요.");
    if (err.code === "object_not_found" || err.code === "restricted_resource")
      throw new Error("페이지에 접근할 수 없어요. 페이지 '···' → '연결(Connections)' 에 만든 통합을 추가했는지 확인해 주세요.");
    throw err;
  });
  console.log("\n아래 값을 .env 와 Vercel 환경변수, GitHub Secrets 에 등록하세요:\n");
  console.log(env);
});
