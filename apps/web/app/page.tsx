import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-16">
      <p className="text-sm font-medium text-accent">CareerSync</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">기록은 한 번, 이력서는 항상 최신.</h1>
      <p className="mt-3 text-muted">
        매일 남긴 업무 기록을 성과 데이터로 쌓고, 확인한 것만 이력서와 velog로 내보내는 개인 대시보드예요.
      </p>
      <div className="mt-8">
        <Link href="/dashboard" className="inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          대시보드 열기
        </Link>
      </div>
    </main>
  );
}
