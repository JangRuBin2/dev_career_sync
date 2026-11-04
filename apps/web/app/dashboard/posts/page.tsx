import { ActionForm } from "@/components/action-form";
import Link from "next/link";
import { OPT, type Post } from "@careersync/core/notion";
import { Badge, Button, Card, Empty, PageHeader, formatDateTime, type Tone } from "@/components/ui";
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

/** UTC ISO → datetime-local(KST) 값 */
function toKstInput(iso: string | null) {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 16);
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
          <div className="mt-0.5 text-xs text-muted">
            예약 {formatDateTime(post.scheduledAt)}
            {post.velogUrl && (
              <>
                {" · "}
                <a href={post.velogUrl} target="_blank" rel="noreferrer" className="text-accent">
                  velog
                </a>
              </>
            )}
          </div>
          {post.error && <p className="mt-1 text-xs text-bad">{post.error}</p>}
        </div>
        <Badge tone={STATUS_TONE[post.status ?? ""] ?? "neutral"}>{post.status ?? "-"}</Badge>
      </div>
      {editable && (
        <ActionForm action={updatePostSettingsAction} showOk className="mt-3 grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
          <input type="hidden" name="id" value={post.id} />
          <label className="text-xs text-muted">
            발행 모드
            <select name="mode" defaultValue={post.mode ?? "임시저장"} className="mt-1">
              {OPT.postMode.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted">
            예약일시 (KST)
            <input type="datetime-local" name="scheduledAt" defaultValue={toKstInput(post.scheduledAt)} className="mt-1" />
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
    { title: "검토 · 예약", items: posts.filter((p) => ["검토대기", "검토완료", "실패", "임시저장됨"].includes(p.status ?? "")), hint: "검토완료 체크가 없으면 예약 시각에 임시저장만 돼요." },
    { title: "글감 (소재)", items: posts.filter((p) => p.status === "소재" || p.status === "초안"), hint: "포스팅 주기가 되면 가장 오래된 소재부터 초안이 생성돼요." },
    { title: "발행됨", items: posts.filter((p) => p.status === "발행됨") },
  ];
  return (
    <>
      <PageHeader title="velog 포스팅" description="주기적으로 초안이 생성되고, 글마다 임시저장 / 공개 / 비공개를 고를 수 있어요." />
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
