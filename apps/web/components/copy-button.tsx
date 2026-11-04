"use client";

import { useState } from "react";

/**
 * 클립보드 복사.
 * - text 만 주면 일반 텍스트
 * - html 도 주면 "서식 있는 텍스트"로 복사 → 티스토리·네이버 블로그 같은 편집기에 붙여넣으면 제목·목록·코드 서식이 유지된다
 */
export function CopyButton({ text, html, label = "복사" }: { text: string; html?: string; label?: string }) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const copy = async () => {
    try {
      if (html && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setState("done");
    } catch {
      setState("error");
    }
    setTimeout(() => setState("idle"), 1500);
  };
  return (
    <button type="button" onClick={copy} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface-2">
      {state === "done" ? "✓ 복사됨" : state === "error" ? "복사 실패" : label}
    </button>
  );
}
