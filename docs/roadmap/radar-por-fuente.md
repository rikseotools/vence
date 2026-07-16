# Radar: invertir el bucle — de "por oposición" a "por FUENTE"

> **Estado:** diseño + prototipo (16/07/2026). Disparado por el triaje de señales OEP de ese día: de
> 7 señales trabajadas, **3 estaban enganchadas al cuerpo equivocado** y 2 traían datos falsos.

## El problema

`detect-oep-llm.service.ts` recorre **oposiciones** y atribuye lo que extrae a aquella cuyo
`seguimiento_url` estaba leyendo:

```js
for (const opo of oposiciones) {
  // …lee opo.seguimientoUrl, el LLM extrae UNA convocatoria…
  oposicionId: opo.id,        // ← la atribución sale del CAMINO DEL CRAWL, no del contenido
}
```

**La dirección de un documento no es su contenido.** Si la URL es el tablón general de la entidad —que
lista muchos cuerpos— el LLM elige uno y se lo endosa a la oposición que tocaba leer.

### No es un caso raro: es la mitad del catálogo (medido 16/07)

| | |
|---|---|
| Oposiciones con `seguimiento_url` | **472** |
| Fuentes DISTINTAS | **320** |
| URLs compartidas por varias oposiciones | **75** |
| **Oposiciones afectadas** | **227 (48%)** |

`administracion.gob.es` la comparten **22** oposiciones; el tablón de Valladolid, **6**; Navarra, 6;
Canarias y Madrid, 5. Para 227 filas, *"extrae la convocatoria de ESTE cuerpo"* es **una adivinanza
por construcción**.

### Consecuencia 1 — señales en la fila equivocada (3 casos reales el mismo día)

- *"Administrativo/a por Promoción Interna"* (C1) → fila de `auxiliar-administrativo-ayuntamiento-valladolid` (C2).
- *"Administratiu/va - Escala Administrativa, subgrup C1"* → fila de Auxiliar de la URV. **Se aplicó el 25/06**: se cambió el estado de una fila con datos de otro cuerpo.
- *"Cuerpo Facultativo Superior … Veterinario/a"* → fila GENÉRICA del cuerpo, con la de veterinario **vacía al lado** (y el propio `boe_reference` ya decía "(Veterinario/a)").

### Consecuencia 2 — se TIRA dato bueno (la peor, y la invisible)

Lo que no es el cuerpo de la oposición se descarta (`hasOepInfo=false`). El tablón de Valladolid lista
Administrativo, Inspector, Subinspector y Auxiliar; al escanear Auxiliar, **los otros tres se tiran**.

**Ese es el motivo real de que no tuviéramos fila de Inspector ni de Administrativo de Valladolid:
estaban en un tablón que ya habíamos leído… y descartado.** El radar los vio y los tiró, un día tras
otro. Contradice de plano la doctrina del manual: *"descartar es la EXCEPCIÓN; descartar tira dato"*.

### Por qué el prompt no basta

El `EXTRACTION_SYSTEM_PROMPT` **ya dice lo correcto**: *"Las páginas oficiales suelen listar MUCHOS
cuerpos a la vez… NO cojas otro cuerpo… si no es el cuerpo de la oposición, ignóralo"*. Y aun así el
LLM cogió otro cuerpo **tres veces**. Por eso el propio campo se documenta como
`cuerpoDetectado: … (para verificación)` — **la verificación estaba diseñada y nunca se implementó**
(parche mínimo aplicado el 16/07: `classifyFamily` en el sensor; caza 2 de 3).

**Un prompt no es un contrato.** No se arregla pidiéndolo mejor.

## La solución: invertir el bucle

```
para cada FUENTE (320, no 472):
    fetch UNA vez → clonar al corpus (evidencia durable, con hash)
    LLM: "lista TODAS las convocatorias de esta página:
          cuerpo, plazas, fechas, su enlace y su CITA LITERAL"
    para cada convocatoria extraída:
        casar contra el catálogo (familia + ámbito + entidad + grupo)
          → casa    → señal para ESA oposición
          → no casa → DESCUBRIMIENTO (se cataloga; NO se tira)
```

| | Hoy | Reforma |
|---|---|---|
| Unidad del bucle | oposición (472) | **fuente (320)** |
| Atribución | el camino del crawl | **el contenido, vía matcher** |
| Lo que no es "tu" cuerpo | **se tira** | **descubrimiento → se cataloga** |
| Fetches + llamadas LLM | 472 | **320 (−32%)** |
| Corpus | se llena por accidente (hoy: 7 docs) | **una fuente = un documento (320)** |
| Engancharse a la fila equivocada | posible (48% del catálogo) | **imposible por construcción** |

### Lo que la reforma NO resuelve (y no se va a fingir)

Casar *"Inspector/a de la Policía Municipal"* contra `policia-local-valladolid` (agente) o
*"…Veterinario/a"* contra la fila genérica del cuerpo **sigue necesitando criterio**: son la misma
familia y el matcher no baja a escala/especialidad. Eso queda cubierto por el guardarraíl
`senal_cuerpo_no_cuadra` (`npm run audit:convocatorias`) + Claude en el bucle. **Se automatiza lo que
no requiere juicio; el juicio no.**

Tampoco arregla que una señal traiga **datos falsos** (Navarra decía examen el 01/02 y era el 08/02;
León decía grupo A2 y era C1 — en ambos NUESTRO dato era el bueno). Para eso está la verificación
contra el documento clonado, no el sensor.

## Resultado del PROTOTIPO (16/07, contra el tablón real de Valladolid)

`backend/scripts/sim-radar-por-fuente.ts`, leyendo del corpus (sin red):

```
HOY:     6 pasadas del sensor · extrae 6 (una por oposición) · TIRA el resto
REFORMA: 1 pasada · extrae 10 convocatorias, cada una con su cita literal
```

**Diez convocatorias reales en esa página.** Lo que el bucle actual descarta CADA DÍA:

| convocatoria | plazas | |
|---|---|---|
| **PEÓN/A** | **45** | turno libre, pruebas realizadas |
| Capataz/a | 3 | libre |
| Capataz/a del Servicio de Limpieza | 4 | promoción interna |
| Técnico/a Medio de Gestión | — | |
| Técnico/a Medio Base en Medio Ambiente | 2 | libre |
| Jefe/a de Sección (Agencia de Innovación) · Jefe/a Centro Promoción Educativa | 1+1 | comisión de servicios |

**45 plazas de Peón llevan meses en un tablón que leemos a diario y las tiramos siempre.** No las
descarta un humano con criterio: **las tira el bucle**. Es exactamente lo que la REGLA DE DESCARTE
del manual prohíbe.

Y **"ADMINISTRATIVO/A, 15 plazas, promoción interna" CASÓ SOLO** con `administrativo-ayuntamiento-valladolid`
— la fila que hubo que catalogar A MANO ese mismo día tras destripar la señal mal enganchada. Con el
bucle invertido habría aparecido sola.

> **Honestidad sobre el prototipo:** su casado es crudo (Inspector y Subinspector dan "3 candidatas"
> por compartir familia `policia_local`). La reforma real usa `pickBestMatch` (familia + ámbito +
> entidad + grupo). Eso no cambia la conclusión: el valor no está en casar mejor, está en **ver las
> diez en vez de seis y no tirar nueve**.

## Y hay más: la misma lectura da los TIMELINES completos (probado 16/07)

La pregunta natural es: ¿la fuente solo dice "hay una convocatoria de X", o trae también sus hitos?
**Trae los hitos.** Extendiendo el prompt del prototipo a "lista TODAS las convocatorias **y para cada
una su cronología**", contra el mismo tablón y leyendo del corpus:

```
stop_reason: end_turn · 5.569 tokens · 29 segundos
→ 10 convocatorias CON su cronología · cada hito con su CITA LITERAL
```

Y salen **ya tipados con nuestro vocabulario** (`convocatoria_publicada`, `bases_publicadas`,
`plazo_inicio`, `lista_provisional`, `nombramientos`…), listos para `convocatoria_hitos`:

| convocatoria | hitos |
|---|---|
| ADMINISTRATIVO/A (15 plz) | **9** — desde las bases de nov-2024 a la lista provisional de dic-2025 |
| SUBINSPECTOR/A (3 plz) | 8 |
| INSPECTOR/A (3 plz) | 8 |
| TÉCNICO/A MEDIO DE GESTIÓN (4 plz) | **9** |
| CAPATAZ/A (3 plz) | 5 — incluye una **rectificación de convocatoria con nuevo plazo** |
| CAPATAZ/A LIMPIEZA (4 plz) | 4 |
| JEFE/A DE SECCIÓN (1 plz) | 3 — incluido su **nombramiento del 15/07** |

**El sistema de hoy saca de esa misma página: una convocatoria, sin timeline.**

> ⚠️ **Gotcha medido:** el primer intento devolvió 0. Causa: `stop_reason: max_tokens` (4.000/4.000) —
> el JSON se cortó a la mitad. **La extracción funcionaba; le faltaba sitio.** Con 16k cabe de sobra
> (usó 5.569). Mismo patrón que el truncado a 12.000 chars que ocultaba la base 9 de Marta:
> **truncar barato = parecer que el modelo no sabe.** Si una fuente enorme no cupiera, dos pasadas
> (listar convocatorias → pedir el timeline de cada una), no recortar a ciegas.

**Esto cambia lo que ES la reforma:** no es solo arreglar la atribución y dejar de tirar dato — es
**la vía por la que el corpus y los timelines se llenan**. El trabajo manual de media hora sobre
Subinspector (0 → 11 hitos) sale en 29 segundos, y para las diez convocatorias a la vez.

## ⛔ La reforma NO da completitud — y la capa que debía darla está MUERTA (medido 16/07)

**Pregunta obligada:** con el bucle por fuente, ¿tendremos todas las OEP y convocatorias sin perder
señal? **No.** Y conviene decirlo antes de que alguien lea "por fuente" y crea que cubre todo.

| | |
|---|---|
| Oposiciones en catálogo | **2.542** |
| Con `seguimiento_url` | **472** |
| **SIN ninguna fuente** | **2.070 (81%)** |

El bucle por fuente arregla el sensor de las 472. **No ve el 81% del catálogo.** Mejora la CALIDAD de
lo que miramos, no cuánto abarcamos.

### La completitud solo puede venir de los BOLETINES

En España **toda convocatoria tiene que publicarse** en el BOE, el autonómico o el provincial. Eso no
es una fuente más: es una **garantía legal**. Y es un conjunto **ACOTADO** (~70: BOE + 17 autonómicos +
provinciales) frente a los 8.000 ayuntamientos cuyas webs son inabarcables.

**Cada capa tiene un trabajo distinto y confundirlas es el error de fondo:**

| capa | garantiza | NO da |
|---|---|---|
| **Boletines** (~70) | **completitud POR LEY**: si se convocó, está | el timeline (publican el acto, no la cronología) |
| **Agregador** (PAG) | contraste | detalle |
| **Páginas de entidad** (320) | **profundidad**: plantillas, listas, avisos del tribunal, aulas | solo el **19%** del catálogo |

**Esta reforma mejora la TERCERA fila.** La completitud es otro trabajo.

### Y el estado real de la capa de boletines (`detection_sources`)

| | |
|---|---|
| Fuentes registradas (todas `is_active=true`) | **173** |
| **Con error** | **101 (58%)** — 61× HTTP 404, 20× fetch failed, 8× HTTP 403, 8× extraction_failed |
| **Que NUNCA han funcionado** (`last_success_at IS NULL`) | **99** |
| Último `last_checked` | **31/05/2026 — hace 45 días** |
| Señales de `generic_source` en 30 días | **0** |

**Y no leen boletines.** El `boletin_name` dice BOJA/BOCM/DOGV/BOA… y el `listing_url` apunta a
**portales de entidad**:

- `BOE` → `administracion.gob.es/pag_Home/empleoPublico/…` (el **agregador**, no el BOE)
- `BOJA` → `juntadeandalucia.es/organismos/iaap/…` (el portal del IAAP)
- `BOCM` → `comunidad.madrid/servicios/empleo/oposiciones` → **HTTP 404**
- `DOGV` → `hisenda.gva.es/…` → **HTTP 404**

Los portales se reorganizan y sus URLs mueren; **los sumarios de los boletines son estables y muchos
tienen API/XML/RSS** (el BOE, sin ir más lejos). Se construyó la capa de completitud sobre lo único
que se mueve.

**Lo que SÍ vive** (señales últimos 30 días): `llm_semantic` 180 · `pag_empleo` 177 · `boe_api` 46 ·
`regional_scan` 43 · `generic_source` **0**.

### Qué haría falta para que sea completo, robusto, escalable y fiable

1. **Completo** → leer los **BOLETINES de verdad** (sumario diario), no sus portales. Conjunto acotado
   (~70) y garantía legal. Es el trabajo que `detection_sources` decía hacer y no hace.
2. **Robusto** → una fuente rota tiene que **doler**. Hoy 101 de 173 llevan 45 días en error y nadie
   se entera: no hay alerta, y `is_active=true` no significa nada. Un sensor que no puede fallar
   ruidosamente no es un sensor.
3. **Escalable** → el bucle por FUENTE (esta reforma) es la forma correcta para ambos: un boletín es
   una fuente con muchas convocatorias, exactamente igual que un tablón. **El mismo bucle sirve para
   las dos capas.**
4. **Fiable** → **cobertura CONOCIDA**, no prometida. Nadie sabía que 2.070 oposiciones no tienen
   fuente ni que el 58% de las fuentes están rotas hasta que se midió hoy. Un sistema que sabe qué NO
   está mirando es fiable; uno que dice "lo tenemos todo" miente en el 81%.

> **Prioridad que sale de esto:** la reforma por fuente sigue valiendo (arregla la atribución, deja de
> tirar dato, llena los timelines). Pero **antes o a la vez** hay que resucitar la capa de boletines,
> porque es la única que puede responder "no se nos escapa nada". Son dos trabajos y no hay que
> mezclarlos.

## Secuencia

1. ✅ **Prototipo contra datos reales** — HECHO (`backend/scripts/sim-radar-por-fuente.ts`, resultado
   arriba). Mismo camino que `notas-extract.ts` y la Fase 2: script contra la fuente real ANTES de
   tocar el cron. La reforma se sostiene: el LLM saca las 10 con cita.
2. **Registro de fuentes** deduplicadas (320) — hoy la fuente vive dentro de `oposiciones.seguimiento_url`.
3. **Reescribir `detect-oep-llm`** al bucle por fuente, reutilizando `pickBestMatch`/`classifyFamily`
   del matcher del radar (que ya existe y tiene la doctrina correcta: *"ante la duda, novel"*).
4. **Los no-match → `discovered_processes`/señal sin `oposicion_id`**, que es el camino que el manual
   ya tiene para catalogar.

## Relacionados
- `backend/src/oep-signals/oep-match.ts` — el matcher bueno (precisión > recall). El sensor LLM nunca lo llamaba.
- `docs/maintenance/oeps-convocatorias-seguimiento.md` — el bucle diario y la REGLA DE DESCARTE.
- `docs/runbooks/verificar-convocatorias.md` — qué se hace con la señal una vez atribuida.
- `docs/roadmap/radar-multicapa.md` — la arquitectura de sensores.
