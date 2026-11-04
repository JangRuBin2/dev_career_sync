import { ActionForm } from "@/components/action-form";
import Link from "next/link";
import { formatImprovement } from "@careersync/core";
import { Badge, Button, Card, CardTitle, Empty, PageHeader } from "@/components/ui";
import { getAchievements, getMetrics, getProjects, getRecords } from "@/lib/data";
import { confirmRecordAction } from "../actions";

const DONE: Record<string, string> = {
  existing: "기존 프로젝트에 추가하고 이력서를 갱신했어요.",
  new: "새 프로젝트를 만들고 이력서를 갱신했어요.",
  hold: "보류로 옮겼어요.",
  reject: "반려했어요.",
};

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const { done } = await searchParams;
  const [candidates, projects, records, metrics] = await Promise.all([getAchievements(["추천됨"]), getProjects(), getRecords(), getMetrics()]);
  const recordById = new Map(records.map((r) => [r.id, r]));
  const draftRecords = records.filter((r) => r.status !== "확정");

  return (
    <>
      <PageHeader title="Inbox" description="성과 후보를 어느 프로젝트에 넣을지 확인하고, 이력서 반영 전에 미리보기로 점검해요." />
      {done && DONE[done] && <p className="mb-4 rounded-lg bg-good-soft px-3 py-2 text-sm text-good">✓ {DONE[done]}</p>}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">성과 후보 · 프로젝트 배정 ({candidates.length})</h2>
        {candidates.length === 0 && <Empty>확인할 성과 후보가 없어요. 주간 배치(금 18시)가 끝나면 여기에 쌓여요.</Empty>}
        {candidates.map((a) => {
          const record = a.recordIds[0] ? recordById.get(a.recordIds[0]) : undefined;
          const suggested = a.suggestedProjectId ? projects.find((p) => p.id === a.suggestedProjectId) : undefined;
          return (
            <Card key={a.id}>
              <form action={`/dashboard/inbox/${a.id}`} method="get" className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <textarea name="text" defaultValue={a.text} rows={2} className="min-w-0 flex-1 font-medium" aria-label="이력서 문장" />
                  <Badge tone={(a.confidence ?? 0) >= 0.8 ? "good" : (a.confidence ?? 0) >= 0.5 ? "warn" : "bad"}>
                    추천 신뢰도 {Math.round((a.confidence ?? 0) * 100)}%
                  </Badge>
                </div>
                {record && (
                  <p className="text-xs text-muted">
                    근거 기록:{" "}
                    <Link href={`/dashboard/records/${record.id}`} className="text-accent">
                      {record.title}
                    </Link>
                  </p>
                )}

                <fieldset className="grid gap-2 text-sm md:grid-cols-2">
                  {suggested ? (
                    <label className="flex items-start gap-2 rounded-lg border border-line p-3">
                      <input type="radio" name="kind" value="existing" defaultChecked />
                      <input type="hidden" name="suggestedId" value={suggested.id} />
                      <span>
                        추천 프로젝트에 추가
                        <span className="block font-medium">{suggested.name}</span>
                      </span>
                    </label>
                  ) : (
                    <label className="flex items-start gap-2 rounded-lg border border-line p-3">
                      <input type="radio" name="kind" value="new" defaultChecked />
                      <span>
                        새 프로젝트로 생성 (추천)
                        <span className="block font-medium">{a.suggestedProject || "이름 입력"}</span>
                      </span>
                    </label>
                  )}
                  <label className="flex items-start gap-2 rounded-lg border border-line p-3">
                    <input type="radio" name="kind" value="other" />
                    <span className="w-full">
                      다른 기존 프로젝트 선택
                      <select name="projectId" defaultValue={suggested?.id ?? ""} className="mt-1">
                        <option value="">선택…</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>
                  {suggested && (
                    <label className="flex items-start gap-2 rounded-lg border border-line p-3">
                      <input type="radio" name="kind" value="new" />
                      <span>새 프로젝트로 생성</span>
                    </label>
                  )}
                  <input type="hidden" name="newName" value={suggested ? "" : a.suggestedProject} />
                  <div className="flex items-center gap-3 rounded-lg border border-line p-3">
                    <label className="flex items-center gap-1.5">
                      <input type="radio" name="kind" value="hold" /> 보류
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="radio" name="kind" value="reject" /> 반려
                    </label>
                  </div>
                </fieldset>
                <Button>미리보기 →</Button>
              </form>
            </Card>
          );
        })}
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-semibold">확정 대기 기록 ({draftRecords.length})</h2>
        {draftRecords.length === 0 && <Empty>확정 대기 중인 기록이 없어요.</Empty>}
        {draftRecords.map((r) => {
          const ms = metrics.filter((m) => m.recordIds.includes(r.id));
          return (
            <Card key={r.id}>
              <CardTitle action={<Badge tone="warn">초안</Badge>}>
                <Link href={`/dashboard/records/${r.id}`} className="hover:text-accent">
                  {r.title}
                </Link>
              </CardTitle>
              <p className="whitespace-pre-line text-sm text-muted">{r.highlights || r.summary}</p>
              {ms.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {ms.map((m) => (
                    <li key={m.id}>
                      📊 {m.name}: {m.before} → {m.after} {m.unit} <span className="font-semibold text-good">{formatImprovement(m.improvement)}</span>
                      {m.method.includes("확인 필요") && <span className="ml-1 text-xs text-warn">측정 방법 확인 필요</span>}
                    </li>
                  ))}
                </ul>
              )}
              <ActionForm action={confirmRecordAction} className="mt-3">
                <input type="hidden" name="id" value={r.id} />
                <Button variant="secondary">기록 확정 (이후 수정 잠금)</Button>
              </ActionForm>
            </Card>
          );
        })}
      </section>
    </>
  );
}
