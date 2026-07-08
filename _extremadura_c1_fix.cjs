require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const OPO_ID = '21f10c08-e6ed-49e6-a0fc-4e166c8f1ad6';

const LANDING_DESC = 'Cuerpo Administrativo (Administración General, grupo C1) de la Junta de Extremadura: 11 plazas (OEP 2021-2023, Orden de 23/12/2024 acumulada por Orden de 17/12/2025). Examen único teórico-práctico de 62 preguntas. Temario oficial de 30 temas del DOE.';

(async () => {
  let err = 0; const fail = (m, e) => { if (e) { console.error('❌', m, e.message); err++; } };

  const r1 = await s.from('oposiciones').update({ landing_description: LANDING_DESC }).eq('id', OPO_ID);
  fail('landing_description', r1.error);

  await s.from('convocatorias').delete().eq('oposicion_id', OPO_ID);
  const r2 = await s.from('convocatorias').insert({
    oposicion_id: OPO_ID, año: 2025,
    convocatoria_numero: 'Orden 23/12/2024 (acum. Orden 17/12/2025)',
    convocatoria_fecha: '2024-12-23',
    convocatoria_dogv: 'DOE núm. 250, 27/12/2024 (acum. DOE núm. 244, 19/12/2025)',
    is_current: true, estado_proceso: 'lista_admitidos',
    oep_decreto: 'Acuerdo Consejo de Gobierno 15/12/2021 (OEP 2021) y 27/12/2023 (OEP 2023)',
    oep_fecha: '2023-12-27',
    plazas_libres: 9, plazas_discapacidad: 2,
    boe_publication_date: '2024-12-27',
    boe_reference: 'DOE núm. 250, 27/12/2024',
    inscription_start: '2026-01-12', inscription_deadline: '2026-02-06',
    exam_date: null, exam_date_approximate: true,
    programa_url: 'https://doe.juntaex.es/pdfs/doe/2024/2500o/24050212.pdf',
  });
  fail('convocatorias', r2.error);

  await s.from('convocatoria_hitos').delete().eq('oposicion_id', OPO_ID);
  const hitos = [
    { fecha: '2024-12-27', titulo: 'Convocatoria publicada en el DOE', descripcion: 'Orden de 23/12/2024 (DOE núm. 250). Cuerpo Administrativo, Especialidad Administración General. Concurso-oposición.', url: 'https://doe.juntaex.es/pdfs/doe/2024/2500o/24050212.pdf', status: 'completed', order_index: 1 },
    { fecha: '2025-12-19', titulo: 'Acumulación de plazas (11 plazas)', descripcion: 'Orden de 17/12/2025 (DOE núm. 244): acumula plazas de las OEP 2022-2023. Total: 11 plazas (9 libres + 2 discapacidad).', url: 'https://doe.juntaex.es/pdfs/doe/2025/2440o/25050191.pdf', status: 'completed', order_index: 2 },
    { fecha: '2026-01-12', titulo: 'Apertura del plazo de solicitudes', descripcion: '20 días hábiles, vía Portal del Candidato de la Junta de Extremadura.', url: null, status: 'completed', order_index: 3 },
    { fecha: '2026-02-06', titulo: 'Cierre del plazo de solicitudes', descripcion: null, status: 'completed', order_index: 4 },
    { fecha: '2026-04-29', titulo: 'Modificación de la estructura del ejercicio', descripcion: 'Orden de 22/04/2026 (DOE núm. 81): el ejercicio pasa a 62 preguntas (50 teóricas + 12 prácticas) en 110 minutos.', url: 'https://doe.juntaex.es/pdfs/doe/2026/810o/26050044.pdf', status: 'completed', order_index: 5 },
    { fecha: '2026-05-18', titulo: 'Listas definitivas de admitidos', descripcion: 'Resolución de 18/05/2026 de la Dirección General de Función Pública.', url: null, status: 'completed', order_index: 6 },
    { fecha: '2026-07-01', titulo: 'Examen (primer ejercicio)', descripcion: 'Previsión 1er semestre 2026. La fecha, hora y lugar se publican por Resolución en el DOE.', url: null, status: 'upcoming', order_index: 7 },
  ];
  const r3 = await s.from('convocatoria_hitos').insert(hitos.map(h => ({ ...h, oposicion_id: OPO_ID })));
  fail('hitos', r3.error);

  console.log(err === 0 ? '✅ FIX OK' : `⚠️ ${err} errores`);
})();
