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

### 3. ⚠️ ANTES DE DAR POR CERRADO: el guardarraíl de completitud

```bash
npm run audit:convocatorias        # ¿me he olvidado algún campo?
```

> **Por qué existe:** las capas 2-4 las hace Claude con criterio, y **un humano olvida cosas**. En el
> PRIMER uso real (SERMAS, 16/07) se quedaron sin aplicar `inscription_start`/`inscription_deadline` y
> `sistema_selectivo` —datos que el documento YA daba y que el LLM YA había extraído—, se perdieron 3
> hitos extraídos con cita, y la verificación se registró apoyada en el **membrete del boletín**
> (*"VIERNES 4 DE JULIO DE 2025 B.O.C.M. Núm. 158 Pág. 171"*) en vez de en una cláusula.
>
> **No se puede comprobar que "seguiste el manual". Sí se puede comprobar el RASTRO que deja:**
> - `campo_extraido_sin_aplicar` — el `llm_extraction` del documento da un dato y la convocatoria lo
>   tiene NULL. **La propia extracción es la lista de comprobación.**
> - `hito_extraido_sin_guardar` — un hito salió del documento con cita y no está en el timeline.
> - `cita_no_prueba_nada` — la verificación se apoya en algo sin prosa (membrete, numeración).
> - `senal_aplicada_sin_documento` — señal `applied` sin ningún documento curado: ¿se verificó de verdad?
>
> **Y todo se arregla SIN volver a la red**: el texto está clonado letra a letra, así que la cláusula
> buena se busca en el corpus. Eso es exactamente para lo que se guarda.

### 4. Herramientas

```bash
# CAPA 2 — clonar al corpus el documento que HAS DISCRIMINADO (PDF o HTML). Idempotente por hash:
#   re-clonar sin cambios no duplica; si el boletín ENMIENDA el documento, el hash cambia → fila nueva.
cd backend && NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/clonar-documento.ts \
  --slug=<slug> --url=<url> --tipo=bases --titulo="..." --boletin=BOCM --ref=... --fecha=2026-07-14

# Validar la extracción+reconciliación contra un documento real (NO escribe nada):
cd backend && NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/sim-reconciliacion-convocatoria.ts <slug> [--url=<pdf>]

# Completitud (¿olvidé campos?):
npm run audit:convocatorias
npm run audit:convocatorias:gate   # exit 1 si hay fallos → CI

# Re-clasificar tipo/origen de los hitos (dry-run por defecto):
node scripts/clasificar-hitos.cjs            # mide
node scripts/clasificar-hitos.cjs --apply    # escribe
```

## Turnos de plazas: el total se DERIVA, no se guarda

Los tres turnos comunes (`plazas_libres`, `plazas_promocion_interna`, `plazas_discapacidad`) cubren
el caso general. La **cola** va en `convocatorias.plazas_otros_turnos` (jsonb) **con su cita**:

```json
[{"turno":"violencia_genero","plazas":6,"cita":"6 plazas en el turno de reserva para mujeres víctimas de violencia de género.","documento":"BON-101-2025"}]
```

El total: **`oposiciones_ssot.plazas_total`** (o `convocatoria_plazas_total(<id>)`) — derivado, nunca
almacenado (una cuarta copia driftaría igual que las otras). Caso que lo motivó: el BON de Navarra
reparte 585 en **cuatro** turnos y el esquema modelaba tres → sumábamos 579 y la opositora del 4º cupo
no veía sus 6 plazas.

**Antes de "corregir" una tarjeta de plazas hacia abajo, comprueba si falta un turno.** Puede que la
tarjeta tenga razón y el corto sea el esquema.

### 📐 Qué guarda cada columna (la convención, y por qué importa)

> **`plazas_libres` = la cifra LITERAL que el documento da al turno libre.** Nunca una resta nuestra.
> **`plazas_discapacidad` = la reserva.** **`plazas_discapacidad_incluidas`** dice si esa reserva está
> DENTRO de `plazas_libres` (y por tanto no suma al total).

Sin esta convención escrita, el 16/07 rellené seis filas con cifras **derivadas** que no aparecían en
ningún documento: Cádiz con `L=9` cuando su Resolución dice «**once plazas**», Huelva con `38` cuando
dice «cubrir **45 plazas**», Granada con `42` cuando su tabla dice `GR 40 + ME 4 + CE 2 = **46**`. Los
totales salían bien —9+2=11, 38+7=45— pero `plazas_libres` guardaba un número inventado por mí, y eso
es exactamente lo que este sistema existe para impedir. **Si tu cifra no se puede señalar con el dedo
en el documento, está mal, aunque el total cuadre.**

Regla práctica al leer:

| el documento dice | `plazas_libres` | `incluidas` |
|---|---|---|
| «cubrir **45 plazas**… del total se reservarán **7**» | **45** | `true` |
| «**Trece plazas** turno libre. **Cuatro plazas** turno reservado a discapacidad» | **13** | `false` |
| tabla OEP: `cupo general 1.309 · reserva 141 · **Total 1.450**` | **1.450** | `true` |

Y si la cifra que quieres poner es una resta (2.704 autorizadas − 541 de reserva militar = 2.163 de
Policía Nacional), **escribe la derivación completa en `boe_reference`** con sus dos citas: el número
derivado es legítimo, pero tiene que poder reconstruirse sin volver al BOE.

### ⚠️ El cupo de discapacidad unas veces SUMA y otras va DENTRO (16/07)

**No hay una regla nacional: hay que leerlo en CADA documento.** Las dos formas son reales y están
verificadas en documentos leídos enteros:

| | qué dice el documento | efecto |
|---|---|---|
| **DENTRO** | Madrid (Orden 1634/2026): «se reservan siete (7) plaza **del total de las convocadas por el turno libre**»<br>AGE (Res. 18/12/2025): «será de 1.700 plazas, **de las que** 156 se reservarán» | el cupo **NO suma**: ya está en `plazas_libres` |
| **APARTE** | Navarra (BON 101/2025): «se distribuirán en **los siguientes turnos**: –264 libre. –264 promoción. –51 reserva discapacidad. –6 violencia de género»<br>CLM (DOCM 240/2025): columnas «Cupo general» y «Reserva discapacidad» totalizadas **por separado** | el cupo **suma** |

→ `convocatorias.plazas_discapacidad_incluidas` (`true` = dentro). **Solo se marca con cita literal.**
NULL = no consta y se asume aparte (lo verificado en los documentos leídos).

Sin ese dato el total contaba plazas **dos veces**: Madrid daba 219 donde el documento dice 212.

**La frase que lo decide** (búscala, no la deduzcas): *"de las que N se reservarán"* / *"del total de
las convocadas"* → **DENTRO**. *"se distribuirán en los siguientes turnos"* + el cupo como un turno más
→ **APARTE**. En tablas de OEP no hay frase: mira si la columna **«Total plazas» = cupo general +
reserva** (entonces DENTRO de ese total).

⚠️ **No es automatizable con regex.** Medido: los patrones cazan la Resolución de la AGE (9 de 9) pero
dan **cero** en el RD 387/2026 (es una tabla, no hay prosa) y fallan en Madrid (el número va en letra:
*"siete (7)"*). La máquina extrae candidatas; **el veredicto se lee**.

### Una cifra es un HECHO o una PREVISIÓN — nunca a medias

Regla de producto (Manuel, 16/07): *"se activa siempre la vendible; si el examen pasó, se activa la
siguiente OEP y convocatoria si hay, y si no, una previsión"* + *"debe indicarse si es previsión o son
datos reales: las previsiones son previsiones"*.

- **Hecho** → tiene su documento en `convocatoria_documentos` + su cita. `plazas_prevision = false`.
- **Previsión** → `plazas_prevision = true` **y `plazas_prevision_motivo`** (un CHECK lo exige: una
  previsión sin razonamiento es una invención). La landing debe decir «previstas», no venderlas.

Guardarraíl: `plazas_afirmadas_sin_documento` en `audit-convocatoria-completitud.cjs`. **107 de las
publicadas estaban así el 16/07** (afirmando plazas sin nada que las pruebe).

### La tarjeta de la landing NO teclea cifras

`landing_estadisticas` es texto libre y ahí es donde se cuelan las mentiras: `celador-sescam-clm`
anunciaba **537 plazas** (el documento dice 128) y un **«Examen 2026: 18/04»** inventado (`exam_date`
NULL, estado `oep_aprobada`: sin convocatoria no hay examen). Las columnas eran correctas.

→ Usa **`{plazasTotal}`** / `{plazasLibres}` / `{temasCount}`: se resuelven contra `oposiciones_ssot` al
renderizar, **no pueden driftar**. Guardarraíles: `tarjeta_contradice_columnas` y
`tarjeta_examen_sin_fecha_en_bd` (+ unit `__tests__/lib/revisarTarjeta.test.ts`).

⚠️ Cambiar la tarjeta a `{plazasTotal}` **exige que el código esté desplegado** (`resolveVars` devuelve
`''` para una variable desconocida → tarjeta EN BLANCO). Usa `scripts/tarjetas-a-plazas-total.cjs`, que
aborta comprobando el commit vivo de `/api/health` con `git merge-base`.

## Gotchas (todos medidos, ninguno teórico)

- ⚠️ **El `seguimiento_url` suele ser el PORTAL GENÉRICO de empleo**, no la página de la convocatoria → crawlearlo NO llega a las bases. Las URLs buenas ya están en BD (`convocatoria_verification.source_url`, `convocatoria_hitos.url`) y **dentro de los propios títulos** (`"Convocatoria publicada en BOE (BOE-A-2025-24633)"`).
- ⚠️ **Truncar el documento = ser ciego.** Las bases del BOCM ocupan 97.329 chars y la base 9 está en la **posición 34.901**. Con un corte a 12k el modelo devolvía `fecha_examen: null`. Haiku tiene 200k de contexto: cabe entero.
- ⚠️ **`aproximado` ≠ `sin verificar`.** Son ejes ortogonales: la fecha de Marta es aproximada **y** oficial (la base 9 dice literalmente "mayo de 2027"). Por eso las fechas a nivel mes se comparan a nivel **mes** — compararlas a día daría un falso positivo sobre un caso correcto.
- ⚠️ **El ciclo debe ser inmutable ANTES que los documentos.** La provenance sobre una fila mutable muere en el rollover. Ver `20260716_convocatoria_ciclo_inmutable.sql`.
- ⚠️ **La cita NO se saca con regex, se elige LEYENDO.** Tres fallos el mismo día: se registró como prueba el **membrete** del boletín (*"VIERNES 4 DE JULIO DE 2025 B.O.C.M. Núm. 158 Pág. 171"*), y en Navarra se cogió *"En su sesión celebrada el lunes 2 de febrero…"* —la fecha de la **reunión del tribunal**, no la del examen— porque el regex pilló el primer "febrero". El documento está clonado: **léelo** (el aviso del tribunal eran 2 KB) y elige la cláusula. El guardarraíl `cita_no_prueba_nada` caza la basura evidente, no la cita *plausible pero de otra cosa*.
- ⚠️ **Muchas fuentes son HTML, no PDF.** De las 112 urls de documento que conocemos solo **19 son .pdf**; las 20 del BOE son HTML. `clonar-documento.ts` lee **ambos** (reutiliza `htmlToText()` del sensor). Un corpus que solo lee PDF es ciego a la mayoría de las fuentes.
- ⚠️ **"Verificado contra la fuente" sin clonar el documento NO vale.** Si la página cambia, tu verificación deja de ser demostrable — que es justo lo que este sistema existe para impedir. El guardarraíl `senal_aplicada_sin_documento` lo caza (me cazó a mí el 16/07, dos veces).
- ⚠️ **Al re-atribuir una señal mal enganchada, acuérdate de mover `oposicion_id`.** Aplicarla y dejarla colgando de la fila equivocada deja el bug del matcher invisible para el siguiente.
- ⚠️ **Los boletines escriben las cifras EN LETRA** («Ocho plazas para el turno de acceso libre» —Universidad de León; «Dos plazas de Administrativo» —Zamora; «siete (7) plaza» —Madrid). Un buscador solo-dígitos es CIEGO justo en las cifras pequeñas, que son la mayoría del catálogo: la 1ª versión de `proponer-plazas-boe.cjs` dio **22 de 31** "la cifra no aparece en su documento" y era **falso** — los datos estaban bien y probados. Antes de acusar a un dato de no tener respaldo, busca su forma en letra (el script ya lo hace: `enLetra()`).
- ⚠️ **Un boletín está lleno de números que no son plazas**: «Ley 31/2022», «artículo 20.Dos.4», «núm. 306», «Pág. 171». Buscar `31` a secas devuelve la Ley 31/2022 con pinta de prueba — el peor resultado posible en una herramienta de verificación. Exige «plaza» CERCA (~90 car.) y descarta lo precedido de `ley|real decreto|artículo|núm.|pág.`.
- ⚠️ **Clona TODO lo que descargues, en el momento** (`fuente='manual'`, `curado=false`). Regla de Manuel: *"no olvidarte de clonar todo lo que caiga en tus manos para no tener que volver a descargar esos documentos, y ponerles la url y todos los datos en la BD"*. El corpus no es un subproducto del análisis: es el objetivo. Un análisis que descarga a `/tmp` y tira el PDF deja el mismo trabajo para mañana.
- ⚠️ **`curado` = "lo he leído y respondo de él"**, no "está descargado". Lo automático entra `curado=false`; se marca `true` al aplicar el veredicto. Y `fuente` es una taxonomía CERRADA (`detect-notas|radar|seguimiento|manual|backfill-titulo`): el CHECK te frena si te inventas un valor — usa `manual` si lo diriges tú.
- ⚠️ **Un filtro "sin documento" hace desaparecer la fila justo cuando la clonas** — antes de leerla. El trabajo no es descargar, es verificar: filtra por `plazas_discapacidad_incluidas IS NULL` **o** sin documento.
- ⚠️ **Fija `app.actor` o el historial no sabe quién fuiste.** `convocatorias_history` registra QUÉ cambió siempre, pero `changed_by` sale del DB user (`venceadmin`) salvo que hagas `SELECT set_config('app.actor','claude:<tarea>',true)` **en la misma conexión, antes de escribir**. `rollover_convocatoria()` ya lo hace; tu `UPDATE` suelto NO. Medido el 16/07: mi corrección de plazas quedó firmada como `venceadmin`.
- ⚠️ **Documenta también el ciclo ARCHIVADO** (`clonar-documento.ts --anio=2025`). Sin `--anio` la herramienta solo engancha al ciclo **vigente** y el viejo se queda sin prueba para siempre. Y la prueba del ciclo viejo es lo que permite auditar el nuevo: así se vio que el 1.450 de la OEP 2026 estaba metido en la fila de 2025 (que en realidad convocó 1.700).
- ⚠️ **El `Total plazas` de una tabla de OEP ya incluye la reserva.** Si copias esa cifra a `plazas_libres` y además rellenas `plazas_discapacidad`, cuentas el cupo dos veces. Comprueba: ¿`cupo general + reserva = Total`? Entonces `plazas_discapacidad_incluidas = true`.
- ⚠️ **Una fila que mezcla ciclos es un número que no existe.** `auxiliar-administrativo-estado` tenía `plazas_libres` de la **OEP 2026** (1.450) y `plazas_promocion_interna` de la **convocatoria 2025** (720): su "total" (2.170) no aparecía en ningún documento del mundo. Pasa cuando se pivota **en la misma fila** en vez de hacer rollover. Un documento por ciclo lo hace imposible.
- ⚠️ **`plazas_total` era BIGINT y node-pg entrega los bigint como STRING.** El `sum()` sobre jsonb contagia el tipo a toda la expresión. Ya causó dos bugs el mismo día (el auditor acusando a 7 tarjetas honestas; el tipo `number|null` de la landing recibiendo `"128"`). Casteado a `::int` en la vista — pero si añades otra agregación, vigílalo.
- ⚠️ **`plazas_otros_turnos` mal escrito tumbaba la landing ENTERA.** Un `"plazas":"seis"` hacía fallar la query de `oposiciones_ssot` → `getOposicionLandingData` captura y devuelve null → se pierden plazas, fechas, FAQs y SEO de golpe; y el auditor moría igual. Hoy lo impide un CHECK (`plazas_otros_turnos_bien_formado`): exige array de objetos con `plazas` entera + `turno` + `cita`.
- ⚠️ **El texto de PDF trae guiones de fin de línea** (`"celebra-\nción"`) → el `ts_headline` sale partido. No afecta a la extracción LLM. Normalizar al guardar es un follow-up pendiente.

## Escala (medido 16/07, no estimado)

90 KB de texto por boletín · un boletín + índices = **240 kB** · búsqueda "¿dónde lo dice?" = **50 ms** · las 113 convocatorias que preparamos × 8 docs ≈ **10 MB** · todas (2.492) × 15 docs ≈ 530 MB. **La BD pesa 30 GB.** El coste real está en el crawl y el LLM, no en el disco.

## Relacionados
- `docs/roadmap/verificacion-convocatorias-documentos-proceso.md` — diseño, diagnóstico medido y fases.
- `docs/runbooks/rollover-oposiciones.md` §2.2 — abrir ciclo (`rollover_convocatoria()`), nunca mutar.
- `docs/maintenance/oeps-convocatorias-seguimiento.md` — señales de seguimiento (sistema ANTERIOR, complementario).
- `docs/runbooks/verificar-epigrafes-scope.md` — el gemelo S2: mismo patrón de verificación sobre el temario.
