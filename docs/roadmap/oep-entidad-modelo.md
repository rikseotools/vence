# OEP como entidad de primer nivel + desambiguación año OEP/convocatoria (T-108)

> **Estado (25/07/2026):** F0 y F1 **HECHAS** (aplicadas a prod, código en `origin/main`). F2–F4 pendientes.
> Diseño **aditivo, cero pérdida de datos**. Investigación de fondo: 3 agentes + verificación en RDS.

## 1. El problema (medido en RDS)

El modelo `oposiciones` (cuerpo) ─ `convocatorias` (proceso, SSOT, `is_current`, `año` inmutable,
`archived_at`, `convocatorias_history` append-only) ─ vista `oposiciones_ssot` (COALESCE) es **sólido
para el histórico de ciclos** (el rollover **archiva**, no sobrescribe; los `inscritos`/`presentados`/
`plazas_*`/`landing_estadisticas` de cada ciclo quedan intactos). El agujero está en la **dimensión OEP**:

1. **La OEP no es entidad.** Vive como `convocatorias.oep_decreto` TEXT libre (**60%** —91/151— multi-OEP
   concatenadas: *"RD 625/2023, RD 656/2024 y RD 651/2025"*) + `oep_fecha` **una sola** date.
2. **No se puede** representar N OEP con su decreto/fecha/plazas, atribuir plazas por OEP, ni medir el
   **backlog de OEP sin convocar** (hoy vive en `landing_description`, texto; la tabla natural
   `discovered_processes` se retiró).
3. **`año` con doble semántica**: canónica = año de la **convocatoria** (inmutable; la usan schema,
   `rollover_convocatoria`, `convocatoria_ciclo_incoherente`, staleness backend, catálogo) vs. divergente
   `añoOep()` en `lib/convocatoria/historico.ts` (la landing muestra el año de **OEP** derivado de
   `oep_fecha`). La misma fila puede enseñar "2026" al opositor y auditarse como "2025".
4. **Bug de runtime (F0):** `lib/api/oep-signals/queries.ts` hacía `ON CONFLICT (oposicion_id, "año")`,
   pero esa UNIQUE se **eliminó** en `20260718` (multi-por-año, caso Madrid) → no hay índice que lo
   satisfaga → el INSERT del rollover por señal OEP **reventaba**.
5. **`estado_proceso`** (enum de 10) duplicado en ~6 sitios sin fuente única.

## 2. Invariantes que NO se pueden romper (confirmadas)
- **≤1 convocatoria `is_current` + `archived_at IS NULL` por oposición** (`convocatorias_una_vigente_por_oposicion` + trigger `ensure_single_current`). De ella depende que el `LIMIT 1` sin `ORDER BY` de `oposiciones_ssot` sea determinista.
- **`año` inmutable** (trigger `tg_convocatorias_anio_inmutable`).
- **Rollover archiva, no sobrescribe** → cero pérdida de inscritos/plazas/stats por ciclo.

## 3. Diseño (aditivo)

### F0 — arreglo del bug de runtime (HECHO)
Sustituido el `ON CONFLICT (oposicion_id, "año")` por **reanimar-o-insertar**: tras archivar la vigente,
buscar un ciclo del mismo año; si existe → UPDATE a `is_current` (idempotencia); si no → INSERT. El
trigger `ensure_single_current` garantiza la unicidad. `lib/api/oep-signals/queries.ts`.

### F1 — entidad OEP + puente + hub de documentos (HECHO)
Migración `supabase/migrations/20260726_oep_entidad.sql`:
- **`oep`** — una fila por decreto de OEP para una oposición: `oposicion_id`, `año_oep`, `decreto`,
  `fecha`, `ambito` (estatal/autonomico/local), `plazas_*`, `estado` (`aprobada`=backlog | `convocada` |
  `anulada`), `fuente_url`, `doc_key`, **`source_documento_id`** (→ hub). Identidad natural única
  `(oposicion_id, año_oep, decreto)`. Índice de backlog parcial `WHERE estado='aprobada'`.
- **`convocatoria_oep`** — puente N:M (`convocatoria_id`, `oep_id`, `plazas_aportadas`). Modela **N OEP → 1
  convocatoria** (acumulación) y **1 OEP → N convocatorias** (turno libre + promoción interna).
- **`convocatoria_documentos.oep_id`** — enlace inverso; el hub ya soportaba `tipo='oep_decreto'`. `fuente`
  ampliada con `oep-backfill`/`oep-radar`.
- **Backfill** `scripts/oep/backfill-oep-entidad.cjs` (parser puro `parseOepDecreto`): 147 convocatorias →
  **269 OEP** (75 multi-OEP) + 269 enlaces + **69 en backlog**. NO borra `oep_decreto`/`oep_fecha` (legacy).
- **Clonado** `scripts/oep/clonar-oep-documento.cjs` (`clonarOepDoc`): reutiliza `canonicalizeBoletinUrl` +
  `ensure_convocatoria_documento`. Demostrado: **6 OEP estatales** (RD 625/2023 → BOE-A-2023-16191, RD
  651/2025 → BOE-A-2025-14783) con el decreto **verbatim** clonado en el hub.

### F2 — repuntar lectores (PENDIENTE)
- `añoOep()` deriva del enlace estructurado `oep` (min/max `año_oep`), no del slice de `oep_fecha`.
- Vista/endpoint de **backlog de OEP** (`oep WHERE estado='aprobada'` sin convocatoria convocada).
- Arreglar el `ORDER BY c."año"` engañoso (`lib/api/convocatoria/queries.ts:341`).
- `año` se QUEDA como año de convocatoria (demasiado depende de él); el año-OEP se DERIVA.

### F3 — cablear el radar (PENDIENTE)
- `promoteSignalToConvocatoria` crea/enlaza la entidad `oep` y **clona su `source_url`** (el radar ya lo
  captura) con `fuente='oep-radar'` → las OEP nuevas se clonan **solas**. FK opcional señal→oep.
- La señal capta `detected_decreto`/`detected_oep_fecha` (hoy no lo hace).

### F4 — deprecar el texto (PENDIENTE)
- Cuando no queden lectores de `oep_decreto`/`oep_fecha`, marcarlos legacy y (opcional) derivarlos de la
  entidad. `estado_proceso` a fuente única (un módulo que alimente CHECK + advance-estado + schemas LLM).

## 4. Clonado de documentos OEP — estrategia (la parte "todo clonado")
- **Forward (F3):** automático. El radar ya trae `source_url` de cada OEP detectada → `oep-radar`.
- **Backward (histórico):** las 269 OEP del backfill nacen sin URL (el texto no la trae). Se resuelven
  **incrementalmente**, como los epígrafes: estatales (RD/RDL) → BOE (buscador/WebSearch → `BOE-A-…`);
  autonómicas/locales → su boletín (curl / Playwright si hay WAF). Ya clonadas las estatales AGE más
  citadas (RD 625/2023, 651/2025). El resto: cola de resolución (mismo patrón que T-107).

## 5. Garantía de no-pérdida de datos
Todo son tablas NUEVAS en paralelo. NO se toca `convocatorias` ni el rollover; los ciclos se siguen
**archivando** (inscritos/plazas/stats intactos); `convocatorias_history` sigue append-only. El backfill
**lee** `oep_decreto`, no borra. `oep_decreto`/`oep_fecha` se conservan como legacy hasta F4.
