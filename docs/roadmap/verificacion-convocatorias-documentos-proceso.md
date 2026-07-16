# Verificación de convocatorias + documentos del proceso (fuente única de la verdad)

> **Estado:** diseño (16/07/2026). Disparado por el feedback de Marta Benito (fecha de examen de
> "Administrativo de la Comunidad de Madrid" mostraba nov-2027; las bases oficiales —Orden 1634/2026,
> base 9— dicen **mayo de 2027**). Nuestro `exam_date` era una estimación (`approximate=true`) que
> nunca se reconcilió con el documento oficial.

## Objetivo

Que **un proceso (OEP → convocatoria) tenga vinculados TODOS sus documentos oficiales** (decreto de
OEP, bases, temario, correcciones de errores, listas de admitidos, resoluciones del tribunal, anuncio
de fecha de examen…), cada uno con **URL + tipo + extracto literal + hash + fecha**, de modo que:

1. Se vea el **proceso entero unido** (vista de auditoría).
2. Cada dato de la landing (`exam_date`, `plazas_*`, calendario) **apunte a su documento-fuente + cláusula literal** (provenance, cero invención).
3. **Nosotros detectemos** los descuadres contra la fuente oficial, sin esperar a que un opositor los reporte.
4. Sea **robusto (auto-invalidación por hash), escalable (corpus pequeño por proceso) y fiable (NUNCA auto-flip; verificación humana/Claude-en-el-bucle)**.

## Principio rector: REUTILIZAR, no duplicar

Casi toda la fontanería existe. El diseño se apoya en:

- **`detect-notas-convocatoria`** (`backend/src/detect-notas-convocatoria/`): ya extrae los links a PDF de la `seguimiento_url`, lee cada PDF a texto (`pdf-parse` vía `fetchPdfText`, valida magic bytes, tope 8 MB), escanea con regex y llama a un LLM Haiku que devuelve JSON con **`fecha_examen`, `software_versions`, `citas[]` (cita literal), `confianza`**. Persiste en `convocatoria_notas` (`url`, `content_hash`, `signals` jsonb, `llm_extraction` jsonb, `confianza`, `needs_manual`). **Esta es la mitad cara del sistema y YA está.**
- **Patrón de verificación con auto-invalidación por hash** (`topic_epigrafe_verification`, migración `20260710_topic_epigrafe_verification.sql`): el gemelo S2 es el molde exacto — verifica un dato PROPIO contra una **fuente externa**, guarda **dos hashes** (dato propio + fuente), invalida el dato propio por **trigger** y el drift contra la fuente por **VISTA derivada** (no trigger frágil cross-tabla), con **gate CI** que caza filas verificadas cuyo hash ya no cuadra.
- **`content_health_findings` + `health-sweep.cjs` + `runbookRegistry.ts`**: para emitir el hallazgo (kind → frase-gatillo → runbook).
- **`oep_detection_signals`**: trigger rico ya existente (trae `detectedFechaExamen`, `detectedPlazas*`, `rawExtraction`); NUNCA auto-aplica (patrón del repo).

## Modelo de datos

### 1. Registro de documentos del proceso — generalizar `convocatoria_notas` → `convocatoria_documentos`

`convocatoria_notas` ya es un registro parcial de documentos (1 fila por PDF con `url`, `content_hash`,
`llm_extraction`, `citas`). Se **generaliza** (no se crea tabla paralela) a un registro de documentos
del proceso:

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `convocatoria_id` | uuid FK → `convocatorias(id)` | nexo con la OEP (vía `convocatorias.oep_*`) |
| `tipo` | text CHECK | `oep_decreto \| bases \| temario \| correccion_errores \| lista_admitidos \| resolucion_tribunal \| anuncio_fecha \| nota \| otro` |
| `url` | text | URL del documento oficial (BOCM/BOE/sede) |
| `titulo` | text | título humano |
| `content_hash` | text | `sha256` del texto extraído (detecta enmiendas) |
| `extracted_text` | text | **snapshot del texto** (durabilidad frente a link-rot; bounded: pocos docs/proceso) |
| `llm_extraction` | jsonb | `{ fecha_examen, plazas_*, citas:[{campo, cita_literal, base}], confianza }` |
| `confianza` | int | 0-100 (del LLM) |
| `fuente` | text | `detect-notas \| radar \| seguimiento \| manual` |
| `fetched_at` / `created_at` | timestamptz | |

> El **snapshot `extracted_text`** es la única concesión al "Sistema A" (espejo): se guarda el texto UNA
> vez, como evidencia, no como corpus que se re-parsea en vivo. Da durabilidad sin el coste del espejo total.

### 2. Verificación de convocatoria — `convocatoria_verification` (calcado a S2)

Estado de verificación de los campos de proceso de una convocatoria contra su(s) documento(s).

| Columna | Tipo | Notas |
|---|---|---|
| `convocatoria_id` | uuid **PK** + FK → `convocatorias(id) ON DELETE CASCADE` | 1 fila / convocatoria |
| `state` | text NOT NULL DEFAULT `'never_verified'` | CHECK: `never_verified \| verifying \| verified_correct \| verified_issues \| needs_human \| stale \| outdated_documento` |
| `verified_data_hash` | text | hash de los campos PROPIOS (ver `compute_convocatoria_hash`) en el instante del veredicto |
| `verified_source_hash` | text | `content_hash` del documento-fuente en ese instante (huella de la FUENTE externa) |
| `source_documento_id` | uuid FK → `convocatoria_documentos(id) ON DELETE SET NULL` | el documento contra el que se verificó |
| `verdict` | text | `correct \| issues \| needs_human \| null` |
| `findings` | jsonb | provenance: `{ exam_date:{db, oficial, cita, base}, plazas:{...} }` |
| `verified_by` / `agent_run_id` | text | quién/qué run |
| `verified_at` / `created_at` / `updated_at` | timestamptz | |

+ tabla `convocatoria_verification_history` (append-only, gemela) + índice sobre `state`.

### 3. `compute_convocatoria_hash(id)` — `LANGUAGE sql STABLE`

`md5()` de los campos de proceso que definen la convocatoria, con `coalesce(...,'')` y separadores
literales (calcado a `compute_topic_scope_hash`):

```
md5( coalesce(exam_date::text,'') || '|' || coalesce(exam_date_approximate::text,'') || '|'
     || coalesce(plazas_libres::text,'') || '|' || coalesce(plazas_promocion_interna::text,'') || '|'
     || coalesce(plazas_discapacidad::text,'') || '|' || coalesce(estado_proceso,'') || '|'
     || coalesce(inscription_start::text,'') || '|' || coalesce(inscription_deadline::text,'') )
```

### 4. `record_convocatoria_verification(...)` — `plpgsql` (única vía legítima)

Valida `verdict` (RAISE si inválido) → captura `v_data_hash := compute_convocatoria_hash(id)`
internamente (el caller NO lo pasa) → recibe `p_source_documento_id` + `p_source_hash` del caller
(vienen del documento) → UPSERT en estado + INSERT en history.

### 5. Invalidación (el corazón)

- **Dato propio cambia → trigger.** `AFTER UPDATE OF exam_date, exam_date_approximate, plazas_libres, plazas_promocion_interna, plazas_discapacidad, estado_proceso, inscription_start, inscription_deadline ON convocatorias FOR EACH ROW`: `UPDATE convocatoria_verification SET state='stale' WHERE convocatoria_id=NEW.id AND state IN ('verified_correct','verified_issues') AND verified_data_hash IS DISTINCT FROM compute_convocatoria_hash(NEW.id)`.
- **La fuente (documento) cambia → VISTA derivada, no trigger.** `convocatoria_verification_effective` compara `verified_source_hash` contra el `content_hash` VIVO del `source_documento_id`; si difieren → `outdated_documento`. **Guardarraíl S2:** solo marcar outdated cuando AMBOS hashes están poblados (evita falso outdated mientras `detect-notas` aún no ha corrido).
- **Gate CI** (`verify:convocatoria gate`): cuenta filas `verified_*` con `verified_data_hash != compute_convocatoria_hash(id)`; si >0 → exit 1. Caza un trigger que no disparó.

## Flujo (disparadores)

1. ~~**Capa C — heurística barata (parche inmediato, sin PDF).**~~ **DESCARTADA (16/07/2026).** Era un andamio para el mundo en que `convocatoria_verification` NO existía; se diseñó como paso 1 para ganar tiempo hasta el paso 3. Al construirse el paso 3 primero, su razón de ser desapareció. **No implementar** — ver §Capa C': el sensor sobre el estado REAL.

   **Por qué era una chapuza (con datos, no opinión):** usaba `exam_date_approximate` como proxy de "sin verificar", pero **son conceptos ortogonales**. `approximate` mide la **precisión** de la fecha ("mayo de 2027" vs "1-may-2027"); lo que queremos saber es la **procedencia** ("¿contrastado contra el documento oficial?"). Cruce real en RDS (16/07, convocatorias `is_current`):

   | verificación | `approximate` | n |
   |---|---|---|
   | `never_verified` | false | **2.462** |
   | `never_verified` | true | 20 |
   | `never_verified` | null | 7 |
   | `verified_correct` | true | **1** |

   - **Falso positivo sobre el caso que la motivó:** `administrativo-madrid` es `approximate=true` **y** `verified_correct` (la base 9 dice literalmente "mayo de 2027" → aproximada es la respuesta CORRECTA). La Capa C la marcaría "sin verificar".
   - **Ciega a 2.462 filas:** fechas `approximate=false` que nadie contrastó jamás — *parecen* precisas y son las Martas que quedan. La heurística no las ve.
   - **Regla ambigua:** `estado IN (...)` **Y** `(approximate O null)` **O** `state=never_verified` no tiene precedencia legible: o dispara sobre las 2.489 (inundación del inbox — el fallo de la Capa 3 del radar, 2.053 señales) o se deja 2.462. Que no se pueda leer sin ambigüedad ya era la señal.

1-bis. **Capa C' — sensor de cobertura sobre el estado REAL (sustituye a la Capa C).** Lee `convocatoria_verification_effective.effective_state` (la SSOT), no un proxy: emite finding cuando una convocatoria **que el usuario ve** está `never_verified`/`stale`. Exacto por construcción (Marta no dispara; las 2.462 sí), **menos** código que la heurística, y se mantiene solo (el trigger ya degrada a `stale` al tocar cualquier campo de proceso). **Priorizar por impacto, no por existencia:** ordenar por oposición activa + usuarios + proceso vivo. 2.489 hallazgos no es observabilidad, es ruido — y el ruido es cómo llegamos a Marta.
2. **Capa B — reconciliación con el documento oficial.** Extender `detect-notas-convocatoria` para: (a) extraer también `plazas_*`, (b) escribir el `convocatoria_documentos`, (c) **reconciliar** lo extraído vs `oposiciones_ssot` (lo que ve el usuario). Si el LLM devuelve un `fecha_examen`/`plazas` con confianza alta que **NO cuadra** con la BD → `content_health_finding` (`kind='convocatoria_exam_date_mismatch'` / `'convocatoria_plazas_mismatch'`) con `detail={db, oficial, cita, base, url}`. **NUNCA auto-flip:** el hallazgo lo revisa Claude/humano y corrige con `record_convocatoria_verification` + dual-write a `convocatorias`+`oposiciones` (gotcha COALESCE).
3. **Disparadores de re-verificación:** el cron `check-seguimiento` (hash coarse de la `seguimiento_url` → `seguimiento_change_status='changed'`) y el radar señalan "algo cambió" → re-corre `detect-notas` → nuevo `content_hash` de documento → la vista pone la verificación `outdated_documento` → re-verificar.

## Vista unificada del proceso (panel)

`/admin/oposiciones/[slug]` (o pestaña en `/admin/contenido`): **OEP → convocatoria(s) → documentos**
(`tipo · url · fecha · hash · extracto/cita`) **→ estado de verificación por campo** (`exam_date`,
`plazas`, calendario) con su cláusula-fuente. Opcional: exponer la provenance en la landing pública
("fuente: BOCM Orden 1634/2026, base 9").

## Modos de fallo cubiertos

- **Multi-documento** (bases + temario + correcciones + listas): el registro los guarda todos; la verificación apunta al documento + cláusula concreta de cada campo.
- **Correcciones de errores** (frecuentes en BOCM/BOE): documento nuevo → `content_hash` nuevo → `detect-notas` re-fetch → fila nueva en el registro → verificación `outdated_documento` → re-verificar.
- **Link-rot** (PDF movido/retirado): `extracted_text` es el snapshot durable; la evidencia no se pierde.
- **Fechas por mes** ("mayo de 2027", sin día): se guarda `exam_date` con `exam_date_approximate` y la CITA literal manda; la verificación registra el match a nivel mes.
- **Proceso sin documento aún** (rollover con estimación): `state='never_verified'`; la Capa C lo marca por `inscripcion_abierta + approximate/null`.
- **Gotcha COALESCE de `oposiciones_ssot`**: la reconciliación LEE de la vista (lo que ve el usuario); las correcciones se escriben **dual-write** a `convocatorias` **y** `oposiciones`.
- **Falsos positivos**: solo se emite `mismatch` con confianza LLM alta; solo `outdated_documento` cuando ambos hashes poblados (guardarraíl S2). Sensor de seguimiento es coarse a propósito (`normalizeForHash` borra ruido de fechas/horas).
- **NUNCA auto-flip**: un descuadre es un `finding` para revisar, jamás un `UPDATE exam_date` automático. Coherente con todo el repo.
- **PDF firmado/comprimido**: `pdf-parse`/`fetchPdfText` ya lo maneja en `detect-notas` (precedente probado).
- **Concurrencia de escritores**: `record_*` no tiene optimistic-lock; el gate CI hace de red (como en scope). Si hiciera falta, añadir `expected_state` al estilo `transition_question_state`.

## Secuencia recomendada

> **Actualizada 16/07/2026.** La secuencia original arrancaba por la Capa C (andamio) y dejaba la
> verificación para el paso 3. Se hizo el paso 3 primero → el andamio sobra (ver arriba). Orden real:

1. ✅ **HECHO (16/07)** — **`convocatoria_verification`**: tabla + `compute_convocatoria_hash` + `record_convocatoria_verification` + trigger de auto-invalidación + vista `_effective`, migración `20260716_convocatoria_verification.sql` (**aplicada en RDS**) + tests de integración aislados + columna "Proceso" en `/admin/contenido`. Caso Marta cerrado: `administrativo-madrid` → `exam_date` 1-may-2027 `approximate`, `verified_correct` contra BOCM Orden 1634/2026 base 9 (provenance: `source_url` + cita literal). Gate de coherencia: 0 filas desincronizadas.
2. ~~**Capa C**~~ **DESCARTADA** — no implementar. Sustituida por la **Capa C'** (sensor sobre `effective_state`, ver §Flujo 1-bis): barato, exacto, prioriza por impacto.
3. **`convocatoria_documentos`** (generalizar `convocatoria_notas`) + extender `detect-notas` a plazas + reconciliación → findings. **Es lo que de verdad ESCALA:** un sensor de cobertura dice *"no lo has mirado"* (necesita un humano por convocatoria → no escala a 2.489); la reconciliación dice *"el BOCM dice mayo y tú muestras noviembre"* (la máquina canta el descuadre sola). La mitad cara (PDF→texto→Haiku→`citas[]`+confianza) **ya existe** en `detect-notas-convocatoria`. Mantener **NUNCA auto-flip**: el descuadre es un finding para revisar, jamás un `UPDATE exam_date`.
4. **Vista unificada del proceso** en el panel (OEP → convocatoria(s) → documentos → verificación por campo).

**Gate CI (`verify:convocatoria gate`)** y `outdated_documento` (drift contra la fuente por vista derivada)
quedan pendientes: el primero es trivial y caza un trigger que no dispare; el segundo requiere el paso 3
(no hay `content_hash` vivo de documento contra el que comparar hasta que exista el registro).

Acotar primero a **convocatorias activas / `inscripcion_abierta`** (donde el usuario ve la landing y el
error duele); las catalogadas-sin-preparar, después.

## Ficheros de referencia

- Patrón verificación: `supabase/migrations/20260710_topic_epigrafe_verification.sql`, `20260710_topic_scope_verification.sql`, `scripts/verify-topic-scope.cjs` (subcomando `gate`).
- Extracción PDF+LLM ya montada: `backend/src/detect-notas-convocatoria/`, `supabase/migrations/20260627_convocatoria_notas.sql`.
- Datos convocatoria: `db/schema.ts:508-552` (convocatorias), `db/oposicionesSsot.ts`, `supabase/migrations/20260706_oposiciones_ssot_view.sql`, `lib/api/convocatoria/queries.ts`.
- Seguimiento/radar: `backend/src/check-seguimiento/`, `backend/src/radar/`, `db/schema.ts:3863-3897` (oep_detection_signals).
- Findings: `supabase/migrations/20260710_content_health_findings.sql`, `scripts/health-sweep.cjs`, `lib/admin/runbookRegistry.ts`.
