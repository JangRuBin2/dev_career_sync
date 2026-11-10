import Link from "next/link";
import { getSession } from "@/lib/auth";

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const session = await getSession().catch(() => null);
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-16">
      {deleted && <p className="mb-6 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">계정을 삭제했어요. 이용해 주셔서 고마워요.</p>}
      <p className="text-sm font-medium text-accent">CareerSync</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">기록은 한 번, 이력서는 항상 최신.</h1>
      <p className="mt-3 text-muted">
        매일 남긴 업무 기록을 내 Notion 에 성과 데이터로 쌓고, 확인한 것만 이력서와 블로그로 내보내요. 채용공고를 붙여넣으면 회사별 맞춤 이력서도 만들어 줘요.
      </p>
      <ul className="mt-6 space-y-1.5 text-sm text-muted">
        <li>📝 Notion 에 2분 기록 → 매주 AI 가 성과·지표로 정리</li>
        <li>📥 성과를 어느 프로젝트에 넣을지 확인한 것만 이력서에 반영</li>
        <li>🎯 공고 맞춤 이력서 · PDF · 블로그 초안</li>
        <li>🔒 금지어 마스킹, 캡처는 기본 비공개</li>
      </ul>
      <div className="mt-8 flex flex-wrap gap-2">
        <Link href={session ? "/dashboard" : "/login"} className="inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          {session ? "대시보드 열기" : "GitHub 로 시작하기"}
        </Link>
      </div>
      <p className="mt-10 text-xs text-muted">
        <Link href="/terms" className="underline">
          이용약관
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="underline">
          개인정보처리방침
        </Link>
      </p>
    </main>
  );
}
