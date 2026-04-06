/**
 * Import official exam questions from Andalucia Aux Admin exams
 * - Detects duplicates by question text similarity
 * - Maps explanationTitle to article UUIDs in DB
 * - Generates didactic explanations
 * - Inserts with proper metadata
 */

const { createClient } = require('/home/manuel/Documentos/github/vence/node_modules/@supabase/supabase-js');
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' });
const fs = require('fs');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ============ LAW MAPPING ============
// Maps patterns found in explanationTitle to law UUIDs
const LAW_MAP = {
  'CE': '6ad91a6c-41ec-431f-9c80-5f5566834941',
  'LBRL': '06784434-f549-4ea2-894f-e2e400881545',
  'TREBEP': 'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0',
  'LGSS': 'eabb640e-fa9b-47a8-8d76-2a580115cfb0',
  'Ley 39/2015': '218452f5-b9f6-48f0-a25b-26df9cb19644',
  'LO 3/2018': '146b7e50-e089-44a6-932c-773954f8d96b',
  'RD 203/2021': '21e40a28-26c7-420d-99b8-39eb3059dd4f',
  'Estatuto Autonomía Andalucía': '5238bdc9-2ee4-44a7-bcb2-413ba78cb230',
  'Estatuto Autonomia Andalucía': '5238bdc9-2ee4-44a7-bcb2-413ba78cb230',
  'Ley 9/2007 Andalucía': '5643454c-8c6e-4fd0-a238-9ac0d091ea6c',
  'Ley 12/2007 Andalucía': '1c53e192-9db1-4e83-a6d7-53ef6b2ebc33',
  'Ley 13/2007 Andalucía': '8e7c797c-77b5-4013-8ac9-9aaec19814c8',
  'Ley 6/2006 Andalucía': '248b0948-dfec-4403-af67-938e7873ae69',
  'Ley 1/2014 Andalucía': '8c564cd0-4b74-4218-8126-543185e29eb6',
  'Ley 7/2011 Andalucía': 'e067ce5a-7e92-466a-a75c-55fe7fcf2265',
  'Ley 5/1997 Andalucía': '66bed7e6-94db-49f0-8380-0a4af2dce309',
  'Ley 1/1988 Andalucía': 'a9492148-15ec-48e9-ac08-99dd538ef009',
  'Ley 1/2004 Andalucía': '3ac8fea0-f0fc-42b5-ad39-7dfcee9fefcf',
  'Ley 6/2005 Andalucía': 'b6e50d50-e09b-4488-b79d-f1dba9eef0ad',
  'Ley 5/2023 Andalucía': '53df9e3c-dc44-4e0f-98d1-e69785ba8554',
  'Ley 9/1983 Andalucía': '6d3fc488-9420-4baf-949a-980af34ebbfe',
  'Decreto 622/2019 Andalucía': '45a8bef1-0c98-41cc-aa13-d76e50b211eb',
  'Decreto 622/2019 andalucía': '45a8bef1-0c98-41cc-aa13-d76e50b211eb',
  'Decreto 317/2003 Andalucía': '7bd1fe9f-93c1-491c-80f8-b7cfbbfb8660',
  'Decreto 218/2020 Andalucía': '909a3d53-fd7a-4c39-b793-5fd143e01ee0',
  'Decreto 262/1988 Andalucía': 'fd52b224-c6c5-4dd8-923c-23eb85c0a8a2',
  'Decreto 90/1993 Andalucía': '1a30942c-c6f9-4c84-a10d-f2e994731f8f',
  'Decreto 204/1995 Andalucía': 'b15ac290-c643-488f-b5db-9e40b5476f4e',
  'Decreto Legislativo 1/2010 Andalucía': 'c729d9aa-4dd8-4cab-ba54-a239914b5263',
  'Reglamento del Parlamento de Andalucía': '8ad1b9b2-ee25-4c4e-b14a-6137e3ca9b75',
  'Código de Conducta': '997cdc8e-8176-40f4-95ad-c027c5a8f4c7',
  'LO 4/2001': '34891744-aac3-442d-91ca-377f18a71b45',
  'Ley 5/1988': '4aa184b6-1ab6-4055-9df0-bf3682cd6392',
  'Decreto 96/2021 Andalucía': null, // not in DB
  'Ley 6/1985 Andalucía': null, // not in DB - could be ILP related
  'Orden de 19 de febrero': null, // not in DB
  'Orden de 7 de julio de 2020': null, // not in DB
  'Orden de 25 de Abril de 2022': '41ce6d76-9ebd-4582-93b3-0768f65fc75e',
  'Decreto 10/2022 Andalucía': null, // not in DB
  'Ley 4/2005 Andalucía': null, // not in DB (derogated)
  'Ley 2/2024': '9d2cb745-44b7-4775-9dc7-f648940702ed',
};

// Parse explanationTitle to extract law reference and article number
function parseExplanationTitle(title) {
  if (!title) return { lawId: null, articleNumber: null, rawLaw: null };

  // Clean title
  let clean = title.replace(/^\*\s*/, '').trim();

  // Pattern: "Art. X.Y LawName" or "Art X.Y LawName"
  const artMatch = clean.match(/^Art\.?\s*(\d+(?:\.\d+)?(?:\s*bis(?:\.\d+)?)?)\s+(.+)$/i);
  if (!artMatch) {
    // Try patterns like "Título VIII CE"
    // These don't have article numbers, try to match law
    const lawId = findLawId(clean);
    return { lawId, articleNumber: null, rawLaw: clean };
  }

  let articleNum = artMatch[1].trim();
  let lawRef = artMatch[2].trim();

  // Handle compound references like "Art. 117.1 Ley 39/2015 + Art. 121 Ley 39/2015"
  // Just use the first one
  if (lawRef.includes('+')) {
    lawRef = lawRef.split('+')[0].trim();
  }
  if (lawRef.includes(',')) {
    // "Art. 12.2 Ley 39/2015, Art. 14.2 Ley 39/2015" - take first law ref
    lawRef = lawRef.split(',')[0].trim();
  }

  // Remove trailing periods and parenthetical notes
  lawRef = lawRef.replace(/\s*\(.*\)\s*$/, '').replace(/\.\s*$/, '').trim();

  // Extract just the base article number (e.g., "143" from "143.2")
  const baseArticle = articleNum.split('.')[0];

  const lawId = findLawId(lawRef);
  return { lawId, articleNumber: baseArticle, rawLaw: lawRef };
}

function findLawId(ref) {
  if (!ref) return null;

  // Direct matches first
  for (const [pattern, id] of Object.entries(LAW_MAP)) {
    if (ref.includes(pattern)) return id;
  }

  // Fuzzy matches
  if (ref.match(/\bCE\b/)) return LAW_MAP['CE'];
  if (ref.match(/\bLBRL\b/)) return LAW_MAP['LBRL'];
  if (ref.match(/\bTREBEP\b/)) return LAW_MAP['TREBEP'];
  if (ref.match(/\bLGSS\b/)) return LAW_MAP['LGSS'];
  if (ref.includes('Estatuto Autonom')) return LAW_MAP['Estatuto Autonomía Andalucía'];
  if (ref.includes('9/2007')) return LAW_MAP['Ley 9/2007 Andalucía'];
  if (ref.includes('12/2007')) return LAW_MAP['Ley 12/2007 Andalucía'];
  if (ref.includes('13/2007')) return LAW_MAP['Ley 13/2007 Andalucía'];
  if (ref.includes('39/2015')) return LAW_MAP['Ley 39/2015'];
  if (ref.includes('3/2018')) return LAW_MAP['LO 3/2018'];
  if (ref.includes('203/2021')) return LAW_MAP['RD 203/2021'];
  if (ref.includes('622/2019')) return LAW_MAP['Decreto 622/2019 Andalucía'];
  if (ref.includes('317/2003')) return LAW_MAP['Decreto 317/2003 Andalucía'];
  if (ref.includes('218/2020')) return LAW_MAP['Decreto 218/2020 Andalucía'];
  if (ref.includes('262/1988')) return LAW_MAP['Decreto 262/1988 Andalucía'];
  if (ref.includes('90/1993')) return LAW_MAP['Decreto 90/1993 Andalucía'];
  if (ref.includes('204/1995')) return LAW_MAP['Decreto 204/1995 Andalucía'];
  if (ref.includes('1/2010')) return LAW_MAP['Decreto Legislativo 1/2010 Andalucía'];
  if (ref.includes('6/2006')) return LAW_MAP['Ley 6/2006 Andalucía'];
  if (ref.includes('1/2014')) return LAW_MAP['Ley 1/2014 Andalucía'];
  if (ref.includes('7/2011')) return LAW_MAP['Ley 7/2011 Andalucía'];
  if (ref.includes('5/1997')) return LAW_MAP['Ley 5/1997 Andalucía'];
  if (ref.includes('1/1988')) return LAW_MAP['Ley 1/1988 Andalucía'];
  if (ref.includes('1/2004')) return LAW_MAP['Ley 1/2004 Andalucía'];
  if (ref.includes('6/2005')) return LAW_MAP['Ley 6/2005 Andalucía'];
  if (ref.includes('5/2023')) return LAW_MAP['Ley 5/2023 Andalucía'];
  if (ref.includes('9/1983')) return LAW_MAP['Ley 9/1983 Andalucía'];
  if (ref.includes('Parlamento')) return LAW_MAP['Reglamento del Parlamento de Andalucía'];
  if (ref.includes('Conducta') && ref.includes('TIC')) return LAW_MAP['Código de Conducta'];
  if (ref.includes('4/2001')) return LAW_MAP['LO 4/2001'];
  if (ref.includes('5/1988')) return LAW_MAP['Ley 5/1988'];
  if (ref.includes('25 de Abril de 2022') || ref.includes('25 de abril de 2022')) return LAW_MAP['Orden de 25 de Abril de 2022'];
  if (ref.includes('2/2024')) return LAW_MAP['Ley 2/2024'];
  if (ref.includes('Ley 6/1985')) return null; // not in DB
  if (ref.includes('19 de febrero')) return null;
  if (ref.includes('julio de 2020') || ref.includes('7 de julio')) return null;
  if (ref.includes('96/2021')) return null;
  if (ref.includes('10/2022')) return null;
  if (ref.includes('4/2005')) return null;

  return null;
}

function decodeHtml(html) {
  if (!html) return '';
  return html
    .replace(/&oacute;/g, 'ó')
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&uacute;/g, 'ú')
    .replace(/&ntilde;/g, 'ñ')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&Ntilde;/g, 'Ñ')
    .replace(/&uuml;/g, 'ü')
    .replace(/&Uuml;/g, 'Ü')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&laquo;/g, '\u00AB')
    .replace(/&raquo;/g, '\u00BB')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&hellip;/g, '\u2026')
    .replace(/&ordm;/g, 'º')
    .replace(/&ordf;/g, 'ª')
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&rdquo;/g, '\u201D')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&bull;/g, '\u2022')
    .replace(/&ccedil;/g, 'ç')
    .replace(/&Ccedil;/g, 'Ç')
    .replace(/&#\d+;/g, (match) => {
      const code = parseInt(match.replace(/&#|;/g, ''));
      return String.fromCharCode(code);
    });
}

function htmlToMarkdown(html) {
  if (!html) return '';
  let text = decodeHtml(html);
  // Remove tags, convert basic ones
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<p[^>]*>/gi, '');
  text = text.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  text = text.replace(/<b>(.*?)<\/b>/gi, '**$1**');
  text = text.replace(/<em>(.*?)<\/em>/gi, '*$1*');
  text = text.replace(/<i>(.*?)<\/i>/gi, '*$1*');
  text = text.replace(/<li>(.*?)<\/li>/gi, '- $1\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

// Extract article quote from the HTML explanation
function extractArticleQuote(htmlExplanation) {
  if (!htmlExplanation) return null;
  const decoded = decodeHtml(htmlExplanation);
  // Try to extract the article content between tags
  const paragraphs = decoded.split(/<\/p>/i).map(p => p.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
  // Skip the title paragraphs and get the content ones
  const contentParagraphs = paragraphs.filter(p => !p.match(/^(Art|Ley|Decreto|Constitución|Real|Orden|LO|RD|Código|Título|Capítulo|Disposición)/i) || p.length > 100);
  if (contentParagraphs.length > 0) {
    return contentParagraphs.join('\n\n');
  }
  return htmlToMarkdown(htmlExplanation);
}

function correctOptionIndex(letter) {
  const map = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
  return map[letter.toUpperCase()] ?? 0;
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-záéíóúñü\d\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildExplanation(q, articleContent) {
  const correctLetter = q.correctAnswer;
  const correctOption = q.options.find(o => o.isCorrect);
  const incorrectOptions = q.options.filter(o => !o.isCorrect);
  const ref = q.explanationTitle ? q.explanationTitle.replace(/^\*\s*/, '') : '';

  // Get the article quote from the scraped explanation
  const quote = extractArticleQuote(q.explanation);

  let explanation = '';

  // Blockquote with article citation
  if (quote && ref) {
    explanation += `**${ref}**\n\n`;
    // Add the relevant quote as blockquote
    const quoteLines = quote.split('\n').filter(l => l.trim());
    // Take the most relevant content (skip titles, keep substance)
    const substantiveLines = quoteLines.filter(l => l.length > 30);
    if (substantiveLines.length > 0) {
      const quoteText = substantiveLines.slice(0, 4).join('\n');
      explanation += quoteText.split('\n').map(l => `> ${l}`).join('\n') + '\n\n';
    }
  } else if (ref) {
    explanation += `**${ref}**\n\n`;
  }

  // Why correct is correct
  explanation += `**Por que ${correctLetter} es correcta:**\n`;
  explanation += `La opcion "${correctOption.text}" es la respuesta correcta`;
  if (ref) {
    explanation += ` segun lo establecido en el ${ref}`;
  }
  explanation += '.\n\n';

  // Use article content for the explanation if available
  if (articleContent) {
    const contentSnippet = articleContent.substring(0, 300).trim();
    if (contentSnippet.length > 50) {
      explanation += `> **${contentSnippet}**\n\n`;
    }
  }

  // Why the others are incorrect
  explanation += '**Por que las demas son incorrectas:**\n\n';
  for (const opt of incorrectOptions) {
    explanation += `- **${opt.letter})** "${opt.text}" - `;
    if (q.isAnnulled) {
      explanation += 'Esta pregunta fue anulada.\n';
    } else {
      explanation += `No es correcta segun la normativa aplicable.\n`;
    }
  }

  return explanation;
}

async function loadArticlesCache() {
  console.log('Cargando cache de articulos...');
  const cache = {}; // lawId -> { articleNumber -> articleId }

  // Get all relevant law IDs
  const lawIds = [...new Set(Object.values(LAW_MAP).filter(Boolean))];

  for (const lawId of lawIds) {
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, article_number, content, law_id')
      .eq('law_id', lawId)
      .eq('is_active', true);

    if (error) {
      console.error(`Error loading articles for law ${lawId}:`, error.message);
      continue;
    }

    if (!cache[lawId]) cache[lawId] = {};
    for (const art of (articles || [])) {
      cache[lawId][art.article_number] = { id: art.id, content: art.content };
    }
  }

  console.log(`Cache cargado: ${lawIds.length} leyes, ${Object.values(cache).reduce((sum, c) => sum + Object.keys(c).length, 0)} articulos`);
  return cache;
}

async function loadExistingQuestions() {
  console.log('Cargando preguntas existentes para deteccion de duplicados...');
  const allQuestions = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('questions')
      .select('id, question_text')
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('Error cargando preguntas:', error.message);
      break;
    }
    if (!data || data.length === 0) break;
    allQuestions.push(...data);
    from += pageSize;
    if (data.length < pageSize) break;
  }

  return allQuestions;
}

function isDuplicate(newText, existingQuestions) {
  const normalNew = normalizeText(newText);
  for (const eq of existingQuestions) {
    const normalExisting = normalizeText(eq.question_text);
    if (normalNew === normalExisting) return true;
    // Check high similarity (first 80 chars match)
    if (normalNew.length > 40 && normalExisting.length > 40) {
      const snippet = normalNew.substring(0, 80);
      if (normalExisting.includes(snippet)) return true;
    }
  }
  return false;
}

async function processExam(filePath, articlesCache, existingQuestions) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const examName = data.nombre;
  const questions = data.questions;

  console.log(`\n========================================`);
  console.log(`Procesando: ${examName} (${questions.length} preguntas)`);
  console.log(`========================================`);

  let inserted = 0;
  let duplicates = 0;
  let noArticle = 0;
  let errors = 0;
  const noArticleList = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const questionText = q.question.trim();

    // 1. Check duplicates
    if (isDuplicate(questionText, existingQuestions)) {
      duplicates++;
      continue;
    }

    // 2. Parse law reference and find article
    const { lawId, articleNumber, rawLaw } = parseExplanationTitle(q.explanationTitle);

    let articleId = null;
    let articleContent = null;

    if (lawId && articleNumber && articlesCache[lawId]) {
      const artData = articlesCache[lawId][articleNumber];
      if (artData) {
        articleId = artData.id;
        articleContent = artData.content;
      }
    }

    // If no article found, try to find by law alone (use first article)
    if (!articleId && lawId && articlesCache[lawId]) {
      // Try article_number variations: "143" vs "143 bis" etc
      const artEntries = Object.entries(articlesCache[lawId]);
      if (articleNumber) {
        // Try with "bis" suffix
        const bisKey = articleNumber + ' bis';
        if (articlesCache[lawId][bisKey]) {
          articleId = articlesCache[lawId][bisKey].id;
          articleContent = articlesCache[lawId][bisKey].content;
        }
      }
    }

    if (!articleId) {
      noArticle++;
      noArticleList.push({ i: i + 1, title: q.explanationTitle, lawId, articleNumber, rawLaw });
    }

    // Skip questions without article (requirement: primary_article_id NUNCA null)
    if (!articleId) {
      continue;
    }

    // 3. Build explanation
    const explanation = buildExplanation(q, articleContent);

    // 4. Map correct answer
    const correctIdx = correctOptionIndex(q.correctAnswer);

    // 5. Build question object
    const questionObj = {
      question_text: questionText,
      option_a: q.options.find(o => o.letter === 'A')?.text || '',
      option_b: q.options.find(o => o.letter === 'B')?.text || '',
      option_c: q.options.find(o => o.letter === 'C')?.text || '',
      option_d: q.options.find(o => o.letter === 'D')?.text || '',
      correct_option: correctIdx,
      explanation: explanation,
      difficulty: 2, // medium default
      question_type: 'single',
      tags: ['Oficial', 'Andalucía'],
      is_active: false,
      primary_article_id: articleId,
      is_official_exam: true,
      exam_source: examName,
      exam_position: 'auxiliar_administrativo_andalucia',
      topic_review_status: 'pending',
    };

    // 6. Insert
    const { data: insertedData, error } = await supabase
      .from('questions')
      .insert(questionObj)
      .select('id');

    if (error) {
      console.error(`  Error inserting Q${i + 1}: ${error.message}`);
      errors++;
    } else {
      inserted++;
      // Add to existing questions to prevent duplicates within same batch
      existingQuestions.push({ id: insertedData[0].id, question_text: questionText });
    }
  }

  console.log(`\nResultados ${examName}:`);
  console.log(`  Insertadas: ${inserted}`);
  console.log(`  Duplicados: ${duplicates}`);
  console.log(`  Sin articulo (skipped): ${noArticle}`);
  console.log(`  Errores: ${errors}`);

  if (noArticleList.length > 0) {
    console.log(`\n  Preguntas sin articulo:`);
    for (const na of noArticleList) {
      console.log(`    #${na.i}: ${na.title} (law=${na.lawId ? 'found' : 'NOT FOUND'}, art=${na.articleNumber || 'none'}, ref=${na.rawLaw})`);
    }
  }

  return { inserted, duplicates, noArticle, errors, examName };
}

async function main() {
  console.log('=== Importacion Examenes Oficiales Andalucia ===\n');

  // Load caches
  const articlesCache = await loadArticlesCache();
  const existingQuestions = await loadExistingQuestions();
  console.log(`Preguntas existentes: ${existingQuestions.length}`);

  const files = [
    '/home/manuel/Documentos/github/vence/preguntas-para-subir/auxiliar-andalucia/examenes-oficiales/Examen_2022__OEP_2019__2020__2021_.json',
    '/home/manuel/Documentos/github/vence/preguntas-para-subir/auxiliar-andalucia/examenes-oficiales/Examen_OEP_2022_Estabilizaci_n.json',
    '/home/manuel/Documentos/github/vence/preguntas-para-subir/auxiliar-andalucia/examenes-oficiales/Examen_2023__OEP_2022_2023_.json',
  ];

  const results = [];
  for (const file of files) {
    const result = await processExam(file, articlesCache, existingQuestions);
    results.push(result);
  }

  // Summary
  console.log('\n\n========================================');
  console.log('RESUMEN FINAL');
  console.log('========================================');
  let totalInserted = 0, totalDups = 0, totalNoArt = 0, totalErrors = 0;
  for (const r of results) {
    console.log(`${r.examName}: ${r.inserted} insertadas, ${r.duplicates} duplicados, ${r.noArticle} sin articulo, ${r.errors} errores`);
    totalInserted += r.inserted;
    totalDups += r.duplicates;
    totalNoArt += r.noArticle;
    totalErrors += r.errors;
  }
  console.log(`\nTOTAL: ${totalInserted} insertadas, ${totalDups} duplicados, ${totalNoArt} sin articulo, ${totalErrors} errores`);
}

main().catch(console.error);
