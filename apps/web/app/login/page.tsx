export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = "/dashboard", error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="rounded-xl border border-line bg-surface p-6">
        <h1 className="text-xl font-bold">CareerSync 로그인</h1>
        <p className="mt-1 text-sm text-muted">본인 GitHub 계정만 접근할 수 있어요.</p>
        {error && <p className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">로그인 실패: {error}</p>}
        <a
          href={`/api/auth/login?next=${encodeURIComponent(next)}`}
          className="mt-6 flex w-full items-center justify-center rounded-lg bg-ink px-4 py-2 text-sm font-medium text-bg hover:opacity-90"
        >
          GitHub 로 계속하기
        </a>
      </div>
    </main>
  );
}
