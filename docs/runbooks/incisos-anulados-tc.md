# Runbook — Incisos anulados por el TC (o disposiciones derogadas) sin nota de vigencia

**Frase-gatillo:** *"revisa los incisos anulados"* (o *"revisa las disposiciones anuladas"*).

## Qué problema resuelve

Un artículo importado del BOE consolidado puede contener un **inciso que el Tribunal
Constitucional declaró inconstitucional y nulo** (o una parte derogada) que **nuestro
import no marcó**. Si la clave de una pregunta apunta a ese inciso anulado, damos por
**válido lo que ya no está vigente**.

**Caso origen (19/07):** art. **126.2 LBRL** — el inciso que permitía al Alcalde nombrar
como miembros de la Junta de Gobierno Local a personas **no concejales** fue declarado
inconstitucional y nulo por la **STC 103/2013** (BOE-A-2013-5446). Nuestro artículo no
tenía la nota y la clave daba el inciso anulado como correcto → una impugnación (Alfonso)
se respondió mal antes de reabrir como bug.

**Hueco que cubre:** ni el **monitor BOE** (ve cambios *futuros*), ni **completitud-leyes**
(ve artículos que *faltan*), ni el radar de epígrafes (mira *materia*) vigilaban la
**vigencia de incisos ya anulados** en el consolidado.

## Cómo funciona el detector

Fuente robusta = **API datosabiertos del BOE**:
`…/legislacion-consolidada/id/<BOE-ID>/analisis` → `data[0].referencias.posteriores[0]
.posterior[]`, cada una con `relacion.texto` (`SE DECLARA`), `id_norma` (BOE de la
sentencia) y `texto` (describe qué se declara y sobre qué artículos).

- Lógica pura + testeada: `lib/laws/annulledProvisions.ts` (13 tests).
- Script: `scripts/audit-annulled-provisions.cjs`.
- Filtra a `SE DECLARA` con `inconstitucional`/`nulidad`, extrae los artículos **anulados**
  (mirando la palabra ANTES de cada `art. N`, para no coger los *mantenidos* — `constitucionalidad
  del art. 130` — ni las **referencias cruzadas** a otras normas — `art. 1.17 de la Ley 27/2013`).
- Cruza con nuestros artículos: flaguea los que **servimos SIN nota de vigencia**.

## Procedimiento (Claude en el bucle)

```bash
# una ley concreta
node scripts/audit-annulled-provisions.cjs --law "Ley 7/1985"
# lote (prioriza leyes que sirven en temas vivos); --emit escribe a observable_events
node scripts/audit-annulled-provisions.cjs --limit 40 [--emit]
```

Para **cada hallazgo** (`article_annulled_unmarked`):

1. **Verifica el inciso concreto contra la sentencia** (WebFetch a la STC por su `id_norma`,
   o el `texto` de la referencia): ¿qué parte exacta se anuló y qué quedó vigente?
2. **Añade la nota de vigencia con la herramienta, NO a mano y NO en el `content`** (corregido
   27/07/2026, T-169):

   ```bash
   node scripts/capturar-vigencia-articulo.cjs --boe BOE-A-2003-20977 --art 16          # dry-run
   node scripts/capturar-vigencia-articulo.cjs --boe BOE-A-2003-20977 --art 16 --apply
   ```

   Trae la nota **literal** del BOE y la guarda en la columna `articles.vigencia_notes`
   (T-048), que es la fuente canónica: **no toca `content`** —las explicaciones lo citan
   verbatim— y el render de teoría la pinta al vuelo (`lib/teoria/annotateVigencia`, capa 2),
   así que el opositor la ve igual.

   > La versión v1 de este runbook mandaba escribir `[Nota de vigencia: …]` dentro del
   > `content`. **Quedó obsoleta al llegar T-048 y nadie la actualizó**, con un efecto
   > perverso: el detector buscaba la nota en el `content`, la herramienta la escribía en la
   > columna, y marcar un artículo correctamente **no apagaba el aviso** (medido con el art.
   > 607 del CP). Lo único que lo apagaba era contaminar el `content`. El formato en `content`
   > se sigue aceptando como legacy, pero no se escribe más.
3. **REVISA la clave de las preguntas de ese artículo**: ninguna debe dar por válido el
   inciso anulado. Si alguna lo hace → re-clave / neutralizar enunciado / `needs_human`.
4. **NUNCA auto-corregir la clave** — revisión humana (como en el caso art. 126.2 LBRL).

## Alcance / estado

- v1: leyes **nacionales** con `boe_url` de BOE consolidado (la API datosabiertos las cubre).
  Regionales (boletines autonómicos) no tienen esta API → quedan fuera de v1.
- **Barrido completo (384 leyes)** = **cron incremental** (hermano del de completitud), no
  un one-shot (rate limits del BOE). Pendiente de cablear al sweep/cron.
- Hallazgos abiertos en LBRL al construirlo (20/07): art. **104 bis** (STC 54/2017), art.
  **26** (STC 111/2016), art. **57 bis** (STC 41/2016) — revisar.

Relacionado: `docs/roadmap/verificacion-completitud-leyes.md`, memoria del incidente Alfonso.

## Segunda clase: los pronunciamientos COMPETENCIALES (añadido 26/07/2026, T-132)

El TC no solo anula. En leyes estatales con incidencia autonómica usa una fórmula muy
frecuente que **no contiene la palabra "inconstitucional"**:

> *"Téngase en cuenta que se declara que el apartado 4 **no es conforme con el orden
> constitucional de competencias**, en los términos del fundamento jurídico 6 G) c), por la
> Sentencia del TC 68/2021, de 18 de marzo. Ref. BOE-A-2021-6614"*

**Dos motivos por los que se escapaba entera:**

1. El filtro de nulidad exige el prefijo `in-` (para no casar con "constitucionalidad"), así
   que "orden **constitucional** de competencias" pasa de largo.
2. **El análisis del BOE no la enumera por artículo.** Para la LCSP dice literalmente *"y no
   conforme con el orden constitucional de competencias **lo indicado**"*, sin decir qué.
   El dato por-artículo SOLO está en la nota del texto consolidado.

**Comando:**

```bash
node scripts/audit-notas-vigencia-tc.cjs "Ley 9/2017"     # solo artículos SERVIDOS
node scripts/audit-notas-vigencia-tc.cjs "Ley 9/2017" --todos --json
```

**La remediación NO es la misma:**

| Clase | Qué significa | Qué se hace |
|---|---|---|
| `nulidad` 🔴 | el inciso **no existe** | nota de vigencia **+ revisar la clave** de las preguntas de ese artículo |
| `competencial` 🟠 | el precepto **no es nulo**: es inaplicable como básico o en CCAA con competencia propia | **nota de vigencia y punto** — NO se jubilan preguntas |

Una pregunta que dé por aplicable sin matiz un apartado declarado no conforme sí es
impugnable, pero la respuesta es matizar, no retirar.

## La otra mitad: ¿alguna CLAVE enseña el inciso anulado? (27/07/2026, T-169)

Marcar el artículo no basta. Lo que produjo el incidente fundacional no fue la falta de nota,
fue **una clave que daba por válido un inciso anulado**. Y eso ya se puede comprobar solo:

```bash
node scripts/audit-clave-inciso-anulado.cjs           # todo el banco
node scripts/audit-clave-inciso-anulado.cjs --ley "Ley 7/1985" [--emit] [--gate]
```

Cruza `vigencia_notes.annulledFragments` —el inciso **literal** que el BOE marca como
anulado— con la opción correcta de cada pregunta viva de ese artículo. Es comparación de
subcadenas: **si la máquina puede, que lo haga la máquina** (mismo criterio que
`cita_blockquote_literal_ok`). Núcleo puro `lib/laws/claveConIncisoAnulado.js`.

**Bandas, calibradas sobre los 50 artículos que hoy tienen fragmento:**

| Banda | Cuándo | Qué hacer |
|---|---|---|
| `alta` | el inciso es **distintivo** (≥30 ch): no coincide por azar | mirar YA: la clave casi seguro enseña algo anulado |
| `revisar` | fragmento **corto** («favorable», «legalmente», «nieguen o») | cola de revisión, **no badge**: son los más peligrosos y a la vez los más ruidosos |

Se descartan los **marcadores** (`(Anulado)`, `(Anulada).`) y las **rúbricas** capturadas por
error, que son la mitad de lo que trae el BOE — casarlos sería ruido puro.

**Caso que lo motivó, y sirve de canario:** la pregunta `9d361d19` (art. 92.8 CC, viva y
aprobada) marcaba como correcta *«De un informe **favorable** del Ministerio Fiscal»*, y
«favorable» es el inciso que anuló la **STC 185/2012** — con su propia explicación citando esa
sentencia. Se corrigió quitando la palabra (**la clave no cambia**: sigue siendo la D) y
dejando traza en `observable_events` (`question_annulled_inciso_fixed`). Comprobado que el
detector la caza con la clave antigua y deja de hacerlo con la corregida.

**Estado 27/07:** 201 preguntas vivas comprobadas → **0 hallazgos** tras corregir esa.

## Las TRES marcas del BOE — y por qué "0 hallazgos" engañaba (27/07/2026, T-169)

El filtro `v2` (solo flaguear si el consolidado RETIENE la anulación) se diseñó con el art.
126.2 LBRL, donde el BOE deja el **inciso tachado + nota inline**. Pero el BOE marca la
anulación de **tres** formas, y las otras dos se descartaban como "artículo ya reformado":

| Marca | Ejemplo real | Cuándo la usa el BOE |
|---|---|---|
| Inciso **tachado + nota inline** | art. 126.2 LBRL / STC 103/2013 | el inciso se puede señalar dentro del texto |
| **Nota al pie** (`<p class="nota_pie">`) | art. 16 Ley 38/2003 / STC 206/2013 · art. 9.2 y 133 CC | **anulación INDIRECTA**: lo anulado es la norma MODIFICADORA, el cuerpo queda limpio |
| **`(Anulado)`** a secas | art. 7.1 a) Ley 38/2003 / STC 70/2016 | el apartado se sustituye por esa palabra, sin sentencia al lado |

**Y un falso verde peor, del mismo día:** el CLI tenía su propio regex `artículo\s+N` para
localizar el bloque del artículo. El **Código Civil rotula sus 2.444 bloques como "Art 92"**
→ no localizaba ninguno, y sin bloque el script hace `continue` **en silencio**: informaba
"0 hallazgos" sin haber comprobado nada. Ya usa el núcleo compartido
`mapaBloquesPorArticulo`, que entiende dígitos, letra, `bis`/`ter` y la forma abreviada.
Tras arreglarlo aparecieron **9 hallazgos en 60 leyes** donde antes había 0 — entre ellos
seis del Código Civil (arts. 92, 9, 133, 136 ×2, 211), servidos con 50 preguntas activas.

**Los tres espejos.** Esta lógica vive en `lib/laws/annulledProvisions.ts` y está COPIADA en
el backend (`annulled-vigencia-sweep/vigencia-logic.ts`) y en el CLI. El guardarraíl
`__tests__/backend/annulledVigenciaMirror.test.ts` corre las tres sobre el mismo fixture y
exige el mismo veredicto: **si tocas una, las otras dan CI en rojo**. El falso verde de
T-169 nació justo de un espejo que nadie comparaba.

**Ojo al calibrar:** un artículo cuya STC anuló *"la redacción original"* ya sustituida
(caso CP art. 335) sigue apareciendo. No es ruido que haya que filtrar: el BOE mantiene la
nota, así que la remediación es **capturarla** — barata y no destructiva. Lo que NO procede
ahí es tocar preguntas: la redacción vigente es otra.

**⚠️ "NO CONCLUYENTE" no es "limpio".** Si el barrido avisa de que muchos artículos no se
localizaron en el índice del BOE, esos **no se han comprobado**. Pasó con la LOPJ: sus 713
artículos van en letra ("Artículo primero") y el mapeo solo entendía dígitos → 665 de 665
sin comprobar e informe de "0 hallazgos". Arreglado compartiendo el conversor
`lib/laws/spanishNumber.js`, pero el aviso queda como red.

