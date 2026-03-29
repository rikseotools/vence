# Investigar Journey de Usuario

Procedimiento para reconstruir el journey completo de un usuario cuando reporta un bug o incidencia.

## 1. Identificar al usuario

El email del ticket de soporte puede NO coincidir con el email de la cuenta. Buscar por:

```js
// Por email exacto
const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
const user = users.find(u => u.email === 'email@example.com');

// Por nombre en metadata (Google login guarda full_name)
const matches = users.filter(u =>
  JSON.stringify(u.user_metadata || {}).toLowerCase().includes('nombre')
);

// Por fecha de registro (si el screenshot del admin lo muestra)
const byDate = users.filter(u => u.created_at?.startsWith('2026-03-04'));
```

Una vez encontrado el `userId`, obtener el profile:

```js
const { data: profile } = await supabase.from('user_profiles')
  .select('*').eq('id', userId).single();
```

## 2. Tabla principal: user_interactions

Esta tabla registra TODOS los clicks, page views, navegacion y eventos del usuario. Es la fuente de verdad del journey.

```js
const { data: interactions } = await supabase.from('user_interactions')
  .select('event_type, action, label, element_text, page_url, created_at')
  .eq('user_id', userId)
  .order('created_at', { ascending: true });
```

**Campos clave:**
- `event_type`: `page_view`, `page_exit`, `click`, `test_answer_selected`, `test_navigation_next`, `test_test_completed`
- `page_url`: la pagina donde ocurrio
- `element_text`: texto del boton/link clickeado
- `action`: `button`, `a`, `input`, `view`, `unload`

**Para filtrar por fecha:**
```js
.gte('created_at', '2026-03-29T00:00:00')
.lte('created_at', '2026-03-29T23:59:59')
```

## 3. Tablas complementarias

### Tests completados
```js
const { data: tests } = await supabase.from('tests')
  .select('title, test_type, tema_number, law_short_name, total_questions, score, created_at, completed_at, test_url, status')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

### Respuestas individuales (via test_id)
```js
// Primero obtener los test IDs
const testIds = tests.map(t => t.id);
const { data: questions } = await supabase.from('test_questions')
  .select('question_id, user_answer, is_correct, time_spent_seconds, answered_at')
  .in('test_id', testIds)
  .order('answered_at', { ascending: true });
```

### Historial de preguntas
```js
const { data: history } = await supabase.from('user_question_history')
  .select('question_id, total_attempts, correct_attempts, success_rate, personal_difficulty, last_attempt_at')
  .eq('user_id', userId)
  .order('last_attempt_at', { ascending: false });
```

### Uso diario
```js
const { data: usage } = await supabase.from('daily_question_usage')
  .select('usage_date, questions_answered')
  .eq('user_id', userId)
  .order('usage_date', { ascending: false });
```

### Sesiones (dispositivo, duracion, engagement)
```js
const { data: sessions } = await supabase.from('user_sessions')
  .select('session_start, session_end, total_duration_minutes, pages_visited, tests_completed, questions_answered, entry_page, device_model, user_agent')
  .eq('user_id', userId)
  .order('session_start', { ascending: false });
```

### Chat IA
```js
const { data: chat } = await supabase.from('ai_chat_logs')
  .select('user_message, detected_intent, detected_laws, created_at')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

### Errores del servidor
```js
const { data: errors } = await supabase.from('validation_error_logs')
  .select('endpoint, status_code, error_type, request_body, created_at')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

### Feedback y soporte
```js
const { data: feedback } = await supabase.from('user_feedback')
  .select('type, message, page_url, created_at')
  .eq('user_id', userId);
```

### Eventos PWA
```js
const { data: pwa } = await supabase.from('pwa_events')
  .select('event_type, device_info, browser_info, created_at')
  .eq('user_id', userId);
```

### Streaks
```js
const { data: streaks } = await supabase.from('user_streaks')
  .select('current_streak, longest_streak, last_activity_date')
  .eq('user_id', userId);
```

### Eventos de conversion
```js
const { data: conversions } = await supabase.from('conversion_events')
  .select('*').eq('user_id', userId);
```

### Notificaciones
```js
const { data: notifs } = await supabase.from('notification_events')
  .select('event_type, metadata, created_at')
  .eq('user_id', userId);
```

### Emails
```js
const { data: emails } = await supabase.from('email_events')
  .select('email_type, event_type, subject, open_count, click_count, created_at')
  .eq('user_id', userId);
```

## 4. Reconstruir timeline

Consolidar todos los eventos en orden cronologico:

```js
const timeline = [];
interactions?.forEach(i => timeline.push({
  time: i.created_at, type: i.event_type,
  detail: i.action + ' ' + (i.element_text || i.label || ''),
  page: i.page_url
}));
tests?.forEach(t => timeline.push({
  time: t.created_at, type: 'TEST',
  detail: t.title + ' ' + t.total_questions + 'q score=' + t.score
}));
// ... agregar mas tablas

timeline.sort((a, b) => a.time.localeCompare(b.time));
```

## 5. Senales de alerta a buscar

| Senal | Significado |
|-------|-------------|
| `page_view` sin `page_exit` | La pagina se colgo o el usuario cerro pestana |
| `page_view` → `page_exit` sin clicks | Bounce - la pagina no cargo bien |
| Click en boton sin evento posterior | El boton no funciono |
| `test_answer_selected` sin `test_test_completed` | Test abandonado |
| `validation_error_logs` con 4xx/5xx | Error del servidor |
| Solicitud eliminacion cuenta | Usuario frustrado |
| Multiples clicks rapidos en mismo boton | UI no responde |
| `page_url` con tema/ley pero 0 tests | La pagina carga pero no deja hacer test |

## 6. Script rapido

Para ejecutar desde Claude Code:

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const userId = 'PONER_USER_ID_AQUI';
const fecha = '2026-03-29T00:00:00'; // filtrar desde

(async () => {
  const { data } = await supabase.from('user_interactions')
    .select('event_type, action, element_text, page_url, created_at')
    .eq('user_id', userId)
    .gte('created_at', fecha)
    .order('created_at', { ascending: true });

  let currentPage = '';
  for (const i of data || []) {
    if (i.page_url !== currentPage) {
      console.log('\\n> ' + i.page_url);
      currentPage = i.page_url;
    }
    console.log('  ' + i.created_at?.substring(11,19) + ' [' + i.event_type + '] ' + (i.element_text || '').substring(0,50));
  }
})();
"
```
