Lote listo para insertar — T-146/T-115, Ley 16/2003 LCCSNS (arts. 8 bis, 8 ter, 8 quáter, 8 quinquies, 65 bis)
=================================================================================================

**Generado por un trabajador de la flota (l5, rol `vence_coordinacion`), que NO tiene permiso de
escritura en la BD de negocio.** Por eso este lote llega hasta el Paso 3.bis (simulación limpia)
y las dos auditorías ciegas del Paso 6/7 + un recheck del Paso 9 sobre el único hallazgo — pero
**nadie lo ha insertado**. Falta una sesión con `DATABASE_URL` de escritura que ejecute los Pasos 4/5
(inserción), 5.bis (gate mecánico post-inserción), Pasos 10/11 y `batch:servido`.

- `gen_lccsns_2026-08-05_borrador.json` — el borrador final, formato §8.2 (`explanation_data` +
  `explanation` ya renderizada con `renderStructuredExplanation`). 6 preguntas, `batch_id`
  `gen_lccsns_2026-08-05`.
- `audit_input.json` — el mismo lote en el formato que se le pasó a los auditores ciegos (sin
  metadatos que delaten que es IA-generado).
- `verificar-boe-lector.cjs` — copia de `scripts/verificar-articulos-vs-boe.cjs` apuntada a
  `VENCE_LECTOR_URL` en vez de `DATABASE_URL` (el rol de flota no tiene acceso a `articles`/`laws`
  por `DATABASE_URL`). Paso 1 ya corrido: **5/5 artículos idénticos al BOE vigente**
  (`BOE-A-2003-10715`).
- `render.ts` — el script que generó `explanation` desde `explanation_data` (necesitaba el fichero
  intermedio `_raw.json`, ya borrado tras usarlo; si hace falta reproducir, el `explanation_data`
  de cada pregunta del borrador final es la fuente).

## Qué se verificó (y cómo)

1. **Paso 1 (BOE)** — los 5 artículos activos en BD son idénticos al texto vigente del BOE
   consolidado (`verificar-boe-lector.cjs lccsns BOE-A-2003-10715 "8 bis" "8 ter" "8 quáter"
   "8 quinquies" "65 bis"`).
2. **Paso 2** — 6 preguntas, una o dos por artículo, opción correcta cita literal (o condensación
   válida ya visada por dos auditores), distractores construidos alterando un fragmento real de la
   misma ley por UN elemento, dentro de ±30% de longitud de la correcta. `correct_option`
   distribuido 0:2·1:1·2:2·3:1 (33/17/33/17%), secuencia `0,1,2,3,0,2` (no cíclica).
3. **Paso 3 / 3.bis (simulación pre-inserción, solo lectura contra `VENCE_LECTOR_URL`)** —
   `DATABASE_URL="$VENCE_LECTOR_URL" node scripts/simular-batch-preinsercion.cjs
   scratchpad/t146/gen_lccsns_2026-08-05_borrador.json lccsns` → **0 bloqueantes**. Quedan 2 avisos
   de "posible duplicado intra-lote" que el propio simulador marca como falso positivo probable
   (similitud de CLAVE ~0%): es solape del preámbulo obligatorio "Según el artículo X de la Ley
   16/2003, de 28 de mayo, de cohesión y calidad del Sistema Nacional de Salud" que exige §2.2-quater
   (autocontenida) en cada pregunta de la misma ley.
4. **Paso 6/7 (doble auditoría ciega, vía Agent tool, cada una con WebFetch contra el BOE)** —
   un auditor "checks" y un auditor adversarial, independientes entre sí. **Los dos, por separado,
   señalaron el mismo problema en la pregunta 2** (art. 8 ter): el enunciado original preguntaba de
   forma abierta "¿qué prestaciones incluye la cartera común suplementaria?", y el art. 8 ter.3
   extiende esa misma cartera al transporte sanitario no urgente aunque no figure en la lista
   tasada del apartado 2 — así que la opción que lo incluía también era defendible. Es el patrón
   "CORRECTA PARCIAL" que el manual marca como el más reincidente de la campaña T-115.
5. **Arreglo + recheck independiente (equivalente al Paso 9, solo sobre el hallazgo)** — se acotó
   el enunciado a "Según el **apartado 2** del artículo 8 ter... ¿qué prestaciones **enumera**...?".
   Un tercer agente, sin ver los dos primeros informes, confirmó que la reformulación resuelve el
   problema de raíz y no encontró ningún otro ángulo de ataque.
6. Re-simulado tras el arreglo: sigue en 0 bloqueantes.

## Lo que falta (fuera del alcance de un trabajador de la flota)

- Insertar el batch (Pasos 4/5) con `lifecycle_state: 'draft'` — ya viene en el JSON.
- Gate mecánico post-inserción (Paso 5.bis, `npm run batch:gate -- gen_lccsns_2026-08-05`).
- Aprobar (`aprobar-batch-generado.cjs`) tras el gate y **Paso 9** (recheck completo con agente
  nuevo sobre las preguntas ya vivas en BD — el recheck que se hizo aquí fue solo sobre el
  hallazgo de la Q2, no un Paso 9 completo de las 6).
- Registro en `ai_verification_results` (Pasos 10/11) y `npm run batch:servido`.
- Actualizar la ficha T-146/T-115 con el resultado.
