#!/usr/bin/env node
// Aplica los defectos de corrección CONFIRMADOS con confianza alta (autorizado por Manuel, 20/07).
// Detalle y evidencia: scripts/impugnaciones/DEFECTOS-CORRECCION-revision.md
//
//   A) 0323d2fd (art.363 LGSS, 36 resp) → needs_human. Doble respuesta: C es literal del ap.2
//      y D desarrolla el ap.3; el enunciado pide UNA correcta. REVERSIBLE.
//   B) 3541491c (art.214 LGSS, 11 resp) → needs_human. Irresoluble: la escala depende de los años
//      de demora sobre la edad ordinaria, dato que no consta. REVERSIBLE.
//   C) 1e373e7c (crioterapia) → CAMBIO DE CLAVE A→D, autorizado explícitamente. El propio artículo
//      dice que el frío prolongado provoca vasodilatación refleja (hiperemia reactiva), luego el
//      frío mantenido SÍ provoca A, B y C → la única correcta es D («ninguna es correcta»).
//
// El cambio de clave es la ÚNICA excepción a "nunca auto-flip": va autorizado caso a caso y
// se registra el valor anterior para poder revertirlo.
const fs = require('fs'), path = require('path');
const pg = require(path.join(__dirname, '..', '..', 'backend', 'node_modules', 'postgres'));
const url = fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const sql = pg(url, { ssl: { rejectUnauthorized: false }, max: 2 });
const DRY = !process.argv.includes('--apply');

const A_NEEDS_HUMAN = [
  { pfx: '0323d2fd', claveEsperada: 'D', reason: 'admin_marked_problem',
    nota: 'Doble respuesta correcta (art. 363 LGSS): la opcion C reproduce literalmente el apartado 2 y la D desarrolla el apartado 3; ambas ciertas y el enunciado pide una sola. Revision 20/07.' },
  { pfx: '3541491c', claveEsperada: 'B', reason: 'admin_marked_problem',
    nota: 'Enunciado irresoluble (art. 214 LGSS): el porcentaje depende de los anios de demora sobre la edad ordinaria de jubilacion, dato que no consta en el enunciado. Item huerfano de un supuesto. Revision 20/07.' },
];
const C_FLIP = { pfx: '1e373e7c', de: 'A', a: 'D',
  nota: 'Cambio de clave A->D autorizado por Manuel (20/07). El articulo vinculado dice que si la aplicacion de frio se prolonga aparece vasodilatacion refleja (hiperemia reactiva), luego el frio mantenido SI provoca A, B y C y la unica correcta es D.' };

(async () => {
  console.log(DRY ? '— DRY RUN (usa --apply) —' : '— APLICANDO —');
  const backup = [];

  // ---- A y B: a needs_human vía la función SQL (única vía legítima; is_active es GENERATED) ----
  for (const it of A_NEEDS_HUMAN) {
    const q = (await sql`SELECT id, correct_option, lifecycle_state, is_active FROM questions WHERE left(id::text,8)=${it.pfx}`)[0];
    if (!q) throw new Error(`${it.pfx}: no encontrada`);
    const clave = 'ABCD'[q.correct_option];
    if (clave !== it.claveEsperada) throw new Error(`${it.pfx}: clave en BD ${clave}, esperaba ${it.claveEsperada} — ABORTA`);
    if (q.lifecycle_state === 'needs_human') { console.log(`  ${it.pfx} ya está en needs_human, salto`); continue; }
    console.log(`  ${it.pfx} ${q.lifecycle_state} → needs_human (clave ${clave} INTACTA)`);
    backup.push({ pfx: it.pfx, id: q.id, estado_anterior: q.lifecycle_state, correct_option: q.correct_option });
    if (DRY) continue;
    await sql`SELECT public.transition_question_state(${q.id}::uuid, ${q.lifecycle_state}::text,
      'needs_human'::text, ${it.reason}::text, NULL::uuid, NULL::uuid, ${it.nota}::text)`;
  }

  // ---- C: cambio de clave (autorizado) ----
  {
    const q = (await sql`SELECT id, correct_option, option_a, option_b, option_c, option_d, explanation
                         FROM questions WHERE left(id::text,8)=${C_FLIP.pfx}`)[0];
    if (!q) throw new Error(`${C_FLIP.pfx}: no encontrada`);
    const clave = 'ABCD'[q.correct_option];
    if (clave !== C_FLIP.de) throw new Error(`${C_FLIP.pfx}: clave en BD ${clave}, esperaba ${C_FLIP.de} — ABORTA (¿ya aplicado?)`);
    const nueva = 'ABCD'.indexOf(C_FLIP.a);
    console.log(`  ${C_FLIP.pfx} CLAVE ${C_FLIP.de} → ${C_FLIP.a}  ("${[q.option_a,q.option_b,q.option_c,q.option_d][nueva]}")`);
    backup.push({ pfx: C_FLIP.pfx, id: q.id, correct_option: q.correct_option, explanation: q.explanation });
    if (!DRY) {
      // La explicación vieja defendía la clave A → queda obsoleta. Se reescribe acorde.
      const expl = `> «El efecto inicial del frío es la vasoconstricción, pero si la aplicación **se prolonga demasiado** aparece una **vasodilatación refleja** (hiperemia reactiva o "efecto rebote"), que es justo lo contrario de lo que se busca.» (Termoterapia y crioterapia, efectos sobre el organismo)

**Por qué D es correcta:** el enunciado pregunta qué **NO** provoca el frío mantenido y constante. Según el material, el frío prolongado provoca **las tres cosas**: vasoconstricción (efecto inicial), y después vasodilatación refleja e hiperemia reactiva (efecto rebote). Como ninguna de las tres queda excluida, la correcta es «ninguna es correcta».

**Por qué las demás son incorrectas:**

- **A) Vasodilatación.** Sí se produce: es la respuesta refleja que aparece cuando la aplicación se prolonga (a partir de los 15-20 minutos aproximadamente).
- **B) Vasoconstricción.** Es el efecto inicial e inmediato del frío, el más característico.
- **C) Hiperemia reactiva.** Es el nombre que recibe esa vasodilatación refleja, así que también se produce.

**Clave:** el frío mantenido no excluye ninguna de las tres: vasoconstricción primero, vasodilatación refleja (hiperemia reactiva) después. Por eso la respuesta es «ninguna».`;
      await sql`UPDATE questions SET correct_option=${nueva}, explanation=${expl}, updated_at=now() WHERE id=${q.id}`;
      await sql`INSERT INTO ai_verification_results
          (question_id, ai_provider, ai_model, is_correct, article_ok, answer_ok, explanation_ok,
           fix_applied, fix_applied_at, new_explanation, review_method_version, verified_at, explanation)
        VALUES (${q.id}, 'claude_code_defectos_correccion', 'claude-opus-4-8', true, true, true, true,
           true, now(), ${expl}, 'v2.1', now(), ${C_FLIP.nota})
        ON CONFLICT (question_id, ai_provider) DO UPDATE SET new_explanation=EXCLUDED.new_explanation,
           fix_applied=true, fix_applied_at=now(), verified_at=now()`;
    }
  }

  if (!DRY) {
    fs.writeFileSync(path.join(__dirname, 'backup-defectos-correccion.json'), JSON.stringify(backup, null, 1));
    console.log('\n→ backup escrito en backup-defectos-correccion.json (para revertir)');
    // verificación post-escritura
    const chk = await sql`SELECT left(id::text,8) pfx, correct_option, lifecycle_state, is_active
      FROM questions WHERE left(id::text,8) = ANY(${[...A_NEEDS_HUMAN.map(x => x.pfx), C_FLIP.pfx]}) ORDER BY 1`;
    console.table(chk.map(r => ({ ...r, clave: 'ABCD'[r.correct_option] })));
  }
  await sql.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
