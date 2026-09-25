import { utilities, WinstonModuleOptions } from 'nest-winston';
import { format, transports } from 'winston';

/**
 * Most to least severe. Winston's default npm levels lack `fatal`, which Nest's `LoggerService` (and so
 * nest-winston) emits; without it, winston drops those entries with "Unknown logger level: fatal".
 */
export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const WINSTON_LEVELS: Record<LogLevel, number> = Object.fromEntries(
  LOG_LEVELS.map((level, severity) => [level, severity]),
) as Record<LogLevel, number>;

const DEFAULT_LOG_LEVEL: LogLevel = 'info';

const isLogLevel = (value: unknown): value is LogLevel =>
  typeof value === 'string' && (LOG_LEVELS as readonly string[]).includes(value);

/**
 * Winston options shared by the app logger and the injectable `WINSTON_MODULE_NEST_PROVIDER`.
 * - `LOG_LEVEL`: one of {@link LOG_LEVELS}; missing or unknown values fall back to `info`.
 * - `NODE_ENV=production`: one JSON object per line (for log shipping); otherwise Nest-style pretty output.
 */
export function createWinstonOptions(env: NodeJS.ProcessEnv = process.env): WinstonModuleOptions {
  const level = env.LOG_LEVEL?.trim().toLowerCase();
  const production = env.NODE_ENV === 'production';

  return {
    levels: WINSTON_LEVELS,
    level: isLogLevel(level) ? level : DEFAULT_LOG_LEVEL,
    format: production
      ? format.combine(format.timestamp(), format.errors({ stack: true }), format.json())
      : format.combine(
          format.timestamp(),
          format.errors({ stack: true }),
          utilities.format.nestLike('ClaimsApi', { colors: true, prettyPrint: true }),
        ),
    transports: [new transports.Console()],
  };
}
