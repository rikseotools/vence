# Guion — Migración de DATOS Supabase → RDS (Postgres gestionado)

> ## ✅✅ CUTOVER EJECUTADO EN PROD (2026-07-04) — la app escribe en `vence-prod` (RDS Multi-AZ)
> Método B (snapshot + delta) usado. Downtime real **~15 min**. 0 tablas incompletas verificado. Detalle
> operativo + credenciales en memoria `project_cutover_rds_prod`. **Gotchas que aparecieron en la ejecución
> real y que este guion ahora incorpora (§6):**
> 1. **Matviews NO se copian** con `pg_dump --data-only` → quedan vacías → app ve 0 preguntas/tema → TODO
>    "En desarrollo". **REFRESH MATERIALIZED VIEW obligatorio post-cutover** (3: `mv_oposiciones_activas`,
>    `topic_law_question_summary`, `topic_official_by_position`).
> 2. **NUNCA otra sesión escribiendo/migrando la BD en paralelo** — una lo hizo y vació 3 tablas en RDS tras
>    el delta (recuperadas por backfill aditivo desde Supabase congelado).
> 3. Copiar tabla grande con `SELECT` gigante → **statement_timeout de Supabase** → usar `pg_dump` streaming.
> 4. `-c "SET ..."` antes de `\copy TO STDOUT` en el ORIGEN ensucia el pipe → usar `PGOPTIONS` env.
> 5. Config de BD en **SSM** (5 params), no en el task def directo → actualizar SSM + `--force-new-deployment`.
> 6. **`ANALYZE;` database-wide obligatorio** tras la carga — sin stats frescas el planificador hace seq scans
>    → queries lentas → 503 "saturado" en /api/medals y /api/v2/answer-and-save. El ANALYZE los tumbó.


> **Estado previo (prerequisitos ya cubiertos):** el **esquema** post-C4 está probado end-to-end en el
> target real (AWS RDS 17.6) — ver `migracion-vercel-a-aws.md` §3.1 DRY-RUN 3. Fase B (auth agnóstico)
> hecha. Lo único que resta para tener la BD en AWS es **mover los datos** + **cutover**. Este documento
> es el guion operativo de esa parte.
>
> **Ancla de escala (medido 2026-07-04):** `public` = **24 GB**, 118/171 tablas con datos, muy concentrado.
> El grueso es **tracking/analytics/outbox append-only**, NO el path caliente. Esto define la estrategia.

> ## ✅ DRY-RUN COMPLETO EJECUTADO Y VERDE (2026-07-04)
> El Método B se probó **entero** contra el RDS piloto real (no teoría):
> - **Copia bulk single-stream de 21.5 GB** (todo `public` menos el backup con fecha) en **45m22s, 0 errores**
>   de dump y 0 de load (cargado con `SET session_replication_role=replica` → FKs/triggers off).
> - **Counts origen vs destino de 170 tablas:** cuadran salvo **32 con Δ pequeño y NEGATIVO** — que son
>   EXACTAMENTE las escrituras que entraron en PROD durante los 45 min de copia (app viva): todos los Δ
>   negativos y concentrados en las tablas de más escritura (`observable_events` −16.657 = firehose,
>   `user_interactions` −1.535). **Es el delta que cierra la Fase 3**, no corrupción. Valida el diseño.
> - **Secuencias:** 4/4 sincronizadas, `nextval > max` en todas (sin colisión de PK).
> - **Smoke test con el driver EXACTO de la app** (postgres-js, `prepare:false`, `options=-c statement_timeout`,
>   `sslmode=require`) contra RDS: ✅ columna generada `is_active` (100.767), ✅ **join pesado
>   topic_scope↔articles↔questions** (75.884 preguntas, 1.9s), ✅ agregación `user_article_stats` (474k/6.651
>   usuarios), ✅ **pgvector** similitud (extensions+search_path OK a nivel BD), ✅ secuencias sin colisión.
>
> **Conclusión:** el mecanismo de migración de datos y el data-layer de la app están **validados end-to-end
> en el target real**. Lo único no ejercitado es el cutover en PROD (cambio de `DATABASE_URL` + redeploy),
> que es operativo y está gated por el soak de Fase B + C4-en-prod, no por incógnitas técnicas.

---

## 1. Sizing real (medido en prod, 2026-07-04)

| Tabla | Tamaño | Filas aprox | Clase |
|---|---|---|---|
| `user_interactions` | 7.8 GB | 8.7 M | append-only (created_at) |
| `test_questions` | 4.9 GB | 1.6 M | contenido (created_at+updated_at) |
| `user_interactions_archive` | 2.5 GB | 3.1 M | **archivo, SIN PK** |
| `test_questions_outbox` | 1.2 GB | 437 k | append-only/transitoria |
| `observable_events` | 1.2 GB | 2.2 M | append-only (created_at) |
| `law_question_first_attempts` | 978 MB | 856 k | append-only (created_at) |
| `articles` | 754 MB | 54 k | contenido + **pgvector embeddings** |
| `law_question_first_attempts_pre_outbox` | 597 MB | 812 k | **artefacto pre-outbox** |
| `pwa_events` | 523 MB | 363 k | append-only (created_at) |
| `tests` | 493 MB | 107 k | contenido |
| `pwa_sessions` | 388 MB | 380 k | analytics (SIN time-col) |
| `user_question_history_v2` | 304 MB | 1.0 M | caliente mutable |

**Fuente admite replicación lógica:** `wal_level=logical`, 10 slots libres (0 en uso), rol `postgres`
tiene `REPLICATION=true` (no superuser). → **CDC es posible** (Apéndice A), pero **no es la vía elegida ahora**.

---

## 2. Decisión de método

### ✅ ELEGIDO — **Snapshot + delta incremental** (ventana de minutos)

**Por qué (a la escala actual):**
- Usa `COPY`/`pg_dump` normal por el **pooler/sesión** — camino ya probado (así sacamos el esquema).
  Sin protocolo de replicación, sin conexión RDS→Supabase directa (evita el **riesgo IPv6** del direct host).
- **Sin slots de replicación** → se elimina el modo de fallo más peligroso: *un slot que se atrasa o se
  abandona acumula WAL y llena el disco de la fuente → caída de PROD.*
- El 90% del volumen son tablas **append-only con `created_at`** → el "delta" es una query exacta
  (`WHERE created_at > :t0`). Las tablas **mutables** del path caliente son **pequeñas** → se recopian
  enteras en la ventana (segundos).
- Pocos usuarios concurrentes hoy (Manuel: "hazlo ahora que no hay usuarios") → una **ventana de
  mantenimiento nocturna de minutos** es aceptable y tiene **muchos menos modos de fallo** que CDC.

**Downtime esperado:** minutos (solo re-copia de tablas mutables pequeñas + deltas append-only + switch
de `DATABASE_URL`). El bulk (24 GB) se copia **con la app viva**, antes de la ventana.

### ⚙️ Alternativa — CDC / replicación lógica (near-zero downtime)

Downtime de segundos, pero: exige conexión de protocolo de replicación **RDS→Supabase** (host directo,
posible IPv6), gestión de slot (riesgo WAL-disk en la fuente), REPLICA IDENTITY en las 2 tablas sin PK,
y sync de secuencias igual. **Más piezas, más riesgo.** Guardado en **Apéndice A** por si el volumen o el
tráfico futuro lo justifican. Hoy no.

---

## 3. Clasificación de tablas (regla, no lista de 171)

1. **Estáticas desechables — NO migrar (o al final, sin prisa):**
   - `user_streaks_backup_20241208` — backup con fecha, **no migrar** (verificar con Manuel y luego `DROP` en origen tras cutover).
   - `law_question_first_attempts_pre_outbox` — artefacto pre-outbox, **no migrar** salvo que se quiera histórico.
   - `user_interactions_archive` (2.5 GB, sin PK) — archivo histórico; **migrar por separado, NO bloquea el cutover** (se puede copiar días después).

2. **Append-only grandes (con `created_at`) — bulk vivo + delta en ventana:**
   `user_interactions`, `observable_events`, `test_questions_outbox`, `law_question_first_attempts`,
   `pwa_events`. Delta exacto por `created_at > t0`.

3. **Contenido (grande, cambia poco):** `test_questions` (tiene `updated_at`), `articles` (pgvector),
   `tests`, `questions`. Bulk vivo; en ventana re-verificar por `updated_at`/`max(id)`.

4. **Caliente mutable pequeña — re-copiar ENTERA en la ventana:** `user_profiles`, `test_sessions`,
   `detailed_answers`, `user_streaks`, `user_question_history_v2`, `user_subscriptions`, y demás
   user-scoped. Son MB, no GB → `TRUNCATE + COPY` en segundos garantiza consistencia sin detectar updates.

> **Generar la clasificación programáticamente** (no fiarse de esta lista a mano): al ejecutar, derivar
> las clases con una query sobre `pg_class` + `information_schema.columns` (append-only = tiene created_at
> y no updated_at; mutable-pequeña = < ~50 MB; desechable = nombre `%_backup_%`/`%_pre_outbox`/`%_archive`).

---

## 4. Guion Método B — paso a paso

**Herramientas:** `pg_dump`/`psql`/`pg_restore` v17 vía `podman run --net=host pgvector/pgvector:pg17`.
Conexión Supabase en **modo sesión** (`...pooler.supabase.com:5432`, NO 6543). Conexión RDS por su endpoint.

### ✅ Precondición de CUTOVER — data-path de cliente ya agnóstico (auditado 04/07)
Los `.from` de cliente están **todos migrados** (0 restantes). Los **5 `supabase.rpc()`** que quedan en
`contexts/AuthContext.tsx` (`create_google_ads_user`, `create_meta_ads_user`, `create_organic_user`,
`check_user_access`, `activate_premium_user`) son el **`else` de `if (LIFECYCLE_VIA_API)`**, y el flag
`NEXT_PUBLIC_AUTH_LIFECYCLE_VIA_API=true` está puesto en prod (`deploy-frontend.sh` + `frontend-deploy.yml`)
→ la app usa los endpoints v2 agnósticos (`/api/v2/auth/ensure-profile`, `/api/v2/access/check`,
`/api/v2/premium/activate`, Drizzle → siguen a RDS). **✅ LIMPIEZA HECHA (04/07, sin deploy):** borrado el
`else` muerto de los 6 `supabase.rpc()` de cliente (5 en `AuthContext.tsx` + 1 en `campaignTracker.ts`) y
**eliminado el flag `LIFECYCLE_VIA_API`** (fichero `lib/auth/lifecycleFlag.ts` borrado) → path único agnóstico,
imposible reactivar Supabase apagando el flag. Cliente ahora: **0 `.from`, 1 `.rpc`** (`useTopicUnlock`, ajeno).
Ratchet `.rpc` apretado 6→1; guardrail auth-agnóstico saneado (6 entradas stale del funnel login/Fase B
retiradas). typecheck + 53 tests verdes. **Ya NO queda ningún acoplamiento de datos de cliente a Supabase.**

### Fase 0 — Preparar el target (una vez)
- RDS provisionado + **receta de setup** aplicada (roles + extensiones) — ver `migracion-vercel-a-aws.md`.
- **Esquema post-C4 cargado** (dump `--schema=public` con stubs auth.* → aplicar draft C4 → tirar stubs).
  Para datos, el esquema debe existir **sin** las FKs/constraints frenando el orden de carga → ver Fase 2.

### Fase 1 — Bulk copy CON LA APP VIVA (sin downtime)
Anotar `t0 = now()` **en la fuente** antes de empezar (marca para el delta).
Copiar cada tabla (excepto las desechables) con `COPY`; paralelizar por tabla. Estrategia por clase:
- Append-only y contenido grande: copia total (son la mayoría del volumen, se copian una vez aquí).
- `articles`: **validar pgvector** — los `vector` se serializan como texto en `COPY`; RDS tiene pgvector 0.8 → entra bien (validado en Fase de piloto).

```bash
# patrón por tabla (data-only, sin owner/privilegios)
podman run --rm --net=host pgvector/pgvector:pg17 \
  pg_dump "$SESSION_URL" --data-only --no-owner --table=public.<tabla> \
  | podman run --rm --net=host -i pgvector/pgvector:pg17 psql "$RDS_URL" -v ON_ERROR_STOP=1
```
> **Throughput medido en el piloto (04/07):** ~**8.5 MB/s** por stream single-thread (513 MB de `articles`
> en 60 s por el pipe `pg_dump | psql` a través del pooler). → 24 GB ≈ **48 min** single-thread; con **4-8
> streams en paralelo** (por tabla) baja a ~**6-12 min** de bulk, TODO con la app viva. Las 4 tablas > 1 GB
> (`user_interactions` 7.8G, `test_questions` 4.9G, `user_interactions_archive` 2.5G, `test_questions_outbox`
> 1.2G) dominan → arrancarlas primero y vigilar su avance. El COPY masivo NO cuenta como downtime.

### Fase 2 — Orden de carga / constraints
`pg_dump --data-only` emite los `COPY` **sin** ordenar por dependencias de FK. Dos opciones:
- **(preferida)** cargar con las **FKs deshabilitadas** y re-validarlas al final:
  `SET session_replication_role = replica;` antes de los `COPY` en RDS (desactiva triggers+FKs),
  luego `RESET` y `VALIDATE CONSTRAINT` / recuento. Evita el problema de orden por completo.
- o restaurar el esquema **sin** FKs, cargar, y **añadir las FKs después** (más manual).

### Fase 3 — Ventana de mantenimiento (downtime = minutos)
1. **Cortar escrituras**: poner la app en mantenimiento o escalar el backend de escritura a 0
   (mejor: un flag `READONLY`/página de mantenimiento; con pocos usuarios, un aviso basta).
2. Anotar `t1 = now()` en la fuente.
3. **Delta append-only**: por cada tabla clase-2/3, copiar `WHERE created_at > t0`
   (`\copy (SELECT ... WHERE created_at > 't0') TO ...` → `\copy <tabla> FROM ...`).
4. **Re-copia mutables pequeñas** (clase 4): `TRUNCATE <tabla>; COPY` completo (segundos).
5. **Sincronizar secuencias** (crítico — logical/dump NO las trae al día):
   ```sql
   -- en RDS, por cada secuencia (usar COALESCE(...,1): las secuencias tienen mínimo 1,
   -- setval a 0 en una tabla vacía ERROR "out of bounds"):
   SELECT setval(seqname, COALESCE((SELECT max(<col>) FROM <tabla>), 1), true) ...
   ```
   Generar el conjunto de `setval` desde `pg_sequences` + su tabla/columna dueña (join por `pg_depend`).
   En Vence hoy son **4 secuencias** (`stats_drift_log`, `test_questions_outbox`, `trigger_logs`,
   `user_article_stats_pre_outbox`) — validado que tras el sync `nextval > max` (sin colisión de PK).
6. **`ANALYZE;` database-wide** (OBLIGATORIO — tras una carga masiva las estadísticas del planificador
   están vacías → planes malos (seq scans) → queries lentas → **503 "Servicio saturado"** en `/api/medals`,
   `/api/v2/answer-and-save`, etc.). ~90s. Cazado en la ejecución real: los 503 cayeron en picado tras el
   ANALYZE. (El autovacuum lo haría solo con el tiempo, pero deja una ventana de saturación al arrancar.)
6b. **REFRESH de las vistas materializadas** (OBLIGATORIO — no se copian con `--data-only`, quedan
   `relispopulated=f` → app ve 0 preguntas → todo "En desarrollo"): `REFRESH MATERIALIZED VIEW
   public.mv_oposiciones_activas; ... topic_law_question_summary; ... topic_official_by_position;`.
7. **Cutover**: actualizar los **5 params SSM** de BD → RDS (`/vence-frontend/{DATABASE_URL,
   DATABASE_URL_REPLICA,DATABASE_URL_SELF_POOLER}` + `/vence-backend/{DATABASE_URL,DATABASE_URL_SELF_POOLER}`)
   y **`aws ecs update-service --force-new-deployment`** en ambos servicios (los secrets se leen al arrancar
   la task). **Fase B ya desacopló auth** → no hay que tocar el emisor de tokens.
8. **Escalar ECS de vuelta** (frontend→2, backend→1) y **reabrir escrituras.**

### Fase 4 — Verificación (antes de dar por bueno el cutover)
- **Recuento por tabla** origen vs destino (`SELECT count(*)`), tolerancia 0 en mutables, `>=` en
  append-only (pueden haber entrado filas tras t1 si la app siguió; idealmente 0 si el corte fue limpio).
- **Checksums de muestra** en tablas de contenido (`md5(string_agg(...))` sobre PK ordenada, muestra).
- **pgvector**: `SELECT count(*) FROM articles WHERE embedding IS NOT NULL` origen==destino + una query
  de similitud de prueba.
- **Smoke funcional**: login, hacer un test, guardar respuesta, ver progreso, panel admin.
- **Secuencias**: insertar 1 fila de prueba en una tabla con secuencia y confirmar que no colisiona.
- **🔴 Conectividad del BACKEND a RDS (no solo `psql`):** un smoke con `psql` desde una IP whitelisteada
  puede pasar mientras el **backend (otro Security Group) NO conecta**. Verificar en los **logs del backend**
  (`/ecs/vence-backend`) que NO hay `CONNECT_TIMEOUT` y que corre un cron/INSERT real contra RDS. Ver el
  gotcha del Security Group en §6 — fue un incidente real el 04/07/2026.

### Fase 5 — Post-cutover
- Migrar `user_interactions_archive` (2.5 GB) en diferido si no se hizo.
- Vigilar errores 5xx / latencia (`/admin/salud-sistema`) 24-48 h.
- **Rollback** (ver §5) disponible hasta confirmar estable; luego decomisionar Supabase.

---

## 5. Rollback

El cutover es **solo un cambio de `DATABASE_URL` + redeploy**. Mientras Supabase siga vivo y con las
escrituras que tuviera hasta t1:
- **Rollback inmediato** (durante la ventana, antes de reabrir escrituras): revertir `DATABASE_URL` a
  Supabase + redeploy. Coste ~1 redeploy. Sin pérdida (no hubo escrituras nuevas en RDS).
- **Rollback tardío** (ya con escrituras en RDS): implica reconciliar el delta RDS→Supabase. Por eso la
  ventana debe verificarse **antes** de reabrir escrituras; no reabrir hasta que Fase 4 esté verde.

**Regla:** no `DROP` nada en Supabase hasta 48-72 h estable en RDS.

---

## 6. Gotchas (medidos / conocidos)

- **Pooler ≠ replicación / dump:** el puerto **6543** (transaction) NO sirve para `pg_dump` ni protocolo
  de replicación. Usar **5432** (session). El direct host `db.<ref>.supabase.co` puede ser IPv6-only.
- **Slot abandonado = disco lleno en la FUENTE** (solo aplica a CDC/Apéndice A). Si se usa: monitorizar
  `pg_replication_slots.confirmed_flush_lsn` y **dropear el slot** pase lo que pase.
- **Secuencias NO se replican ni en logical ni en dump `--data-only`** → sync manual con `setval` (Fase 3.5).
  Olvidarlo = colisiones de PK al primer INSERT tras cutover.
- **2 tablas sin PK** (`user_interactions_archive`, `user_streaks_backup_20241208`): irrelevante para el
  snapshot (COPY no necesita PK); solo importaría para CDC (REPLICA IDENTITY FULL).
- **`SET session_replication_role = replica`** para saltar FKs/triggers en la carga — **RESET** al acabar
  y **VALIDATE** las FKs, o quedan constraints NOT VALID.
- **pgvector en COPY:** los `vector` viajan como texto; RDS tiene pgvector 0.8 → sin problema (validado:
  54.785 filas / 23.998 embeddings de `articles`, origen==destino, 0 errores, ~8.5 MB/s por el pipe).
- **🔴 pgvector search_path (cazado en piloto):** pgvector va en schema `extensions`; Supabase incluye
  `extensions` en el search_path por defecto, RDS NO → el operador `<->` NO resuelve y las **búsquedas
  vectoriales de la app rompen**. Fix (parte de la receta de setup): `ALTER DATABASE <db> SET search_path
  = "$user", public, extensions;`. Verificado: con el ALTER, la similitud sobre `articles` funciona.
- **Triggers de materialización** (contadores, streaks) en las tablas destino: al cargar en bulk se
  dispararían si no se usa `session_replication_role=replica`. Con él, NO se disparan → tras la carga,
  **re-materializar** los agregados que dependían de ellos (o confiar en que los datos ya traen el estado).
- **🔴 Security Group de RDS: whitelistear el SG del BACKEND, no solo el del frontend (incidente 04/07/2026):**
  la RDS (`vence-prod`, SG `sg-04628bd6a17efdd20`) tenía ingress `5432` desde `vence-frontend-sg`
  (`sg-024a64a5807ff6e9f`) + una IP pública, pero **faltaba `vence-backend-sg`** (`sg-0663f77e0d44ca693`).
  Resultado: el frontend y `psql` desde la IP whitelisteada conectan, pero el **backend (radar, outbox,
  rankings) da `CONNECT_TIMEOUT` continuo** — degradación silenciosa (HTTP responde; las ops de BD fallan)
  que un smoke con `psql` NO detecta. Mismo VPC, RDS `PubliclyAccessible=true`; el fallo era solo la regla.
  Fix (reversible): `aws ec2 authorize-security-group-ingress --group-id sg-04628bd6a17efdd20 --protocol tcp
  --port 5432 --source-group sg-0663f77e0d44ca693 --profile vence --region eu-west-2`.
  **⚠️ La RDS y su SG NO están en `backend/infra/*.tf`** (el Terraform gestiona ECS/ALB/SGs de la app, no la
  RDS ni su SG — no hay `aws_db_instance` ni en el tfstate). → Esta regla es **manual / fuera de IaC**:
  persistirla donde se gestione la RDS (o meter la RDS en Terraform) o quedará como drift a re-añadir tras
  cualquier recreación. Regla general: RDS debe permitir 5432 desde **TODOS** los SG que conectan (frontend
  **y** backend), no solo el primero que se probó.

---

## Apéndice A — CDC / replicación lógica (si se opta por near-zero downtime)

1. **Red**: RDS (subscriber) debe alcanzar el **primary de Supabase** por protocolo de replicación
   (host directo, NO pooler). Verificar IPv4/IPv6 + reglas de salida del VPC.
2. En Supabase: `REPLICA IDENTITY FULL` en las 2 tablas sin PK (o excluirlas de la publicación);
   `CREATE PUBLICATION vence_migr FOR ALL TABLES;` (o lista explícita sin las desechables).
3. En RDS: `CREATE SUBSCRIPTION vence_sub CONNECTION '<direct supabase>' PUBLICATION vence_migr;`
   → hace **copia inicial** (24 GB por la red) + **stream** de cambios.
4. Esperar a que el lag → 0 (`pg_stat_subscription`). Ventana: cortar escrituras, confirmar lag 0,
   **sync de secuencias** (igual que Método B — logical NO las trae), cutover `DATABASE_URL`, reabrir.
5. **Limpieza obligatoria**: `DROP SUBSCRIPTION` en RDS y confirmar que el **slot desaparece en Supabase**
   (si no, `pg_drop_replication_slot` manual) — un slot vivo sigue reteniendo WAL.

> **Riesgo dominante de A:** el slot. Si la copia inicial o el stream se atasca y el slot no avanza,
> Supabase acumula WAL hasta llenar disco → incidente en PROD. Método B no tiene esta clase de fallo.

---

## Orden de ejecución (resumen)

`(soak Fase B) → aplicar C4 en prod → target definitivo Multi-AZ + setup + esquema post-C4 →`
`Método B: bulk vivo (t0) → ventana [corte, delta, mutables, secuencias, cutover, verificar] → reabrir →`
`archive en diferido → vigilar 48-72 h → decomisionar Supabase.`
