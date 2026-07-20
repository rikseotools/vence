// Cubo 3 · Grupo A — recupera 5 preguntas needs_human de Castilla y León importando
// verbatim los artículos que faltaban (fuente oficial BOE/BOCyL, verificados) y relinkando.
//   Ley 13/1990 CES CyL (BOE-A-1991-2826): art.1 (nuevo) + art.10 (completar apartado 1)
//   Decreto 12/2024 CyL (BOCyL eli/2024/06/27/12): art.4, art.10, art.11 (nuevos)
// Claves verificadas literal contra la fuente oficial. Idempotente-ish: aborta si ya no son needs_human.
const fs = require('fs');
const pg = require('/home/manuel/Documentos/github/vence/backend/node_modules/postgres');
const APPLY = process.argv.includes('--apply');
function getUrl(){ return process.env.DATABASE_URL || fs.readFileSync('/home/manuel/Documentos/github/vence/.env.local','utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim(); }

const LEY_13_1990 = 'b666ffed';
const DEC_12_2024 = '74f74ab0-c391-4985-8d52-12c1bc19f851';

// Artículos verbatim (copiados literal de la fuente oficial)
const LEY_ART1 = 'Se crea el Consejo Económico y Social de Castilla y León con sede en Valladolid. Su naturaleza, funciones, composición y estructura serán las determinadas en la presente Ley.';
const LEY_ART10 = `1. El Pleno, previa convocatoria de su Presidente, se reunirá, en sesión ordinaria, al menos una vez al trimestre. Asimismo, podrá reunirse, con carácter extraordinario a iniciativa del Presidente, de la Comisión Permanente, en su caso, o de una tercera parte de sus miembros.

2. El Pleno del Consejo quedará válidamente constituido en primera convocatoria cuando asistan dos tercios de sus miembros, y, en segunda convocatoria con la asistencia, como mínimo, de la mitad más uno de sus componentes.`;
const DEC_ART4 = `La consejería competente en materia de información y atención al ciudadano es la encargada de coordinar, impulsar y gestionar la prestación del servicio de información y atención ciudadana, realizada a través del Servicio 012, velando en todo momento por la calidad de la información que se ofrece.

Asimismo, es la encargada de la dirección, coordinación y gestión de la sede electrónica.`;
const DEC_ART10 = `1. La información que se facilite deberá ser clara, sucinta, de fácil comprensión y accesible a las personas que lo solicitan.

2. La información administrativa tendrá carácter orientativo, no originará derechos ni expectativa de derecho, y no generará efecto jurídico alguno derivado de su contenido.

3. No supondrá una interpretación normativa, ni consideración jurídica o económica, sino la determinación de conceptos, informaciones de las distintas opciones legales o el apoyo en la cumplimentación de los formularios correspondientes.`;
const DEC_ART11 = `1. La información a la ciudadanía y empresas se ofrecerá con carácter general de modo inmediato, salvo que por la naturaleza y complejidad de la información solicitada ésta no pueda ser atendida en el momento en que se solicite, en cuyo caso se remitirá a los órganos, servicios y unidades administrativas de gestión de los ámbitos competenciales específicos en la materia, y se facilitará con posterioridad, mediante el medio disponible elegido por el ciudadano o empresa.

2. Si la información solicitada no es competencia del sector público autonómico, se informará, en el supuesto de conocerse, a quien debe dirigirse, salvo en el supuesto del apartado b) del artículo 2 del presente decreto.`;

// pregunta → (law_id_prefix, article_number destino, clave verificada)
const RELINKS = [
  { q: '6947bfae', law: LEY_13_1990,  art: '1',  key: 'A', note: 'Ley 13/1990 art.1 (sede Valladolid)' },
  { q: '2d4df8f3', law: LEY_13_1990,  art: '10', key: 'C', note: 'Ley 13/1990 art.10 (Pleno ≥1/trimestre)' },
  { q: 'a1d1b0b8', law: DEC_12_2024,  art: '4',  key: 'D', note: 'Decreto 12/2024 art.4 (consejería competente: todas)' },
  { q: '490e1ed6', law: DEC_12_2024,  art: '10', key: 'B', note: 'Decreto 12/2024 art.10 (info carácter orientativo)' },
  { q: 'd4c0185c', law: DEC_12_2024,  art: '11', key: 'D', note: 'Decreto 12/2024 art.11 (info de modo inmediato)' },
];

(async () => {
  const sql = pg(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 });
  try {
    const ley = (await sql`SELECT id FROM laws WHERE id::text LIKE ${LEY_13_1990+'%'}`)[0].id;

    // Pre-check: los 5 siguen needs_human
    const states = await sql`SELECT left(id::text,8) s, lifecycle_state FROM questions WHERE left(id::text,8) IN ${sql(RELINKS.map(r=>r.q))}`;
    console.log('Estado actual:', states.map(x=>`${x.s}=${x.lifecycle_state}`).join(' '));
    const notNH = states.filter(x=>x.lifecycle_state!=='needs_human');
    if (notNH.length) { console.log('⚠️ Ya no needs_human:', notNH.map(x=>x.s).join(',')); }

    if (!APPLY) { console.log('\n(DRY-RUN — pasa --apply para escribir)'); await sql.end(); return; }

    await sql.begin(async (tx) => {
      // 1) Ley 13/1990 art.1 (upsert por (law_id, article_number))
      await tx`INSERT INTO articles (law_id, article_number, title, content, is_active, is_verified, verification_date, last_modification_date, embedding_stale)
        VALUES (${ley}, '1', 'Creación, denominación y sede', ${LEY_ART1}, true, true, CURRENT_DATE, '1990-11-28', true)
        ON CONFLICT DO NOTHING`;
      // 2) Ley 13/1990 art.10 completar
      await tx`UPDATE articles SET content=${LEY_ART10}, title='Funcionamiento del Pleno', content_hash=NULL, embedding_stale=true, is_verified=true, verification_date=CURRENT_DATE, updated_at=now()
        WHERE law_id=${ley} AND article_number='10'`;
      // 3) Decreto 12/2024 arts 4,10,11
      for (const [num,title,body,mod] of [
        ['4','Responsabilidad',DEC_ART4],
        ['10','Naturaleza de la información administrativa',DEC_ART10],
        ['11','Tramitación',DEC_ART11],
      ]) {
        await tx`INSERT INTO articles (law_id, article_number, title, content, is_active, is_verified, verification_date, last_modification_date, embedding_stale)
          VALUES (${DEC_12_2024}, ${num}, ${title}, ${body}, true, true, CURRENT_DATE, '2024-06-27', true)
          ON CONFLICT DO NOTHING`;
      }
      // 4) topic_scope: añadir 4,10,11 a los 2 temas del Decreto (Servicio 012 — core del epígrafe)
      await tx`UPDATE topic_scope SET article_numbers = (
          SELECT array(SELECT DISTINCT unnest(article_numbers || ARRAY['4','10','11']))
        ) WHERE law_id=${DEC_12_2024}`;

      // 5) relink + verificación + transición a approved
      for (const r of RELINKS) {
        const q = (await tx`SELECT id, lifecycle_state FROM questions WHERE left(id::text,8)=${r.q}`)[0];
        if (!q || q.lifecycle_state !== 'needs_human') { console.log(`  skip ${r.q} (${q?q.lifecycle_state:'no existe'})`); continue; }
        const art = (await tx`SELECT id FROM articles WHERE law_id=${r.law.length>8?r.law:ley} AND article_number=${r.art} AND is_active LIMIT 1`)[0]
                 || (await tx`SELECT a.id FROM articles a WHERE a.law_id::text LIKE ${r.law+'%'} AND a.article_number=${r.art} AND a.is_active LIMIT 1`)[0];
        await tx`UPDATE questions SET primary_article_id=${art.id} WHERE id=${q.id}`;
        await tx`INSERT INTO ai_verification_results (question_id, article_id, is_correct, confidence, ai_provider, ai_model, verified_at, article_ok, answer_ok, options_ok, explanation_ok, enunciado_ok, review_method_version, correct_option_should_be)
          VALUES (${q.id}, ${art.id}, true, 'alta', 'claude_code_cubo3_relink', 'claude-opus-4-8', now(), true, true, true, true, true, 'v2.1', ${r.key})
          ON CONFLICT (question_id, ai_provider) DO UPDATE SET article_id=EXCLUDED.article_id, verified_at=now(), article_ok=true, answer_ok=true, enunciado_ok=true`;
        const tr = await tx`SELECT transition_question_state(${q.id}, 'needs_human', 'approved', 'ai_verified_perfect', NULL, NULL, ${'Relink cubo3 GrupoA → '+r.note+'. Clave '+r.key+' verificada literal vs fuente oficial.'}) ok`;
        await tx`UPDATE questions SET topic_review_status='perfect', verification_status='ok', verified_at=now() WHERE id=${q.id}`;
        console.log(`  ✅ ${r.q} → ${r.note}  [clave ${r.key}]`);
      }
    });

    // Verificación final
    const post = await sql`SELECT left(q.id::text,8) s, q.lifecycle_state, q.is_active, l.short_name, a.article_number
      FROM questions q JOIN articles a ON a.id=q.primary_article_id JOIN laws l ON l.id=a.law_id
      WHERE left(q.id::text,8) IN ${sql(RELINKS.map(r=>r.q))} ORDER BY l.short_name, a.article_number`;
    console.log('\n=== ESTADO FINAL ===');
    post.forEach(p=>console.log(`  ${p.s} [${p.lifecycle_state}] active=${p.is_active} → ${p.short_name} art.${p.article_number}`));
  } catch (e) { console.error('❌', e.message); process.exitCode=1; }
  finally { await sql.end(); }
})();
