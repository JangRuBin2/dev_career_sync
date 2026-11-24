import { ActionForm } from "@/components/action-form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OPT } from "@careersync/core/notion";
import { buildExport, prePublishCheck } from "@careersync/core/publish";
import { CopyButton } from "@/components/copy-button";
import { Badge, Button, Card, CardTitle, Field, PageHeader, formatShortDate } from "@/components/ui";
import { denylistOf, requireReady } from "@/lib/context";
import { getPost, getPostMarkdown } from "@/lib/data";
import { markPublishedAction, savePostBodyAction } from "../../actions";

function ExportRow({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted">{hint}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </li>
  );
}

export default async function PostDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(id).catch(() => null);
  if (!post) notFound();
  const markdown = await getPostMarkdown(id);

  const publicHosts = (process.env.PUBLIC_IMAGE_HOSTS ?? "public.blob.vercel-storage.com").split(",").map((s) => s.trim());
  const check = prePublishCheck(post, markdown, denylistOf(await requireReady()), publicHosts);
  const ex = buildExport(post, markdown);
  const blocked = check.leaks.length > 0 || check.nonPublicImages.length > 0;

  return (
    <>
      <PageHeader
        title={post.title}
        description={`목표일 ${formatShortDate(post.scheduledAt)} · ${post.reviewed ? "검토완료" : "검토 전"}${post.platforms.length ? ` · ${post.platforms.join(", ")}` : ""}`}
        action={
          <Link href="/dashboard/posts" className="text-sm text-muted hover:text-ink">
            ← 목록
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>본문 (Markdown)</CardTitle>
          <ActionForm action={savePostBodyAction} showOk className="space-y-2">
            <input type="hidden" name="id" value={post.id} />
            <textarea name="markdown" defaultValue={markdown} rows={24} className="font-mono text-xs" />
            <Button variant="secondary">본문 저장 (Notion 반영)</Button>
          </ActionForm>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle>복사 전 점검</CardTitle>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <Badge tone={check.leaks.length ? "bad" : "good"}>{check.leaks.length ? "위험" : "OK"}</Badge>
                {check.leaks.length ? `금지어/민감 패턴: ${check.leaks.join(", ")}` : "금지어 없음"}
              </li>
              <li className="flex items-start gap-2">
                <Badge tone={check.nonPublicImages.length ? "bad" : "good"}>{check.nonPublicImages.length ? "위험" : "OK"}</Badge>
                {check.nonPublicImages.length ? `공개 저장소가 아닌 이미지 ${check.nonPublicImages.length}개 (비공개 캡처는 외부에서 안 보여요)` : "이미지 모두 공개 저장소"}
              </li>
              <li className="flex items-start gap-2">
                <Badge tone={check.todos.length ? "warn" : "good"}>{check.todos.length ? "남음" : "OK"}</Badge>
                {check.todos.length ? `TODO ${check.todos.length}개: ${check.todos.slice(0, 2).join(" / ")}` : "TODO 없음"}
              </li>
            </ul>
          </Card>

          <Card>
            <CardTitle>복사해서 올리기</CardTitle>
            {blocked && <p className="mb-2 rounded-md bg-bad-soft px-2 py-1 text-xs text-bad">위험 항목을 먼저 고친 뒤 복사하는 걸 권장해요.</p>}
            <ul className="divide-y divide-line">
              <ExportRow label="제목" hint={ex.title}>
                <CopyButton text={ex.title} />
              </ExportRow>
              <ExportRow label="태그" hint={ex.tags || "없음"}>
                <CopyButton text={ex.tags} />
              </ExportRow>
              <ExportRow label="Markdown" hint="velog · Hashnode · GitHub">
                <CopyButton text={ex.markdown} />
              </ExportRow>
              <ExportRow label="서식 있는 텍스트" hint="티스토리 · 네이버 블로그 편집기에 그대로 붙여넣기">
                <CopyButton text={ex.markdown} html={ex.html} />
              </ExportRow>
              <ExportRow label="HTML 소스" hint="티스토리 HTML 모드 · 워드프레스">
                <CopyButton text={ex.html} />
              </ExportRow>
              <ExportRow label="Markdown + front matter" hint="dev.to · 정적 블로그(Astro 등)">
                <CopyButton text={ex.markdownWithFrontMatter} />
              </ExportRow>
            </ul>
          </Card>

          <Card>
            <CardTitle>발행 완료 기록</CardTitle>
            <ActionForm action={markPublishedAction} showOk className="space-y-2">
              <input type="hidden" name="id" value={post.id} />
              <Field label="올린 곳">
                <select name="platform" defaultValue="velog">
                  {OPT.platform.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <Field label="글 URL" hint="velog 는 비워 둬도 매일 RSS 로 자동 기록돼요.">
                <input name="url" type="url" placeholder="https://" defaultValue={post.velogUrl ?? ""} />
              </Field>
              <Button variant="secondary">발행 완료로 표시</Button>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
