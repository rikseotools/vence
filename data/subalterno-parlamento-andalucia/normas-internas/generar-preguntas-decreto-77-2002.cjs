/**
 * Genera 8 preguntas de CONCEPTO (draft) sobre el Decreto 77/2002, de 26 de febrero,
 * por el que se regula el régimen de precedencias y tratamientos en el ámbito de la
 * Junta de Andalucía.
 *
 * Solo conceptos estables (definiciones, principios, reglas, tratamientos).
 * NUNCA sobre el orden concreto de consejerías/autoridades (arts. 7 y 8, no importados).
 *
 * Correcta = cita literal del artículo. Distribución A/B/C/D = 2/2/2/2.
 */
require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: { rejectUnauthorized: false } });

const LAW_SLUG = 'decreto-77-2002-precedencias-tratamientos-ja';
const NORMA = 'Decreto 77/2002, de 26 de febrero, por el que se regula el régimen de precedencias y tratamientos en el ámbito de la Junta de Andalucía';
const TAGS = ['ia_generada', 'gen_decreto_77_2002_precedencias_2026-07-20'];

// correct: 0=A 1=B 2=C 3=D — secuencia no monótona B,D,A,C,D,A,C,B → 2/2/2/2
const QUESTIONS = [
  {
    art: '2',
    correct: 1, // B
    q: `Según el ${NORMA}, entre los principios generales que rigen las precedencias y ordenación de Autoridades y Corporaciones, ¿qué se establece como norma general de conducta respecto a la precedencia?`,
    a: 'Debe ser norma general de conducta que la precedencia atribuye por sí honor de jerarquía, además de significar una ordenación.',
    b: 'Debe ser norma general de conducta que la precedencia no confiere por sí honor de jerarquía, sino que significa mera ordenación.',
    c: 'Debe ser norma general de conducta que la precedencia confiere honor de jerarquía cuando se trata de actos de carácter general.',
    d: 'Debe ser norma general de conducta que la precedencia sustituye al rango propio de cada autoridad en los actos oficiales.',
    cite: 'Debe ser norma general de conducta que la precedencia no confiere por sí honor de jerarquía, sino que significa mera ordenación.',
    why: {
      A: 'invierte el precepto: el Decreto dice justamente que la precedencia NO confiere por sí honor de jerarquía.',
      C: 'introduce una distinción por clase de acto que el artículo no contempla; la regla es general y niega el honor de jerarquía.',
      D: 'la precedencia no sustituye al rango propio: es mera ordenación, y el rango propio se mantiene.',
    },
  },
  {
    art: '3',
    correct: 3, // D
    q: `De acuerdo con el ${NORMA}, ¿cómo se definen los actos oficiales de carácter general?`,
    a: 'Son los organizados por determinadas Instituciones y Organismos con ocasión de acontecimientos propios del ámbito específico de sus servicios.',
    b: 'Son los que se celebran en Andalucía por iniciativa de las Corporaciones Locales cuando asista el Presidente de la Junta de Andalucía.',
    c: 'Son los que con motivo de la celebración de sesiones parlamentarias y actos judiciales sean organizados por el Consejo de Gobierno.',
    d: 'Son los que con motivo de la celebración de festividades, acontecimientos y conmemoraciones sean organizados por las autoridades competentes.',
    cite: 'Son los que con motivo de la celebración de festividades, acontecimientos y conmemoraciones sean organizados por las autoridades competentes.',
    why: {
      A: 'esa es la definición de los actos oficiales de carácter ESPECIAL, no de los generales.',
      B: 'el Decreto no define los actos generales por la iniciativa de las Corporaciones Locales ni por la asistencia del Presidente.',
      C: 'el artículo no menciona sesiones parlamentarias ni actos judiciales, sino festividades, acontecimientos y conmemoraciones.',
    },
  },
  {
    art: '4',
    correct: 0, // A
    q: `Conforme al ${NORMA}, ¿a quién corresponde la presidencia de los actos oficiales?`,
    a: 'La presidencia de los actos oficiales, cualquiera que sea el lugar donde se celebren, corresponderá a la Autoridad que los organice, salvo que asista al acto otra Autoridad a la que se encuentre subordinada jerárquicamente, en cuyo caso esta última asumirá la presidencia.',
    b: 'La presidencia de los actos oficiales, cualquiera que sea el lugar donde se celebren, corresponderá siempre a la Autoridad de mayor rango presente, aunque no haya intervenido en la organización ni exista subordinación jerárquica alguna entre ambas.',
    c: 'La presidencia de los actos oficiales corresponderá a la Autoridad que los organice únicamente cuando se celebren en su propia sede, correspondiendo en los demás casos a la autoridad territorial del lugar donde el acto tenga lugar.',
    d: 'La presidencia de los actos oficiales corresponderá a la Autoridad que los organice, salvo que asista otra Autoridad de distinta Administración, en cuyo caso la presidencia será compartida entre ambas conforme al orden de prelación.',
    cite: 'La presidencia de los actos oficiales, cualquiera que sea el lugar donde se celebren, corresponderá a la Autoridad que los organice, salvo que asista al acto otra Autoridad a la que se encuentre subordinada jerárquicamente, en cuyo caso esta última asumirá la presidencia.',
    why: {
      B: 'la regla no es el mayor rango sin más: la excepción exige que la Autoridad organizadora esté subordinada jerárquicamente a la asistente.',
      C: 'el artículo dice expresamente "cualquiera que sea el lugar donde se celebren", sin la limitación a la sede propia que aquí se inventa.',
      D: 'la presidencia nunca es compartida: el propio Decreto establece como principio que la presidencia de los actos será unipersonal.',
    },
  },
  {
    art: '10',
    correct: 2, // C
    q: `El ${NORMA} contiene una previsión sobre las costumbres del lugar. ¿Qué establece?`,
    a: 'Se respetarán las costumbres del lugar únicamente cuando así lo acuerde previamente la Consejería competente en materia de protocolo para cada acto oficial.',
    b: 'Se respetarán las costumbres del lugar cuando en los actos oficiales de carácter especial no exista un orden de prelación previamente aprobado por la autoridad organizadora.',
    c: 'Se respetarán las costumbres del lugar cuando en determinados actos oficiales existan puestos reservados según tradición inveterada a favor de determinadas autoridades.',
    d: 'Se respetarán las costumbres del lugar en todo caso, prevaleciendo sobre el orden de precedencias que con carácter general regula el presente Decreto para los actos generales.',
    cite: 'Se respetarán las costumbres del lugar cuando en determinados actos oficiales existan puestos reservados según tradición inveterada a favor de determinadas autoridades.',
    why: {
      A: 'el artículo no condiciona el respeto de las costumbres a un acuerdo previo de ninguna Consejería.',
      B: 'el precepto no se limita a los actos de carácter especial ni depende de que falte un orden de prelación aprobado.',
      D: 'no se establece una prevalencia general de la costumbre: opera solo ante puestos reservados por tradición inveterada.',
    },
  },
  {
    art: '13',
    correct: 3, // D
    q: `Según el ${NORMA}, ¿cuál es el tratamiento de los Rectores de Universidad?`,
    a: 'El tratamiento de los Rectores de Universidad será el de «Ilustrísimo Señor, Rector Magnífico».',
    b: 'El tratamiento de los Rectores de Universidad será el mismo que el tradicional de las Corporaciones Locales.',
    c: 'El tratamiento de los Rectores de Universidad será el de Señoría, salvo tradición reconocida en contrario.',
    d: 'El tratamiento de los Rectores de Universidad será el de «Excelentísimo Señor, Rector Magnífico».',
    cite: 'El tratamiento de los Rectores de Universidad será el de «Excelentísimo Señor, Rector Magnífico».',
    why: {
      A: 'rebaja el tratamiento a «Ilustrísimo»: el Decreto reserva a los Rectores el de «Excelentísimo Señor, Rector Magnífico».',
      B: 'el tratamiento tradicional se predica de las Corporaciones Locales, no de los Rectores de Universidad.',
      C: 'el tratamiento de Señoría corresponde al resto de los Alcaldes, no a los Rectores.',
    },
  },
  {
    art: '2',
    correct: 0, // A
    q: `El ${NORMA} establece dos rangos de ordenación en el régimen de precedencias. ¿Cómo define el rango colegiado?`,
    a: 'El colegiado, que regula la prelación entre las Instituciones, Organismos y Corporaciones cuando asistan como tales a actos oficiales.',
    b: 'El colegiado, que regula el orden singular de las autoridades y de los titulares de cargos públicos cuando asistan a actos oficiales.',
    c: 'El colegiado, que regula la prelación entre los miembros de cada Institución, Organismo o Corporación considerados individualmente.',
    d: 'El colegiado, que regula la prelación entre las Instituciones y Organismos del Estado cuando concurran con autoridades autonómicas.',
    cite: 'El colegiado, que regula la prelación entre las Instituciones, Organismos y Corporaciones cuando asistan como tales a actos oficiales.',
    why: {
      B: 'esa es la definición del rango PERSONAL, que regula el orden singular de autoridades y titulares de cargos públicos.',
      C: 'contradice el principio de que la precedencia colectiva no se extiende a los miembros en particular.',
      D: 'el rango colegiado no se limita a Instituciones y Organismos del Estado ni a su concurrencia con autoridades autonómicas.',
    },
  },
  {
    art: '5',
    correct: 2, // C
    q: `De conformidad con el ${NORMA}, ¿cómo se determina la prelación en los actos oficiales de carácter especial?`,
    a: 'La prelación de Autoridades, Instituciones y Corporaciones en los actos oficiales de carácter especial será la misma que la prevista para los actos de carácter general, sin excepción posible.',
    b: 'La prelación de Autoridades, Instituciones y Corporaciones en los actos oficiales de carácter especial será dispuesta por la Consejería competente en materia de protocolo, oída la autoridad organizadora.',
    c: 'La prelación de Autoridades, Instituciones y Corporaciones en los actos oficiales de carácter especial será dispuesta por la Autoridad que los organice, de acuerdo con el carácter especial de su naturaleza.',
    d: 'La prelación de Autoridades, Instituciones y Corporaciones en los actos oficiales de carácter especial será dispuesta por la autoridad de mayor rango asistente, atendiendo a la antigüedad de cada Corporación.',
    cite: 'La prelación de Autoridades, Instituciones y Corporaciones en los actos oficiales de carácter especial será dispuesta por la Autoridad que los organice, de acuerdo con el carácter especial de su naturaleza.',
    why: {
      A: 'precisamente por su naturaleza especial estos actos NO siguen el orden de los generales: la dispone la autoridad organizadora.',
      B: 'la competencia no se atribuye a ninguna Consejería de protocolo, sino a la Autoridad que organiza el acto.',
      D: 'no decide la autoridad de mayor rango asistente ni el criterio es la antigüedad de las Corporaciones.',
    },
  },
  {
    art: '9',
    correct: 1, // B
    q: `Según el ${NORMA}, ¿qué lugar ocupan los ex-Presidentes de la Junta de Andalucía cuando asisten a los actos oficiales?`,
    a: 'Se situarán a continuación del último miembro de la Mesa del Parlamento de Andalucía, ordenándose de acuerdo con la fecha de su cese y comenzando por la más reciente.',
    b: 'Se situarán a continuación del último miembro del Consejo de Gobierno ordenándose de acuerdo con la fecha de su cese comenzando por la más antigua.',
    c: 'Se situarán inmediatamente después del Presidente de la Junta de Andalucía en ejercicio, ordenándose entre sí por orden alfabético de sus apellidos.',
    d: 'Se situarán a continuación de los Diputados del Parlamento de Andalucía, ordenándose de acuerdo con la duración total de su mandato como Presidentes.',
    cite: 'Cuando a los actos oficiales asistan ex-Presidentes de la Junta de Andalucía se situarán a continuación del último miembro del Consejo de Gobierno ordenándose de acuerdo con la fecha de su cese comenzando por la más antigua.',
    why: {
      A: 'confunde el criterio: tras el último miembro de la Mesa se sitúan los ex-Presidentes del Parlamento, y además se comienza por la fecha de cese más antigua, no la más reciente.',
      C: 'no se sitúan inmediatamente después del Presidente en ejercicio ni se ordenan alfabéticamente.',
      D: 'no se colocan tras los Diputados ni el criterio de ordenación es la duración del mandato, sino la fecha de cese.',
    },
  },
];

const LETTER = ['A', 'B', 'C', 'D'];

function buildExplanation(q) {
  const L = LETTER[q.correct];
  let e = `> ${q.cite}\n>\n> — Artículo ${q.art} del Decreto 77/2002, de 26 de febrero, por el que se regula el régimen de precedencias y tratamientos en el ámbito de la Junta de Andalucía\n\n`;
  e += `**Por qué ${L} es correcta:** reproduce literalmente lo dispuesto en el artículo ${q.art} del Decreto 77/2002.\n\n`;
  e += `Por qué las demás son incorrectas:\n`;
  for (const k of LETTER) {
    if (k === L) continue;
    e += `- **${k}:** ${q.why[k]}\n`;
  }
  return e.trim();
}

(async () => {
  const law = (await sql`SELECT id FROM laws WHERE slug = ${LAW_SLUG}`)[0];
  const arts = await sql`SELECT id, article_number, content FROM articles WHERE law_id = ${law.id}`;
  const byNum = Object.fromEntries(arts.map(a => [a.article_number, a]));

  // normalización: colapsa espacios y minúsculas (una opción puede ser un fragmento
  // verbatim del artículo que solo difiere en la mayúscula inicial)
  const norm = s => s.replace(/\s+/g, ' ').trim().toLowerCase();

  // Guardrail 1: cada cita debe aparecer LITERALMENTE en el content del artículo enlazado
  let fail = 0;
  for (const q of QUESTIONS) {
    const art = byNum[q.art];
    if (!art) { console.error(`NO EXISTE art ${q.art}`); fail++; continue; }
    if (!norm(art.content).includes(norm(q.cite))) {
      console.error(`CITA NO LITERAL en art ${q.art}: ${q.cite.slice(0, 80)}`);
      fail++;
    }
    // la correcta debe coincidir con la cita o estar contenida en ella
    const opt = [q.a, q.b, q.c, q.d][q.correct];
    if (!norm(q.cite).includes(norm(opt)) && !norm(opt).includes(norm(q.cite))) {
      console.error(`OPCION CORRECTA != CITA en art ${q.art}`);
      fail++;
    }
  }

  // Guardrail 2: longitud de distractores ±30% de la correcta
  for (const [i, q] of QUESTIONS.entries()) {
    const opts = [q.a, q.b, q.c, q.d];
    const cl = opts[q.correct].length;
    opts.forEach((o, j) => {
      if (j === q.correct) return;
      const r = o.length / cl;
      if (r < 0.7 || r > 1.3) { console.error(`Q${i + 1} opcion ${LETTER[j]} longitud fuera de ±30% (ratio ${r.toFixed(2)})`); fail++; }
    });
  }

  // Guardrail 3: distribución 2/2/2/2
  const dist = [0, 0, 0, 0];
  QUESTIONS.forEach(q => dist[q.correct]++);
  console.log('Distribución A/B/C/D:', dist.join('/'));
  if (dist.some(d => d !== 2)) { console.error('Distribución no es 2/2/2/2'); fail++; }

  if (fail) { console.error(`\n${fail} fallos de validación — NO se inserta nada.`); await sql.end(); process.exit(1); }
  console.log('Validaciones OK. Insertando...\n');

  let n = 0;
  for (const q of QUESTIONS) {
    const art = byNum[q.art];
    const exp = buildExplanation(q);
    await sql`
      INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option, explanation,
                             primary_article_id, difficulty, lifecycle_state, topic_review_status, deactivation_reason, tags)
      VALUES (${q.q}, ${q.a}, ${q.b}, ${q.c}, ${q.d}, ${q.correct}, ${exp}, ${art.id},
              'medium', 'draft', 'pending', 'Pendiente de revisión post-generación IA', ${TAGS})`;
    n++;
    console.log(`  Q${n} (art ${q.art}, correcta ${LETTER[q.correct]}) insertada`);
  }
  console.log(`\n${n} preguntas draft insertadas.`);
  await sql.end();
})().catch(e => { console.error(e); process.exit(1); });
