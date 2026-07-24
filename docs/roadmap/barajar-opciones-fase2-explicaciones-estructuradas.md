# Barajar opciones — FASE 2: explicaciones estructuradas (shuffle-safe por construcción)

> **Contexto:** Fase 1 (`barajar-opciones-fase1-spec.md`) baraja las opciones al servir para las
> preguntas cuya explicación NO cita letras. Deja fuera el **26% letra-anclado** (explicación §8.1
> con "**Por qué B es correcta**" / "- **A)** …"): barajar movería las opciones pero la letra de la
> explicación seguiría apuntando a la posición vieja → explicación rota. La Fase 2 elimina esa
> barrera **cambiando el formato de la explicación**, no añadiendo lógica de reescritura frágil en
> serve. Predicho ya por Fase 1: `isShuffleEligible` se evalúa **dinámicamente** — en cuanto una
> explicación deja de citar letras, la pregunta pasa a barajable sola.

## 0. Objetivo

Que la razón de cada opción se guarde **keada a la IDENTIDAD de la opción** (su índice ORIGINAL en
BD, 0=A…4=E), **NUNCA a la letra mostrada**. La letra (A/B/C/D) pasa a ser **presentación pura**: se
asigna al renderizar, según dónde caiga cada opción tras barajar. Resultado:

- **Shuffle-safe por construcción**: barajar mueve cada opción CON su razón; el renderer recompone
  las letras coherentes. No hace falta parsear/reescribir texto libre en cada request (la chapuza
  que Fase 1 evitó a propósito marcando esas preguntas `no_shuffle`).
- **Mejor UX preservada**: se mantiene el "por qué esta NO es correcta" por distractor (lo que el
  usuario pidió no perder); incluso se puede pintar inline junto a cada opción.
- **La cobertura de barajado crece hacia ~100%**: nuevas preguntas nacen estructuradas; las
  históricas se migran (dos flujos, §5).
- **Desaparece el problema de coherencia de §2.2-ter** del manual de generación ("al reordenar hay
  que mover la letra del header y los bullets"): sin letras en la explicación, no hay nada que mover.

## 1. Modelo de datos

Columna nueva additiva en `questions`:

```sql
ALTER TABLE questions ADD COLUMN explanation_data jsonb NULL;
COMMENT ON COLUMN questions.explanation_data IS
  'Explicación estructurada por-opción (Fase 2 barajado). Razones keadas al índice ORIGINAL
   (0=A..4=E), sin letras. Fuente de verdad cuando NO es null; questions.explanation queda como
   fallback/caché renderizado. Ver docs/roadmap/barajar-opciones-fase2-explicaciones-estructuradas.md.';
```

Forma del JSON (`lib/shuffle/structuredExplanation.ts` → `StructuredExplanation`):

```jsonc
{
  "v": 1,
  "intro": "…texto independiente de opción (opcional)…",
  "cita":  { "ref": "Art. 12.6 Decreto 30/2025", "texto": "…cita literal…" },   // opcional (blockquote)
  "options": {                     // OBLIGATORIO: una razón por cada opción presente
    "0": "No al órgano de administración electrónica.",
    "1": "corresponde al órgano competente en materia de atención a la ciudadanía.",
    "2": "No a la subsecretaría de cada departamento.",
    "3": "No al centro directivo de publicidad institucional."
  },
  "frame": "select_correct"        // o "select_incorrect" ("señale la FALSA")
}
```

- **Regla de oro:** las razones se escriben referidas al **CONTENIDO** de la opción, jamás a su
  letra. Prohibido "La A es incorrecta"; correcto "No corresponde al órgano de administración
  electrónica". Es lo que hace el formato letra-independiente.
- La opción correcta se identifica con `questions.correct_option` (índice ORIGINAL), no se marca
  dentro del JSON → una sola fuente de verdad para la clave.
- `intro`/`cita` son independientes de opción → sobreviven intactos a cualquier permutación.

## 2. Render (drop-in, cero cambio de UI)

`renderStructuredExplanation(data, { correctOption, optionOrder, nOptions })` produce **exactamente
el mismo markdown §8.1** que la UI ya pinta hoy, pero con las letras calculadas desde la posición
mostrada:

- header "**Por qué {letra-de-la-posición-de-la-correcta} es correcta:** {razón de la correcta}"
- "**Por qué las demás son incorrectas:**" + un bullet "- **{letra}) ** {razón}" por cada
  distractor, en **orden mostrado**, con la letra de su posición.
- `optionOrder` null/ausente ⇒ orden natural (identidad) → render idéntico al histórico.
- `frame: 'select_incorrect'` invierte los encabezados ("es la incorrecta" / "las demás son correctas").

Como la salida es la misma cadena markdown, **el componente de render no cambia**: el serve le pasa
la cadena computada desde `explanation_data`+`option_order` en vez del `explanation` almacenado.

## 3. Integración en serve / validación (Fase 1 ya montada)

Cambios mínimos sobre lo de Fase 1 (`lib/api/filtered-questions/queries.ts`):

1. Elegibilidad: una pregunta con `explanation_data` válido (`isStructuredExplanation`) es
   letra-libre **por construcción** → elegible para barajar sin depender del detector de letras
   sobre el texto libre. (El detector queda como última línea barata para el `explanation` legacy.)
2. Al servir: si hay `explanation_data`, `explanation = renderStructuredExplanation(data, {…,
   optionOrder})`. Con `optionOrder=null` (no barajar) se renderiza natural → coherente igual.
3. `shuffle_safety`: una pregunta estructurada válida se marca `safe` vía `record_shuffle_safety`
   (razón `structured_explanation`). El trigger `tg_questions_shuffle_safety_invalidate` debe pasar a
   incluir `explanation_data` en el hash (editar la estructura → `stale` → re-verificar), simétrico a
   como hoy vigila `explanation`.
4. Validación de respuesta (`answer-and-save`, examen): **sin cambios** — sigue mapeando
   posición-mostrada→original vía `option_order` (la clave vive en `correct_option`, no en la
   explicación).

## 4. Contrato de generación (manual)

`docs/maintenance/generar-preguntas-con-ia.md` §8.2 (nueva): **toda explicación nueva se emite en
formato estructurado sin letras** (`explanation_data`). El generador ya razona opción por opción, así
que le sale natural; y desaparece §2.2-ter (mover la letra) porque no hay letra. El `explanation` de
texto se deriva por render (natural) para compatibilidad de lectores que aún no lean la estructura.

## 5. Migración de las ~130k históricas (dos flujos)

Medido en RDS sobre el universo real (`scripts/sim-structured-explanation.ts`, muestra 8.000 de las
`full` con explicación §8.1 "son incorrectas"):

| Flujo | % | Cómo |
|---|---|---|
| **Parser determinista** `parseLetterFormatExplanation` | **72,5%** | 0-IA, sin coste. Convierte cita+razón correcta+bullets a estructura. Guarda anti-falso-parseo: rechaza si alguna razón no es subcadena del original o hay razones duplicadas (0,2% cazado → van a LLM). |
| **Pasada LLM asistida** | **27,3%** | formatos raros (distractores inline, cruces de letra, prosa libre). Tarea de "estructurar sobre entrada limpia" que los modelos baratos de OpenRouter hacen bien **con gate** (ver `verificacion-modelos-gratis-openrouter.md`). |

El **cubo de explicaciones flojas** (`explanation_ok=false`) es el vehículo natural del segundo
flujo: al reescribir para mejorar, se emite ya estructurado → mejora + shuffle-safe en la misma
pasada. Migración no destructiva: `explanation` se conserva; se añade `explanation_data`; el trigger
recalcula `shuffle_safety`.

## 6. Capas de seguridad (construidas / previstas)

- **Unit** (`__tests__/lib/shuffle/structuredExplanation.test.ts`, 17): render con permutación no
  trivial (razón sigue a su opción, letras por posición), `frame` invertido, 3 opciones, validez del
  esquema, parser (cita+razón+bullets, round-trip natural y barajado, null en cabecera≠clave /
  cobertura incompleta / texto libre).
- **Simulación con datos reales** (`scripts/sim-structured-explanation.ts`): sobre miles de preguntas
  vivas, **invariante `parse(render(parse(original), order)) == original` bajo 5 permutaciones reales
  por pregunta → 0 fallos en 29.015 permutaciones (100%)**. Prueba que render y parser son inversos y
  el barajado es coherente de punta a punta. Guardas anti-falso-parseo (subcadena + distinción).
- **Guardarraíl (previsto al cablear serve):** extender el wiring guardrail de Fase 1 para afirmar
  que serve renderiza desde `explanation_data` cuando existe, y que el trigger de hash cubre
  `explanation_data`.
- **Canary BD (previsto):** sobre una muestra de estructuradas reales, servir barajado y comprobar en
  BD que la clave (`correct_option`) sigue apuntando a la opción correcta y la explicación renderizada
  no cita una letra que no case con la posición.

## 7. Secuencia de despliegue (no rompe nada; reversible)

1. Migración additiva `explanation_data` (null por defecto → sin efecto).
2. Deploy del código de serve que renderiza desde `explanation_data` si existe (con flag de barajado
   OFF sigue siendo idéntico al histórico; con estructura null, idéntico también).
3. Backfill por lotes con el parser determinista (72,5%) + `record_shuffle_safety('safe',
   'structured_explanation')`. Sin efecto hasta encender el flag.
4. Pasada LLM para el resto, con gate.
5. El **piloto de Fase 1** (`FEATURE_SHUFFLE_OPTIONS` + scope) ahora cubre también las estructuradas
   → la cobertura de barajado sube sin tocar más código.

**Orden respecto a Fase 1 / Koigrid:** la Fase 2 NO bloquea el piloto de Fase 1 (que ya funciona con
el conjunto `safe` actual). Se puede pilotar Fase 1 ya y desplegar Fase 2 en paralelo para ampliar
cobertura. Igual que Fase 1: **no encender flags hasta que Koigrid esté estable** (la migración de BD
debe llevar la columna nueva + datos).

## 8. Qué cierra

- Cobertura de barajado: del 26% bloqueado por letras → **hacia el 100%** (72,5% por parser + resto
  por LLM/cubo).
- Elimina la deuda de §2.2-ter (coherencia letra↔explicación al re-permutar) para todo lo nuevo.
- Un solo formato canónico para "mejorar explicación" y "hacer barajable" → los dos sistemas
  convergen en vez de pelearse.
