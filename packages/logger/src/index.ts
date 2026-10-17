import { createRequire } from "node:module";
import pino from "pino";
import type { DestinationStream } from "pino";

const require = createRequire(import.meta.url);
const isDev = process.env["NODE_ENV"] !== "production";

/**
 * pino's worker transport crashes on Node 24 inside the pnpm layout
 * ("this should not happen"). Write pretty output on the main thread instead.
 */
function devStream(): DestinationStream | undefined {
  try {
    const loaded = require("pino-pretty") as
      | ((opts: Record<string, unknown>) => DestinationStream)
      | { default?: (opts: Record<string, unknown>) => DestinationStream };
    const factory = typeof loaded === "function" ? loaded : loaded.default;
    if (!factory) return undefined;
    return factory({
      colorize: true,
      translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
      ignore: "pid,hostname",
    });
  } catch {
    return undefined;
  }
}

/**
 * Creates a named pino logger.
 * - Development: human-readable pino-pretty output (colorized, no pid/hostname)
 * - Production: structured JSON to stdout (consumed by log aggregators)
 *
 * Log level is controlled by the LOG_LEVEL env var (default: "info").
 */
export function createLogger(name: string) {
  const stream = isDev ? devStream() : undefined;
  return pino(
    {
      name,
      level: process.env["LOG_LEVEL"] ?? "info",
    },
    stream,
  );
}

export type Logger = ReturnType<typeof createLogger>;
