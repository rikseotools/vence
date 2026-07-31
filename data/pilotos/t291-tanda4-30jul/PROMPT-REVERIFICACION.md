# RE-VERIFICACIÓN de la tanda 4 (paso 7 del método v2.1)

Trabajas en `/home/manuel/vence-sessions/revision-preguntas`. Tu lote es
**`data/pilotos/t291-tanda4-30jul/reverificacion/lotes/rev-NN.json`**.

Estas explicaciones **ya están aplicadas y se están sirviendo a opositores ahora mismo**. Tu trabajo
no es reescribirlas: es **auditarlas**.

## Por qué existe este paso

Todos los controles anteriores —el validador de lote y el aplicador— miran la **forma**: que la cita
sea literal, que no haya referencias a letras, que la estructura cuadre. **Ninguno puede detectar una
afirmación FALSA dentro de una razón perfectamente bien formada.** Eso es lo único que buscas.

Casos reales cazados por este paso en tandas anteriores:

- Una razón decía que «la soberanía nacional **emana** del pueblo español» cuando el artículo que ella
  misma citaba dice que **reside** en él, «del que emanan los poderes del Estado». Intercambiaba los
  dos verbos del precepto.
- Otra situaba la libertad de empresa (art. 38 CE) «dentro de los mismos principios rectores» que el
  art. 42, en una pregunta con 1.491 apariciones.
- Otra afirmaba que Ctrl+N abre una presentación nueva en PowerPoint, y que «Quitar duplicados» está
  en Ordenar y filtrar cuando vive en Herramientas de datos.

## Qué tienes que hacer con CADA pregunta

1. **Lee el artículo entero** (`articulo_fichero`).
2. Lee la `explicacion_aplicada` y **contrasta CADA afirmación** contra el artículo:
   - ¿La cita dice lo que la explicación pretende que diga?
   - ¿Cada razón describe correctamente su opción?
   - ¿Hay algún dato inventado, intercambiado o atribuido a quien no corresponde (un plazo, una
     mayoría, un órgano, un verbo, una ubicación en la estructura de la norma)?
   - ¿La razón de la opción marcada justifica de verdad que sea la correcta?
3. **La clave no se cuestiona salvo que encuentres prueba en el artículo.** Si la encuentras, no la
   cambies: repórtala.

## Qué escribes

**Solo cuando encuentres un defecto**, un fichero
`data/pilotos/t291-tanda4-30jul/reverificacion/salida/<question_id>.json`:

```json
{
  "question_id": "…",
  "gravedad": "alta|media|baja",
  "tipo": "afirmacion_falsa|cita_enganosa|razon_incorrecta|clave_sospechosa",
  "donde": "razón de la opción B | intro | cita",
  "que_dice": "lo que afirma la explicación",
  "que_dice_el_articulo": "lo que dice realmente el artículo, citado",
  "correccion_propuesta": "el texto corregido para esa razón concreta"
}
```

**Si la pregunta está bien, NO escribas nada.** El silencio es el resultado normal: en tandas previas
el 93-97 % estaba correcto.

## Reglas

- **No toques la base de datos.** No ejecutes `aplicar-explicacion.ts` ni ningún script de escritura.
- **No reescribas ficheros de `estructuradas/`.** Tu salida va solo a `reverificacion/salida/`.
- Sé **exigente pero no quisquilloso**: una redacción mejorable no es un defecto; una afirmación que
  contradice al artículo, sí.
- Si el artículo no cubre el punto y la explicación lo afirma igualmente, eso **sí** es defecto
  (`afirmacion_falsa`), aunque lo afirmado sea cierto en el mundo: no está respaldado por la fuente.

## Qué devuelves

Solo un resumen compacto:

```
rev NN: <n> revisadas, <m> defectos (<gravedades>), ids: <lista corta>
```
