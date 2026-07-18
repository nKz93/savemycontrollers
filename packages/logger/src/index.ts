import pino from "pino";

/**
 * Logger applicatif structure (JSON), distinct du journal d'audit metier
 * (voir modules/audit). Les champs sensibles doivent etre redacted avant
 * tout appel de log (mots de passe, tokens, IBAN, etc.).
 */
export interface LoggerOptions {
  serviceName: string;
  level?: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
}

const REDACTED_PATHS = [
  "password",
  "*.password",
  "token",
  "*.token",
  "authorization",
  "req.headers.authorization",
  "req.headers.cookie",
];

export function createLogger(options: LoggerOptions) {
  return pino({
    name: options.serviceName,
    level: options.level ?? process.env.LOG_LEVEL ?? "info",
    redact: {
      paths: REDACTED_PATHS,
      censor: "[REDACTED]",
    },
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export type AppLogger = ReturnType<typeof createLogger>;
