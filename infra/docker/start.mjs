/**
 * All-in-one process supervisor.
 *
 * Starts api, web, and worker as child processes in the same container.
 * Forwards SIGTERM/SIGINT to all children and exits when any one of them dies
 * so the container orchestrator (Docker, K8s) can restart the whole unit.
 *
 * Paths are fixed to the layout produced by the all-in-one Dockerfiles:
 *   /app/api/    ← pnpm deploy output of api
 *   /app/web/    ← pnpm deploy output of web
 *   /app/worker/ ← pnpm deploy output of worker
 */
import { spawn } from "node:child_process";

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:3002";

const services = [
  {
    name: "api",
    cwd: "/app/api",
    cmd: "node",
    args: ["dist/index.js"],
    env: {},
  },
  {
    name: "web",
    cwd: "/app/web",
    cmd: "node_modules/.bin/next",
    args: ["start"],
    // API_INTERNAL_URL is a runtime SSR env-var (not NEXT_PUBLIC_*),
    // so it can be set here even though the build is already done.
    env: { API_INTERNAL_URL: API_URL },
  },
  {
    name: "worker",
    cwd: "/app/worker",
    cmd: "node",
    args: ["dist/index.js"],
    env: {},
  },
];

let exiting = false;

/** @type {import("node:child_process").ChildProcess[]} */
const procs = services.map(({ name, cwd, cmd, args, env }) => {
  const p = spawn(cmd, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });

  p.on("exit", (code, signal) => {
    if (exiting) return;
    exiting = true;
    console.error(
      `[supervisor] ${name} exited (code=${code} signal=${signal}), stopping container`,
    );
    for (const proc of procs) {
      try { proc.kill("SIGTERM"); } catch { /* already dead */ }
    }
    // Give the others 5 s to flush, then hard-exit.
    setTimeout(() => process.exit(code ?? 1), 5_000).unref();
  });

  return p;
});

const shutdown = (signal) => {
  if (exiting) return;
  exiting = true;
  console.log(`[supervisor] ${signal} received, shutting down`);
  for (const p of procs) {
    try { p.kill("SIGTERM"); } catch { /* already dead */ }
  }
  setTimeout(() => process.exit(0), 5_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
