import { ActionForm } from "@/components/action-form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatImprovement } from "@careersync/core";
import { AttachmentGallery, LinkForm } from "@/components/attachments";
import { ImageUploader } from "@/components/image-uploader";
import { Badge, Button, Card, CardTitle, Empty, PageHeader, formatPeriod } from "@/components/ui";
import { getAttachments, getMetrics, getProjects, getRecord, getWorkLogs } from "@/lib/data";
import { confirmRecordAction } from "../../actions";

export default async function RecordDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await getRecord(id).catch(() => null);
  if (!record) notFound();
  const [metrics, attachments, logs, projects] = await Promise.all([getMetrics(id), getAttachments({ recordId: id }), getWorkLogs(), getProjects()]);
  const sourceLogs = logs.filter((l) => record.logIds.includes(l.id));
  const project = projects.find((p) => record.projectIds.includes(p.id));

  return (
    <>
      <PageHeader
        title={record.title}
        description={`${formatPeriod(record.period)} · ${record.cadence ?? ""} · ${record.origin ?? ""} 생성`}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={record.status === "확정" ? "good" : "warn"}>{record.status ?? "초안"}</Badge>
            <a href={record.url} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-accent">
              Notion 에서 열기
            </a>
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>작업 요약</CardTitle>
          <p className="whitespace-pre-line text-sm">{record.summary}</p>
          <h3 className="mb-1 mt-4 text-xs font-semibold text-muted">핵심 성과</h3>
          <p className="whitespace-pre-line text-sm">{record.highlights}</p>
          {record.role && (
            <>
              <h3 className="mb-1 mt-4 text-xs font-semibold text-muted">역할</h3>
              <p className="text-sm">
                {record.role}
                {record.contribution !== null && ` (기여도 ${Math.round(record.contribution * 100)}%)`}
              </p>
            </>
          )}
          <div className="mt-4 flex flex-wrap gap-1">
            {record.tech.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
        </Card>
        <Card>
          <CardTitle>프로젝트</CardTitle>
          {project ? (
            <Link href={`/dashboard/projects/${project.id}`} className="font-medium text-accent">
              {project.name}
            </Link>
          ) : (
            <p className="text-sm text-muted">아직 배정되지 않았어요. Inbox 에서 성과를 배정하면 함께 연결돼요.</p>
          )}
          {record.status !== "확정" && (
            <ActionForm action={confirmRecordAction} className="mt-4">
              <input type="hidden" name="id" value={record.id} />
              <Button variant="secondary">기록 확정</Button>
            </ActionForm>
          )}
          {record.confirmedAt && <p className="mt-3 text-xs text-muted">확정일 {record.confirmedAt}</p>}
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>지표 데이터 ({metrics.length})</CardTitle>
        {metrics.length === 0 ? (
          <Empty>이 기록에는 지표가 없어요.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  {["지표", "카테고리", "Before", "After", "개선율", "측정 방법", "신뢰도", "근거"].map((h) => (
                    <th key={h} className="whitespace-nowrap py-2 pr-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {metrics.map((m) => (
                  <tr key={m.id} className="align-top">
                    <td className="py-2 pr-3 font-medium">{m.name}</td>
                    <td className="py-2 pr-3">{m.category}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {m.before} {m.unit}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {m.after} {m.unit}
                    </td>
                    <td className="py-2 pr-3 font-semibold tabular-nums text-good">{formatImprovement(m.improvement)}</td>
                    <td className="py-2 pr-3 text-xs">{m.method}</td>
                    <td className="py-2 pr-3 text-xs">{m.confidence}</td>
                    <td className="py-2 text-xs text-muted">{m.evidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <CardTitle>원본 업무 로그 ({sourceLogs.length})</CardTitle>
        {sourceLogs.length === 0 ? (
          <Empty>연결된 로그를 찾지 못했어요.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {sourceLogs.map((l) => (
              <li key={l.id} className="py-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {l.title} <span className="text-xs font-normal text-muted">{l.date}</span>
                  {l.type && <Badge>{l.type}</Badge>}
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-muted">{l.content}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-4">
        <CardTitle>첨부</CardTitle>
        <AttachmentGallery items={attachments} />
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <ImageUploader recordId={record.id} projectId={project?.id} />
          <LinkForm recordId={record.id} projectId={project?.id} />
        </div>
      </Card>
    </>
  );
}
