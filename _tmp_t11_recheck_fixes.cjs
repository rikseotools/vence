require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const now = new Date().toISOString();
  const fixes = [
    {
      id: '2caf58f0-9c61-4608-81ce-f1688a7c14de',
      explanation: 'Según el art. 49 de la Ley 2/2015, la selección del personal se realizará con arreglo a los siguientes principios: a) Igualdad (opción A), b) Mérito y capacidad (opción B), c) Publicidad de las convocatorias y sus bases (opción C), y g) Adecuación entre el contenido de los procesos selectivos y las FUNCIONES O TAREAS a desarrollar. La opción D altera el texto diciendo "pruebas a desarrollar" en lugar de "funciones o tareas", por lo que NO coincide literalmente con el artículo y es la respuesta correcta.',
    },
    {
      id: '31bf6770-6fc6-4334-b0f0-2bed2bab22ee',
      explanation: 'Según el art. 52.1 de la Ley 2/2015, pueden acceder al empleo público como personal funcionario en igualdad de condiciones con los españoles: a) las personas que posean la nacionalidad de otros estados miembros de la UE (opción A); b) los cónyuges de españoles o de nacionales de otros estados UE, siempre que no estén separados de derecho (opción B); d) las personas incluidas en el ámbito de aplicación de tratados internacionales ratificados por España sobre libre circulación de trabajadores (opción C). Las tres son correctas, por lo que la respuesta es la D.',
    },
    {
      id: '384b8786-9f1a-4e8a-a3bd-982dc3ebc786',
      explanation: 'Según el art. 49 de la Ley 2/2015, los principios generales para la selección del personal son: a) Igualdad, b) Mérito y capacidad, c) Publicidad (opción D), d) Transparencia y objetividad (opción A), e) Imparcialidad y profesionalidad, f) Independencia y discrecionalidad técnica, g) Adecuación del contenido a las funciones o tareas, y h) Agilidad. La opción C ("Privacidad y coordinación") no contiene ningún término presente en el artículo, por lo que es la respuesta correcta.',
    },
    {
      id: 'a60e6749-6c12-4a16-894c-a5f52c3a47a3',
      explanation: 'Según el art. 184.2 de la Ley 2/2015, la potestad disciplinaria se ejercerá de acuerdo con los principios de legalidad (opción A), responsabilidad (opción B), tipicidad, proporcionalidad, culpabilidad y presunción de inocencia (opción D), entre otros. El principio de PUBLICIDAD (opción C) no figura entre los principios enumerados en el art. 184.2, por lo que es la respuesta correcta.',
    },
    {
      id: 'bb1b6f64-6d9d-48f6-a305-735f705578fb',
      explanation: 'Según el art. 108.2 de la Ley 2/2015, en caso de fallecimiento del cónyuge, pareja de hecho o familiar dentro del primer grado de consanguinidad o afinidad, el personal funcionario tendrá derecho a un permiso de tres días hábiles cuando el suceso se produzca en la misma localidad (y cinco días si es en localidad distinta). La respuesta correcta es la A. Nota: el art. 108.1 regula por separado los supuestos de accidente o enfermedad grave con otra duración; la pregunta se resuelve por el apartado 2 al incluir el supuesto de fallecimiento.',
    },
  ];

  for (const f of fixes) {
    const { id, ...upd } = f;
    upd.topic_review_status = 'perfect';
    upd.verification_status = 'ok';
    upd.verified_at = now;
    upd.is_active = true;
    upd.deactivation_reason = null;
    const { error } = await supabase.from('questions').update(upd).eq('id', id);
    if (error) console.error('❌', id, error.message);
    else console.log('✅', id);
  }

  // f864045a: not processed by agents but inspection confirms it's correct (art 75.c promoción interna vertical)
  await supabase.from('questions').update({
    topic_review_status: 'perfect', verification_status: 'ok', verified_at: now,
    is_active: true, deactivation_reason: null,
  }).eq('id', 'f864045a-951f-4cf8-8600-7759d18dbafa');
  console.log('✅ f864045a (manual review)');

  const ids = JSON.parse(fs.readFileSync('t11_galicia_imported_ids.json'));
  const { data } = await supabase.from('questions').select('is_active, topic_review_status').in('id', ids);
  const active = data.filter(q => q.is_active).length;
  const perfect = data.filter(q => q.topic_review_status === 'perfect').length;
  console.log('\nT11 final: ' + active + '/' + ids.length + ' activas, ' + perfect + ' perfect');
})();
