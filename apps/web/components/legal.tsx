import Link from "next/link";
import type { ReactNode } from "react";

export const CONTACT = () => process.env.CONTACT_EMAIL || null;
export const ISSUES_URL = "https://github.com/JangRuBin2/dev_career_sync/issues";

export function LegalPage({ title, effective, children }: { title: string; effective: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="text-sm font-medium text-accent">
        CareerSync
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted">시행일 {effective}</p>
      <div className="resume-doc mt-8 space-y-2">{children}</div>
    </main>
  );
}

export function Contact() {
  const email = CONTACT();
  return email ? (
    <a href={`mailto:${email}`}>{email}</a>
  ) : (
    <a href={ISSUES_URL} target="_blank" rel="noreferrer">
      GitHub Issues
    </a>
  );
}
