/**
 * Claude API 연결 확인 (curl "Hello, world" 테스트와 같은 역할)
 *   pnpm check:claude
 */
import { CREDENTIAL_LABEL, DEFAULT_MODEL, createAnthropic, credentialSource } from "@careersync/core/llm";
import { run } from "./env";

run(async () => {
  const client = createAnthropic();
  console.log(`인증 방식: ${CREDENTIAL_LABEL[credentialSource()]}`);
  console.log(`모델: ${DEFAULT_MODEL}`);
  const res = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 1024,
    output_config: { effort: "low" },
    messages: [{ role: "user", content: "Hello, world" }],
  });
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  console.log(`응답(${res.stop_reason}): ${text.slice(0, 200)}`);
  console.log(`토큰: 입력 ${res.usage.input_tokens} / 출력 ${res.usage.output_tokens}`);
  console.log("✔ Claude 연결 OK");
});
