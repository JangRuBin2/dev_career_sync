import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";
import { PrintButton } from "@/components/print-button";
import { ResumeDocument } from "@/components/resume-document";
import { list } from "@vercel/blob";
import { renderResume } from "@careersync/core";
import { Button, Card, CardTitle, PageHeader } from "@/components/ui";
import { userPrefix } from "@/lib/blob";
import { profileOf, requireReady } from "@/lib/context";
import { getAchievements, getProjects } from "@/lib/data";
import { applyResumeAction } from "../actions";

async function history(userId: string) {
  if (!process.env.BLOB_PRIVATE_READ_WRITE_TOKEN) return [];
  try {
    const res = await list({ prefix: `${userPrefix(userId)}resume-history/`, token: process.env.BLOB_PRIVATE_READ_WRITE_TOKEN, limit: 20 });
    return res.blobs.sort((a, b) => b.pathname.localeCompare(a.pathname));
  } catch {
    return [];
  }
}

export default async function ResumePage({ searchParams }: { searchParams: Promise<{ applied?: string }> }) {
  const { applied } = await searchParams;
  const ctx = await requireReady();
  const [projects, achievements, versions] = await Promise.all([getProjects(), getAchievements(["확인됨", "새 프로젝트"]), history(ctx.userId)]);
  const markdown = renderResume({
    profile: profileOf(ctx),
    projects,
    achievements,
  });
  // 제출·PDF 용 문서에는 자동 생성 표시를 뺀다 (Notion 페이지에는 남김)
  const doc = markdown.replace(/^> CareerSync 자동 생성.*\n/m, "");
  const notionUrl = ctx.resumePageId ? `https://www.notion.so/${ctx.resumePageId.replace(/-/g, "")}` : null;

  return (
    <>
      <PageHeader
        title="이력서"
        description="확인된 성과만 모아 그려요. Inbox 에서 배정을 적용하면 자동으로 다시 반영돼요."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/resume/tailor" className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
              공고 맞춤 이력서
            </Link>
            <PrintButton />
            {notionUrl && (
              <a href={notionUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-accent">
                Notion 이력서 열기
              </a>
            )}
            <ActionForm action={applyResumeAction}>
              <Button variant="secondary">Notion 에 다시 반영</Button>
            </ActionForm>
          </div>
        }
      />
      {applied && <p className="mb-4 rounded-lg bg-good-soft px-3 py-2 text-sm text-good">✓ Notion 이력서 페이지를 갱신했어요.</p>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle action={<CopyButton text={doc} label="Markdown 복사" />}>미리보기</CardTitle>
          <ResumeDocument markdown={doc} print />
          <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
            resume-ai-toolkit 을 함께 쓴다면 이 Markdown 을 <code>origin/이력서.md</code> 로 두고, 회사별 버전은 &quot;공고 맞춤 이력서&quot;에서 만들어요.
          </p>
        </Card>
        <Card>
          <CardTitle>변경 이력</CardTitle>
          {versions.length === 0 ? (
            <p className="text-sm text-muted">아직 저장된 스냅샷이 없어요.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {versions.map((v) => (
                <li key={v.pathname} className="tabular-nums text-muted">
                  {new Date(v.pathname.split("/").pop()!.replace(".md", "")).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">스냅샷은 비공개 Blob 에 Markdown 으로 보관돼요.</p>
        </Card>
      </div>
    </>
  );
}
