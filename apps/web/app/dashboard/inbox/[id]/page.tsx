import { ActionForm } from "@/components/action-form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { lineDiff, previewAssignment } from "@careersync/core";
import type { Project } from "@careersync/core/notion";
import { Button, Card, CardTitle, Field, PageHeader } from "@/components/ui";
import { getAchievements, getProjects } from "@/lib/data";
import { kstDate } from "@careersync/core";
import { resolveAchievementAction } from "../../actions";

type Search = { kind?: string; projectId?: string; suggestedId?: string; text?: string; newName?: string };

function Diff({ before, after }: { before: string; after: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-surface-2 p-4 text-sm leading-relaxed">
      {lineDiff(before, after).map((d, i) => (
        <div key={i} className={d.type === "add" ? "bg-good-soft text-good" : d.type === "remove" ? "bg-bad-soft text-bad line-through" : ""}>
          {d.type === "add" ? "+ " : d.type === "remove" ? "- " : "  "}
          {d.line || " "}
        </div>
      ))}
    </pre>
  );
}

export default async function PreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const { id } = await params;
  const sp = await searchParams;
  const [candidates, projects] = await Promise.all([getAchievements(), getProjects()]);
  const candidate = candidates.find((a) => a.id === id);
  if (!candidate) notFound();
  const text = sp.text?.trim() || candidate.text;
  const kind = sp.kind ?? "existing";
  const back = (
    <Link href="/dashboard/inbox" className="text-sm text-muted hover:text-ink">
      ← Inbox
    </Link>
  );

  if (kind === "hold" || kind === "reject") {
    return (
      <>
        <PageHeader title={kind === "hold" ? "보류할까요?" : "반려할까요?"} action={back} />
        <Card>
          <p className="font-medium">{text}</p>
          <ActionForm action={resolveAchievementAction} className="mt-4">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="kind" value={kind} />
            <Button variant={kind === "reject" ? "danger" : "secondary"}>{kind === "hold" ? "보류" : "반려"}</Button>
          </ActionForm>
        </Card>
      </>
    );
  }

  if (kind === "new") {
    const draft: Project = {
      id: "__new__",
      url: "",
      name: sp.newName || candidate.suggestedProject || "새 프로젝트",
      period: { start: kstDate(), end: null },
      role: "",
      stack: [],
      teamSize: null,
      summary: "",
      status: "진행중",
      publicUrl: null,
      repoUrl: null,
      coverImage: null,
      resumeOrder: null,
      onResume: true,
    };
    const { after } = previewAssignment({ project: draft, achievements: [], candidate, text });
    return (
      <>
        <PageHeader title="새 프로젝트로 추가" description="프로젝트 정보를 확인하고 적용하면 이력서에 새 섹션이 생겨요." action={back} />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <ActionForm action={resolveAchievementAction} className="space-y-3">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="kind" value="new" />
              <Field label="이력서 문장">
                <textarea name="text" defaultValue={text} rows={2} />
              </Field>
              <Field label="프로젝트 이름">
                <input name="newName" defaultValue={draft.name} required />
              </Field>
              <Field label="역할">
                <input name="newRole" placeholder="예: 백엔드 리드" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="시작일">
                  <input type="date" name="newStart" defaultValue={kstDate()} />
                </Field>
                <Field label="기술스택" hint="쉼표로 구분">
                  <input name="newStack" placeholder="Node.js, PostgreSQL" />
                </Field>
              </div>
              <Button>프로젝트 생성 + 이력서 적용</Button>
            </ActionForm>
          </Card>
          <Card>
            <CardTitle>이력서 미리보기 (새 섹션)</CardTitle>
            <Diff before="" after={after} />
          </Card>
        </div>
      </>
    );
  }

  const projectId = kind === "other" ? sp.projectId : (sp.suggestedId ?? candidate.suggestedProjectId ?? sp.projectId);
  const project = projects.find((p) => p.id === projectId);
  if (!project) {
    return (
      <>
        <PageHeader title="프로젝트를 선택해 주세요" action={back} />
        <Card>선택한 프로젝트를 찾을 수 없어요. Inbox 로 돌아가 다시 선택해 주세요.</Card>
      </>
    );
  }
  const confirmed = candidates.filter((a) => a.assignment === "확인됨" || a.assignment === "새 프로젝트");
  const { before, after } = previewAssignment({ project, achievements: confirmed, candidate, text });

  return (
    <>
      <PageHeader title={`"${project.name}" 에 추가`} description="초록색 줄이 이력서에 새로 들어갈 내용이에요." action={back} />
      <Card>
        <CardTitle>이력서 섹션 Before → After</CardTitle>
        <Diff before={before} after={after} />
        <ActionForm action={resolveAchievementAction} className="mt-4 flex flex-wrap gap-2">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="kind" value="existing" />
          <input type="hidden" name="projectId" value={project.id} />
          <input type="hidden" name="text" value={text} />
          <Button>적용 (Notion 이력서 갱신)</Button>
        </ActionForm>
      </Card>
    </>
  );
}
