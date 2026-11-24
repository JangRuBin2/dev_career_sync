import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/legal";

export const metadata: Metadata = { title: "이용약관 · CareerSync" };

export default function TermsPage() {
  return (
    <LegalPage title="이용약관" effective="2026-11-10">
      <h2>1. 서비스</h2>
      <p>CareerSync 는 이용자의 Notion 에 업무 기록을 쌓고, 이를 바탕으로 이력서·블로그 초안을 만드는 도구를 무료로 제공합니다. 서비스 내용은 예고 없이 바뀌거나 중단될 수 있습니다.</p>

      <h2>2. 이용자의 책임</h2>
      <ul>
        <li>재직 중이거나 재직했던 회사의 기밀·고객 정보·개인정보를 기록하거나 공개하지 않을 책임은 이용자에게 있습니다. 금지어 마스킹은 보조 수단일 뿐 완전하지 않습니다.</li>
        <li>AI 가 만든 이력서·블로그 초안은 참고용 초안입니다. 사실 여부를 확인하고 제출·발행하는 것은 이용자의 책임입니다.</li>
        <li>서비스를 자동화된 방법으로 과도하게 호출하거나, 다른 이용자의 데이터에 접근하려 해서는 안 됩니다.</li>
      </ul>

      <h2>3. AI 사용 한도</h2>
      <p>AI 기능은 이용자당 월 사용 횟수에 제한이 있으며, 운영 상황에 따라 바뀔 수 있습니다.</p>

      <h2>4. 데이터</h2>
      <p>이용자의 기록은 이용자의 Notion 에 저장되며 소유권은 이용자에게 있습니다. 서비스가 보관하는 정보와 삭제 방법은 개인정보처리방침을 따릅니다.</p>

      <h2>5. 책임의 제한</h2>
      <p>서비스는 &quot;있는 그대로&quot; 제공되며, 서비스 이용으로 생긴 손해(데이터 손실, 채용 결과 등)에 대해 관련 법령이 허용하는 범위에서 책임을 지지 않습니다.</p>

      <h2>6. 문의</h2>
      <p>
        <Contact />
      </p>
    </LegalPage>
  );
}
