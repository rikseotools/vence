// Envía la respuesta a Lú Henao y cierra el feedback (resolved) vía endpoint atómico.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const FEEDBACK_ID = '228e8368-14c0-472d-a6f8-f5ce8eb85c3d';
const ADMIN_ID = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';
const MESSAGE = `Hola Lú,

Gracias por avisarnos y perdona las molestias. Lo que notaste (la sesión que se cerraba, la racha que no avanzaba y algún test que parecía no haberse hecho) venía de una actualización reciente, y ya está corregido.

Lo importante: tus tests no se han perdido. Hemos recuperado los que se habían quedado sin registrar esos días, así que ya los verás en tu historial y en Mis Estadísticas, y tu racha vuelve a reflejar los días seguidos que llevas.

Si al entrar todavía ves algo raro, recarga la página una vez y quedará al día. Cualquier cosa, aquí nos tienes.

Un saludo,
Equipo Vence`;

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
