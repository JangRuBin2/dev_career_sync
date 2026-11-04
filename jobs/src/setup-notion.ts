/**
 * Notion 워크스페이스 초기 셋업.
 *   NOTION_TOKEN, NOTION_PARENT_PAGE_ID 필요
 *   pnpm setup:notion
 * 출력된 환경변수를 .env / Vercel / GitHub Secrets 에 등록한다.
 */
import { createNotion, setupNotionWorkspace } from "@careersync/core/notion";
import { required, run } from "./env";

run(async () => {
  const notion = createNotion();
  const parent = required("NOTION_PARENT_PAGE_ID");
  const { env } = await setupNotionWorkspace(notion, parent);
  console.log("\n아래 값을 .env 와 Vercel 환경변수, GitHub Secrets 에 등록하세요:\n");
  console.log(env);
});
