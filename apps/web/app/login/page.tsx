import { redirect } from "next/navigation";
import { devBypass, safeNext } from "@/lib/session";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = "/dashboard", error } = await searchParams;
  // 로컬에서 로그인 생략이 켜져 있으면 바로 대시보드로
  if (devBypass()) redirect(safeNext(next));
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="rounded-xl border border-line bg-surface p-6">
        <h1 className="text-xl font-bold">CareerSync 로그인</h1>
        <p className="mt-1 text-sm text-muted">GitHub 계정으로 가입·로그인해요. 처음이면 계정이 자동으로 만들어져요.</p>
        {error && <p className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">로그인 실패: {error}</p>}
        <a
          href={`/api/auth/login?next=${encodeURIComponent(next)}`}
          className="mt-6 flex w-full items-center justify-center rounded-lg bg-ink px-4 py-2 text-sm font-medium text-bg hover:opacity-90"
        >
          GitHub 로 계속하기
        </a>
        <p className="mt-4 text-xs text-muted">
          계속하면{" "}
          <a href="/terms" className="underline">
            이용약관
          </a>
          과{" "}
          <a href="/privacy" className="underline">
            개인정보처리방침
          </a>
          에 동의하는 것으로 봐요.
        </p>
      </div>
    </main>
  );
}
