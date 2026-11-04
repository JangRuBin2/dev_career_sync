/**
 * Notion 셋업 점검 (읽기 전용, --write 옵션 시 쓰기 테스트)
 *   pnpm verify:notion
 *   pnpm verify:notion --write   ← Work Log 에 테스트 행을 만들고 바로 휴지통으로 보냄
 */
import { DB_ENV, DB_KEYS, DB_TITLES, createNotion, dataSourceIdsFromEnv, diffSchema, type ActualSchema, type DbKey } from "@careersync/core/notion";
import { CareerRepo } from "@careersync/core/notion";
import { run } from "./env";

run(async () => {
  const notion = createNotion();
  const ds = dataSourceIdsFromEnv();
  let failed = false;

  // 1) 각 DB 접근 + 스키마 수집
  const actual = {} as ActualSchema;
  for (const key of DB_KEYS) {
    try {
      const res = (await notion.dataSources.retrieve({ data_source_id: ds[key] })) as unknown as { properties: ActualSchema[DbKey] };
      actual[key] = res.properties;
      console.log(`✔ ${DB_TITLES[key]} 접근 OK (속성 ${Object.keys(res.properties).length}개)`);
    } catch (err) {
      failed = true;
      actual[key] = {};
      console.log(`✘ ${DB_TITLES[key]} 접근 실패 — ${DB_ENV[key]} 값을 확인하세요 (${(err as Error).message})`);
    }
  }

  // 2) 스키마 비교
  const issues = diffSchema(actual, ds);
  if (issues.length === 0) console.log("✔ 속성·관계(relation)·역방향 속성·수식 모두 기대한 대로예요");
  else {
    failed = true;
    console.log(`✘ 스키마 문제 ${issues.length}건:`);
    for (const i of issues) console.log(`   - ${DB_TITLES[i.db]} › ${i.property}: ${i.problem}`);
  }

  // 3) 이력서 페이지
  const resumeId = process.env.NOTION_RESUME_PAGE_ID;
  if (!resumeId) {
    failed = true;
    console.log("✘ NOTION_RESUME_PAGE_ID 가 비어 있어요");
  } else {
    try {
      await notion.pages.retrieve({ page_id: resumeId });
      console.log("✔ 이력서 페이지 접근 OK");
    } catch (err) {
      failed = true;
      console.log(`✘ 이력서 페이지 접근 실패 (${(err as Error).message})`);
    }
  }

  // 4) 쓰기 테스트 (선택)
  if (process.argv.includes("--write")) {
    const repo = new CareerRepo(notion, ds);
    try {
      const id = await repo.createWorkLog({ title: "[CareerSync 연결 테스트] 지워져도 됩니다", content: "verify:notion --write" });
      const logs = await repo.listWorkLogs({ unprocessedOnly: true }); // 주간 배치가 쓰는 조회 조건 그대로
      const found = logs.some((l) => l.id === id);
      await notion.pages.update({ page_id: id, in_trash: true } as Parameters<typeof notion.pages.update>[0]);
      console.log(found ? "✔ 쓰기 · 조회 · 삭제 테스트 OK (테스트 행은 휴지통으로 이동)" : "✘ 테스트 행을 만들었지만 조회되지 않아요");
      if (!found) failed = true;
    } catch (err) {
      failed = true;
      console.log(`✘ 쓰기 테스트 실패 — 통합의 '콘텐츠 입력' 권한을 확인하세요 (${(err as Error).message})`);
    }
  }

  console.log(failed ? "\n⚠️ 위 ✘ 항목을 확인해 주세요." : "\n🎉 Notion 셋업이 정상이에요.");
  if (failed) process.exitCode = 1;
});
