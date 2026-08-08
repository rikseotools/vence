# Paso 6 — auto-audit, batch `gen_lopdgdd_t115_2026-07-31`

13 preguntas releídas desde BD contra el `content` literal de los arts. 26, 53 bis, 61 y 62 de la
LO 3/2018, y contra los artículos que citan las explicaciones (art. 57 de la propia ley orgánica y
arts. 56, 60 y 65 del Reglamento (UE) 2016/679). El contenedor se verificó antes con
`batch:boe`: **4/4 idénticos al BOE vigente** (art. 53 bis en su redacción de 2023).

| # | Art | Clave | Veredicto | Nota |
|---|-----|-------|-----------|------|
| 1 | 26 | C | PERFECT | **Enumeración completa**: el precepto remite a exactamente tres normas (Ley 16/1985 · RD 1708/2011 · legislación autonómica) y la clave las recoge las tres, sin añadir ninguna. |
| 2 | 26 | A | PERFECT | **Enumeración completa**: reproduce el título del RD 1708/2011 tal y como lo cita el artículo, incluido «y su régimen de acceso». |
| 3 | 26 | D | PERFECT | Sujeto (Administraciones Públicas) y fin (archivo en interés público) sin alterar; cada distractor cambia uno de los dos. |
| 4 | 53 bis | B | PERFECT | «bidireccional y simultánea» es el par que define el sistema; el distractor lo invierte a «unidireccional y diferida». |
| 5 | 53 bis | D | PERFECT | Recoge las tres propiedades (autoría, autenticidad, integridad) y conserva el «en su caso» que condiciona la recogida de evidencias. |
| 6 | 53 bis | A | PERFECT | Quién decide (la Agencia) y quién consiente (el inspeccionado), sobre uso **y** fecha y hora. |
| 7 | 61 | C | PERFECT | La cláusula «salvo que…» va ENTERA dentro de la clave; el enunciado la pide expresamente («¿Con qué salvedad?»). |
| 8 | 61 | B | PERFECT | Las dos remisiones en su sitio (art. 57 de la ley orgánica · art. 56 del Reglamento); el distractor las intercambia. **Ver nota de reparto abajo.** |
| 9 | 61 | D | PERFECT | «mecanismo de coherencia», no ventanilla única. |
| 10 | 62 | A | PERFECT | Cita literal tras anclarla al texto (la primera redacción reordenaba la frase y el simulador la paró). |
| 11 | 62 | C | PERFECT | Los tres distractores son artículos que la propia ley orgánica cita, así que son verificables sin salir del lote. |
| 12 | 62 | B | PERFECT | Informar a la Agencia al remitirse al Comité **y** facilitarle la documentación: los dos deberes. |
| 13 | 62 | A | PERFECT | «asistida», no sustituida ni en exclusiva. |

## Reparto de una cláusula entre dos preguntas (arts. 61.1 y 26)

El art. 61.1 es una sola frase con dos partes: el **supuesto** (tratamiento del art. 57 de la ley
orgánica, responsable o encargado del art. 56 del Reglamento) y la **salvedad** (que desarrollase
significativamente tratamientos de la misma naturaleza en el resto del territorio). La Q8 pregunta
por el supuesto y la Q7 por la salvedad, y **cada enunciado acota su mitad de forma explícita**.
Es el mismo criterio que se aplicó en el art. 52 del RD 203/2021 (§5.39): partir una cláusula
coordinada es legítimo si el enunciado dice qué mitad se pregunta; lo que no vale es acotar en el
enunciado y luego preguntar por el todo.

## Los 7 checks

- `article_ok` ✅ 13/13 · `answer_ok` ✅ 13/13 · `options_ok` ✅ 13/13 (sin truncamiento por cola
  ni por cabeza; los dos avisos de ENUMERACIÓN del gate, comprobados uno a uno arriba)
- `explanation_ok` ✅ 13/13 — §8.1 renderizado desde la estructura §8.2; cada razón describe SU
  opción por construcción. **Se corrigieron dos blockquotes** que elidían texto con `[…]`: el gate
  los rechazó y se sustituyeron por la cita íntegra del precepto.
- `question_text_ok` ✅ 13/13 · `distractors_balance_ok` ✅ 13/13 ·
  `answer_position_uniform_ok` ✅ A 4 / B 3 / C 3 / D 3 (31/23/23/23%), secuencia `CADBDACBDACBA`.

## Los 5 avisos de duplicado intra-lote: falsos positivos, y por qué

Medido: el Jaccard del ENUNCIADO va de 0,46 a 0,62, pero el de la **CLAVE** (nivel 3 de §2.6) va
de **0,00 a 0,14**. La causa es que §2.2-quater obliga a desarrollar el nombre de la ley en cada
enunciado, y aquí ese nombre ocupa **118 caracteres** — quitarlo baja el Jaccard a 0,26-0,50. Las
dos reglas del manual tiran en direcciones opuestas. El simulador ya imprime los dos números.
