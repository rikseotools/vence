#!/usr/bin/env node
// Re-trocea los artículos que en el import se "tragaron" las disposiciones finales / anexos que
// venían detrás en el PDF del boletín. Defecto conocido y documentado en
// `laws.last_verification_summary` de ambas normas ("re-trocear pendiente").
//
// Consecuencia de no arreglarlo: el último artículo mide varios miles de caracteres y mezcla su
// propio contenido con disposiciones que NO son suyas. Quien lo lea en teoría cree que todo eso
// es el artículo, y el matcher de verificación lo marca como discrepante para siempre.
//
// GARANTÍA DE INTEGRIDAD: no se pierde ni un carácter. El texto que se recorta del artículo se
// inserta como artículo(s) nuevo(s), y el script comprueba que
//     len(artículo recortado) + len(nuevos) == len(original)   (± los saltos de unión)
// Si no cuadra, aborta sin escribir.
const fs = require('fs'), path = require('path');
const pg = require(path.join(__dirname, '..', '..', 'backend', 'node_modules', 'postgres'));
const url = fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const sql = pg(url, { ssl: { rejectUnauthorized: false }, max: 2 });
const DRY = !process.argv.includes('--apply');

const PLAN = [
  {
    ley: 'VIII Convenio Colectivo PL Aragón',
    art: '137',
    // El art.137 acaba en "…prevista en aquel." y detrás vienen las disposiciones del convenio.
    corte: /\n\s*DISPOSICIONES ADICIONALES/,
    nuevos: [{ num: 'DA-DT', titulo: 'Disposiciones adicionales y transitorias' }],
    // Cola del PDF: el número de página suelto al final no es contenido normativo.
    limpiarCola: /\n\s*\d{4,6}\s*$/,
  },
  {
    ley: 'Decreto 100/2003 Aragón Registro Voluntades Anticipadas',
    art: '12',
    // Tras el art.12 viene la descripción del fichero de datos (anexo), que empieza por el
    // epígrafe numerado "1.-Identificación del fichero" o equivalente.
    corte: /\n\s*(ANEXO|DISPOSICI|1\.-\s*(Identificaci|[ÓO]rgano|Finalidad|Denominaci))/i,
    nuevos: [{ num: 'ANEXO', titulo: 'Anexo: fichero del Registro de Voluntades Anticipadas' }],
    limpiarCola: null,
  },
];

(async () => {
  for (const P of PLAN) {
    const l = (await sql`SELECT id FROM laws WHERE short_name = ${P.ley}`)[0];
    if (!l) throw new Error(`ley no encontrada: ${P.ley}`);
    const a = (await sql`SELECT id, content FROM articles WHERE law_id = ${l.id} AND article_number = ${P.art}`)[0];
    if (!a) throw new Error(`${P.ley} art.${P.art} no encontrado`);

    const original = a.content;
    const i = original.search(P.corte);
    console.log(`\n══ ${P.ley} art.${P.art} — ${original.length} chars`);
    if (i < 0) { console.log('   ⚠️ no se localiza el corte — SE OMITE (no se toca nada)'); continue; }

    let cabeza = original.slice(0, i).trimEnd();
    let cola = original.slice(i).trim();
    if (P.limpiarCola) {
      const antes = cola.length;
      cola = cola.replace(P.limpiarCola, '').trimEnd();
      if (cola.length !== antes) console.log(`   (quitado ${antes - cola.length} chars de cola del PDF: nº de página)`);
    }
    console.log(`   artículo real: ${cabeza.length} chars | se extrae: ${cola.length} chars`);

    // INTEGRIDAD: nada perdido salvo los espacios recortados y la cola de PDF explícita.
    const perdido = original.length - cabeza.length - cola.length;
    console.log(`   diferencia: ${perdido} chars (espacios de corte + cola de PDF)`);
    if (perdido < 0 || perdido > 40) throw new Error('la partición no cuadra — ABORTA');

    // ¿alguna pregunta depende del trozo que se va?
    const qs = await sql`SELECT id, question_text FROM questions WHERE primary_article_id = ${a.id} AND is_active`;
    console.log(`   preguntas activas en el artículo: ${qs.length}`);

    if (DRY) { console.log('   — DRY RUN —'); continue; }

    await sql.begin(async tx => {
      await tx`UPDATE articles SET content = ${cabeza}, updated_at = now() WHERE id = ${a.id}`;
      for (const n of P.nuevos) {
        const ya = await tx`SELECT id FROM articles WHERE law_id = ${l.id} AND article_number = ${n.num}`;
        if (ya.length) { await tx`UPDATE articles SET content = ${cola}, title = ${n.titulo} WHERE id = ${ya[0].id}`; }
        else { await tx`INSERT INTO articles (law_id, article_number, title, content) VALUES (${l.id}, ${n.num}, ${n.titulo}, ${cola})`; }
      }
    });
    console.log('   ✅ re-troceado');
  }

  if (!DRY) {
    console.log('\n— estado final —');
    console.table(await sql`SELECT l.short_name ley, a.article_number n, length(a.content) chars
      FROM articles a JOIN laws l ON l.id = a.law_id
      WHERE l.short_name = ANY(${PLAN.map(p => p.ley)}) AND a.article_number IN ('137','12','DA-DT','ANEXO')
      ORDER BY 1, 2`);
  }
  await sql.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
