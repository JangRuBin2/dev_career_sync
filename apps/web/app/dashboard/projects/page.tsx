import Link from "next/link";
import { Badge, Card, Empty, PageHeader, formatPeriod } from "@/components/ui";
import { getAchievements, getProjects, getRecords } from "@/lib/data";

export default async function ProjectsPage() {
  const [projects, records, achievements] = await Promise.all([getProjects(), getRecords(), getAchievements()]);
  return (
    <>
      <PageHeader title="프로젝트" description="기간·스택·공개 링크와 쌓인 기록을 한눈에 봐요." />
      {projects.length === 0 && <Empty>아직 프로젝트가 없어요.</Empty>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => {
          const recCount = records.filter((r) => r.projectIds.includes(p.id)).length;
          const achCount = achievements.filter((a) => a.projectIds.includes(p.id) && a.assignment !== "반려").length;
          return (
            <Link key={p.id} href={`/dashboard/projects/${p.id}`}>
              <Card className="h-full overflow-hidden p-0 transition hover:border-accent">
                {p.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.coverImage} alt="" className="aspect-[16/9] w-full object-cover" />
                ) : (
                  <div className="flex aspect-[16/9] items-center justify-center bg-surface-2 text-3xl">📁</div>
                )}
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="truncate font-semibold">{p.name}</h2>
                    <Badge tone={p.status === "진행중" ? "good" : "neutral"}>{p.status ?? "-"}</Badge>
                  </div>
                  <p className="text-xs text-muted">{formatPeriod(p.period)}{p.role && ` · ${p.role}`}</p>
                  <div className="flex flex-wrap gap-1">
                    {p.stack.slice(0, 5).map((s) => (
                      <Badge key={s}>{s}</Badge>
                    ))}
                  </div>
                  <div className="flex gap-3 text-xs text-muted">
                    <span>기록 {recCount}</span>
                    <span>성과 {achCount}</span>
                    {p.publicUrl && <span className="text-accent">🔗 공개 사이트</span>}
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
