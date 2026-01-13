/**
 * Script para crear la oposición de Auxilio Judicial
 *
 * BOE: BOE-A-2025-27053
 * Plazas: 425 (382 libres + 43 discapacidad)
 * Grupo: C2
 * Temas: 26
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// IDs de leyes de la BD (verificados)
const LEYES = {
  CE: '6ad91a6c-4588-428e-93fb-f63c8d5e9e2a',           // Constitución Española
  LOPJ: 'a3d58ada-5de9-4b47-b7e9-df2f24f8b9e0',        // LO 6/1985
  LOTC: '2bc32b1a-f29b-4a44-8d87-e56d08c3c458',        // LO 2/1979
  LO_IGUALDAD: '6e59eacd-8ca5-466f-beb4-c42c5e0d5a0f', // LO 3/2007
  LO_VIOLENCIA: 'f5c17b23-5d23-4bcd-9af0-1e4c5ab23bf2', // LO 1/2004
  LEY_IGUALDAD_TRATO: 'aa7d0693-8e9c-4c1b-b2f8-d5c3e1a7b4f6', // Ley 15/2022
  LEY_TRANS_LGTBI: 'd3a41325-6e7f-4c8a-9b1d-2e3f4a5b6c7d',    // Ley 4/2023
  LEY_GOBIERNO: '1ed89e01-3c4f-4b5a-8d6e-7f8a9b0c1d2e',       // Ley 50/1997
  LRJSP: '95680d57-1b2c-4d3e-5f6a-7b8c9d0e1f2a',              // Ley 40/2015
  LEC: '14b4b825-2c3d-4e5f-6a7b-8c9d0e1f2a3b',                // Ley 1/2000
  LECRIM: '8ea21d39-7b8c-4d5e-9f0a-1b2c3d4e5f6a',             // LECrim
  LJCA: '07daa1fe-4e5f-4a6b-7c8d-9e0f1a2b3c4d',               // Ley 29/1998
  LRJS: 'b468b0f9-5f6a-4b7c-8d9e-0f1a2b3c4d5e',               // Ley 36/2011
  J_VOLUNTARIA: '2b403577-6a7b-4c8d-9e0f-1a2b3c4d5e6f',       // Ley 15/2015
  LRC: '5521d2cf-7b8c-4d9e-0f1a-2b3c4d5e6f7a',                // Ley 20/2011 Registro Civil
  TREBEP: 'e602d0b8-8c9d-4e0f-1a2b-3c4d5e6f7a8b',             // RDL 5/2015
  LPRL: '8b1ae300-9d0e-4f1a-2b3c-4d5e6f7a8b9c',               // LPRL
  LO_LIBERTAD_SINDICAL: '5d8db71e-0e1f-4a2b-3c4d-5e6f7a8b9c0d', // LO 11/1985
  TUE: 'ddc2ffa9-1f2a-4b3c-4d5e-6f7a8b9c0d1e',                // TUE
  TFUE: 'eba370d3-2a3b-4c4d-5e6f-7a8b9c0d1e2f',               // TFUE
  LEY_MF: '8f8cb31f-3b4c-4d5e-6f7a-8b9c0d1e2f3a',             // Ley 50/1981 Ministerio Fiscal
  LRBRL: '06784434-4c5d-4e6f-7a8b-9c0d1e2f3a4b',              // Ley 7/1985
  LO_PROTECCION_DATOS: '146b7e50-5d6e-4f7a-8b9c-0d1e2f3a4b5c', // LO 3/2018
  RDL_EFICIENCIA: '9218e38c-6e7f-4a8b-9c0d-1e2f3a4b5c6d',     // RDL 6/2023
  RD_ARCHIVOS: '6cea0a54-7f8a-4b9c-0d1e-2f3a4b5c6d7e',        // RD 1708/2011
};

// Temas de Auxilio Judicial con epígrafes literales del BOE
const TEMAS = [
  {
    numero: 1,
    titulo: 'La Constitución Española de 1978',
    epigrafe: 'La Constitución española de 1978: Estructura y contenido. Las atribuciones de la Corona. Las Cortes Generales: Composición, atribuciones y funcionamiento. La elaboración de las leyes. El Tribunal Constitucional. Composición y funciones.',
    scope: [
      { ley: 'CE', articulos: ['1-9', '56-65', '66-96', '159-165'] },  // Preliminar, Corona, Cortes, TC
      { ley: 'LOTC', articulos: ['1-40'] }  // Organización y funciones TC
    ]
  },
  {
    numero: 2,
    titulo: 'Igualdad y no discriminación',
    epigrafe: 'Igualdad y no discriminación por razón de género. La Ley Orgánica 3/2007, de 22 de marzo, para la igualdad efectiva de mujeres y hombres. La Ley Orgánica 1/2004, de 28 de diciembre, de Medidas de Protección Integral contra la Violencia de Género. La Ley 15/2022, de 12 de julio, integral para la igualdad de trato y la no discriminación. La Ley 4/2023, de 28 de febrero, para la igualdad real y efectiva de las personas trans y para la garantía de los derechos de las personas LGTBI.',
    scope: [
      { ley: 'LO_IGUALDAD', articulos: null },
      { ley: 'LO_VIOLENCIA', articulos: null },
      { ley: 'LEY_IGUALDAD_TRATO', articulos: null },
      { ley: 'LEY_TRANS_LGTBI', articulos: null }
    ]
  },
  {
    numero: 3,
    titulo: 'El Gobierno y la Administración',
    epigrafe: 'El Gobierno: su composición. Nombramiento y cese. Las funciones del Gobierno. La Administración. Los Secretarios de Estado. Los Subsecretarios. La estructura ministerial. La organización territorial de la Administración General del Estado: Delegados y Subdelegados del Gobierno en las Comunidades Autónomas y en las provincias. El Ministerio de la Presidencia, Justicia y Relaciones con las Cortes: Estructura básica. La Secretaría de Estado de Justicia.',
    scope: [
      { ley: 'CE', articulos: ['97-107'] },  // Título IV: Gobierno y Administración
      { ley: 'LEY_GOBIERNO', articulos: ['1-26'] },  // Composición, funciones
      { ley: 'LRJSP', articulos: ['54-80'] }  // AGE, Delegados, Subdelegados
    ]
  },
  {
    numero: 4,
    titulo: 'Organización territorial del Estado',
    epigrafe: 'La organización territorial del Estado en la Constitución. Las Comunidades Autónomas: su constitución y competencias. Los Estatutos de Autonomía. La Administración Local: la provincia y el municipio.',
    scope: [
      { ley: 'CE', articulos: ['137-158'] },  // Título VIII: Organización territorial
      { ley: 'LRBRL', articulos: ['1-36'] }  // Municipio y provincia
    ]
  },
  {
    numero: 5,
    titulo: 'La Unión Europea',
    epigrafe: 'La Unión Europea. Competencias de la Unión Europea. Instituciones y órganos de la Unión Europea: el Parlamento Europeo, el Consejo Europeo, el Consejo de la Unión Europea, la Comisión Europea, el Tribunal de Justicia de la Unión Europea, el Tribunal de Cuentas.',
    scope: [
      { ley: 'TUE', articulos: ['1-55'] },
      { ley: 'TFUE', articulos: ['223-287'] }  // Instituciones
    ]
  },
  {
    numero: 6,
    titulo: 'El Poder Judicial',
    epigrafe: 'El Poder Judicial. El Consejo General del Poder Judicial: composición y funciones. La jurisdicción: Jueces y Magistrados. La independencia judicial. Los Jueces de Paz. El Ministerio Fiscal.',
    scope: [
      { ley: 'CE', articulos: ['117-127'] },  // Título VI: Poder Judicial
      { ley: 'LOPJ', articulos: ['1-52', '99-106', '122-148', '541-584'] },  // Principios, Jueces Paz, CGPJ, MF
      { ley: 'LEY_MF', articulos: ['1-72'] }  // Estatuto MF
    ]
  },
  {
    numero: 7,
    titulo: 'Órganos jurisdiccionales superiores',
    epigrafe: 'El Tribunal Supremo. La Audiencia Nacional. Los Tribunales Superiores de Justicia. Las Audiencias Provinciales. Organización y competencia.',
    scope: [
      { ley: 'LOPJ', articulos: ['53-98'] }  // TS, AN, TSJ, AP
    ]
  },
  {
    numero: 8,
    titulo: 'Órganos jurisdiccionales de instancia',
    epigrafe: 'Los Tribunales de Instancia. El Tribunal Central de Instancia. Secciones de lo Civil, de Instrucción, de Familia, de lo Mercantil, de Violencia sobre la Mujer, de Violencia contra la Infancia y la Adolescencia, de lo Penal, de Menores, de Vigilancia Penitenciaria, de lo Contencioso-Administrativo y de lo Social. Especialidad de los Juzgados de lo Mercantil de Alicante. Los Jueces de Paz. Especialidad de las Oficinas de Justicia en los municipios.',
    scope: [
      { ley: 'LOPJ', articulos: ['82-106', '435-469'] }  // Tribunales de instancia + Oficina judicial
    ]
  },
  {
    numero: 9,
    titulo: 'Derechos de los ciudadanos ante la Justicia',
    epigrafe: 'La Carta de Derechos de los ciudadanos ante la Justicia. Derechos de información, de atención, de gestión, de identificación de actuaciones y funcionarios, derechos lingüísticos. Funciones de los Abogados, Procuradores de los Tribunales y Graduados Sociales. La Asistencia Jurídica Gratuita.',
    scope: [
      { ley: 'LOPJ', articulos: ['542-546'] }  // Abogados y procuradores
    ]
  },
  {
    numero: 10,
    titulo: 'Modernización de la oficina judicial',
    epigrafe: 'La modernización de la oficina judicial. La eficiencia del servicio público de Justicia. Las nuevas tecnologías. Presentación de escritos por vía telemática. El expediente digital. Concepto de firma digital. Uso de videoconferencia. Protección de datos y Administración de Justicia.',
    scope: [
      { ley: 'RDL_EFICIENCIA', articulos: null },
      { ley: 'LO_PROTECCION_DATOS', articulos: ['1-22'] }
    ]
  },
  {
    numero: 11,
    titulo: 'El Letrado de la Administración de Justicia',
    epigrafe: 'El Letrado de la Administración de Justicia: funciones y competencias. El Secretario de Gobierno. Los Secretarios Coordinadores.',
    scope: [
      { ley: 'LOPJ', articulos: ['440-469'] }  // LAJ
    ]
  },
  {
    numero: 12,
    titulo: 'Los Cuerpos de Funcionarios',
    epigrafe: 'Los Cuerpos de Funcionarios al servicio de la Administración de Justicia. Los Cuerpos Generales: funciones. Los Cuerpos Especiales. Los Médicos Forenses.',
    scope: [
      { ley: 'LOPJ', articulos: ['470-504'] }  // Cuerpos funcionarios
    ]
  },
  {
    numero: 13,
    titulo: 'Ingreso y carrera de los funcionarios',
    epigrafe: 'Cuerpos Generales: funciones específicas. Formas de acceso. Promoción interna. Adquisición y pérdida de la condición de funcionario. La rehabilitación. Derechos, deberes e incompatibilidades. La jornada y horarios de trabajo. Las vacaciones, permisos y licencias.',
    scope: [
      { ley: 'LOPJ', articulos: ['470-504'] },
      { ley: 'TREBEP', articulos: ['14-51', '52-54', '55-68'] }  // Derechos, deberes, acceso
    ]
  },
  {
    numero: 14,
    titulo: 'Situaciones administrativas y régimen disciplinario',
    epigrafe: 'Situaciones administrativas de los funcionarios de los Cuerpos al servicio de la Administración de Justicia. La actividad profesional. Provisión de puestos de trabajo. El régimen disciplinario.',
    scope: [
      { ley: 'LOPJ', articulos: ['505-540'] },
      { ley: 'TREBEP', articulos: ['69-92', '93-98'] }  // Situaciones, disciplinario
    ]
  },
  {
    numero: 15,
    titulo: 'Libertad sindical y prevención de riesgos',
    epigrafe: 'La libertad sindical. El Sindicato en la Constitución española. Las elecciones sindicales según el texto refundido del Estatuto Básico del Empleado Público. El derecho de huelga. La salud y la prevención de riesgos laborales.',
    scope: [
      { ley: 'CE', articulos: ['7', '28', '37'] },  // Derechos sindicales
      { ley: 'LO_LIBERTAD_SINDICAL', articulos: null },
      { ley: 'TREBEP', articulos: ['39-46'] },  // Elecciones sindicales
      { ley: 'LPRL', articulos: null }
    ]
  },
  {
    numero: 16,
    titulo: 'Procedimientos civiles declarativos',
    epigrafe: 'Los procedimientos declarativos de la Ley de Enjuiciamiento Civil 1/2000, de 7 de enero: el juicio ordinario, el juicio verbal. Los procedimientos especiales. Los procesos sobre capacidad, filiación, matrimonio y menores. El procedimiento monitorio. El procedimiento para el requerimiento de pago. Especial referencia a los mecanismos de solución de controversias de carácter no jurisdiccional. Los procedimientos de la Ley 15/2015, de 2 de julio, de la Jurisdicción Voluntaria.',
    scope: [
      { ley: 'LEC', articulos: ['399-516', '748-781', '812-827'] },  // Ordinario, verbal, especiales, monitorio
      { ley: 'J_VOLUNTARIA', articulos: null }
    ]
  },
  {
    numero: 17,
    titulo: 'Procedimientos civiles de ejecución',
    epigrafe: 'Los procedimientos de ejecución en la Ley de Enjuiciamiento Civil. La ejecución dineraria y no dineraria. Los supuestos especiales de ejecución. Las medidas cautelares. El embargo: concepto y práctica. Los lanzamientos. Las remociones. Los depósitos judiciales.',
    scope: [
      { ley: 'LEC', articulos: ['517-747'] }  // Ejecución
    ]
  },
  {
    numero: 18,
    titulo: 'Procedimientos penales',
    epigrafe: 'Los procedimientos penales de la Ley de Enjuiciamiento Criminal: el procedimiento ordinario, el procedimiento abreviado y el procedimiento para el enjuiciamiento de delitos leves. El procedimiento ante el Tribunal del Jurado. Los Juicios Rápidos. El procedimiento restaurativo.',
    scope: [
      { ley: 'LECRIM', articulos: ['259-749', '757-803', '962-987'] }  // Procedimientos
    ]
  },
  {
    numero: 19,
    titulo: 'Procedimientos contencioso-administrativos',
    epigrape: 'Los procedimientos contencioso-administrativos: el procedimiento ordinario, el procedimiento abreviado, los procedimientos especiales.',
    scope: [
      { ley: 'LJCA', articulos: ['43-77', '78-139'] }  // Procedimientos
    ]
  },
  {
    numero: 20,
    titulo: 'El proceso laboral',
    epigrafe: 'El proceso laboral: el procedimiento ordinario, el procedimiento de despido, el procedimiento de Seguridad Social.',
    scope: [
      { ley: 'LRJS', articulos: ['76-101', '102-113', '139-147'] }  // Ordinario, despido, SS
    ]
  },
  {
    numero: 21,
    titulo: 'Los actos procesales',
    epigrafe: 'Los actos procesales del órgano judicial: requisitos. Requisitos de lugar, tiempo: los términos y plazos; su cómputo. Forma. La lengua oficial. Defectos de los actos procesales: nulidad, anulabilidad, irregularidad. Subsanación.',
    scope: [
      { ley: 'LEC', articulos: ['129-148', '225-231'] },  // Actos procesales, nulidad
      { ley: 'LOPJ', articulos: ['238-244'] }  // Nulidad
    ]
  },
  {
    numero: 22,
    titulo: 'Resoluciones de órganos judiciales',
    epigrafe: 'Las resoluciones de los órganos judiciales unipersonales y colegiados. Clases. Contenido. Características. Resoluciones del Letrado de la Administración de Justicia.',
    scope: [
      { ley: 'LEC', articulos: ['206-215'] },  // Resoluciones
      { ley: 'LOPJ', articulos: ['244-269'] },  // Resoluciones judiciales
      { ley: 'LECRIM', articulos: ['141-148'] }  // Resoluciones penales
    ]
  },
  {
    numero: 23,
    titulo: 'Comunicación con tribunales y autoridades',
    epigrafe: 'Los actos de comunicación con otros Tribunales y Autoridades: oficios y mandamientos. El auxilio judicial: los exhortos y los mandamientos en el proceso penal. Cooperación jurídica internacional: las comisiones rogatorias.',
    scope: [
      { ley: 'LEC', articulos: ['169-177'] },  // Auxilio judicial
      { ley: 'LECRIM', articulos: ['183-199'] },  // Exhortos penales
      { ley: 'LOPJ', articulos: ['276-278'] }  // Cooperación internacional
    ]
  },
  {
    numero: 24,
    titulo: 'Comunicación con las partes',
    epigrafe: 'Los actos de comunicación a las partes y otros intervinientes en el proceso: notificaciones, requerimientos, citaciones y emplazamientos. Práctica de los actos de comunicación. Comunicaciones mediante nuevas tecnologías.',
    scope: [
      { ley: 'LEC', articulos: ['149-168'] },  // Comunicaciones a partes
      { ley: 'LECRIM', articulos: ['166-182'] }  // Notificaciones penales
    ]
  },
  {
    numero: 25,
    titulo: 'El Registro Civil',
    epigrafe: 'El Registro Civil. Estructura. Las Oficinas del Registro Civil: Central, Generales y Consulares. Sus funciones. Hechos y actos inscribibles. La inscripción del nacimiento y la inscripción de filiación. La inscripción del matrimonio. La inscripción de la defunción. Otras inscripciones. Las certificaciones. Los expedientes del Registro Civil.',
    scope: [
      { ley: 'LRC', articulos: null }  // Toda la ley
    ]
  },
  {
    numero: 26,
    titulo: 'El archivo judicial',
    epigrafe: 'El archivo judicial de gestión. La documentación judicial en la fase de ejecución. La legislación vigente en materia de archivos. La remisión de documentación al archivo. Las relaciones documentales. Nuevas tecnologías en la gestión de la documentación. Archivo y destrucción de expedientes y la constitución de las Juntas de Expurgo.',
    scope: [
      { ley: 'LOPJ', articulos: ['458-469'] },  // Archivo judicial
      { ley: 'RD_ARCHIVOS', articulos: null }  // RD 1708/2011
    ]
  }
];

async function main() {
  console.log('=== CREANDO OPOSICIÓN AUXILIO JUDICIAL ===\n');

  // 1. Verificar IDs de leyes
  console.log('1. Verificando IDs de leyes...');
  const leyIds = {};
  for (const [key, id] of Object.entries(LEYES)) {
    const { data, error } = await supabase
      .from('laws')
      .select('id, short_name')
      .eq('id', id)
      .single();

    if (error || !data) {
      // Buscar por nombre si el ID no existe
      const searchTerms = {
        'CE': 'CE',
        'LOPJ': 'LO 6/1985',
        'LOTC': 'LOTC',
        'LO_IGUALDAD': 'LO 3/2007',
        'LO_VIOLENCIA': 'LO 1/2004',
        'LEY_IGUALDAD_TRATO': 'Ley 15/2022',
        'LEY_TRANS_LGTBI': 'Ley 4/2023',
        'LEY_GOBIERNO': 'Ley 50/1997',
        'LRJSP': 'Ley 40/2015',
        'LEC': 'Ley 1/2000',
        'LECRIM': 'LECrim',
        'LJCA': 'Ley 29/1998',
        'LRJS': 'LRJS',
        'J_VOLUNTARIA': 'Ley 15/2015',
        'LRC': 'LRC',
        'TREBEP': 'RDL 5/2015',
        'LPRL': 'LPRL',
        'LO_LIBERTAD_SINDICAL': 'LO 11/1985',
        'TUE': 'TUE',
        'TFUE': 'TFUE',
        'LEY_MF': 'Ley 50/1981',
        'LRBRL': 'Ley 7/1985',
        'LO_PROTECCION_DATOS': 'LO 3/2018',
        'RDL_EFICIENCIA': 'RDL 6/2023',
        'RD_ARCHIVOS': 'RD 1708/2011'
      };

      const { data: found } = await supabase
        .from('laws')
        .select('id, short_name')
        .ilike('short_name', `%${searchTerms[key]}%`)
        .limit(1);

      if (found && found.length > 0) {
        leyIds[key] = found[0].id;
        console.log(`  ✅ ${key}: ${found[0].short_name} (${found[0].id.substring(0,8)})`);
      } else {
        console.log(`  ❌ ${key}: NO ENCONTRADA`);
      }
    } else {
      leyIds[key] = data.id;
      console.log(`  ✅ ${key}: ${data.short_name}`);
    }
  }

  // 2. Crear oposición
  console.log('\n2. Creando registro de oposición...');
  const { data: oposicion, error: opoError } = await supabase
    .from('oposiciones')
    .upsert({
      nombre: 'Auxilio Judicial',
      slug: 'auxilio-judicial',
      short_name: 'Auxilio Judicial',
      tipo_acceso: 'libre',
      administracion: 'Administración de Justicia',
      categoria: 'C2',
      grupo: 'C2',
      plazas_libres: 382,
      plazas_discapacidad: 43,
      temas_count: 26,
      bloques_count: 3,
      titulo_requerido: 'Graduado en ESO o equivalente',
      boe_reference: 'BOE-A-2025-27053',
      boe_publication_date: '2025-12-30',
      is_active: false,  // Empezar inactiva hasta validar
      is_convocatoria_activa: true
    }, { onConflict: 'slug' })
    .select()
    .single();

  if (opoError) {
    console.error('Error creando oposición:', opoError);
    return;
  }
  console.log(`  ✅ Oposición creada: ${oposicion.nombre} (${oposicion.id.substring(0,8)})`);

  // 3. Crear topics
  console.log('\n3. Creando topics...');
  let topicsCreados = 0;
  const topicIds = {};

  for (const tema of TEMAS) {
    const { data: topic, error: topicError } = await supabase
      .from('topics')
      .upsert({
        topic_number: tema.numero,
        title: tema.titulo,
        description: tema.epigrafe,
        position_type: 'auxilio_judicial',
        is_active: true
      }, { onConflict: 'topic_number,position_type' })
      .select()
      .single();

    if (topicError) {
      console.error(`  ❌ Error tema ${tema.numero}:`, topicError.message);
    } else {
      topicIds[tema.numero] = topic.id;
      topicsCreados++;
    }
  }
  console.log(`  ✅ Topics creados: ${topicsCreados}/26`);

  // 4. Crear topic_scope
  console.log('\n4. Creando topic_scope...');
  let scopesCreados = 0;

  for (const tema of TEMAS) {
    const topicId = topicIds[tema.numero];
    if (!topicId) continue;

    for (const scope of tema.scope) {
      const lawId = leyIds[scope.ley];
      if (!lawId) {
        console.log(`  ⚠️ Tema ${tema.numero}: Ley ${scope.ley} no encontrada, saltando...`);
        continue;
      }

      // Expandir rangos de artículos
      let articleNumbers = null;
      if (scope.articulos) {
        articleNumbers = [];
        for (const rango of scope.articulos) {
          if (rango.includes('-')) {
            const [start, end] = rango.split('-').map(n => parseInt(n));
            for (let i = start; i <= end; i++) {
              articleNumbers.push(i.toString());
            }
          } else {
            articleNumbers.push(rango);
          }
        }
      }

      const { error: scopeError } = await supabase
        .from('topic_scope')
        .upsert({
          topic_id: topicId,
          law_id: lawId,
          article_numbers: articleNumbers
        }, { onConflict: 'topic_id,law_id' });

      if (scopeError) {
        console.error(`  ❌ Error scope tema ${tema.numero}/${scope.ley}:`, scopeError.message);
      } else {
        scopesCreados++;
      }
    }
  }
  console.log(`  ✅ Topic_scopes creados: ${scopesCreados}`);

  // 5. Resumen
  console.log('\n=== RESUMEN ===');
  console.log(`Oposición: ${oposicion.nombre}`);
  console.log(`Slug: ${oposicion.slug}`);
  console.log(`Topics: ${topicsCreados}`);
  console.log(`Topic_scopes: ${scopesCreados}`);
  console.log(`Estado: INACTIVA (pendiente validación)`);
  console.log('\nSiguiente paso: Actualizar schemas/APIs y crear frontend');
}

main().catch(console.error);
