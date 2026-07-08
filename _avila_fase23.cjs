require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PT='auxiliar_administrativo_diputacion_avila', SLUG='auxiliar-administrativo-diputacion-avila';
const t=require('./data/temarios/auxiliar-administrativo-diputacion-avila.json');
const titles={
 1:'La Constitución Española: derechos y deberes fundamentales',2:'La Corona',3:'Las Cortes Generales y órganos de control',4:'El Gobierno en el sistema constitucional',5:'El Poder Judicial y el CGPJ',6:'Organización territorial y el Estatuto de Castilla y León',7:'La Unión Europea',8:'El ordenamiento administrativo y los interesados',9:'El acto administrativo y la notificación',10:'El procedimiento administrativo común (I)',11:'El procedimiento administrativo común (II)',12:'Los recursos administrativos',13:'El Régimen Local: fuentes y potestad normativa',14:'El municipio: organización y competencias',15:'La provincia: organización y régimen de sesiones',16:'Las competencias de la provincia y los Planes Provinciales',17:'La actividad subvencional',18:'Los contratos del Sector Público',19:'Los empleados públicos: régimen jurídico y disciplinario',20:'El empleo público: acceso y situaciones administrativas',21:'La Hacienda Local y las Ordenanzas Fiscales',22:'Participación en tributos del Estado y CCAA',23:'El presupuesto general de las Entidades Locales',24:'Estructura, modificaciones y ejecución presupuestaria',25:'La atención al público',26:'La administración electrónica y la sede electrónica',27:'El registro de documentos',28:'Transparencia y protección de datos',29:'Prevención de Riesgos Laborales (Ley 31/1995)',30:'Igualdad y violencia de género (LO 3/2007 y LO 1/2004)',
};
const L={CE:'6ad91a6c-41ec-431f-9c80-5f5566834941',ECYL:'383d7ceb-0c2f-4e69-a699-40a7e1f762de',TUE:'ddc2ffa9-d99b-4abc-b149-ab47916ab9da',TFUE:'eba370d3-73d9-44a9-9865-48d2effabaf4',L39:'218452f5-b9f6-48f0-a25b-26df9cb19644',L40:'95680d57-feb1-41c0-bb27-236024815feb',LBRL:'06784434-f549-4ea2-894f-e2e400881545',SUBV:'09c18214-a630-4ae8-9f63-a742919f7f4c',L9:'4f605392-8137-4962-9e66-ca5f275e93ee',EBEP:'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0',TRLRHL:'5fcc4f3a-a719-415f-958f-46c840e1c4e7',L19:'a7bd0e06-7dcb-4a25-911b-e16f6e5e0798',LOPD:'146b7e50-e089-44a6-932c-773954f8d96b',LPRL:'8b1ae300-4ed3-4019-876c-780ea40ebbfe',LO3:'6e59eacd-9298-4164-9d78-9e9343d9a900',LO1:'f5c17b23-2547-43d2-800c-39f5ea925c2f',RD203:'21e40a28-26c7-420d-99b8-39eb3059dd4f',WORD:'86f671a9-4fd8-42e6-91db-694f27eb4292',EXCEL:'c7475712-5ae4-4bec-9bd5-ff646c378e33',INFO:'82fd3977-ecf7-4f36-a6df-95c41445d3c2'};
const R=(a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(String(i));return o;};
const A=(law,arr)=>({law_id:law,article_numbers:arr,include_full_title:false});
const F=(law)=>({law_id:law,article_numbers:null,include_full_title:true});
const SCOPE={
 1:[A(L.CE,R(1,55))],2:[A(L.CE,R(56,65))],3:[A(L.CE,[...R(66,96),'136'])],4:[A(L.CE,R(97,107))],5:[A(L.CE,R(117,127))],
 6:[A(L.CE,R(137,158)),A(L.ECYL,R(1,30))],7:[A(L.TUE,R(1,55))],
 8:[A(L.L39,R(3,13))],9:[A(L.L39,[...R(34,46)])],10:[A(L.L39,[...R(16,18),...R(66,76)])],11:[A(L.L39,[...R(21,25),...R(84,95)])],12:[A(L.L39,R(112,126))],
 13:[A(L.LBRL,[...R(1,7)])],14:[A(L.LBRL,[...R(11,21),'25','26'])],15:[A(L.LBRL,[...R(31,35),...R(46,52)])],16:[A(L.LBRL,['36'])],
 17:[A(L.SUBV,R(22,37))],18:[A(L.L9,R(12,27))],19:[A(L.EBEP,[...R(8,15),...R(93,98)])],20:[A(L.EBEP,[...R(55,63),...R(69,90)])],
 21:[A(L.TRLRHL,[...R(2,9),...R(15,27)])],22:[A(L.TRLRHL,[...R(38,40),...R(134,148)])],23:[A(L.TRLRHL,R(162,171))],24:[A(L.TRLRHL,R(172,193))],
 25:[A(L.L39,['13','53'])],26:[A(L.L40,R(38,46)),A(L.RD203,R(1,30))],27:[A(L.L39,['16','66'])],28:[A(L.L19,R(1,12)),A(L.LOPD,R(1,18))],29:[A(L.LPRL,R(1,16))],30:[A(L.LO3,R(1,12)),A(L.LO1,['1','2','17','18','19','20'])],
};
(async()=>{
  await s.from('topics').delete().eq('position_type',PT);
  await s.from('oposicion_bloques').delete().eq('position_type',PT);
  const rows=t.temario.map(x=>({position_type:PT,topic_number:x.n,title:titles[x.n],description:x.epi,epigrafe:x.epi,descripcion_corta:titles[x.n]+'.',difficulty:'medium',estimated_hours:12,bloque_number:x.bloque,display_number:x.n,disponible:false,is_active:true}));
  await s.from('topics').insert(rows);
  await s.from('oposicion_bloques').insert(t.bloques.map(b=>({position_type:PT,bloque_number:b.n,titulo:b.titulo,icon:b.n===1?'🏛️':'⚖️',sort_order:b.n})));
  console.log('✅ 30 topics + 2 bloques');
  const examen_config={tipo:'oposición (2 ejercicios)',penalizacion:'cada error -1/3',total_preguntas:60,opciones:4,duracion_total_minutos:70,partes:[{nombre:'1er ejercicio (test teórico)',preguntas:60,opciones:4,duracion_minutos:70,puntuacion_min:5},{nombre:'2º ejercicio (práctico Word+Excel)',puntuacion_min:5}],notas:'Oposición turno libre. Temario y estructura de la convocatoria 2020 (BOCyL nº182). 1er ejercicio: test de 60 preguntas (+6 reserva), 4 opciones, cada error resta 1/3; 70 min; mín 5/10. 2º ejercicio: práctico de Word y Excel; mín 5/10. (Base para la OEP 2024, 4 plazas.)'};
  const boe_ref='4 plazas Auxiliar Administrativo (C2, 3 turno libre + 1 discapacidad), oposición. OEP 2024 (BOP Ávila nº252 30/12/2024), bases pendientes. Temario de la convocatoria 2020 (BOCyL nº182, 12 plazas).';
  await s.from('oposiciones').update({
    nombre:'Auxiliar Administrativo de la Diputación Provincial de Ávila',short_name:'Aux. Dip. Ávila',grupo:'C',subgrupo:'C2',categoria:'C2',administracion:'Local',titulo_requerido:'Graduado en ESO o equivalente',temas_count:30,bloques_count:2,
    plazas_libres:3,plazas_discapacidad:1,plazas_promocion_interna:0,estado_proceso:'oep_aprobada',is_convocatoria_activa:true,exam_date:null,exam_date_approximate:false,
    boe_reference:boe_ref,diario_oficial:'BOP Ávila / BOCyL',diario_referencia:'OEP 2024: BOP Ávila nº252, 30/12/2024. Temario: BOCyL nº182, 03/09/2020',
    programa_url:'https://www.diputacionavila.es/bops/2024/30-12-2024/30-12-2024_308524.pdf',
    seguimiento_url:'https://www.diputacionavila.es/recursos-humanos/oferta-de-empleo-publico',
    oep_decreto:'OEP 2024 (Diputación Provincial de Ávila)',oep_fecha:'2024-12-30',convocatoria_numero:'BOP-AVILA-252-2024',convocatoria_fecha:'2024-12-30',convocatoria_dogv:null,
    color_primario:'emerald',landing_difficulty:'Intermedio',landing_duration:'6-12 meses',
    seo_title:'Auxiliar Administrativo Diputación de Ávila | Tests Vence',
    seo_description:'Prepara la oposición de Auxiliar Administrativo de la Diputación de Ávila (C2, OEP 2024). Tests del temario oficial (30 temas) con explicaciones. Empieza gratis.',
    landing_description:'Oposición a 4 plazas de Auxiliar Administrativo (Escala Administración General, Subescala Auxiliar, C2) de la Diputación Provincial de Ávila, turno libre por el sistema de oposición (OEP 2024, BOP Ávila nº252 de 30/12/2024; bases pendientes de convocar). El temario (30 temas) corresponde a la última convocatoria equivalente (2020, BOCyL nº182): Constitución, Estatuto de Castilla y León, Unión Europea, Ley 39/2015, régimen local, contratos, subvenciones, función pública, haciendas y presupuestos locales, transparencia, protección de datos, prevención de riesgos, igualdad y ofimática (Word y Excel). Dos ejercicios: test y prueba práctica.',
    examen_config,
    landing_estadisticas:[{numero:'4',texto:'Plazas (OEP 2024)',color:'text-green-600'},{numero:'{temasCount}',texto:'Temas oficiales',color:'text-blue-600'},{numero:'60',texto:'Preguntas (test)',color:'text-purple-600'},{numero:'ESO',texto:'Título requerido',color:'text-orange-600'}],
    landing_faqs:[
      {pregunta:'¿Cuántas plazas hay?',respuesta:'La OEP 2024 de la Diputación de Ávila incluye 4 plazas de Auxiliar Administrativo (C2): 3 de turno libre y 1 reservada a discapacidad. Las bases están pendientes de convocar; preparándote ahora llegarás con ventaja.'},
      {pregunta:'¿Cómo es el examen?',respuesta:'Sistema de oposición. Según la última convocatoria equivalente (2020), son dos ejercicios eliminatorios: un test de 60 preguntas con 4 opciones (70 minutos, cada error resta 1/3) y una prueba práctica de Word y Excel. Hay que sacar al menos 5/10 en cada uno. La nueva convocatoria podría ajustar estos detalles.'},
      {pregunta:'¿Qué temario entra?',respuesta:'30 temas: Constitución, Corona, Cortes, Gobierno y Poder Judicial, Estatuto de Castilla y León, Unión Europea, Ley 39/2015, régimen local (municipio, provincia, competencias), subvenciones, contratos, empleo público, haciendas locales y presupuestos, atención al público, administración electrónica, transparencia y protección de datos, prevención de riesgos, igualdad y ofimática (Word y Excel).'},
      {pregunta:'¿Qué requisitos se piden?',respuesta:'Título de Graduado en ESO o equivalente y los requisitos generales de acceso al empleo público.'},
      {pregunta:'¿Cuándo es el examen?',respuesta:'La convocatoria de las 4 plazas de la OEP 2024 aún no se ha publicado. Es buen momento para ir preparando el temario, que se basa en la convocatoria anterior de la Diputación.'}
    ],
    requisitos_especiales:[{tipo:'ofimatica',descripcion:'Microsoft Office (Word y Excel) — prueba práctica'}]
  }).eq('slug',SLUG);
  console.log('✅ fila oposiciones Ávila');
  const {data:o}=await s.from('oposiciones').select('*').eq('slug',SLUG).single();
  await s.from('convocatorias').delete().eq('oposicion_id',o.id);
  await s.from('convocatorias').insert({oposicion_id:o.id,'año':2024,convocatoria_numero:'BOP-AVILA-252-2024',convocatoria_fecha:'2024-12-30',convocatoria_dogv:'BOP Ávila nº252, 30/12/2024 (OEP)',is_current:true,estado_proceso:'oep_aprobada',oep_decreto:o.oep_decreto,oep_fecha:o.oep_fecha,plazas_libres:3,plazas_discapacidad:1,plazas_promocion_interna:0,boe_publication_date:'2024-12-30',boe_reference:o.boe_reference,exam_date:null,exam_date_approximate:false,programa_url:o.programa_url,examen_config,landing_faqs:o.landing_faqs,landing_estadisticas:o.landing_estadisticas,landing_description:o.landing_description,requisitos_especiales:o.requisitos_especiales});
  await s.from('convocatoria_hitos').delete().eq('oposicion_id',o.id);
  await s.from('convocatoria_hitos').insert({oposicion_id:o.id,fecha:'2024-12-30',titulo:'OEP 2024 aprobada (4 plazas)',descripcion:'La OEP 2024 de la Diputación de Ávila incluye 4 plazas de Auxiliar Administrativo (C2): 3 turno libre + 1 discapacidad. BOP Ávila nº252 de 30/12/2024. Bases pendientes de convocar.',url:'https://www.diputacionavila.es/bops/2024/30-12-2024/30-12-2024_308524.pdf',status:'completed',order_index:1});
  console.log('✅ §2c + hito');
  const {data:tp}=await s.from('topics').select('id,topic_number').eq('position_type',PT);
  const byN={};tp.forEach(x=>byN[x.topic_number]=x.id);
  await s.from('topic_scope').delete().in('topic_id',tp.map(x=>x.id));
  let scope=[];for(const[n,e]of Object.entries(SCOPE))for(const x of e)scope.push({topic_id:byN[n],...x});
  await s.from('topic_scope').insert(scope);
  console.log('✅ '+scope.length+' filas scope');
  for(let n=1;n<=30;n++){
    let ids=[];for(const e of SCOPE[n]){let q=s.from('articles').select('id').eq('law_id',e.law_id);if(e.article_numbers)q=q.in('article_number',e.article_numbers);const{data:a}=await q;ids.push(...(a||[]).map(x=>x.id));}
    let c=0;for(let i=0;i<ids.length;i+=200){const{count}=await s.from('questions').select('id',{count:'exact',head:true}).in('primary_article_id',ids.slice(i,i+200)).eq('is_active',true);c+=count||0;}
    await s.from('topics').update({disponible:c>0}).eq('position_type',PT).eq('topic_number',n);
    console.log('T'+String(n).padStart(2)+': '+String(c).padStart(5)+' → '+(c>0));
  }
})();
