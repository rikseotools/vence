# Deuda de contenido — Auxiliar Administrativo Diputación de Zaragoza (scope↔epígrafe)

**Origen (18/07/2026):** feedback de Sandra Barbastro (`6f789351`, bug "en contratos solo me entra hasta el 43, pero salen preguntas de otros artículos"). Al investigar se corrió el pipeline de verificación de epígrafes (`verificar-epigrafes-scope.md`) sobre la oposición **completa** (`auxiliar_administrativo_diputacion_zaragoza`), que estaba `never_verified` en sus 20 temas.

**Resultado registrado** (provenance en `topic_scope_verification`, run `verify_auxiliar_administrativo_diputacion_zaragoza_2026-07-18`): **12 correctos, 4 issues, 4 needs_human.**

- El feedback de Sandra quedó **resuelto y respondido** (T11 NO era sobre-scope; sus preguntas son legítimas). Ver más abajo.
- Lo que sigue son **tareas pendientes** que destapó el pipeline, a decidir por Manuel. NO tocar contenido legal sin verificar contra fuente oficial (BOPZ, `programa_url`).

## Tarea 2 — Ampliar T11 "La contratación pública" (needs_human)

- Epígrafe oficial (BOPZ): *"La contratación pública: principios generales, clases de contratos, formas y procedimientos de contratación."*
- Scope actual: Ley 9/2017 (LCSP) arts 1-37, 65-73, 99-102. **NO es sobre-scope** (los dos agentes coinciden en que aptitud/solvencia 65-73 y objeto/precio 99-102 encajan en "la contratación pública").
- **Falta el bloque "formas y procedimientos de contratación"**: procedimientos de adjudicación de la LCSP (~arts 131-179: abierto, restringido, negociado, diálogo competitivo…), hoy ausentes del scope.
- **Acción propuesta:** decidir si añadir el rango de procedimientos de adjudicación (verificar encaje con el epígrafe y estructura real de la LCSP; reusar banco existente o generar con doble auditoría si hay 0 preguntas). Re-verificar T11 al aplicar. Revalidar caché (temario + test-counts).

## Tarea 3 — Deuda "normativa aragonesa" (4 temas `verified_issues`)

El epígrafe nombra explícitamente la normativa autonómica de Aragón, pero el scope solo trae la ley estatal. Falta enganchar (y poblar) la ley aragonesa en:

| Tema | Epígrafe pide | Scope actual | Falta |
|---|---|---|---|
| **T2** | El Estatuto de Autonomía de Aragón | CE 137-158 | LO 5/2007 Estatuto de Autonomía de Aragón |
| **T4** | Régimen jurídico de la Admón. Local de Aragón; normativa autonómica de régimen local | Ley 7/1985 (estatal) | Ley aragonesa de Administración Local |
| **T15** | Ley de Subvenciones de Aragón | Ley 38/2003 (estatal) | Ley de Subvenciones de Aragón |
| **T18** | Poderes públicos aragoneses en materia de igualdad | LO 3/2007 (estatal) | Ley aragonesa de igualdad de oportunidades |

- **Acción propuesta:** por cada tema, localizar/importar la ley aragonesa correspondiente (fuente oficial), engancharla al `topic_scope` con el rango que pida el epígrafe, y generar preguntas si el banco está a 0 (doble auditoría). Re-verificar + revalidar caché.

## Otros `needs_human` (menor prioridad, mismo run)

- **T5** — Analista sugiere añadir el Cap. "Términos y plazos" (Ley 39/2015 arts 29-33); escéptico CORRECT.
- **T6** — Analista sugiere añadir silencio administrativo (24-25) y ejecución (97-105); escéptico CORRECT (53-95 = Título IV).
- **T17** — Analista: falta contabilidad de las EELL (TRLRHL ~200-212) y posiblemente sobran arts de presupuesto ESTATAL de la Ley 47/2003 (61-63, competencias del Gobierno/Ministro); escéptico CORRECT.

## Nota de método

Estas conclusiones vienen de 2 agentes independientes (analista + escéptico) bajo la **lente anti-word-matching** (el epígrafe describe una MATERIA; no marcar sobre-scope por que el título del artículo no repita la palabra literal). Antes de aplicar cualquier cambio de scope, re-correr `dump` y verificar contra el `programa_url` oficial.
