# Truncadas por el bug de import — triaje aplicado (20/07)

110 preguntas activas con el enunciado cortado a ancho fijo (80/100/120 chars). **El texto original
NO es recuperable**: no hay campo con el crudo en BD y la vía de "pregunta gemela más larga" solo dio
11 de 110, varias de ellas truncadas también o con distinta clave (o sea, preguntas distintas).

Reconstruir los enunciados desde el articulado sería **autoría, no restauración** → no se hizo.

## Lo que sí se hizo: triaje

- **105 COSMÉTICAS → se dejan vivas.** El corte no impide responder: se entiende qué se pregunta y la
  clave sigue siendo identificable con el fragmento + las opciones (ej.: cortada en «que exceda de 300 »,
  solo falta «euros»). Ocultar una pregunta respondible también perjudica al opositor.
- **5 IRRESOLUBLES → ocultadas** (`needs_human`, `structural_invalid`). Suman solo 6 respuestas servidas.
  Ninguna clave tocada. Reversible: `backup-truncadas-ocultadas.json`.

| id | resp | art | clave | enunciado tal como se servía |
|---|---|---|---|---|
| `190d8bf6` | 4 | art.708 | C | En la condena a la emisión de una declaración de voluntad, si en los c… |
| `d7af3b87` | 1 | art.626 | B | Según la Ley de Enjuiciamiento Civil, en cuanto el depósito judicial d… |
| `bf5c3dfa` | 1 | art.704 | B | En el procedimiento civil, si el título ejecutivo obligara a entregar … |
| `f742636f` | 0 | art.556 | B | Si el título ejecutivo fuera una resolución procesal o arbitral de con… |
| `8ff3dea5` | 0 | art.638 | A | De acuerdo con lo establecido sobre la valoración de los bienes embarg… |

Criterio del triaje: estricto con `irresoluble` (solo si el opositor no podría acertar salvo por azar);
ante la duda, cosmética. Verificado a mano además del triaje automático.
