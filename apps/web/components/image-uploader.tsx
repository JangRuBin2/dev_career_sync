"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Rect = { x: number; y: number; w: number; h: number };
const MAX_SIDE = 2000;

/**
 * 캡처 업로드:
 * 1) 드래그 앤 드롭 / 파일 선택 / Ctrl+V 붙여넣기
 * 2) 캔버스 위에서 드래그로 가릴 영역 지정 → 모자이크
 * 3) WebP 로 재인코딩 (EXIF 등 메타데이터 제거, 최대 2000px)
 * 원본은 브라우저 밖으로 나가지 않는다.
 */
export function ImageUploader({ projectId, recordId }: { projectId?: string; recordId?: string }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("capture");
  const [rects, setRects] = useState<Rect[]>([]);
  const [drag, setDrag] = useState<Rect | null>(null);
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return setStatus("이미지 파일만 올릴 수 있어요.");
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setImg(image);
      setRects([]);
      setFileName(file.name.replace(/\.[^.]+$/, "") || "capture");
      setStatus(null);
    };
    image.src = url;
  }, []);

  // 붙여넣기 지원
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (file) load(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [load]);

  // 렌더링 (원본 + 모자이크 + 드래그 중 사각형)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const r of rects) pixelate(ctx, r);
    if (drag) {
      ctx.strokeStyle = "#2f6fde";
      ctx.lineWidth = 3;
      ctx.strokeRect(drag.x, drag.y, drag.w, drag.h);
    }
  }, [img, rects, drag]);

  const toCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const box = canvas.getBoundingClientRect();
    return { x: ((e.clientX - box.left) / box.width) * canvas.width, y: ((e.clientY - box.top) / box.height) * canvas.height };
  };

  const upload = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    setBusy(true);
    setStatus("업로드 중…");
    try {
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.85));
      if (!blob) throw new Error("이미지 변환 실패");
      const fd = new FormData();
      fd.append("file", new File([blob], `${fileName}.webp`, { type: "image/webp" }));
      fd.append("caption", caption);
      if (projectId) fd.append("projectId", projectId);
      if (recordId) fd.append("recordId", recordId);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `업로드 실패 (${res.status})`);
      setStatus("✓ 비공개로 저장했어요. 공개하려면 갤러리에서 마스킹 확인 후 전환하세요.");
      setImg(null);
      setRects([]);
      setCaption("");
      router.refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {!img ? (
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) load(f);
          }}
          className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line px-4 py-10 text-center text-sm text-muted hover:border-accent"
        >
          <span className="text-2xl">🖼️</span>
          <span>이미지를 끌어 놓거나 클릭해서 선택, 또는 Ctrl+V 로 붙여넣기</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
        </label>
      ) : (
        <>
          <p className="text-xs text-muted">가릴 영역(회사명·고객 정보·내부 URL 등)을 드래그하세요. 모자이크 {rects.length}곳</p>
          <canvas
            ref={canvasRef}
            className="w-full cursor-crosshair touch-none rounded-lg border border-line"
            onPointerDown={(e) => {
              const p = toCanvas(e);
              e.currentTarget.setPointerCapture(e.pointerId);
              setDrag({ x: p.x, y: p.y, w: 0, h: 0 });
            }}
            onPointerMove={(e) => {
              if (!drag) return;
              const p = toCanvas(e);
              setDrag({ ...drag, w: p.x - drag.x, h: p.y - drag.y });
            }}
            onPointerUp={() => {
              if (drag && Math.abs(drag.w) > 4 && Math.abs(drag.h) > 4) setRects((r) => [...r, normalize(drag)]);
              setDrag(null);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="캡션 (예: 개선 후 응답시간 그래프)" className="min-w-0 flex-1" />
            <button type="button" onClick={() => setRects((r) => r.slice(0, -1))} className="rounded-lg border border-line px-3 py-1.5 text-sm" disabled={!rects.length}>
              되돌리기
            </button>
            <button type="button" onClick={() => setImg(null)} className="rounded-lg border border-line px-3 py-1.5 text-sm">
              취소
            </button>
            <button type="button" onClick={upload} disabled={busy} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
              비공개로 업로드
            </button>
          </div>
        </>
      )}
      {status && <p className="text-sm text-muted">{status}</p>}
    </div>
  );
}

function normalize(r: Rect): Rect {
  return { x: Math.min(r.x, r.x + r.w), y: Math.min(r.y, r.y + r.h), w: Math.abs(r.w), h: Math.abs(r.h) };
}

/** 블록 평균색으로 채우는 모자이크 (복원 불가) */
function pixelate(ctx: CanvasRenderingContext2D, r: Rect) {
  const block = Math.max(8, Math.round(Math.min(r.w, r.h) / 6));
  const x0 = Math.max(0, Math.floor(r.x));
  const y0 = Math.max(0, Math.floor(r.y));
  const w = Math.min(ctx.canvas.width - x0, Math.ceil(r.w));
  const h = Math.min(ctx.canvas.height - y0, Math.ceil(r.h));
  if (w <= 0 || h <= 0) return;
  const data = ctx.getImageData(x0, y0, w, h);
  for (let by = 0; by < h; by += block) {
    for (let bx = 0; bx < w; bx += block) {
      let rr = 0, gg = 0, bb = 0, n = 0;
      for (let y = by; y < Math.min(by + block, h); y++) {
        for (let x = bx; x < Math.min(bx + block, w); x++) {
          const i = (y * w + x) * 4;
          rr += data.data[i]!;
          gg += data.data[i + 1]!;
          bb += data.data[i + 2]!;
          n++;
        }
      }
      ctx.fillStyle = `rgb(${rr / n | 0},${gg / n | 0},${bb / n | 0})`;
      ctx.fillRect(x0 + bx, y0 + by, Math.min(block, w - bx), Math.min(block, h - by));
    }
  }
}
