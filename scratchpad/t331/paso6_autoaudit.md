# Paso 6 — auto-audit (Claude generador), batch `gen_rd203_t331_2026-07-31`

Releído desde BD (`audit_input.json`, construido con `auditar-batch-input.cjs`) contra el
`content` literal de los arts. 50 y 52, y contra los 8 artículos que citan las explicaciones
(41, 42, 46, 47, 48, 51, 53, 55). El contenedor se contrastó antes con el BOE consolidado
(`BOE-A-2021-5032`): el texto de BD es idéntico al del boletín, incluida la falta de punto tras
«…sello electrónico cualificado de tiempo» del apartado 2 (errata del propio BOE).

| # | Art | Clave | Veredicto | Nota |
|---|-----|-------|-----------|------|
| 1 | 50.1.a) | B | PERFECT | Correcta = definición literal. El distractor D es la definición literal del sello cualificado (trampa útil). |
| 2 | 50.1.b) | D | PERFECT | Enunciado cita literal hasta «prestador cualificado de servicios de confianza»; la correcta recoge ENTERA la exigencia («exactitud e integridad de la marca de tiempo del documento»), no una parte. |
| 3 | 50.1.b) in fine | A | PERFECT | «a todos los efectos» va dentro de la correcta; el distractor que lo estrecha a «efectos probatorios» es el par exacto. |
| 4 | 50.2 | C | PERFECT | La regla es la de defecto; el distractor A la invierte suprimiendo la negación. |
| 5 | 50.2 párr.2 | D | PERFECT | Remisión al Esquema Nacional de Interoperabilidad; el distractor B (política de gestión) es real pero pertenece al art. 52. |
| 6 | 50.3 | B | PERFECT | Distractor A = Registro de Funcionarios Habilitados, real (art. 48.2). |
| 7 | 52 párr.1 | C | PERFECT | Distractor B = comparecencia + DEH única, literal del art. 42.1 (notificaciones). El distractor D altera DOS cosas (añade solicitud expresa y omite la sede) y el bullet las recoge las dos. |
| 8 | 52 párr.1 | A | PERFECT | Las cuatro remisiones se comprueban dentro del propio Reglamento: 53.1.a)→art. 52, 43.1→art. 42.1, 27.2→art. 47.1, 14→art. 41. Naming la LPAC no canta la clave: lo que se pregunta es el artículo, no la norma. |
| 9 | 52 párr.2 | D | PERFECT | Distractor C = art. 46.2 («los datos necesarios para su acceso»), real. |
| 10 | 52 párr.2 | A | PERFECT | Ojo revisado: la cita omite la segunda cosa que «garantiza aquella» (el cumplimiento de la normativa de protección de datos…). NO es correcta parcial: el enunciado acota expresamente («garantizará el acceso … **durante**:»), y esa segunda cláusula es el objeto de la pregunta 11. |
| 11 | 52 párr.2 | C | PERFECT | Las tres materias enumeradas, en su orden. Cada distractor cambia UNA de ellas y el bullet dice cuál. |

## Los 7 checks

- `article_ok` ✅ 11/11 — todos los supuestos están literalmente en el artículo del que cuelga la pregunta.
- `answer_ok` ✅ 11/11 — ninguna otra opción es defendible; comprobado uno a uno el motivo de falsedad.
- `options_ok` ✅ 11/11 — cita literal o condensación válida. Sin truncamiento por cola ni por cabeza
  (revisado a mano el único candidato, la Q10).
- `explanation_ok` ✅ 11/11 — formato §8.1 renderizado desde la estructura §8.2, sin emojis. Cada
  razón describe SU opción por construcción (van keadas al índice, no a la letra).
- `question_text_ok` ✅ 11/11 — ningún enunciado resume el artículo; los que lo citan lo hacen literal.
- `distractors_balance_ok` ✅ 11/11 — comprobado mecánicamente en `construir.ts` (ni ≥1,3× la mayor,
  ni la más corta con la menor de las otras >30% por encima) y confirmado por el gate.
- `answer_position_uniform_ok` ✅ — A 3 / B 2 / C 3 / D 3 (27/18/27/27%), secuencia `BDACDBCADAC`,
  sin ciclo regular.

**Veredicto del Paso 6: 11/11 PERFECT.** Pendiente el contraste con la auditoría ciega (Paso 7).
