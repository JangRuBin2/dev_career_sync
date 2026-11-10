import Link from "next/link";
import { redirect } from "next/navigation";
import { listCandidatePages } from "@careersync/core/notion";
import { ActionForm } from "@/components/action-form";
import { Button, Card } from "@/components/ui";
import { getUserContext } from "@/lib/context";
import { notionForUser } from "@/lib/notion-oauth";
import { setupWorkspaceAction } from "./actions";

export const dynamic = "force-dynamic";
// DB 7개 + relation + 수식 생성에 시간이 걸린다
export const maxDuration = 300;

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children?: React.ReactNode }) {
  return (
    <Card className={done ? "opacity-70" : ""}>
      <div className="flex items-center gap-2">
        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-good-soft text-good" : "bg-accent-soft text-accent"}`}>
          {done ? "✓" : n}
        </span>
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children && <div className="mt-3 text-sm">{children}</div>}
    </Card>
  );
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const ctx = await getUserContext();
  if (ctx.repo) redirect("/dashboard");

  const conn = ctx.connection;
  let pages: Awaited<ReturnType<typeof listCandidatePages>> = [];
  let pagesError: string | null = null;
  if (conn) {
    try {
      pages = await listCandidatePages(notionForUser(ctx.userId, conn));
    } catch (err) {
      console.error(err);
      pagesError = "Notion 페이지 목록을 불러오지 못했어요. 다시 연결해 주세요.";
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <p className="text-sm font-medium text-accent">CareerSync 시작하기</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">{ctx.login ? `${ctx.login} 님, ` : ""}Notion 을 연결해요</h1>
      <p className="mt-2 text-sm text-muted">기록과 이력서는 모두 내 Notion 에 저장돼요. CareerSync 는 연결한 페이지 안에서만 읽고 써요.</p>
      {error && <p className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}

      <div className="mt-6 space-y-3">
        <Step n={1} title="Notion 연결" done={Boolean(conn)}>
          {conn ? (
            <p className="text-muted">
              연결됨: <b className="text-ink">{conn.workspaceName ?? "워크스페이스"}</b> ·{" "}
              <a href="/api/notion/connect" className="text-accent">
                다시 연결
              </a>
            </p>
          ) : (
            <>
              <p className="text-muted">
                Notion 에 빈 페이지(예: <code>CareerSync</code>)를 하나 만든 뒤, 연결 화면에서 <b>그 페이지만</b> 선택하는 걸 권장해요.
              </p>
              <a href="/api/notion/connect" className="mt-3 inline-flex rounded-lg bg-ink px-4 py-2 text-sm font-medium text-bg hover:opacity-90">
                Notion 연결하기
              </a>
            </>
          )}
        </Step>

        {conn && (
          <Step n={2} title="CareerSync 를 둘 페이지 선택">
            {pagesError ? (
              <p className="text-bad">{pagesError}</p>
            ) : pages.length === 0 ? (
              <p className="text-muted">
                공유된 페이지가 없어요.{" "}
                <a href="/api/notion/connect" className="text-accent">
                  다시 연결
                </a>
                하면서 페이지를 하나 선택해 주세요.
              </p>
            ) : (
              <ActionForm action={setupWorkspaceAction} className="space-y-3">
                <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
                  {pages.map((p, i) => (
                    <li key={p.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-2">
                        <input type="radio" name="pageId" value={p.id} defaultChecked={i === 0} />
                        <span className="truncate">{p.title}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted">
                  이 페이지 아래에 CareerSync DB 7개와 이력서 페이지를 만들어요 (1분 정도). 이미 CareerSync DB 가 있는 페이지라면 그대로 이어서 써요.
                </p>
                <Button>이 페이지에 준비하기</Button>
              </ActionForm>
            )}
          </Step>
        )}
      </div>

      <div className="mt-8 flex items-center gap-2 text-xs text-muted">
        <Link href="/privacy" className="underline">
          개인정보처리방침
        </Link>
        <span>·</span>
        <form action="/api/auth/logout" method="post">
          <button className="underline">로그아웃</button>
        </form>
      </div>
    </main>
  );
}
