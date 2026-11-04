import { AttachmentGallery, LinkForm } from "@/components/attachments";
import { ImageUploader } from "@/components/image-uploader";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { getAttachments, getProjects } from "@/lib/data";

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const { projectId } = await searchParams;
  const [projects, attachments] = await Promise.all([getProjects(), getAttachments(projectId ? { projectId } : {})]);
  const unsorted = projectId ? attachments : attachments.filter((a) => a.projectIds.length === 0 && a.recordIds.length === 0);

  return (
    <>
      <PageHeader title="첨부" description="캡처는 기본 비공개로 저장돼요. 공개하려면 마스킹을 확인한 뒤 전환하세요." />
      <form method="get" className="mb-4 flex max-w-sm items-center gap-2">
        <select name="projectId" defaultValue={projectId ?? ""}>
          <option value="">프로젝트 미지정</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm">선택</button>
      </form>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>캡처 업로드</CardTitle>
          <ImageUploader projectId={projectId} />
        </Card>
        <Card>
          <CardTitle>링크 첨부</CardTitle>
          <LinkForm projectId={projectId} />
        </Card>
      </div>
      <Card className="mt-4">
        <CardTitle>{projectId ? "이 프로젝트의 첨부" : "미분류 첨부"}</CardTitle>
        <AttachmentGallery items={unsorted} projectId={projectId} />
      </Card>
    </>
  );
}
