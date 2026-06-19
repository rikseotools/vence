# Migración de caché: Upstash → AWS ElastiCache

## ✅ CUTOVER COMPLETADO (19/06/2026)
Frontend + backend corriendo en **ElastiCache** (Valkey 8.1, TLS), verificado:
CurrConnections=8, GetTypeCmds/SetTypeCmds activos, 0 errores. Recursos AWS
(eu-west-2, creados por CLI — **drift IaC**, importar a TF como follow-up):
- Replication group **`vence-cache`** (cache.t4g.micro, single-node, TLS) →
  endpoint `master.vence-cache.pcfmfa.euw2.cache.amazonaws.com:6379` (`rediss://`).
- Cache subnet group `vence-cache-subnets` (subnets del VPC de ECS).
- SG `sg-0c74ed9f516a353a9` (inbound 6379 desde frontend `sg-024a64a5807ff6e9f`
  y backend `sg-0663f77e0d44ca693`).
- Env `CACHE_PROVIDER=elasticache` + `ELASTICACHE_URL` en task defs
  vence-frontend:250 y vence-backend:24, **y en TF** (frontend.tf, main.tf) para
  durabilidad ante `terraform apply`.

**Rollback** (si hiciera falta): poner `CACHE_PROVIDER=upstash` en las task defs
(o TF) + redeploy. Upstash sigue activo. **NO cancelar Upstash** hasta tener
varios días estable en ElastiCache. **Follow-ups:** (1) importar ElastiCache+SG a
Terraform (quitar drift); (2) la canary `canary-redis-upstash` ahora prueba un
store que ya no se usa — actualizar/retirar; (3) re-tag: el backend usa
`vence-backend:latest` (mutable) → deploys futuros OK.

---
**(Histórico del plan:)**


Mover la caché (`lib/cache`) de Upstash REST a **ElastiCache (Redis TCP en-VPC)**.
Motiva: quitar el límite de ~1MB por request de Upstash (alerta "Max Request Size"),
abaratar a escala (coste plano vs pago-por-request) y alinear con la dirección
AWS-native. La app corre en **ECS Fargate** (eu-west-2), así que un nodo en el
mismo VPC es alcanzable por TCP.

## Estado (Fase 0 — HECHA)
- Caché ya **agnóstica por contrato**: interfaz `CacheSink` (`lib/cache/sink.ts`)
  + sinks `upstash` (activo) y `elasticache` (preparado, `lib/cache/sinks/`).
- Selección por env **`CACHE_PROVIDER`** (`upstash` default | `elasticache`).
- Los callers NO cambian: siguen usando `getOrSet`/`getCached`/`setCached`/…
- `ioredis` NO instalado aún (el sink lo importa con especificador variable para
  no romper `next build`). Tests: `__tests__/lib/cache/agnosticSink.test.ts`.

## Fase 1 — provisionar (necesita acceso AWS)
1. **ElastiCache**: crear un cluster Redis (OSS) o **Valkey**, nodo `cache.t4g.micro`
   (suficiente para empezar, ~12-15$/mes), Multi-AZ off al principio.
   - **Subnet group**: las MISMAS subnets privadas que las tareas ECS Fargate.
   - **Security group**: permitir inbound TCP **6379** DESDE el SG de las tareas
     Fargate (no abrir a internet).
   - TLS: si lo activas, el endpoint es `rediss://` (si no, `redis://`).
2. **`npm i ioredis`** (cliente TCP; pure-JS, Node-only — OK en el server ECS).
3. **Env en la task definition ECS**: `ELASTICACHE_URL=redis://<endpoint>:6379`
   (mantener `CACHE_PROVIDER=upstash` de momento).

## Fase 2 — cutover (rollback trivial)
1. En **un** entorno/canary: `CACHE_PROVIDER=elasticache`. Redeploy.
2. Verificar: `GET /api/admin/health/cache-stats` (hit-rate sano), latencia, y que
   no haya errores de conexión en logs ECS.
3. Si OK → `CACHE_PROVIDER=elasticache` en todo. Si mal → **volver a `upstash`**
   (un env var; el contrato hace el rollback instantáneo).
4. Tras estabilizar: bajar Upstash de plan / desconectar.

## Notas
- **Vercel NO**: ElastiCache es TCP/VPC → solo alcanzable desde ECS/Lambda-en-VPC.
  La app ya está 100% en ECS, así que sin problema. Si algún día algo corre en
  Vercel, ESE runtime tendría que seguir en Upstash (REST) o ir por un proxy.
- **Higiene independiente del proveedor**: no cachear blobs gigantes (objetos de
  preguntas completos con `content_data`/imágenes). Cachear representaciones
  ligeras (IDs) reduce coste en cualquier proveedor. (Guard de tamaño opcional en
  `setCached` si se quiere telemetría de claves grandes.)
- ioredis hace pooling y reconexión; en tareas Fargate de larga vida no hay el
  problema de connection-churn de Lambda.
