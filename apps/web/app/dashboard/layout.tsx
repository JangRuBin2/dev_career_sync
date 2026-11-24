import Link from "next/link";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/dashboard", label: "홈" },
  { href: "/dashboard/inbox", label: "Inbox" },
  { href: "/dashboard/projects", label: "프로젝트" },
  { href: "/dashboard/posts", label: "포스팅" },
  { href: "/dashboard/resume", label: "이력서" },
  { href: "/dashboard/upload", label: "첨부" },
  { href: "/dashboard/settings", label: "설정" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 overflow-x-auto px-4 py-3">
          <Link href="/dashboard" className="shrink-0 font-bold">
            CareerSync
          </Link>
          <nav className="flex gap-1 text-sm">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="shrink-0 rounded-md px-2.5 py-1 text-muted hover:bg-surface-2 hover:text-ink">
                {n.label}
              </Link>
            ))}
          </nav>
          <form action="/api/auth/logout" method="post" className="ml-auto shrink-0">
            <button className="text-xs text-muted hover:text-ink">로그아웃</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
