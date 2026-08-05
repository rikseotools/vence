### [T-588] cola.cjs next debería avisar/saltar disputes con borrador ya pendiente en el embudo

**QUÉ PASA.** `cola.cjs next` reparte la impugnación **más antigua libre** de `question_disputes`,
pero no mira si esa impugnación **ya tiene un borrador esperando OK de Manuel** en
`session_questions` (kind='borrador'). El ciclo real es: sesión A la coge → analiza → verifica
contra fuente oficial → escribe borrador → **libera la fila** (según el manual, nunca se cierra
sin aprobación) → la impugnación vuelve a quedar "libre" y sigue siendo la más antigua → la
siguiente sesión que pide trabajo se la vuelve a llevar, sin saber que ya hay un borrador
esperando.

**MEDIDO el 05/08/2026 sobre la impugnación `2477d39d` (Outlook, atajo Ctrl+Mayús+K vs Ctrl+T/Ctrl+Mayús+T
para "nueva tarea"):** CUATRO sesiones distintas la analizaron de forma independiente, cada una con
su propia verificación en vivo (WebFetch/fetch contra Microsoft Support ES/EN), en una ventana de
2h26min:

| sid | acción | hora (UTC) |
|---|---|---|
| `l3-fedora-2b213d` | borrador #21 (RECHAZAR) | 14:27:31 |
| `l2-fedora-1d5f83` | borrador #39 (RECHAZAR, mismo veredicto) | 14:56:38 |
| `w2-vence-flota-w1-d3707a` | pregunta #54 — crítica de tono al borrador #21 (abre con "Gracias por tu mensaje", que el manual §6 prohíbe) | 15:52:44 |
| `w1-vence-flota-w1-386bf8` | borrador #62 (RECHAZAR) → retirado, sustituido por #72 (RECHAZAR, mismo veredicto, ya corrige la observación de w2) | 16:08:41 / 16:53:52 |

Las CUATRO llegan al mismo veredicto (clave C correcta, verificada contra la misma fuente oficial),
así que no hay desacuerdo de fondo — es trabajo **idéntico repetido cuatro veces**: 4 análisis
completos, 4 verificaciones WebFetch contra la misma URL, y **3 borradores simultáneos abiertos**
en el embudo (`#21`, `#39`, `#72`) esperando que Manuel elija cuál aprobar, más una pregunta de
crítica cruzada (`#54`) que solo tiene sentido si se lee junto al borrador que critica.

**Por qué pasa justo con ESTA:** nada en `cola.cjs next` ni en `revisar-impugnacion.cjs` consulta
`session_questions` antes de asignar. El dossier (`revisar-impugnacion.cjs`) sí avisa si otra
sesión tiene el **claim** fresco, pero el claim se suelta en cuanto se libera la fila (paso normal
del flujo, no un error), y ahí el rastro del trabajo ya hecho — el borrador en el embudo — es
invisible para el siguiente `next`.

**COSTE medido:** 4x el trabajo (tiempo de sesión + llamadas LLM + WebFetch) para UNA sola
impugnación, y le deja a Manuel 3 mensajes casi-duplicados que tiene que leer y comparar en vez de
uno. Con la cola en paralelo de 2-10 sesiones, cualquier impugnación que tarde en aprobarse (porque
Manuel no está mirando el panel en ese momento) es candidata a repetirse así.

**QUÉ HACE FALTA (no lo he hecho, es una decisión de diseño + código, no un query suelto):**
1. Antes de asignar en `cola.cjs next` (o al generar el dossier en `revisar-impugnacion.cjs`),
   consultar `session_questions WHERE kind='borrador' AND status='open' AND draft_target ILIKE
   '%<dispute_id>%'` (o mejor: campo estructurado en vez de buscar el id dentro de un texto libre
   — el matching por ILIKE es frágil, ver abajo).
2. Si ya hay un borrador abierto, **avisar** en vez de bloquear (coherente con el resto del sistema:
   "avisar ≠ bloquear"): imprimir el borrador existente y dejar que la sesión decida si aporta algo
   nuevo (una hermana no vista, un matiz) o si debe saltarla y pedir la siguiente.
3. **El campo `draft_target` es texto libre y el id del dispute se busca por substring** — funciona
   hoy porque todas las sesiones lo incluyeron a mano, pero es una convención no forzada. Más
   robusto: añadir una columna estructurada (`dispute_id`/`related_id`) a `session_questions`, o al
   menos documentar en el manual que `--para` DEBE empezar por `"impugnación <id> (...)"` de forma
   parseable.

**Relacionado:** es el mismo patrón de fondo que el CLAIM de disputes (`cola.cjs`, T-474) — "lease,
no lock" ya resuelve que dos sesiones no analicen la MISMA fila A LA VEZ, pero no resuelve que dos
sesiones analicen la misma fila EN SECUENCIA sin saber que la otra ya terminó. Es el hueco entre
"nadie la tiene ahora" y "ya se hizo".

**Esfuerzo: rato.**
