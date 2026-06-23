# Pipeline de barrido `answer_ok=false` (Cubo A)

Scripts del barrido masivo de preguntas activas marcadas `answer_ok=false` (junio 2026).
Método v2.1 del manual `docs/maintenance/revisar-preguntas-con-agente.md`.
Memoria: `project-answer-false-active-sweep.md`.

## Idea

Las preguntas con `answer_ok=false` no descartada que siguen `is_active` son "imperfectas
servidas". El barrido las verifica con agentes y, por reglas deterministas, **re-sella** las
que están bien (clave correcta) descartando el flag viejo, o las manda a **needs_human** si
la respuesta es dudosa. **NUNCA flipa una clave automáticamente** (la calibración demostró que
una "answer_wrong" de agente casi siempre es falso positivo, wrong-article o pregunta contestada).

## Hallazgos clave (calibrados, no asumir)

- El flag viejo (método ciego pre-v2.0) es **~76% ruido**. Calibrar SIEMPRE antes de actuar.
- **Clave realmente mala limpia en banco LEGAL ≈ 0%** (1.646 preguntas, 0 flips). Toda
  "answer_wrong" de agente resultó: falso positivo / wrong-article (clave OK) / contestada
  (cross-ley: plazos, ministerio renombrado, norma supletoria).
- **Banco CLÍNICO TCAE ≈ 21% defectuoso DOBLE-confirmado**: la clave contradice su propio
  artículo-fuente editorial. Necesita doble pasada (verify + auditoría adversarial) — una sola
  pasada sobre-marca (~40%).
- El prompt COMPACTO produce rubber-stamps (sella sin consultar BD). Usar el prompt PROFUNDO
  (prohíbe rubber-stamp, exige ≥1 consulta BD + citar la cláusula que decide).

## Uso

```bash
# 1a. OFIMÁTICA/VIRTUAL (flag de sonnet/opus): extraer una ola de 200
WAVE=N node scripts/answer-review/wave_extract.cjs
#    LAWRX='365|Red Internet|Inform|Windows|Outlook'  -> solo ofimática
#    LAWRX='!365|Red Internet|Inform|Windows|Outlook'  -> excluir ofimática (clínico/legal)

# 1b. LEGAL (leyes normales, flag de CUALQUIER modelo incl. gpt-4o-mini/Haiku).
#     wave_extract.cjs da 0 aquí: exige is_virtual + sonnet/opus. Usa el legal:
WAVE=ce  LAWRX='^CE$'    node scripts/answer-review/wave_extract_legal.cjs   # solo CE (caza CEDH también)
WAVE=l39 LAWRX='39/2015' node scripts/answer-review/wave_extract_legal.cjs   # Ley 39/2015
#    LAWRX obligatorio (regex de short_name). '!' al inicio = excluir.
#    Historial: CE+CEDH (234) cerrado 23/06 — 229 reseal, 5 needs_human adjudicadas como
#    Opus (3 flips de clave: CE reformas C->A, 2x CEDH art.35 A->C) + 9 relinks de artículo.

# 2. Lanzar 8 agentes Sonnet PROFUNDOS (prompt en el historial / manual §4) sobre
#    wave{N}_blind_1..8.json -> wave{N}_deep_1..8.json. Para virtuales añadir cautelas §8.3.

# 3. Aplicar por reglas (re-sellar answer-correct, needs_human dudosas, nunca flip)
WAVE=N node scripts/answer-review/wave_apply.cjs    # DRY_RUN=1 para simular
```

> **GOTCHA al adjudicar needs_human → approved (flip de clave o reseal manual):** `wave_apply.cjs`
> solo descarta los `answer_ok=false` viejos en los RESEAL, NO en los que manda a `needs_human`.
> Si luego readjudicas esas a `approved`, vuelven a estar activas con el flag stale y REAPARECEN en
> el pool. Tras readjudicar SIEMPRE: `UPDATE ai_verification_results SET discarded=true,discarded_at=now()
> WHERE question_id=... AND answer_ok=false AND COALESCE(discarded,false)=false`.

### Clínico = DOBLE PASADA

1. Extraer clínico (`LAWRX='!365|...'`).
2. Pasada 1 (verify deep) -> `wave{N}_deep_*.json`.
3. Pasada 2 (auditoría adversarial independiente, prompt "solo answer_wrong si el ARTÍCULO
   contradice claramente; no sobre-marcar con conocimiento propio") -> `wave{N}_audit_*.json`.
4. `node scripts/answer-review/clinical_double_pass_adjudicate.cjs` — cruza p1↔p2:
   ambas cuestionan la respuesta → needs_human; ambas OK → reseal; **desacuerdo → dejar ACTIVA**
   (3ª adjudicación Opus/humano).

## Reglas de `wave_apply.cjs`

- `marked_is_fine` → reseal (article_ok=true, options_ok=true).
- `answer_wrong` / `outdated_by_reform` / `ambiguous_unresolvable` → **needs_human** (nunca flip).
- `wrong_article` / `needs_other_law` / `bad_option`: reseal SOLO si `marked_answer_is_correct===true`
  (article_ok=false + `correct_article_suggestion` logueada para relink); si no → needs_human.
- Ficheros degenerados (n<25 o sin `controlling_clause`) se omiten → vuelven al pool.

## Gotchas

- Las virtuales son `tech_approved`, no `approved` (la transición a needs_human debe aceptar ambos).
- Los ficheros de auditoría usan campo `root_cause`/`real_correct_letter`, no `root`/`real`.
- El contador `tool_uses` de la notificación marca 1-2 aunque el agente haga 12-18 consultas
  reales — validar profundidad por `controlling_clause` poblado, no por el contador.
- Re-sellar usa `ai_provider='claude_code_recheck'` (legal/ofim) o `'claude_code_audit'` (clínico
  doble-pasada) para no pisar la traza histórica (constraint único `(question_id, ai_provider)`).
