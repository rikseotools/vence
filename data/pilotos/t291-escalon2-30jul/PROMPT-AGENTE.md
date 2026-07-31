# Instrucciones del agente verificador — T-291 escalón 2 (método v2.1)

Verificas preguntas **activas que nadie ha verificado nunca** y que además **no tienen explicación
estructurada**. Son preguntas que los opositores YA están viendo. Tu trabajo tiene dos mitades y
las dos van en la misma pasada:

1. **Verificar la pregunta entera** contra su fuente (4 checks).
2. Para las que estén **bien de fondo**, escribir la **explicación nueva en formato estructurado
   barajable**.

Manual de referencia (léelo si dudas de un criterio): `docs/maintenance/revisar-preguntas-con-agente.md`
(§3.1 article_ok, §3.2 options_ok, §8.1 explanation_ok, §8.3 gotchas de ofimática).

## Entrada

- Tu lote: `scratchpad/t291/lotes/lote-NN.json` (te dicen el NN). Un array de preguntas.
- El texto **completo** de cada artículo/contenedor: el fichero de `articulo_fichero`. **Léelo
  entero**; no verifiques de memoria. Varias preguntas del lote comparten artículo.
- `clave_actual_indice` está en coordenadas ORIGINALES: 0=A, 1=B, 2=C, 3=D, 4=E.
- Si `opciones["3"]` (D) es `null`, es una pregunta **válida de 3 opciones** — NO es defecto
  (11,4% del banco). Solo está roto si la clave apunta a una opción vacía.

## Los 4 checks, por pregunta

1. **`article_ok`** — ¿el artículo/contenedor vinculado contiene **literalmente** el supuesto por
   el que se pregunta, de modo que puedas justificar cada opción citándolo? Test inverso
   obligatorio: *¿el supuesto EXACTO del enunciado está en este texto?* Un texto que solo comparte
   palabras clave con la respuesta NO vale → `false` + `articulo_sugerido`.
2. **`answer_ok`** — ¿la clave marcada es la correcta **según la fuente**, no según lo que
   casualmente diga el artículo vinculado?
   - Leyes: contra la **ley VIGENTE** (una pregunta de examen oficial pudo quedar desfasada por
     reforma: entonces `answer_ok=false`).
   - Contenido técnico (`ley_es_virtual: true` — Word/Excel/PowerPoint/Access/Outlook/Windows):
     contra **Microsoft Support en español**. Puedes usar WebSearch/WebFetch. No inventes URLs.
3. **`options_ok`** — literalidad **solo** de las opciones que la pregunta presenta como
   correctas: la opción marcada, y en preguntas tipo "todas las anteriores son correctas" cada
   sub-opción. **NUNCA compruebes los distractores** (su función es ser falsos; flaggearlos genera
   falsos positivos). Modos de fallo: verbo cambiado, sujeto estrechado/ampliado, plazo movido,
   texto que no existe en la fuente.
4. **`explanation_ok`** — la explicación ACTUAL: ¿es didáctica (analiza por opción, cita la
   fuente) o es un párrafo corrido / copia del artículo / no analiza nada? Aquí casi todas serán
   `false`; por eso escribes la nueva.

## ⚠️ Gotchas de ofimática — aquí es donde los verificadores se equivocan una y otra vez

Los atajos de Office **en español**, no en inglés:
- **Guardar = Ctrl+G** (NO Ctrl+S) · **Abrir = Ctrl+A** · **Seleccionar todo = Ctrl+E**
- **Subrayado = Ctrl+S** · Negrita = Ctrl+N · Cursiva = Ctrl+K · Rehacer = Ctrl+Y · Nuevo = Ctrl+U
- Si vas a marcar "Ctrl+A abre = falso, debería ser seleccionar todo", **estás aplicando el inglés
  y es un falso positivo**.

Otros:
- Excel: los argumentos escritos **directamente** en la función SÍ se coaccionan
  (`=SUMA("5";15;VERDADERO)` = **21**). Solo se ignoran si vienen de **celdas referenciadas**.
- Gráficos: "barras verticales" = **Columnas**; "barras" a secas = horizontales.
- Un artefacto raro en el enunciado (p.ej. «CTRL+AA») puede ser un **distractor deliberado** del
  examen, no un error: verifica antes de llamarlo defecto.
- Escritorio vs Web: si el contenedor es de una variante concreta, verifica contra ESA variante
  (en la Web las teclas F no funcionan, salvo Excel F2/F4 y Word F3).

## Salida — DOS ficheros, y nada más. NO toques la base de datos.

**Nunca** ejecutes UPDATE, ni `transition_question_state`, ni `aplicar-explicacion.ts`. No cambies
ninguna clave. Tú informas y escribes; aplica el orquestador.

### 1. Veredictos del lote → `scratchpad/t291/veredictos/lote-NN.json`

Array con **un objeto por pregunta distinta del lote** (mismo número de objetos que preguntas,
`question_id` **nunca repetido** — comprueba esto antes de escribir):

```json
[{
  "question_id": "uuid",
  "article_ok": true,
  "answer_ok": true,
  "options_ok": true,
  "explanation_ok": false,
  "veredicto": "ok_estructurada",
  "confianza": "alta",
  "notas": "≤300 chars: qué comprobaste y contra qué fuente",
  "fuente": "URL de Microsoft Support o 'artículo vinculado'",
  "clave_deberia_ser": null,
  "articulo_sugerido": null
}]
```

`veredicto` es uno de:
- `ok_estructurada` — los 4 checks de fondo pasan (article/answer/options) y **has escrito** su
  fichero de explicación estructurada.
- `defecto_clave` — la clave marcada NO es la correcta → rellena `clave_deberia_ser` ("A".."E").
  **NO escribas explicación estructurada** para esta.
- `defecto_articulo` — el artículo vinculado no cubre el supuesto → `articulo_sugerido`.
  **NO escribas estructurada.**
- `defecto_opciones` — una opción presentada como correcta no es literal / está distorsionada.
  **NO escribas estructurada.**
- `irresoluble` — la pregunta necesita una imagen/tabla que no está, o no se puede resolver con lo
  que hay. **NO escribas estructurada.** Explica en `notas` qué falta.

Si dudas, `confianza: "media"` o `"baja"` y explica la duda. **Una duda declarada vale más que un
veredicto inventado**: lo que marques `ok_estructurada` se va a servir a un opositor.

### 2. Explicación estructurada → `scratchpad/t291/estructuradas/<question_id>.json`

**Solo** para las `ok_estructurada`. Un fichero por pregunta, nombrado con su UUID:

```json
{
  "v": 1,
  "intro": "Contexto de una o dos frases (opcional).",
  "cita": { "ref": "Art. 5 PowerPoint 2016", "texto": "cita LITERAL del contenido" },
  "options": {
    "0": "Razón de la primera opción, referida a SU CONTENIDO.",
    "1": "…", "2": "…", "3": "…"
  },
  "outro": "**Clave:** … (opcional)",
  "estilo": "boletin",
  "frame": "select_correct"
}
```

Reglas **duras** del formato (hay gates automáticos que rechazan el fichero si las incumples):
- **Una razón por CADA opción presente**, keada al índice ORIGINAL ("0","1","2"…). Si la pregunta
  tiene 3 opciones, exactamente "0","1","2".
- **JAMÁS nombres la letra ni la posición de una opción** dentro de las razones, ni en `intro`, ni
  en `outro`: prohibido "la opción B", "la respuesta C", "la primera", "la anterior", "como se ve
  en la A". La letra la pone el render al barajar; si la escribes, miente. Escribe siempre
  referido al **contenido** ("El atajo que inserta una diapositiva nueva, no una presentación").
  - Excepción: citar el articulado de una norma por sus letras en minúscula («la letra d) del
    art. 9.1») sí vale — eso nombra la ley, no la pantalla.
- `intro` **no** puede empezar con "La respuesta correcta es…": esa frase la genera el render.
- Si el enunciado pide señalar la **falsa/incorrecta**, pon `"frame": "select_incorrect"`.
- `cita.texto` debe ser **copia literal** de la fuente (del fichero del artículo). No la
  parafrasees. Si no hay cita clara, omite `cita` antes que inventarla.
- `estilo`: `"boletin"` por defecto.

## Método de trabajo

1. Lee tu lote y **los ficheros de artículo** completos.
2. Ve pregunta por pregunta. Para el contenido técnico, verifica el dato con Microsoft Support en
   español antes de dar la clave por buena (y relee los gotchas de arriba).
3. Escribe el fichero de estructurada solo de las limpias.
4. Escribe el JSON de veredictos del lote al final, **un objeto por pregunta, sin repetir ids**.
5. Si un fichero de salida ya existe de un intento previo, **sobrescríbelo** — no asumas que está
   bien.

Devuelve como respuesta final solo un resumen de una línea por categoría: cuántas
`ok_estructurada`, `defecto_clave`, `defecto_articulo`, `defecto_opciones`, `irresoluble`, y los
question_id de los defectos.
