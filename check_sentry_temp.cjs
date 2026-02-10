require('dotenv').config({ path: '.env.local' });

const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const SENTRY_ORG = 'vence-x2';

if (!SENTRY_AUTH_TOKEN) {
  console.log('SENTRY_AUTH_TOKEN no configurado');
  process.exit(1);
}

(async () => {
  try {
    // Obtener detalles del issue específico (useAuth error)
    const issueId = '90979406';

    const response = await fetch(
      `https://sentry.io/api/0/organizations/${SENTRY_ORG}/issues/${issueId}/events/`,
      {
        headers: {
          'Authorization': `Bearer ${SENTRY_AUTH_TOKEN}`
        }
      }
    );

    if (!response.ok) {
      console.log('Error Sentry API:', response.status, response.statusText);
      return;
    }

    const events = await response.json();

    if (!events || events.length === 0) {
      console.log('No hay eventos para este issue');
      return;
    }

    const event = events[0];

    console.log('=== DETALLES DEL ERROR ===');
    console.log('Titulo:', event.title);
    console.log('URL:', event.tags?.find(t => t.key === 'url')?.value || 'N/A');
    console.log('Browser:', event.tags?.find(t => t.key === 'browser')?.value || 'N/A');
    console.log('Fecha:', event.dateCreated);
    console.log('');
    console.log('Tags:');
    event.tags?.slice(0, 10).forEach(t => {
      console.log(`  ${t.key}: ${t.value}`);
    });
    console.log('');
    console.log('Mensaje:', event.message || event.culprit);
    console.log('');

    // Mostrar contexto si existe
    if (event.context) {
      console.log('Contexto:', JSON.stringify(event.context, null, 2));
    }

  } catch (e) {
    console.log('Error:', e.message);
  }
})();
