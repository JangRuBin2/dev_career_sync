import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/legal";

export const metadata: Metadata = { title: "개인정보처리방침 · CareerSync" };

export default function PrivacyPage() {
  return (
    <LegalPage title="개인정보처리방침" effective="2026-11-10">
      <p>CareerSync(이하 &quot;서비스&quot;)는 이용자의 업무 기록을 이력서·블로그 초안으로 정리하는 도구입니다. 서비스가 처리하는 정보와 그 목적은 다음과 같습니다.</p>

      <h2>1. 수집하는 정보</h2>
      <ul>
        <li>
          <b>GitHub 로그인 정보</b>: GitHub 사용자 ID, 아이디(login), 프로필 이미지 URL — 계정 식별
        </li>
        <li>
          <b>Notion 연결 정보</b>: 액세스·갱신 토큰(암호화 저장), 워크스페이스 ID·이름, 이용자가 선택한 페이지와 그 아래 데이터베이스 ID — 이용자의 Notion 에 기록을 읽고 쓰기 위함
        </li>
        <li>
          <b>설정</b>: 이력서 이름·한 줄 소개, 금지어 목록(암호화), velog 아이디, 알림 웹훅 URL(암호화), 포스팅 주기
        </li>
        <li>
          <b>이용 기록</b>: AI 기능 사용 횟수, 자동 작업 실행 결과(성공/실패 메시지)
        </li>
        <li>
          <b>이용자가 올린 파일</b>: 캡처 이미지(기본 비공개), 이력서 스냅샷, 공고 맞춤 이력서(공고 원문 포함)
        </li>
      </ul>
      <p>업무 기록·성과·이력서 본문은 서비스 서버가 아니라 <b>이용자의 Notion</b> 에 저장됩니다. 서비스는 화면 표시를 위해 최대 5분간 캐시합니다.</p>

      <h2>2. AI 처리</h2>
      <p>
        주간 정리·블로그 초안·공고 맞춤 이력서 기능을 쓰면, 해당 기록과 공고 내용이 Anthropic 의 Claude API 로 전송됩니다. 전송 전에 이용자가 설정한 금지어와 이메일·전화번호·IP·내부 URL·토큰 패턴을 가립니다. 회사 기밀을 기록하지 마세요.
      </p>

      <h2>3. 처리를 맡기는 곳 (수탁자)</h2>
      <ul>
        <li>Vercel Inc. — 서비스 호스팅, 파일 저장(Blob)</li>
        <li>Neon Inc. — 계정·설정 데이터베이스</li>
        <li>Anthropic PBC — AI 기능 처리</li>
        <li>Notion Labs Inc. — 이용자의 기록 저장 (이용자 본인 계정)</li>
        <li>GitHub Inc. — 로그인</li>
        <li>이용자가 설정한 경우: Slack / Discord (알림), velog (RSS 읽기)</li>
      </ul>

      <h2>4. 보관 기간과 삭제</h2>
      <p>
        정보는 계정을 삭제할 때까지 보관합니다. <b>설정 → 계정 삭제</b> 를 누르면 계정·설정·이용 기록·업로드한 파일이 즉시 삭제되고 Notion 토큰이 폐기됩니다. 이용자의 Notion 에 저장된 기록은 이용자가 직접 관리합니다.
        Notion 연결만 끊으려면 설정의 &quot;연결 해제&quot; 또는 Notion 의 연결 관리에서 해제할 수 있습니다.
      </p>

      <h2>5. 보호 조치</h2>
      <ul>
        <li>Notion 토큰·금지어·웹훅 URL 은 AES-256-GCM 으로 암호화해 저장합니다.</li>
        <li>캡처 이미지는 기본 비공개이며, 이용자가 &quot;마스킹 확인&quot; 후 공개로 바꾼 것만 공개 URL 이 생깁니다.</li>
        <li>각 이용자는 본인의 데이터에만 접근할 수 있습니다.</li>
      </ul>

      <h2>6. 문의</h2>
      <p>
        개인정보 관련 문의: <Contact />
      </p>
    </LegalPage>
  );
}
