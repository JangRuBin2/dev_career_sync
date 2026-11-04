import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-surface p-5 ${className}`}>{children}</div>;
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold">{children}</h2>
      {action}
    </div>
  );
}

const tones = {
  neutral: "bg-surface-2 text-muted",
  accent: "bg-accent-soft text-accent",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
} as const;
export type Tone = keyof typeof tones;

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-flex items-center shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Stat({ label, value, hint, href }: { label: string; value: ReactNode; hint?: string; href?: string }) {
  const body = (
    <Card className={href ? "transition hover:border-accent" : ""}>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 truncate text-xl font-bold tabular-nums sm:text-2xl">{value}</div>
      {hint && <div className="mt-1 truncate text-xs text-muted">{hint}</div>}
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{children}</div>;
}

export function Button({
  children,
  variant = "primary",
  type = "submit",
  name,
  value,
  formAction,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  type?: "submit" | "button";
  name?: string;
  value?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const styles = {
    primary: "bg-accent text-white hover:opacity-90",
    secondary: "border border-line bg-surface hover:bg-surface-2",
    danger: "border border-line bg-surface text-bad hover:bg-bad-soft",
  }[variant];
  return (
    <button type={type} name={name} value={value} formAction={formAction} className={`inline-flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium ${styles}`}>
      {children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function formatPeriod(p: { start: string; end: string | null } | null): string {
  if (!p) return "기간 미정";
  const f = (d: string) => d.slice(0, 7).replace("-", ".");
  return `${f(p.start)} ~ ${p.end ? f(p.end) : "진행중"}`;
}

export function formatShortDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "short", day: "numeric", weekday: "short" });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" });
}

/** 첨부 이미지 표시용 URL: 공개 URL 이 있으면 그것, 없으면 인증 라우트 */
export function attachmentSrc(a: { publicUrl: string | null; blobPath: string }) {
  return a.publicUrl ?? `/api/files/${a.blobPath.split("/").map(encodeURIComponent).join("/")}`;
}
