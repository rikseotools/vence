# TANDA 4 — escribir explicaciones estructuradas (T-291)

Trabajas en `/home/manuel/vence-sessions/revision-preguntas`. Tu lote es **`scratchpad/t291/tanda4/lotes/lote-NN.json`**.

Cada elemento del lote trae la pregunta, sus opciones, la clave actual y la ruta del **artículo** del que cuelga. **Lee siempre el artículo entero antes de escribir.**

## Qué tienes que producir

Para CADA pregunta, un fichero `scratchpad/t291/tanda4/salida/<question_id>.json` con esta forma exacta:

```json
{
  "cita":   { "ref": "Ley X, art. N.2", "texto": "…fragmento LITERAL del artículo…" },
  "intro":  "Una o dos frases que sitúen lo que decide la pregunta.",
  "options": { "0": "razón de la opción A", "1": "…", "2": "…", "3": "…" },
  "estilo": "boletin"
}
```

## Reglas que NO se pueden romper

1. **La clave NO se toca jamás.** Tu explicación debe justificar la opción que ya está marcada como correcta. Si crees que la clave está mal, **no escribas explicación**: ve al punto 6.
2. **`cita.texto` tiene que aparecer LITERAL en el artículo**, carácter por carácter (se comprueba con un validador automático). Copia y pega del fichero del artículo; no reformules, no resumas, no añadas puntos suspensivos ni corchetes. Si el artículo no contiene ninguna frase que sostenga la respuesta, **omite el campo `cita` por completo** y sigue adelante — es información valiosa, no un fallo tuyo.
3. **Las razones se refieren al CONTENIDO de cada opción, nunca a su letra ni a su posición.** Prohibido escribir «la opción A», «la primera», «la anterior», «como se ha dicho arriba»: las opciones se barajan al servirlas y esas referencias se rompen. Escribe «El plazo de tres meses corresponde a…», no «La A dice tres meses».
4. **Hay que escribir una razón por CADA opción existente** (las claves `"0"`…`"3"`, o hasta `"4"` si hay opción E). La de la opción correcta explica por qué lo es; las demás, por qué no.
5. **Ni `intro` ni ningún texto pueden nombrar la respuesta por su letra** («la respuesta correcta es la C»). Esa frase la genera el render.
6. **Si detectas un defecto**, no escribas explicación y crea `scratchpad/t291/tanda4/salida/DEFECTO-<question_id>.json` con `{"question_id":"…","tipo":"clave|opciones|articulo|irresoluble","motivo":"…","confianza":"alta|media|baja"}`. Tipos:
   - `clave`: la opción marcada no es la correcta según el artículo.
   - `opciones`: hay dos opciones correctas, o la correcta no figura entre las ofrecidas.
   - `articulo`: el artículo no cubre el supuesto de la pregunta.
   - `irresoluble`: falta una imagen o un dato sin el cual no se puede responder.
7. **Preguntas de examen oficial** (`es_examen_oficial: true`): no cuestiones su redacción; limítate a explicar.

## Consejos de calidad

- Aprovecha que varias preguntas del lote comparten artículo: léelo una vez y reutilízalo.
- La cita ideal es **la frase exacta que decide la respuesta**, no el arranque genérico del precepto.
- En preguntas de negación («¿cuál NO…?»), la razón de la opción correcta explica **por qué esa NO cumple**, y las otras tres por qué sí.
- Cuando las opciones sean variaciones casi idénticas del texto legal, la razón debe señalar **la palabra concreta** que las hace falsas.

## Qué devuelves

**Solo un resumen compacto**, sin volcar el contenido de los ficheros:

```
lote NN: <n> explicaciones escritas, <m> defectos (<lista de tipos>), <k> sin cita
```
