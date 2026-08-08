# T-683 — Revisar huérfanas de las 6 leyes derogadas (re-anclaje vs jubilación)

## Hecho y verificado (dry-run OK, listo para `--apply`)

### RD 806/2014 (TIC AGE) → RD 1125/2024, guardia_civil/T17
Plan: `scratchpad/t683/plan-rd806-2014.json` (dry-run validado: 7 movimientos, 12 preguntas
re-ancladas, 0 bloqueos, 9 a jubilar).

**Método:** no me fié del `article_number` viejo tal cual (varias preguntas ya estaban
mal-etiquetadas ANTES de que la ley se derogase — p. ej. 4 preguntas con tag "art.9" cuyo
contenido real es "medios/servicios declarados transversales", que en la ley vieja era el
art.10). Para cada una comparé el **contenido real** de las 4 opciones contra el texto de
los 14 artículos de RD 1125/2024 (no solo el `correct_option`), y solo re-anclé cuando:
1. El destino tiene `topic_scope` activo (si no, `evaluarReancla` bloquea el movimiento —
   verificado, ninguno de los 12 dio bloqueo).
2. Todas las opciones VERDADERAS de la pregunta viven en el MISMO artículo destino (evita
   que una opción cierta cuelgue de un artículo que ni siquiera se sirve en este tema — es
   lo que pasó con `de7adf95`, que se jubiló por eso).

**12 recuperadas** (arts. 2, 8, 9, 10 — los que SÍ están en el `topic_scope` de T17).
**9 jubiladas** (`admin_law_derogated` → `retired_irreparable`): su contenido real vive en
el Capítulo II de la norma nueva (CETIC art.3, Comisiones Ministeriales/Unidades TIC
art.5/7), que el epígrafe de T17 **no pide** — T-660 escopó a propósito solo Cap. I y III.
No es información perdida: sigue siendo verdad en RD 1125/2024, simplemente está fuera de
programa para esta oposición.

**⚠️ Antes de aplicar T-679** (que generó 10 preguntas NUEVAS para RD1125/2024 arts.
1,2,8,9,10): revisar solape con las 12 re-ancladas aquí — ninguna de las dos tandas está
insertada en BD todavía (T-679 vive en `scratchpad/t679/…json`, en `revision`), así que es
el momento barato de comparar antes de insertar cualquiera de las dos.

### RD 187/2008 (Red Hospitalaria de la Defensa) — sin sustituta
Plan: `scratchpad/t683/plan-rd187-2008.json` (dry-run validado: 0 movimientos, 1 a
jubilar). Única huérfana: pregunta trivia que identifica el propio RD por número/fecha.
T-660 no importó sustituta (no hay norma vigente que recoja esta materia) → jubilar es la
única opción, `admin_law_derogated`.

## Medido pero NO resuelto — sigue pendiente (documentado con precisión para el siguiente turno)

### RD 557/2011 (REx) → RD 1155/2024 — la tabla de la ficha original estaba mal
La ficha decía "8 (dentro del scope)". **Medido de verdad: 75 huérfanas activas en total**,
de las cuales **solo 9 caen en el rango 215-257** que T-660 ancló a Policía Nacional/T11
(el resto — ~66 — cuelgan de artículos como 3, 6, 13, 15, 20, 26, 27, 29, 31, 32, 37, 42,
43, 44, 49, 60, 72, 123, 124, 129, 130, 142, 143, 162, 166, 174, 175, 196, 206, 210 y 5 más
con DA9/DA10 — contenido de entrada/residencia general que NO pertenece al capítulo
sancionador y cuyo tema/oposición de origen no he identificado todavía).

**Hallazgo que desbloquea las 9 del rango**: la numeración vieja→nueva tiene un **offset
constante de −1** en todo el tramo 214-246 (verificado con 6 puntos de muestra por título
exacto: OLD 215 "Registro de Menores Extranjeros No Acompañados" = NEW 214 mismo título;
OLD 217 = NEW 216; OLD 219 = NEW 218; OLD 225 "Caducidad y prescripción" = NEW 224; OLD 245
= NEW 244; OLD 246 = NEW 245 — un artículo se insertó en algún punto anterior a 214 y
desplazó todo lo posterior). **Ojo con el borde**: OLD art.215 mapearía a NEW art.214, que
podría estar FUERA del `topic_scope` actual (215-257) — hay que comprobarlo antes de
re-anclar, no asumir el offset ciegamente en el borde.

**⚠️ Antes de aplicar T-681** (generó 17 preguntas nuevas para RD1155/2024 arts. 215-224):
mismo aviso que con T-679 — comparar contra lo que salga de re-anclar estas 9 antes de
insertar.

### Ley 8/2015 Cabildos → Ley 3/2026 (17 huérfanas) — NO analizado
### Orden HFP/134/2018 (Gobierno Abierto) → RD 371/2026 (16 huérfanas) — NO analizado
La ficha original apunta que la mayoría cita la norma vieja por nombre en el enunciado
("De acuerdo con la Orden HFP/134/2018…") — probablemente irrecuperables sin reescritura,
pero no lo he verificado pregunta a pregunta.
### Ley 4/2005 Igualdad Euskadi → DL 1/2023 (10 huérfanas) — NO analizado

**Total pendiente medido: 17 + 16 + 10 + 66 (RD557 fuera del rango PN/T11) = 109
preguntas**, más las 9 del rango PN/T11 con el offset ya identificado pero sin aplicar.

## Por qué no llegué a las 4 leyes restantes
El método que sí funciona (comparar las 4 opciones de CADA pregunta contra el texto real
de la norma nueva, no solo el `correct_option`, y no fiarse del `article_number` viejo) es
caro por pregunta — para RD 806/2014 (21 preguntas, la más pequeña) llevó la mayor parte
del turno. Escalarlo a las 109 restantes en la misma sesión habría sacrificado rigor por
cobertura, que es justo lo que este runbook pide evitar ("NUNCA re-anclar por cercanía de
numeración").

## Nunca aplicado
Ninguno de los dos planes se ha aplicado (`--apply`): re-anclar y jubilar escribe en
`questions`/BD de negocio, y mi credencial (`VENCE_LECTOR_URL`) es solo lectura. El
dry-run se validó puenteando `DATABASE_URL` a `VENCE_LECTOR_URL` (de solo lectura, cero
riesgo — el script en dry-run no llega a ejecutar ningún `UPDATE`/`BEGIN`).
