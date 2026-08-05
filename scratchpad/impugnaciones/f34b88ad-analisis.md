# Impugnación f34b88ad-1519-46fe-aea4-460dcf60845b — análisis y borrador (w2, 05/08/2026)

> ⚠️ **Nota de proceso (igual que dejó w2 en `744f0db0-analisis.md`)**: `node scripts/backlog.cjs
> borrador --para … --texto …` no existe en el repo (ni en `scripts/backlog.cjs` ni en
> `scripts/impugnaciones/cola.cjs`). Dejo el análisis y el mensaje aquí y lo señalo con
> `backlog.cjs preguntar` para que Manuel lo vea y lo apruebe. Tampoco tengo credencial de escritura
> en la BD de negocio (`DATABASE_URL` de trabajador = solo 4 tablas de coordinación;
> `VENCE_LECTOR_URL` = solo lectura), así que no puedo cerrar la impugnación ni llamar a
> `cerrar.ts` — y el encargo lo prohíbe explícitamente de todos modos.

## 0. Es una RÉPLICA (appealed), no una impugnación nueva

`status = 'appealed'`. El dossier automático imprime el aviso "🛑 PASO 0 — YA RESPONDIDA → NO
re-respondas", pero el manual (§0.bis) dice **ignorarlo cuando el estado es `appealed`**: ese aviso
caza el desync del 504 mirando si hay `admin_response`, y en una apelación siempre la hay — es la
respuesta que el usuario está replicando. Una réplica se contesta por el flujo normal.

- **Descripción original:** *"No aparece en el Temario que nos pasáis."*
- **`admin_response` anterior** (04/08, 12:35 UTC): reconoce que la estructura de la ley no estaba
  en el temario, dice que "ya la hemos añadido, con los títulos de la ley y la materia de cada uno".
- **`appeal_text` del usuario** (Manolo García, premium, Diputación de Córdoba): *"Pero finalmente
  entra la Estructura de la Ley en el Temario? y si es que sí, dónde puedo ver el Temario
  modificado?. Gracias"* — pregunta legítima de seguimiento, no una queja nueva.

## 1. Contexto: este caso es el origen de la ficha [T-536]

`docs/roadmap/tareas-pendientes.md` línea 1374 — **[T-536] "Preguntas ESTRUCTURALES colgadas de un
artículo de fondo"** ya documenta este caso exacto como el que destapó el patrón, y dice que se
resolvió creando el Artículo 0 verificado contra BOE, re-vinculando las 2 preguntas estructurales de
esta ley y añadiendo `"0"` al `article_numbers` del tema. **No hace falta abrir ficha nueva — ya
existe y sigue abierta para las ~20 preguntas restantes de otras leyes.** Mi trabajo aquí es solo
**verificar que lo que dice la ficha esté realmente aplicado para LA OPOSICIÓN de Manolo**, porque
la ficha original solo habla de "el tema" en genérico y hay 9 `topic_scope` distintos que usan esta
ley (una por oposición).

## 2. Verificación (contra BD viva + BOE + página servida)

**Pregunta** `331115f3-1d5f-49db-971c-e6f05a3513b6` (lifecycle=approved, oficial=false):
*"La ley de medidas de prevención y protección integral contra la violencia de género en Andalucía
cuenta con:"* — clave **C) Un Título Preliminar y cuatro títulos** (`correct_option=2`).

- **`primary_article_id`** → `2270b7b9-c2b4-45aa-bf64-e912c31b59d3` = **Artículo "0" — "Estructura
  de la Ley 13/2007"** de la propia ley. Ya está re-vinculada (era el arreglo que prometía el
  `admin_response` anterior). ✅
- **Contenido del Artículo 0** (columna `articles.content`, transcrito y verificado contra BOE
  `https://www.boe.es/buscar/act.php?id=BOE-A-2008-2493` / BOJA núm. 247 de 18/12/2007): *"La Ley se
  estructura en un TÍTULO PRELIMINAR y CUATRO TÍTULOS numerados (I a IV)…"* — responde LITERALMENTE
  la pregunta y confirma que la clave C es correcta.
- **Pregunta hermana** `dc6ba8a2-8445-4934-a155-caabf0f6dc35` (misma ley, pregunta sobre la fecha/
  numeración de la ley) también está re-vinculada al mismo Artículo 0. Las dos ya coherentes.

**¿Y en SU temario concreto?** Manolo no tiene `target_oposicion` guardado, pero la propia ficha
`f34b88ad` lo identifica como opositor a **Diputación de Córdoba**. Comprobé el `topic_scope` de
`auxiliar_administrativo_diputacion_cordoba` para esta ley (`law_id=8e7c797c-…`):

```
topic: "Normativa estatal y autonómica sobre igualdad de género" (Tema 4)
article_numbers: ["0", "1", "1 bis", "3", "5", "7 bis", "8", "11", "17", "19", "26", "27", "28",
                   "29", "29 bis", "30", "32 bis", "33", "37", "46 bis", "57 bis", "58", "60", "DA1"]
```

El `"0"` **está** en el scope de su tema — el paso que la ficha T-536 marca como necesario ("sin ese
paso el dato sigue sin estar en el temario") ya se hizo para esta oposición.

**Comprobado en el HTML servido, no solo en la BD** (WebFetch a
`https://www.vence.es/auxiliar-administrativo-diputacion-cordoba/temario/tema-4`): la página
sirve una sección **"Estructura de la Ley 13/2007 de violencia de género de Andalucía" (Art. 0)**
con el desglose completo (Título Preliminar + 4 títulos, capítulos, disposiciones). **Está en vivo,
no solo aplicado en BD sin revalidar caché.**

**Veredicto: la apelación queda resuelta afirmativamente.** Sí, ya entra en su temario, y puede
verlo en el Tema 4 de su programa.

## 3. ¿Sistémico?

Ya cubierto por [T-536] (abierta, con el resto de leyes/preguntas pendientes — 23 preguntas en 14
leyes, de las cuales ~20 quedan por hacer). No abro ficha nueva. Si acaso, dejo aquí para quien siga
[T-536]: **la validación por oposición hace falta, no solo por ley** — esta ley tiene 9
`topic_scope` distintos y solo comprobé el de Diputación de Córdoba porque es el de Manolo; los
otros 8 no los he revisado.

## 4. Recompensa

El dossier automático no pudo determinar plan/recompensa (`user_profiles` fuera de mi credencial).
La ficha del backlog dice que Manolo es premium. La política "un fallo, una recompensa" (§ manual)
probablemente ya se aplicó en el cierre ORIGINAL (04/08, cuando pasó a `resolved`→ luego
`appealed`); quien cierre esta réplica debe comprobar si ya se pagó para no duplicar.

## 5. Borrador del mensaje (pendiente de OK de Manuel)

```
Hola Manolo,

Sí, ya está en tu temario: la estructura de la Ley 13/2007 la tienes en el Tema 4 de tu programa
("Normativa estatal y autonómica sobre igualdad de género"), con el desglose completo de títulos y
capítulos.

Muchas gracias.

Equipo de Vence
```

- Cerrar como `resolved` (ya lo era antes de la réplica; la réplica solo confirma) vía
  `/api/v2/dispute/resolve`, comprobando `emailSent`.
- **NO usar el "silent close"** que sugiere el dossier automático — es el aviso conocido y erróneo
  para `appealed` (§0.bis). Esto es una réplica real que necesita el email nuevo con la confirmación
  de dónde está el temario, no un cierre silencioso.
