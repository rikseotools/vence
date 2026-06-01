# Roadmap: Sistema completo de detección de convocatorias, OEPs e hitos

> **Detonante:** auditoría 2026-06-01 al crear `auxiliar-administrativo-ayuntamiento-badajoz`. El portal del Ayto Badajoz es JS-rendered; el cron `check-seguimiento` + sensor `llm_semantic` ven solo el shell HTML vacío y no detectan el contenido específico del proceso (estado "Publicación de Bases", fechas, cambios de fase). Mismo patrón confirmado en 5-20+ oposiciones del catálogo activo (cabo previo `project_pending_seguimiento_url_genericas` del 31/05).
>
> **Objetivo:** detectar automáticamente, con latencia <24h y cobertura ≥95% del catálogo activo, todos los eventos relevantes del ciclo de vida de cada oposición: aprobación de OEP, publicación de convocatoria, extracto BOE, apertura/cierre de inscripción, listas, fecha de examen y resultados.
>
> **Principios:**
> 1. **Robusto:** redundancia entre sensores. Ninguna oposición depende de una sola fuente.
> 2. **Escalable:** añadir una nueva administración (BOP provincial, Ayto, CCAA) es config, no código.
> 3. **Agnóstico de infraestructura:** los ingestores hablan interfaces (`Fetcher`, `Extractor`); swap de implementación (Playwright Lambda → Browserless → ScrapingBee) no toca lógica de negocio.
> 4. **Observabilidad por construcción:** cada fuente reporta health (last_success, last_error, latency). Cobertura visible en `/admin/oep-coverage`.
> 5. **Coste predecible:** presupuesto mensual <$50 para fetch + LLM. Resto sobre infra existente.
>
> **Estado:** 📋 ROADMAP — pendiente de aprobación. No hay deploys.
>
> **Última actualización:** 2026-06-01.

---

## ⛔ DECISIÓN 01/06/2026 — Scraper regional autónomo RETIRADO; descubrimiento on-demand por Claude

Tras forzar manualmente el cron `detect-regional-oeps` y medir su rendimiento real, Manuel decide **retirarlo**:

- **Datos del run real (01/06 11:28 UTC):** 167 fuentes escaneadas, **93 fallos (56% error)**, solo 66 extracciones OK, 8,7 min de compute + coste LLM Haiku por fuente.
- **Falsos positivos demostrados:** "Listado de colaboradores" (no es convocatoria), procesos finalizados, C1 de 1 plaza. Ya motivaron descartar la **Fase 5-bis** (auto-escritura) y la **Fase 7** (auto-apply).
- **El trabajo de valor** — verificar contra BOE/diario oficial, encontrar la `seguimiento_url` estable correcta, decidir demanda, rellenar landing/temario — **lo hace Claude con criterio, no el scraper**. Como hay que vetar el 100% del output igualmente, el ruido del scraper no compensa su coste.
- **Universo C2 conocido y enumerable:** Estado + 17 CCAA + grandes ayuntamientos/diputaciones + sanitarias TCAE. No requiere red ancha automática.

**Nuevo modelo de descubrimiento:**
1. **Monitoreo de cuerpos del catálogo** (45 oposiciones) → se mantiene: `llm_semantic` + `hash_change` + `check-seguimiento` + `timeline_silence`. Barato y preciso, caza convocatorias nuevas de cuerpos ya cubiertos.
2. **Descubrimiento de cuerpos NUEVOS** → **on-demand por Claude**: Manuel dice "revisa oeps / busca C2 nuevas", Claude hace WebSearch dirigido + verifica fuente oficial + halla `seguimiento_url` estable + decide demanda + rellena la fila en `oposiciones`. Lento pero fiable, una a una.

**Cambios aplicados (01/06/2026):**
- Borrado `backend/src/detect-regional-oeps/` (cron + service + module).
- Retirado `DetectRegionalOepsModule` de `backend/src/app.module.ts`.
- Eliminado `detect-regional-oeps` de `ALLOWED_CRONS` (frontend `trigger-cron`) y el botón "🌍 Scan regional" del panel `/admin/oep-signals`.
- ⚠️ **Requiere redeploy del backend Fargate** para que el `@Cron` deje de registrarse (hasta entonces seguiría disparándose el próximo lunes 08:00 UTC).
- **Código huérfano consciente:** la extracción regional del LLM (`regionalExtractionSchema`, `regionalUserPrompt` en `oep-signals-llm.service.ts`) y la query `getActiveSources` / tabla `detection_sources` quedan como librería dormida, reutilizable si el descubrimiento on-demand quiere apoyarse en ellas. GC futuro opcional.
- **Fases 3 y 6 del roadmap quedan obsoletas** (dependían del scraper regional / panel de descubiertos). Ver notas en cada fase.

---

## 1. Diagnóstico del sistema actual

### 1.1 Sensores existentes

| Sensor | Fuente | Mecanismo | Score base | Cron |
|---|---|---|---|---|
| `llm_semantic` | `oposiciones.seguimiento_url` | fetch HTML → cleanHtml → Claude Haiku → entidades estructuradas | 40 | L-V 10:00 UTC |
| ~~`regional_scan`~~ **RETIRADO 01/06** | ~~`detection_sources` (167 fuentes)~~ | ~~fetch HTML listado → Haiku → títulos C1/C2~~ — 56% error, falsos positivos → descubrimiento on-demand por Claude (ver decisión arriba) | — | — |
| `timeline_silence` | `convocatoria_hitos` + `oposiciones` | hitos `current` con fecha pasada +3 días | 70 | Diario 7:00 UTC |
| `generic_source` | `generic_source_checks` (6 fuentes: DGFP, INAP, Moncloa, MTDFP, Función Pública, Transparencia) | hash + LLM filtro | 50 | Diario |
| `hash_change` (legacy) | `oposiciones.seguimiento_url` | SHA-256 sobre cleanHtml | 30 | L-V 9:00 UTC |

Triaje centralizado en `oep_detection_signals` + panel `/admin/oep-signals`. Score 0-100, ≥60 rojo, 40-59 amarillo.

### 1.2 Gaps medidos (audit 2026-06-01)

Audit sobre 45 oposiciones activas con `seguimiento_url`:

| Verdict | Cantidad | % | Significado |
|---|---|---|---|
| `static_ok` (≥3 hits genéricos) | 21 | 46.7% | Cron funciona, **pero incluye falsos positivos** como `ayuntamiento-badajoz` que cuenta keywords del sidebar genérico sin detectar el contenido del proceso |
| `partial` (1-2 hits) | 17 | 37.8% | Dudoso, requiere revisión caso a caso |
| `too_short` / `fetch_fail` (5xx, 4xx) | 5 | 11.1% | extremadura, policía-municipal-madrid (HTTP 403), policía-nacional, tcae-galicia (HTTP 302), tcae-murcia |
| `js_rendered` (0 hits) | 2 | 4.4% | diputación-cádiz, país-vasco |

**Agujero real estimado:** 15-45% del catálogo no detecta cambios útiles. La métrica "hits genéricos ≥3" del audit es demasiado permisiva (cuenta `convocatoria`, `auxiliar`, `plazas` del sidebar lateral).

### 1.3 Causas raíz

1. **JS-rendering:** webs modernas (SPA) sirven shell HTML vacío + bundle JS que rellena el contenido. `fetch()` ve el shell. Ejemplos confirmados: Ayto Badajoz, Diputación Cádiz, País Vasco.
2. **PDFs como única fuente:** muchas fichas oficiales tienen la fase en un PDF adjunto (`FECHAS Y PLAZOS.pdf`) y el HTML solo enlaza al PDF sin contenido. Sin extractor PDF, el cron no ve nada.
3. **APIs propietarias / formularios:** algunos portales solo permiten consulta vía formulario POST con CSRF token (sede.inap, varias sedes electrónicas).
4. **No tenemos cobertura de BOPs provinciales:** solo 2 BOPs en `detection_sources` (Badajoz × 2). España tiene 50 provincias = 50 BOPs. Cada oposición de Ayto/Diputación depende del BOP de su provincia.
5. **No tenemos detector de OEPs anuales:** no hay cron específico que escanee boletines en Q4 buscando "Oferta de Empleo Público 20XX".
6. **No tenemos detector de extractos BOE:** cuando una convocatoria autonómica/local publica extracto en BOE-A, eso dispara el plazo de inscripción. No lo monitorizamos.

### 1.4 Cabos relacionados

- `project_pending_seguimiento_url_genericas` (31/05): 6 oposiciones del catálogo con URL genérica/rota.
- `feedback_siempre_robusto_nunca_chapuzas` (31/05): aplica directamente — no aceptar parches por oposición; resolver sistémicamente.

---

## 2. Arquitectura objetivo

### 2.1 Capas

```
┌─────────────────────────────────────────────────────────────┐
│  CAPA 5: APLICACIÓN                                          │
│  - /admin/oep-signals (triaje humano, ya existe)            │
│  - /admin/oep-coverage (NUEVO: SLA por oposición)           │
│  - Auto-apply para señales de alta confianza                │
│  - Newsletter automática a usuarios target_oposicion        │
└─────────────────────────────────────────────────────────────┘
                            ▲
┌─────────────────────────────────────────────────────────────┐
│  CAPA 4: SEÑALES (oep_detection_signals — ya existe)        │
│  - Score 0-100, dedupe por (sensor, oposicion, year, ref)   │
│  - Estados: pending, applied, dismissed                     │
└─────────────────────────────────────────────────────────────┘
                            ▲
┌─────────────────────────────────────────────────────────────┐
│  CAPA 3: DETECTORES (sensors)                                │
│  Actuales: llm_semantic, regional_scan, timeline_silence,   │
│            generic_source, hash_change                       │
│  NUEVOS:                                                     │
│  - boe_extracto: lee BOE-A diariamente buscando extractos   │
│    de convocatorias autonómicas/locales en BD               │
│  - oep_anual: Q4 escanea boletines buscando "OEP 20XX"      │
│  - bop_provincial: 50 BOPs como detection_sources           │
│  - pdf_change: hash + LLM sobre PDFs enlazados              │
└─────────────────────────────────────────────────────────────┘
                            ▲
┌─────────────────────────────────────────────────────────────┐
│  CAPA 2: EXTRACTORES (parsers)                               │
│  - cleanHtml (actual)                                        │
│  - pdfExtract (NUEVO: pdftotext / pdf-parse)                │
│  - rssParser (NUEVO: para fuentes con feed)                 │
│  - boeApi (NUEVO: usa la API estructurada de boe.es)        │
└─────────────────────────────────────────────────────────────┘
                            ▲
┌─────────────────────────────────────────────────────────────┐
│  CAPA 1: INGESTA (fetchers — interfaces agnósticas)          │
│  - HttpFetcher (actual: fetch nativo)                       │
│  - HeadlessBrowserFetcher (NUEVO: Playwright)               │
│  - PdfDownloader (NUEVO)                                    │
│  - RssReader (NUEVO)                                        │
│  - BoeApiClient (NUEVO)                                     │
│                                                              │
│  Selector: detection_sources.fetcher_type decide cuál usar  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Modelo de datos

Ampliar `detection_sources` (ya tiene 167 fuentes activas) con:

```sql
ALTER TABLE detection_sources ADD COLUMN fetcher_type TEXT
  DEFAULT 'http'
  CHECK (fetcher_type IN ('http', 'headless', 'pdf', 'rss', 'boe_api'));

ALTER TABLE detection_sources ADD COLUMN extractor_type TEXT
  DEFAULT 'clean_html'
  CHECK (extractor_type IN ('clean_html', 'pdf_text', 'rss_items', 'boe_xml'));

ALTER TABLE detection_sources ADD COLUMN coverage_score INTEGER;
ALTER TABLE detection_sources ADD COLUMN last_health_check TIMESTAMPTZ;
ALTER TABLE detection_sources ADD COLUMN health_status TEXT DEFAULT 'unknown';
```

Nueva tabla para tracking de PDFs enlazados:

```sql
CREATE TABLE convocatoria_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oposicion_id UUID REFERENCES oposiciones(id) ON DELETE CASCADE,
  document_type TEXT CHECK (document_type IN ('bases_pdf', 'fechas_plazos_pdf', 'lista_admitidos_pdf', 'tribunal_pdf', 'extracto_boe_html')),
  url TEXT NOT NULL,
  last_hash TEXT,
  last_extracted_at TIMESTAMPTZ,
  last_change_at TIMESTAMPTZ,
  extracted_text TEXT,
  UNIQUE (oposicion_id, url)
);
```

**Procesos detectados (implementado 2026-06-01)** — almacén persistente de cualquier proceso selectivo detectado por sensores, exista o no en el catálogo Vence. Sustituye al diseño anterior `oeps_detected` (que era demasiado específico a "OEP" y obligaba a discriminar de convocatorias). Migration: `supabase/migrations/20260601_discovered_processes.sql`.

```sql
CREATE TABLE discovered_processes (
  id UUID PRIMARY KEY,
  region_name TEXT NOT NULL,            -- "Dip. Cádiz", "Ayto. Las Palmas G.C."
  position_name TEXT NOT NULL,          -- "Ayudante de Recaudación"
  position_subgrupo TEXT,               -- A1, A2, B, C1, C2, E
  year INTEGER,
  boc_ref TEXT,                         -- BOP/BOCM/BOE/DOGV...
  plazas_libres INTEGER,
  plazas_discapacidad INTEGER,
  plazas_promocion_interna INTEGER,
  estado_proceso TEXT,
  fecha_publicacion DATE,
  fecha_inscripcion_inicio DATE,
  fecha_inscripcion_fin DATE,
  fecha_examen DATE,
  source_url TEXT NOT NULL,
  source_sensor TEXT NOT NULL,          -- regional_scan, llm_semantic, generic_source, pdf_extract, rss, boe_api
  raw_extraction JSONB DEFAULT '{}',
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  manuel_status TEXT DEFAULT 'new',     -- new, watching, irrelevant, promoted
  manuel_notes TEXT,
  promoted_to_oposicion_id UUID REFERENCES oposiciones(id) ON DELETE SET NULL,
  promoted_at TIMESTAMPTZ,
  UNIQUE (region_name, position_name, COALESCE(year, -1), COALESCE(boc_ref, ''))
);

CREATE TABLE discovered_process_milestones (
  id UUID PRIMARY KEY,
  process_id UUID REFERENCES discovered_processes(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  titulo TEXT NOT NULL,                 -- "Bases publicadas", "Inscripción abierta", "Lista provisional"
  descripcion TEXT,
  url_source TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (process_id, fecha, titulo)
);
```

**Modelo de uso (decidido 01/06/2026):**

1. Sensores siguen escribiendo señales efímeras en `oep_detection_signals` (sin cambio).
2. Badge admin avisa "hay novedades".
3. Manuel dice "revisa oeps" → Claude analiza cada señal con criterio (verifica fuentes oficiales si dudoso, distingue ruido de novedad real, mapea a oposición existente o a proceso nuevo).
4. Claude decide y ejecuta tras OK de Manuel por bloque:
   - Señal con oposición Vence + datos nuevos → UPDATE en `oposiciones` + invalidar cache landing.
   - Señal sin oposición Vence + datos estructurados → UPSERT en `discovered_processes` + INSERT en `milestones`.
   - Ruido o LLM error → señal `dismissed` con nota del por qué.
5. Cuando Manuel quiera crear una oposición Vence desde un proceso descubierto: lee `discovered_processes` + milestones y se crea con datos pre-rellenados. Marca `manuel_status='promoted'`.

**Por qué NO automatizar la decisión sensor→discovered_processes:** los sensores tienen falsos positivos (LLM mal sumó plazas Badajoz, atribuyó BOE-Fuenlabrada a GC, hash changes sin info, prensa genérica La Moncloa). Inyectar todo automáticamente ensucia el inventario. La capa de juicio (Claude con OK de Manuel) es la garantía de calidad. La tabla de señales sigue siendo la cola de revisión.

### 2.4 Estado real C2 al cierre 01/06/2026

Auditoría del subgrupo C2 (objetivo de cobertura prioritario):

- **31 oposiciones C2 activas** en `oposiciones`, todas con `seguimiento_url`.
- **22 completas** (estado + BOC + plazas + oep_fecha) tras esta sesión (+4 hoy).
- **6 con campos `null` que son correctos** según la fase del proceso (no son cabos): Andalucía y P. Vasco con BOC null por estado `oep_aprobada` (convocatoria aún no publicada), Correos con todo null por estado `sin_oep` (no hay proceso).
- **3 cabos URL/datos no cerrables sin investigación humana** (Sprint URLs):
  - TCAE Murcia oep_fecha — URL `murciasalud.es/oposicionsms` genérica; buscar resolución TCAE en BORM.
  - TCAE Canarias BOC + oep_fecha — página SCS genérica; buscar BOC Canarias resolución TCAE.
  - TCAE Galicia BOC + oep_fecha — `fides.sergas.es` requiere navegación interactiva; buscar DOG Galicia resolución TCAE SERGAS.
- **1 cabo confirmado no localizable web**: Badajoz `oep_fecha` no aparece en bases PDF (sí está, vacía, en Decreto Alcaldía previo no accesible públicamente). Si se necesita, requiere contacto RRHH Ayto Badajoz.

**Cobertura de C2 NO incluidas en BD aún** (estimación honesta):
- 17 CCAA × ~3-5 cuerpos C2 ≈ 50-85 perfiles (mayoría salud ya cubierta).
- 41 diputaciones × cuerpos C2 ≈ 80-200 (cubiertas pocas: Cádiz, León, Zaragoza, Palencia detectada).
- Ayuntamientos >50k habitantes × 1-3 C2 ≈ 150-450 (cubiertos solo Badajoz, Murcia, Valencia).
- Estado: cubierto.
- **Total potencial: 300-700 C2 en España; en BD tenemos 31 (4-10%)**.

El catálogo crecerá vía Fase 3 (50 BOPs como `detection_sources`) + Fase 4 (detector OEPs anuales): cada vez que el cron detecte un proceso de cuerpo C2 ausente, llega a `discovered_processes` y Manuel decide promoverlo.

### 2.3 Estrategia de redundancia (clave para 95% cobertura)

Cada oposición debe estar cubierta por **≥2 sensores ortogonales**, de forma que un único punto de fallo no la deje a oscuras.

Ejemplo Ayto Badajoz:
- Primario: `headless_browser` sobre `seguimiento_url` específico del proceso (detecta cambios de fase del proceso concreto).
- Secundario: `bop_provincial` sobre BOP Badajoz (detecta nuevos anuncios del proceso, listas, resultados).
- Terciario: `boe_extracto` sobre BOE-A diario (detecta cuando se publique el extracto que abre plazo).
- Cuaternario: `regional_scan` sobre portal Ayto listado (detecta futuras convocatorias del mismo cuerpo).

Si 1 sensor cae, los otros siguen detectando.

---

## 3. Fases del roadmap

### Fase 0 — Diagnóstico exhaustivo (1 día)

**Objetivo:** medir el agujero real con precisión, no la estimación 15-45% del audit actual.

**Tareas:**
- Refinar audit con detección estricta: en lugar de buscar `convocatoria` o `auxiliar` (palabras del sidebar genérico), buscar tokens muy específicos: el `boe_reference` exacto, el `estado_proceso` actual textual, el título de algún hito completed reciente.
- Para cada `static_ok` actual, validar con un test secundario que el LLM Haiku extrae info útil real (`hasOepInfo=true` con campos no-null).
- Generar `/tmp/audit_seguimiento_2026-06-01.json` con verdict por oposición + razón.

**Criterio de éxito:** clasificación binaria firme (funciona/no funciona) para cada una de las 45 oposiciones activas.

**Entrega:** documento `docs/maintenance/audit-seguimiento-coverage.md` con la tabla resultado.

### Fase 1 — Headless browser fetcher (1 semana)

**Objetivo:** habilitar fetch de páginas JS-rendered. Cubre el caso Ayto Badajoz, Diputación Cádiz, País Vasco y posiblemente +10 oposiciones de `partial`.

**Decisión arquitectónica:** elegir entre tres opciones, todas válidas:

| Opción | Coste/mes | Latencia/fetch | Mantenimiento | Notas |
|---|---|---|---|---|
| Playwright en Lambda dedicada | $5-15 | 3-8s | Medio (actualizar headless chrome) | Control total, integra con `OepSignalsLlmService` directamente |
| ScrapingBee SaaS | $49 (1k reqs) – $99 (10k) | 5-15s | Cero | Plug & play. JS rendering incluido. Anti-bot incluido. |
| Browserless self-hosted | $7-20 EC2 | 2-5s | Alto (deploy + monitoring) | Ahorra coste pero requiere ops |

Recomendación robusta inicial: **ScrapingBee** para validar valor en 1-2 semanas; si el ROI es claro, migrar a Playwright self-hosted (≥3 meses).

**Tareas:**
1. Crear interfaz `Fetcher` en `backend/src/oep-signals/fetchers/fetcher.interface.ts`.
2. Implementar `HttpFetcher` (refactor de `fetchPageHtml` existente).
3. Implementar `HeadlessFetcher` con la opción elegida + retries + timeout.
4. Añadir `fetcher_type` a `detection_sources` (migración SQL §2.2).
5. `OepSignalsLlmService.fetchPageHtml(url, opts)` → delega al fetcher según `fetcher_type`.
6. Marcar 7-20 fuentes confirmadas JS-rendered con `fetcher_type='headless'`.
7. Test E2E: re-run audit Fase 0 con headless habilitado → score sube ≥3 hits específicos en al menos 5 de los 7 casos js_rendered/too_short.

**Riesgo:** algunos portales detectan bots y bloquean. Mitigación: rotar user-agent, añadir `wait_for` específicos (selector CSS de un elemento que aparece tras hydration).

**Criterio de éxito:** ≥80% de las páginas js_rendered actualmente broken devuelven HTML con contenido útil.

### Fase 2 — PDF extractor (3 días)

**Objetivo:** procesar documentos PDF enlazados como hitos del proceso (FECHAS Y PLAZOS, listas admitidos, tribunal, etc.). Cubre el caso Badajoz directamente: el PDF "FECHAS Y PLAZOS" del Ayto Badajoz se actualizará al avanzar el proceso → si detectamos cambio + extraemos texto, identificamos la fase nueva.

**Tareas:**
1. Implementar `PdfDownloader` + `PdfExtractor` en `backend/src/oep-signals/extractors/pdf-extractor.ts`. Tecnología: `pdf-parse` (npm) o `pdftotext` (binario). Recomendación: `pdf-parse` por dependencia única.
2. Crear migración SQL para `convocatoria_documents` (§2.2).
3. Cron diario `track-convocatoria-documents`: por cada documento registrado, descarga + hash + extract.
4. Cron LLM `extract-pdf-events`: para documentos con hash cambiado, envía texto a Haiku para detectar eventos (apertura inscripción, lista admitidos, etc.).
5. Auto-poblar `convocatoria_documents` cuando se cree una oposición: parsear `seguimiento_url` HTML buscando links `.pdf`.

**Criterio de éxito:** el PDF de Ayto Badajoz se monitoriza; cuando se actualice (extracto BOE + apertura inscripción), genera señal con score ≥70.

### Fase 3 — BOPs provinciales como `detection_sources` (1 semana) — ⛔ OBSOLETA (01/06/2026)

> Dependía del cron `regional_scan`, retirado el 01/06 (ver decisión arriba). Los BOPs provinciales / convocatorias municipales pasan a descubrirse **on-demand por Claude** cuando haya demanda real, no por scraping masivo de 50 fuentes.

**Objetivo (histórico):** cubrir los 50 BOPs provinciales para detectar convocatorias y OEPs municipales que hoy se nos escapan.

**Tareas:**
1. Identificar el patrón de URL/RSS de cada BOP (varios usan estructura igual: `dip-XXX.es/bop/...`).
2. Insertar 50 entradas en `detection_sources` con `source_type='bop'`, `fetcher_type` apropiado.
3. Cron `regional_scan` ya las procesará automáticamente.
4. Validar 5 BOPs piloto antes del rollout: Madrid, Barcelona, Sevilla, Badajoz, Valencia.

**Riesgo:** algunos BOPs tienen anti-scraping. Fallback a SaaS o a sus boletines diarios PDF.

**Criterio de éxito:** cobertura BOP = 50/50 con ≥40 reportando health OK.

### Fase 4 — Detector de OEPs anuales (1 semana)

**Objetivo:** detectar la publicación de nuevas OEPs en Q4 sin necesidad de monitorizar manualmente cada boletín.

**Tareas:**
1. Cron `detect-oep-anual` que en Q4 (oct-dic) y Q1 (ene-mar) escanea boletines buscando patrón "Oferta de Empleo Público [año]" + "Decreto X/YYYY".
2. LLM Haiku extrae: administración, año, cuerpos afectados, plazas por cuerpo.
3. UPSERT en `discovered_processes` con `source_sensor='boe_api'` o `'pdf_extract'` según el origen.
4. Hito "Publicación OEP {año}" insertado en `discovered_process_milestones`.

**Criterio de éxito:** OEP Estado 2027 (publicación típica nov-dic 2026) se detecta automáticamente en <72h.

### Fase 5 — Detector de extracto BOE (3 días)

**Objetivo:** cuando una convocatoria autonómica/local publique su extracto en BOE-A, dispara automáticamente:
- Hito "Publicación extracto BOE" (status=completed)
- Hito "Apertura plazo inscripción" con fecha calculada (BOE+1 día hábil)
- Hito "Cierre plazo inscripción" con fecha BOE+20 días hábiles
- Update `estado_proceso='inscripcion_abierta'` + `inscription_start` + `inscription_deadline`

**Tareas:**
1. Cron diario `detect-boe-extracto-oposiciones` que llama API BOE estructurada (`boe.es/datosabiertos`) con query: extractos de convocatoria publicados ayer.
2. Match contra `oposiciones` por nombre + administración (fuzzy match con LLM si hace falta).
3. Si match → genera señal `boe_extracto` con score 90 + datos pre-rellenados para auto-apply.

**Criterio de éxito:** extracto BOE Ayto Badajoz Aux Admin (cuando se publique) genera señal en <24h.

### Fase 6 — Panel admin `/admin/discovered-processes` (2 días) — ⛔ DESCARTADA (01/06/2026)

> Manuel descarta el panel propio. En su lugar: **sub-badge morado en el badge de OEPs existente** (estilo Feedbacks, por tipo) que cuenta `discovered_processes` activos como simple aviso. El triaje lo hace Claude por SQL bajo demanda ("revisa las señales"), no una UI dedicada. Implementado en `app/admin/layout.tsx` + `getPendingSignalsCount` (commit cf90a0ee).

**Objetivo (histórico):** Manuel revisa los procesos descubiertos y decide cuáles promover a oposiciones Vence.

**UI:**
- Lista filtrable por (region, subgrupo, año, estado_proceso, manuel_status).
- Cada card muestra: identidad (región + posición + año + BOC), datos (plazas, fechas clave), timeline ordenado de milestones, link al source_url.
- Acciones por card: marcar `watching`, `irrelevant`, o "promover" → este último abre flujo que llama a Claude con los datos pre-rellenados para crear la oposición Vence.
- Vista secundaria `/admin/discovered-processes/promoted`: histórico de los ya creados, con link al slug Vence.

**Endpoints:**
- `GET /api/admin/discovered-processes` (lista paginada con filtros).
- `PATCH /api/admin/discovered-processes/:id` (cambia manuel_status y notes).
- `POST /api/admin/discovered-processes/:id/promote` (marca promoted + dispara flujo de creación).

**Criterio de éxito:** Manuel puede decidir 20 procesos en <10min con info suficiente.

### Fase 6-bis — Dashboard de cobertura `/admin/oep-coverage` (3 días, opcional)

**Objetivo:** visibilidad permanente del estado del sistema (complementaria al panel de Fase 6).

**Métricas a mostrar:**
- Cobertura: % oposiciones activas con ≥2 sensores funcionando.
- Latencia: tiempo entre publicación oficial (cuando se sabe) y detección.
- Health: por cada `detection_source`, last_success vs last_error, % uptime últimas 30d.
- Falsos positivos: % señales `dismissed` vs `applied` por sensor.
- Conversión: % `discovered_processes` que terminaron en `promoted`.

**Criterio de éxito:** una mirada al dashboard responde "¿esta oposición está bien monitorizada?" sin abrir BD.

### Fase 7 — Auto-apply para señales de alta confianza (2 días)

**Objetivo:** reducir trabajo manual del admin para casos triviales.

**Reglas iniciales (conservadoras):**
- Señal `boe_extracto` con score ≥90 y BOE-A confirmado → auto-actualiza `inscription_start/deadline` + `estado_proceso='inscripcion_abierta'` + inserta hitos.
- Señal `timeline_silence` con hito vencido +30d → auto-marca status='completed' (asume que ocurrió).
- Toda auto-apply registra en `oep_detection_signals.applied_by='system'` + envía email a admin.
- Admin puede revertir desde panel.

**Criterio de éxito:** ≥30% señales aplicadas sin intervención humana, 0 cambios erróneos en 30 días.

---

## 4. Costes mensuales estimados

| Concepto | Coste |
|---|---|
| ScrapingBee (Fase 1, opción inicial) | $49 |
| Playwright Lambda (Fase 1, opción largo plazo) | $5-15 |
| Claude Haiku (LLM extracción, ya en uso) | ~$5 incremental por fases nuevas |
| Almacenamiento PDFs extraídos (S3) | <$1 |
| **Total fase de validación** | **~$60/mes** |
| **Total estado estable** | **~$25/mes** |

Comparativa: el coste de un cliente Premium que se da de baja por landing desactualizada >$60.

---

## 5. Métricas de éxito del roadmap

Al cerrar las 7 fases:

- **Cobertura:** ≥95% oposiciones activas con ≥2 sensores reportando health OK.
- **Latencia mediana:** <24h entre publicación oficial y señal generada.
- **Falsos positivos:** <10% de señales se dismissan tras revisión humana.
- **Auto-apply:** ≥30% señales aplicadas sin intervención.
- **Coste:** <$50/mes en estado estable.
- **Tiempo de admin:** <1h/semana de triaje (vs cualquiera de las 2-3h actuales).

---

## 6. Decisiones por tomar antes de empezar

1. **Headless browser:** ScrapingBee ($49/mes plug-and-play) vs Playwright Lambda ($5-15 self-hosted con más ops). Recomendación: empezar SaaS, migrar después si el ROI lo justifica.
2. **Orden de fases:** propuesta orden 0→1→2→3→4→5→6→7. Permitido reordenar si una fase es bloqueante para otra (no lo es).
3. **Quién valida cada fase:** Manuel (humano) durante Fase 0-2 (alta criticidad); Claude Code (autogobierno [[feedback_autogobierno_oep_signals]]) para Fases 3-7 con validación visible.
4. **Política aspiracionales:** ¿auto-crear aspiracional cuando se detecta OEP nueva (Fase 4)? Recomendado sí, con badge "🤖 Detectada automáticamente" hasta revisión humana.

---

## 7. Manuales y código relacionados

- **Manual de seguimiento actual:** `docs/maintenance/oeps-convocatorias-seguimiento.md`
- **Canary y simulaciones:** `docs/roadmap/canary-y-simulaciones.md`
- **Crons OEP existentes:** `backend/src/detect-oep-llm/`, `backend/src/detect-timeline-silence/`, `backend/src/detect-generic-sources/`, `backend/src/check-seguimiento/` (`detect-regional-oeps/` **borrado 01/06/2026**)
- **LLM service:** `backend/src/oep-signals/oep-signals-llm.service.ts`
- **Queries:** `backend/src/oep-signals/oep-signals-queries.service.ts`
- **Panel admin:** `/admin/oep-signals` (existe), `/admin/oep-coverage` (NUEVO en Fase 6)
- **Cabos relacionados:**
  - `[[project_pending_seguimiento_url_genericas]]` (31/05)
  - `[[feedback_siempre_robusto_nunca_chapuzas]]` (31/05)
  - `[[feedback_autogobierno_oep_signals]]` (27/05)
