require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PT='auxiliar_administrativo_diputacion_girona', SLUG='auxiliar-administrativo-diputacion-girona';
const t=require('./data/temarios/auxiliar-administrativo-diputacion-girona.json');
const titles={
 1:'La Constitución Española: significado, estructura y principios',
 2:'La organización territorial del Estado',
 3:'La Administración Local: concepto y entidades',
 4:'La provincia: organización y competencias',
 5:'El Derecho administrativo: fuentes y principios de actuación',
 6:'Ley 39/2015: fases del procedimiento y notificaciones',
 7:'El acto administrativo: revisión y recursos',
 8:'La gestión electrónica de los procedimientos administrativos',
 9:'Ley 40/2015: órganos de las Administraciones Públicas',
 10:'Funcionamiento de los órganos colegiados locales',
 11:'Las subvenciones (Ley 38/2003 y ordenanza de la Diputació)',
 12:'Transparencia y buen gobierno en Cataluña (Ley 19/2014)',
 13:'Contratos del sector público: procedimientos de adjudicación',
 14:'Tipología de los contratos públicos y el contrato menor',
 15:'El presupuesto de las entidades locales',
 16:'Las haciendas locales y los ingresos',
 17:'El servicio público y sus formas de gestión',
 18:'Los bienes de las entidades locales',
 19:'El personal al servicio de las entidades locales',
 20:'Sistema retributivo, régimen disciplinario y situaciones administrativas',
};
const L={CE:'6ad91a6c-41ec-431f-9c80-5f5566834941',LBRL:'06784434-f549-4ea2-894f-e2e400881545',FUENTES:'337f6d97-396d-4e35-9b93-5ea098f0117b',L39:'218452f5-b9f6-48f0-a25b-26df9cb19644',L40:'95680d57-feb1-41c0-bb27-236024815feb',EBEP:'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0',L9:'4f605392-8137-4962-9e66-ca5f275e93ee',SUBV:'09c18214-a630-4ae8-9f63-a742919f7f4c',TRLRHL:'5fcc4f3a-a719-415f-958f-46c840e1c4e7',TRANSCAT:'86644bd0-0b83-4a16-910e-78c20c9f87c4'};
const R=(a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(String(i));return o;};
const A=(law,arr)=>({law_id:law,article_numbers:arr,include_full_title:false});
const F=(law)=>({law_id:law,article_numbers:null,include_full_title:true});
const SCOPE={
 1:[A(L.CE,R(1,9))],
 2:[A(L.CE,R(137,158))],
 3:[A(L.LBRL,R(1,10))],
 4:[A(L.LBRL,R(31,38))],
 5:[F(L.FUENTES)],
 6:[A(L.L39,[...R(53,105),...R(40,46)])],
 7:[A(L.L39,[...R(47,52),...R(106,126)])],
 8:[A(L.L39,['13','14','16']),A(L.L40,R(38,46))],
 9:[A(L.L40,R(5,22))],
 10:[A(L.LBRL,R(46,52))],
 11:[A(L.SUBV,R(22,42))],
 12:[F(L.TRANSCAT)],
 13:[A(L.L9,[...R(131,159)])],
 14:[A(L.L9,[...R(12,27),'118'])],
 15:[A(L.TRLRHL,R(162,171))],
 16:[A(L.TRLRHL,[...R(2,9),...R(15,27)])],
 17:[A(L.LBRL,['25','26','85','86'])],
 18:[A(L.LBRL,R(79,83))],
 19:[A(L.EBEP,[...R(8,15),...R(52,54)])],
 20:[A(L.EBEP,[...R(22,30),...R(85,98)])],
};
(async()=>{
  await s.from('topics').delete().eq('position_type',PT);
  await s.from('oposicion_bloques').delete().eq('position_type',PT);
  const rows=t.temario.map(x=>({position_type:PT,topic_number:x.n,title:titles[x.n],description:x.epi,epigrafe:x.epi,descripcion_corta:titles[x.n]+'.',difficulty:'medium',estimated_hours:12,bloque_number:1,display_number:x.n,disponible:false,is_active:true}));
  await s.from('topics').insert(rows);
  await s.from('oposicion_bloques').insert({position_type:PT,bloque_number:1,titulo:'Programa oficial (20 temas)',icon:'🏛️',sort_order:1});
  console.log('✅ 20 topics + 1 bloque');
  const examen_config={tipo:'concurso-oposición (3 ejercicios)',penalizacion:'sin penalización por error',total_preguntas:30,opciones:4,duracion_total_minutos:60,partes:[{nombre:'1º Catalán C1 (apto/no apto)'},{nombre:'2º test',preguntas:30,opciones:4,duracion_minutos:60,puntuacion_min:15,puntuacion_max:30},{nombre:'3º práctico (2 supuestos de 3)',duracion_minutos:120,puntuacion_min:15,puntuacion_max:30}],notas:'Concurso-oposición (oposición 60% / concurso 40%). 1º prueba de catalán C1 (apto/no apto, exención con certificado). 2º test de 30 preguntas (1 hora, 1 punto/acierto, SIN penalización), mín. 15/30. 3º práctico: 2 supuestos a elegir entre 3 (2 horas), mín. 15/30. Temario OEP 2023 (BOPG nº211, 03/11/2023).'};
  const boe_ref='Auxiliar Administratiu (Escala Administració General, Subescala Auxiliar, C2) de la Diputació de Girona, turno libre, concurso-oposición. Temario OEP 2023 (20 plazas, BOPG nº211 03/11/2023); convocatoria OEP 2024/2025 comprometida (hasta 12 plazas, base 1.6). Requisito catalán C1.';
  await s.from('oposiciones').update({
    nombre:'Auxiliar Administrativo de la Diputación de Girona',short_name:'Aux. Dip. Girona',grupo:'C',subgrupo:'C2',categoria:'C2',administracion:'Local',titulo_requerido:'Graduado en ESO o equivalente',temas_count:20,bloques_count:1,
    plazas_libres:12,plazas_discapacidad:0,plazas_promocion_interna:0,estado_proceso:'oep_aprobada',is_convocatoria_activa:true,exam_date:null,exam_date_approximate:false,
    boe_reference:boe_ref,diario_oficial:'BOPG / DOGC',diario_referencia:'OEP 2023: BOPG nº211, 03/11/2023; OEP 2024/2025 comprometida (base 1.6)',
    programa_url:'https://ssl4.ddgi.cat/bopV1/pdf/2023/211/202321109018.pdf',
    seguimiento_url:'https://seu.ddgi.cat/web/nivell/326/s-1/oferta-d-ocupacio',
    oep_decreto:'OEP 2023 (20 plz, resuelta) + OEP 2024/2025 comprometida (hasta 12 plz)',oep_fecha:'2023-11-03',convocatoria_numero:'BOPG-211-2023',convocatoria_fecha:'2023-11-03',convocatoria_dogv:'DOGC 9033 (03/11/2023)',
    color_primario:'purple',landing_difficulty:'Intermedio',landing_duration:'6-12 meses',
    seo_title:'Auxiliar Administrativo Diputación de Girona | Tests Vence',
    seo_description:'Prepara la oposición de Auxiliar Administrativo de la Diputación de Girona (C2). Tests del temario oficial (20 temas) con explicaciones. Empieza gratis.',
    landing_description:'Oposición a Auxiliar Administrativo (Escala Administración General, Subescala Auxiliar, C2) de la Diputación de Girona, turno libre por concurso-oposición (oposición 60% / concurso 40%). El temario (20 temas) corresponde a la última convocatoria equivalente (OEP 2023, 20 plazas, BOPG nº211); la Diputación tiene comprometidas hasta 12 plazas más en las OEP 2024/2025. Incluye Constitución, régimen local, Ley 39/2015, Ley 40/2015, contratos, subvenciones, transparencia de Cataluña (Ley 19/2014), haciendas locales, bienes y función pública. Requiere catalán nivel C1. Test de 30 preguntas y prueba práctica.',
    examen_config,
    landing_estadisticas:[{numero:'~12',texto:'Plazas (OEP 2024/2025)',color:'text-green-600'},{numero:'{temasCount}',texto:'Temas oficiales',color:'text-blue-600'},{numero:'30',texto:'Preguntas (test)',color:'text-purple-600'},{numero:'ESO',texto:'Título requerido',color:'text-orange-600'}],
    landing_faqs:[
      {pregunta:'¿Cuántas plazas hay?',respuesta:'La última convocatoria (OEP 2023) ofertó 20 plazas de Auxiliar Administrativo (C2), ya resuelta. La Diputación de Girona tiene comprometidas hasta 12 plazas más en las ofertas de empleo público 2024 y 2025, pendientes de convocar. Es buen momento para preparar el temario con antelación.'},
      {pregunta:'¿Cómo es el examen?',respuesta:'Concurso-oposición (oposición 60% / concurso 40%). Hay una prueba previa de catalán nivel C1 (apto/no apto, con exención por certificado), un test de 30 preguntas (1 hora, sin penalización por error, mínimo 15/30) y un ejercicio práctico de 2 supuestos a elegir entre 3 (2 horas, mínimo 15/30).'},
      {pregunta:'¿Qué temario entra?',respuesta:'20 temas: Constitución, organización territorial, régimen local (provincia, órganos colegiados, servicios y bienes), Derecho administrativo y fuentes, Ley 39/2015, Ley 40/2015, gestión electrónica, contratos del sector público, subvenciones, transparencia de Cataluña (Ley 19/2014), haciendas locales y presupuestos, y función pública local (personal, retribuciones, régimen disciplinario).'},
      {pregunta:'¿Qué requisitos se piden?',respuesta:'Título de Graduado en ESO o equivalente, acreditar el catalán nivel C1 (o realizar la prueba) y los requisitos generales de acceso al empleo público.'},
      {pregunta:'¿Cuándo es el examen?',respuesta:'La convocatoria de las plazas de las OEP 2024/2025 aún no se ha publicado. Preparándote ahora con el temario de la última convocatoria llegarás con ventaja cuando se convoque.'}
    ],
    requisitos_especiales:[{tipo:'idioma',descripcion:'Catalán nivel C1 (requisito de acceso)'}]
  }).eq('slug',SLUG);
  console.log('✅ fila oposiciones Girona');
  const {data:o}=await s.from('oposiciones').select('*').eq('slug',SLUG).single();
  await s.from('convocatorias').delete().eq('oposicion_id',o.id);
  await s.from('convocatorias').insert({oposicion_id:o.id,'año':2023,convocatoria_numero:'BOPG-211-2023',convocatoria_fecha:'2023-11-03',convocatoria_dogv:'BOPG nº211, 03/11/2023; DOGC 9033',is_current:true,estado_proceso:'oep_aprobada',oep_decreto:o.oep_decreto,oep_fecha:o.oep_fecha,plazas_libres:12,plazas_discapacidad:0,plazas_promocion_interna:0,boe_publication_date:'2023-11-03',boe_reference:o.boe_reference,exam_date:null,exam_date_approximate:false,programa_url:o.programa_url,examen_config,landing_faqs:o.landing_faqs,landing_estadisticas:o.landing_estadisticas,landing_description:o.landing_description,requisitos_especiales:o.requisitos_especiales});
  await s.from('convocatoria_hitos').delete().eq('oposicion_id',o.id);
  await s.from('convocatoria_hitos').insert({oposicion_id:o.id,fecha:'2023-11-03',titulo:'Última convocatoria (OEP 2023): bases y temario',descripcion:'20 plazas de Auxiliar Administratiu (C2) de la Diputació de Girona (BOPG nº211 de 03/11/2023). Proceso resuelto. La Diputación tiene comprometidas hasta 12 plazas más en las OEP 2024/2025.',url:'https://ssl4.ddgi.cat/bopV1/pdf/2023/211/202321109018.pdf',status:'completed',order_index:1});
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
