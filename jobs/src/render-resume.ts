/** 이력서 페이지 전체 재렌더 (수동 실행용) */
import { renderResume } from "@careersync/core";
import { makeRepo, required, run } from "./env";

run(async () => {
  const repo = makeRepo();
  const [projects, achievements] = await Promise.all([repo.listProjects(), repo.listAchievements({ assignment: ["확인됨", "새 프로젝트"] })]);
  const markdown = renderResume({
    profile: { name: process.env.RESUME_NAME, headline: process.env.RESUME_HEADLINE },
    projects,
    achievements,
  });
  if (process.argv.includes("--dry-run")) return console.log(markdown);
  await repo.replacePageMarkdown(required("NOTION_RESUME_PAGE_ID"), markdown);
  console.log("이력서 페이지를 갱신했습니다.");
});
