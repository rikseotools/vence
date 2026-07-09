require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PT='auxiliar_administrativo_diputacion_ourense', SLUG='auxiliar-administrativo-diputacion-ourense';
const t=require('./data/temarios/auxiliar-administrativo-diputacion-ourense.json');
const titles={
 1:'La Constitución: principios, monarquía y derechos fundamentales',
 2:'Las Cortes Generales, el Gobierno y órganos dependientes',
 3:'El Poder Judicial, el Ministerio Fiscal y el Tribunal Constitucional',
 4:'Organización territorial del Estado y el Estatuto de Autonomía de Galicia',
 5:'Organización política e instituciones de autogobierno de Galicia',
 6:'El régimen local: municipio, provincia y diputaciones',
 7:'Las Administraciones Públicas en la Constitución',
 8:'Las fuentes del Derecho Administrativo',
 9:'El acto administrativo: concepto, clases y eficacia',
 10:'El procedimiento administrativo común (Ley 39/2015)',
 11:'Ley 40/2015: principios y órganos colegiados',
 12:'Igualdad efectiva de mujeres y hombres (estatal y de Galicia)',
 13:'El empleo público: EBEP y Ley de empleo público de Galicia',
 14:'El patrimonio y los bienes de las entidades locales',
 15:'El servicio público local y sus modos de gestión',
 16:'Los presupuestos de las entidades locales',
 17:'Las subvenciones públicas',
 18:'Los contratos del sector público',
 19:'La responsabilidad patrimonial de las Administraciones Públicas',
 20:'Ofimática: paquete Office (textos, hojas de cálculo)',
};
const L={CE:'6ad91a6c-41ec-431f-9c80-5f5566834941',EGAL:'f3fb3ef7-287b-479f-9545-0f01a257b7b8',LBRL:'06784434-f549-4ea2-894f-e2e400881545',FUENTES:'337f6d97-396d-4e35-9b93-5ea098f0117b',L39:'218452f5-b9f6-48f0-a25b-26df9cb19644',L40:'95680d57-feb1-41c0-bb27-236024815feb',LO3:'6e59eacd-9298-4164-9d78-9e9343d9a900',IGGAL:'f274dd73-ac43-41da-b998-56a6b520e737',EBEP:'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0',EPGAL:'0b7d6a14-5060-4fde-813b-913c7f58ff0b',BIENES:'624256f5-bc8b-4a10-88e2-cf78d7ce2625',TRLRHL:'5fcc4f3a-a719-415f-958f-46c840e1c4e7',SUBV:'09c18214-a630-4ae8-9f63-a742919f7f4c',L9:'4f605392-8137-4962-9e66-ca5f275e93ee',WORD:'86f671a9-4fd8-42e6-91db-694f27eb4292',EXCEL:'c7475712-5ae4-4bec-9bd5-ff646c378e33',INFO:'82fd3977-ecf7-4f36-a6df-95c41445d3c2',OUTLOOK:'c9df042b-15df-4285-affb-6c93e2a71139'};
const R=(a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(String(i));return o;};
const A=(law,arr)=>({law_id:law,article_numbers:arr,include_full_title:false});
const F=(law)=>({law_id:law,article_numbers:null,include_full_title:true});
const SCOPE={
 1:[A(L.CE,R(1,65))],
 2:[A(L.CE,['54',...R(66,107),'136'])],
 3:[A(L.CE,[...R(117,127),...R(159,165)])],
 4:[A(L.CE,['137','138','139','143','144','145']),A(L.EGAL,R(1,30))],
 5:[A(L.EGAL,R(9,59))],
 6:[A(L.LBRL,[...R(1,7),'11','25','26',...R(31,36)])],
 7:[A(L.CE,['103','104','105','106'])],
 8:[F(L.FUENTES)],
 9:[A(L.L39,R(34,52))],
 10:[A(L.L39,R(53,105))],
 11:[A(L.L40,R(1,22))],
 12:[A(L.LO3,R(1,12)),A(L.IGGAL,R(1,40))],
 13:[A(L.EBEP,R(8,90)),A(L.EPGAL,R(1,60))],
 14:[F(L.BIENES)],
 15:[A(L.LBRL,['25','26','85','86','87'])],
 16:[A(L.TRLRHL,R(162,177))],
 17:[A(L.SUBV,R(1,27))],
 18:[A(L.L9,R(12,27))],
 19:[A(L.L40,R(32,37))],
 20:[F(L.WORD),F(L.EXCEL),F(L.INFO),F(L.OUTLOOK)],
};
(async()=>{
  await s.from('topics').delete().eq('position_type',PT);
  await s.from('oposicion_bloques').delete().eq('position_type',PT);
  const rows=t.temario.map(x=>({position_type:PT,topic_number:x.n,title:titles[x.n],description:x.epi,epigrafe:x.epi,descripcion_corta:titles[x.n]+'.',difficulty:'medium',estimated_hours:x.n===20?8:12,bloque_number:1,display_number:x.n,disponible:false,is_active:true}));
  await s.from('topics').insert(rows);
  await s.from('oposicion_bloques').insert({position_type:PT,bloque_number:1,titulo:'Programa oficial (20 temas)',icon:'🏛️',sort_order:1});
  console.log('✅ 20 topics + 1 bloque');
  const examen_config={tipo:'oposición (2 ejercicios)',penalizacion:'3 erróneas restan 1 acierto (1/3)',total_preguntas:40,opciones:4,duracion_total_minutos:45,partes:[{nombre:'1er ejercicio (test)',preguntas:40,opciones:4,duracion_minutos:45,puntuacion_min:7.5,puntuacion_max:15},{nombre:'2º ejercicio (supuesto práctico)',puntuacion_min:7.5,puntuacion_max:15}],notas:'Oposición turno libre. Prueba previa de gallego (CELGA 3, apto/no apto) si no se acredita. Dos ejercicios eliminatorios: 1º test de 40 preguntas (45 min), 2º supuesto práctico. Tres respuestas erróneas restan un acierto (1/3); en blanco no penaliza. Mínimo 7,5/15 en cada uno. (BOP Ourense nº52, 18/03/2026)'};
  const boe_ref='3 plazas Auxiliar Administrativo (Escala Administración General, Subescala Auxiliar, C2) turno libre + 1 reserva discapacidad, oposición. Bases BOP Ourense nº52 de 18/03/2026; BOE-A-2026-10157 (11/05/2026). Requisito gallego CELGA 3.';
  await s.from('oposiciones').update({
    nombre:'Auxiliar Administrativo de la Diputación Provincial de Ourense',short_name:'Aux. Dip. Ourense',grupo:'C',subgrupo:'C2',categoria:'C2',administracion:'Local',titulo_requerido:'Graduado en ESO o equivalente',temas_count:20,bloques_count:1,
    plazas_libres:3,plazas_discapacidad:1,plazas_promocion_interna:0,estado_proceso:'inscripcion_cerrada',is_convocatoria_activa:true,exam_date:null,exam_date_approximate:false,
    boe_reference:boe_ref,diario_oficial:'BOP Ourense',diario_referencia:'BOP Ourense nº52, 18/03/2026; BOE-A-2026-10157 (11/05/2026)',
    programa_url:'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-10157',
    seguimiento_url:'https://www.depourense.gal/gl/emprego',
    oep_decreto:'OEP Diputación Provincial de Ourense',oep_fecha:'2026-03-18',convocatoria_numero:'BOE-A-2026-10157',convocatoria_fecha:'2026-05-11',convocatoria_dogv:null,
    color_primario:'green',landing_difficulty:'Intermedio',landing_duration:'6-12 meses',
    seo_title:'Auxiliar Administrativo Diputación de Ourense 2026 | 3 plazas | Tests Vence',
    seo_description:'Prepara las plazas de Auxiliar Administrativo de la Diputación de Ourense (oposición turno libre). Tests del temario oficial (20 temas) con explicaciones. Empieza gratis.',
    landing_description:'Oposición a 3 plazas de Auxiliar Administrativo (Escala Administración General, Subescala Auxiliar, C2) de la Diputación Provincial de Ourense, turno libre por el sistema de oposición (bases BOP Ourense nº52 de 18/03/2026; BOE-A-2026-10157). Temario de 20 temas: Constitución, Estatuto de Autonomía de Galicia e instituciones gallegas, régimen local, Ley 39/2015, Ley 40/2015, igualdad (estatal y de Galicia), empleo público (EBEP y Ley de empleo público de Galicia), patrimonio y servicios locales, presupuestos, subvenciones, contratos, responsabilidad patrimonial y ofimática. Requiere gallego (CELGA 3).',
    examen_config,
    landing_estadisticas:[{numero:'3',texto:'Plazas turno libre',color:'text-green-600'},{numero:'{temasCount}',texto:'Temas oficiales',color:'text-blue-600'},{numero:'40',texto:'Preguntas (1er ejercicio)',color:'text-purple-600'},{numero:'ESO',texto:'Título requerido',color:'text-orange-600'}],
    landing_faqs:[
      {pregunta:'¿Cuántas plazas hay?',respuesta:'3 plazas de Auxiliar Administrativo (grupo C2, Escala Administración General, Subescala Auxiliar) por turno libre, más 1 reservada a discapacidad, de la Diputación Provincial de Ourense.'},
      {pregunta:'¿Cómo es el examen?',respuesta:'Sistema de oposición. Hay una prueba previa de gallego (CELGA 3, apto/no apto) para quien no lo acredite. Luego dos ejercicios eliminatorios: un test de 40 preguntas (45 minutos) y un supuesto práctico. En el test, cada 3 respuestas erróneas restan un acierto; las no contestadas no penalizan. Hay que sacar al menos 7,5/15 en cada ejercicio.'},
      {pregunta:'¿Qué temario entra?',respuesta:'20 temas: Constitución, Estatuto de Autonomía de Galicia e instituciones gallegas, régimen local (municipio, provincia, diputaciones), Ley 39/2015, Ley 40/2015, igualdad (LO 3/2007 y Ley 7/2023 de Galicia), empleo público (EBEP y Ley 2/2015 de empleo público de Galicia), patrimonio y servicios públicos locales, presupuestos, subvenciones, contratos, responsabilidad patrimonial y ofimática (paquete Office).'},
      {pregunta:'¿Qué requisitos se piden?',respuesta:'Título de Graduado en ESO o equivalente, acreditar el gallego (CELGA 3) o realizar la prueba previa, y los requisitos generales de acceso al empleo público.'},
      {pregunta:'¿Cuándo es el examen?',respuesta:'El plazo de solicitudes cerró a principios de junio de 2026. La fecha del primer ejercicio se publicará con la lista de admitidos (con 15 días de antelación), por lo que todavía no hay fecha. Buen momento para preparar el temario con antelación.'}
    ],
    requisitos_especiales:[{tipo:'idioma',descripcion:'Gallego CELGA 3 (prueba previa apto/no apto si no se acredita)'},{tipo:'ofimatica',descripcion:'Paquete Office'}]
  }).eq('slug',SLUG);
  console.log('✅ fila oposiciones Ourense');
  const {data:o}=await s.from('oposiciones').select('*').eq('slug',SLUG).single();
  await s.from('convocatorias').delete().eq('oposicion_id',o.id);
  await s.from('convocatorias').insert({oposicion_id:o.id,'año':2026,convocatoria_numero:'BOE-A-2026-10157',convocatoria_fecha:'2026-05-11',convocatoria_dogv:'BOP Ourense nº52, 18/03/2026',is_current:true,estado_proceso:'inscripcion_cerrada',oep_decreto:o.oep_decreto,oep_fecha:o.oep_fecha,plazas_libres:3,plazas_discapacidad:1,plazas_promocion_interna:0,boe_publication_date:'2026-05-11',boe_reference:o.boe_reference,exam_date:null,exam_date_approximate:false,programa_url:o.programa_url,examen_config,landing_faqs:o.landing_faqs,landing_estadisticas:o.landing_estadisticas,landing_description:o.landing_description,requisitos_especiales:o.requisitos_especiales});
  await s.from('convocatoria_hitos').delete().eq('oposicion_id',o.id);
  await s.from('convocatoria_hitos').insert({oposicion_id:o.id,fecha:'2026-05-11',titulo:'Convocatoria publicada en el BOE',descripcion:'3 plazas de Auxiliar Administrativo (C2) de la Diputación de Ourense, turno libre. Bases en BOP Ourense nº52 de 18/03/2026; extracto BOE-A-2026-10157.',url:'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-10157',status:'completed',order_index:1});
  console.log('✅ §2c + hito');
  const {data:tp}=await s.from('topics').select('id,topic_number').eq('position_type',PT);
  const byN={};tp.forEach(x=>byN[x.topic_number]=x.id);
  await s.from('topic_scope').delete().in('topic_id',tp.map(x=>x.id));
  let scope=[];for(const[n,e]of Object.entries(SCOPE))for(const x of e)scope.push({topic_id:byN[n],...x});
  await s.from('topic_scope').insert(scope);
  console.log('✅ '+scope.length+' filas scope');
  for(let n=1;n<=20;n++){
    let ids=[];for(const e of SCOPE[n]){let q=s.from('articles').select('id').eq('law_id',e.law_id);if(e.article_numbers)q=q.in('article_number',e.article_numbers);const{data:a}=await q;ids.push(...(a||[]).map(x=>x.id));}
    let c=0;for(let i=0;i<ids.length;i+=200){const{count}=await s.from('questions').select('id',{count:'exact',head:true}).in('primary_article_id',ids.slice(i,i+200)).eq('is_active',true);c+=count||0;}
    await s.from('topics').update({disponible:c>0}).eq('position_type',PT).eq('topic_number',n);
    console.log('T'+String(n).padStart(2)+': '+String(c).padStart(5)+' → '+(c>0));
  }
})();
