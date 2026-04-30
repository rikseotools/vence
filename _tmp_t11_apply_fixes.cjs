require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: law } = await supabase.from('laws').select('id').eq('short_name', 'Ley 2/2015 Galicia').single();
  const { data: art68 } = await supabase.from('articles').select('id').eq('law_id', law.id).eq('article_number', '68').single();
  const ART_68 = art68.id;

  const now = new Date().toISOString();

  const fixes = [
    // #1 13478ef0 art 167 Servicios Especiales
    {
      id: '13478ef0-f034-446f-8658-da15fc309eb0',
      explanation: 'Según el art. 167 de la Ley 2/2015, el personal funcionario de carrera será declarado en situación de servicios especiales en los supuestos previstos en dicho artículo, entre ellos: a) cuando adquiera la condición de personal funcionario al servicio de organizaciones internacionales (opción A); b) cuando sea autorizado para realizar una misión por período superior a 6 meses en organismos internacionales, gobiernos o entidades públicas extranjeras o en programas de cooperación internacional (opción B); c) cuando sea designado miembro del Gobierno, del Consello de la Xunta, de órganos de gobierno de otras CCAA o ciudades de Ceuta y Melilla, miembro de instituciones de la UE u organizaciones internacionales, o nombrado alto cargo (opción C). Las tres son correctas, por lo que la respuesta es la D.',
    },
    // #2 31bf6770 art 52
    {
      id: '31bf6770-6fc6-4334-b0f0-2bed2bab22ee',
      explanation: 'Según el art. 52.1 de la Ley 2/2015, pueden acceder al empleo público en igualdad de condiciones con los nacionales españoles: a) los nacionales de otros estados miembros de la UE (opción A); b) cualquiera que sean sus cónyuges y descendientes bajo ciertas condiciones (opción B); c) las personas incluidas en tratados internacionales ratificados por España sobre libre circulación de trabajadores (opción C). Las tres son correctas, por lo que la respuesta es la D.',
    },
    // #3 324a607d art 124 — fix opción D al texto correcto (19 semanas, 6 obligatorias)
    {
      id: '324a607d-ed54-4f5c-b253-9c93a6d19e14',
      option_d: 'A un permiso retribuido de diecinueve semanas, de las cuales las seis semanas inmediatas posteriores al hecho causante serán en todo caso de descanso obligatorio.',
      explanation: 'Según el art. 124.1 de la Ley 2/2015: "En los casos de nacimiento, acogimiento, guarda con fines de adopción o adopción de un hijo o hija, el personal funcionario que no esté disfrutando del permiso por parto, acogimiento, guarda con fines de adopción o adopción previsto en esta ley tiene derecho a un permiso retribuido de diecinueve semanas." Las seis primeras semanas posteriores al hecho causante son de descanso obligatorio, iniciándose tras ellas el cómputo de las semanas restantes. La respuesta correcta es la D.',
    },
    // #4 341ee964 art 80 — cita 80.3, debe ser 80.1
    {
      id: '341ee964-30ae-44ea-8edd-400ccc8d3c8a',
      explanation: 'Según el art. 80.1 de la Ley 2/2015: "En las convocatorias de pruebas selectivas para el acceso a la función pública (...), un mínimo de un veinticinco por ciento de las plazas convocadas se reservará para personal funcionario perteneciente a cuerpos o escalas del subgrupo o grupo de clasificación profesional (...) inmediatamente inferior (...)". La respuesta correcta es la B (25%).',
    },
    // #5 3f13dea8 wrong_article 63→68 + reescribir explicación
    {
      id: '3f13dea8-3708-4e90-bbe7-57980b8bf76d',
      primary_article_id: ART_68,
      explanation: 'Según el art. 68.4 de la Ley 2/2015: "El personal funcionario puede solicitar, con una antelación mínima de tres meses y máxima de cuatro meses a la fecha en la que cumpla la edad de jubilación forzosa, la prolongación de la permanencia en la situación de servicio activo." La respuesta correcta es la C. La D es falsa porque habla de "jubilación voluntaria" cuando el artículo se refiere a la forzosa.',
    },
    // #6 49efec86 art 50
    {
      id: '49efec86-7985-4804-9add-620623e54c49',
      explanation: 'Según el art. 50 de la Ley 2/2015, son requisitos generales para participar en los procesos selectivos, entre otros: tener cumplidos los 16 años y no exceder la edad máxima de jubilación forzosa (opción A), poseer las capacidades y aptitudes físicas y psíquicas necesarias (opción B) y estar en posesión de la titulación exigida o en condiciones de obtenerla (opción C). Las tres son correctas, por lo que la respuesta es la D.',
    },
    // #7 6be19900 art 179.3 — clarificar opción A incorrecta (inversión)
    {
      id: '6be19900-2602-43df-810e-1e70e391a583',
      option_a: 'Desempeñar cualquier puesto de trabajo en el sector público bajo cualquier tipo de relación funcionarial o contractual.',
      explanation: 'Según el art. 179.3 de la Ley 2/2015, el personal funcionario en excedencia forzosa está obligado a: aceptar los destinos adecuados (B), participar en cursos de formación (C), y participar en los concursos convocados para puestos adecuados (D). Además, el art. 179.3.d establece expresamente el deber de **NO** desempeñar puestos de trabajo en el sector público. La opción A invierte esta obligación (dice "desempeñar... bajo cualquier tipo de relación", justo lo contrario de la obligación de NO desempeñar), por lo que es la respuesta incorrecta que pide el enunciado.',
    },
    // #8 6e61704a art 175
    {
      id: '6e61704a-a45b-407e-81e6-d45dbf14a845',
      explanation: 'Según el art. 175.1 de la Ley 2/2015: "El personal funcionario de carrera tiene derecho a la excedencia por agrupación familiar (...) cuando el cónyuge o pareja de hecho resida en otra localidad por haber obtenido y estar desempeñando un puesto de trabajo de carácter definitivo como personal funcionario de carrera o como personal laboral fijo (...)". La opción B reproduce este supuesto y es la respuesta correcta. La A describe la excedencia por cuidado de hijos, la C la situación por promoción interna y la D la excedencia por cuidado de familiares.',
    },
    // #9 bb1b6f64 art 108 — aclarar que 3 días es específicamente por fallecimiento
    {
      id: 'bb1b6f64-6d9d-48f6-a305-735f705578fb',
      explanation: 'Según el art. 108.2 de la Ley 2/2015, en caso de **fallecimiento** del cónyuge, pareja de hecho o familiar dentro del primer grado de consanguinidad o afinidad, el personal funcionario tendrá derecho a un permiso de **tres días hábiles** cuando el suceso se produzca en la misma localidad (y cinco días si es en localidad distinta). La respuesta correcta es la A. Nota: los casos de accidente o enfermedad grave (art. 108.1) tienen un régimen distinto (cinco días), pero el enunciado queda resuelto por el supuesto más restrictivo (fallecimiento, 3 días).',
    },
    // #10 dafcc323 art 91 — desmontar distractores
    {
      id: 'dafcc323-d34f-48ac-b1c5-0758458ab310',
      explanation: 'Según el art. 91.1 de la Ley 2/2015: "El concurso específico se aplicará como sistema de provisión para aquellos puestos de trabajo para los que, por sus peculiaridades, así se determine en la relación de puestos de trabajo." La opción A reproduce literalmente el precepto y es correcta. La B es falsa porque el artículo dice que las jefaturas de servicio se proveen por concurso específico salvo que deban proveerse por **libre designación** (no por "concurso ordinario"). La C es falsa porque el art. 91 no exige antigüedad mínima de 5 años. La D es falsa porque la valoración es cada 5 años, no cada 10.',
    },
    // #11 e68a1380 art 80
    {
      id: 'e68a1380-7dea-472f-bdaf-f346e6f8fa7b',
      explanation: 'Según el art. 80.1 de la Ley 2/2015, los requisitos para la promoción interna vertical son: a) poseer la titulación y demás requisitos exigidos (opción A), b) haber prestado al menos 2 años de servicios efectivos como funcionario en el subgrupo/grupo inferior (opción B), y c) no superar la edad de jubilación forzosa (opción C). El artículo NO exige tener 21 años cumplidos (opción D), que es la respuesta correcta como requisito que NO figura en el artículo.',
    },
    // #12 ec2a687e art 7 — corregir question_text 7.1 → 7.2
    {
      id: 'ec2a687e-70d0-4128-86a1-b842e9f0bd11',
      question_text: 'De acuerdo el artículo 7.2: El personal de los cuerpos de policía local se rige, además de por la legislación básica estatal que le resulte de aplicación:',
      explanation: 'Según el art. 7.2 de la Ley 2/2015: "El personal de los cuerpos de policía local se rige, además de por la normativa mencionada en el apartado anterior, por la legislación general de fuerzas y cuerpos de seguridad y por su legislación específica, la cual regulará las demás especialidades de su régimen jurídico." La opción B reproduce literalmente el precepto y es la correcta. Las demás alteran términos clave: A cambia "fuerzas y cuerpos" por "fuerzas"; C cambia por "fuerzas militares"; D cambia "régimen jurídico" por "régimen laboral".',
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

  // Mark the 89 perfect as perfect + active
  const consolidated = JSON.parse(fs.readFileSync('t11_galicia_consolidated.json'));
  const perfectIds = consolidated.filter(r => r.status === 'perfect').map(r => r.id);
  await supabase.from('questions').update({
    topic_review_status: 'perfect', verification_status: 'ok', verified_at: now,
    is_active: true, deactivation_reason: null,
  }).in('id', perfectIds);
  console.log('✅ ' + perfectIds.length + ' perfect actualizadas');

  const ids = JSON.parse(fs.readFileSync('t11_galicia_imported_ids.json'));
  const { data } = await supabase.from('questions').select('is_active, topic_review_status').in('id', ids);
  const active = data.filter(q => q.is_active).length;
  const perfect = data.filter(q => q.topic_review_status === 'perfect').length;
  console.log('T11: ' + active + '/' + ids.length + ' activas, ' + perfect + ' perfect');
})();
