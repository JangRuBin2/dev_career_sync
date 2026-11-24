import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // 서버 전용 모듈을 테스트에서 import 할 수 있게
      "server-only": path.resolve(__dirname, "test/stubs/server-only.ts"),
      "@": path.resolve(__dirname),
    },
  },
  // DB 테스트는 같은 DB 를 쓰므로 파일 간 병렬 실행을 끈다
  test: { include: ["test/**/*.test.ts"], fileParallelism: false },
});
