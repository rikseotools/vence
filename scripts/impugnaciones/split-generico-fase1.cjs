#!/usr/bin/env node
// SPLIT GENÉRICO de mega-chunks editoriales — FASE 1 (partir el texto + ampliar topic_scope).
// Generalización del piloto de "Movilizacion y posiciones" (ver docs/roadmap/split-megachunks-editoriales-tcae.md).
//
// Parte el artículo por los encabezados `##` del PROPIO material, VERBATIM (no reescribe nada) y
// verifica que la suma de los trozos == original (± los saltos de unión). Numeración decimal
// (N, N.2, N.3…) para que ordene bien como texto junto a los artículos existentes.
//
// GOTCHA que casi rompe el piloto: las filas de `topic_scope` con `article_numbers` EXPLÍCITO no
// recogen los artículos nuevos. Sin ampliarlas, las preguntas que se muevan DESAPARECEN de esos
// temas. El script las amplía y avisa de cuántas eran.
const fs = require('fs'), path = require('path');
const pg = require(path.join(__dirname, '..', '..', 'backend', 'node_modules', 'postgres'));
const url = fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const sql = pg(url, { ssl: { rejectUnauthorized: false }, max: 2 });
const DRY = !process.argv.includes('--apply');

// Cada bloque: las secciones `##` (por su número de orden, 1-based) que lo componen + título.
const PLAN = [
  { ley: 'Eliminacion y sondajes', art: '1', bloques: [
      { sufijo: '',    secs: [1], titulo: 'Diuresis / eliminacion urinaria' },
      { sufijo: '.2',  secs: [2], titulo: 'Defecacion / eliminacion intestinal' },
      { sufijo: '.3',  secs: [3], titulo: 'Cuidados del TCAE en la eliminacion' } ] },
  { ley: 'Eliminacion y sondajes', art: '6', bloques: [
      { sufijo: '',    secs: [1], titulo: 'Aparato digestivo: anatomia' },
      { sufijo: '.2',  secs: [2], titulo: 'Fisiologia digestiva' },
      { sufijo: '.3',  secs: [3], titulo: 'Sintomas y patologia digestiva frecuente' },
      { sufijo: '.4',  secs: [4, 5], titulo: 'Aparato urinario: anatomia y fisiologia' } ] },
  { ley: 'Oxigenoterapia', art: '1', bloques: [
      { sufijo: '',    secs: [1], titulo: 'Concepto, indicaciones y FiO2' },
      { sufijo: '.2',  secs: [2], titulo: 'Fuentes de oxigeno y elementos del sistema' },
      { sufijo: '.3',  secs: [3, 4, 5], titulo: 'Dispositivos de administracion (bajo y alto flujo)' },
      { sufijo: '.4',  secs: [6], titulo: 'Pulsioximetria y cuidados del paciente' } ] },
  { ley: 'Oxigenoterapia', art: '4', bloques: [
      { sufijo: '',    secs: [1], titulo: 'Aparato respiratorio: anatomia' },
      { sufijo: '.2',  secs: [2], titulo: 'Fisiologia de la respiracion' },
      { sufijo: '.3',  secs: [3], titulo: 'Patologia y sintomas respiratorios' },
      { sufijo: '.4',  secs: [4], titulo: 'Cuidados respiratorios del TCAE' } ] },
];

(async () => {
  for (const P of PLAN) {
    const art = (await sql`SELECT a.id, a.law_id, a.content FROM articles a JOIN laws l ON l.id = a.law_id
      WHERE l.short_name = ${P.ley} AND a.article_number = ${P.art}`)[0];
    if (!art) throw new Error(`${P.ley} art.${P.art} no existe`);
    const c = art.content;
    const heads = [...c.matchAll(/^## .+$/gm)].map(m => m.index);
    // límites: el bloque de la sección k va de heads[k-1] a heads[k]; la sección 1 se lleva el preámbulo
    const lim = i => (i === 1 ? 0 : heads[i - 1]);
    const fin = i => (i < heads.length ? heads[i] : c.length);

    const trozos = {};
    for (const b of P.bloques) {
      const num = P.art + b.sufijo;
      trozos[num] = b.secs.map(s => c.slice(lim(s), fin(s))).join('\n');
    }
    const suma = Object.values(trozos).reduce((s, t) => s + t.length, 0);
    const uniones = P.bloques.reduce((s, b) => s + (b.secs.length - 1), 0) + (P.bloques.length - 1);
    console.log(`\n════ ${P.ley} art.${P.art} — original ${c.length} | trozos ${suma} (uniones esperadas ≤${uniones})`);
    if (suma - c.length > uniones || suma < c.length) throw new Error('la suma no cuadra — ABORTA, se perdería o duplicaría texto');
    for (const [n, t] of Object.entries(trozos)) console.log(`   ${n.padEnd(5)} ${String(t.length).padStart(6)} chars`);

    if (DRY) continue;
    const nuevos = P.bloques.filter(b => b.sufijo).map(b => P.art + b.sufijo);
    await sql.begin(async tx => {
      await tx`UPDATE articles SET content = ${trozos[P.art]}, title = ${P.bloques[0].titulo} WHERE id = ${art.id}`;
      for (const b of P.bloques.filter(x => x.sufijo))
        await tx`INSERT INTO articles (law_id, article_number, title, content)
                 VALUES (${art.law_id}, ${P.art + b.sufijo}, ${b.titulo}, ${trozos[P.art + b.sufijo]})`;
      const upd = await tx`UPDATE topic_scope ts SET article_numbers = ts.article_numbers || ${nuevos}
        FROM laws l WHERE l.id = ts.law_id AND l.short_name = ${P.ley}
          AND ts.article_numbers IS NOT NULL AND NOT (${nuevos[0]} = ANY(ts.article_numbers))
        RETURNING ts.topic_id`;
      console.log(`   topic_scope: ${upd.length} fila(s) con lista explícita ampliadas con ${nuevos.join(', ')}`);
    });
  }
  if (DRY) { console.log('\n— DRY RUN (usa --apply) —'); }
  await sql.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
