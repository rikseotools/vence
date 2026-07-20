#!/usr/bin/env node
/**
 * Lote piloto T11 — Reglamento del Parlamento de Andalucía, arts 138-145
 * (investidura, moción de censura, cuestión de confianza). 12 preguntas.
 * Importa en `draft` (invisible por construcción). tags: ia_generada + batch_id.
 * Reglas: cita literal (§2.2), distractores balanceados (§2.2-bis),
 * posición uniforme A×3/B×3/C×3/D×3 secuencia no monótona (§2.2-ter),
 * autocontenida — desarrolla siglas (§2.2-quater).
 */
'use strict';
require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: { rejectUnauthorized: false } });

const BATCH = 'gen_reglamento_parl_and_2026-07-20';
const ART = {
  138: '8ccefa5b-8291-4240-bb01-c632f8b2d6dd',
  140: '58241c99-eeea-4001-8d0c-4583ce939682',
  141: '97e0c664-d3ae-4df1-8d04-a1cd9dbb1d23',
  142: '28ef5e20-5092-4d30-a760-8ce286a1b6f5',
  143: 'd15486a0-2e05-4c6e-b55a-69cf2d6c66cf',
  144: 'afc2e509-20ef-48f6-9828-03f24bb28671',
  145: 'e1ee0f3a-e6d6-451b-a7e8-e79705e6858c',
};

// correct_option: 0=A 1=B 2=C 3=D
const Q = [
  { art: 138, correct: 2,
    q: 'Según el Reglamento del Parlamento de Andalucía, el Presidente o Presidenta del Parlamento, previa consulta a los Portavoces, propondrá un candidato a la Presidencia de la Junta de Andalucía. ¿En qué plazo máximo debe formularse la propuesta?',
    a: 'Como máximo, dentro del plazo de treinta días desde la constitución del Parlamento o desde el cese del Consejo de Gobierno.',
    b: 'Como máximo, dentro del plazo de quince días desde la celebración de las elecciones o desde la aprobación de una moción de censura.',
    c: 'Como máximo, dentro del plazo de quince días desde la constitución del Parlamento o desde la dimisión del Presidente o Presidenta.',
    d: 'Como máximo, dentro del plazo de veinte días desde la primera sesión plenaria o desde la disolución del Parlamento.',
    exp: '> "La propuesta deberá formularse, como máximo, dentro del plazo de quince días desde la constitución del Parlamento o desde la dimisión del Presidente o Presidenta." (art. 138.1 del Reglamento del Parlamento de Andalucía)\n\n**Por qué C es correcta:** reproduce literalmente el plazo (quince días) y sus dos anclajes (constitución del Parlamento o dimisión del Presidente).\n\n- **A)** altera el plazo (treinta días) y el anclaje (cese del Consejo de Gobierno).\n- **B)** cambia los anclajes por la celebración de las elecciones o la aprobación de una moción de censura, que el artículo no menciona.\n- **D)** altera el plazo (veinte días) y los anclajes (primera sesión plenaria o disolución).' },

  { art: 138, correct: 0,
    q: 'En la sesión de investidura del Presidente de la Junta de Andalucía, ¿qué mayoría exige el Reglamento del Parlamento de Andalucía en la primera votación?',
    a: 'En primera votación deberá obtener mayoría absoluta; de no obtenerla, se procederá a nueva votación cuarenta y ocho horas después, y la confianza se entenderá otorgada por mayoría simple.',
    b: 'En primera votación deberá obtener mayoría simple; de no obtenerla, se procederá a nueva votación veinticuatro horas después, y la confianza se entenderá otorgada por mayoría absoluta.',
    c: 'En primera votación deberá obtener mayoría de dos tercios; de no obtenerla, se procederá a nueva votación cuarenta y ocho horas después, exigiéndose entonces mayoría absoluta.',
    d: 'En primera votación deberá obtener mayoría absoluta; de no obtenerla, se procederá a nueva votación setenta y dos horas después, y la confianza se entenderá otorgada por mayoría simple.',
    exp: '> "Para su elección, el candidato o candidata deberá en primera votación obtener mayoría absoluta. De no obtenerla, se procederá a nueva votación cuarenta y ocho horas después de la anterior, y la confianza se entenderá otorgada si obtuviera mayoría simple en la segunda o sucesivas votaciones." (art. 138.7 del Reglamento del Parlamento de Andalucía)\n\n**Por qué A es correcta:** mantiene los tres datos literales: mayoría absoluta en primera votación, nueva votación a las cuarenta y ocho horas y mayoría simple después.\n\n- **B)** invierte las mayorías (simple primero, absoluta después) y cambia el plazo a veinticuatro horas.\n- **C)** exige dos tercios y luego mayoría absoluta, ninguna de las dos previstas.\n- **D)** altera el plazo de la nueva votación (setenta y dos horas).' },

  { art: 138, correct: 3,
    q: 'Conforme al artículo 138 del Reglamento del Parlamento de Andalucía, si transcurrido el plazo de dos meses desde la primera votación ninguna candidatura hubiera obtenido la mayoría simple, ¿quién queda designado Presidente de la Junta de Andalucía?',
    a: 'El candidato o candidata que hubiera obtenido mayor número de votos en la última votación celebrada.',
    b: 'El candidato o candidata propuesto en primer lugar por el Presidente o Presidenta del Parlamento.',
    c: 'Ninguno: el Parlamento queda disuelto automáticamente y se convocan nuevas elecciones autonómicas.',
    d: 'El candidato o candidata del partido que tenga mayor número de escaños en la Cámara.',
    exp: '> "Si, transcurrido el plazo de dos meses a partir de la primera votación, ninguna candidatura hubiera obtenido la mayoría simple, quedará designado Presidente o Presidenta de la Junta de Andalucía el candidato o candidata del partido que tenga mayor número de escaños." (art. 138.7 del Reglamento del Parlamento de Andalucía)\n\n**Por qué D es correcta:** el criterio legal de cierre es el partido con mayor número de escaños, no los votos ni el orden de propuesta.\n\n- **A)** atiende a los votos de la última votación, criterio que el artículo no usa.\n- **B)** se fija en el orden de propuesta, irrelevante para la designación automática.\n- **C)** introduce una disolución automática que el precepto no contempla.' },

  { art: 138, correct: 1,
    q: 'En la sesión de investidura regulada en el Reglamento del Parlamento de Andalucía, ¿cómo expone el candidato propuesto el programa político del Gobierno que pretende formar?',
    a: 'Por tiempo máximo de treinta minutos, y solicitará después la confianza de la Cámara.',
    b: 'Sin limitación de tiempo, y solicitará la confianza de la Cámara.',
    c: 'Sin limitación de tiempo, pero no podrá solicitar la confianza hasta el día siguiente.',
    d: 'Por tiempo máximo de sesenta minutos, tras la intervención de los Grupos parlamentarios.',
    exp: '> "El candidato o candidata propuesto expondrá, sin limitación de tiempo, el programa político del Gobierno que pretende formar y solicitará la confianza de la Cámara." (art. 138.3 del Reglamento del Parlamento de Andalucía)\n\n**Por qué B es correcta:** la exposición es sin limitación de tiempo y en ese mismo acto solicita la confianza.\n\n- **A)** impone un límite de treinta minutos que el artículo no fija.\n- **C)** añade un aplazamiento de la solicitud de confianza al día siguiente que no existe.\n- **D)** inventa un límite de sesenta minutos y altera el orden de las intervenciones.' },

  { art: 140, correct: 3,
    q: 'Según el Reglamento del Parlamento de Andalucía, ¿por qué proporción de miembros de la Cámara debe proponerse, al menos, una moción de censura, y qué requisito de contenido tiene?',
    a: 'Al menos por una quinta parte de los miembros de la Cámara, en escrito motivado dirigido a la Mesa, incluyendo un candidato a la Presidencia que haya aceptado la candidatura.',
    b: 'Al menos por una cuarta parte de los miembros de la Cámara, en escrito dirigido a la Junta de Portavoces, sin necesidad de incluir candidato alguno a la Presidencia.',
    c: 'Al menos por la mayoría absoluta de los miembros de la Cámara, en escrito motivado dirigido a la Mesa, incluyendo un candidato a la Presidencia que haya aceptado la candidatura.',
    d: 'Al menos por una cuarta parte de los miembros de la Cámara, en escrito motivado dirigido a la Mesa, incluyendo un candidato a la Presidencia que haya aceptado la candidatura.',
    exp: '> "La moción deberá ser propuesta, al menos, por una cuarta parte de los miembros de la Cámara en escrito motivado dirigido a la Mesa del Parlamento, y habrá de incluir un candidato o candidata a la Presidencia de la Junta que haya aceptado la candidatura." (art. 140.1 del Reglamento del Parlamento de Andalucía)\n\n**Por qué D es correcta:** recoge los tres requisitos: una cuarta parte de la Cámara, escrito motivado a la Mesa y candidato que haya aceptado.\n\n- **A)** rebaja la proporción a una quinta parte.\n- **B)** dirige el escrito a la Junta de Portavoces y suprime el candidato.\n- **C)** exige mayoría absoluta para proponerla, no una cuarta parte.' },

  { art: 140, correct: 0,
    q: 'Presentada una moción de censura en el Parlamento de Andalucía, ¿en qué plazo pueden presentarse mociones alternativas conforme a su Reglamento?',
    a: 'Dentro de los dos días siguientes a la presentación de la moción de censura.',
    b: 'Dentro de los cinco días siguientes a la presentación de la moción de censura.',
    c: 'Dentro de los dos días siguientes a la admisión a trámite de la moción de censura.',
    d: 'Dentro de las cuarenta y ocho horas siguientes a la votación de la moción de censura.',
    exp: '> "Dentro de los dos días siguientes a la presentación de la moción de censura podrán presentarse mociones alternativas, que deberán reunir los requisitos señalados en el apartado 1 de este artículo." (art. 140.3 del Reglamento del Parlamento de Andalucía)\n\n**Por qué A es correcta:** el plazo son dos días y se computa desde la presentación de la moción.\n\n- **B)** amplía el plazo a cinco días.\n- **C)** cambia el día inicial del cómputo (admisión a trámite en lugar de presentación).\n- **D)** ancla el plazo en la votación, no en la presentación, y lo expresa en horas.' },

  { art: 141, correct: 1,
    q: 'Conforme al Reglamento del Parlamento de Andalucía, la aprobación de una moción de censura requiere, en todo caso:',
    a: 'El voto favorable de la mayoría simple de los miembros del Parlamento presentes.',
    b: 'El voto favorable de la mayoría absoluta de los miembros del Parlamento.',
    c: 'El voto favorable de las tres quintas partes de los miembros del Parlamento.',
    d: 'El voto favorable de una cuarta parte de los miembros del Parlamento firmantes.',
    exp: '> "La aprobación de una moción de censura requerirá, en todo caso, el voto favorable de la mayoría absoluta de los miembros del Parlamento." (art. 141.5 del Reglamento del Parlamento de Andalucía)\n\n**Por qué B es correcta:** la mayoría exigida para aprobarla es la absoluta de los miembros del Parlamento.\n\n- **A)** rebaja a mayoría simple y de los presentes.\n- **C)** exige tres quintos, mayoría no prevista.\n- **D)** confunde la mayoría de aprobación con la cuarta parte necesaria para proponerla.' },

  { art: 141, correct: 2,
    q: 'Según el Reglamento del Parlamento de Andalucía, la votación de una moción de censura no podrá ser anterior a:',
    a: 'El transcurso de dos días desde la presentación de la primera en el Registro General.',
    b: 'El transcurso de cinco días desde la admisión a trámite por la Mesa del Parlamento.',
    c: 'El transcurso de cinco días desde la presentación de la primera en el Registro General.',
    d: 'El transcurso de veinticuatro horas desde la presentación en el Registro General.',
    exp: '> "La moción o mociones de censura serán sometidas a votación a la hora que previamente haya sido anunciada por la Presidencia, que no podrá ser anterior al transcurso de cinco días desde la presentación de la primera en el Registro General." (art. 141.4 del Reglamento del Parlamento de Andalucía)\n\n**Por qué C es correcta:** son cinco días computados desde la presentación de la primera moción en el Registro General.\n\n- **A)** reduce el plazo a dos días.\n- **B)** cambia el día inicial (admisión a trámite) en lugar de la presentación en el Registro General.\n- **D)** expresa el plazo en veinticuatro horas.' },

  { art: 142, correct: 0,
    q: 'De acuerdo con el Reglamento del Parlamento de Andalucía, aprobada una moción de censura, el candidato o candidata incluido en la misma:',
    a: 'Se entenderá investido de la confianza de la Cámara.',
    b: 'Deberá someterse a una votación de investidura en el plazo de quince días.',
    c: 'Será propuesto al Rey para su nombramiento previa nueva votación del Pleno.',
    d: 'Se entenderá investido solo si obtiene además la mayoría simple en una segunda votación.',
    exp: '> "Aprobada una moción de censura, el candidato o candidata incluido en la misma se entenderá investido de la confianza de la Cámara." (art. 142 del Reglamento del Parlamento de Andalucía)\n\n**Por qué A es correcta:** la aprobación de la moción implica, sin más trámite, la investidura de la confianza de la Cámara.\n\n- **B)** exige una votación de investidura posterior que no procede.\n- **C)** añade una nueva votación del Pleno antes del nombramiento.\n- **D)** condiciona la investidura a una segunda votación inexistente.' },

  { art: 143, correct: 2,
    q: 'Según el Reglamento del Parlamento de Andalucía, los signatarios de una moción de censura rechazada:',
    a: 'No podrán firmar otra durante la misma legislatura del Parlamento.',
    b: 'No podrán firmar otra hasta transcurrido el plazo de un año natural.',
    c: 'No podrán firmar otra durante el mismo período de sesiones.',
    d: 'Podrán firmar otra siempre que incluya un candidato distinto al anterior.',
    exp: '> "Ninguno de los signatarios de una moción de censura rechazada podrá firmar otra durante el mismo período de sesiones." (art. 143 del Reglamento del Parlamento de Andalucía)\n\n**Por qué C es correcta:** la limitación se ciñe al mismo período de sesiones.\n\n- **A)** extiende la prohibición a toda la legislatura.\n- **B)** fija un plazo de un año natural que el artículo no establece.\n- **D)** admite firmar otra cambiando de candidato, excepción que no existe.' },

  { art: 144, correct: 1,
    q: 'Conforme al Reglamento del Parlamento de Andalucía, el Presidente de la Junta, previa deliberación del Consejo de Gobierno, puede plantear ante el Parlamento la cuestión de confianza sobre:',
    a: 'Un proyecto de ley en tramitación o sobre una declaración de política general.',
    b: 'Su programa o sobre una declaración de política general.',
    c: 'Su programa o sobre la aprobación de los presupuestos de la Comunidad Autónoma.',
    d: 'Una decisión del Consejo de Gobierno o sobre un asunto de especial interés general.',
    exp: '> "El Presidente o Presidenta de la Junta, previa deliberación del Consejo de Gobierno, puede plantear ante el Parlamento la cuestión de confianza sobre su programa o sobre una declaración de política general." (art. 144.1 del Reglamento del Parlamento de Andalucía)\n\n**Por qué B es correcta:** el objeto de la cuestión de confianza es el programa o una declaración de política general.\n\n- **A)** sustituye el programa por un proyecto de ley.\n- **C)** cambia la declaración de política general por los presupuestos.\n- **D)** desplaza el objeto a una decisión del Consejo o a un asunto de interés general.' },

  { art: 145, correct: 3,
    q: 'En la cuestión de confianza regulada en el Reglamento del Parlamento de Andalucía, ¿con qué mayoría se entiende otorgada y cuándo puede votarse?',
    a: 'Por mayoría absoluta de los Diputados, y no podrá votarse hasta que transcurran veinticuatro horas desde su presentación.',
    b: 'Por mayoría simple de los Diputados, y no podrá votarse hasta que transcurran cuarenta y ocho horas desde su presentación.',
    c: 'Por mayoría de tres quintos de los Diputados, y podrá votarse en la misma sesión de su presentación.',
    d: 'Por mayoría simple de los Diputados, y no podrá votarse hasta que transcurran veinticuatro horas desde su presentación.',
    exp: '> "La cuestión de confianza no podrá ser votada hasta que transcurran veinticuatro horas desde su presentación. La confianza se entenderá otorgada cuando obtenga el voto favorable de la mayoría simple de los Diputados." (art. 145.2 y 145.3 del Reglamento del Parlamento de Andalucía)\n\n**Por qué D es correcta:** combina los dos datos literales: mayoría simple para otorgarla y veinticuatro horas de espera para votarla.\n\n- **A)** eleva la mayoría a absoluta.\n- **B)** altera la espera a cuarenta y ocho horas.\n- **C)** exige tres quintos y permite votar en la misma sesión.' },
];

(async () => {
  // check distribución
  const dist = [0, 0, 0, 0];
  Q.forEach(q => dist[q.correct]++);
  console.log('Distribución correct_option (A,B,C,D):', dist.join(','), '· total', Q.length);
  console.log('Secuencia:', Q.map(q => 'ABCD'[q.correct]).join(''));

  let inserted = 0;
  for (const item of Q) {
    const artId = ART[item.art];
    if (!artId) { console.error('Sin artId para art', item.art); continue; }
    await sql`
      INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option, explanation, primary_article_id, difficulty, lifecycle_state, topic_review_status, deactivation_reason, tags)
      VALUES (${item.q}, ${item.a}, ${item.b}, ${item.c}, ${item.d}, ${item.correct}, ${item.exp}, ${artId}, 'medium', 'draft', 'pending', 'Pendiente de revisión post-generación IA', ${['ia_generada', BATCH]})`;
    inserted++;
  }
  console.log('Insertadas (draft):', inserted, '· batch', BATCH);
  await sql.end();
})().catch(e => { console.error(e); process.exit(1); });
