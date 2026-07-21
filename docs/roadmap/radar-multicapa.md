# Roadmap — Radar multi-capa de convocatorias (arquitectura definitiva)

> **Misión (Manuel, 04/07/2026):** Vence = **la base de datos de oposiciones catalogadas más grande y fresca de España**. Foso = completitud + frescura + señal de demanda. Se cataloga **TODO** (A1/A2/B/C1/C2/AP, sin gaps); se **ejecuta** (landing/tests) solo el subconjunto vendible. Memoria: `project_mision_bd_oposiciones_mas_grande`.

## 1. Principio: catalogar ≠ ejecutar

| Tier (`coverage_level`) | Qué es | Cómo se puebla |
|---|---|---|
| `con_tests` / `con_landing` | Vendible, construido | A mano (negocio) |
| `catalogada` (`is_active=false`) | Solo radar/datos, TODOS los grupos | **Radar automático**, sin descartar por vendibilidad |

- `oposiciones.position_group` (A1/A2/B/C1/C2/AP) etiqueta cada fila → la **prioridad es el grupo, no la exclusión**. A1/A2 se catalogan y vigilan igual; simplemente no se ejecutan.
- Descartar es la EXCEPCIÓN con criterio objetivo (manual `oeps-convocatorias-seguimiento.md` §0-§1).

## 2. Arquitectura: capas en cascada de adapters + orquestador + core compartido

```
        Capa 1  BOLETINES OFICIALES   (fuente de verdad; BOE + 17 CCAA + BOPs)
           │  lo que no publica en boletín / no leemos aún
        Capa 2  AGREGADOR OFICIAL     (administracion.gob.es — PAG)
           │  lo que el agregador nacional no tiene/tarda (locales CAT/BAL…)
        Capa 3  COMPETIDORES          (oposiciones.es, opositatest…) = red de seguridad Y detector de gaps
```

**Anti-gaps por construcción:** la Capa 3 audita a las capas oficiales. Si un competidor detecta algo que la Capa 1/2 no vio → **gap-alert** con el boletín que falta → se cierra añadiendo ese adapter. El sistema **se autocompleta**.

### Estructura de ficheros (un fichero por FUENTE)

```
backend/src/radar/
├── core/
│   ├── types.ts          # SourceAdapter, RawCandidate, DiscoverySignal, Layer, ScanContext
│   ├── filters.ts        # INGRESO_RE / NOISE_RE / ALLOWED_GROUPS / classifyGroup()
│   ├── extract.ts        # extracción LLM (delegada a OepSignalsLlmService)
│   ├── match.ts          # oep-match → fila del catálogo o novel
│   ├── dedupe.ts         # clave de dedup por REF OFICIAL (no por URL)
│   ├── persist.ts        # insertSignal (OepSignalsQueriesService)
│   ├── pipeline.ts       # filter→extract→match→dedupe→persist (compartido)
│   └── telemetry.ts      # ★ observabilidad total (ver §4)
├── layers/
│   ├── boletines/registry.ts   + boe.ts bocyl.ts dogc.ts boib.ts borm.ts … (1 fichero/boletín)
│   ├── aggregators/registry.ts + pag-empleo.ts
│   └── competitors/registry.ts + oposiciones-es.ts opositatest.ts (1 fichero/competidor)
├── orchestrator.ts       # corre las 3 capas en cascada + dedup cross-capa + gap-audit + telemetría
├── coverage-audit.ts     # reconciliación competidor↔oficial → gap-alerts
└── radar.cron.ts         # scheduler → orquestador
```

### Contrato único (todas las fuentes lo implementan)

```ts
export type Layer = 'boletin' | 'aggregator' | 'competitor';

export interface SourceAdapter {
  key: string;                 // 'dogc', 'oposiciones-es'
  layer: Layer;
  priority: number;            // orden de cascada (menor = antes)
  regionName?: string;
  scan(ctx: ScanContext): Promise<RawCandidate[]>;  // SOLO fetch + parse
}
```

Los adapters son "tontos" a propósito: solo saben buscar y parsear su fuente. Todo lo inteligente (filtro, LLM, match, dedup, persistencia) vive **una vez** en `core/`.

## 3. "Catalogar TODO" — cambios de filtro (Fase 0)

- `ALLOWED_GROUPS` → **todos** (A1, A2, B, C1, C2, AP, E). Ya no se descartan grupos altos.
- `NOISE_RE`: **quitar** exclusiones de grupo (`subgrupo a1/a2`, `cuerpo superior`, `profesor`, `facultativo superior`); **mantener** las de no-convocatoria (`lista de admitidos`, `nombramiento`, `adjudicación`, `relación de aspirantes` — son hitos, no convocatorias).
- `detect-pag-empleo`: añadir `idGrupo` 1/2/3 (A1/A2/B) a 4/5/6.
- Añadir `oposiciones.position_group` + backfill.

## 4. ★ Observabilidad TOTAL del radar

> Objetivo: saber en todo momento **qué radar/proveedor/boletín funciona, cuál falla, cuál encuentra cosas, y dónde hay gaps** — sin adivinar.

### 4.1 Modelo de telemetría

Cada ejecución del orquestador = un **run**. Dentro, cada adapter = un **adapter-run**. Se persiste en tabla dedicada (para dashboard/histórico) **y** se emite a `observable_events` (espina cross-runtime).

```sql
CREATE TABLE radar_adapter_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id         uuid NOT NULL,                 -- agrupa todos los adapters de una pasada
  layer          text NOT NULL,                 -- boletin | aggregator | competitor
  adapter_key    text NOT NULL,                 -- boe, dogc, oposiciones-es…
  status         text NOT NULL,                 -- ok | empty | failed | timeout | skipped
  started_at     timestamptz NOT NULL,
  duration_ms    integer,
  items_scanned  integer DEFAULT 0,             -- p.ej. días/sumarios/tarjetas leídas
  candidates     integer DEFAULT 0,             -- candidatos crudos tras parseo
  signals_new    integer DEFAULT 0,             -- señales nuevas insertadas
  signals_dupe   integer DEFAULT 0,             -- deduplicadas (ya vistas)
  http_status    integer,
  error_message  text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_radar_adapter_runs_run   ON radar_adapter_runs (run_id);
CREATE INDEX idx_radar_adapter_runs_key   ON radar_adapter_runs (adapter_key, created_at DESC);
CREATE INDEX idx_radar_adapter_runs_status ON radar_adapter_runs (status, created_at DESC);
```

### 4.2 Taxonomía de eventos (`observable_events.event_type`)

| event_type | Cuándo | Severidad |
|---|---|---|
| `radar_run` | inicio/fin de una pasada del orquestador (totales por capa) | info / warn |
| `radar_adapter_ok` | un adapter corrió y devolvió candidatos | debug |
| `radar_adapter_empty` | corrió pero sin candidatos (¿boletín vacío o URL rota?) | debug |
| `radar_adapter_failed` | fetch/parse falló (proveedor caído, HTML cambió, WAF) | **warn** |
| `radar_adapter_timeout` | superó el timeout | **warn** |
| `radar_signal_new` | señal nueva insertada (qué encontró) | info |
| `radar_gap_detected` | competidor vio algo que ninguna capa oficial → **falta un boletín** | **warn** |
| `radar_provider_degraded` | un adapter falla N runs seguidos → proveedor degradado | **error** |

`metadata` siempre lleva `{ runId, layer, adapterKey, ... }` para poder reconstruir todo.

### 4.3 Panel `/admin/radar-salud` (dashboard)

- **Semáforo por adapter** (verde/ámbar/rojo) según el último run y la racha de fallos.
- **Cobertura Capa 1:** X/19 boletines leídos hoy con éxito (canario `seguimiento_last_hash IS NULL` equivalente).
- **Qué encontró:** señales nuevas por capa/adapter en las últimas 24h/7d.
- **Gaps abiertos:** lista de `radar_gap_detected` sin resolver → boletines que faltan por añadir.
- **Proveedores degradados:** adapters con racha de fallos (competidor que cambió el HTML, boletín caído).
- Consultas base:
  ```sql
  -- salud por adapter (último run)
  SELECT DISTINCT ON (adapter_key) adapter_key, layer, status, duration_ms, signals_new, error_message, created_at
  FROM radar_adapter_runs ORDER BY adapter_key, created_at DESC;
  -- proveedores con racha de fallos (≥3 de los últimos 5)
  -- gaps abiertos
  SELECT metadata->>'cuerpo', metadata->>'boletinFaltante', created_at
  FROM observable_events WHERE event_type='radar_gap_detected' ORDER BY created_at DESC;
  ```

### 4.4 Reglas de observabilidad (innegociables)
- **Ningún adapter puede tumbar la pasada:** try/catch por adapter, fail-open, se registra el fallo y se sigue.
- **Todo run deja rastro** aunque no encuentre nada (un `radar_adapter_empty` es información: distingue "no hay convocatorias" de "el fetch se rompió").
- **Racha de fallos = alerta:** N runs seguidos fallando un adapter → `radar_provider_degraded` (error) → semáforo rojo.
- **Filosofía martillo** (manual observabilidad): si un competidor detecta algo que nosotros no, la observabilidad lo captura como gap; no puede pasar en silencio.

## 5. Dedup por referencia oficial (cross-capa)

- La `dedupeKey` se estandariza a la **ref oficial** normalizada (boletín + nº disposición/fecha), NO a la URL de origen.
- Una convocatoria vista por Capa 1, 2 y 3 → **una sola señal**, atribuida a la de mayor prioridad. Las otras capas suman `signals_dupe` en su telemetría (útil para medir solape/cobertura).

## 6. Fases

0. **`position_group` + abrir filtros** (ALLOWED_GROUPS todos, NOISE_RE sin exclusión de grupo, PAG idGrupo 1/2/3). Backfill grupo.
1. **Capa 1 ancha:** migrar BOE/BOCYL a `radar/layers/boletines/` + añadir los 17 CCAA (empezar DOGC/BOIB/BORM = hueco confirmado). 1 fichero + 1 test por boletín.
2. **Dedup por ref oficial** + `coverage-audit` (reconciliación) + tabla `radar_adapter_runs` + panel `/admin/radar-salud`.
3. **Capa 3 competidores:** `oposiciones-es.ts` (sin WAF, enlaces oficiales) como gap-detector; luego `opositatest.ts`.
4. **BOPs selectivos** guiados por los `radar_gap_detected`.

## 7. Robustez / profesional
- Registry-driven: añadir fuente = 1 fichero + 1 línea de registro + 1 test. Cero cambios en core/orquestador.
- Adapters puros y testeables con fixtures HTML (`dogc.spec.ts`, `oposiciones-es.spec.ts`).
- Idempotente (dedup + upsert). Buen ciudadano en competidores (rate-limit, cache, UA, robots.txt).
- Migración limpia: `detect-boletines`/`detect-pag-empleo` actuales **ya son adapters** → se mueven a `radar/layers/` casi tal cual.

## 8. Estado / gotchas heredados (leer antes de tocar)
- Fetch **plano, no navegador** (manual §0.2): solo fuentes server-rendered/API. oposiciones.es cumple (Apache/WP sin Cloudflare).
- Competidor = **solo pista**; el dato real se verifica en el boletín oficial que enlaza su detalle (nunca fuente no-oficial como verdad).
- Sensores actuales: `detect-boletines` (BOCYL+BOE), `detect-pag-empleo` (PAG), `detect-generic-sources`, `detect-timeline-silence`, `detect-oep-llm`, `detect-notas-convocatoria` → todo `oep_detection_signals`. Ver `docs/maintenance/oeps-convocatorias-seguimiento.md`.

## 9. Estado de implementación (04/07/2026)

| Fase | Estado | Detalle |
|---|---|---|
| 0 — catalogar TODO + observabilidad | ✅ | Migración aplicada (`radar_adapter_runs`, `oposiciones.position_group`, `sensor_type='competitor'`). Filtros abiertos a todos los grupos: `ALLOWED_GROUPS` eliminado, `NOISE_RE` sin exclusión de grupo, PAG `GRUPOS=[1..6]`, prompt LLM reescrito. Queries `insertRadarAdapterRun`/`radarAdapterFailStreak`. Tests actualizados. |
| 1 — orquestador + Capa 3 | ✅ | `backend/src/radar/`: `core/{types,telemetry}`, `orchestrator`, `radar.cron` (diario 07:00 UTC), `RadarModule` registrado. Adapter `competitors/oposiciones-es` + tests. Wrap BOE/BOCYL listo (`LEGACY_BOLETINES_WRAPPED`, **sin registrar** para no duplicar con `detect-boletines.cron`). |
| 2 — panel salud | ✅ | `/admin/radar-salud` + API `/api/admin/radar-salud` + `lib/api/radar-salud/queries`. Semáforo por adapter/capa, señales 7d, gaps, degradados. Enlace en nav. |
| 2b — preExtracted + PAG | ✅ | `RawCandidate.preExtracted` (salta LLM). Adapter `aggregators/pag-empleo` (`PAG_WRAPPED`, **sin registrar** hasta retirar `detect-pag-empleo.cron`). |
| 1b — boletines CCAA nuevos | ⬜ | DOGC/BOIB/BORM NO son fetch-plano (DOGC=SPA, BORM=captcha Radware) → método §16bis. Hueco ya cubierto por Capa 3. Priorizar los que tengan API/HTML (BOJA, BOA, DOG…). |
| Retiro de crons legacy | ⬜ | Al validar el orquestador en prod: retirar `detect-boletines.cron` + `detect-pag-empleo.cron` y activar `LEGACY_BOLETINES_WRAPPED` + `PAG_WRAPPED` (evita el doble-run que hoy se previene no registrándolos). |

**Transición (importante):** mientras convivan los crons legacy y el orquestador, boletines y PAG **NO se registran** en los registries (evita señales duplicadas por dedupe keys distintos). El orquestador solo añade hoy la **Capa 3 (competidores)**, que es capability nueva sin solape. El dedup definitivo es por **ref oficial**.

---
## Sistema selectivo en la extracción (08/07/2026)
El extractor LLM (`oep-signals-llm.service.ts` prompt + `llmExtractionSchema`) ahora captura **`sistema`** (`oposicion`/`concurso-oposicion`/`concurso`, null si no consta) además de `estado`/plazas/fechas. Se guarda en `oep_detection_signals.detected_sistema` y se promueve al Aplicar. Los sensores de boletines/pag-empleo que no lo extraigan lo dejan null (se completa al verificar).

## Sensor `nota_examen` — fecha de examen de convocatoria ya trackeada (21/07/2026)
**Qué cierra:** el radar (todas sus capas) descubre convocatorias/OEPs NUEVAS, no HITOS dentro de una convocatoria ya trackeada. Cuando una página que ya vigilamos publica "el primer ejercicio será el DD/MM", ningún camino automático lo convertía en alerta. El sensor retirado `hash_change` (whole-page SHA-256, 4% de acierto) tampoco: no extraía fechas. Punto ciego heredado de T-047/T-050.
- **De dónde sale el dato (sin re-extraer):** el cron `detect-notas-convocatoria` (09:30 UTC) ya baja los PDFs de cada `seguimiento_url` y su LLM rellena `convocatoria_notas.llm_extraction.fecha_examen`. Pero esa tabla **no la leía nadie** (0 triadas de 1.862 notas; 58 oposiciones con fecha ya extraída sin ver). El sensor solo la **superficie**.
- **Cómo:** cron `detect-examenes-signals` (`backend/src/detect-examenes-signals/`, 10:00 UTC, tras notas) lee las notas de **confianza alta** con fecha de examen, se queda con las que son **una fecha de día único inequívoca** (`parse-fecha-examen.ts`), **no capturadas** (sin `exam_date` ni hito `ejercicio_1`), de oposición **viva**, y emite señal `nota_examen` (score 60, `pending`) a `/admin/oep-signals`. Idempotente por `dedupeKey='nota_examen:opoId:fecha'`.
- **NUNCA auto-apply.** El detector es ruidoso: mis-atribuye procesos hermanos de la misma página (caso real 21/07: coló una fecha de *Enfermero* en *Auxiliar Administrativo* de la misma Diputación de Segovia) y extrae fechas de documentos viejos ("15/05/2010"). La fecha la confirma y aplica un humano; la señal solo dice "mira esto". Al Aplicar, `promoteSignalToConvocatoria` fija `exam_date` del ciclo vigente (no se fija `detectedYear`/`detectedEstado` para que no cree un ciclo nuevo por el año de la fecha).
- **Anti-"buzón que grita":** las guardas dejan el primer run en ~1 señal (medido contra RDS 21/07), no en un volcado. Migración `20260721_nota_examen_sensor.sql` (añade `nota_examen` al CHECK de `sensor_type`).
