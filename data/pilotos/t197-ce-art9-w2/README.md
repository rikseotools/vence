# T-197 — lote CE art. 9 (w2, 06/08/2026)

8 explicaciones reescritas al formato estructurado (`lib/shuffle/structuredExplanation.ts`),
todas colgadas de **CE art. 9** (`primary_article_id` = `b5465d5a-a8c1-42ec-8d5f-a95a54a0d802`),
que hoy es el artículo con **más alcance** entre las `unsafe` sin `explanation_data`: **116
oposiciones** (medido con la CTE de `topic_scope` join `articles`, `article_numbers IS NULL OR
article_number = ANY(...)`). Cada pregunta de este lote pasa, hoy, de servirse en 116 oposiciones
con una explicación letra-anclada a poder barajarse en las 116 sin romper el sentido.

## Cómo se eligieron

De las `unsafe` sin `explanation_data` y `shuffle_mode='full'` (42.360 activas, medido 06/08),
se ordenó por nº de oposiciones que sirven el artículo vinculado (join `topic_scope`) y se cogió
el clúster de mayor alcance: 20 preguntas de CE art. 9, todas a 116 oposiciones. De esas 20 se
trabajaron 9 con la cabeza fresca; **8 se aplican en este lote y 1 se excluyó** (ver abajo).

## Verificación (manual §1-§7, `docs/maintenance/revisar-preguntas-con-agente.md`)

- **Fuente:** CE art. 9 completo (los 3 apartados) leído de `articles.content` vía
  `VENCE_LECTOR_URL`, no copiado de la ficha ni de la explicación vieja.
- **Cruces verificados contra su propio artículo, uno a uno** (no se dio nada por sabido):
  art. 7 (sindicatos/asoc. empresariales), art. 8.1 (Fuerzas Armadas), art. 10 (dignidad de la
  persona), art. 14 (igualdad formal), art. 35.1 (derecho al trabajo), art. 44 (acceso a la
  cultura) — los seis leídos de BD antes de escribir la razón que los cita.
- **`gate-citas.cjs --pre`**: 8/8 citas literales, 0 cortadas. Comando:
  `node scripts/explicaciones/gate-citas.cjs --pre data/pilotos/t197-ce-art9-w2/lote.json data/pilotos/t197-ce-art9-w2/lote`
- **`aplicar-explicacion.ts --lote` (dry-run)**: 8/8 validadas (estructura completa, sin
  referencias a letra/posición — el propio script las rechaza si las hay).
- **`validar-explicacion.cjs`** sobre el texto renderizado de cada una: 7/8 sin avisos; la 8ª
  (`0d4e03ff...`, frame `select_incorrect`) lleva un AVISO **falso** y conocido — el parser
  legacy que solo se usa para *predecir* si un texto en prosa sería transcribible no entiende las
  etiquetas `ES LA INCORRECTA`/`VERDADERA` (el propio código de `validar-explicacion.cjs` lo
  documenta: es un hueco del parser, no de esta explicación, y desaparece en cuanto
  `explanation_data` exista).
- **Re-lectura adversarial propia** (paso 6-7 del manual — sin agente independiente disponible en
  esta sesión, así que la hice yo con una pasada fría, buscando específicamente lo que el manual
  avisa que ningún gate ve: afirmaciones de derecho falsas con forma impecable, plazo/apartado/
  órgano equivocado). No encontré ninguna.

## Excluida del lote: `fb2012e8-f247-4f50-bd1b-f4ee5bc60196`

Su opción D es **"A las disposiciones indicadas en la opción ANTERIOR, más aquellas que...".**
Es una referencia POSICIONAL dentro del texto de la OPCIÓN misma (no de la explicación): al
barajar, "la opción anterior" deja de apuntar a C y la opción se vuelve incoherente. Esto es
justo lo que la ficha T-197 avisa que hay que reescribir también — pero está en `option_d`, no
en la explicación, y tocar el CONTENIDO de una opción tiene su propio guardarraíl estricto
(`corregir-opcion.cjs`, aborta si el cambio supera 3 caracteres) y su propia decisión de
producto (reformular "la opción anterior" cambia lo que el opositor lee). Se deja fuera de este
lote a propósito; queda para quien reparta trabajo de OPCIONES, no de explicaciones.

## Aplicar (necesita escritura en BD — un trabajador de la flota NO puede)

```bash
# repetir el dry-run primero para confirmar contra el estado actual de BD (puede haber cambiado)
npx tsx --env-file=.env.local scripts/aplicar-explicacion.ts --lote data/pilotos/t197-ce-art9-w2/lote

# aplicar
npx tsx --env-file=.env.local scripts/aplicar-explicacion.ts --lote data/pilotos/t197-ce-art9-w2/lote --apply

# purgar caché (per-instancia, repetir varias veces)
curl -X POST https://www.vence.es/api/admin/revalidate -d '{"tag":"questions"}'

# paso 7 del manual: re-verificar CADA pregunta ya viva, con un agente independiente, antes de
# cerrar el lote. Volcado para dársela a ese agente:
node scripts/explicaciones/dump-preguntas-vivas.cjs data/pilotos/t197-ce-art9-w2/lote.json data/pilotos/t197-ce-art9-w2/vivas.md
```

## Gotcha de conectividad que costó tiempo (déjalo para el próximo)

`aplicar-explicacion.ts`, `validar-explicacion.cjs` y en general cualquier script que use
`getDb()` (`db/client.ts`, paquete `postgres`/porsager) **NO conectan con `VENCE_LECTOR_URL` tal
y como se entrega a un trabajador**: la URL no lleva `?sslmode=require` y `postgres` (a
diferencia de `pg`) sí respeta la opción `ssl`, pero `db/client.ts` no pasa ninguna — así que sin
`sslmode` en la URL intenta conectar en plano y RDS lo rechaza (`no pg_hba.conf entry ... no
encryption`). Reproducido y medido: con `DATABASE_URL="$VENCE_LECTOR_URL"` a secas, CINCO
scripts distintos fallan con el mismo error; añadiendo `?sslmode=require` a la URL (sin tocar
ningún fichero del repo) conectan los cinco. Es el mismo mecanismo que ya documenta
`lib/db/pgSsl.cjs` para `pg`, pero en sentido CONTRARIO para `postgres`. Para cualquier
`getDb()`-based tool: `DATABASE_URL="${VENCE_LECTOR_URL}?sslmode=require" npx tsx …`.
