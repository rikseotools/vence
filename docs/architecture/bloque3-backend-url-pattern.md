# Bloque 3 — Patrón `BACKEND_URL` y exposición HTTP del backend

**Fecha:** 2026-05-23
**Status:** Decisión propuesta — pendiente aplicar Terraform cuando arranque el canary `medals`.
**Estado actual del backend:** ECR + 1 task Fargate (cluster `vence-backend`, region `eu-west-2`, cuenta `349744179687`). **Sin ALB.** SG `vence-backend-sg` sólo egress. Sólo corre crons; `/health` Nest controller listo en `backend/src/health/health.controller.ts:18` esperando un Target Group.

---

## 1. Qué decidimos aquí

Cuando el frontend Next.js (en Vercel) tenga que llamar a un endpoint que vive en el backend NestJS (en Fargate), tres preguntas:

1. **¿Cómo exponemos el backend al mundo?** (ALB, CloudFront, API Gateway, Cloudflare, …)
2. **¿Cómo se llama?** (DNS — `api.vence.es`, `backend.vence.es`, otro)
3. **¿Cómo decide el frontend a quién llamar?** (env var + feature flag por endpoint)

Las dos primeras son **infra** (Terraform de un solo `apply`). La tercera es **código** (helper de routing + uso en cada endpoint migrado).

---

## 2. Opciones evaluadas para exposición HTTP

| Opción | Coste/mes | Pros | Contras | Veredicto |
|---|---:|---|---|---|
| **A) ALB público + Route53 + ACM** | ~$17-22 | Estándar AWS, layer 7 routing, healthcheck nativo a `/health`, **agnóstico** (Azure Application Gateway / GCP HTTP LB son equivalentes) | No escala a 0 (paga idle) | ✅ **Elegido** |
| **B) CloudFront + ALB + Route53 + ACM** | ~$18-25 | Cache edge nativo, TLS edge, WAF integrable | Doble TLS, cache invalidation extra, más complejidad | Añadir encima de A) si se ve beneficio real más adelante |
| **C) API Gateway HTTP v2 + VPC Link + ALB** | ~$22-25 + $1/M req | Throttling nativo, OpenAPI, API keys | Doble billing (Gateway + ALB), VPC Link $0.50/h adicional | Overkill para un solo backend |
| **D) Cloudflare proxy delante de ALB** | ~$17 | Cache edge gratis, WAF gratis, DDoS shield | **Rompe prioridad #2** del roadmap (agnóstico de proveedor) | ❌ |
| **E) Fargate Public IP + Route53 round-robin** | ~$0.50 | Coste cero extra | IP rota en cada despliegue, sin TLS terminator, sin health-aware routing | ❌ No-go productivo |
| **F) Vercel Edge Function proxy** | $0 | Mantiene DX simple desde Vercel | El cold start de Vercel anula la ganancia de salir de Vercel | ❌ Contradice el propósito del Bloque 3 |

**Decisión: A) ALB público + Route53 + ACM.** Razones:

1. **Agnóstico**: si mañana migramos a Azure / GCP / bare metal, el frontend sólo cambia `BACKEND_URL`. ALB es Layer 7 estándar.
2. **CloudFront es aditivo**: si más adelante medimos que cache edge ayuda, se mete delante del ALB sin tocar el código.
3. **Coste razonable**: $17-22/mes vs el ROI esperado (cierre de cascades 503/504 del hot path).
4. **Healthcheck nativo** al `/health` Nest ya implementado.
5. **No necesitamos features de API Gateway** (rate limit a nivel infra; lo hacemos en código con quick-fail).

---

## 3. Nombre DNS

**`api.vence.es`** (Route53 A-record alias al ALB DNS name).

Por qué este nombre y no otro:
- `backend.vence.es` confunde — no es "el backend", es "la API". El backend es un detalle de implementación.
- `api.vence.es` es la convención más reconocible.
- Cero solapamiento con `www.vence.es` (Next.js/Vercel) ni `auth.vence.es` (Supabase Auth custom domain).

**TLS**: ACM cert para `api.vence.es` validado por DNS (Route53). Renovación automática.

---

## 4. Cambios Terraform necesarios (resumen, no se aplican hoy)

```
backend/infra/main.tf
─────────────────────
+ aws_lb                         "api"           # ALB internet-facing, eu-west-2
+ aws_lb_listener                "https"          # :443 default action forward to TG
+ aws_lb_listener                "http_redirect"  # :80 → :443
+ aws_lb_target_group            "backend"        # health_check.path = "/health", protocol = HTTP, port = 3000
+ aws_lb_listener_rule           "default"        # forward to target group
+ aws_security_group_rule        "alb_to_backend" # ingress 3000 desde ALB SG → backend SG
+ aws_security_group             "alb"            # ingress 443 desde 0.0.0.0/0
+ aws_acm_certificate            "api"            # vence-api-cert, DNS validation
+ aws_route53_record             "api_a"          # A alias → ALB DNS name
+ aws_route53_record             "api_cert_val"   # CNAME para ACM validation

aws_ecs_service.backend (modificar)
─────────────────────
  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 3000
  }
```

**Pre-requisito de Route53**: la zona `vence.es` debe existir (verificar `aws route53 list-hosted-zones --profile vence`). Si está en otro proveedor (DonDominio, etc.), añadir el record desde ahí apuntando al ALB DNS y saltarse `aws_route53_record`.

**Coste mensual estimado** (eu-west-2):
- ALB Application: ~$16.20 (730h × $0.0225/h)
- ALB LCU: ~$0.50-2 según tráfico
- Route53 hosted zone (si nueva): $0.50
- ACM: gratis
- **Total: ~$17-19/mes**

---

## 5. Patrón de consumo desde el frontend

### 5.1 Env vars

```bash
# .env.local + Vercel env (production + preview)
BACKEND_URL=https://api.vence.es

# Feature flags por endpoint — empezar todos en false
NEXT_PUBLIC_USE_BACKEND_MEDALS=false
NEXT_PUBLIC_USE_BACKEND_ANSWER_AND_SAVE=false
# (añadir uno por endpoint a medida que se migra)
```

Por qué `NEXT_PUBLIC_*` aunque el fetch lo hace el servidor:
- Para que también lo puedan leer client components que llaman a `/api/medals` directamente (caso del badge en el header).

### 5.2 Helper de routing (a implementar cuando arranque el canary medals)

```typescript
// lib/api/backend-router.ts (PROPUESTA — no aplicar hoy)
//
// Helper único para decidir si una request va al backend dedicado
// (NestJS/Fargate) o se queda en Vercel. Reversible en segundos cambiando
// la env var correspondiente.
//
// Patrón idéntico al de USE_READ_REPLICA en db/client.ts (validado
// Sprint 3 read replica).

type BackendEndpoint =
  | 'medals'
  | 'answer-and-save'
  | 'stats'
  | 'test-config'
  | 'daily-limit'

const BACKEND_URL = process.env.BACKEND_URL ?? ''

const ENABLED: Record<BackendEndpoint, boolean> = {
  medals:          process.env.NEXT_PUBLIC_USE_BACKEND_MEDALS === 'true',
  'answer-and-save': process.env.NEXT_PUBLIC_USE_BACKEND_ANSWER_AND_SAVE === 'true',
  stats:           process.env.NEXT_PUBLIC_USE_BACKEND_STATS === 'true',
  'test-config':   process.env.NEXT_PUBLIC_USE_BACKEND_TEST_CONFIG === 'true',
  'daily-limit':   process.env.NEXT_PUBLIC_USE_BACKEND_DAILY_LIMIT === 'true',
}

export function shouldRouteToBackend(endpoint: BackendEndpoint): boolean {
  return Boolean(BACKEND_URL) && ENABLED[endpoint]
}

export function backendUrlFor(endpoint: BackendEndpoint, path: string): string {
  return `${BACKEND_URL}/${path.replace(/^\/+/, '')}`
}
```

### 5.3 Patrón de uso (ejemplo `/api/medals`)

```typescript
// app/api/medals/route.ts (FUTURO — no migrar hoy)
import { shouldRouteToBackend, backendUrlFor } from '@/lib/api/backend-router'

async function _GET(request: NextRequest) {
  // Fast path: si el flag está activo, proxy al backend.
  // Mantiene rollback en segundos cambiando el flag.
  if (shouldRouteToBackend('medals')) {
    const userId = new URL(request.url).searchParams.get('userId')
    const backendRes = await fetch(
      backendUrlFor('medals', `medals?userId=${userId}`),
      { headers: { authorization: request.headers.get('authorization') ?? '' } }
    )
    return new NextResponse(backendRes.body, {
      status: backendRes.status,
      headers: backendRes.headers,
    })
  }

  // Path actual (sin cambios mientras flag esté false)
  return originalImplementation(request)
}
```

**Trade-off de este patrón**: cuando el flag está `true`, el frontend hace **dos hops** (browser → Vercel → ALB → Fargate). Latencia añadida ~30-80ms vs llamar directo desde el browser al ALB.

**Por qué aceptamos este coste**:
- Permite migrar **sin tocar el frontend** (los `fetch('/api/medals')` siguen funcionando).
- Rollback en segundos (env flag).
- Auth, CORS, headers ya resueltos en Vercel.

**Cuándo cortar el hop adicional (futuro, post-Bloque 3)**:
- Cuando todos los endpoints estén migrados y estables → cambiar fetch del cliente directo a `api.vence.es`.
- Coste de cambio: cambios de CORS + redirección de auth tokens. **No urge.**

---

## 6. Auth backend ↔ frontend

El backend NestJS necesita el mismo patrón JWT local verify que la app Next.js (Fase 0.7 completada server-side). Reusar:
- Endpoint del backend valida `Authorization: Bearer <token>` con `SUPABASE_JWT_SECRET` (env var ya disponible en Fargate vía SSM, mismo valor que Vercel).
- Si JWT inválido → 401.
- Si JWT válido → extraer `user.id` (sub) sin hacer llamada a Supabase Auth.

**Migrar** `lib/auth/verifyJwtLocal.ts` → `backend/src/auth/jwt.guard.ts` (NestJS Guard) cuando arranque el canary medals.

---

## 7. Orden de implementación cuando arranque Bloque 3

1. **Terraform `apply`** del bloque de §4 — añade ALB + Route53 + ACM. ~10 min total. **0 impacto en tráfico actual** (no hay nada en el frontend apuntando al ALB todavía).
2. **Smoke test ALB**: `curl https://api.vence.es/health` → debe devolver `{ status: 'ok' }` del Nest.
3. **NestJS Guard** para JWT local verify (port de `lib/auth/verifyJwtLocal.ts`).
4. **Migrar `/api/medals` al backend**: portar `lib/api/medals/queries.ts` a un `MedalsController` Nest. Lectura desde la misma BD (env `DATABASE_URL` ya en SSM).
5. **Helper `backend-router.ts`** en el frontend (§5.2).
6. **Modificar `app/api/medals/route.ts`** con el patrón §5.3.
7. **Canary**: `NEXT_PUBLIC_USE_BACKEND_MEDALS=true` en Vercel preview → smoke → producción.
8. **Vigilar 24-48h** logs + cascade ratio del propio endpoint y de los 8 endpoints que arrastra `answer-and-save` (debería mejorar marginalmente al quitar carga del pool primary).
9. **Si todo OK**: aplicar mismo patrón a `answer-and-save` (el keystone real).

---

## 8. Lo que NO decidimos hoy

- **Adapter Redis cross-runtime** (NestJS ↔ Vercel comparten tags). Doc aparte cuando lo abordemos.
- **Observability unificada** (`observable_events` tabla, decisión 23/05). Hace falta para cuando el backend tenga su propio logs/errors, pero no bloquea el canary medals (CloudWatch + Sentry sirven mientras tanto).
- **CI deploy del primer endpoint API** (¿Mismo workflow `Deploy backend` actual sirve? Sí — ya construye imagen, sube a ECR, fuerza redeploy de la task). No hay cambio necesario.

---

## 9. Referencias

- Audit Bloque 3: [`bloque3-audit-hot-path.md`](bloque3-audit-hot-path.md)
- Backend Etapa 1 README: [`/backend/infra/README.md`](../../backend/infra/README.md)
- Patrón validado de feature flag con fallback: `USE_READ_REPLICA` en `db/client.ts:getReadDb` (Sprint 3)
- Patrón validado de canary: cutover `/api/stats` v1→v2 (memoria `project_stats_v2_cutover_done`)
