/**
 * velog 주기 포스팅: 소재 → 초안 (발행 D-N 에 실행)
 *   POST_INTERVAL_DAYS (기본 14) — 마지막 예약 글 이후 이 기간이 지나야 새 초안 생성
 *   POST_LEAD_DAYS (기본 3) — 초안 생성 후 며칠 뒤에 발행 예약할지
 *   POST_DEFAULT_MODE (기본 임시저장) — 임시저장 | 공개 | 비공개
 *   POST_PUBLISH_HOUR_KST (기본 9)
 */
import { addDays, findLeaks, kstDate, maskText, notify } from "@careersync/core";
import { generateBlogDraft } from "@careersync/core/llm";
import type { PostMode } from "@careersync/core/notion";
import { denylist, isDryRun, makeAnthropic, makeRepo, revalidateWeb, run } from "./env";

const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d);

run(async () => {
  const repo = makeRepo();
  const rules = denylist();
  const interval = num(process.env.POST_INTERVAL_DAYS, 14);
  const lead = num(process.env.POST_LEAD_DAYS, 3);
  const hour = num(process.env.POST_PUBLISH_HOUR_KST, 9);
  const mode = (process.env.POST_DEFAULT_MODE ?? "임시저장") as PostMode;

  const posts = await repo.listPosts();
  const today = kstDate();
  const lastScheduled = posts.map((p) => p.scheduledAt?.slice(0, 10)).filter(Boolean).sort().at(-1);
  if (lastScheduled && addDays(lastScheduled, interval) > addDays(today, lead)) {
    return console.log(`다음 포스팅 주기가 아닙니다 (마지막 예약 ${lastScheduled}, 주기 ${interval}일)`);
  }

  const idea = posts.filter((p) => p.status === "소재").sort((a, b) => a.title.localeCompare(b.title))[0];
  if (!idea) return notify("✍️ 포스팅 주기가 됐는데 글감(소재)이 없어요. Work Log 에 '블로그소재' 체크를 해 주세요.");

  const note = await repo.getPageMarkdown(idea.id);
  const logIds = [...note.matchAll(/^- ([0-9a-f-]{32,36})$/gm)].map((m) => m[1]!);
  const logs = (await repo.listWorkLogs()).filter((l) => logIds.includes(l.id));
  const sources = logs.map((l) => maskText(`[${l.date}] ${l.title}\n${l.content}`, rules));
  const angle = note.match(/관점: (.+)/)?.[1] ?? "";

  const draft = await generateBlogDraft(makeAnthropic(), { idea: { title: idea.title, angle }, sources: sources.length ? sources : [maskText(note, rules)] });
  const markdown = maskText(draft.markdown, rules);
  const leaks = findLeaks(`${draft.title}\n${markdown}`, rules);
  const publishDate = addDays(today, lead);
  // KST hour → UTC ISO
  const scheduledAt = new Date(`${publishDate}T${String(hour).padStart(2, "0")}:00:00+09:00`).toISOString();

  if (isDryRun()) return console.log({ title: draft.title, scheduledAt, leaks, markdown });

  await repo.updatePostBody(idea.id, markdown);
  await repo.updatePost(idea.id, { status: "검토대기", mode, reviewed: false, scheduledAt });
  await revalidateWeb(["posts"]);
  await notify(
    `✍️ velog 초안 준비: "${draft.title}" → ${publishDate} ${hour}시 예약 (${mode}). 검토완료 체크 전에는 임시저장만 됩니다.${leaks.length ? `\n⚠️ 마스킹 확인: ${leaks.join(", ")}` : ""}`,
  );
});
