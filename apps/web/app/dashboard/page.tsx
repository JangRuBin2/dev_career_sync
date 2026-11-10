import { ActionForm } from "@/components/action-form";
import Link from "next/link";
import { addDays, formatImprovement, kstDate } from "@careersync/core";
import { OPT } from "@careersync/core/notion";
import { Badge, Button, Card, CardTitle, Empty, Field, PageHeader, Stat, formatPeriod, formatShortDate } from "@/components/ui";
import { getAchievements, getMetrics, getPosts, getProjects, getRecords, getWorkLogs } from "@/lib/data";
import { quickLogAction } from "./actions";

function weekStart(today: string) {
  const day = new Date(`${today}T00:00:00Z`).getUTCDay() || 7;
  return addDays(today, 1 - day);
}

export default async function DashboardHome({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  const today = kstDate();
  const monday = weekStart(today);
  const [logs, projects, records, metrics, achievements, posts] = await Promise.all([
    getWorkLogs(addDays(today, -30)),
    getProjects(),
    getRecords(),
    getMetrics(),
    getAchievements(),
    getPosts(),
  ]);

  const weekLogs = logs.filter((l) => (l.date ?? "") >= monday);
  const pendingAchievements = achievements.filter((a) => a.assignment === "추천됨");
  const draftRecords = records.filter((r) => r.status !== "확정");
  const confirmed = achievements.filter((a) => a.assignment === "확인됨" || a.assignment === "새 프로젝트");
  const now = new Date().toISOString();
  const nextPost = posts.filter((p) => p.scheduledAt && p.scheduledAt >= now && p.status !== "발행됨").sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))[0];
  const topMetrics = metrics
    .filter((m) => m.improvement !== null)
    .sort((a, b) => (b.improvement ?? 0) - (a.improvement ?? 0))
    .slice(0, 5);

  return (
    <>
      <PageHeader title="한눈에 보기" description={`${today} 기준 · 이번 주는 ${monday}부터`} />
      {welcome && (
        <p className="mb-4 rounded-lg bg-good-soft px-3 py-2 text-sm text-good">
          {welcome === "existing"
            ? "✓ 기존 CareerSync DB 를 찾아서 연결했어요."
            : "✓ Notion 에 CareerSync DB 와 이력서 페이지를 만들었어요. Work Log 에 오늘 한 일을 기록해 보세요."}{" "}
          설정에서 이름·금지어·알림을 채워 주세요.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="이번 주 기록" value={`${weekLogs.length}건`} hint={weekLogs.length === 0 ? "오늘 한 일 2분만 적어 볼까요?" : weekLogs.at(-1)?.title} />
        <Stat label="확인 대기" value={`${pendingAchievements.length + draftRecords.length}건`} hint={`성과 ${pendingAchievements.length} · 기록 ${draftRecords.length}`} href="/dashboard/inbox" />
        <Stat label="다음 발행 목표" value={nextPost ? formatShortDate(nextPost.scheduledAt) : "-"} hint={nextPost ? `${nextPost.title} · ${nextPost.mode ?? "임시저장"}` : "예약된 글 없음"} href="/dashboard/posts" />
        <Stat label="이력서 성과" value={`${confirmed.length}개`} hint={`프로젝트 ${projects.filter((p) => p.onResume).length}개 노출`} href="/dashboard/resume" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle action={<Link href="/dashboard/projects" className="text-xs text-accent">전체 보기</Link>}>프로젝트 타임라인</CardTitle>
          {projects.length === 0 ? (
            <Empty>아직 프로젝트가 없어요. 주간 배치가 성과를 정리하면 Inbox에서 새 프로젝트로 만들 수 있어요.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {projects.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/dashboard/projects/${p.id}`} className="font-medium hover:text-accent">
                      {p.name}
                    </Link>
                    <div className="truncate text-xs text-muted">
                      {formatPeriod(p.period)} · {p.stack.slice(0, 4).join(", ") || "스택 미입력"}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {p.publicUrl && <Badge tone="accent">공개 링크</Badge>}
                    <Badge tone={p.status === "진행중" ? "good" : "neutral"}>{p.status ?? "-"}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle>빠른 기록</CardTitle>
          <ActionForm action={quickLogAction} showOk className="space-y-3">
            <Field label="제목">
              <input name="title" placeholder="예: 결제 API 인덱스 튜닝" />
            </Field>
            <Field label="내용" hint="숫자는 Before → After 로 적으면 지표로 정리돼요">
              <textarea name="content" rows={4} placeholder="p95 820ms → 490ms, 원인은 ..." />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="유형">
                <select name="type" defaultValue="">
                  <option value="">선택 안 함</option>
                  {OPT.workType.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="프로젝트">
                <select name="projectId" defaultValue="">
                  <option value="">나중에</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Button>기록 저장</Button>
          </ActionForm>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>개선 지표 Top 5</CardTitle>
        {topMetrics.length === 0 ? (
          <Empty>아직 지표가 없어요.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">지표</th>
                  <th className="py-2 pr-3 font-medium">Before → After</th>
                  <th className="py-2 pr-3 text-right font-medium">개선율</th>
                  <th className="py-2 font-medium">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {topMetrics.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2 pr-3">{m.name}</td>
                    <td className="py-2 pr-3 tabular-nums text-muted">
                      {m.before} → {m.after} {m.unit}
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold tabular-nums text-good">{formatImprovement(m.improvement)}</td>
                    <td className="py-2">
                      <Badge tone={m.status === "확정" ? "good" : "warn"}>{m.status ?? "초안"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
