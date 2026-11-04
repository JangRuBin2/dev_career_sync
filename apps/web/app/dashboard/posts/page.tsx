import { ActionForm } from "@/components/action-form";
import Link from "next/link";
import type { Post } from "@careersync/core/notion";
import { Badge, Button, Card, Empty, PageHeader, formatShortDate, type Tone } from "@/components/ui";
import { getPosts } from "@/lib/data";
import { updatePostSettingsAction } from "../actions";

const STATUS_TONE: Record<string, Tone> = {
  소재: "neutral",
  초안: "neutral",
  검토대기: "warn",
  검토완료: "accent",
  임시저장됨: "accent",
  발행됨: "good",
  실패: "bad",
};

/** UTC ISO → date input(KST) 값 */
function toKstDate(iso: string | null) {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function PostRow({ post }: { post: Post }) {
  const editable = post.status !== "발행됨" && post.status !== "소재";
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/dashboard/posts/${post.id}`} className="font-medium hover:text-accent">
            {post.title}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted">
            {post.status === "발행됨" ? `발행 ${formatShortDate(post.publishedAt)}` : `목표일 ${formatShortDate(post.scheduledAt)}`}
            {post.platforms.map((p) => (
              <Badge key={p}>{p}</Badge>
            ))}
            {post.velogUrl && (
              <a href={post.velogUrl} target="_blank" rel="noreferrer" className="text-accent">
                글 보기
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONE[post.status ?? ""] ?? "neutral"}>{post.status ?? "-"}</Badge>
          {post.status !== "소재" && post.status !== "발행됨" && (
            <Link href={`/dashboard/posts/${post.id}`} className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90">
              검토 · 복사
            </Link>
          )}
        </div>
      </div>
      {editable && (
        <ActionForm action={updatePostSettingsAction} showOk className="mt-3 grid items-end gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input type="hidden" name="id" value={post.id} />
          <label className="text-xs text-muted">
            발행 목표일
            <input type="date" name="targetDate" defaultValue={toKstDate(post.scheduledAt)} className="mt-1" />
          </label>
          <label className="flex items-center gap-1.5 pb-2 text-sm">
            <input type="checkbox" name="reviewed" defaultChecked={post.reviewed} /> 검토완료
          </label>
          <Button variant="secondary">저장</Button>
        </ActionForm>
      )}
    </Card>
  );
}

export default async function PostsPage() {
  const posts = await getPosts();
  const groups: { title: string; items: Post[]; hint?: string }[] = [
    {
      title: "검토 · 발행 대기",
      items: posts.filter((p) => ["검토대기", "검토완료", "실패", "임시저장됨"].includes(p.status ?? "")),
      hint: "초안을 다듬고 Markdown/HTML 을 복사해 원하는 블로그에 직접 올린 뒤, '발행 완료 기록'을 눌러 주세요.",
    },
    { title: "글감 (소재)", items: posts.filter((p) => p.status === "소재" || p.status === "초안"), hint: "포스팅 주기가 되면 가장 오래된 소재부터 초안이 자동으로 작성돼요." },
    { title: "발행됨", items: posts.filter((p) => p.status === "발행됨"), hint: "velog 글은 RSS 로 매일 자동 기록돼요." },
  ];
  return (
    <>
      <PageHeader title="블로그 포스팅" description="글 작성은 자동, 발행은 직접. velog · 티스토리 · 네이버 등 어디든 복사해서 올려요." />
      <div className="space-y-8">
        {groups.map((g) => (
          <section key={g.title} className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold">
                {g.title} ({g.items.length})
              </h2>
              {g.hint && <p className="text-xs text-muted">{g.hint}</p>}
            </div>
            {g.items.length === 0 ? <Empty>없음</Empty> : g.items.map((p) => <PostRow key={p.id} post={p} />)}
          </section>
        ))}
      </div>
    </>
  );
}
