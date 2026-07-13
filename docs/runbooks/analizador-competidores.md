# Runbook — Analizador de Competidores

**Cuándo seguir este runbook:** cuando Manuel diga *"añade el competidor X"*, *"quién prepara la oposición Y"*, *"compara precios de competidores"*, *"actualiza/re-sincroniza competidores"*, *"qué oposiciones no cubrimos que ellos sí"* (gaps), *"revisa la señal/señales de competidores"*, o similar. Seguir esto ANTES de improvisar.

> 🎯 **"Revisa la señal de competidores"** = triar las señales `sensor_type='competitor'` de `oep_detection_signals` (Capa 3 del radar: gaps con ≥2 competidores). No basta con anotar el curso: **cada gap nuevo se investiga hasta el catálogo** siguiendo el **§7 (último paso)**. Cierre en `/admin/oep-signals` (`applied`/`dismissed`), igual que el resto de sensores OEP.

Diseño/arquitectura: `docs/roadmap/analizador-competidores.md`. Memoria: `project_analizador_competidores.md`.

> ⚠️ **BD = RDS, nunca Supabase.** Todo el tooling usa `DATABASE_URL` de `.env.local` (RDS `vence-prod`), con `ssl:{rejectUnauthorized:false}`. Ver `feedback_todo_agnostico_bd_nunca_supabase`.

---

## 0. Qué es y dónde vive

Subsistema que cataloga, por cada competidor, **qué oposiciones prepara, a qué precio, y qué cambia**. La **oposición es el nexo** con el radar de señales (`competitor_courses.oposicion_id` = `oep_detection_signals.oposicion_id` → misma `oposiciones`).

- **Backend:** `backend/src/competitors/` — `competitors.schema.ts`, `competitor-queries.service.ts`, `competitor-sync.service.ts` (motor), `competitors.cron.ts` (@Cron 05:00 UTC, antes del radar), `adapters/` (**1 fichero por competidor**), `sitemap.ts`, `tech-detect.ts`.
- **Radar:** `backend/src/radar/layers/competitors/from-competitor-db.ts` (la Capa 3 lee del competitor-DB).
- **Tablas:** `competitors`, `competitor_sources` (N fuentes/competidor + last_hash), `competitor_urls` (todas las URLs + content_hash), `competitor_courses` (1 por oposición; `oposicion_id` NULL = **gap**), `competitor_prices` (kind×audience×period×**plan** + histórico via is_current), `competitor_changes` (log).
- **Panel:** `/admin/competidores` con pestañas **Por oposición** (buscador global + gaps), **Competidores**, **Revisión** (confirmar matches dudosos), **Cambios** (triaje de señales). Endpoints `app/api/admin/competidores/{,/oposicion,/changes-count,/search,/review,/changes}`. Queries `lib/api/competitors/queries.ts`.
- **Deploy (⚠️ MANUAL, GHA auto-deploy DESACTIVADO — ver `docs/runbooks/pusheo-revision-despliegue.md`):** backend `scripts/deploy-backend.sh` (build podman → ECR → ECS `:NN` → smoke `api.vence.es/health`); frontend `scripts/deploy-frontend.sh` (build → ECS + assets a S3). Ambos con `AWS_PROFILE=vence AWS_REGION=eu-west-2`. El matcher/sync/cron viven en el backend; el panel/badge/triaje en frontend (Next.js).

---

## 1. Añadir un competidor nuevo (tarea principal)

### 1a. Reconocimiento (curl con UA de navegador, respetar robots.txt)
UA: `Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0`. Para muchos competidores a la vez, **lanzar agentes en paralelo** (uno por dominio). Determinar:
1. **Tech/WAF:** ¿WordPress/WooCommerce/PrestaShop/Framer/Next.js/custom? ¿Cloudflare? ¿el UA-bot pasa (200 con HTML real) o hay challenge? ¿server-rendered o **JS/SPA/Firebase**?
2. **Fuente:** el sitemap que lista las oposiciones/cursos (`robots.txt`, `/sitemap.xml`, `/sitemap_index.xml`, hijos `*-sitemap.xml`, `oposiciones-sitemap`, `product-sitemap`, `wp-sitemap-posts-course`). URL exacta + nº de URLs.
3. **Patrón de URL** de una hoja de oposición (para `classifyUrl`) y cómo distinguir hoja de categoría (profundidad de segmentos).
4. **Server-rendered:** ¿el nombre está en el HTML (`<h1>`/`<title>`/JSON-LD) o es JS?
5. **Precio:** ¿€ / matrícula / cuota / suscripción / JSON-LD en la página? Valor real, o "no público / JS".
6. **Región y tipo** (`academia_presencial | plataforma_online | hibrida`; editorial → usar plataforma_online + `techHints:{model:'editorial'}`).

### 1b. Decidir estrategia
- **Server-rendered + sitemap de oposiciones** → adapter completo con `parseCourse`.
- **JS/SPA/Firebase** (opomaster, opositatest, adams-precio dinámico) → catalogar lo que se pueda por fetch plano; **precio/lo-JS por headless** → `techHints:{rendering:'js'}`. **NO inventar precios.**
- **Cloudflare que BLOQUEA** (challenge/403) → register-only + `rendering:'js'` (headless).
- **Sin sitemap / agregador-directorio** (canaloposiciones) → register-only con nota; encaja mejor en el radar que como competidor de cursos.

### 1c. Escribir el adapter (`backend/src/competitors/adapters/<key>.ts`)
Contrato `CompetitorAdapter` (`adapters/types.ts`): `key` (== `competitors.slug`), `name`, `baseUrl`, `tipo`, `region`, `classifyUrl(url)`, `parseCourse(url, html)`, opcional `techHints`, `discoverUrls(html)` (para fuentes `listing_html` si no hay sitemap). Helpers en `adapters/_shared.ts` (`titleCase`, `nameFromSlug`, `nameFromTitle`, `stripTags`). `parseCourse` devuelve `{rawName, modalidad, region, prices:[]}`. Para **precios** ver §4.
Registrar en `adapters/registry.ts` + escribir `.spec.ts` (classifyUrl hoja/categoría + parseCourse nombre; adams testea el JSON-LD).

### 1d. Seed (migración `supabase/migrations/2026XXXX_competitor_<key>.sql`)
```sql
INSERT INTO public.competitors (slug, name, base_url, tipo, region) VALUES (...)
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.competitor_sources (competitor_id, source_type, url)
SELECT id, 'sitemap'|'sitemap_index'|'listing_html', '<url>' FROM public.competitors WHERE slug='<key>'
ON CONFLICT (competitor_id, url) DO NOTHING;
```
Un competidor puede tener **varias fuentes** (adams = 5 product-sitemaps → 5 filas).

### 1e. Verificar → commit → aplicar → sync → re-match
```bash
cd backend && npx tsc --noEmit -p tsconfig.json && npx jest src/competitors   # tsc + tests
```
Commit **atómico** (`git add <mis-ficheros> && git commit --no-verify && git push` en UNA invocación — hay sesiones paralelas en el mismo worktree que borran lo no-commiteado; ver GOTCHA §5).
Aplicar migración a RDS (§3) → correr sync (§2) → re-match (§2b) → verificar (§2c) → **`scripts/deploy-backend.sh`** para que el cron use el adapter/matcher nuevos (no hay auto-deploy).

---

## 2. Correr el sync manualmente (backfill / verificación)

El cron corre a las 05:00 UTC. Para forzarlo a mano (harness ts-node que instancia los servicios sin NestJS DI):
```ts
// scratchpad/run_sync.ts
import * as fs from 'fs';
import postgres from '<repo>/backend/node_modules/postgres';
import { drizzle } from '<repo>/backend/node_modules/drizzle-orm/postgres-js';
import { CompetitorQueriesService } from '<repo>/backend/src/competitors/competitor-queries.service';
import { CompetitorSyncService } from '<repo>/backend/src/competitors/competitor-sync.service';
const url = fs.readFileSync('<repo>/.env.local','utf8').match(/^DATABASE_URL=(.*)$/m)![1].trim();
(async()=>{ const c=postgres(url,{ssl:{rejectUnauthorized:false},max:2}); const db=drizzle(c) as any;
  const s=new CompetitorSyncService(new CompetitorQueriesService(db) as any);
  console.log(JSON.stringify(await (s as any).runAll(),null,2)); await c.end(); })();
```
```bash
cd backend && TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"experimentalDecorators":true,"emitDecoratorMetadata":true}' \
  npx ts-node --transpile-only --skip-project scratchpad/run_sync.ts
```
- `runAll()` hace TODOS los competidores; es **idempotente**. Backfill inicial capado a `MAX_COURSES_PER_RUN=400` cursos/pasada → competidores grandes (tecnoszubia 654, mad 197) necesitan varias pasadas (o el cron los completa).
- **Correrlo en background** (mad/adams con miles de URLs tardan ~15 min — ver PERF §5).

### 2b. Re-match (tras añadir competidor o tocar el matcher)
El match curso→oposición solo se recalcula al re-fetchear un curso. Para aplicarlo a los cursos existentes, re-match one-off: `loadOposicionesForMatch()`, iterar `competitor_courses` activos y llamar **`matchCourse(rawName, url+' '+rawName, catalog)`** → `UPDATE oposicion_id, ambito, region_slug, match_method, match_confidence, match_candidate_id`. **RESPETAR STICKY:** saltar filas con `match_method IN ('manual','confirmed')` (curación humana, nunca pisarlas). Ver `scratchpad/rematch_struct.ts`.

### 2c. Verificar
```sql
SELECT match_method, count(*) FROM competitor_courses WHERE is_active GROUP BY match_method;  -- auto_structured|auto_name|needs_review|manual|confirmed|none
SELECT count(DISTINCT oposicion_id) FROM competitor_courses WHERE oposicion_id IS NOT NULL AND is_active;
```

### 2d. Matcher ESTRUCTURADO + revisión + triaje (07/07)

**El match NO se hace por parecido de nombre** — una oposición es única por **(ámbito, región)**: "Técnico Auxiliar de Informática" del Estado ≠ de un Ayuntamiento ≠ de una Universidad.
- **`oposicion-identity.ts`** (puro, testeado): `deriveIdentity(texto)→{ambito: estado|autonomica|local|universidad|desconocido, region}` (ruleset CCAA/local/universidad) + `identityCompatible` (**GUARDA DURA**: ámbito/región incompatibles → nunca emparejan). La identidad del curso se saca de **`url + rawName`** — la URL del competidor suele traer la administración (ADAMS `/oposiciones/generalitat-valenciana/…`).
- **`matchCourse`** filtra por identidad ANTES del nombre; dentro compara cuerpo por tokens. Devuelve `method` + `confidence`:
  - `auto_structured` (ámbito+región coinciden) / `auto_name` (solo ámbito) → **auto-enlaza**.
  - `needs_review` → **NO enlaza**: candidato dudoso/ambiguo o **solape parcial** (la opo tiene una palabra que el competidor no escribe, p.ej. "Agente de la Hacienda **Pública**"). Prioridad **"no perder nada"**: nunca gap silencioso de algo plausible, nunca auto-enlace erróneo.
- **Revisión humana:** pestaña **Revisión** del panel (o `getReviewQueue`/`confirmMatch`) → confirmar/descartar a 1 clic. Queda `confirmed`/`manual` = **STICKY**.
- **Triaje de señales (badge):** el badge = `competitor_changes` **sin revisar** (`reviewed_at IS NULL`) y de tipo **accionable** (`course_added|course_removed|price_changed|url_removed`); `url_added`/`url_modified` (refresco de contenido) NO cuentan. Marcar revisado (`acknowledgeCompetitorChanges`, botón en pestaña Cambios) las conserva en el log pero las saca del badge. Así el badge = novedades comerciales pendientes, sin ruido recurrente.

---

## 3. Aplicar una migración a RDS

No hay `psql`; usar Node + postgres-js (idempotente, `IF NOT EXISTS`/`ON CONFLICT`):
```bash
cd backend && node -e '
const fs=require("fs"),p=require("./node_modules/postgres");
const u=fs.readFileSync("../.env.local","utf8").match(/^DATABASE_URL=(.*)$/m)[1].trim();
(async()=>{const s=p(u,{ssl:{rejectUnauthorized:false},max:1});
await s.unsafe(fs.readFileSync("../supabase/migrations/<fichero>.sql","utf8")); console.log("ok"); await s.end();})();'
```
Confirmar host RDS (`rds.amazonaws.com`) antes de escribir.

---

## 4. Precios (desglose)

`competitor_prices`: `price_kind` (matricula|cuota|intensivo|tasa|material|**curso**|otro) × `audience` (nuevo|antiguo|general) × `period` (mensual|trimestral|unico|curso) × **`plan`** (paquete: solo tests | tests+temario | tests+temario+casos…) + **`includes`** (jsonb). Un curso puede tener **varios precios**. Histórico: al cambiar, `is_current=false`+`superseded_at` y se inserta la fila nueva. Identidad = (course, kind, audience, period, plan).

Patrones de captura por competidor:
- **Academia con precio en HTML** (tecnoszubia): parsear paneles de precio ACOTADOS (no tragarse el sueldo del artículo).
- **JSON-LD** (adams): `Course`/`Product` → **el Offer puede anidarse en `hasCourseInstance[].offers`, no solo en `offers` top-level** (mirar en profundidad).
- **Plataforma / suscripción dinámica** (opositatest, gokoan): precio por JS/checkout → `rendering:'js'`, precio por headless (follow-up). NO inventar.
- **Editorial** (mad): precio por libro (JSON-LD), no por oposición-taxonomía.

---

## 5. GOTCHAS / troubleshooting

- **Sesiones git paralelas en el mismo worktree** borran cambios NO commiteados (ha pasado 2×). → Commitear **atómico** (add+commit+push en una invocación); nunca dejar trabajo a medias entre pasos. Commitear **solo mis ficheros por pathspec** (nunca `git add -A`; hay mucho ajeno untracked). Usar `--no-verify` (el pre-commit corre la suite raíz que tiene fallos ajenos preexistentes).
- **`<loc>` en CDATA** (mad/PrestaShop) → `sitemap.ts` los desenvuelve; si un competidor nuevo trae CDATA y no parsea, revisar ahí.
- **`lastmod` string vs timestamptz**: comparar por tiempo parseado (`lastmodDiffers`), no por string, o el gateo de re-descarga se rompe (re-fetch infinito).
- **Matcher (`matchCourse`, estructurado — ver §2d)**: identidad (ámbito/región) como guarda dura + tokens del nombre. GOTCHAS internos de `cleanName`: **singularizar en 2 pasos (-s luego -e)**, NUNCA una regla `-es` ingenua (rompía `ayudant**es**`→`ayudant`≠`ayudante`); región por **prefijo de tokens** ("cordoba-auxiliar"≈"cordoba"); expandir abreviaturas de organismo (`gva`→"generalitat valenciana"). El fallback de **solape parcial** exige ≥1 palabra **distintiva** (fuera de `GENERIC_TOKENS`: auxiliar/administrativo/tecnico…) para no proponer por solo coincidir en el rol. Precisión>recall se mantiene: dudoso → `needs_review`, nunca auto-enlace falso.
- **Página genérica servida por producto retirado** (ADAMS sirve su "Buscador De Oposiciones" cuando un producto ya no existe) → el parser cogía ese título. Guarda en `parseAdamsCourse` (`return null` si nombre = "buscador de oposiciones"). Si un competidor nuevo hace lo mismo, añadir guarda análoga.
- **Cloudflare** suele estar en modo CDN (el UA-bot pasa). Solo si hay challenge/403 real → headless. Si un competidor bloqueara el UA-bot, añadir UA de navegador por-competidor.
- **gzip/brotli** (gokoan): `fetch` de Node descomprime solo; si el HTML sale binario, revisar.
- **Robots.txt**: respetar `Disallow` (p.ej. `/api/`, `/checkout/`); no scrapear precios tras rutas bloqueadas.
- **PERF (follow-up):** el sync inserta URLs **una a una** → competidores con miles de URLs (mad 5.577, adams) tardan ~15 min. Optimizar con **batch inserts**.
- **⚠️ Backfill de competidor NUEVO inunda el badge de Cambios.** El **primer sync** de un competidor recién añadido registra **TODO su catálogo** como `course_added` → el badge de `/admin/competidores` (§2d) se dispara a "99+" con novedades que NO son novedades (es su baseline). Los gaps reales con demanda ya se destilan aparte a las señales OEP `sensor_type='competitor'` (≥2 competidores, §7). **Acción:** saldar el backfill (`acknowledgeCompetitorChanges` / `UPDATE competitor_changes SET reviewed_at=now() WHERE reviewed_at IS NULL AND change_type IN ('course_added','url_removed') AND competitor_id=(<el nuevo>)`) tras confirmar por competidor que es el alta inicial. **FIX (DESPLEGADO 13/07 — main `3411f3c7`, backend td:62):** columna `competitors.baseline_done`; al completar el backfill inicial (`shouldFinalizeBaseline`: fuentes OK + `coursesPending===0`, robusto ante backfill multi-pasada) el sync **auto-salda** esos cambios (`reviewed_by='system:baseline'` — siguen en el log, fuera del badge) y marca la bandera. Los 70 competidores existentes migrados a `baseline_done=true`. Caso 13/07: alta de *Temarios Oficiales* → **400 `course_added`** → badge 99+; saldado por competidor, badge → 0. (Distinto del churn de `url_removed` de posts de convocatoria caducados — feed de noticias, también ruido.)
- **NO inventar contenido** (nombres/precios). Si no está, es gap / precio vacío / follow-up headless.
- **⚠️ Falsos negativos de cobertura (clasificación + descubrimiento):** el analizador puede reportar "0 competidores" cuando SÍ la preparan (ver §6). Dos causas: **(a) orden de `classifyUrl`** — en MAD el `.html → page` iba ANTES que `/oposiciones/`, tragándose los productos de oposición `/oposiciones/<id>_slug.html` (arreglado 07/07: mirar `/oposiciones/` primero); **(b) descubrimiento limitado al sitemap** → oposiciones vendidas como página fuera del sitemap se pierden. Al escribir un adapter: revisar el ORDEN de `classifyUrl` (lo específico antes que lo genérico) y hacer spot-check contra Google de si el sitemap cubre TODAS las oposiciones.

---

## 6. Responder "¿quién prepara la oposición X?" / comparar precios

> ⚠️ **"0 competidores la tiene" es un FALSO NEGATIVO frecuente en oposiciones NICHO — NO te fíes del panel.** El analizador **SUBCUENTA** la cobertura: solo descubre lo que hay en el **sitemap** de cada competidor y respeta el tope `MAX_COURSES_PER_RUN=400`/pasada. Una oposición que un competidor vende como **producto/página suelta fuera del sitemap** (o más allá del tope) NO se captura.
>
> **Caso 07/07/2026 (Aux. Servicios Universidad de Murcia):** el panel decía "0 competidores" y "MAD solo tiene Limpiador/Lavandería" → **falso**. MAD la vende (`mad.es/oposiciones/244196_auxiliar-de-servicios.html`), pero (1) esa URL **no está en su sitemap** (no se descubre) y (2) `classifyMadUrl` clasificaba los `/oposiciones/<id>_slug.html` como libro (`.html → page`) **antes** de mirar `/oposiciones/` → se perdían. La capa (2) está **corregida** en `mad.ts`; la (1) (descubrimiento) sigue: para nicho el sitemap no basta.
>
> **Regla:** antes de concluir "no la prepara nadie" para una oposición nicho, **verifícalo en Google** ("preparación oposición X academia/curso"). Los competidores que encuentres y no tengamos → regístralos (§1). Nunca decidas un build (o su descarte) solo con el "0 competidores" del panel.

- **Panel:** `/admin/competidores` → "Por oposición" → buscar (insensible a acentos, cubre **TODAS** las catalogadas —con o sin competidor— **y los cursos-gap sin catalogar**, endpoint `/search` con `unaccent`) → competidores + coste. Los matches dudosos están en la pestaña **Revisión** (no se pierden como gap).
- **SQL directo:**
```sql
SELECT c.name, cc.modalidad, cc.raw_name,
  json_agg(json_build_object('kind',cp.price_kind,'plan',cp.plan,'cents',cp.amount_cents,'period',cp.period))
    FILTER (WHERE cp.id IS NOT NULL) precios
FROM competitor_courses cc JOIN competitors c ON c.id=cc.competitor_id
LEFT JOIN competitor_prices cp ON cp.competitor_course_id=cc.id AND cp.is_current
WHERE cc.oposicion_id = (SELECT id FROM oposiciones WHERE nombre ILIKE '%<oposición>%' LIMIT 1) AND cc.is_active
GROUP BY c.name, cc.modalidad, cc.raw_name;
```
- **Gaps (demanda / candidatas a catalogar):** `competitor_courses WHERE oposicion_id IS NULL` = oposiciones que ELLOS preparan y nosotros no.
- **Blue ocean:** nuestras `oposiciones` sin ningún competidor.

---

## 7. Último paso — del gap de competidor al catálogo (investigar vendibilidad + ciclo)

> **§1-§6 catalogan CURSOS de competidores. Este paso los convierte en decisiones de NUESTRO catálogo.** Un gap (`competitor_courses.oposicion_id IS NULL`) con demanda real —que es justo lo que la Capa 3 del radar emite como señal `sensor_type='competitor'` (huecos únicos con ≥2 competidores)— NO es solo un dato de competidor: es una **candidata a entrar en `oposiciones`**. El competidor es una **PISTA**, nunca la verdad (ver nota de Acceso, abajo) → hay que **verificar contra fuente oficial**. Una señal de competidor no se cierra sin recorrer esto.

Para **cada oposición nueva** que aflore (por señal `competitor` o al revisar gaps §6):

1. **¿Ya la tenemos en la BD?** Buscar SIEMPRE por slug **y** nombre — el matcher deja `oposicion_id=NULL` en cuerpos que SÍ están catalogados (no te fíes del "0 competidores"/gap del panel). `SELECT id,slug,estado_proceso,is_active,coverage_level FROM oposiciones WHERE slug ILIKE '%…%' OR nombre ILIKE '%…%'`. **Si existe → falso gap:** enlazar la señal (`UPDATE oep_detection_signals SET oposicion_id=…, status='applied'`) + los `competitor_courses` del hueco (`match_method='manual'`, §2b) a esa fila. **NUNCA duplicar.**
2. **¿En qué ciclo / oportunidad está?** (modelo OPORTUNIDAD = unidad de vendibilidad). Verificar contra **fuente oficial** (BOE/boletín/portal de empleo público — método de `feedback_verificar_existencia_oposicion_metodo`: WebSearch del nombre literal + web de empleo de la administración): ¿OEP nueva con plazas? ¿convocatoria publicada? ¿fechas de inscripción/examen? ¿el examen del ciclo actual ya pasó?
3. **¿Es vendible?** Vendible = oportunidad viva con **plazas de INGRESO LIBRE** + **recorrido** (examen lejano o sin fecha aún). Examen a **<1 mes o ya pasado sin OEP nueva = NO vendible ahora**. **NUNCA** promoción interna ni estabilización. Refs: `project_modelo_oportunidad_vendibilidad`, `feedback_runway_examen_vendible`, `feedback_only_ingreso_libre`.
4. **Resolver hacia el catálogo (descartar es la EXCEPCIÓN — manual OEPs §1):**
   - **Vendible, sin fila** → **catalogar** (`is_active=false`, `coverage_level='catalogada'`) con los campos **verificados** (plazas libre, OEP, estado), sin inventar lo que no sepas (grupo/fechas/`seguimiento_url` → NULL antes que inventar); y si merece construirse, **anotarla en `docs/roadmap/tareas-pendientes.md`** como candidata (título + por qué/recorrido + cómo + estado).
   - **Vendible, con fila** → **enriquecer** (estado solo hacia delante, `plazas_*`, fechas, `boe_reference`).
   - **No vendible ahora** (examen pasado sin OEP nueva / solo PI / estabilización) → catalogar/enriquecer **igual** como catálogo (no se descarta por el tipo; norma OEPs §16 "sea del tipo que sea"), simplemente no se activa la venta.
5. **Cerrar la señal** (`status='applied'`/`dismissed` + `admin_notes` de una línea) y **enlazar los `competitor_courses`** del gap a la fila (`manual`) → así el radar no la regenera y el panel deja de marcarla gap.

El detalle del triaje de señales (regla de descarte, buscar fila antes de crear, no descartar por tipo) vive en `docs/maintenance/oeps-convocatorias-seguimiento.md §1`; **este §7 es el puente competidor → catálogo**. Caso fundacional (13/07/2026): 3 señales `competitor` → *Auxiliar Admin Diputación Alicante* (falso gap, enlazada), *Ujieres de las Cortes Generales* y *Gestión Administrativa A2 Junta de Andalucía* (catalogadas + verificadas vendibles + al backlog).

---
## Acceso y sistema selectivo (08/07/2026)
Competidores es una **PISTA**, no fuente oficial → `competitor_courses` **NO** captura acceso (libre/PI) ni sistema selectivo (oposición/concurso-oposición): esos datos se toman del **boletín oficial al verificar**, no del competidor. Si en el futuro se quisieran, irían como enriquecimiento de baja confianza, nunca como verdad.
