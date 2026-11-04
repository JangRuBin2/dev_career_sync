/** Slack / Discord 호환 웹훅 알림. URL 이 없으면 콘솔에만 출력 */
export async function notify(text: string, webhookUrl = process.env.NOTIFY_WEBHOOK_URL, fetchImpl: typeof fetch = fetch) {
  console.log(`[notify] ${text}`);
  if (!webhookUrl) return;
  try {
    await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Slack 은 text, Discord 는 content 를 읽는다
      body: JSON.stringify({ text, content: text }),
    });
  } catch (err) {
    console.warn("알림 전송 실패", err);
  }
}
