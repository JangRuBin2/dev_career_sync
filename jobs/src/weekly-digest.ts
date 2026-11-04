/**
 * 주간 다이제스트 (금 18:00 KST)
 * 미처리 Work Log → 마스킹 → LLM 정리 → Records/Metrics(초안) + Achievements(추천됨) + Posts(소재)
 */
import { addDays, isoWeekLabel, kstDate, maskText, notify } from "@careersync/core";
import { runWeeklyDigest } from "@careersync/core/llm";
import { denylist, isDryRun, makeAnthropic, makeRepo, revalidateWeb, run } from "./env";

run(async () => {
  const repo = makeRepo();
  const rules = denylist();
  const logs = await repo.listWorkLogs({ unprocessedOnly: true });
  if (logs.length === 0) {
    await notify("🗓 이번 주 Work Log 가 0건이에요. 오늘 한 일 2분만 기록해 볼까요?");
    return;
  }

  const masked = logs.map((l) => ({ ...l, title: maskText(l.title, rules), content: maskText(l.content, rules) }));
  const projects = await repo.listProjects();
  const end = kstDate();
  const start = masked.find((l) => l.date)?.date ?? addDays(end, -6);

  const digest = await runWeeklyDigest(makeAnthropic(), { logs: masked, projects, period: { start, end } });
  console.log(JSON.stringify(digest, null, 2));
  if (isDryRun()) return console.log("dry-run: Notion 에 쓰지 않습니다.");

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
  await revalidateWeb(["records", "metrics", "achievements", "posts", "worklogs"]);

  const warn = digest.securityNotes.length ? `\n⚠️ 보안 확인 필요: ${digest.securityNotes.join(" / ")}` : "";
  await notify(
    `📦 ${week} 다이제스트: 기록 ${digest.records.length}건 · 지표 ${metricCount}건 · 성과 후보 ${achievementCount}건 · 글감 ${digest.blogIdeas.length}건\n👉 대시보드 Inbox 에서 프로젝트 배정을 확인하세요.${warn}`,
  );
});
