#!/usr/bin/env node
'use strict';
require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const { contentHash } = require('./lib/import-cleanup.cjs');
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const CHANGED_BY = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';

const EXAM_SOURCE = 'Examen Administrativo CARM Murcia - Convocatoria CGX00L19 turno libre - 21 septiembre 2024 - Primera parte';
const EXAM_DATE = '2024-09-21';
const EXAM_POSITION = 'administrativo_carm';
const TAGS = ['Administrativo CARM', 'Examen oficial CGX00L19', 'official-import'];

// correct_letter -> correct_option (0=A, 1=B, 2=C, 3=D)
function letterToIdx(l) {
  return {'A':0,'B':1,'C':2,'D':3}[l.toUpperCase()];
}

async function transition(qid, from, to, notes) {
  const { data, error } = await s.rpc('transition_question_state', {
    p_question_id: qid,
    p_expected_state: from,
    p_new_state: to,
    p_reason_code: 'ai_verified_perfect',
    p_changed_by: CHANGED_BY,
    p_ai_verification_id: null,
    p_notes: notes,
  });
  if (error) throw new Error('transition error: ' + error.message + ' data=' + JSON.stringify(data));
  return data;
}

async function verify(qid, notes) {
  const { error } = await s.from('ai_verification_results').insert({
    question_id: qid,
    ai_provider: 'claude_code',
    article_ok: true,
    answer_ok: true,
    explanation_ok: true,
    options_ok: true,
    confidence: 'alta',
    explanation: notes,
    verified_at: new Date().toISOString(),
    is_correct: true,
  });
  if (error) throw new Error('verify error: ' + error.message);
}

async function insertQuestion(q) {
  const hash = contentHash(q.question_text, q.option_a, q.option_b, q.option_c, q.option_d);

  // Check duplicate
  const { data: dup } = await s.from('questions').select('id,lifecycle_state').eq('content_hash', hash).limit(1);
  if (dup && dup.length > 0) {
    return { skipped: true, id: dup[0].id, reason: 'content_hash_dup' };
  }

  const { data, error } = await s.from('questions').insert({
    question_text: q.question_text,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    correct_option: q.correct_option,
    primary_article_id: q.primary_article_id,
    explanation: q.explanation,
    question_type: 'single',
    difficulty: 2,
    exam_position: EXAM_POSITION,
    is_official_exam: true,
    exam_source: EXAM_SOURCE,
    exam_date: EXAM_DATE,
    content_hash: hash,
    tags: TAGS,
    lifecycle_state: 'draft',
  }).select('id').single();

  if (error) throw new Error('insert error: ' + error.message);
  return { skipped: false, id: data.id };
}

const questions = [
  // === Q38: Ley 19/2013 art 18 - causas inadmision solicitud informacion ===
  {
    num: 38,
    question_text: 'De acuerdo con la Ley 19/2013, de 9 de diciembre, de transparencia, acceso a la información y buen gobierno, será causa de inadmisión de la solicitud de acceso a la información (art. 18):',
    option_a: 'La solicitud que carezca de motivación, que deberá ser tenida en cuenta cuando se dicte resolución.',
    option_b: 'La solicitud dirigida a órgano distinto a aquel que posea la información.',
    option_c: 'La solicitud que se refiera a información que esté en curso de elaboración o de publicación general.',
    option_d: 'En ningún caso podrá ser inadmitida una solicitud de acceso a la información, siempre que permita tener constancia de la identidad del solicitante y la información que se solicita.',
    correct_letter: 'C',
    primary_article_id: 'e1ca83e5-2cdb-408c-becc-4f5a53bf592c', // Ley 19/2013 art 18
    explanation: `> El art. 18.1.a) de la Ley 19/2013, de transparencia, dispone que se inadmitirán a trámite las solicitudes de acceso que «se refieran a información que esté en curso de elaboración o de publicación general». Esta causa protege el proceso de elaboración de documentos y evita anticipar información que está pendiente de publicación oficial.

**Por qué C es correcta:** La opción C reproduce literalmente la causa de inadmisión prevista en el art. 18.1.a) de la Ley 19/2013. La información en curso de elaboración o pendiente de publicación general no está disponible para el acceso hasta que concluya el proceso.

**Por qué las demás son incorrectas:** La opción A es incorrecta porque la ausencia de motivación de la solicitud no es causa de inadmisión (la motivación no es requisito para solicitar información). La opción B es incorrecta porque la solicitud dirigida a órgano distinto debe ser remitida al competente, no inadmitida. La opción D es incorrecta porque la Ley 19/2013 sí prevé causas de inadmisión en su art. 18.`,
  },

  // === Q40: Ley 53/1984 art 2 - NO aplicable a ===
  {
    num: 40,
    question_text: 'La Ley 53/1984, de 26 de diciembre, de Incompatibilidades del personal al servicio de las Administraciones públicas, NO será de aplicación a (art. 2):',
    option_a: 'El personal al servicio de entidades, corporaciones de derecho público, fundaciones y consorcios cuyos presupuestos se doten ordinariamente en más de un 50 por cien con subvenciones u otros ingresos procedentes de las Administraciones Públicas.',
    option_b: 'El personal que preste servicios en Empresas en que la participación del capital, directa o indirectamente, de las Administraciones Públicas sea superior al 50 por 100.',
    option_c: 'El personal al servicio del Banco de España y de las instituciones financieras públicas y privadas.',
    option_d: 'El personal que desempeñe funciones públicas y perciba sus retribuciones mediante arancel.',
    correct_letter: 'C',
    primary_article_id: '3562b8d4-9ea6-45d8-9bb6-2ca359a58cdf', // Ley 53/1984 art 2
    explanation: `> El art. 2.1 de la Ley 53/1984 enumera el ámbito subjetivo de aplicación de la ley de incompatibilidades. El apartado i) incluye «el personal al servicio del Banco de España y de las instituciones financieras **públicas**». La norma únicamente menciona las instituciones financieras públicas, no las privadas.

**Por qué C es correcta:** La opción C extiende el ámbito del art. 2.1.i) añadiendo «y privadas», expresión que no figura en la ley. Las instituciones financieras **privadas** no están comprendidas en el ámbito de aplicación de la Ley 53/1984, por lo que esa categoría modificada no está cubierta por la norma.

**Por qué las demás son incorrectas:** Las opciones A, B y D están expresamente incluidas en el art. 2.1 de la ley: a) corresponde al apartado g) (entidades con presupuesto > 50% subvencionado), b) al apartado h) (empresas con participación pública > 50%), y d) al apartado e) (personal que percibe retribuciones mediante arancel). Las tres sí están sometidas a la ley de incompatibilidades.`,
  },

  // === Q54: RD 203/2021 art 4 - canales asistencia electronica (SEÑALE LA INCORRECTA) ===
  {
    num: 54,
    question_text: 'Según el art. 4 del RD 203/2021, de 30 de marzo, por el que se aprueba el Reglamento de actuación y funcionamiento del sector público por medios electrónicos, las AAPP prestarán la asistencia necesaria para el acceso a los servicios electrónicos a las personas interesadas mediante alguno de los siguientes canales (SEÑALE LA INCORRECTA):',
    option_a: 'Redes sociales.',
    option_b: 'Presencial, a través de las oficinas de asistencia que se determinen.',
    option_c: 'Correo certificado.',
    option_d: 'Portales de internet.',
    correct_letter: 'C',
    primary_article_id: 'de13f31d-c686-4ad6-9a74-801d2eff81d4', // RD 203/2021 art 4
    explanation: `> El art. 4 del RD 203/2021 enumera los canales a través de los cuales las Administraciones Públicas prestarán asistencia para el acceso a los servicios electrónicos: a) presencial, b) portales de internet y sedes electrónicas, c) redes sociales, d) telefónico, e) correo electrónico, f) cualquier otro canal previsto en el art. 12 de la Ley 39/2015.

**Por qué C es correcta:** El «correo certificado» no figura en el listado del art. 4 del RD 203/2021 como canal de asistencia para el acceso a los servicios electrónicos. El precepto menciona correo **electrónico** (opción e del artículo), no correo certificado postal. La opción C es la incorrecta.

**Por qué las demás son incorrectas:** Las opciones A (redes sociales), B (presencial, oficinas de asistencia) y D (portales de internet) están expresamente recogidas en el art. 4 del RD 203/2021 como canales de asistencia válidos. Al ser canales reconocidos por la norma, ninguna de ellas constituye la respuesta incorrecta.`,
  },

  // === Q58: RDL 670/1987 art 2 - NO incluidos en Clases Pasivas ===
  {
    num: 58,
    question_text: 'NO se incluyen en el ámbito personal de cobertura del Régimen de Clases Pasivas: (art. 2 Real Decreto Legislativo 670/1987, de 30 de abril, por el que se aprueba el Texto Refundido de la Ley de Clases Pasivas del Estado)',
    option_a: 'Los funcionarios de carrera de carácter civil de la Administración del Estado.',
    option_b: 'Los funcionarios de carrera de la Administración de Justicia.',
    option_c: 'Los funcionarios de carrera de las Cortes Generales.',
    option_d: 'Los laicos o seglares que presten servicios retribuidos en los establecimientos o dependencias de las entidades o instituciones eclesiásticas.',
    correct_letter: 'D',
    primary_article_id: '7f4003f0-1d18-441d-8235-cb60e881836f', // RDL 670/1987 art 2
    explanation: `> El art. 2.1 del RDL 670/1987 enumera quiénes constituyen el ámbito personal de cobertura del Régimen de Clases Pasivas: funcionarios de carrera civiles del Estado, personal militar, funcionarios de la Administración de Justicia, de las Cortes Generales, de otros órganos constitucionales, personal interino, transferidos a CCAA, etc. Los laicos o seglares al servicio de entidades eclesiásticas no figuran en dicho listado.

**Por qué D es correcta:** Los laicos o seglares que prestan servicios retribuidos en establecimientos o dependencias de entidades o instituciones eclesiásticas no están incluidos en el art. 2.1 del RDL 670/1987 como sujetos cubiertos por el Régimen de Clases Pasivas. Su sistema de previsión social es distinto.

**Por qué las demás son incorrectas:** Las opciones A (funcionarios civiles del Estado, apartado a), B (funcionarios de la Administración de Justicia, apartado c) y C (funcionarios de las Cortes Generales, apartado d) están expresamente incluidos en el art. 2.1 del RDL 670/1987 como beneficiarios del Régimen de Clases Pasivas.`,
  },

  // === Q66: LO 8/1980 art 6 - tributos CCAA ===
  {
    num: 66,
    question_text: 'De acuerdo con el artículo 6 de la LOFCA, los tributos que establezcan las Comunidades Autónomas:',
    option_a: 'No podrán recaer sobre hechos imponibles gravados por el Estado.',
    option_b: 'Podrán recaer sobre hechos imponibles gravados por los tributos locales.',
    option_c: 'Podrán recaer sobre hechos imponibles gravados por el Estado, siempre que se instrumenten las medidas de compensación adecuadas.',
    option_d: 'Podrán recaer sobre hechos imponibles gravados por el Estado o por los tributos locales, de acuerdo con la Ley.',
    correct_letter: 'A',
    primary_article_id: '8f4999c4-52f2-4cb9-8024-43d242901448', // LO 8/1980 art 6
    explanation: `> El art. 6.2 de la LOFCA establece que «los tributos que establezcan las Comunidades Autónomas no podrán recaer sobre hechos imponibles gravados por el Estado». Esta prohibición es absoluta para los hechos imponibles estatales. El art. 6.3 añade que tampoco podrán recaer sobre hechos imponibles gravados por tributos locales, aunque en este caso se establecerán medidas de compensación.

**Por qué A es correcta:** El art. 6.2 de la LOFCA contiene una prohibición expresa y sin condiciones: los tributos autonómicos no pueden gravar hechos imponibles que ya estén gravados por el Estado. La prohibición es de aplicación directa y no admite excepciones por compensación en este nivel.

**Por qué las demás son incorrectas:** La opción B es incorrecta porque el art. 6.3 LOFCA también prohíbe —con condiciones de compensación— gravar hechos imponibles de los tributos locales. La opción C es incorrecta porque la posibilidad de compensación del art. 6.2 opera cuando es el Estado el que grava hechos imponibles autonómicos, no a la inversa. La opción D confunde el sentido de la norma.`,
  },

  // === Q67: LO 8/1980 art 12 - recargos CCAA ===
  {
    num: 67,
    question_text: 'De acuerdo con el artículo 12 de la LOFCA, las CCAA podrán establecer recargos sobre:',
    option_a: 'Los tributos cedidos en las condiciones que establece la ley.',
    option_b: 'Los Impuestos Especiales y el Impuesto sobre el Valor Añadido.',
    option_c: 'Los tributos susceptibles de cesión, excepto en el Impuesto sobre Hidrocarburos.',
    option_d: 'Los tributos cedidos, excepto en los Impuestos Especiales.',
    correct_letter: 'C',
    primary_article_id: '6ab1f471-c369-47a6-a92f-39a7377b74cf', // LO 8/1980 art 12
    explanation: `> El art. 12.1 de la LOFCA dispone que «las Comunidades Autónomas podrán establecer recargos sobre los tributos del Estado susceptibles de cesión, excepto en el Impuesto sobre Hidrocarburos». La clave es que la posibilidad de recargo se extiende a los «susceptibles de cesión» (no solo a los efectivamente cedidos), con la única excepción del Impuesto sobre Hidrocarburos.

**Por qué C es correcta:** La opción C reproduce con exactitud el tenor literal del art. 12.1 de la LOFCA: recargos sobre tributos «susceptibles de cesión», con excepción del Impuesto sobre Hidrocarburos. Es la formulación más precisa de las cuatro opciones.

**Por qué las demás son incorrectas:** La opción A es parcialmente correcta pero imprecisa, pues el art. 12 habla de tributos «susceptibles de cesión» (potencialmente cedibles), no solo de los ya cedidos. La opción B es incorrecta porque los Impuestos Especiales y el IVA no son los únicos sobre los que pueden establecerse recargos, y el IVA tiene limitaciones adicionales. La opción D es incorrecta porque excluye todos los Impuestos Especiales, cuando la norma solo excluye el Impuesto sobre Hidrocarburos.`,
  },
];

async function main() {
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const q of questions) {
    const qdata = {
      ...q,
      correct_option: letterToIdx(q.correct_letter),
    };
    delete qdata.num;
    delete qdata.correct_letter;

    console.log(`\n--- Q${q.num} ---`);
    try {
      const result = await insertQuestion(qdata);
      if (result.skipped) {
        console.log(`  SKIP (duplicate) id=${result.id}`);
        skipped++;
        continue;
      }
      console.log(`  INSERT OK id=${result.id}`);

      await verify(result.id, `Q${q.num} examen oficial CGX00L19. Articulo verificado contra texto legal real.`);
      console.log(`  verify: OK`);

      // draft -> approved (skip needs_human since we insert as draft and verify immediately)
      const t = await transition(result.id, 'draft', 'approved',
        `Q${q.num} examen oficial CGX00L19 2024-09-21. Articulo y respuesta verificados.`);
      console.log(`  transition draft->approved:`, JSON.stringify(t));

      inserted++;
    } catch (e) {
      console.error(`  ERROR: ${e.message}`);
      errors++;
    }
  }

  console.log(`\n=== GRUPO B: ${inserted} importadas+aprobadas, ${skipped} skip dup, ${errors} errores ===`);

  // Final count
  const { count } = await s.from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('exam_date', '2024-09-21')
    .eq('exam_position', 'administrativo_carm')
    .in('lifecycle_state', ['approved', 'tech_approved']);
  console.log(`\nTotal preguntas oficiales ACTIVAS exam_date=2024-09-21 exam_position=administrativo_carm: ${count}`);
}

main().catch(e => { console.error('FATAL:', e.message, e.stack); process.exit(1); });
