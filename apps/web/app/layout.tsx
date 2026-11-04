import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareerSync",
  description: "업무 기록을 성과 데이터·이력서·velog 로 이어주는 개인 커리어 대시보드",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
