require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PT='auxiliar_administrativo_diputacion_segovia', SLUG='auxiliar-administrativo-diputacion-segovia';
const t=require('./data/temarios/auxiliar-administrativo-diputacion-segovia.json');
const titles={
 1:'La Constitución Española: derechos y deberes fundamentales',2:'La Corona, las Cortes Generales y órganos de control',3:'El Gobierno en el sistema constitucional',4:'El Poder Judicial y el CGPJ',5:'Organización territorial y el Estatuto de Castilla y León',6:'La Unión Europea: instituciones y fuentes',7:'El ordenamiento administrativo y los interesados',8:'El acto administrativo, la notificación y el registro',9:'El procedimiento administrativo común (I)',10:'El procedimiento administrativo común (II)',11:'Los recursos administrativos',12:'El Régimen Local: fuentes y potestad normativa',13:'El municipio: organización y competencias',14:'La provincia y el funcionamiento de los órganos colegiados',15:'Las competencias de la provincia y la cooperación municipal',16:'La actividad subvencional',17:'Los contratos del Sector Público',18:'Los empleados públicos: régimen jurídico y disciplinario',19:'El empleo público: acceso y situaciones administrativas',20:'El sistema tributario y las Haciendas Locales',21:'El presupuesto de las Entidades Locales',22:'El gasto público local y su control',23:'La atención al público y la administración electrónica',24:'Los Servicios Sociales de Castilla y León (Ley 16/2010)',25:'La Ley de Dependencia (Ley 39/2006)',26:'Transparencia y protección de datos',27:'Igualdad y violencia de género (LO 3/2007 y LO 1/2004)',28:'Prevención de riesgos laborales y pantallas de visualización',29:'Informática básica, Windows y ofimática (Word, Excel, Access)',30:'Internet y seguridad informática',
};
const L={CE:'6ad91a6c-41ec-431f-9c80-5f5566834941',ECYL:'383d7ceb-0c2f-4e69-a699-40a7e1f762de',TUE:'ddc2ffa9-d99b-4abc-b149-ab47916ab9da',L39:'218452f5-b9f6-48f0-a25b-26df9cb19644',L40:'95680d57-feb1-41c0-bb27-236024815feb',LBRL:'06784434-f549-4ea2-894f-e2e400881545',ROF:'79de036c-e4aa-44a5-b3fc-4b0307fb0a34',SUBV:'09c18214-a630-4ae8-9f63-a742919f7f4c',L9:'4f605392-8137-4962-9e66-ca5f275e93ee',EBEP:'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0',TRLRHL:'5fcc4f3a-a719-415f-958f-46c840e1c4e7',L19:'a7bd0e06-7dcb-4a25-911b-e16f6e5e0798',LOPD:'146b7e50-e089-44a6-932c-773954f8d96b',LO3:'6e59eacd-9298-4164-9d78-9e9343d9a900',LO1:'f5c17b23-2547-43d2-800c-39f5ea925c2f',LPRL:'8b1ae300-4ed3-4019-876c-780ea40ebbfe',DEP:'02a0a8db-af96-45d0-8fd4-4d24b825cb13',PVD:'0634a972-f288-4e9d-8c69-2790420f5b89',SS:'3dceb9c4',INFO:'82fd3977-ecf7-4f36-a6df-95c41445d3c2',WIN10:'cb536623-fb75-429c-a839-0154b76ee27b',WORD:'86f671a9-4fd8-42e6-91db-694f27eb4292',EXCEL:'c7475712-5ae4-4bec-9bd5-ff646c378e33',ACCESS:'b403019a-bdf7-4795-886e-1d26f139602d',NET:'7814de3a-7c9c-4045-88c2-d452b31f449a',SEG:'b603177f-bf78-4028-882e-bd41e0322462'};
const R=(a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(String(i));return o;};
const A=(law,arr)=>({law_id:law,article_numbers:arr,include_full_title:false});
const F=(law)=>({law_id:law,article_numbers:null,include_full_title:true});
const SCOPE={
 1:[A(L.CE,R(1,55))],2:[A(L.CE,[...R(56,72),'136'])],3:[A(L.CE,R(97,107))],4:[A(L.CE,R(117,127))],
 5:[A(L.CE,R(137,158)),A(L.ECYL,R(1,30))],6:[A(L.TUE,R(1,55))],
 7:[A(L.L39,R(3,13))],8:[A(L.L39,[...R(34,46),'16'])],9:[A(L.L39,[...R(16,18),...R(66,76)])],10:[A(L.L39,[...R(21,25),...R(84,95)])],11:[A(L.L39,R(112,126))],
 12:[A(L.LBRL,R(1,7))],13:[A(L.LBRL,[...R(11,21),'25','26'])],14:[A(L.LBRL,R(31,38)),F(L.ROF)],15:[A(L.LBRL,['36'])],
 16:[A(L.SUBV,R(22,37))],17:[A(L.L9,R(12,27))],18:[A(L.EBEP,[...R(8,15),...R(93,98)])],19:[A(L.EBEP,[...R(55,63),...R(85,90)])],
 20:[A(L.TRLRHL,[...R(2,9),...R(15,27)])],21:[A(L.TRLRHL,R(162,171))],22:[A(L.TRLRHL,R(172,193))],
 23:[A(L.L39,['13','53']),A(L.L40,R(38,46))],
 24:[F(L.SS)],25:[A(L.DEP,R(1,30))],26:[A(L.L19,R(1,12)),A(L.LOPD,R(1,18))],27:[A(L.LO3,R(1,12)),A(L.LO1,['1','2','17','18','19','20'])],28:[A(L.LPRL,R(1,16)),F(L.PVD)],
 29:[F(L.INFO),F(L.WIN10),F(L.WORD),F(L.EXCEL),F(L.ACCESS)],30:[F(L.NET),F(L.SEG)],
};
(async()=>{
  if(L.SS.length<20){const {data}=await s.from('laws').select('id').eq('slug','ley-16-2010-servicios-sociales-cyl').single();L.SS=data.id;SCOPE[24]=[F(L.SS)];}
  await s.from('topics').delete().eq('position_type',PT);
  await s.from('oposicion_bloques').delete().eq('position_type',PT);
  const rows=t.temario.map(x=>({position_type:PT,topic_number:x.n,title:titles[x.n],description:x.epi,epigrafe:x.epi,descripcion_corta:titles[x.n]+'.',difficulty:'medium',estimated_hours:12,bloque_number:1,display_number:x.n,disponible:false,is_active:true}));
  await s.from('topics').insert(rows);
  await s.from('oposicion_bloques').insert({position_type:PT,bloque_number:1,titulo:'Programa oficial (30 temas)',icon:'🏛️',sort_order:1});
  console.log('✅ 30 topics + 1 bloque');
  const examen_config={tipo:'oposición (3 ejercicios)',penalizacion:'acierto +0,25 / error -0,10',total_preguntas:40,opciones:4,duracion_total_minutos:null,partes:[{nombre:'1er ejercicio (test)',preguntas:40,opciones:4,puntuacion_max:10},{nombre:'2º ejercicio (preguntas abiertas)',puntuacion_min:5,puntuacion_max:10},{nombre:'3er ejercicio (práctico Office)',puntuacion_min:7.5,puntuacion_max:15}],notas:'Oposición turno libre. Temario y estructura de la convocatoria 2023 (BOCyL nº120). 1er ejercicio: test de 40 preguntas (+4 reserva), 4 opciones; acierto 0,25, error -0,10, en blanco 0; nota de corte fijada por el tribunal. 2º: 10-20 preguntas abiertas (mín 5/10). 3º: práctico con Office 2016+ sobre Windows 10 (mín 7,5/15). (Base para la OEP 2025, 4 plazas.)'};
  const boe_ref='4 plazas Auxiliar Administrativo (C2, 2 reserva discapacidad), oposición. OEP 2025 (Diputación de Segovia), bases pendientes. Temario de la convocatoria 2023 (BOCyL nº120, 12 plazas).';
  await s.from('oposiciones').update({
    nombre:'Auxiliar Administrativo de la Diputación Provincial de Segovia',short_name:'Aux. Dip. Segovia',grupo:'C',subgrupo:'C2',categoria:'C2',administracion:'Local',titulo_requerido:'Graduado en ESO o equivalente',temas_count:30,bloques_count:1,
    plazas_libres:2,plazas_discapacidad:2,plazas_promocion_interna:0,estado_proceso:'oep_aprobada',is_convocatoria_activa:true,exam_date:null,exam_date_approximate:false,
    boe_reference:boe_ref,diario_oficial:'BOP Segovia / BOCyL',diario_referencia:'OEP 2025 (Diputación de Segovia). Temario: BOCyL nº120, 23/06/2023',
    programa_url:'https://bocyl.jcyl.es/boletines/2023/06/23/pdf/BOCYL-D-23062023-26.pdf',
    seguimiento_url:'https://www.dipsegovia.es/la-institucion/servicios/servicio-de-personal/oferta-de-empleo/ofertas-de-empleo-publico',
    oep_decreto:'OEP 2025 (Diputación Provincial de Segovia)',oep_fecha:'2025-06-12',convocatoria_numero:'OEP-SEGOVIA-2025',convocatoria_fecha:'2025-06-12',convocatoria_dogv:null,
    color_primario:'teal',landing_difficulty:'Intermedio',landing_duration:'6-12 meses',
    seo_title:'Auxiliar Administrativo Diputación de Segovia | Tests Vence',
    seo_description:'Prepara la oposición de Auxiliar Administrativo de la Diputación de Segovia (C2, OEP 2025). Tests del temario oficial (30 temas) con explicaciones. Empieza gratis.',
    landing_description:'Oposición a 4 plazas de Auxiliar Administrativo (Escala Administración General, Subescala Auxiliar, C2) de la Diputación Provincial de Segovia, turno libre por el sistema de oposición (OEP 2025; bases pendientes de convocar). El temario (30 temas) corresponde a la última convocatoria equivalente (2023, BOCyL nº120): Constitución, Estatuto de Castilla y León, Unión Europea, Ley 39/2015, régimen local, contratos, subvenciones, función pública, haciendas y presupuestos locales, servicios sociales de Castilla y León, dependencia, transparencia, protección de datos, igualdad, prevención de riesgos y ofimática (Windows, Word, Excel, Access). Tres ejercicios: test, preguntas abiertas y prueba práctica.',
    examen_config,
    landing_estadisticas:[{numero:'4',texto:'Plazas (OEP 2025)',color:'text-green-600'},{numero:'{temasCount}',texto:'Temas oficiales',color:'text-blue-600'},{numero:'40',texto:'Preguntas (test)',color:'text-purple-600'},{numero:'ESO',texto:'Título requerido',color:'text-orange-600'}],
    landing_faqs:[
      {pregunta:'¿Cuántas plazas hay?',respuesta:'La OEP 2025 de la Diputación de Segovia incluye 4 plazas de Auxiliar de Administración General (C2), 2 de ellas reservadas a discapacidad. Las bases están pendientes de convocar; preparándote ahora llegarás con ventaja.'},
      {pregunta:'¿Cómo es el examen?',respuesta:'Sistema de oposición. Según la última convocatoria equivalente (2023), son tres ejercicios eliminatorios: un test de 40 preguntas (acierto 0,25, error -0,10), un ejercicio de 10-20 preguntas abiertas y una prueba práctica de ofimática (Word, Excel, Access sobre Windows). La nueva convocatoria podría ajustar estos detalles.'},
      {pregunta:'¿Qué temario entra?',respuesta:'30 temas: Constitución, Estatuto de Castilla y León, Unión Europea, Ley 39/2015, régimen local (municipio, provincia, competencias), subvenciones, contratos, empleo público, haciendas y presupuestos locales, servicios sociales de Castilla y León (Ley 16/2010), dependencia (Ley 39/2006), atención al ciudadano, transparencia, protección de datos, igualdad, prevención de riesgos y ofimática (Windows, Word, Excel, Access e Internet).'},
      {pregunta:'¿Qué requisitos se piden?',respuesta:'Título de Graduado en ESO, Graduado Escolar o equivalente, y los requisitos generales de acceso al empleo público.'},
      {pregunta:'¿Cuándo es el examen?',respuesta:'La convocatoria de las 4 plazas de la OEP 2025 aún no se ha publicado. Es buen momento para ir preparando el temario, que se basa en la convocatoria anterior de la Diputación (2023).'}
    ],
    requisitos_especiales:[{tipo:'ofimatica',descripcion:'Microsoft Office 2016+ (Word, Excel, Access) sobre Windows 10 — prueba práctica'}]
  }).eq('slug',SLUG);
  console.log('✅ fila oposiciones Segovia');
  const {data:o}=await s.from('oposiciones').select('*').eq('slug',SLUG).single();
  await s.from('convocatorias').delete().eq('oposicion_id',o.id);
  await s.from('convocatorias').insert({oposicion_id:o.id,'año':2025,convocatoria_numero:'OEP-SEGOVIA-2025',convocatoria_fecha:'2025-06-12',convocatoria_dogv:'OEP 2025; temario BOCyL nº120 23/06/2023',is_current:true,estado_proceso:'oep_aprobada',oep_decreto:o.oep_decreto,oep_fecha:o.oep_fecha,plazas_libres:2,plazas_discapacidad:2,plazas_promocion_interna:0,boe_publication_date:'2025-06-12',boe_reference:o.boe_reference,exam_date:null,exam_date_approximate:false,programa_url:o.programa_url,examen_config,landing_faqs:o.landing_faqs,landing_estadisticas:o.landing_estadisticas,landing_description:o.landing_description,requisitos_especiales:o.requisitos_especiales});
  await s.from('convocatoria_hitos').delete().eq('oposicion_id',o.id);
  await s.from('convocatoria_hitos').insert({oposicion_id:o.id,fecha:'2025-06-12',titulo:'OEP 2025 aprobada (4 plazas)',descripcion:'La OEP 2025 de la Diputación de Segovia incluye 4 plazas de Auxiliar de Administración General (C2), 2 reservadas a discapacidad. Bases pendientes de convocar.',url:'https://www.dipsegovia.es/la-institucion/servicios/servicio-de-personal/oferta-de-empleo/ofertas-de-empleo-publico',status:'completed',order_index:1});
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
