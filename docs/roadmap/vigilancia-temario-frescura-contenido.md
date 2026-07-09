# Roadmap: Vigilancia de Temario y Frescura de Contenido

> **Estado:** propuesta aprobada (08/07/2026). Fase 1 pendiente de arranque.
> **Origen:** feedback de Martina Marbán (Aux Admin Cantabria, 07/07/2026) avisando de que el temario específico había cambiado (Orden PRE/12/2026, de 10 de febrero, modifica la Orden PRE/76/2024). **Ningún sistema de detección lo cazó.** Investigación: es un GAP estructural, no un bug.

## 1. Problema

Nuestra detección actual vigila **convocatorias** (plazas/fechas/estado, vía `seguimiento_url` + radar OEP multicapa) y **leyes** (texto BOE). Pero un **cambio de temario/programa** es una tercera categoría que cae entre las grietas:

- No es convocatoria nueva → seguimiento/radar no lo ven (vive en otro documento: una Orden de *programas*).
- No es cambio de ley → el cron de leyes vigila el texto de leyes, no el programa de materias de un cuerpo.
- Los competidores lo reflejan, pero no modelamos el diff de su temario como señal.

**Evidencia del gap (08/07/2026):**
- **0 de 450** `oposiciones.seguimiento_url` apuntan a un temario/programa; todas apuntan a la convocatoria (plazas/fechas/resultados).
- La de Cantabria monitoriza `empleopublico.cantabria.es/.../cuerpo-general-auxiliar` — que **no contiene el temario**. Aunque el hash-diff funcione, jamás verá el cambio.
- `oep_detection_signals` no tiene ni `sensor_type` ni columnas para "temario modificado": su esquema es de plazas/fechas (`detected_plazas_libre`, `detected_fecha_examen`, `detected_estado`…).

**Norte:** garantizar de forma continua y redundante que *nuestro temario == programa oficial vigente*. Filosofía observabilidad: **si un usuario nos avisa de un cambio de temario, hemos fallado.**

## 2. Arquitectura (multi-modal sweep, sin puntos ciegos)

Cuatro piezas desacopladas. Varios detectores independientes; lo que a uno se le escapa, otro lo pilla.

### 2.1 Fuentes (N por oposición)
Nueva tabla `oposicion_monitored_sources`:
- `oposicion_id`, `url`, `source_type`, `last_hash`, `last_checked`, `change_status`, `change_detected_at`, `extractor_hints` (JSONB), `is_active`.
- `source_type ∈ {convocatoria, temario_programa, avisos_tribunal, boc_orden_programas}`.
- Migra los 450 `seguimiento_url` actuales a filas `source_type='convocatoria'` (compat).
- **`avisos_tribunal`**: tablón/avisos del tribunal — ahí publican a mitad de proceso "el examen será sobre Windows 11", erratas, etc. Hoy invisible.

### 2.2 Detectores pluggables (1 módulo = 1 detector, como los adapters de competidores)
- `orden_programas` — vigila en BOE/BOC ordenes que **modifiquen** la norma-fuente del temario ("modifica la Orden X…"). El sensor **autoritativo**.
- `temario_hash_semantic` — hash + extracción semántica sobre la fuente de temario.
- `avisos_tribunal` — cambios en el tablón de avisos.
- `competitor_diff` — diff del índice de temario del competidor vs el nuestro.
- `content_self_audit` — nuestro `topic_scope`/`topics`/leyes/versiones vs la huella canónica.
- `user_report` — feedback del usuario que menciona temario/versión.

Añadir una administración = añadir sus fuentes y **reusar** detectores.

### 2.3 Inbox único de señales
Reusar `oep_detection_signals` con `sensor_type` nuevos (`temario_change`, `content_drift`, `competitor_temario_diff`, `user_reported`) + dedupe → panel de revisión humana estilo `/admin/oep-signals`.

### 2.4 Reconciliación
nuestro-contenido ↔ **spec canónica (huella de temario)** ↔ **oficial**. Oficial = verdad.

## 2bis. Sustrato: ingesta total de boletines oficiales (BOE + autonómicos + BOPs)

Mientras vigilemos solo páginas curadas (una `seguimiento_url` por oposición) seguiremos teniendo puntos ciegos (caso Cantabria). La única forma de que **no se escape nada** es vigilar la **fuente de registro**: BOE + los 17 boletines autonómicos + BOPs provinciales. El ruido NO se combate vigilando menos, sino **filtrando duro aguas abajo** con un embudo de 2 etapas.

**Principio:** ingerir el firehose completo; el objetivo no es cero ruido en la ingesta, es **cero ruido en el inbox humano**.

**Embudo:**
1. **Ingesta por API/sumario, NO por hash de web.** BOE tiene API de datos abiertos (sumario diario XML); muchos autonómicos tienen API/RSS/sumario (BOC, DOGC, BOJA, DOGV, BOA…); los solo-HTML → scraping del sumario. Se ingiere la **lista de disposiciones del día**, barata.
2. **Pre-filtro barato (keywords/entidades):** cada disposición se puntúa contra **nuestro catálogo** — nombres de cuerpos/escalas que preparamos, administraciones que cubrimos, los **números de norma-fuente** de nuestros temarios, y palabras clave (`programa`, `temario`, `bases`, `convocatoria`). El grueso se descarta aquí, gratis.
3. **Clasificador LLM solo sobre los supervivientes:** título+sumario → `{convocatoria, programa/temario, cambio de ley, irrelevante}` + confianza. Caro, pero solo corre sobre lo pre-filtrado.
4. **Al inbox humano solo lo relevante y de alta confianza.** El resto se registra (auditable) pero no molesta.

**Este sustrato es la fuente única** de la que consumen TODOS los detectores: `orden_programas` pasa a ser una consulta sobre el firehose; igual la detección de leyes, de convocatorias nuevas y las señales OEP. Cierra los puntos ciegos **por construcción**.

**Cobertura = nuestro catálogo** (no el universo el día 1): BOE + boletines de las CCAA donde ya preparamos oposiciones; ampliar según añadimos oposiciones. Ya tenemos media base: sensores `boe_api` (28), `regional_scan` (127), `pag_empleo` (80) → hacerlo sistemático y completo.

**Gestión del ruido (lección aprendida):** la Capa 3 (competidores) inundó el inbox OEP (2.053 señales) → se filtró a "huecos con ≥2 competidores". Misma disciplina: umbral de relevancia + dedupe + **medir precisión** (% de señales reales) para tunear. Escala nativo AWS (SQS/Lambda/EventBridge).

## 3. Huella de temario canónica

Extractor LLM sobre la fuente oficial que saca datos **estructurados y versionados** por oposición:
- Versiones de software (Windows 10/11, Office 2016/365…).
- Leyes citadas + fechas/versión.
- Nº de temas + títulos (parte general y específica).
- Norma-fuente del programa (ej. `Orden PRE/76/2024`) + última modificación conocida.

Se guarda como **spec versionada** y se rediffea periódicamente. Robusto a rediseños de página (a diferencia del hash crudo) y detecta "2016→365" con precisión.

## 4. Diff con competidores

Los competidores son un **detector barato de anticipación**. Capturar su índice de temario y diffear contra el nuestro:
- Ellos tienen tema/ley/versión que no tenemos → **gap o stale nuestro**.
- Tenemos algo que ellos no → nuestra ventaja **o** nuestro error.

**Regla dura:** el competidor NUNCA autoriza un cambio de contenido (pueden equivocarse). Solo **levanta señal para verificar contra el BOC**. Fuente de verdad = oficial (regla legal de CLAUDE.md).

## 5. Feedback del usuario como sensor de primera clase

Un feedback que mencione "temario cambió / ya no es esa versión / falta X" **auto-abre una tarea de verificación** en el mismo inbox. KPI: *veces que el usuario detectó antes que nosotros* → tiende a 0.

## 6. Principios de robustez (sin gaps ni bugs)

- **Redundancia:** ningún cambio depende de un solo detector.
- **Nunca auto-aplicar** contenido: toda señal se verifica contra BOC antes de tocar el temario (correctness legal).
- **Observabilidad + tests + canario** por detector.
- **KPI** "usuario detectó antes que nosotros" visible en admin.
- **Agnóstico por contrato / AWS-native** (misma línea del resto del sistema).

## 7. Fases

- **Fase 0 — Sustrato: ingesta total de boletines (§2bis).** Firehose BOE + boletines de las CCAA que ya cubrimos, por API/sumario, con embudo de 2 etapas (pre-filtro por catálogo → clasificador LLM). Es la base de la que consumen todas las demás fases. Faseado por cobertura.
- **Fase 1 — Fuentes múltiples + sensor Orden-de-programas.** Tabla `oposicion_monitored_sources` (+ migración de los 450 `seguimiento_url` a `source_type='convocatoria'`); cron itera todas las fuentes; sensor `orden_programas` como consulta sobre el sustrato (guardar norma-fuente por oposición + vigilar modificaciones). **Cierra el caso Cantabria y similares.**
- **Fase 2 — Huella canónica + auto-auditoría.** Extractor de spec de temario + detector `content_self_audit` contra nuestro `topic_scope`.
- **Fase 3 — Competitor-diff.** Índice de temario por competidor + diff → señal.
- **Fase 4 — Feedback-as-sensor + KPIs.** Clasificar feedbacks de temario → inbox; panel de KPIs de frescura.

## 8. Casos que este sistema habría cazado

- **Cantabria (PRE/12/2026):** el sensor `orden_programas` habría disparado el 10-feb; el `content_self_audit` habría marcado "Office 2016 vs 365".
- Cambios de versión de ofimática a mitad de convocatoria (avisos del tribunal).
- Leyes derogadas aún en nuestro `topic_scope` (cruce con "leyes derogadas zombi").

## 9. Pendiente inmediato relacionado

- Actualizar el temario de Aux Admin Cantabria a la Orden PRE/12/2026 (tema 16 general + específica → Microsoft 365), **verificado contra el PDF del BOC**.
