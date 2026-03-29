/**
 * Re-asignar primary_article_id para preguntas CyL needs_review
 * Busca el artículo correcto analizando la explicación y el texto de la pregunta
 * contra TODAS las leyes de la BD (no solo topic_scope)
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function normalize(text) {
  return (text || '').toLowerCase()
    .replace(/[áàâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i')
    .replace(/[óòôö]/g, 'o').replace(/[úùûü]/g, 'u').replace(/ñ/g, 'n');
}

(async () => {
  // 1. Load all needs_review CyL questions
  let questions = [];
  let page = 0;
  while (true) {
    const { data } = await sb.from('questions')
      .select('id, question_text, explanation, tags, primary_article_id')
      .contains('tags', ['CyL'])
      .eq('topic_review_status', 'needs_review')
      .range(page * 500, (page + 1) * 500 - 1);
    if (!data || data.length === 0) break;
    questions.push(...data);
    page++;
    if (data.length < 500) break;
  }
  console.log('Needs review questions:', questions.length);

  // 2. Build law lookup: short_name → { id, aliases }
  const { data: allLaws } = await sb.from('laws').select('id, short_name, name').eq('is_active', true).limit(500);
  const lawById = {};
  allLaws.forEach(l => lawById[l.id] = l);

  // 3. For each question, detect which law it references from explanation
  const lawPatterns = [
    { regex: /(?:LO|ley\s+org[aá]nica)\s+14\/2007/i, lawShort: 'LO 14/2007' },
    { regex: /(?:ley)\s+1\/1998/i, lawShort: 'Ley 1/1998 CyL' },
    { regex: /(?:ley)\s+3\/2001/i, lawShort: 'Ley 3/2001 CyL' },
    { regex: /(?:ley)\s+7\/2005/i, lawShort: 'Ley 7/2005 CyL' },
    { regex: /(?:ley)\s+2\/2006/i, lawShort: 'Ley 2/2006 CyL' },
    { regex: /(?:ley)\s+2\/1994/i, lawShort: 'Ley 2/1994 CyL' },
    { regex: /(?:ley)\s+1\/2002/i, lawShort: 'Ley 1/2002 CyL' },
    { regex: /(?:ley)\s+2\/2002/i, lawShort: 'Ley 2/2002 CyL' },
    { regex: /(?:ley)\s+13\/1990/i, lawShort: 'Ley 13/1990 CyL' },
    { regex: /(?:ley)\s+3\/2015/i, lawShort: 'Ley 3/2015 CyL' },
    { regex: /(?:ley)\s+2\/2010/i, lawShort: 'Ley 2/2010 CyL' },
    { regex: /(?:ley)\s+13\/2010/i, lawShort: 'Ley 13/2010 CyL' },
    { regex: /(?:ley)\s+2\/2013/i, lawShort: 'Ley 2/2013 CyL' },
    { regex: /constituci[oó]n/i, lawShort: 'CE' },
    { regex: /(?:ley)\s+39\/2015/i, lawShort: 'Ley 39/2015' },
    { regex: /(?:ley)\s+40\/2015/i, lawShort: 'Ley 40/2015' },
    { regex: /TREBEP|(?:ley)\s+7\/2007|(?:RDL|Real Decreto Legislativo)\s+5\/2015/i, lawShort: 'TREBEP' },
    { regex: /(?:ley)\s+7\/1985|LRBRL/i, lawShort: 'LRBRL' },
    { regex: /(?:ley)\s+53\/1984/i, lawShort: 'Ley 53/1984' },
    { regex: /(?:ley)\s+50\/1997/i, lawShort: 'Ley 50/1997' },
    { regex: /(?:RDL|Real Decreto Legislativo)\s+1\/2013/i, lawShort: 'RDL 1/2013' },
    { regex: /(?:ley)\s+39\/2006/i, lawShort: 'Ley 39/2006' },
    { regex: /(?:LO|ley\s+org[aá]nica)\s+3\/2007/i, lawShort: 'LO 3/2007' },
    { regex: /(?:ley)\s+19\/2013/i, lawShort: 'Ley 19/2013' },
    { regex: /(?:ley)\s+15\/2022/i, lawShort: 'Ley 15/2022' },
    { regex: /(?:ley)\s+4\/2023/i, lawShort: 'Ley 4/2023' },
    { regex: /(?:ley)\s+31\/1995|LPRL/i, lawShort: 'LPRL' },
    { regex: /(?:LO|ley\s+org[aá]nica)\s+11\/1985|LOLS/i, lawShort: 'LOLS' },
  ];

  // Build law short_name → law_id map
  const lawNameToId = {};
  for (const l of allLaws) {
    lawNameToId[l.short_name] = l.id;
  }
  // Add aliases
  const aliases = {
    'CE': allLaws.find(l => l.short_name?.includes('CE') || l.name?.includes('Constitución'))?.id,
    'LRBRL': allLaws.find(l => l.short_name?.includes('7/1985'))?.id,
    'TREBEP': allLaws.find(l => l.short_name?.includes('TREBEP') || l.short_name?.includes('5/2015'))?.id,
    'LPRL': allLaws.find(l => l.short_name?.includes('31/1995') || l.name?.includes('Prevención de Riesgos'))?.id,
    'LOLS': allLaws.find(l => l.short_name?.includes('11/1985'))?.id,
    'RDL 1/2013': allLaws.find(l => l.short_name?.includes('RDL 1/2013') || l.short_name?.includes('1/2013'))?.id,
  };
  Object.assign(lawNameToId, aliases);

  // 4. For each question, find the correct article
  let fixed = 0, noLaw = 0, noArticle = 0, errors = 0;
  const missingLaws = {};

  for (const q of questions) {
    const text = normalize(q.explanation + ' ' + q.question_text);

    // Detect law
    let detectedLawId = null;
    let detectedLawName = null;
    for (const p of lawPatterns) {
      if (p.regex.test(q.explanation || '') || p.regex.test(q.question_text || '')) {
        detectedLawId = lawNameToId[p.lawShort];
        detectedLawName = p.lawShort;
        break;
      }
    }

    if (!detectedLawId) {
      noLaw++;
      // Track what law pattern we're missing
      const lawMatch = text.match(/(?:ley|decreto|rd|lo|rdl|dl|orden|acuerdo|reglamento)\s+[\w\/]+/i);
      if (lawMatch) {
        missingLaws[lawMatch[0]] = (missingLaws[lawMatch[0]] || 0) + 1;
      }
      continue;
    }

    // Detect article number
    const artMatch = (q.explanation || '').match(/art[íi]culo\s+(\d+(?:\s*bis|\s*ter|\s*qu[aá]ter)?)/i)
      || (q.question_text || '').match(/art[íi]culo\s+(\d+(?:\s*bis|\s*ter|\s*qu[aá]ter)?)/i)
      || (q.explanation || '').match(/art\.\s*(\d+(?:\s*bis|\s*ter|\s*qu[aá]ter)?)/i);

    if (!artMatch) {
      // Try to find article from content matching
      noArticle++;
      continue;
    }

    const artNum = artMatch[1].trim();

    // Look up article in DB
    const { data: art } = await sb.from('articles')
      .select('id')
      .eq('law_id', detectedLawId)
      .eq('article_number', artNum)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!art) {
      // Try without bis/ter
      const cleanNum = artNum.replace(/\s*(bis|ter|qu[aá]ter).*$/i, '').trim();
      const { data: art2 } = await sb.from('articles')
        .select('id')
        .eq('law_id', detectedLawId)
        .eq('article_number', cleanNum)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!art2) {
        noArticle++;
        continue;
      }

      // Update
      const { error } = await sb.from('questions')
        .update({ primary_article_id: art2.id, topic_review_status: 'pending' })
        .eq('id', q.id);
      if (error) errors++;
      else fixed++;
      continue;
    }

    // Update
    const { error } = await sb.from('questions')
      .update({ primary_article_id: art.id, topic_review_status: 'pending' })
      .eq('id', q.id);
    if (error) errors++;
    else fixed++;
  }

  console.log('\n=== RESULTADO RE-ASIGNACIÓN ===');
  console.log('Fixed:', fixed);
  console.log('No law detected:', noLaw);
  console.log('No article found:', noArticle);
  console.log('Errors:', errors);
  console.log('Total:', questions.length);

  if (Object.keys(missingLaws).length > 0) {
    console.log('\nLeyes no detectadas (top 15):');
    Object.entries(missingLaws).sort((a,b) => b[1]-a[1]).slice(0, 15).forEach(([k,v]) => console.log('  ' + v + 'x | ' + k));
  }
})();
