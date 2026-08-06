# T-207 — sesión w2, 06/08/2026

Estado de partida (recontado con `npm run citas:barrido` hoy, `DATABASE_URL="$VENCE_LECTOR_URL?sslmode=require"`):
**14 AJENAS** (la ficha decía "quedan 15" del cierre del 28/07 — la diferencia es ruido de medición,
no trabajo nuevo sin hacer). Al cierre de esta sesión: **10**.

## 1) ARREGLO DE DETECTOR — cross-law, aplicado y con tests (código, no dato)

**Reproducido y medido:** `scripts/impugnaciones/barrido-citas.cjs` (`refDeclaradaDistinta`)
reconocía que una explicación declara OTRO ARTÍCULO («Art. 4.2.a RP» en una pregunta de LOGP), pero
al comprobar si esa cita era literal buscaba «artículo 4 de LOGP» — la MISMA ley que la vinculada —
en vez de «artículo 4 de RP», que es la que la propia explicación nombra. Tres preguntas CORRECTAS
salían acusadas de cita ajena por este único motivo, verificadas una a una contra `articles.content`:

| pregunta | vinculada a | cita declara | verificado |
|---|---|---|---|
| `273b6309` | LOGP art. 3 | **RP** art. 4.2.a | RP art.4.2.a existe y es literal, carácter por carácter |
| `df5aeb28` | RP art. 12 | **LOGP** art. 8.2 | LOGP art.8.2 existe y es literal |
| `b72000de` | Ley 5/2023 Andalucía art. 33 | **TREBEP (RDL 5/2015)** art. 53.5 | RDL 5/2015 art.53 existe y es literal — dos candidatos en el texto (la sigla "TREBEP" y el `short_name` real "RDL 5/2015"), solo el segundo resuelve contra nuestra BD |
| `c0defc3f` (efecto colateral, no buscado) | Ley 13/1990 CES CyL art. 5 | **Ley 1/2002 CyL** art. 7.5 | Ley 1/2002 CyL art.7 existe y es literal |

**Arreglo:** nueva función `leyesDeclaradasParaCita()` (compañera de `refDeclaradaDistinta`, mismo
criterio de "cuál cita se juzga") que extrae candidatos de ley junto al número de artículo — de
forma deliberadamente permisiva (sigla en mayúsculas, sigla mixta tipo "LECrim", o "Ley N/YYYY") —
y el CLI prueba cada candidato contra `laws.short_name`/`name` reales antes de eximir. Un
candidato que no exista como ley simplemente no resuelve nada: el fallo es seguro, no genera
falsos negativos nuevos.

**Medido antes/después con el barrido completo (44.751 explicaciones, banco entero):**
`declaradas y correctas` sube de 41 a **49** (+8, más de las 4 que motivaron el arreglo — el
patrón se repite en más sitios del banco) y **AJENAS baja de 14 a 10**.

**Tests:** `__tests__/impugnaciones/citaDeApoyoDeclarada.test.ts` — 22 preexistentes siguen en
verde (el cambio no toca el contrato de `refDeclaradaDistinta`, que sigue devolviendo string|null
exactamente igual) + **4 nuevos** con los casos reales de `273b6309` y `b72000de`.

**Riesgo verificado:** ningún test de `__tests__/impugnaciones/` (219 tests, 17 suites) ni de
`__tests__/health/content-sweep-parity.test.ts` (172 tests, que fija la paridad del kind
`cita_no_literal` entre el CLI y el barrido de salud) se rompe.

## 2) DOS MISLINKS verificados, plan de reancle listo (dry-run)

`ebd70c34` y `b471ef18` cuelgan del art. 10 de RD 1372/1986 (Reglamento de Bienes EELL), pero sus
explicaciones citan, **verbatim, carácter por carácter**, el contenido REAL de los arts. **11** y
**12** respectivamente (verificado contra `articles.content`, no contra la ficha):

- `ebd70c34`: pide los requisitos de la adquisición ONEROSA (normativa de contratación + valoración
  pericial de inmuebles) → eso es el **art. 11.1**, no el 10 (el 10 solo lista los MODOS de
  adquirir: por Ley, oneroso, herencia, prescripción, ocupación…, sin detallar requisitos).
- `b471ef18`: pide la restricción de la adquisición GRATUITA (herencia/legado/donación) → eso es
  el **art. 12.1-12.2**, no el 10.

Plan en `plan-reanclaje-reglamento-bienes-eell.json`, validado con
`node scripts/reanclar-preguntas.cjs plan-reanclaje-reglamento-bienes-eell.json` (dry-run, dos
movimientos, 0 problemas). **Pérdida de tema declarada y aceptada** (mismo criterio que
`4438d206` en T-561): el art.10 sirve a 4 temas (dos diputaciones de más, Cádiz T20 y Cuenca T14);
los arts.11/12 solo a 2 (Ourense T14, Huelva T13) — mover el ancla sirve la pregunta correctamente
donde SÍ tiene scope y dejar de servirla donde el ancla no sostenía su respuesta.

Aplicar (necesita escritura, un trabajador NO puede):
```bash
npx tsx --env-file=.env.local scripts/reanclar-preguntas.cjs data/pilotos/t207-citas-w2/plan-reanclaje-reglamento-bienes-eell.json --apply
```

## 3) TRES citas genuinamente fabricadas — recomendado `needs_human`, NO reescritas

Mismo Reglamento Bienes EELL: `f4e51a3b` (art.1), `d2a801b4` (art.3), `1fb9247e` (art.4). Sus
explicaciones citan textos que **no aparecen en NINGUNA parte de las 138 filas de artículos de
esta ley** (comprobado con grep de las frases distintivas de cada cita contra `articles.content`
de todo `law_id`, cero coincidencias) — a diferencia de los dos mislinks de arriba, aquí no hay un
artículo real al que reanclar.

**Por qué NO las he reescrito** (y no basta con "poner la cita real del artículo"): al leer el art.
1/3/4 REALES contra lo que cada PREGUNTA pide, el enunciado tampoco encaja bien con lo que esos
artículos regulan de verdad:
- El art. 1 real es una lista de **fuentes normativas** aplicables (legislación estatal básica,
  autonómica, ordenanzas…), no "qué bienes están sometidos y qué debe hacer la Corporación" que
  pregunta `f4e51a3b`.
- El art. 3 real solo **define** qué son bienes de uso público (enumeración: caminos, plazas,
  parques…) y cuándo se afectan; no dice nada sobre "libre y común, sin distinción de personas"
  que pregunta `d2a801b4` — ese es un principio doctrinal real, pero no está en ESTE artículo.
- El art. 4 real es una enumeración de ejemplos de bienes de servicio público; el "integran el
  dominio público… mismo régimen de protección" de la clave de `1fb9247e` es cierto por el
  art. 2.2 + 5 combinados (clasificación + inalienabilidad), no por el art. 4 solo.

**SOSPECHO que las 5 preguntas de este cluster nacieron de una generación que alucinó contenido
plausible en vez de trabajar sobre el artículo real** — mismo síntoma en las 5 (mismo estilo de
cita, mismo patrón de "afirmación genérica de doctrina administrativa" en vez de texto literal),
pero NO lo puedo demostrar sin ver el proceso de generación. Lo que SÍ demostré: ninguna de las 3
tiene su cita en ningún artículo real de la ley, y el enunciado de las 3 no se corresponde
limpiamente con un solo artículo — por eso recomiendo `needs_human` con
`transition_question_state` en vez de una reescritura mía que tendría que inventar cuál es "la"
fuente correcta.

## 4) Lo que queda, ya diagnosticado por sesiones previas (no repetido aquí)

- `1719f4e5` (CP art. 49): ya diagnosticado el 28/07 como hallazgo real ("atribuye al 49 un texto
  que es de la suspensión"), pendiente de reparar.
- `f7392e33` (Reglamento 3/1995 Jueces de Paz art. 21): "falta la fuente" — el Reglamento 3/1995
  del CGPJ no aparece en el id de BOE probado; sigue sin resolver.

## 5) Dos patrones de detector NUEVOS, distintos del cross-law, documentados pero NO arreglados

- `f229230e` (LOPJ art. 445) y `31a955e5` (LECrim art. 184): la cita declarada SÍ es del artículo
  correcto y de la MISMA ley, y el contenido en BD coincide — pero la explicación OMITE una parte
  intermedia sin marcar "…", así que como cadena contigua no es literal ni siquiera contra el
  artículo bueno (`f229230e` salta del 2.º al 4.º apartado sin elipsis; `31a955e5` omite "que
  estén a las órdenes de los mismos" antes de "se empleará"). Arreglo correcto: añadir "…" en la
  cita, no tocar el detector — verificado con `citaAusente` directamente contra el artículo
  correcto, sigue dando "ausente" por la omisión sin marcar.
- `aac80b17` (TFUE art. 228): la atribución de las DOS citas del blockquote vive en texto de
  PROSA fuera del blockquote ("Contexto: … artículo 228, apartado 2." y "conforme al artículo 16
  del Estatuto…", ninguna línea empieza por `>`), así que `citasAtribuidas` — que solo escanea
  líneas de blockquote — no la ve. Verificado: las dos citas SON literales contra TFUE art.228.2 y
  el Estatuto del TJUE art.16 respectivamente (ambas comprobadas a mano). Arreglo correcto sería
  ampliar `citasAtribuidas` para mirar también la línea de prosa INMEDIATAMENTE anterior al
  blockquote — no lo hice por prudencia: es un cambio de mayor alcance (afecta a la ventana de
  búsqueda para TODAS las citas, no solo esta) y solo tengo un caso real que lo pida.
