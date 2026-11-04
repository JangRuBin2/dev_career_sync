/**
 * 모노레포 루트의 .env 를 읽은 뒤 next 를 실행한다 (Windows 포함).
 *   node scripts/with-root-env.mjs dev
 *   node scripts/with-root-env.mjs start
 *
 * - jobs 와 같은 루트 .env 파일 하나로 대시보드까지 관리하기 위함
 * - 이미 설정된 환경변수(셸, Vercel)는 덮어쓰지 않는다
 * - Vercel 빌드는 이 스크립트를 쓰지 않는다 (next build 직접 실행)
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = path.resolve(appDir, "../..");
const [command = "dev", ...args] = process.argv.slice(2);

const { loadedEnvFiles } = nextEnv.loadEnvConfig(rootDir, command === "dev", { info() {}, error: console.error });
if (loadedEnvFiles.length) console.log(`- Root env: ${loadedEnvFiles.map((f) => f.path).join(", ")}`);

const nextBin = createRequire(path.join(appDir, "package.json")).resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, command, ...args], { cwd: appDir, stdio: "inherit", env: process.env });
child.on("exit", (code, signal) => (signal ? process.kill(process.pid, signal) : process.exit(code ?? 0)));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
