import Link from "next/link";
import { notFound } from "next/navigation";
import { markdownToHtml } from "@careersync/core/publish";
import { renderChangeMemo, renderTailoredResume, slugifyCompany, type RequirementStatus } from "@careersync/core/tailor";
import { ActionForm } from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";
import { PrintButton } from "@/components/print-button";
import { ResumeDocument } from "@/components/resume-document";
import { Badge, Button, Card, CardTitle, PageHeader, formatDateTime, type Tone } from "@/components/ui";
import { getTailored } from "@/lib/tailored-store";
import { deleteTailoredAction } from "../../../actions";

const STATUS_TONE: Record<RequirementStatus, Tone> = { 충족: "good", 부분: "warn", 부족: "bad" };

export default async function TailoredDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getTailored(id);
  if (!doc) notFound();
  const { job, result, material, profile } = doc;

  const date = doc.createdAt.slice(0, 10);
  const submit = renderTailoredResume({ job, result, material, profile, generatedAt: date });
  const withMemo = renderTailoredResume({ job, result, material, profile, generatedAt: date, includeMemo: true });
  const sourceText = new Map(material.sources.map((s) => [s.key, s]));
  const unconfirmed = [...result.highlights, ...result.projects.flatMap((p) => p.bullets)].filter((b) => b.unconfirmed);
  const counts = { 충족: 0, 부분: 0, 부족: 0 } as Record<RequirementStatus, number>;
  for (const r of result.requirements) counts[r.status]++;

  return (
    <>
      <PageHeader
        title={`${job.company || "회사 미기재"} 맞춤 이력서`}
        description={`${job.position || "포지션 미기재"} · ${formatDateTime(doc.createdAt)}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <PrintButton />
            <Link href="/dashboard/resume/tailor" className="text-sm text-muted hover:text-ink">
              ← 목록
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardTitle
              action={
                <div className="flex flex-wrap justify-end gap-2">
                  <CopyButton text={submit} label="Markdown" />
                  <CopyButton text={submit} html={markdownToHtml(submit)} label="서식 있는 텍스트" />
                </div>
              }
            >
              제출용 미리보기
            </CardTitle>
            <ResumeDocument markdown={submit} print />
          </Card>

          <Card>
            <CardTitle action={<CopyButton text={withMemo} label="메모 포함 복사" />}>변경 포인트 메모</CardTitle>
            <p className="mb-3 text-xs text-muted">
              resume-ai-toolkit 에 보관한다면 <code>companies/{slugifyCompany(job.company)}/이력서.md</code> 로 저장하세요. 메모는 제출 전에 지워요.
            </p>
            <ResumeDocument markdown={renderChangeMemo(result, material)} />
          </Card>
        </div>

        <div className="space-y-4">
          {(result.warnings.length > 0 || unconfirmed.length > 0) && (
            <Card>
              <CardTitle>제출 전 확인</CardTitle>
              <ul className="space-y-2 text-sm">
                {unconfirmed.map((b) => (
                  <li key={b.text} className="flex items-start gap-2">
                    <Badge tone="warn">미확정</Badge>
                    <span>{b.text}</span>
                  </li>
                ))}
                {result.warnings.map((w) => (
                  <li key={w} className="flex items-start gap-2">
                    <Badge tone="bad">검증</Badge>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
              {unconfirmed.length > 0 && (
                <p className="mt-3 text-xs text-muted">
                  미확정 문장은 아직 Inbox 에서 확인하지 않은 성과·초안 기록에서 왔어요.{" "}
                  <Link href="/dashboard/inbox" className="text-accent">
                    Inbox 열기
                  </Link>
                </p>
              )}
            </Card>
          )}

          <Card>
            <CardTitle>
              요건 매핑 <span className="font-normal text-muted">충족 {counts.충족} · 부분 {counts.부분} · 부족 {counts.부족}</span>
            </CardTitle>
            <ul className="space-y-3 text-sm">
              {result.requirements.map((r) => (
                <li key={`${r.kind}-${r.requirement}`}>
                  <div className="flex items-start gap-2">
                    <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                    <span>
                      {r.requirement} <span className="text-xs text-muted">({r.kind})</span>
                    </span>
                  </div>
                  {r.note && <p className="mt-0.5 pl-1 text-xs text-muted">{r.note}</p>}
                  {r.sourceKeys.length > 0 && (
                    <ul className="mt-1 space-y-0.5 pl-1 text-xs text-muted">
                      {r.sourceKeys.map((k) => (
                        <li key={k} className="truncate" title={sourceText.get(k)?.text}>
                          {k} · {sourceText.get(k)?.text.split("\n")[0]}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          {result.gaps.length > 0 && (
            <Card>
              <CardTitle>부족한 항목</CardTitle>
              <ul className="list-disc space-y-1 pl-4 text-sm">
                {result.gaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardTitle>공고 분석</CardTitle>
            {result.analysis.coreDuties && <p className="text-sm">{result.analysis.coreDuties}</p>}
            {result.analysis.focusPoints.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {result.analysis.focusPoints.map((f) => (
                  <Badge key={f} tone="accent">
                    {f}
                  </Badge>
                ))}
              </div>
            )}
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-xs text-muted">공고 원문</summary>
              <p className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap text-xs text-muted">{job.text}</p>
            </details>
          </Card>

          <ActionForm action={deleteTailoredAction}>
            <input type="hidden" name="id" value={doc.id} />
            <Button variant="danger">이 버전 삭제</Button>
          </ActionForm>
        </div>
      </div>
    </>
  );
}
