# Runbook — Verificar convocatorias contra el documento oficial (proceso fiel)

**Cuándo seguir este runbook (CUALQUIERA de estas frases → aquí):** *"revisa el timeline de convocatorias"*, *"verifica las convocatorias"*. **Y también desde el paso 2-bis de `oeps-convocatorias-seguimiento.md`**, cuando al revisar una señal toque clonar y verificar un documento.

> 🔗 **Reparto con el manual de señales OEP — no se duplican, se complementan:**
> - **`docs/maintenance/oeps-convocatorias-seguimiento.md` = EL BUCLE DIARIO.** Es el dueño de la
>   mecánica de señales: cómo contarlas (gotchas), la **regla de descarte**, el criterio de
>   newsletter, la identidad real de una señal `pag_empleo`, y el `applied`/`dismissed`. Eso NO se
>   repite aquí. Se dispara con *"revisa las señales OEPs"* / badge 🎯.
> - **Este runbook = LA MAQUINARIA DE EVIDENCIA.** Corpus, cita literal, `origen`, invariantes,
>   ciclo. El manual viejo tiene **cero** menciones a esto: es el hueco que cubre.
> - *"haz rollover"* (examen pasado) → `rollover-oposiciones.md`.

> 🎯 **Origen (16/07/2026):** Marta Benito reportó que "Administrativo de la Comunidad de Madrid" mostraba el examen en nov-2027; las bases oficiales (BOCM, Orden 1634/2026, **base 9**) dicen **mayo de 2027**. Nuestro `exam_date` era una estimación que nunca se reconcilió con el documento. **El fallo no fue no tener el documento: fue que una ESTIMACIÓN se presentó como fecha oficial.**

## Principio: un hecho, un sitio, una fuente

- **El hito TIPADO es el hecho.** `exam_date`/`estado_proceso` son copias que driftan (medido: 3 de 10 ya discrepaban con su propio hito).
- **Ningún hecho se presenta como oficial sin cita literal.** Pero **no se restringe, se ETIQUETA** (`origen`): hay convocatorias cerradas donde todo es citable y oposiciones que hay que **vender sin apenas datos**. Las dos son legítimas.
- **NUNCA auto-flip.** Un descuadre es un hallazgo para revisar, jamás un `UPDATE`.
- **La garantía honesta es 100% TRAZABLE, no 100% verificado** (~30% de boletines no parsean). Un sistema que confiesa lo que no sabe es fiable; uno que promete el 100% miente en el 30% de los casos sin decir en cuáles.

## Las 3 clases de hito (`origen`) — y cómo se cuida cada una

| `origen` | Qué es | Salud propia |
|---|---|---|
| `registro` | el documento dice la fecha, literal | **se VERIFICA** contra el documento |
| `inferencia` | el documento da una **REGLA** ("no antes de 2 meses tras el cierre") y derivamos la ventana | **se RECALCULA** si cambia su input |
| `estimacion` | sin documento; criterio propio (ciclo, histórico) | **CADUCA**: fecha pasada → hallazgo |

**Ascenso: `estimacion` → `inferencia` → `registro`** según aparecen documentos. El bug de Marta fue una `estimacion` que nunca se ascendió **aunque su documento ya existía**.

## Arquitectura — qué se automatiza y qué NO (decisión Manuel, 16/07)

> **La regla:** se automatiza todo lo que **no requiere criterio**. El criterio no se automatiza.
> Misma doctrina que el gemelo S2 del temario y que el triaje de señales OEP: **el usuario dispara,
> Claude ejecuta con juicio**.

| Capa | Quién | Qué |
|---|---|---|
| **1 · Detección** | radar / `oep_detection_signals` (cron) — **YA EXISTE, no duplicar** | "algo pasó aquí": `source_url`, `detected_fecha_examen`, `detected_plazas_*`, `detected_boc_ref`, `confidence_score`. Su confianza es media (65-70) y su `raw_extraction` trae un **resumen, NO una cita**: por eso no puede aplicar solo |
| **2 · Discriminar + clonar** | 🧠 **CLAUDE, a tu orden** | leer la señal, decidir **qué documento es el bueno**, descargarlo, clonarlo entero al corpus con `tipo`/`boletin`/`referencia`/`fecha` correctos y `curado=true` |
| **3 · Extraer + reconciliar** | 🧠 **CLAUDE** | extraer los hechos **con cita literal** del corpus (sin red) y contrastarlos con lo que mostramos |
| **4 · Aplicar** | 🧠 **CLAUDE** | dual-write + `record_convocatoria_verification` + marcar la señal `applied`/`dismissed` |
| **5 · Invariantes** | cron determinista (sweep) | coherencia **interna**: sin IA, sin documentos, gratis |
| **6 · Deriva** | automatizable | re-hashear documentos **ya curados** → "el boletín lo ha enmendado" |

### ⛔ Por qué las capas 2-3 NO se automatizan (hubo un cron y se borró el mismo día)

El 16/07 se creó y se eliminó un cron `reconcile-convocatoria`. Dos razones, las dos duras:

1. **Duplicaba al radar.** `oep_detection_signals` YA extrae fecha/plazas/boc_ref con LLM. Volver a
   llamar al modelo para lo mismo es duplicar un sensor que lleva 390 señales aplicadas y 1.256
   descartadas.
2. **Clonar sin discriminar envenena la extracción POR CONSTRUCCIÓN.** El crawler por regex del
   `seguimiento_url` de Madrid (que es el **portal genérico de empleo**, no la convocatoria) pescó un
   PDF titulado *"previsión de plazas a convocar"* — un documento cuyos números de plazas **NO son
   los de esta convocatoria** — y se lo pasó al LLM junto a las bases buenas. En ese mismo pase el
   modelo devolvió `plazas_libres: 130` cuando el documento oficial dice *"ciento siete (107)
   plazas"*: **nuestro dato era el correcto**. (No se pudo probar si el 130 salió del documento
   equivocado o fue alucinación pura — da igual: mezclar documentos sin discriminar es incorrecto de
   todos modos.)

**Descargar con un cron sin analizar no sirve de nada.** Por eso el corpus tiene DOS carriles:

| `curado` | Qué es | ¿Alimenta la extracción? |
|---|---|---|
| `false` | lo que un crawler pescó: evidencia bruta de qué publicaba el portal y cuándo | **NO** |
| `true` | documento **discriminado y validado**: tipo, boletín, referencia y fecha comprobados | **SÍ, solo estos** |

Es la misma distinción que `convocatoria_hitos.origen` (registro/inferencia/estimación): separar
**lo que hay** de **lo que hemos verificado**. Sin ella la BD acumula documentos sin que nadie sepa
cuáles son de fiar — lo contrario de "trackeable".

| Pieza | Cuándo | Qué hace |
|---|---|---|
| `detect-notas-convocatoria` (cron 09:30 UTC) | diario | sensor de versiones de software; vuelca lo que descarga como evidencia **bruta** (`curado=false`) |
| `convocatoria_hito_incidencias` (vista) | sweep nocturno | invariantes **deterministas** |
| `convocatoria_verification` | 🧠 Claude | veredicto + provenance + auto-invalidación por hash |

## Procedimiento

### 1. Ver los hallazgos

```sql
SELECT oposicion_slug, kind, severity, message, detail
  FROM content_health_findings
 WHERE kind IN ('convocatoria_descuadre_oficial','convocatoria_timeline_incoherente','convocatoria_timeline_caducado')
 ORDER BY severity, oposicion_slug;
```

### 2. Tratar según el tipo

**`convocatoria_descuadre_oficial`** — el documento y nosotros no decimos lo mismo.
1. Lee `detail.cita_literal` y `detail.url`. **La evidencia viaja con el hallazgo.**
2. **Verifica la cita contra el documento** (está en el corpus, no hace falta red):
   ```sql
   SELECT titulo, url, ts_headline('spanish', extracted_text, plainto_tsquery('spanish','primer ejercicio'))
     FROM convocatoria_documentos WHERE convocatoria_id = '<id>';
   ```
3. Si el documento tiene razón → **dual-write** a `convocatorias` (fila `is_current`) **y** `oposiciones` (gotcha COALESCE de `oposiciones_ssot`: si dejas el valor viejo en `oposiciones`, la vista cae al fallback y sigue mostrando lo anterior).
4. Registra el veredicto: `SELECT record_convocatoria_verification(<conv_id>, 'correct', '{}'::jsonb, '<url>', '<cita literal>', '<hash>', '<run>', 'claude');`
5. ⚠️ **El LLM alucina.** Caso real (16/07): devolvió `plazas_libres:130` y **"130" no aparecía en el PDF** (decía "ciento siete (107)"). Nuestro dato era el correcto. Por eso solo se emite con **confianza alta** y **con cita**: si la cita no respalda el número, el hallazgo es basura — descártalo y no toques nada.

**`convocatoria_timeline_incoherente`** — nuestros datos se contradicen entre sí (no hace falta documento).
- `I1_orden`: pares imposibles (real: `celador-sermas-madrid` abre el plazo el 7-ago y lo cerró el 6-ago).
- `I2_duplicado`: dos fechas de examen para el mismo ciclo → una miente.
- Arreglar contra la fuente oficial. Si son **hitos de dos ciclos mezclados**, el sitio del ciclo viejo es su propia convocatoria archivada (ver `rollover-oposiciones.md` §2.2).

**`convocatoria_timeline_caducado`** — previsión pasada de fecha o `status` que contradice su propia fecha (real: `guardia-civil` mostraba "Examen" del 10-jul como `upcoming` seis días después).
- Si hay documento nuevo → **asciende** el hito a `registro` con su cita.
- Si no → re-estima con criterio y **deja claro que es previsión**, o retíralo.

### 3. Herramientas

```bash
# Validar la extracción+reconciliación contra un documento real (NO escribe nada):
cd backend && NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/sim-reconciliacion-convocatoria.ts <slug> [--url=<pdf>]

# Re-clasificar tipo/origen de los hitos (dry-run por defecto):
node scripts/clasificar-hitos.cjs            # mide
node scripts/clasificar-hitos.cjs --apply    # escribe
```

## Gotchas (todos medidos, ninguno teórico)

- ⚠️ **El `seguimiento_url` suele ser el PORTAL GENÉRICO de empleo**, no la página de la convocatoria → crawlearlo NO llega a las bases. Las URLs buenas ya están en BD (`convocatoria_verification.source_url`, `convocatoria_hitos.url`) y **dentro de los propios títulos** (`"Convocatoria publicada en BOE (BOE-A-2025-24633)"`).
- ⚠️ **Truncar el documento = ser ciego.** Las bases del BOCM ocupan 97.329 chars y la base 9 está en la **posición 34.901**. Con un corte a 12k el modelo devolvía `fecha_examen: null`. Haiku tiene 200k de contexto: cabe entero.
- ⚠️ **`aproximado` ≠ `sin verificar`.** Son ejes ortogonales: la fecha de Marta es aproximada **y** oficial (la base 9 dice literalmente "mayo de 2027"). Por eso las fechas a nivel mes se comparan a nivel **mes** — compararlas a día daría un falso positivo sobre un caso correcto.
- ⚠️ **El ciclo debe ser inmutable ANTES que los documentos.** La provenance sobre una fila mutable muere en el rollover. Ver `20260716_convocatoria_ciclo_inmutable.sql`.
- ⚠️ **El texto de PDF trae guiones de fin de línea** (`"celebra-\nción"`) → el `ts_headline` sale partido. No afecta a la extracción LLM. Normalizar al guardar es un follow-up pendiente.

## Escala (medido 16/07, no estimado)

90 KB de texto por boletín · un boletín + índices = **240 kB** · búsqueda "¿dónde lo dice?" = **50 ms** · las 113 convocatorias que preparamos × 8 docs ≈ **10 MB** · todas (2.492) × 15 docs ≈ 530 MB. **La BD pesa 30 GB.** El coste real está en el crawl y el LLM, no en el disco.

## Relacionados
- `docs/roadmap/verificacion-convocatorias-documentos-proceso.md` — diseño, diagnóstico medido y fases.
- `docs/runbooks/rollover-oposiciones.md` §2.2 — abrir ciclo (`rollover_convocatoria()`), nunca mutar.
- `docs/maintenance/oeps-convocatorias-seguimiento.md` — señales de seguimiento (sistema ANTERIOR, complementario).
- `docs/runbooks/verificar-epigrafes-scope.md` — el gemelo S2: mismo patrón de verificación sobre el temario.
