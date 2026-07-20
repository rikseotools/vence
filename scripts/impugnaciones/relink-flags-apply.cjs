#!/usr/bin/env node
// RELINK de los mislink del lote de tráfico (20/07) + su explicación reescrita.
//
// Solo se relinkan las que cumplen las TRES condiciones:
//   1. el artículo de destino EXISTE en BD,
//   2. su texto SOSTIENE la clave actual (verificado a mano, cita literal abajo),
//   3. el destino está en al menos 1 topic_scope (si no, la pregunta desaparecería de los tests).
//
// NUNCA se toca correct_option. Las que no cumplen las 3 se quedan en FLAGS-lote-trafico.md.
const fs=require('fs'),path=require('path');
const pg=require(path.join(__dirname,'..','..','backend','node_modules','postgres'));
const url=fs.readFileSync(path.join(__dirname,'..','..','.env.local'),'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const sql=pg(url,{ssl:{rejectUnauthorized:false},max:2});
const PROVIDER='claude_code_expl_traffic_relink';
const DRY=!process.argv.includes('--apply');

// OJO (gotcha leyes duplicadas): se referencia el artículo por UUID, nunca resolviendo por
// número + short_name — hay dos artículos "art.1" que casan con '5/1995' y son de leyes distintas.
const RELINKS=[
 { pfx:'545f3573', art:'ce107473-519a-477f-8dba-de78f83a4302', clave:'D',
   expl:`> «También es posible seleccionar distintos diseños para mostrar los archivos y agruparlos por diferentes columnas.» (Explorador de archivos de Windows 11)

**Por qué D es correcta:** el Explorador de Windows 11 permite **las dos cosas a la vez**: elegir entre distintos diseños de vista (iconos, lista, detalles, mosaicos, contenido) y, además, agrupar los archivos por la columna que se elija.

**Por qué las demás son incorrectas:**

- **A)** Acierta en los diseños pero niega la agrupación por columnas, que sí existe.
- **B)** Lo contrario: admite la agrupación pero niega los diseños, que también existen.
- **C)** Introduce una limitación que no es tal: la agrupación no está restringida a algunos diseños concretos.

**Clave:** en el Explorador de Windows 11 diseños y agrupación por columnas son funciones independientes y ambas están disponibles.` },

 { pfx:'f6156db6', art:'dd654f35-f5d3-4cee-95d2-eaeea441a1b0', clave:'C',
   expl:`> «Se prohíben los Tribunales de Honor en el ámbito de la Administración civil y de las organizaciones profesionales.» (art. 26 CE)

**Por qué C es correcta:** la Constitución contiene **dos prohibiciones distintas**. El art. 26 prohíbe los Tribunales de Honor, y lo hace acotado al ámbito de la **Administración civil** y de las organizaciones profesionales; el art. 117.6 añade que «se prohíben los Tribunales de excepción». C es la única opción que recoge las dos.

**Por qué las demás son incorrectas:**

- **A)** Se queda corta: además de los de honor, la CE prohíbe los Tribunales de excepción.
- **B)** Cambia el ámbito: el art. 26 dice Administración **civil**, no Administración de **Justicia**. Es el distractor fino de esta pregunta.
- **D)** Se queda corta por el otro lado: omite la prohibición de los Tribunales de Honor.

**Clave:** dos prohibiciones y un ámbito que se presta a trampa: Tribunales de Honor en la Administración **civil** (art. 26) + Tribunales de excepción (art. 117.6).` },

 { pfx:'81877dd9', art:'2536184c-73ed-4568-9ac7-0bbf1da24dcb', clave:'A',
   expl:`> «TÍTULO II - DE LA CORONA (Arts. 56-65): Rey, sucesión, regencias, funciones.» (estructura de la Constitución Española)

**Por qué A es correcta:** la rúbrica del Título II de la Constitución es **«De la Corona»**, y comprende los arts. 56 a 65 (el Rey, la sucesión, la regencia y la tutela, y las funciones del Monarca).

**Por qué las demás son incorrectas:**

- **B)** «De los derechos y deberes fundamentales» es la rúbrica del **Título I** (arts. 10-55).
- **C)** «De los españoles y extranjeros» no es un Título, sino el **Capítulo I del Título I** (arts. 11-13).
- **D)** «De las Cortes Generales» es la rúbrica del **Título III** (arts. 66-96).

**Clave:** Preliminar (1-9) · I Derechos y deberes (10-55) · **II Corona (56-65)** · III Cortes Generales (66-96).` },

 { pfx:'ac965063', art:'8f5e5023-408c-40b3-98a6-0a68fde5d319', clave:'D',
   expl:`> «La Nación española, deseando establecer la justicia, la libertad y la seguridad y promover el bien de cuantos la integran, en uso de su soberanía, proclama su voluntad de: [...] Consolidar un Estado de Derecho que asegure el imperio de la ley como expresión de la voluntad popular. [...] Promover el progreso de la cultura y de la economía para asegurar a todos una digna calidad de vida. Establecer una sociedad democrática avanzada» (Preámbulo CE)

**Por qué D es correcta:** el Preámbulo enumera **seis** voluntades de la Nación española, y las tres opciones ofrecidas figuran entre ellas literalmente. Al ser todas ciertas, la respuesta es «todas las anteriores».

**Por qué las demás son incorrectas:**

- **A)**, **B)** y **C)** son ciertas por separado, pero **incompletas**: cada una recoge solo una de las voluntades proclamadas, y el enunciado no pide una sola.

**Clave:** el Preámbulo proclama seis voluntades (convivencia democrática, Estado de Derecho, protección de los pueblos de España, progreso de cultura y economía, sociedad democrática avanzada y cooperación entre los pueblos de la Tierra): si varias opciones aparecen en esa lista, la correcta suele ser «todas».` },

 { pfx:'9e9439ad', art:'8f5e5023-408c-40b3-98a6-0a68fde5d319', clave:'B',
   expl:`> «Garantizar la convivencia democrática dentro de la Constitución y de las leyes conforme a un orden económico y social justo.» (Preámbulo CE)

**Por qué B es correcta:** el Preámbulo remite expresamente a un orden **económico y social justo** como marco de la convivencia democrática. Es cita literal, sin margen de interpretación.

**Por qué las demás son incorrectas:**

- **A)** «Democrático solidario» no aparece en el Preámbulo; mezcla el adjetivo «democrática» (que califica a la convivencia, no al orden) con un «solidario» inexistente.
- **C)** «Justo y solidario» conserva «justo» pero sustituye los dos adjetivos que sí constan (económico y social).
- **D)** «Cultural y tradicional justo» toma palabras que el Preámbulo usa en **otra** de sus voluntades (culturas y tradiciones, en la de protección de los pueblos de España).

**Clave:** convivencia democrática conforme a un orden **económico y social justo**.` },

 { pfx:'cb212dde', art:'0152f76f-d8c9-40cd-911b-ab347c1b3b22', clave:'D',
   expl:`> «El juicio del Jurado se celebrará solo en el ámbito de la Audiencia Provincial y, en su caso, de los Tribunales que correspondan por razón del aforamiento del acusado. En todo caso quedan excluidos de la competencia del Jurado los delitos cuyo enjuiciamiento venga atribuido a la Audiencia Nacional y aquellos cuya competencia haya sido asumida por la Fiscalía Europea.» (art. 1.3 LO 5/1995)

**Por qué D es correcta:** el precepto excluye **en todo caso** de la competencia del Jurado los delitos cuyo enjuiciamiento corresponde a la **Audiencia Nacional**. Es la única exclusión orgánica expresa de las cuatro opciones.

**Por qué las demás son incorrectas:**

- **A)** La Audiencia Provincial es precisamente el ámbito **natural** del juicio del Jurado.
- **B)** y **C)** El Tribunal Superior de Justicia y el Tribunal Supremo sí pueden conocer del juicio del Jurado cuando corresponda **por razón del aforamiento** del acusado, como admite el propio apartado.

**Clave:** Jurado sí en Audiencia Provincial (y en TSJ/TS por aforamiento); **nunca** en la Audiencia Nacional.` },
];

(async()=>{
  console.log(DRY?'— DRY RUN (usa --apply) —':'— APLICANDO RELINK —');
  const done=[];
  for(const r of RELINKS){
    const q=(await sql`SELECT id, correct_option, primary_article_id FROM questions WHERE left(id::text,8)=${r.pfx}`)[0];
    if(!q) throw new Error(`${r.pfx}: no encontrada`);
    if('ABCD'[q.correct_option]!==r.clave) throw new Error(`${r.pfx}: clave en BD es ${'ABCD'[q.correct_option]}, esperaba ${r.clave} — ABORTA`);
    const dest=(await sql`SELECT a.id,a.article_number n,a.law_id,l.short_name ley FROM articles a JOIN laws l ON l.id=a.law_id WHERE a.id=${r.art}`)[0];
    if(!dest) throw new Error(`${r.pfx}: artículo destino inexistente`);
    const sc=(await sql`SELECT count(*)::int t FROM topic_scope WHERE law_id=${dest.law_id}
                        AND (article_numbers IS NULL OR ${dest.n}=ANY(article_numbers))`)[0];
    if(sc.t===0) throw new Error(`${r.pfx}: destino con 0 temas — desaparecería. ABORTA`);
    console.log(`  ${r.pfx} clave ${r.clave} → ${dest.ley} art.${dest.n} (${sc.t} temas)`);
    if(DRY) continue;
    await sql.begin(async tx=>{
      await tx`UPDATE questions SET primary_article_id=${r.art}, explanation=${r.expl}, updated_at=now() WHERE id=${q.id}`;
      await tx`INSERT INTO ai_verification_results
                 (question_id, article_id, ai_provider, ai_model, is_correct, article_ok, answer_ok,
                  explanation_ok, fix_applied, fix_applied_at, new_explanation, review_method_version,
                  verified_at, explanation)
               VALUES (${q.id}, ${r.art}, ${PROVIDER}, 'claude-opus-4-8', true, true, true, true, true, now(),
                  ${r.expl}, 'v2.1', now(),
                  ${'Relink verificado a mano: el artículo de destino sostiene literalmente la clave y está en topic_scope. Clave NO tocada. Artículo previo: '+q.primary_article_id})
               ON CONFLICT (question_id, ai_provider) DO UPDATE
                 SET article_id=EXCLUDED.article_id, new_explanation=EXCLUDED.new_explanation,
                     fix_applied=true, fix_applied_at=now(), verified_at=now()`;
    });
    done.push({pfx:r.pfx, antes:q.primary_article_id, ahora:r.art, clave:r.clave});
  }
  if(!DRY){
    // INVARIANTE: ninguna clave puede haber cambiado
    const chk=await sql`SELECT left(id::text,8) pfx, correct_option, primary_article_id
                        FROM questions WHERE left(id::text,8) = ANY(${RELINKS.map(r=>r.pfx)})`;
    const mal=chk.filter(c=>{const r=RELINKS.find(x=>x.pfx===c.pfx);
      return 'ABCD'[c.correct_option]!==r.clave || c.primary_article_id!==r.art;});
    console.log(`\n✅ ${done.length} relinkadas | inconsistencias: ${mal.length}`);
    if(mal.length){console.error('❌',mal);process.exit(1);}
    fs.writeFileSync(path.join(__dirname,'relink-aplicados.json'),JSON.stringify(done,null,1));
  }
  await sql.end();
})().catch(e=>{console.error('❌',e.message);process.exit(1)});
