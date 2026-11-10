import Link from "next/link";
import { parseDenylist } from "@careersync/core";
import { buildTailorMaterial, renderOriginResume } from "@careersync/core/tailor";
import { TailorForm } from "@/components/tailor-form";
import { Card, CardTitle, Empty, PageHeader, formatDateTime } from "@/components/ui";
import { getAchievements, getMetrics, getProjects, getRecords } from "@/lib/data";
import { listTailored, storageLabel } from "@/lib/tailored-store";
import { tailorResumeAction } from "../../actions";

// AI 생성(서버 액션)이 이 페이지에서 실행된다
export const maxDuration = 300;

export default async function TailorPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const [projects, records, metrics, achievements, versions] = await Promise.all([
    getProjects(),
    getRecords(),
    getMetrics(),
    getAchievements(),
    listTailored(),
  ]);
  const material = buildTailorMaterial({ projects, records, metrics, achievements, denylist: parseDenylist(process.env.DENYLIST) });
  const originResume = renderOriginResume({
    profile: { name: process.env.RESUME_NAME, headline: process.env.RESUME_HEADLINE },
    projects,
    achievements,
  });

  return (
    <>
      <PageHeader
        title="공고 맞춤 이력서"
        description="원본 이력서는 그대로 두고, 공고마다 강조점과 순서를 바꾼 회사별 버전을 따로 만들어요."
        action={
          <Link href="/dashboard/resume" className="text-sm text-muted hover:text-ink">
            ← 원본 이력서
          </Link>
        }
      />
      {deleted && <p className="mb-4 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">맞춤본을 삭제했어요.</p>}

      <TailorForm material={material} originResume={originResume} action={tailorResumeAction} />

      <Card className="mt-4">
        <CardTitle>회사별 버전 ({versions.length})</CardTitle>
        {versions.length === 0 ? (
          <Empty>아직 만든 맞춤 이력서가 없어요.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {versions.map((v) => (
              <li key={v.id}>
                <Link href={`/dashboard/resume/tailor/${v.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-accent">
                  <span className="min-w-0 truncate text-sm font-medium">
                    {v.company || "회사 미기재"} <span className="font-normal text-muted">· {v.position || "포지션 미기재"}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">{formatDateTime(v.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">저장 위치: {storageLabel()}</p>
      </Card>
    </>
  );
}
