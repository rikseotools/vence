import { z } from 'zod';

/**
 * Esquema del entorno. Se valida al arrancar (fail-fast): si falta una
 * variable obligatoria o tiene formato inválido, el proceso NO arranca.
 *
 * Config 100% por variables de entorno (12-factor) → el proveedor de cada
 * dependencia es configuración, no código.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['error', 'warn', 'log', 'debug', 'verbose'])
    .default('log'),
  // Cadena de conexión Postgres estándar — agnóstica al proveedor
  // (Supabase / Neon / RDS / Postgres propio).
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((v) => v.startsWith('postgres'), {
      message: 'debe ser una cadena de conexión postgres://',
    }),
  // URL de la app Next.js (para llamar a su endpoint de email de admin).
  APP_BASE_URL: z
    .string()
    .min(1)
    .refine((v) => v.startsWith('http'), { message: 'debe ser una URL http(s)' })
    .default('https://www.vence.es'),
  ADMIN_EMAIL: z.string().email().default('manueltrader@gmail.com'),
  // Avisos por email de cambios BOE. Mantener en false mientras el cron corre
  // en shadow (en paralelo al de Vercel) para no duplicar emails al admin.
  BOE_NOTIFY_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  // Token Bearer para llamar a endpoints internos protegidos de la app Next.js.
  CRON_SECRET: z.string().default(''),
  // Redis (Upstash REST) — compartido con la app Next.js para coherencia
  // de invalidación cross-runtime. Ver docs/architecture/bloque3-redis-cross-runtime.md
  UPSTASH_REDIS_REST_URL: z.string().default(''),
  UPSTASH_REDIS_REST_TOKEN: z.string().default(''),
  // Email (Resend SDK directo — agnóstico, idéntico al usado por la app).
  // Si vacío, el envío de emails se desactiva (operación degradada).
  // Flag MEDALS_RUNTIME_RECALC_ENABLED='false' desactiva todo el cálculo
  // runtime del POST (gate igual que la app).
  RESEND_API_KEY: z.string().default(''),
  EMAIL_FROM_NAME: z.string().default('Vence'),
  EMAIL_FROM_ADDRESS: z.string().default('info@vence.es'),
  MEDALS_RUNTIME_RECALC_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Valida `process.env` contra el esquema. La usa ConfigModule.forRoot().
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas:\n${issues}`);
  }
  return parsed.data;
}
