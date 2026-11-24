import { ActionForm } from "@/components/action-form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { renderProjectSection } from "@careersync/core";
import { renderToolkitReference } from "@careersync/core/tailor";
import { AttachmentGallery, LinkForm } from "@/components/attachments";
import { CopyButton } from "@/components/copy-button";
import { ImageUploader } from "@/components/image-uploader";
import { MetricDumbbell, MetricLegend } from "@/components/metric-dumbbell";
import { Badge, Button, Card, CardTitle, Empty, Field, PageHeader, formatPeriod } from "@/components/ui";
import { getAchievements, getAttachments, getMetrics, getPosts, getProject, getRecords } from "@/lib/data";
import { updateProjectLinksAction } from "../../actions";

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id).catch(() => null);
  if (!project) notFound();
  const [records, metrics, achievements, attachments, posts] = await Promise.all([
    getRecords(id),
    getMetrics(),
    getAchievements(),
    getAttachments({ projectId: id }),
    getPosts(),
  ]);
  const recordIds = new Set(records.map((r) => r.id));
  const projectMetrics = metrics.filter((m) => m.recordIds.some((r) => recordIds.has(r)));
  const projectPosts = posts.filter((p) => p.projectIds.includes(id));
  const projectAchievements = achievements.filter((a) => a.projectIds.includes(id));

  return (
    <>
      <PageHeader
        title={project.name}
        description={`${formatPeriod(project.period)}${project.role ? ` · ${project.role}` : ""}`}
        action={
          <div className="flex flex-wrap gap-2">
            <CopyButton
              text={renderToolkitReference({ project, records, metrics: projectMetrics, achievements: projectAchievements })}
              label="toolkit 레퍼런스 복사"
            />
            {project.publicUrl && (
              <a href={project.publicUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-accent">
                🔗 공개 사이트
              </a>
            )}
            <a href={project.url} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-accent">
              Notion 에서 열기
            </a>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>개요</CardTitle>
          <p className="text-sm">{project.summary || <span className="text-muted">요약이 비어 있어요. Notion 에서 채워 주세요.</span>}</p>
          <div className="mt-3 flex flex-wrap gap-1">
            {project.stack.map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
          </div>
          <h3 className="mb-2 mt-5 text-xs font-semibold text-muted">이력서 섹션 미리보기</h3>
          <pre className="whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-sm">{renderProjectSection(project, projectAchievements)}</pre>
        </Card>
        <Card>
          <CardTitle>링크</CardTitle>
          <ActionForm action={updateProjectLinksAction} showOk className="space-y-2">
            <input type="hidden" name="id" value={project.id} />
            <Field label="공개 사이트 URL" hint="공개 서비스라면 입력하세요. 이력서에 링크가 붙어요.">
              <input name="publicUrl" type="url" defaultValue={project.publicUrl ?? ""} placeholder="https://" />
            </Field>
            <Field label="공개 저장소 URL">
              <input name="repoUrl" type="url" defaultValue={project.repoUrl ?? ""} placeholder="https://github.com/…" />
            </Field>
            <Button variant="secondary">저장</Button>
          </ActionForm>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>기록 타임라인 ({records.length})</CardTitle>
          {records.length === 0 ? (
            <Empty>연결된 기록이 없어요.</Empty>
          ) : (
            <ol className="relative space-y-4 border-l border-line pl-4">
              {records.map((r) => (
                <li key={r.id}>
                  <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-surface bg-accent" />
                  <Link href={`/dashboard/records/${r.id}`} className="text-sm font-medium hover:text-accent">
                    {r.title}
                  </Link>
                  <div className="text-xs text-muted">
                    {formatPeriod(r.period)} · <Badge tone={r.status === "확정" ? "good" : "warn"}>{r.status ?? "초안"}</Badge>
                  </div>
                  {r.highlights && <p className="mt-1 whitespace-pre-line text-xs text-muted">{r.highlights}</p>}
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card>
          <CardTitle action={projectMetrics.length > 0 ? <MetricLegend /> : undefined}>성과 지표 ({projectMetrics.length})</CardTitle>
          {projectMetrics.length === 0 ? (
            <Empty>지표가 없어요.</Empty>
          ) : (
            <ul className="space-y-4">
              {projectMetrics.map((m) => (
                <MetricDumbbell key={m.id} metric={m} />
              ))}
            </ul>
          )}
          {projectPosts.length > 0 && (
            <>
              <h3 className="mb-2 mt-5 text-xs font-semibold text-muted">관련 velog 글</h3>
              <ul className="space-y-1 text-sm">
                {projectPosts.map((p) => (
                  <li key={p.id}>
                    {p.velogUrl ? (
                      <a href={p.velogUrl} target="_blank" rel="noreferrer" className="text-accent">
                        {p.title}
                      </a>
                    ) : (
                      <Link href={`/dashboard/posts/${p.id}`}>{p.title}</Link>
                    )}{" "}
                    <Badge>{p.status ?? "-"}</Badge>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>첨부</CardTitle>
        <AttachmentGallery items={attachments} projectId={project.id} />
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold text-muted">캡처 추가</h3>
            <ImageUploader projectId={project.id} />
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold text-muted">링크 추가</h3>
            <LinkForm projectId={project.id} />
          </div>
        </div>
      </Card>
    </>
  );
}
