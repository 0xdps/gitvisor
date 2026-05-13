import pino from "pino";

const isDev = process.env["NODE_ENV"] !== "production";

/**
 * Creates a named pino logger.
 * - Development: human-readable pino-pretty output (colorized, no pid/hostname)
 * - Production: structured JSON to stdout (consumed by log aggregators)
 *
 * Log level is controlled by the LOG_LEVEL env var (default: "info").
 */
export function createLogger(name: string) {
  return pino({
    name,
    level: process.env["LOG_LEVEL"] ?? "info",
    ...(isDev
      ? {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
              ignore: "pid,hostname",
            },
          },
        }
      : {}),
  });
}

export type Logger = ReturnType<typeof createLogger>;
