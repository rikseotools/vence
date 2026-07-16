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

## Diagnóstico raíz (16/07/2026, medido en prod) — el problema NO es que falten documentos

Antes de añadir nada: **el mismo hecho del proceso está guardado en varios sitios, en texto libre y sin
fuente.** Un hecho duplicado sin fuente **drifta por construcción** — no es un bug que se arregla, es una
propiedad del modelo. Los documentos no lo resuelven solos; hay que quitar la duplicación PRIMERO.

**Prueba 1 — `exam_date` y el hito "Primer ejercicio" son EL MISMO hecho, duplicado, y ya driftaron:**

| oposición | `convocatorias.exam_date` | hito "ejercicio" | |
|---|---|---|---|
| `administrativo-extremadura` | 2026-11-14 | 2026-06-30 **y** 2026-04-28 (¡dos!) | ❌ |
| `administrativo-galicia` | 2026-09-19 | 2027-01-14 | ❌ |
| `administrativo-madrid` | 2027-04-30 | 2027-04-30 | ✅ |

**3 de 10 convocatorias con ambos datos ya no cuadran.** Da igual cuál sea el correcto: la landing lee uno
y el timeline pinta el otro. El usuario ve dos verdades.

**Prueba 2 — el vocabulario libre impide reconciliar.** El hito "cierre del plazo" está escrito de **7
formas** (`cierre del plazo de inscripción` 33, `cierre plazo de inscripción` 28, `fin plazo de solicitudes`
21, `fin plazo de inscripción` 16, `cierre del plazo de solicitudes` 15, `fin del plazo de solicitudes` 12,
`fin del plazo de inscripción` 11 → ~136 filas del MISMO concepto). Ninguna máquina puede comparar eso
contra un documento, ni comprobar un orden, ni deduplicar.

**Prueba 3 — `estado_proceso` es una TERCERA copia.** `administrativo-madrid`: `estado_proceso =
'inscripcion_abierta'` mientras su hito "Cierre del plazo de inscripción" (11-jun-2025) está `completed`.
Lleva un año cerrada. Nada lo cazó porque las dos copias no se hablan.

**Prueba 4 — `status` guardado drifta.** Hay hitos `completed` con fecha **futura** y hitos `upcoming` con
fecha pasada (Madrid: "Publicación de la convocatoria" 30-dic-2026 `upcoming` cuando el BOCM la publicó en
may-2025). `status` es función de `fecha` vs `now()`: guardarlo es duplicar un hecho derivable.

**Prueba 5 — no hay provenance en absoluto.** `convocatoria_hitos` no tiene columna de documento-fuente ni
cita: solo un `url` suelto, y **735 de 983 hitos ni siquiera lo tienen**. Son 983 fechas escritas a mano.

**Por eso `administrativo-madrid` está `verified_correct` con el timeline roto:** la verificación de ayer
cubre 8 escalares de `convocatorias` y **ningún hito** — `compute_convocatoria_hash` no los toca y el
trigger no dispara cuando cambian.

### Principio de diseño que sale de aquí: **un hecho, un sitio, una fuente**

1. **El hito TIPADO es el hecho.** Todo lo demás (`exam_date`, `estado_proceso`, `status`, `inscription_*`)
   se **DERIVA**, no se copia. Doctrina ya probada en este repo: `questions.is_active` es
   `GENERATED ALWAYS AS (...)` — *"Invariante física… imposible que se desincronicen"*. Misma medicina.
2. **Ningún hecho sin documento + cita literal.** Un hito sin `source_documento_id` es una afirmación sin
   evidencia: se puede tolerar (deuda), pero **tiene que verse** como tal.
3. **Lo determinista antes que el LLM.** El orden del proceso y la coherencia estado↔timeline se comprueban
   con SQL, gratis y al instante, sin documento y sin IA. Eso caza HOY los 4 fallos de arriba.

## Principio rector: REUTILIZAR, no duplicar

Casi toda la fontanería existe. El diseño se apoya en:

- **`detect-notas-convocatoria`** (`backend/src/detect-notas-convocatoria/`): ya extrae los links a PDF de la `seguimiento_url`, lee cada PDF a texto (`pdf-parse` vía `fetchPdfText`, valida magic bytes, tope 8 MB), escanea con regex y llama a un LLM Haiku que devuelve JSON con **`fecha_examen`, `software_versions`, `citas[]` (cita literal), `confianza`**. Persiste en `convocatoria_notas` (`url`, `content_hash`, `signals` jsonb, `llm_extraction` jsonb, `confianza`, `needs_manual`). **Esta es la mitad cara del sistema y YA está.**
- **Patrón de verificación con auto-invalidación por hash** (`topic_epigrafe_verification`, migración `20260710_topic_epigrafe_verification.sql`): el gemelo S2 es el molde exacto — verifica un dato PROPIO contra una **fuente externa**, guarda **dos hashes** (dato propio + fuente), invalida el dato propio por **trigger** y el drift contra la fuente por **VISTA derivada** (no trigger frágil cross-tabla), con **gate CI** que caza filas verificadas cuyo hash ya no cuadra.
- **`content_health_findings` + `health-sweep.cjs` + `runbookRegistry.ts`**: para emitir el hallazgo (kind → frase-gatillo → runbook).
- **`oep_detection_signals`**: trigger rico ya existente (trae `detectedFechaExamen`, `detectedPlazas*`, `rawExtraction`); NUNCA auto-aplica (patrón del repo).

## Modelo de datos

### 0. `convocatoria_hitos` TIPADA y con provenance — el hecho vive aquí (NO tabla nueva)

Se **extiende la tabla existente** (983 filas, 239 convocatorias, ya la lee la landing vía
`getHitosConvocatoria`): nada de tabla paralela.

| Columna | Estado | Notas |
|---|---|---|
| `tipo` | **NUEVA** text NOT NULL CHECK | **vocabulario cerrado** — mata las 7 grafías |
| `source_documento_id` | **NUEVA** uuid FK → `convocatoria_documentos(id)` | de qué documento sale este hito |
| `cita_literal` | **NUEVA** text | la cláusula que lo respalda ("base 9: …") |
| `confianza` | **NUEVA** int | 0-100 del LLM; NULL = puesto a mano |
| `fecha_aproximada` | **NUEVA** bool DEFAULT false | "mayo de 2027" sin día (caso Marta) |
| `status` | **PASA A DERIVADO EN VISTA** (⚠️ NO generated — ver abajo) | deja de poder mentir |

> ⚠️ **`status` NO puede ser `GENERATED ALWAYS` (error de diseño detectado 16/07, antes de implementar).**
> Postgres exige que la expresión de una columna generada sea **IMMUTABLE**; `now()` es **STABLE**. El
> precedente de `questions.is_active` **no aplica**: `lifecycle_state IN (...)` es inmutable, el tiempo no.
> Razonar por analogía sin comprobar la analogía es el mismo fallo que hundió la Capa C.
> **Solución:** derivar `status` en la **VISTA** (patrón `oposiciones_ssot`, ya en uso), no en la columna.
>
> ⚠️ **Y la derivación NO es `fecha < now() ? completed : upcoming`:** existen **40 hitos `current`** en
> prod y la landing pinta los **tres** estados (`completed`/`current`/`upcoming`, ver CLAUDE.md). Esa regla
> ingenua **borraría una función viva**. `current` es el hito EN CURSO (p.ej. `now()` entre `plazo_inicio` y
> `plazo_fin`) → la vista necesita la semántica del `tipo`, no solo la fecha.
| `fecha`, `titulo`, `descripcion`, `url`, `order_index` | se quedan | `titulo` pasa a ser cosmético (el `tipo` manda) |

**Vocabulario `tipo` — ⚠️ AÚN NO DERIVADO. Primera tarea de la Fase 0, no un dato del diseño.**

**Vocabulario CERRADO — 16 tipos, derivado del barrido de los 558 títulos (16/07, no de un vistazo).**

`oep_aprobada · convocatoria_publicada · bases_publicadas · programa_publicado · plazo_inicio · plazo_fin ·
lista_provisional · lista_definitiva · tribunal_constituido · ejercicio_1 · ejercicio_2 ·
plantilla_respuestas · resultados · reconocimiento_medico · modificacion_plazas · otro`

**Cobertura medida de las reglas: 942/983 (96%)**; el residuo (41, todos n=1) → `otro` + revisión.

> **Los 4 que el borrador de 11 NO tenía — los descubrió el dato, no yo:** `tribunal_constituido` (5),
> `plantilla_respuestas` (9 — publicación de plantilla + plazo de alegaciones; para un opositor es crítico),
> `reconocimiento_medico` (5), `modificacion_plazas` (6 — ampliaciones por BOP). Confirma que "derivar del
> top-14" era adivinar.

**⚠️ Multiidioma: requisito, no detalle.** Hay catalán en producción (`Llista provisional d'admesos i
exclosos`, `Inici termini de sol·licituds`, `Fi termini de sol·licituds`, `Publicació de la convocatòria al
DOGC`) — y `Tancament del termini d'inscripció` **se cae al residuo** porque la regla no sabe que *tancament*
= cierre. Las reglas deben cubrir **es/ca/gl/va** desde el día 1.

**⚠️ Aviso sobre el reparto medido:** `convocatoria_publicada` sale con 244 pero está **inflado** — la regla
termina en un comodín `/publicaci./` que lo traga todo (p.ej. `Convocatoria 2022-2023 resuelta`, que es
`resultados`, cayó ahí). **Afinar el comodín antes de migrar**; el 244 no es de fiar.

**💡 Hallazgo que abarata la Fase 1:** los títulos **ya contienen la provenance**, atrapada en prosa —
`Convocatoria publicada en BOE (BOE-A-2025-24633)`, `Convocatoria publicada: 44 plazas (BOP Cádiz nº 28,
11/02/2026)`, `Convocatoria 2026 publicada (BOCM · Orden 1634/2026)`. Hay identificador de documento,
boletín, número, fecha y plazas. **No hay que scrapearlo: hay que extraerlo de donde ya está** y sembrar
`convocatoria_documentos` con ello.

> **Heterogeneidad del proceso:** no todas las oposiciones tienen el mismo camino (concurso-oposición añade
> fase de concurso; hay procesos con 1, 2 o 3 ejercicios; algunos sin lista provisional). El vocabulario debe
> admitir esa variedad — y los invariantes NO pueden asumir un camino único (ver I1).

**Migración de los 983 existentes:** normalizar `titulo` → `tipo` por reglas; lo que no case → `tipo` NULL +
finding (I6). `source_documento_id` NULL en todos = **la deuda de 735 hitos sin fuente se hace VISIBLE en vez
de invisible**. No se borra nada.

> **Duplicación menor detectada:** `convocatoria_hitos` tiene **`oposicion_id` Y `convocatoria_id`** (964
> filas con ambos; 19 sin convocatoria). Hoy son coherentes (0 incoherencias medidas), pero es una FK
> duplicada que puede divergir: `oposicion_id` debería derivarse de la convocatoria. Además `order_index`
> es derivable de `fecha`+`tipo` — otra copia. Limpiar en Fase 3, no antes (no bloquea).

### 0-cero. ⛔ PRERREQUISITO BLOQUEANTE: el CICLO tiene que ser real (o la provenance muere en el rollover)

**Hallazgo 16/07, medido.** El diseño entero asume "una convocatoria = un ciclo del proceso". CLAUDE.md lo
declara (*"`convocatorias` — SSOT del PROCESO … **por año**; `is_current`"*). **La práctica lo desmiente:**

| Medición (prod) | |
|---|---|
| Oposiciones con **1** convocatoria | **2.488** |
| Oposiciones con **2** (historia conservada) | **2** — `auxiliar-administrativo-madrid`, `auxiliar-administrativo-canarias` |
| Hitos cuyo título cita un año ≠ al de su convocatoria | **55** |

- ✅ **Se puede hacer bien:** `auxiliar-administrativo-madrid` tiene 2025 (`examen_realizado`, `is_current=false`) **y** 2026 (`lista_admitidos`, `is_current=true`). El modelo funciona.
- ❌ **Pero el rollover no lo respeta:** `auxiliar-administrativo-estado` tiene **una fila `año=2025` que hoy describe la OEP 2026** — el ciclo anterior se machacó encima.
- ❌ **`administrativo-madrid` nunca tuvo fila de 2025** → sus hitos de 2025 y 2026 comparten fila. **Ese es el verdadero diagnóstico del "desorden" de Madrid: no hay dónde poner el ciclo viejo.** No es un timeline mal ordenado; es un ciclo sin sitio.

> ⚠️ **Consecuencia que decide la arquitectura:**
> **La provenance sobre una fila MUTABLE muere en el rollover.** Si `convocatoria_documentos` y las citas
> cuelgan de una convocatoria que se sobrescribe cada año, la cadena de evidencia se destruye sola: la fila
> pasa a describir otro ciclo y la cita apunta a un documento que ya no habla de ella. **Montar el registro
> documental sobre el rollover actual es construir sobre arena.**

**Decisión (no hace falta columna nueva — el modelo ya está):**
1. **El ciclo ES la fila de `convocatorias`** (`oposicion_id` + `año`). Ya probado por las 2 que lo hacen bien.
2. **El rollover INSERTA un ciclo nuevo y archiva el anterior** (`is_current=false`); **NUNCA muta la fila viva**. Va al runbook `rollover-oposiciones.md` y se vigila con un invariante (una oposición con examen pasado y `is_current` mutado = finding).
3. **Cada hito cuelga de SU ciclo** → **I1 se evalúa dentro de un mismo `convocatoria_id`**, y la mezcla de ciclos deja de ser un falso positivo: pasa a ser un defecto de datos con nombre (los 55).
4. **Deuda a reparar:** re-atribuir los 55 hitos cross-ciclo y reconstruir los ciclos machacados (AGE) — visible como finding, no como silencio.

> **Esto va ANTES que los documentos.** Sin ciclo inmutable no hay provenance duradera, y sin provenance
> duradera el resto del sistema es decorado.

### 0-ter. `origen` — el eje que faltaba: registro ≠ inferencia ≠ estimación (NO restringir, ETIQUETAR)

**Corrección de rumbo (16/07, a raíz de "¿no estás siendo muy restrictivo?").** El primer borrador exigía
cita literal a todo hecho y despachaba las previsiones como *"no son hitos"*. **Error de bulto**: chocaba
con la doctrina de rollover (*"una landing no muere cuando pasa su examen → se pivota hacia delante"*,
`rollover-oposiciones.md`) y habría marcado como rota toda la cartera forward-looking — empujando a BORRAR
justo lo que la hace vendible.

**La realidad es un espectro:** hay convocatorias cerradas donde todo es citable, y oposiciones que hay que
vender **sin apenas datos** (examen pasado, sin convocatoria nueva). Las **54 previsiones** en prod no son
ruido: son trabajo bueno. Ejemplo literal en BD (`auxiliar-administrativo-diputacion-cordoba`):

> *"El ejercicio no podrá comenzar hasta transcurridos 2 meses desde el fin del plazo de solicitudes; fecha
> y sede se publicarán con la resolución de admitidos/excluidos."*

Eso **no es especular**: es **inferir de una REGLA de las bases**. Es trazable — a una regla, no a una fecha.

**Nueva columna `origen` en `convocatoria_hitos`** — text NOT NULL CHECK, **ortogonal** a `tipo`, a
`fecha_aproximada` (precisión) y al estado de verificación:

| `origen` | Qué es | Respaldo | Salud propia |
|---|---|---|---|
| `registro` | el documento dice la fecha, literal | `source_documento_id` + `cita_literal` | **se VERIFICA** contra el documento (sistema actual) |
| `inferencia` | el documento da una **regla**; derivamos ventana | cita de la **REGLA** + inputs del cálculo | **se RECALCULA** si cambia su input (p.ej. se mueve `plazo_fin`) |
| `estimacion` | sin documento; criterio propio (ciclo, histórico) | ninguno — y **se dice** | **CADUCA**: fecha pasada → finding |

**El invariante NO es "todo debe tener cita". Es:**

> **Cada hecho declara lo que es y se pinta según lo que es. Una `estimacion` JAMÁS se presenta como fecha
> oficial.** (Y una `inferencia` se presenta como ventana derivada, citando la regla.)

**Esto ES el bug de Marta, generalizado.** No falló que no tuviéramos documento: falló que **una estimación
se le mostró como fecha**. Su `exam_date` era `approximate=true` — pero "aproximado" habla de PRECISIÓN, no
de PROCEDENCIA (§Capa C descartada). Nada decía "esto es una previsión nuestra".

**Ciclo de vida — el ascenso:** `estimacion → inferencia → registro`, promocionando según aparecen
documentos. Así, **el fallo real de Marta fue una `estimacion` que nunca se promocionó aunque su documento
YA existía** (las bases estaban publicadas). Ese es el sensor que de verdad importa, y `detect-notas` puede
resolverlo solo: *"hay convocatoria con hitos `estimacion` y ha aparecido un documento que los fija"* →
finding de **promoción pendiente**. No es un sensor de "te falta cita"; es de "ya puedes saberlo y no lo sabes".

**Dato que lo justifica:** **24 previsiones YA CADUCADAS** (fecha pasada, aún `upcoming`) viven en prod ahora
mismo. Una previsión es una afirmación **con fecha de caducidad** y nadie las vigila. Ese —y no su
existencia— era siempre el problema.

### 0-bis. Derivar en vez de duplicar (lo que mata el drift de raíz)

Aplicando el patrón `oposiciones_ssot` **que ya existe** (los lectores leen la vista, las columnas
temporales quedan legacy en deprecación — Sprint G):

- **`exam_date` efectivo** := fecha del hito `ejercicio_1` (con su cita). La columna `convocatorias.exam_date`
  pasa a **legacy**; la vista la usa como *fallback* mientras haya convocatorias sin hito tipado. Fin del
  drift de la Prueba 1 **por construcción**: no hay dos copias que puedan discrepar.
- **`estado_proceso` efectivo** := derivado del timeline (último hito `completed` + el siguiente `upcoming`).
  Fin de la Prueba 3.
- **`inscription_start/deadline`** := hitos `plazo_inicio` / `plazo_fin`.

> **Aditivo-seguro y reversible**, igual que `oposiciones_ssot`: primero la vista con fallback a la columna,
> luego se migran lectores, y solo al final se deprecia la columna. Ningún big-bang.

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

## Invariantes deterministas — "cazarlo al instante", sin documento y sin IA

Con el hito **tipado**, la fidelidad del proceso deja de ser opinable y pasa a ser **comprobable en SQL**.
Estos checks son gratis, no necesitan corpus ni LLM, y **cazan HOY los 4 fallos del diagnóstico**. Corren
en `health-sweep.cjs` (nocturno) **y** como gate CI. Cada violación → `content_health_findings`.

| # | Invariante | Qué caza (caso real) |
|---|---|---|
| **I1** | **Pares universales DENTRO de un mismo `convocatoria_id`** (NO orden total, NO cross-ciclo): `plazo_inicio ≤ plazo_fin`, `convocatoria_publicada ≤ plazo_inicio`, `plazo_fin ≤ ejercicio_1`, `ejercicio_1 ≤ resultados` | desórdenes reales dentro de un ciclo |
| **I0** | **Integridad de ciclo** (§0-cero): hito cuyo título cita un año ≠ al de su convocatoria; oposición con examen pasado cuya fila viva fue mutada en vez de archivada | **55 hitos cross-ciclo** + los ciclos machacados tipo AGE. **Precede a I1**: sin ciclo limpio, I1 es ruido |
| **I2** | **Unicidad por tipo**: ≤1 hito de cada `tipo` por convocatoria | `administrativo-extremadura`: **dos** hitos de "primer ejercicio" con fechas distintas |
| **I3** | **Coherencia estado↔timeline**: el `estado_proceso` efectivo debe salir del timeline | Madrid: `inscripcion_abierta` con el plazo cerrado hace un año |
| **I4** | **Sin duplicación**: `exam_date` (legacy) == fecha del hito `ejercicio_1` mientras coexistan | Extremadura y Galicia (3/10 driftados) |
| **I5** | **Cobertura de fuente**: hito **`origen='registro'`** sin `source_documento_id`. **NO aplica a `inferencia`/`estimacion`** — esas no necesitan cita de fecha, por definición | los hitos que dicen ser oficiales y no lo prueban, priorizados por impacto |
| **I6** | **Vocabulario**: `tipo` NULL (título que no casó al migrar) | grafías nuevas que se cuelen a futuro |
| **I7** | **Caducidad de previsión**: `origen='estimacion'` con `fecha < now()` | **24 previsiones caducadas** que siguen `upcoming` en prod hoy |
| **I8** | **Promoción pendiente**: convocatoria con hitos `estimacion`/`inferencia` **y** documento en `convocatoria_documentos` que ya fija la fecha | **el bug de Marta**: las bases existían y la previsión nunca se ascendió a `registro` |
| **I9** | **Honestidad de render**: `origen='estimacion'` que la UI pinta como fecha oficial (sin marca "previsión") | que un opositor tome nuestra estimación por un dato del BOE |

> **I1-I4 son verdad interna** (no necesitan documento): comparan nuestros datos consigo mismos. Por eso
> son la Fase 0 — valen desde el minuto uno, incluso con 0 documentos scrapeados.
> **I5-I6 son cobertura**: miden cuánto del proceso está respaldado por fuente. Es el termómetro del sistema.

> ⚠️ **I1 NO puede ser un orden total (corregido 16/07).** El primer borrador encadenaba los 11 tipos en una
> secuencia única. **Los procesos son heterogéneos** (concurso-oposición mete fase de concurso; hay 1-3
> ejercicios; algunos no publican lista provisional; una OEP puede aprobarse años antes o solaparse con el
> proceso anterior en rollover). Un orden total sobre procesos distintos es una **máquina de falsos
> positivos** — el fallo exacto de la Capa C, cometido otra vez por afirmar una regla sin medirla.
> **Solo se afirman pares UNIVERSALES**, verdaderos en cualquier proceso. Cada par nuevo se justifica; ante
> la duda, NO se añade (un invariante que se apaga por ruidoso no protege de nada).
>
> ⚠️ **Ojo al diagnosticar Madrid con I1:** "OEP aprobada 2026" junto a "Convocatoria 2025" en la MISMA
> convocatoria puede no ser un desorden, sino **hitos de DOS procesos mezclados en una fila** (rollover).
> El invariante lo señala; la causa hay que mirarla. No confundir el síntoma con el diagnóstico.

### La garantía honesta: **100% trazable ≠ 100% verificado**

El objetivo declarado es "100% fiel a la realidad". Hay que ser exactos con lo que un sistema así **puede**
prometer: **~30% de los boletines no parsean automáticamente** (dato del runbook S2: *"los 42 boletines son
heterogéneos, ~30% no parsean"*), hay fuentes tras JS/Cloudflare, y hay PDFs escaneados. Prometer "todas las
convocatorias verificadas al 100%" es prometer algo que la realidad no da.

**Lo que SÍ es alcanzable y hay que exigir:**

> **Ningún hecho del proceso se presenta como verificado sin cita literal de un documento oficial; y todo
> hecho sin respaldo es VISIBLE como tal — para nosotros (finding) y, donde toque, para el usuario.**

Eso es **100% trazable**: cobertura conocida en todo momento (qué está citado, qué no, y desde cuándo). La
verificación total es la asíntota; la trazabilidad total es el invariante. Un sistema que confiesa lo que no
sabe es fiable; uno que promete el 100% miente en el 30% de los casos y nadie sabe en cuáles.

**Priorizar por impacto, no por existencia:** 2.489 convocatorias vigentes, solo ~239 con hitos. Ordenar los
findings por oposición activa + usuarios + proceso vivo. 2.489 hallazgos no es observabilidad, es ruido
(lección de la Capa 3 del radar: 2.053 señales → nadie mira → así llegamos a Marta).

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
3. **Fase 0 — hitos tipados + invariantes (SIN documentos, empieza AQUÍ).** `tipo` + `status` GENERATED + migración de las 983 filas + I1-I4 en el sweep y en el gate. **Caza los 4 fallos del diagnóstico el día 1**, no necesita corpus ni LLM, y es requisito de todo lo demás (sin `tipo` no hay nada que reconciliar contra un documento). Sin esto, scrapear documentos es echar datos buenos sobre un modelo que los vuelve a duplicar.
4. **Fase 1 — `convocatoria_documentos`** (generalizar `convocatoria_notas`) + `source_documento_id`/`cita_literal` en hitos + I5 (cobertura de fuente). Aquí entra el *"documentos enteros o sus partes esenciales"*: `extracted_text` = el documento entero (durable, contra link-rot); `llm_extraction.citas[]` = las partes esenciales estructuradas. **Los dos, no uno u otro.**
5. **Fase 2 — reconciliación** (extender `detect-notas-convocatoria` a hitos tipados + plazas). **Es lo que de verdad ESCALA:** un sensor de cobertura dice *"no lo has mirado"* (necesita un humano por convocatoria → no escala a 2.489); la reconciliación dice *"el BOCM dice mayo y tú muestras noviembre"* (la máquina canta el descuadre sola). La mitad cara (PDF→texto→Haiku→`citas[]`+confianza) **ya existe**. **NUNCA auto-flip**: el descuadre es un finding, jamás un `UPDATE`.
6. **Fase 3 — derivar** `exam_date`/`estado_proceso`/`inscription_*` del timeline vía vista (patrón `oposiciones_ssot`), migrar lectores, deprecar columnas. Mata el drift por construcción y retira I4 (ya no hay dos copias que comparar).
7. **Fase 4 — verificación abarca el proceso entero:** `compute_convocatoria_hash` incluye el digest de hitos tipados + trigger también sobre `convocatoria_hitos` → tocar un hito invalida la verificación. Hoy **no los cubre**: por eso Madrid está `verified_correct` con el timeline roto.
8. **Fase 5 — vista unificada + operativa:** panel OEP → convocatoria(s) → documentos → verificación por campo, `verify:convocatoria` (CLI con `dump/record/status/audit/gate`, gemelo de `verify:scope`) y **runbook operativo** + frase-gatillo (el `runbookRegistry` ya tiene entradas de convocatoria y su test obliga a sincronizar CLAUDE.md).

### Qué se REUTILIZA (nada de esto se construye de cero)

| Ya existe | Se usa para |
|---|---|
| `convocatoria_notas` + `detect-notas-convocatoria` (PDF→texto→Haiku→citas+confianza, magic bytes, tope 8MB) | se **generaliza** a `convocatoria_documentos`; la extracción se extiende a hitos |
| `convocatoria_hitos` (983 filas, la lee la landing) | se **extiende** con `tipo`+provenance; no hay tabla nueva |
| `convocatoria_verification` + hash + trigger + vista (hecho ayer) | se **amplía** a hitos (Fase 4) |
| Patrón `oposiciones_ssot` (vista + fallback + deprecación) | Fase 3, derivar sin big-bang |
| Doctrina `is_active GENERATED` (lifecycle de preguntas) | `status` generado, invariante por construcción |
| `content_health_findings` + `health-sweep.cjs` + `runbookRegistry` | entrega de los findings (kind → frase → runbook) |
| `check-seguimiento` + `oep_detection_signals` + radar | disparador "algo cambió" → re-fetch → re-verificar |
| `verify-topic-scope.cjs` (S2, subcomandos + gate) | molde literal del CLI `verify:convocatoria` |

> **Deuda detectada de paso (16/07):** `verify:gate` (el gate del S2, ya en producción) **no está cableado en
> ningún workflow** — está en `package.json` y no lo invoca nadie. El gate de convocatorias debe nacer
> cableado en CI, y de paso arreglar el de S2.

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
