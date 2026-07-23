// FASE 3 — topic_scope de Ordenanza Ayto. Córdoba (temas reutilizables 1-7 y 9).
// Temas 8 (parte local) y 10 (local) se escopan en la fase de contenido local.
// Fiel al epígrafe oficial (BOP núm. 99, 23/05/2025). Reutiliza banco existente.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const POS = 'ordenanza_ayuntamiento_cordoba';
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => String(a + i));

// law_id por prefijo (se resuelve a uuid completo)
const LAW = {
  CE: '6ad91a6c', LBRL: '06784434', LO_3_2007: '6e59eacd', LO_1_2004: 'f5c17b23',
  LPRL: '8b1ae300', L39: '218452f5', ATENCION: 'be947ea8', D204_JA: 'b15ac290',
  MAQ_REPRO: '922297dd', REPRO_OFI: 'f98203f0', POSTAL: 'd135f273',
  CARGAS: '7c20a555', GUIA_CARGAS: 'b1a1af88', RD486: '04fa5f20', RD485: '793b1dab',
};

// topic_number → [{law, arts|null}]
const SCOPE = {
  1: [ { law: 'CE', arts: [...range(0, 55), ...range(137, 158)] } ],                     // estructura + derechos + org. territorial
  2: [ { law: 'LBRL', arts: [...range(1, 5), ...range(11, 28), ...range(89, 104), ...range(121, 138)] } ],
  3: [ { law: 'LO_3_2007', arts: ['1','3','4','5','6','7','8','10','11','12','14','15'] },
       { law: 'LO_1_2004', arts: ['1','2'] } ],
  4: [ { law: 'LPRL', arts: ['1','2','4', ...range(14, 40)] } ],                          // derechos/obligaciones + delegados + comité
  5: [ { law: 'L39', arts: ['13','14','16','53'] },
       { law: 'ATENCION', arts: null },
       { law: 'D204_JA', arts: null } ],
  6: [ { law: 'MAQ_REPRO', arts: null },
       { law: 'REPRO_OFI', arts: null } ],
  7: [ { law: 'L39', arts: range(40, 46) },                                              // notificaciones
       { law: 'POSTAL', arts: null },                                                    // servicios postales
       { law: 'CARGAS', arts: null }, { law: 'GUIA_CARGAS', arts: null } ],              // manipulación de cargas
  9: [ { law: 'RD486', arts: null },                                                     // lugares de trabajo
       { law: 'RD485', arts: null } ],                                                   // señalización (banco pendiente)
};

(async () => {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '');
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query('BEGIN');

    // resolver law prefixes → uuid
    const lawId = {};
    for (const [k, pref] of Object.entries(LAW)) {
      const r = await c.query("SELECT id FROM laws WHERE id::text LIKE $1", [pref + '%']);
      if (r.rowCount !== 1) throw new Error(`Ley ${k} (${pref}) resolvió ${r.rowCount} filas`);
      lawId[k] = r.rows[0].id;
    }

    // topic_id por topic_number
    const tq = await c.query("SELECT id, topic_number FROM topics WHERE position_type=$1", [POS]);
    const topicId = Object.fromEntries(tq.rows.map(r => [r.topic_number, r.id]));

    let inserted = 0;
    for (const [tn, entries] of Object.entries(SCOPE)) {
      const tid = topicId[Number(tn)];
      if (!tid) throw new Error('No existe topic ' + tn);
      // idempotente: limpia scope previo de este tema
      await c.query('DELETE FROM topic_scope WHERE topic_id=$1', [tid]);
      for (const e of entries) {
        await c.query(
          `INSERT INTO topic_scope (topic_id, law_id, article_numbers, include_full_title, include_full_chapter, weight)
           VALUES ($1,$2,$3,false,false,1.0)`,
          [tid, lawId[e.law], e.arts]); // arts NULL = toda la ley
        inserted++;
      }
      console.log(`  T${tn}: ${entries.length} ley(es) escopadas`);
    }

    await c.query('COMMIT');
    console.log(`\n✅ FASE 3: ${inserted} filas topic_scope (temas 1-7, 9). Temas 8 y 10 pendientes (contenido local).`);
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('❌ ROLLBACK:', e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
})();
