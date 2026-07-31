# T-291 — TANDA 4 (30/07/2026)

Cuarta tanda de explicaciones estructuradas del cubo, y **la primera lanzada con el circuito
completo ya construido**: extractor → 6 agentes → validador de lote → dry-run del aplicador →
aplicación → verificación en BD.

## Resultado

| | |
|---|---|
| preguntas del corte | **150** (exposición de 297 a 208) |
| explicaciones escritas | **149** |
| defectos | **1** (`articulo`) |
| **aplicadas** | **149 / 149** |
| cita **literal** | **135** |
| cita **no literal (inventada)** | **0** |
| sin cita | 14 |
| explicación coherente con la clave | **149 / 149** |
| **barajables de verdad** | **135** |
| **exposición cubierta** | **36.247** |

**Ninguna clave se modificó.**

## Qué cambió respecto a la tanda 2

1. **Office 2016 YA NO se excluye.** Sus 15 artículos se enriquecieron el mismo día ([T-302]), así
   que por primera vez hay contra qué verificar y de qué citar. Antes los agentes solo podían
   dictaminar «el contenedor no da para verificar».
2. **Siguen fuera los contenedores clínicos TCAE**, que no se han enriquecido.
3. Se mantiene la exclusión de lo ya declarado defectuoso, que en la tanda 3 volvía a la cola por
   seguir cumpliendo `explanation_data IS NULL`.

## Las dos puertas atraparon una cada una — y no la misma

Esto es la confirmación de que **hacen falta las dos**, que ya se sospechaba en la tanda 2:

- **El validador de lote** rechazó `d24651bf`: la razón de su meta-opción decía «todas las opciones
  **anteriores**» y «una de ellas». Al barajar, esas frases dejan de ser ciertas.
- **El dry-run del aplicador** rechazó `46a77905`, que el validador **había dejado pasar**: «Ninguna
  opción **anterior** recoge con precisión el procedimiento». Su criterio es más estricto.

Las dos se reescribieron referidas al contenido y pasaron.

## Un fallo de infraestructura que conviene conocer

Cuatro aplicaciones fallaron con **`Failed query`** — no era contenido, era la conexión: el bucle
lanza un proceso `npx tsx` por pregunta y satura. **Se reintentaron y entraron las cuatro.** Si se
repite, no hay que tocar el material: basta con reintentar.

## El defecto

`15707043` (`DEFECTO-…json`): la pregunta enumera supuestos en los que no procede disolver el
Congreso, y cuelga del **art. 116 CE**, que cubre dos de ellos. Los otros dos dependen del **art.
115**, que no estaba en el material entregado. **No es defecto de la pregunta: es que la respuesta
vive en otro artículo.** Es la misma clase que se documentó en [T-342] con `bbae979c` y `8b23bdc4`.

## ⚠️ LO QUE FALTA — la re-verificación (paso 7 del método v2.1)

**No se ha hecho.** Es el paso que revisa las explicaciones **ya aplicadas**, sobre la pregunta viva
en BD y con agentes independientes, y es el único que caza **afirmaciones falsas dentro de razones
bien formadas** — invisibles a todos los gates anteriores, que solo miran la forma.

Rendimiento medido en tandas anteriores: **3,0 %** (tanda 1, al 100 %), **2,5 %** (tanda 2, muestra
del 20 %) y **6,9 %** (tanda 3). Sobre 149, cabe esperar **entre 4 y 10 defectos reales**.

**Cómo hacerlo:** tomar las aplicadas ordenadas por exposición, entregar a agentes independientes la
pregunta viva + su artículo + la explicación aplicada, y pedirles que verifiquen cada afirmación
contra el artículo. Con el 20 % ordenado por exposición se cubre un tercio de la exposición total,
que es el corte que se usó en la tanda 2.

## Ficheros

- `lotes/` — los 6 lotes de entrada tal como los recibieron los agentes.
- `estructuradas/` — las 149 explicaciones aplicadas (fuente de verdad de lo que se escribió).
- `veredictos/` — los veredictos por lote, en el formato que espera `validar-lote-t291.ts`.
- `PROMPT-TANDA4.md` — el prompt exacto, con las reglas y el porqué de cada una.
- `extraer-tanda4.cjs` — el extractor, con los criterios del corte comentados.

**Reproducir la validación:**
```bash
npx tsx --env-file=.env.local scripts/revision/validar-lote-t291.ts --base <dir-con-lotes-y-veredictos>
```

---

# ✅ RE-VERIFICACIÓN (paso 7) — HECHA el 30/07

**149 revisadas al 100 %** (no muestra), por 6 agentes independientes, leyendo **la pregunta viva en
BD con la explicación ya aplicada** y contrastando cada afirmación contra el artículo.

| | |
|---|---|
| revisadas | **149** |
| hallazgos | **10 (6,7 %)** |
| **defectos REALES** | **1** |
| afirmaciones ciertas pero **sin respaldo en el artículo** | **9** |

## 🔴 El único defecto real: `7073ba96` (225 exposiciones) — CORREGIDO

Pregunta: «El estado de alarma será declarado…». La razón de la opción C afirmaba que **«la
autorización previa y el plazo de quince días prorrogables por igual plazo corresponden al estado de
excepción»**.

Es falso, y de la clase exacta que este paso existe para cazar: **el art. 116.3 fija treinta días**
para la excepción, no quince. Los quince son el plazo del **alarma** (art. 116.2), que además no
exige autorización previa sino dar cuenta. La razón intercambiaba las dos cifras de dos apartados
consecutivos del mismo artículo — una frase impecable de forma, con el dato cambiado.

Reescrita: ahora explica que la opción **mezcla los dos regímenes** y por qué.

## Los otros 9 NO son defectos de la explicación

Los agentes los etiquetaron todos como `afirmacion_falsa`, pero al leerlos dicen otra cosa: **la
afirmación es cierta en el mundo real y el artículo no la respalda**. Ejemplos:

- `d9708b11` (244 exp) — «Autoajustar a la ventana» en tablas de Word: cierto, pero `Word 365` art.1
  no menciona las opciones de autoajuste.
- `fe316311` (245 exp) — virus, troyano y spyware como software malicioso: cierto, pero
  `Windows 11` art.1 no tiene sección de malware.
- `3a4127af` (232 exp) — adjuntos de correo, colgada de un artículo sobre bits y bytes.
- Y seis más de Outlook 365, Word 365 y Explorador de Windows 11.

**Son huecos de temario, no falsedades**, y coinciden con las 14 que quedaron `sin cita`. Su sitio es
[T-302] (enriquecer el contenedor) y la cola de [T-342], no una corrección de la explicación.

> ⚠️ **Lección de método:** los agentes de re-verificación **no distinguen «falso» de «no
> respaldado»** y lo etiquetan todo como `afirmacion_falsa`. Hay que leer los 10, no contarlos. Aquí
> la proporción fue 1 real / 9 de temario.

## Comparativa con las tandas anteriores

| tanda | alcance | defecto |
|---|---|---|
| 1 | 100 % de 269 | 3,0 % |
| 2 | muestra 20 % de 396 | 2,5 % |
| 3 | 100 % de 72 | 6,9 % |
| **4** | **100 % de 149** | **6,7 % bruto · 0,7 % real** |

El 6,7 % bruto es comparable a las anteriores; separando el tipo, el **defecto real de explicación
fue de 1 sobre 149**. Es la tanda más limpia hasta ahora, y la diferencia plausible es que fue la
primera con los contenedores de Office 2016 ya enriquecidos y con el circuito completo de gates.
