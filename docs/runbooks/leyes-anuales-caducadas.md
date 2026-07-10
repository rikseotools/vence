# Runbook: Leyes anuales caducadas en el temario (`stale_dated_law`)

**Cuándo consultarlo:** cuando el usuario diga *"revisa las leyes anuales caducadas"*, o el panel de salud-contenido muestre un finding `stale_dated_law`.

## Qué es

Una ley con **año objetivo** en el nombre ("…para el año 2025", "…del ejercicio 2024") cuyo año **ya pasó** pero sigue en el `topic_scope` de algún tema. Caso típico: las **Leyes de Presupuestos Generales**, que cada enero se sustituyen por la del año siguiente (una ley **nueva con otro número/URL**).

**Por qué ningún otro radar lo caza:**
- El **radar de epígrafes** (`topic_scope_verification`) comprueba que el scope coincide con la **materia** del epígrafe, no la **vigencia** de la ley → una ley de presupuestos caducada "encaja" en "Los Presupuestos Generales de…".
- El **monitor BOE** (`check-boe-changes`) comprueba **cambios de texto** de leyes que ya tenemos, no la **supersesión** por una ley nueva que ni está en BD.

Detector: `lib/laws/staleDatedLaw.ts` (mirror inline en `scripts/health-sweep.cjs`). Precisión > recall: exige la frase de año objetivo (no marca la Ley 47/2003 "General Presupuestaria", que es marco permanente).

## Procedimiento (ACTUALIZAR + generar, NUNCA quitar)

> ⚠️ El epígrafe manda. Si el epígrafe pide esa materia, **no se elimina** la ley del scope — se **actualiza** a la vigente y se **generan** las preguntas que falten. Quitarla = omitir material que el temario exige. Ver `feedback_epigrafe_manda_0_preguntas_generar`.

1. **Verificar la ley vigente** contra fuente oficial (BOE/boletín autonómico): ¿cuál es la ley del año en curso que sustituye a la caducada? (p.ej. Presupuestos 2025 → Presupuestos 2026).
2. **Importar la ley vigente** si no está en BD (flujo normal de import, siempre `draft` + verificación).
3. **Actualizar el `topic_scope`**: sustituir la ley caducada por la vigente en los temas afectados, con los `article_numbers` que pide el epígrafe (el ciclo/estructura presupuestaria, no las cifras).
4. **Generar las preguntas** del concepto si faltan (0 preguntas = cobertura pendiente, no scope a borrar).
5. **Marcar la caducada**: `is_active=false` / `is_derogated=true` con `derogated_by` = la nueva, si procede.
6. Re-ejecutar el sweep para confirmar que el finding desaparece.

Relacionado: `docs/runbooks/salud-contenido.md`, `docs/runbooks/verificar-epigrafes-scope.md`, memoria `project_gap_leyes_anuales_caducadas_scope`.
