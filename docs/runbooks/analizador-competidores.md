# Runbook — Analizador de Competidores

**Cuándo seguir este runbook:** cuando Manuel diga *"añade el competidor X"*, *"quién prepara la oposición Y"*, *"compara precios de competidores"*, *"actualiza/re-sincroniza competidores"*, *"qué oposiciones no cubrimos que ellos sí"* (gaps), o similar. Seguir esto ANTES de improvisar.

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

> **⚠️ DOS colas/badges DISTINTOS (no confundir, aprendizaje 11/07):** (a) **"Cambios"** = `competitor_changes` sin revisar (novedad comercial: curso/precio) → se limpia con `acknowledgeCompetitorChanges` (`UPDATE reviewed_at=now()`). (b) **"Revisión"** = `competitor_courses.match_method='needs_review'` (matches curso↔oposición dudosos) → se limpia confirmando/descartando cada uno. Son tablas y flujos separados.

### 2e. Enriquecer el matching a escala: RECALL, dedup y triaje (sesión 11/07)

**Diagnóstico previo — `oposicion_id IS NULL` NO es siempre un gap.** La mayoría de los "sin match" son **fallos de RECALL**: la oposición SÍ está catalogada (`loadOposicionesForMatch` matchea contra TODO el catálogo, no solo lo vendible), pero el **nombre comercial del competidor** despista al matcher determinista (acrónimos, plurales, prefijos de marketing). **Antes de tratar un `none` como "oposición que no cubrimos", comprueba si YA está en `oposiciones`** (recall) vs genuinamente ausente (gap real).

**(1) Subir RECALL con acrónimos inequívocos (`cleanName`).** El competidor escribe "Aux. Administrativos del **SAS**" y la oposición "…del **Servicio Andaluz de Salud** (SAS)" → los tokens región+salud no alinean. Fix: expandir el acrónimo en `cleanName` (se aplica a curso Y a oposición → alinean). Reglas:
- **ADITIVO, no reemplazo:** `\bsas\b → 'sas servicio andaluz salud'`. Reemplazar borra el token que quizá ya matcheaba por shortName → **regresión**.
- **Solo INEQUÍVOCOS** (uno por acrónimo): SAS/SERGAS/SESCAM/SACYL/SESPA/SMS/Osakidetza/Osasunbidea/AGE/SERMAS/CARM/TCAE/IIPP/ICS. **EXCLUIR ambiguos**: SCS (Canario/Cántabro), UPV (València/País Vasco), y cualquiera con variantes DUPLICADAS en el catálogo (SES empataba).
- **Metodología obligatoria (0 regresiones):** dry-run que corre `matchCourse` sobre todos los no-sticky, cuenta **rescatados (none→match)** y **PERDIDOS (match→none)**, + **eyeball de la muestra de rescatados**. Aplicar SOLO si perdidos=0. (11/07: 15 acrónimos → +72, 0 regresiones; guardarraíl `competitor-sync.spec.ts`.)
- Tras tocar `cleanName`: re-match (write) + **`scripts/deploy-backend.sh`** (el cron usa el matcher nuevo).

**(2) Deduplicar el catálogo (el pipeline 07/07 dejó variantes).** Síntoma: dos entradas del MISMO cuerpo — "X **-** Servicio Y de Salud" (07/07, `catalogada`, 0 cursos) vs "X **del** Servicio Y de Salud" (rica). Al expandir acrónimos quedan token-idénticas → **empate → `none`**. Dedup:
- Agrupar por nombre normalizado (quitar conectores/"-"/paréntesis). **`E ≡ AP`** (grupo E = Agrupación Profesional = MISMO nivel; trátalos igual o pierdes dups — pero **mantén C1≠C2**). También nombre-acrónimo (**TCAE ≡ "Técnico en Cuidados Auxiliares de Enfermería"**).
- **Keeper = el rico** (cursos > con_tests > con_landing > catalogada; a igualdad, el más antiguo). **FK-safe**: reasignar `user_oposiciones_seguidas` al keeper (saltar si ya lo sigue), **borrar** filas derivadas del loser (OJO `convocatorias` tiene UNIQUE `(oposicion_id, año)` → la del loser choca al reasignar → **bórrala**), todo en **transacción con rollback**. Dry-run SIEMPRE (memoria: un dedup fuzzy dio 915 falsos positivos).

**(3) Triaje MASIVO de `needs_review`.** La cola tiene **~50% de candidatos MALOS** (el matcher acierta ~la mitad) → **NUNCA auto-confirmar en bloque**. Dos vías:
- **Auto-confirm SEGURO por regla (materia específica):** confirmar solo si los tokens **distintivos** del candidato (quitando genéricos + organismo + región + adjetivos de región) están TODOS en el curso. Endurecer iterando por las **clases de FALSO POSITIVO** (11/07): (a) "administrativo-solo" → confusión **ayuntamiento↔diputación** (expande "dip."→"diputación" para separarlos); (b) "salud/servicio" genérico → cuerpo específico; (c) **adjetivos de región** (murciano/madrileño) sobreviven al strip de nombres de región → añádelos; (d) **"Personal de Servicios Generales"** = cuerpo-cajón que atrapa cursos de salud → excluir; (e) **acentos en los regex** ("Té**c**nicos"≠"Tecnicos") → normaliza. Dry-run + spot-check SIEMPRE.
- **Revisión manual, curso por curso** (Claude como revisor): lotes numerados → **CONFIRMAR** (correcto, `match_method='confirmed'` sticky) / **DESCARTAR** (candidato mal → `match_method='none'`, limpia la cola) / **DEJAR** (ambiguo). Los **irreducibles** (marketing sin región, DUE↔TCAE) se DEJAN, no se fuerzan. (11/07: 25%→38%, +346; cola 480→25.)

**Gotchas del script re-match one-off (ts-node):** vive en `backend/`, no en la raíz (resolución de módulos). Invocar con `TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,...}' node_modules/.bin/ts-node --transpile-only --skip-project`, `import 'reflect-metadata'`, symlink `node_modules`, leer `../.env.local`. **El re-match es DETERMINISTA** — re-correrlo con el mismo catálogo+matcher da el MISMO resultado (solo suma matches de oposiciones nuevas del catálogo). La palanca es mejorar el MATCHER (recall) o deduplicar, no re-matchear.

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
- **Gaps (demanda / candidatas a catalogar):** `competitor_courses WHERE oposicion_id IS NULL`. **⚠️ OJO (aprendizaje 11/07): NO todo `oposicion_id IS NULL` es un gap** — la mayoría son fallos de **RECALL** (la oposición SÍ está catalogada; el matcher falla por el nombre comercial). Verifica en `oposiciones` antes de tratarlo como "no cubierto". Sube recall / deduplica antes (§2e); lo que quede `none` de verdad = gap real.
- **Blue ocean:** nuestras `oposiciones` sin ningún competidor.

---
## Acceso y sistema selectivo (08/07/2026)
Competidores es una **PISTA**, no fuente oficial → `competitor_courses` **NO** captura acceso (libre/PI) ni sistema selectivo (oposición/concurso-oposición): esos datos se toman del **boletín oficial al verificar**, no del competidor. Si en el futuro se quisieran, irían como enriquecimiento de baja confianza, nunca como verdad.
