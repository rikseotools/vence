const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Carta de Derechos de los Ciudadanos ante la Justicia
// Aprobada por el Pleno del Congreso de los Diputados el 16 de abril de 2002
// Texto oficial del Ministerio de Justicia - 41 apartados + 3 disposiciones de eficacia

const articles = [
  // === PARTE 1: UNA JUSTICIA MODERNA Y ABIERTA A LOS CIUDADANOS ===

  // -- Una justicia transparente --
  { n: 1, content: 'El ciudadano tiene derecho a recibir información general y actualizada sobre el funcionamiento de los juzgados y tribunales y sobre las características y requisitos genéricos de los distintos procedimientos judiciales.' },
  { n: 2, content: 'El ciudadano tiene derecho a recibir información transparente sobre el estado, la actividad y los asuntos tramitados y pendientes de todos los órganos jurisdiccionales de España.' },
  { n: 3, content: 'El ciudadano tiene derecho a conocer el contenido actualizado de las leyes españolas y de la Unión Europea mediante un sistema electrónico de datos fácilmente accesible.' },
  { n: 4, content: 'El ciudadano tiene derecho a conocer el contenido y estado de los procesos en los que tenga interés legítimo de acuerdo con lo dispuesto en las leyes procesales.' },

  // -- Una justicia comprensible --
  { n: 5, content: 'El ciudadano tiene derecho a que las notificaciones, citaciones, emplazamientos y requerimientos contengan términos sencillos y comprensibles, evitándose el uso de elementos intimidatorios innecesarios.' },
  { n: 6, content: 'El ciudadano tiene derecho a que en las vistas y comparecencias se utilice un lenguaje que, respetando las exigencias técnicas necesarias, resulte comprensible para los ciudadanos que no sean especialistas en derecho.' },
  { n: 7, content: 'El ciudadano tiene derecho a que las sentencias y demás resoluciones judiciales se redacten de tal forma que sean comprensibles por sus destinatarios, empleando una sintaxis y estructura sencillas, sin perjuicio de su rigor técnico.' },
  { n: 8, content: 'El ciudadano tiene derecho a disponer gratuitamente de los formularios necesarios para el ejercicio de sus derechos ante los tribunales cuando no sea preceptiva la intervención de Abogado y Procurador.' },

  // -- Una justicia atenta con el ciudadano --
  { n: 9, content: 'El ciudadano tiene derecho a ser atendido de forma respetuosa y adaptada a sus circunstancias psicológicas, sociales y culturales.' },
  { n: 10, content: 'El ciudadano tiene derecho a exigir que las actuaciones judiciales en las que resulte preceptiva su comparecencia se celebren con la máxima puntualidad.' },
  { n: 11, content: 'El ciudadano tiene derecho a que su comparecencia personal ante un órgano de la Administración de Justicia resulte lo menos gravosa posible.' },
  { n: 12, content: 'El ciudadano tiene derecho a ser adecuadamente protegido cuando declare como testigo o colabore de cualquier otra forma con la Administración de Justicia.' },
  { n: 13, content: 'El ciudadano tiene derecho a conocer la identidad y categoría de la autoridad o funcionario que le atienda, salvo cuando esté justificado por razones de seguridad en causas criminales.' },
  { n: 14, content: 'El ciudadano tiene derecho a ser atendido personalmente por el Juez o por el Secretario Judicial respecto a cualquier incidencia relacionada con el funcionamiento del órgano judicial.' },
  { n: 15, content: 'El ciudadano tiene derecho a ser atendido en horario de mañana y tarde en las dependencias judiciales de aquellos órganos en los que, por su naturaleza o volumen de asuntos, resulte necesario y en los términos legalmente previstos.' },
  { n: 16, content: 'El ciudadano tiene derecho a utilizar con la Administración de Justicia del territorio de su Comunidad la lengua oficial que escoja, y a ser atendido en los términos establecidos por la Ley Orgánica del Poder Judicial, y los Estatutos de Autonomía y sus normas de desarrollo.' },

  // -- Una justicia responsable ante el ciudadano --
  { n: 17, content: 'El ciudadano tiene derecho a formular reclamaciones, quejas y sugerencias relativas al incorrecto funcionamiento de la Administración de Justicia, así como a recibir respuesta a las mismas con la mayor celeridad y, en todo caso, dentro del plazo de un mes.' },
  { n: 18, content: 'El ciudadano tiene derecho a exigir responsabilidades por error judicial o por el funcionamiento anormal de la Administración de Justicia.' },

  // -- Una justicia ágil y tecnológicamente avanzada --
  { n: 19, content: 'El ciudadano tiene derecho a una tramitación ágil de los asuntos que le afecten, que deberán resolverse dentro del plazo legal, y a conocer, en su caso, el motivo concreto del retraso.' },
  { n: 20, content: 'El ciudadano tiene derecho a que no se le exija la aportación de documentos que obren en poder de las Administraciones Públicas, salvo que las leyes procesales expresamente lo requieran.' },
  { n: 21, content: 'El ciudadano tiene derecho a comunicarse con la Administración de Justicia a través del correo electrónico, videoconferencia y otros medios telemáticos con arreglo a lo dispuesto en las leyes procesales.' },

  // === PARTE 2: UNA JUSTICIA QUE PROTEGE A LOS MÁS DÉBILES ===

  // -- Protección de las víctimas del delito --
  { n: 22, content: 'El ciudadano que sea víctima de un delito tiene derecho a ser informado con claridad sobre su intervención en el proceso penal, las posibilidades de obtener la reparación del daño sufrido, así como sobre el curso del proceso.' },
  { n: 23, content: 'El ciudadano que sea víctima de un delito tiene derecho a que su comparecencia personal ante un Juzgado o Tribunal tenga lugar de forma adecuada a su dignidad y preservando su intimidad.' },
  { n: 24, content: 'El ciudadano que sea víctima de un delito tiene derecho a ser protegido de forma inmediata y efectiva por los Juzgados y Tribunales, especialmente frente al que ejerce violencia física o psíquica en el ámbito familiar.' },
  { n: 25, content: 'El ciudadano que sea víctima de un delito tiene derecho a ser protegido frente a la publicidad no deseada sobre su vida privada en toda clase de actuaciones judiciales.' },

  // -- Protección de los menores --
  { n: 26, content: 'El menor de edad tiene derecho a que su comparecencia ante los órganos judiciales tenga lugar de forma adecuada a su situación y desarrollo evolutivo.' },
  { n: 27, content: 'El menor de edad que tuviere suficiente juicio tiene derecho a ser oído en todo proceso judicial en que esté directamente implicado y que conduzca a una decisión que afecte a su esfera personal, familiar o social, así como a que las distintas actuaciones judiciales se practiquen en condiciones que garanticen la comprensión de su contenido.' },
  { n: 28, content: 'El menor de edad tiene derecho a que las autoridades y funcionarios de la Administración de Justicia guarden la debida reserva sobre las actuaciones relacionadas con ellos, que en todo caso deberán practicarse de manera que se preserve su intimidad y el derecho a su propia imagen.' },

  // -- Protección de discapacitados --
  { n: 29, content: 'El ciudadano afectado por cualquier tipo de discapacidad sensorial, física o psíquica, podrá ejercitar con plenitud los derechos reconocidos en esta Carta y en las leyes procesales.' },
  { n: 30, content: 'El ciudadano sordo, mudo, así como el que sufra discapacidad visual o ceguera, tiene derecho a la utilización de un intérprete de signos o de aquellos medios tecnológicos que permitan tanto obtener de forma comprensible la información solicitada, como la práctica adecuada de los actos de comunicación y otras actuaciones procesales en las que participen.' },

  // -- Los inmigrantes ante la justicia --
  { n: 31, content: 'El extranjero tiene derecho a ser atendido por todos los que prestan sus servicios en la Administración de Justicia de acuerdo con lo establecido en esta Carta y sin sufrir discriminación alguna por razón de su raza, lengua, religión o creencias, particularmente cuando se trate de menores de edad y conforme a lo dispuesto por los convenios internacionales ratificados por España.' },
  { n: 32, content: 'Los extranjeros inmigrantes en España tienen derecho a recibir una protección adecuada de la Administración de Justicia al objeto de asegurar que comprenden el significado y trascendencia jurídica de las actuaciones procesales en las que intervengan por cualquier causa.' },

  // === PARTE 3: UNA RELACIÓN DE CONFIANZA CON ABOGADOS Y PROCURADORES ===

  // -- Una conducta deontológicamente correcta --
  { n: 33, content: 'El ciudadano tiene derecho a la prestación de un servicio profesional de calidad por parte del Abogado en el cumplimiento de la misión de defensa que le encomiende, así como por el Procurador en la representación de sus intereses ante los órganos jurisdiccionales.' },
  { n: 34, content: 'El ciudadano tiene derecho a denunciar ante los Colegios de Abogados o de Procuradores las conductas contrarias a la deontología profesional y a conocer a través de una resolución suficientemente motivada el resultado de la denuncia.' },
  { n: 35, content: 'El ciudadano tiene derecho a conocer, a través del Colegio Profesional correspondiente, si un Abogado o Procurador ha sido objeto de alguna sanción disciplinaria, no cancelada, por alguna actuación profesional.' },
  { n: 36, content: 'El ciudadano tiene derecho a que los profesionales que le representen, asesoren o defiendan guarden riguroso secreto de cuanto les revelen o confíen en el ejercicio de estas funciones.' },

  // -- Un cliente informado --
  { n: 37, content: 'El ciudadano tiene derecho a conocer anticipadamente el coste aproximado de la intervención del profesional y la forma de pago.' },
  { n: 38, content: 'El ciudadano tiene derecho a obtener del Abogado y Procurador información precisa y detallada sobre el estado del procedimiento y de las resoluciones que se dicten.' },
  { n: 39, content: 'El ciudadano tiene derecho a ser informado por su Abogado y por su Procurador, con carácter previo al ejercicio de cualquier pretensión ante un órgano judicial, sobre las consecuencias de ser condenado al pago de las costas del proceso y sobre su cuantía estimada.' },

  // -- Una justicia gratuita de calidad --
  { n: 40, content: 'El ciudadano tiene derecho a ser asesorado y defendido gratuitamente por un Abogado suficientemente cualificado y a ser representado por un Procurador cuando tenga legalmente derecho a la asistencia jurídica gratuita.' },
  { n: 41, content: 'El ciudadano tiene derecho a exigir una formación de calidad al profesional designado por el turno de oficio en los supuestos de asistencia jurídica gratuita.' },
];

async function main() {
  // 1. Create the law entry
  const { data: law, error: lawErr } = await supabase.from('laws').insert({
    short_name: 'Carta Derechos Ciudadanos Justicia',
    name: 'Carta de Derechos de los Ciudadanos ante la Justicia (Proposición no de Ley aprobada por el Pleno del Congreso de los Diputados el 16 de abril de 2002)',
    description: 'Catálogo de derechos de los usuarios de la Justicia aprobado por unanimidad por todos los grupos parlamentarios',
    year: 2002,
    type: 'law',
    scope: 'national',
    is_active: true,
    current_version: '1.0',
    verification_status: 'pendiente',
    slug: 'carta-derechos-ciudadanos-justicia'
  }).select().single();

  if (lawErr) {
    console.error('Error creating law:', lawErr.message);
    return;
  }
  console.log('Ley creada:', law.id, '-', law.short_name);

  // 2. Insert all articles
  let ok = 0, fail = 0;
  for (const art of articles) {
    const { error } = await supabase.from('articles').insert({
      law_id: law.id,
      article_number: String(art.n),
      content: art.content,
      is_active: true,
    });

    if (error) {
      console.error(`  FAIL art ${art.n}: ${error.message}`);
      fail++;
    } else {
      ok++;
    }
  }

  console.log(`Artículos: ${ok} OK, ${fail} FAIL de ${articles.length}`);
  console.log('Law ID:', law.id);

  // 3. Find article 17 (reclamaciones, plazo un mes)
  const { data: art17 } = await supabase
    .from('articles')
    .select('id, article_number, content')
    .eq('law_id', law.id)
    .eq('article_number', '17')
    .single();

  if (art17) {
    console.log('\nArt. 17 ID:', art17.id);
    console.log('Contenido:', art17.content);
  }
}

main().catch(console.error);
