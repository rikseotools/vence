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
