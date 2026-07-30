# Instrucciones del agente — T-291 tanda 2: explicación barajable para las preguntas MÁS VISTAS

Estas preguntas son las **más servidas del banco** (de 310 a 1.733 apariciones cada una). Ya pasaron
en su día por una verificación, así que el objetivo principal **no** es verificarlas desde cero: es
darles una **explicación estructurada barajable**, que es lo que hoy les falta. Pero la verificación
previa puede ser vieja o superficial, así que compruebas la clave de paso — y si algo no cuadra,
paras y lo dices.

Manual de fondo: `docs/maintenance/revisar-preguntas-con-agente.md` (§3.1 artículo, §3.2 opciones).

## Entrada

- Tu lote: `scratchpad/t291/tanda2/lotes/lote-NN.json` (te dicen el NN).
- El texto **completo** del artículo de cada pregunta en `articulo_fichero`. **Léelo entero.** Varias
  preguntas del lote comparten artículo: aprovecha la lectura, pero escribe una explicación propia
  para cada pregunta.
- `clave_actual_indice`: 0=A, 1=B, 2=C, 3=D, 4=E. Si `opciones["3"]` es `null`, es una pregunta
  **válida de 3 opciones** — no es defecto.
- `explicacion_actual`: lo que hoy ve el opositor. Lee esto **antes** de escribir.

## Los dos caminos, y el criterio para elegir

1. **Si la explicación actual YA analiza opción por opción** (tiene bloques tipo «**A)** …», «Por qué
   B es correcta», o razones separadas por opción): **reestructúrala conservando su contenido**. No
   reinventes lo que ya está bien: pasa cada razón a su índice y quita las letras. Comprueba que lo
   que dice es cierto contra el artículo, pero no lo reescribas por gusto.
2. **Si es prosa corrida, una copia del artículo, o no analiza las opciones**: entonces **escribe las
   razones desde el artículo**. Cada razón tiene que estar anclada en el texto legal: si no puedes
   sostenerla con el artículo, no la inventes — di que la fuente no da para eso.

## Comprobación de la clave (de paso, no es el objetivo)

Mientras escribes, verifica que la clave marcada es la correcta **según el artículo y la norma
vigente**. Ojo con la CE: hay reformas (1992 y 2011) y preguntas antiguas pueden haber quedado
desfasadas. Si la clave no cuadra:

- **NO escribas la explicación estructurada** de esa pregunta.
- Márcala en tu fichero de veredictos como `defecto_clave` con lo que hayas encontrado.
- **Jamás cambies la clave.** Estas preguntas las están viendo cientos de opositores; un flip mal
  hecho rompe una pregunta que estaba bien.

Igual si el artículo vinculado no cubre el supuesto (`defecto_articulo`), si una opción presentada
como correcta no reproduce el texto legal (`defecto_opciones`), o si la pregunta necesita una imagen
o unos datos que no están (`irresoluble`).

## Salida — DOS ficheros. NO toques la base de datos.

Nunca ejecutes UPDATE, ni `transition_question_state`, ni `aplicar-explicacion.ts`. Tú escribes
ficheros; aplica el orquestador.

### 1. `scratchpad/t291/tanda2/veredictos/lote-NN.json`

Un objeto por pregunta distinta del lote (mismo número de objetos que preguntas, `question_id`
**nunca repetido** — compruébalo antes de escribir):

```json
[{"question_id":"uuid","veredicto":"ok_estructurada","via":"reestructurada|escrita_desde_articulo",
  "article_ok":true,"answer_ok":true,"options_ok":true,"confianza":"alta",
  "notas":"≤300 chars: qué comprobaste y contra qué","clave_deberia_ser":null,"articulo_sugerido":null}]
```

`veredicto` ∈ `ok_estructurada` · `defecto_clave` · `defecto_articulo` · `defecto_opciones` ·
`irresoluble`. Solo las `ok_estructurada` llevan fichero de explicación.

### 2. `scratchpad/t291/tanda2/estructuradas/<question_id>.json`

```json
{ "v": 1,
  "intro": "Contexto de una o dos frases (opcional).",
  "cita": { "ref": "Art. 103.1 CE", "texto": "cita LITERAL del artículo" },
  "options": { "0": "Razón referida al CONTENIDO de esa opción.", "1": "…", "2": "…", "3": "…" },
  "outro": "**Clave:** … (opcional)",
  "estilo": "boletin", "frame": "select_correct" }
```

Reglas **duras** (hay gates automáticos que rechazan el fichero si las incumples):

- **Una razón por CADA opción presente**, keada al índice ORIGINAL. Tres opciones → "0","1","2".
- **JAMÁS la letra ni la posición de una opción** en las razones, el `intro` o el `outro`: nada de
  «la opción B», «la primera», «como se vio antes». La letra la pone el render al barajar; escrita,
  miente. Escribe referido al contenido.
  - **Tampoco cites los apartados del articulado por su letra dentro de las razones** («la letra e)
    del artículo 7», «(letra b)»). Aunque nombre la ley y no la pantalla, el detector que decide si
    la pregunta puede barajarse **no distingue una cosa de la otra** y la deja fuera del barajado.
    Nombra la materia: «el artículo 7 enumera los documentos que deban someterse a información
    pública». (En la `cita` sí puedes reproducir el listado con sus letras: la cita no se examina.)
  - **Evita «la segunda frase / afirmación / proposición»** para referirte al artículo: el mismo
    detector lo lee como «la segunda opción». Di «el segundo enunciado del precepto» o reformula.
- **`cita.texto` copia literal** del artículo, sin cambiar ni la puntuación. Si vas a cortar, corta
  en una frontera limpia; **si no hay una cita clara, omite el campo `cita`** — nunca metas ahí
  prosa tuya ni un resumen (el gate lo detecta y la pregunta se queda sin aplicar).
- `intro` **no** empieza con «La respuesta correcta es…»: esa frase la genera el render.
- Si el enunciado pide la **falsa/incorrecta**, pon `"frame": "select_incorrect"`.
- Evita escribir una unidad justo antes de un paréntesis de cierre (`(2-8 ºC)`): el detector lee
  `C)` como una referencia a la opción C. Escribe «entre 2 y 8 ºC».

## Método

1. Lee tu lote y los ficheros de artículo completos.
2. Por cada pregunta: lee la explicación actual, decide el camino (reestructurar o escribir),
   comprueba la clave contra el artículo, y escribe.
3. Al terminar: comprueba que hay **un fichero por cada `ok_estructurada`** y que no repetiste
   ningún `question_id`. Si un fichero de salida ya existía, sobrescríbelo.

Devuelve como respuesta final: cuántas `ok_estructurada` (y de ellas cuántas reestructuradas vs
escritas desde el artículo), cuántas de cada tipo de defecto, y los question_id de los defectos.
