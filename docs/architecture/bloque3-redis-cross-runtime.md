# Bloque 3 — Adapter Redis cross-runtime (Vercel ↔ Fargate)

**Fecha:** 2026-05-23
**Status:** Decisión propuesta — pendiente aplicar cuando arranque el canary `medals`.
**Contexto:** complementa [`bloque3-backend-url-pattern.md`](bloque3-backend-url-pattern.md). El backend NestJS/Fargate y la app Next.js/Vercel comparten contenido cacheable (`medals:${userId}`, `medals_ranking:*`, `user_stats:${userId}`, `questions`, `test-config`, etc.). Cuando uno escribe, el otro tiene que ver la invalidación.

---

## 1. El problema

`lib/cache/redis.ts` actual (Sprint 2, Sprint 5) usa `@upstash/redis` (REST sobre HTTPS) porque el runtime serverless de Vercel **no mantiene conexiones TCP persistentes** entre invocaciones de lambda. Funciona bien para esa restricción.

El backend NestJS/Fargate es un **proceso largo** y *podría* usar `ioredis` con TCP persistente — más eficiente (sin overhead HTTP por comando, conexión pool con pipelining).

Si lo hacemos con dos clientes distintos, surgen tres riesgos:

1. **Divergencia semántica**: serialización JSON diferente, manejo de `null` distinto, comandos no equivalentes → el value que escribe el backend lo lee Vercel como `{}` o viceversa.
2. **Caches in-memory locales que no se invalidan cross-runtime**: si el backend mete una capa in-memory `Map<key, value>` encima de Redis para evitar round-trips, cuando Vercel invalida una key NO se entera. Pub/Sub vía Upstash REST **no existe**.
3. **Doble código que mantener**: dos clientes, dos formas de serializar, dos formas de timeouts.

---

## 2. La decisión: usar `@upstash/redis` en el backend también

**Mismo paquete, mismo cliente, mismas semánticas.** El backend NestJS importa `@upstash/redis` igual que la app Next.js.

```typescript
// backend/src/cache/cache.module.ts (PROPUESTA — no implementar hoy)
import { Module } from '@nestjs/common'
import { Redis } from '@upstash/redis'
import { CacheService } from './cache.service'

@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        const url = process.env.UPSTASH_REDIS_REST_URL
        const token = process.env.UPSTASH_REDIS_REST_TOKEN
        if (!url || !token) {
          throw new Error('Redis no configurado — añadir secret en SSM')
        }
        return new Redis({ url, token })
      },
    },
    CacheService,
  ],
  exports: [CacheService],
})
export class CacheModule {}
```

`CacheService` expone exactamente los mismos métodos que `lib/cache/redis.ts`:

```typescript
// backend/src/cache/cache.service.ts (PROPUESTA)
@Injectable()
export class CacheService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async getCached<T>(key: string): Promise<T | null> { /* ... */ }
  async setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void> { /* fire-and-forget */ }
  async invalidate(key: string): Promise<void> { /* ... */ }
  async invalidateMany(keys: string[]): Promise<void> { /* ... */ }
  async getOrSet<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> { /* ... */ }
}
```

**Implementación**: copia literal del helper de `lib/cache/redis.ts` con métodos en clase NestJS. Sin singleflight inicial (el backend NO tiene el problema de N lambdas concurrentes — es UN solo proceso). Si singleflight resulta necesario más adelante, añadir entonces.

### 2.1 ¿Por qué no `ioredis` ahora si es más eficiente?

- **Vence ya gasta <100ms en Redis** por request (medido en Sprint 2). Ahorrar 5-10ms de overhead HTTP no mueve la aguja.
- `ioredis` añade gestión de conexión (reconnect, pool), failover, etc. — más superficie de bugs.
- El día que migremos a Redis self-hosted (Bloque 5, salir de Upstash), reevaluamos. Mientras tanto **YAGNI**.

### 2.2 ¿Y el in-memory cache?

**No** en la primera versión del backend. El Bloque 3 no debería añadir un nivel más de cache — el problema actual es el pool primary, no la latencia Redis. Si más adelante medimos que un `Map` in-process ahorraría latencia significativa, lo añadimos con TTL local **muy corto** (5-15s, mucho menor que cualquier invalidación cross-runtime) — así el peor caso es que un usuario ve datos stale 15s tras una invalidación, no horas.

---

## 3. Inventario de keys que el backend va a tocar (canary medals)

Cuando `/api/medals` se migre, el backend NestJS leerá/escribirá:

| Key pattern | Operación backend | Operación Vercel actual | Conflicto posible |
|---|---|---|---|
| `medals:${userId}` | GET (fresh 6h) / SET tras POST / DEL al invalidar | Idem | No — mismo formato JSON |
| `medals_ranking:{startISO}:{endISO}:v2` | GET (TTL 30d) | Idem | No — mismo formato |
| `singleflight:medals:${userId}` | — (no necesario, 1 proceso) | Para deduplicar requests concurrentes | No — keys distintas |
| `cache_metrics:medals:hit` / `:miss` | HINCRBY (mismo) | HINCRBY | No — mismo comando |

**Smoke test pre-canary**: arrancar el backend, leer una key conocida (e.g. `medals:${userOfTest}`) y comparar valor con el que sirve `lib/cache/redis.ts:getCached(...)` desde Vercel. Si idéntico → semánticas OK.

---

## 4. Invalidación cross-runtime: cómo funciona con esta decisión

**Caso normal: writer Vercel, reader backend.**
1. Usuario completa test en `/api/v2/answer-and-save` (Vercel) → en `after()` invalida `user_stats:${userId}`.
2. Próxima request a `/api/medals` (backend NestJS) hace `getCached('medals:${userId}')` → no afectado (medals tiene su propia key).
3. Próxima request a `/api/stats` (Vercel) hace `getCached('user_stats:${userId}')` → MISS → recalcula y SET → nueva value.

Sin pub/sub porque los dos siempre leen del mismo Upstash. La invalidación es coherente automáticamente.

**Caso writer backend, reader Vercel.**
1. Usuario gana medalla en `/api/medals` POST (futuro: backend NestJS) → INSERT en BD + `cacheService.invalidate('medals:${userId}')` + `cacheService.setCached('medals:${userId}', newValue, 6h)`.
2. Próxima request a `/api/medals` GET desde el badge del header (Vercel → backend) hit cache 6h. OK.
3. Si una página de Vercel también lee `medals:${userId}` directamente: hit la misma value coherente. OK.

**Sin Pub/Sub, sin in-memory cache, sin webhooks. Sólo Upstash como SoT.**

---

## 5. Lo único nuevo en infra: env vars en SSM

Para el backend en Fargate, añadir al SSM Parameter Store:

```bash
aws ssm put-parameter --name /vence-backend/UPSTASH_REDIS_REST_URL \
  --type SecureString --value 'https://...upstash.io' --region eu-west-2 --profile vence

aws ssm put-parameter --name /vence-backend/UPSTASH_REDIS_REST_TOKEN \
  --type SecureString --value '...' --region eu-west-2 --profile vence
```

Mismos valores que Vercel (no hay un "Redis del backend" separado — es **el mismo** instance compartido).

Y en `backend/infra/main.tf`, añadir las 2 entradas en el `secrets` de la task definition (líneas 84-104 ya tienen el patrón con `DATABASE_URL` y `CRON_SECRET` — copiar):

```hcl
secrets = [
  { name = "DATABASE_URL", valueFrom = "arn:aws:ssm:eu-west-2:349744179687:parameter/vence-backend/DATABASE_URL" },
  { name = "CRON_SECRET",  valueFrom = "arn:aws:ssm:eu-west-2:349744179687:parameter/vence-backend/CRON_SECRET" },
+ { name = "UPSTASH_REDIS_REST_URL",   valueFrom = "arn:aws:ssm:eu-west-2:349744179687:parameter/vence-backend/UPSTASH_REDIS_REST_URL" },
+ { name = "UPSTASH_REDIS_REST_TOKEN", valueFrom = "arn:aws:ssm:eu-west-2:349744179687:parameter/vence-backend/UPSTASH_REDIS_REST_TOKEN" },
]
```

Coste: $0 adicionales (el plan Upstash actual cubre ambos clientes).

---

## 6. Cuándo cambiar este patrón

| Disparador | Acción |
|---|---|
| Round-trip Upstash REST se vuelve cuello (>50ms p95 medido desde backend) | Evaluar `ioredis` + in-memory cache 5-15s |
| Salimos de Upstash a Redis self-hosted (Bloque 5) | Reescribir adapter con `ioredis` (TCP persistente) — Vercel mantiene cliente REST vía proxy o Upstash compat |
| Necesidad real de Pub/Sub cross-runtime (invalidación de muchas keys de golpe) | Implementar fanout vía QStash o vía tabla `cache_invalidations` con tabla outbox |

---

## 7. Lo que NO decidimos hoy (siguen pendientes)

- **`observable_events` unificada** (decisión 23/05) — backend y Vercel envían logs a la misma tabla. Doc aparte cuando arranquemos.
- **Migración del code de `lib/cache/redis.ts` a un paquete `@vence/shared/cache`** que ambos repos importen. Es deseable a medio plazo pero hoy es overkill (un solo endpoint del backend va a usar cache). Copiar el helper inicial y compartir paquete cuando haya 3+ módulos backend usando cache.

---

## 8. Referencias

- Audit Bloque 3: [`bloque3-audit-hot-path.md`](bloque3-audit-hot-path.md)
- Patrón BACKEND_URL: [`bloque3-backend-url-pattern.md`](bloque3-backend-url-pattern.md)
- Helper actual de cache: `lib/cache/redis.ts` (274 líneas)
- Sprint 2 invalidación tags: ver sección «Sprint 2 hardening cascade» en `ARCHITECTURE_ROADMAP.md`
