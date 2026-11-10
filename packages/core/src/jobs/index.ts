/**
 * 배치 작업 본체 — 사용자 한 명의 Notion 에 대해 실행한다.
 *  - 로컬 CLI(jobs/): .env 의 Notion·설정으로 실행
 *  - 대시보드 cron(/api/cron/*): DB 의 사용자별 연결·설정으로 실행
 */
import type Anthropic from "@anthropic-ai/sdk";
import { generateBlogDraft, runWeeklyDigest } from "../llm";
import type { CareerRepo, PostMode } from "../notion";
import { findLeaks, maskText, type DenyRule } from "../sanitize";
import { addDays, isoWeekLabel, kstDate } from "../time";
import { fetchVelogFeed, normalizeTitle } from "../velog";

export type JobTag = "projects" | "records" | "metrics" | "achievements" | "posts" | "attachments" | "worklogs";

export interface JobContext {
  repo: CareerRepo;
  /** 필요할 때만 만든다 (AI 를 안 쓰는 경로에서 자격 증명 오류가 나지 않도록) */
  anthropic: () => Anthropic;
  rules: DenyRule[];
  notify: (text: string) => Promise<void>;
  revalidate: (tags: JobTag[]) => Promise<void> | void;
  /** AI 호출 감싸기 — cron 에서는 사용자별 월 한도 예약 */
  withAi?: <T>(kind: "digest" | "draft", fn: () => Promise<T>) => Promise<T>;
  dryRun?: boolean;
  log?: (msg: string) => void;
}

export interface JobResult {
  status: "ok" | "skipped";
  message: string;
}

const direct = <T>(_kind: string, fn: () => Promise<T>) => fn();

// ---------- 주간 다이제스트 ----------

/** 미처리 Work Log → 마스킹 → LLM 정리 → Records/Metrics(초안) + Achievements(추천됨) + Posts(소재) */
export async function weeklyDigestJob(ctx: JobContext): Promise<JobResult> {
  const { repo, rules } = ctx;
  const log = ctx.log ?? console.log;
  const withAi = ctx.withAi ?? direct;

  const logs = await repo.listWorkLogs({ unprocessedOnly: true });
  if (logs.length === 0) {
    const msg = "🗓 처리할 Work Log 가 0건이에요 (처리됨 체크가 안 된 기록만 정리해요). 오늘 한 일 2분만 기록해 볼까요?";
    if (!ctx.dryRun) await ctx.notify(msg);
    return { status: "skipped", message: "처리할 Work Log 0건" };
  }
  log(`처리할 Work Log ${logs.length}건: ${logs.map((l) => l.title).join(", ")}`);

  const masked = logs.map((l) => ({ ...l, title: maskText(l.title, rules), content: maskText(l.content, rules) }));
  const projects = await repo.listProjects();
  const end = kstDate();
  const start = masked.find((l) => l.date)?.date ?? addDays(end, -6);

  const digest = await withAi("digest", () => runWeeklyDigest(ctx.anthropic(), { logs: masked, projects, period: { start, end } }));
  if (ctx.dryRun) {
    log(JSON.stringify(digest, null, 2));
    return { status: "skipped", message: "dry-run: Notion 에 쓰지 않음" };
  }

  const week = isoWeekLabel(end);
  let metricCount = 0;
  let achievementCount = 0;
  for (const rec of digest.records) {
    const projectId = rec.projectMatch.projectId;
    const recordId = await repo.createRecord({
      title: `${week} ${rec.title}`,
      periodStart: start,
      periodEnd: end,
      cadence: "주간",
      summary: rec.summary,
      highlights: rec.highlights.map((h) => `• ${h}`).join("\n"),
      role: rec.role,
      tech: rec.tech,
      // 확신이 높을 때만 미리 연결. 최종 배정은 Inbox 에서 사용자가 확인한다.
      projectId: projectId && rec.projectMatch.confidence >= 0.8 ? projectId : null,
      logIds: rec.logIds,
    });
    for (const mt of rec.metrics) {
      await repo.createMetric({ ...mt, evidence: `원문: "${mt.sourceQuote}"`, recordId });
      metricCount++;
    }
    const projectName = projectId ? (projects.find((p) => p.id === projectId)?.name ?? "") : (rec.projectMatch.newProjectName ?? rec.title);
    for (const text of rec.achievements) {
      await repo.createAchievementCandidate({
        text,
        recordId,
        suggestedProjectId: projectId,
        suggestedProjectName: projectName,
        confidence: rec.projectMatch.confidence,
      });
      achievementCount++;
    }
  }

  for (const idea of digest.blogIdeas) {
    await repo.createPostIdea({
      title: idea.title,
      note: [`> 관점: ${idea.angle}`, "", "근거 로그:", ...idea.logIds.map((id) => `- ${id}`)].join("\n"),
    });
  }

  await repo.markWorkLogsProcessed(logs.map((l) => l.id));
  await ctx.revalidate(["records", "metrics", "achievements", "posts", "worklogs"]);

  const summary = `기록 ${digest.records.length}건 · 지표 ${metricCount}건 · 성과 후보 ${achievementCount}건 · 글감 ${digest.blogIdeas.length}건`;
  const warn = digest.securityNotes.length ? `\n⚠️ 보안 확인 필요: ${digest.securityNotes.join(" / ")}` : "";
  await ctx.notify(`📦 ${week} 다이제스트: ${summary}\n👉 대시보드 Inbox 에서 프로젝트 배정을 확인하세요.${warn}`);
  return { status: "ok", message: summary };
}

// ---------- 블로그 초안 ----------

export interface DraftOptions {
  /** 마지막 예약 글 이후 이 기간이 지나야 새 초안 생성 */
  intervalDays: number;
  /** 초안 생성 후 며칠 뒤를 발행 목표일로 */
  leadDays: number;
  hourKst?: number;
  mode?: PostMode;
}

/** 포스팅 주기가 됐으면 가장 오래된 글감으로 초안 작성 → 목표일 설정 → 알림 (발행은 사람이 직접) */
export async function draftPostsJob(ctx: JobContext, opts: DraftOptions): Promise<JobResult> {
  const { repo, rules } = ctx;
  const log = ctx.log ?? console.log;
  const withAi = ctx.withAi ?? direct;
  const hour = opts.hourKst ?? 9;
  const mode = opts.mode ?? "임시저장";

  const posts = await repo.listPosts();
  const today = kstDate();
  const lastScheduled = posts.map((p) => p.scheduledAt?.slice(0, 10)).filter(Boolean).sort().at(-1);
  if (lastScheduled && addDays(lastScheduled, opts.intervalDays) > addDays(today, opts.leadDays)) {
    return { status: "skipped", message: `다음 포스팅 주기가 아님 (마지막 예약 ${lastScheduled}, 주기 ${opts.intervalDays}일)` };
  }

  const idea = posts.filter((p) => p.status === "소재").sort((a, b) => a.title.localeCompare(b.title))[0];
  if (!idea) {
    if (!ctx.dryRun) await ctx.notify("✍️ 포스팅 주기가 됐는데 글감(소재)이 없어요. Work Log 에 '블로그소재' 체크를 해 주세요.");
    return { status: "skipped", message: "글감 없음" };
  }

  const note = await repo.getPageMarkdown(idea.id);
  const logIds = [...note.matchAll(/^- ([0-9a-f-]{32,36})$/gm)].map((m) => m[1]!);
  const logs = (await repo.listWorkLogs()).filter((l) => logIds.includes(l.id));
  const sources = logs.map((l) => maskText(`[${l.date}] ${l.title}\n${l.content}`, rules));
  const angle = note.match(/관점: (.+)/)?.[1] ?? "";

  const draft = await withAi("draft", () =>
    generateBlogDraft(ctx.anthropic(), { idea: { title: idea.title, angle }, sources: sources.length ? sources : [maskText(note, rules)] }),
  );
  const markdown = maskText(draft.markdown, rules);
  const leaks = findLeaks(`${draft.title}\n${markdown}`, rules);
  const publishDate = addDays(today, opts.leadDays);
  const scheduledAt = new Date(`${publishDate}T${String(hour).padStart(2, "0")}:00:00+09:00`).toISOString();

  if (ctx.dryRun) {
    log(JSON.stringify({ title: draft.title, scheduledAt, leaks, markdown }, null, 2));
    return { status: "skipped", message: "dry-run: Notion 에 쓰지 않음" };
  }

  await repo.updatePostBody(idea.id, markdown);
  await repo.updatePost(idea.id, { status: "검토대기", mode, reviewed: false, scheduledAt });
  await ctx.revalidate(["posts"]);
  await ctx.notify(
    `✍️ 블로그 초안 준비: "${draft.title}" (목표일 ${publishDate})\n👉 대시보드 포스팅에서 검토하고 Markdown/HTML 을 복사해 올려 주세요.${leaks.length ? `\n⚠️ 마스킹 확인: ${leaks.join(", ")}` : ""}`,
  );
  return { status: "ok", message: `초안 "${draft.title}" (목표일 ${publishDate})` };
}

// ---------- velog RSS 동기화 ----------

/** Posts 와 URL/제목으로 매칭 → 발행됨 + URL 기록, DB 에 없는 글은 발행됨으로 추가 */
export async function syncRssJob(ctx: JobContext, opts: { velogUsername: string; fetchImpl?: typeof fetch }): Promise<JobResult> {
  const { repo } = ctx;
  const log = ctx.log ?? console.log;
  const feed = await fetchVelogFeed(opts.velogUsername, opts.fetchImpl);
  const posts = await repo.listPosts();
  const byUrl = new Map(posts.filter((p) => p.velogUrl).map((p) => [decodeURI(p.velogUrl!), p]));
  const byTitle = new Map(posts.map((p) => [normalizeTitle(p.title), p]));

  let updated = 0;
  let created = 0;
  for (const item of feed) {
    const match = byUrl.get(decodeURI(item.link)) ?? byTitle.get(normalizeTitle(item.title));
    if (ctx.dryRun) {
      log(`${match ? "match" : "new"}: ${item.title}`);
      continue;
    }
    if (!match) {
      await repo.createPublishedPost({ title: item.title, url: item.link, publishedAt: item.publishedAt, platform: "velog" });
      created++;
    } else if (match.status !== "발행됨" || !match.velogUrl) {
      await repo.updatePost(match.id, {
        status: "발행됨",
        velogUrl: item.link,
        platforms: [...new Set([...match.platforms, "velog"])],
        ...(item.publishedAt ? { publishedAt: item.publishedAt } : {}),
      });
      updated++;
    }
  }
  if (updated || created) await ctx.revalidate(["posts"]);
  return { status: updated || created ? "ok" : "skipped", message: `RSS ${feed.length}건 · 갱신 ${updated} · 신규 ${created}` };
}
