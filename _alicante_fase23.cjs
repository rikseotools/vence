require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PT='auxiliar_administrativo_diputacion_alicante', SLUG='auxiliar-administrativo-diputacion-alicante';
const t=require('./data/temarios/auxiliar-administrativo-diputacion-alicante.json');
const titles={
 1:'La Constitución Española de 1978: estructura, derechos, Corona y reforma',
 2:'El Estatuto de Autonomía de la Comunidad Valenciana',
 3:'La provincia como entidad local: organización y competencias',
 4:'Régimen de sesiones y acuerdos de los órganos locales',
 5:'El acto administrativo: concepto, clases, elementos y eficacia',
 6:'Iniciación del procedimiento y registros administrativos',
 7:'Términos y plazos, ordenación e instrucción del procedimiento',
 8:'Terminación del procedimiento y silencio administrativo',
 9:'El personal al servicio de las Entidades Locales (I)',
 10:'Derechos, deberes, régimen disciplinario e incompatibilidades',
 11:'Los recursos administrativos',
 12:'Los contratos en la esfera local (Ley 9/2017)',
 13:'Los bienes de las Entidades Locales',
 14:'Los Presupuestos de las Entidades Locales',
 15:'La Ley de Prevención de Riesgos Laborales',
 16:'La protección de datos de carácter personal',
 17:'Políticas de Igualdad de Género (LO 3/2007)',
 18:'Transparencia, acceso a la información y buen gobierno (Ley 19/2013)',
 19:'Ofimática: Correo electrónico',
 20:'Ofimática: Procesador de texto Microsoft Word',
};
const L={CE:'6ad91a6c-41ec-431f-9c80-5f5566834941',ECV:'a69cd89b-eb84-492b-a349-530261e7160a',LBRL:'06784434-f549-4ea2-894f-e2e400881545',L39:'218452f5-b9f6-48f0-a25b-26df9cb19644',EBEP:'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0',L53:'f6f4da4d-845f-45d0-b69f-3554524e23e7',LCSP:'4f605392-8137-4962-9e66-ca5f275e93ee',TRLRHL:'5fcc4f3a-a719-415f-958f-46c840e1c4e7',LPRL:'8b1ae300-4ed3-4019-876c-780ea40ebbfe',LOPD:'146b7e50-e089-44a6-932c-773954f8d96b',LO3:'6e59eacd-9298-4164-9d78-9e9343d9a900',L19:'a7bd0e06-7dcb-4a25-911b-e16f6e5e0798',OUTLOOK:'c9df042b-15df-4285-affb-6c93e2a71139',WORD:'86f671a9-4fd8-42e6-91db-694f27eb4292'};
const R=(a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(String(i));return o;};
const A=(law,arr)=>({law_id:law,article_numbers:arr,include_full_title:false});
const F=(law)=>({law_id:law,article_numbers:null,include_full_title:true});
const SCOPE={
 1:[A(L.CE,[...R(1,65),...R(166,169)])],
 2:[A(L.ECV,R(1,82))],
 3:[A(L.LBRL,R(31,38))],
 4:[A(L.LBRL,[...R(46,52),'70'])],
 5:[A(L.L39,[...R(34,39),...R(47,52)])],
 6:[A(L.L39,[...R(16,18),...R(66,69),...R(13,14),...R(28,28)])],
 7:[A(L.L39,[...R(29,33),...R(70,83)])],
 8:[A(L.L39,[...R(21,25),...R(84,95)])],
 9:[A(L.EBEP,[...R(8,15),...R(69,74)]),A(L.LBRL,['90','91'])],
 10:[A(L.EBEP,[...R(14,15),...R(93,98)]),A(L.L53,R(1,20))],
 11:[A(L.L39,R(112,126))],
 12:[A(L.LCSP,R(1,27))],
 13:[A(L.LBRL,R(79,83))],
 14:[A(L.TRLRHL,[...R(162,193)])],
 15:[A(L.LPRL,R(1,54))],
 16:[A(L.LOPD,R(1,30))],
 17:[A(L.LO3,[...R(1,12),...R(14,42),'51'])],
 18:[A(L.L19,[...R(1,8),...R(12,24)])],
 19:[F(L.OUTLOOK)],20:[F(L.WORD)],
};
const bloqueDe=n=>n<=18?1:2;
(async()=>{
  await s.from('topics').delete().eq('position_type',PT);
  await s.from('oposicion_bloques').delete().eq('position_type',PT);
  const rows=t.temario.map(x=>({position_type:PT,topic_number:x.n,title:titles[x.n],description:x.epi,epigrafe:x.epi,descripcion_corta:titles[x.n]+'.',difficulty:'medium',estimated_hours:x.n>=19?8:12,bloque_number:bloqueDe(x.n),display_number:x.n,disponible:false,is_active:true}));
  await s.from('topics').insert(rows);
  await s.from('oposicion_bloques').insert([
    {position_type:PT,bloque_number:1,titulo:'Materias jurídico-administrativas',icon:'⚖️',sort_order:1},
    {position_type:PT,bloque_number:2,titulo:'Ofimática',icon:'💻',sort_order:2},
  ]);
  console.log('✅ 20 topics + 2 bloques');
  const examen_config={tipo:'oposición (2 ejercicios)',penalizacion:'1/3 del valor de una respuesta correcta (primer ejercicio test)',total_preguntas:60,opciones:4,duracion_total_minutos:60,partes:[{nombre:'Primer ejercicio (test)',preguntas:60,opciones:4,puntuacion_min:5,puntuacion_max:10},{nombre:'Segundo ejercicio (teórico-práctico)',puntuacion_min:5,puntuacion_max:10}],notas:'Oposición (turno libre, sin concurso). Dos ejercicios obligatorios y eliminatorios. 1º: test de 60 preguntas (temas 1-20), 4 opciones, mín. 60 min; cada error resta 1/3 del valor de un acierto, los blancos no penalizan. 2º: teórico-práctico (temas 5-20), máx. 2h30. Mínimo 5/10 en cada ejercicio. (BOP Alicante nº118, 25/06/2025)'};
  const boe_ref='32 plazas Auxiliar (Escala Administración General, Subescala Auxiliar, C2), turno libre, oposición. OEP 2022-2025. Bases BOP Alicante nº118 de 25/06/2025; convocatoria BOE-A-2026-5649 (11/03/2026)';
  await s.from('oposiciones').update({
    nombre:'Auxiliar Administrativo de la Diputación Provincial de Alicante',short_name:'Aux. Dip. Alicante',grupo:'C',subgrupo:'C2',categoria:'C2',administracion:'Local',titulo_requerido:'Graduado en ESO o equivalente',temas_count:20,bloques_count:2,
    plazas_libres:32,plazas_discapacidad:0,plazas_promocion_interna:0,estado_proceso:'inscripcion_cerrada',is_convocatoria_activa:true,exam_date:null,exam_date_approximate:false,
    boe_reference:boe_ref,diario_oficial:'BOP Alicante',diario_referencia:'BOP Alicante nº118, 25/06/2025; BOE-A-2026-5649 (11/03/2026)',
    programa_url:'https://www.dip-alicante.es/bop2/pdftotal/2025/06/25_118/2025_004574.pdf',
    seguimiento_url:'https://diputacionalicante.sedelectronica.es/',
    oep_decreto:'OEP 2022, 2023, 2024 y 2025 (Diputación de Alicante)',oep_fecha:null,convocatoria_numero:'BOE-A-2026-5649',convocatoria_fecha:'2026-03-11',convocatoria_dogv:null,
    color_primario:'orange',landing_difficulty:'Intermedio',landing_duration:'6-12 meses',
    seo_title:'Auxiliar Administrativo Diputación de Alicante 2026 | 32 plazas | Tests Vence',
    seo_description:'Prepara las 32 plazas de Auxiliar Administrativo de la Diputación de Alicante (C2, OEP 2022-2025). Tests del temario oficial (20 temas) con explicaciones. Empieza gratis.',
    landing_description:'Oposición a 32 plazas de Auxiliar Administrativo (Escala Administración General, Subescala Auxiliar, C2) de la Diputación Provincial de Alicante, turno libre por el sistema de oposición (OEP 2022-2025; bases BOP Alicante nº118 de 25/06/2025, convocatoria BOE-A-2026-5649). Temario de 20 temas: Constitución, Estatuto de Autonomía de la Comunidad Valenciana, régimen local (provincia, sesiones, bienes, presupuestos), Ley 39/2015, contratos, función pública local, prevención de riesgos laborales, protección de datos, igualdad, transparencia y ofimática (correo electrónico y Word). Dos ejercicios: test de 60 preguntas y supuesto teórico-práctico.',
    examen_config,
    landing_estadisticas:[{numero:'32',texto:'Plazas turno libre',color:'text-green-600'},{numero:'{temasCount}',texto:'Temas oficiales',color:'text-blue-600'},{numero:'60',texto:'Preguntas (1er ejercicio)',color:'text-purple-600'},{numero:'ESO',texto:'Título requerido',color:'text-orange-600'}],
    landing_faqs:[
      {pregunta:'¿Cuántas plazas hay?',respuesta:'32 plazas de Auxiliar (grupo C2, Escala Administración General, Subescala Auxiliar) por turno libre, procedentes de las OEP 2022, 2023, 2024 y 2025 de la Diputación Provincial de Alicante. No hay cupo de reserva de discapacidad (solo adaptaciones).'},
      {pregunta:'¿Cómo es el examen?',respuesta:'Sistema de oposición con dos ejercicios obligatorios y eliminatorios. El primero es un test de 60 preguntas con 4 opciones (temas 1-20); cada respuesta incorrecta resta 1/3 del valor de un acierto y los blancos no penalizan. El segundo es teórico-práctico (supuestos y/o preguntas cortas, temas 5-20). Hay que sacar al menos 5/10 en cada ejercicio.'},
      {pregunta:'¿Qué temario entra?',respuesta:'20 temas: Constitución, Estatuto de Autonomía de la Comunidad Valenciana, régimen local (provincia, sesiones y acuerdos, bienes, presupuestos), Ley 39/2015 (acto, procedimiento, recursos), contratos del sector público, función pública local, prevención de riesgos laborales, protección de datos, igualdad de género, transparencia y ofimática (correo electrónico y Word).'},
      {pregunta:'¿Qué requisitos se piden?',respuesta:'Título de Graduado en ESO o equivalente y los requisitos generales de acceso al empleo público. La tasa de examen fue de 12,00 €. El examen puede realizarse en valenciano o castellano a elección del aspirante.'},
      {pregunta:'¿Cuándo es el examen?',respuesta:'El plazo de solicitudes cerró en marzo de 2026. El proceso está en fase de admisión (lista de admitidos) y la fecha del examen se publicará en el BOP y en el Tablón de la Sede Electrónica. Buen momento para preparar el temario con antelación.'}
    ],
    requisitos_especiales:[{tipo:'ofimatica',descripcion:'Microsoft Word y correo electrónico'},{tipo:'idioma',descripcion:'Examen en valenciano o castellano a elección'}]
  }).eq('slug',SLUG);
  console.log('✅ fila oposiciones Alicante');
  const {data:o}=await s.from('oposiciones').select('*').eq('slug',SLUG).single();
  await s.from('convocatorias').delete().eq('oposicion_id',o.id);
  await s.from('convocatorias').insert({oposicion_id:o.id,'año':2026,convocatoria_numero:'BOE-A-2026-5649',convocatoria_fecha:'2026-03-11',convocatoria_dogv:'BOP Alicante nº118, 25/06/2025; BOE-A-2026-5649 (11/03/2026)',is_current:true,estado_proceso:'inscripcion_cerrada',oep_decreto:o.oep_decreto,oep_fecha:null,plazas_libres:32,plazas_discapacidad:0,plazas_promocion_interna:0,boe_publication_date:'2026-03-11',boe_reference:o.boe_reference,exam_date:null,exam_date_approximate:false,programa_url:o.programa_url,examen_config,landing_faqs:o.landing_faqs,landing_estadisticas:o.landing_estadisticas,landing_description:o.landing_description,requisitos_especiales:o.requisitos_especiales});
  await s.from('convocatoria_hitos').delete().eq('oposicion_id',o.id);
  await s.from('convocatoria_hitos').insert({oposicion_id:o.id,fecha:'2026-03-11',titulo:'Convocatoria publicada en el BOE',descripcion:'32 plazas de Auxiliar (C2) de la Diputación de Alicante (OEP 2022-2025). Bases en BOP Alicante nº118 de 25/06/2025; apertura de solicitudes por extracto BOE-A-2026-5649 (11/03/2026).',url:'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-5649',status:'completed',order_index:1});
  console.log('✅ §2c + hito');
  const {data:tp}=await s.from('topics').select('id,topic_number').eq('position_type',PT);
  const byN={};tp.forEach(x=>byN[x.topic_number]=x.id);
  await s.from('topic_scope').delete().in('topic_id',tp.map(x=>x.id));
  let scope=[];for(const[n,e]of Object.entries(SCOPE))for(const x of e)scope.push({topic_id:byN[n],...x});
  await s.from('topic_scope').insert(scope);
  console.log('✅ '+scope.length+' filas scope');
  for(let n=1;n<=20;n++){
    let ids=[];for(const e of SCOPE[n]){let q=s.from('articles').select('id').eq('law_id',e.law_id);if(!e.include_full_title&&e.article_numbers)q=q.in('article_number',e.article_numbers);const{data:a}=await q;ids.push(...(a||[]).map(x=>x.id));}
    let c=0;for(let i=0;i<ids.length;i+=200){const{count}=await s.from('questions').select('id',{count:'exact',head:true}).in('primary_article_id',ids.slice(i,i+200)).eq('is_active',true);c+=count||0;}
    await s.from('topics').update({disponible:c>0}).eq('position_type',PT).eq('topic_number',n);
    console.log('T'+String(n).padStart(2)+': '+String(c).padStart(5)+' → '+(c>0));
  }
})();
