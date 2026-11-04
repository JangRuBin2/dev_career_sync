import { ActionForm } from "@/components/action-form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findLeaks, parseDenylist } from "@careersync/core";
import { decidePublish, findNonPublicImages, manualPackage } from "@careersync/core/velog";
import { CopyButton } from "@/components/copy-button";
import { Badge, Button, Card, CardTitle, PageHeader, formatDateTime } from "@/components/ui";
import { getPost, getPostMarkdown } from "@/lib/data";
import { savePostBodyAction } from "../../actions";

export default async function PostDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(id).catch(() => null);
  if (!post) notFound();
  const markdown = await getPostMarkdown(id);

  const publicHosts = (process.env.PUBLIC_IMAGE_HOSTS ?? "public.blob.vercel-storage.com").split(",").map((s) => s.trim());
  const badImages = findNonPublicImages(markdown, publicHosts);
  const leaks = findLeaks(`${post.title}\n${markdown}`, parseDenylist(process.env.DENYLIST));
  const decision = decidePublish({ ...post, scheduledAt: post.scheduledAt ?? new Date(0).toISOString() }, new Date());
  const pkg = manualPackage(post, markdown);

  return (
    <>
      <PageHeader
        title={post.title}
        description={`예약 ${formatDateTime(post.scheduledAt)} · 모드 ${post.mode ?? "임시저장"} · ${post.reviewed ? "검토완료" : "검토 전"}`}
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
            <CardTitle>발행 전 점검</CardTitle>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <Badge tone={post.reviewed ? "good" : "warn"}>{post.reviewed ? "OK" : "대기"}</Badge>
                {post.reviewed ? "검토완료 — 지정한 모드로 발행돼요." : "검토 전 — 예약 시각에 임시저장만 돼요."}
              </li>
              <li className="flex items-start gap-2">
                <Badge tone={badImages.length ? "bad" : "good"}>{badImages.length ? "차단" : "OK"}</Badge>
                {badImages.length ? `공개 저장소가 아닌 이미지 ${badImages.length}개` : "이미지 모두 공개 저장소"}
              </li>
              <li className="flex items-start gap-2">
                <Badge tone={leaks.length ? "bad" : "good"}>{leaks.length ? "차단" : "OK"}</Badge>
                {leaks.length ? `금지어/민감 패턴: ${leaks.join(", ")}` : "금지어 없음"}
              </li>
              <li className="text-xs text-muted">스케줄러 판단: {decision.action === "publish" ? `${decision.mode}${decision.downgraded ? " (강등)" : ""}` : decision.reason}</li>
            </ul>
          </Card>
          <Card>
            <CardTitle action={<CopyButton text={pkg} />}>수동 발행 패키지</CardTitle>
            <p className="text-xs text-muted">API 발행이 실패하면 이 내용을 velog 편집기에 붙여넣으세요. 발행 후 RSS 동기화가 URL 을 자동으로 기록해요.</p>
            {post.error && <p className="mt-2 text-xs text-bad">최근 오류: {post.error}</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
