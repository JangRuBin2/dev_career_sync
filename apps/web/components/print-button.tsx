"use client";

/** 브라우저 인쇄 → "PDF 로 저장". 인쇄 시에는 .print-area 만 보인다 (globals.css) */
export function PrintButton({ label = "PDF 저장" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface-2">
      {label}
    </button>
  );
}
