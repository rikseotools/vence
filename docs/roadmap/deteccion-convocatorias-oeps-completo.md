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

## 1. Diagnóstico del sistema actual

### 1.1 Sensores existentes

| Sensor | Fuente | Mecanismo | Score base | Cron |
|---|---|---|---|---|
| `llm_semantic` | `oposiciones.seguimiento_url` | fetch HTML → cleanHtml → Claude Haiku → entidades estructuradas | 40 | L-V 10:00 UTC |
| `regional_scan` | `detection_sources` (167 fuentes activas) | fetch HTML listado → Haiku → títulos C1/C2 nuevos | 50 | L-V 9:30 UTC |
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

Nueva tabla para OEPs detectadas (separadas de convocatorias):

```sql
CREATE TABLE oeps_detected (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  administracion_key TEXT NOT NULL,   -- 'estado', 'cam', 'jccm', 'ayto_badajoz', etc.
  oep_year INTEGER NOT NULL,
  decreto_referencia TEXT,             -- 'Real Decreto X/YYYY' o 'Decreto autonómico Y/YYYY'
  publicacion_boletin TEXT,            -- 'BOE-A-YYYY-XXX' o 'BOP nº X de DD/MM'
  publicacion_fecha DATE,
  source_url TEXT,                     -- URL del boletín
  cuerpos_afectados JSONB,             -- array de cuerpos C1/C2 con plazas
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  applied_at TIMESTAMPTZ,
  signal_id UUID REFERENCES oep_detection_signals(id),
  UNIQUE (administracion_key, oep_year)
);
```

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

### Fase 3 — BOPs provinciales como `detection_sources` (1 semana)

**Objetivo:** cubrir los 50 BOPs provinciales para detectar convocatorias y OEPs municipales que hoy se nos escapan.

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
3. Insert en `oeps_detected` + genera señal `oep_anual` con score 80.
4. Auto-crea aspiracional en `OnboardingModal` si la combinación (administración, cuerpo) no existe.

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

### Fase 6 — Dashboard de cobertura `/admin/oep-coverage` (3 días)

**Objetivo:** visibilidad permanente del estado del sistema.

**Métricas a mostrar:**
- Cobertura: % oposiciones activas con ≥2 sensores funcionando.
- Latencia: tiempo entre publicación oficial (cuando se sabe) y detección.
- Health: por cada `detection_source`, last_success vs last_error, % uptime últimas 30d.
- Falsos positivos: % señales `dismissed` vs `applied` por sensor.
- Vista por oposición: timeline esperado (próximos hitos según patrón) vs hitos detectados.

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
- **Crons OEP existentes:** `backend/src/detect-oep-llm/`, `backend/src/detect-regional-oeps/`, `backend/src/detect-timeline-silence/`, `backend/src/detect-generic-sources/`, `backend/src/check-seguimiento/`
- **LLM service:** `backend/src/oep-signals/oep-signals-llm.service.ts`
- **Queries:** `backend/src/oep-signals/oep-signals-queries.service.ts`
- **Panel admin:** `/admin/oep-signals` (existe), `/admin/oep-coverage` (NUEVO en Fase 6)
- **Cabos relacionados:**
  - `[[project_pending_seguimiento_url_genericas]]` (31/05)
  - `[[feedback_siempre_robusto_nunca_chapuzas]]` (31/05)
  - `[[feedback_autogobierno_oep_signals]]` (27/05)
