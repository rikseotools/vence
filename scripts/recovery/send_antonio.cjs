// Envía la respuesta a Antonio López y cierra el feedback (resolved) vía endpoint atómico.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const FEEDBACK_ID = 'd3760036-128a-4b44-b1bd-70eb234f7c8c';
const ADMIN_ID = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';
const MESSAGE = `Hola Antonio

Gracias por avisar. Te aclaro cómo está repartida la Constitución en tu temario, porque esos títulos sí los tienes disponibles, solo que en temas distintos al Tema 1:

El Tema 1 cubre la parte inicial: título preliminar, derechos y deberes (Título I) y la Corona (Título II). Por eso, dentro del Tema 1, los títulos siguientes te aparecen en gris.

Los Títulos III (Cortes Generales) y IV (Gobierno y Administración) los tienes en el Tema 2 ("Las Cortes Generales, el Gobierno, el Poder Judicial y las leyes"), con cientos de preguntas.

El Título VIII (Organización territorial del Estado) está en el Tema 3, también con muchas preguntas.

Además, tenías razón en el Título V (relaciones entre el Gobierno y las Cortes Generales): no se estaba mostrando bien y ya lo hemos corregido, lo tienes disponible en el Tema 2.

Para cualquier asunto estamos a tu disposición.`;

(async () => {
  const admin = createClient(URL, SR);
  const { data: link, error: le } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'manueltrader@gmail.com' });
  if (le) throw new Error('generateLink: ' + le.message);
  const anon = createClient(URL, ANON);
  const { data: ses, error: ve } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  if (ve) throw new Error('verifyOtp: ' + ve.message);
  const token = ses.session.access_token;
  console.log('token admin obtenido ✓');

  const res = await fetch('https://www.vence.es/api/v2/feedback/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ feedbackId: FEEDBACK_ID, adminUserId: ADMIN_ID, message: MESSAGE, finalStatus: 'resolved' }),
  });
  const txt = await res.text();
  console.log('HTTP', res.status);
  try { console.log('resp:', JSON.stringify(JSON.parse(txt), null, 2)); }
  catch { console.log('resp (no-JSON, posible 504 gotcha):', txt.slice(0, 200)); }
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
