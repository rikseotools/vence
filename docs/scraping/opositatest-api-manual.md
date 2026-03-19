# Manual de API de OpositaTest

> **Fecha:** Marzo 2026
> **Propósito:** Documentación completa de endpoints, flujos de scraping y hallazgos de seguridad

---

## Notas Importantes (Lecciones Aprendidas)

1. **Usar `node fetch`, NO `curl`**: Las APIs devuelven respuestas vacías con curl pero funcionan con node fetch.
2. **El endpoint `/api/v2.0/oppositions/{id}?embedded=contents` NO funciona** en la API pública. Usar `admin.opositatest.com` para la estructura.
3. **Para descubrir temas/epígrafes**: La forma fiable es crear un test con `examId` y extraer los `contents` de las preguntas (no hay endpoint directo fiable).
4. **El `mainContentId` de la URL del frontend = `oppositionId`** de la API admin.
5. **Para buscar IDs de oposiciones**: `admin.opositatest.com/api/v2.0/opposition-categories?embedded=oppositions`
6. **Google login NO funciona** con Playwright (detecta automatización). Usar login con usuario/contraseña o extraer JWT manualmente desde DevTools (F12 → Network → Fetch/XHR → click en petición a api.opositatest → Encabezados de solicitud → Authorization).
7. **Algunas oposiciones incluyen psicotécnicos** además de temas legislativos (ej: Auxiliar Madrid tiene 8 bloques de psicotécnicos).

---

## Arquitectura

OpositaTest usa una arquitectura de microservicios:

| Servicio | URL Base | Función |
|----------|----------|---------|
| **API Principal** | `api.opositatest.com` | Endpoints de datos (tests, preguntas, usuarios) |
| **Admin** | `admin.opositatest.com` | API administrativa (exámenes, oposiciones, contenidos) |
| **Subscriptions** | `subscriptions.opositatest.com` | Gestión de suscripciones |
| **Aula** | `aula.opositatest.com` | Frontend web |

### URLs Principales del Frontend

| URL | Función |
|-----|---------|
| `/classroom/test-configurator?mainContentId={id}` | Configurador de tests para oposición |
| `/classroom/doing-test/{testId}` | Realizar test en curso |
| `/classroom/test/{testId}/results` | Resultados de test |
| `/classroom/saved-tests` | Tests guardados del usuario |

---

## Autenticación

### JWT Bearer Token

Todas las peticiones autenticadas requieren header:
```
Authorization: Bearer <JWT_TOKEN>
```

El token JWT:
- Algoritmo: **RS256** (asimétrico, clave pública/privada)
- Expira en ~24 horas
- Contiene: `iat`, `exp`, `roles`, `username`, `id`, `nickname`, `picture`
- **NO** contiene información de suscripción (se verifica via microservicio)

### Extraer JWT

#### Metodo 1: Manual desde DevTools (RECOMENDADO)

Google bloquea el login OAuth en navegadores controlados por Playwright. La forma mas fiable:

1. Abrir OpositaTest en Chrome normal y loguearse
2. F12 (DevTools) → pestaña **Network** → filtro **Fetch/XHR**
3. Recargar la pagina (F5)
4. Click en cualquier peticion a `api.opositatest` (ej: `me`, `contents`, `stats`)
5. Panel derecho → **Encabezados de solicitud** → copiar valor de `Authorization` (sin "Bearer ")
6. Guardar en `scripts/jwt-token.txt`

```bash
echo 'eyJ0eXAi...' > scripts/jwt-token.txt
```

#### Metodo 2: Script Playwright (puede fallar con Google login)

El JWT se puede extraer interceptando requests del navegador:

```javascript
// scripts/extract-jwt.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, '.opositatest-session');

(async () => {
  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    executablePath: '/usr/bin/google-chrome'
  });

  const page = browser.pages()[0] || await browser.newPage();

  page.on('request', request => {
    const auth = request.headers()['authorization'];
    if (auth && auth.startsWith('Bearer ')) {
      const jwt = auth.replace('Bearer ', '');
      console.log('JWT capturado!');
      fs.writeFileSync(path.join(__dirname, 'jwt-token.txt'), jwt);
    }
  });

  await page.goto('https://aula.opositatest.com');
  console.log('Navega y haz login si es necesario...');
  console.log('El JWT se guardará automáticamente en jwt-token.txt');

  // Mantener navegador abierto
  await new Promise(r => setTimeout(r, 120000));
  await browser.close();
})();
```

---

## Endpoints Principales

### 1. Crear Test (ENDPOINT CORRECTO)

**⚠️ IMPORTANTE:** El endpoint para crear tests es `/tests`, NO `/exams`.

```http
POST https://api.opositatest.com/api/v2.0/tests
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "examId": 707425,
  "autoStart": true
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `examId` | number | ID del examen (convocatoria anterior) |
| `autoStart` | boolean | Iniciar test automáticamente |

**Respuesta exitosa (200):** Devuelve el test creado con todas las preguntas.

### 2. Obtener Test con Preguntas

```http
GET https://api.opositatest.com/api/v2.0/tests/{testId}?embedded=questions,responses
Authorization: Bearer <JWT>
```

**Parámetro clave:** `embedded=questions,responses`

Sin este parámetro, el endpoint devuelve solo metadatos. CON el parámetro, devuelve las preguntas completas con respuestas correctas.

**Respuesta:**
```json
{
  "id": "uuid",
  "questions": [
    {
      "id": 17393,
      "declaration": "Texto de la pregunta...",
      "organization": {"id": 1, "name": "OpositaTest", "code": "OPOSITATEST"},
      "correctAnswerId": 68631,
      "reason": "explicación de la respuesta",
      "isRepealed": false,
      "isAnnulled": false,
      "isDeleted": false,
      "contents": [...],
      "image": null,
      "answers": [
        {
          "id": "uuid-respuesta",
          "declaration": "Texto de la opción A"
        },
        {
          "id": "uuid-respuesta-2",
          "declaration": "Texto de la opción B"
        },
        ...
      ],
      "answeredId": null,
      "isDoubtful": false,
      "isHighlighted": false
    }
  ],
  "responses": [...]
}
```

### 3. Listar Tests del Usuario

```http
GET https://api.opositatest.com/api/v2.0/tests/saved?pageSize=10&sort=-createdAt
Authorization: Bearer <JWT>
```

### 4. Obtener Estructura de Oposición

```http
GET https://api.opositatest.com/api/v2.0/oppositions/{oppositionId}?embedded=contents
Authorization: Bearer <JWT>
```

**Respuesta:** Incluye todos los temas (contents) con sus UUIDs.

### 5. Obtener Contenido/Tema

```http
GET https://api.opositatest.com/api/v2.0/contents/{contentId}
Authorization: Bearer <JWT>
```

---

## IDs de Oposiciones Conocidos

| ID | Oposición | Estructura |
|----|-----------|------------|
| 7 | Tramitación Procesal y Administrativa TL | 37 temas (epígrafes) |
| 10 | Auxilio Judicial | - |
| 24 | Auxiliares Administrativos del Estado TL | - |
| 49 | Auxiliares Administrativos Junta de Andalucía TL | - |
| 77 | Auxiliares Administrativos Comunidad de Madrid | Bloque I (15 temas) + Bloque II Ofimática (6 temas) + Psicotécnicos (8 bloques) |
| 89 | Auxiliares Administrativos Generalitat Valenciana TL | - |
| 192 | Auxiliares Administrativos Castilla-La Mancha | - |

### Descubrir IDs de Oposiciones

```javascript
const data = await api('https://admin.opositatest.com/api/v2.0/opposition-categories?embedded=oppositions&pageSize=100');
for (const cat of data.resources) {
  for (const op of cat.oppositions) {
    console.log('ID:', op.id, '|', op.name);
  }
}
```

---

## Tipos de Test Disponibles

El configurador de test (`/classroom/test-configurator?mainContentId={id}`) ofrece varios tipos:

| Tipo | Descripción | Parámetro API `type` |
|------|-------------|---------------------|
| **Personalizado** | Test de uno o varios temas/bloques | `random` o `custom` |
| **Preguntas en blanco** | Preguntas que el usuario dejó sin responder | `blank` |
| **Oficial** | Simulacro de examen oficial | `official` |
| **Convocatorias anteriores** | Tests reales de años anteriores | `past_exam` |
| **Supuesto Práctico** | Caso práctico real | `practical_case` |

### Crear Test Personalizado (por temas)
```javascript
{
  "type": "random",
  "oppositionId": 7,
  "numberOfQuestions": 50,
  "contents": ["uuid-tema-1", "uuid-tema-2"]  // Temas específicos
}
```

### Crear Test Oficial (simulacro)
```javascript
{
  "type": "official",
  "oppositionId": 7,
  "numberOfQuestions": 100  // Número típico de examen oficial
}
```

### Crear Test de Convocatoria Anterior
```javascript
{
  "type": "past_exam",
  "oppositionId": 7,
  "examId": "uuid-examen-especifico"  // Examen real anterior
}
```

### Crear Supuesto Práctico
```javascript
{
  "type": "practical_case",
  "oppositionId": 7
}
```

> **Nota:** Los tipos exactos de API pueden variar. Se recomienda capturar requests del navegador para confirmar los valores específicos de cada tipo.

---

## Flujo Completo de Scraping (Actualizado Marzo 2026)

### Paso 1: Extraer JWT (manual)

Abrir OpositaTest en Chrome, F12 → Network → Fetch/XHR → copiar `Authorization` header → guardar en `scripts/jwt-token.txt`.

### Paso 2: Descubrir ID de la oposicion

```javascript
// Listar todas las oposiciones disponibles
const data = await api('https://admin.opositatest.com/api/v2.0/opposition-categories?embedded=oppositions&pageSize=100');
for (const cat of data.resources) {
  for (const op of (cat.oppositions || [])) {
    console.log('ID:', op.id, '|', op.name);
  }
}
```

### Paso 3: Obtener convocatorias anteriores

```javascript
const exams = await api('https://admin.opositatest.com/api/v2.0/exams?filters[opposition]=77&filters[type]=previousCall&pageSize=100');
exams.resources.forEach(e => console.log(e.id, '|', e.title));
```

### Paso 4: Descubrir estructura de temas

**No hay endpoint directo fiable.** La forma mas fiable es crear un test y extraer los `contents` de las preguntas:

```javascript
// Crear test desde un examId conocido
const test = await fetch('https://api.opositatest.com/api/v2.0/tests', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
  body: JSON.stringify({ examId: examIdConocido, autoStart: true })
}).then(r => r.json());

// Obtener preguntas con estructura de temas
const full = await fetch(`https://api.opositatest.com/api/v2.0/tests/${test.id}?embedded=questions,responses`, {
  headers: { 'Authorization': 'Bearer ' + jwt }
}).then(r => r.json());

// Extraer temas unicos de las preguntas
const topics = new Map();
for (const q of full.questions) {
  for (const c of (q.contents || [])) {
    if (!topics.has(c.id)) topics.set(c.id, { name: c.name, children: new Map() });
    if (c.child) topics.get(c.id).children.set(c.child.id, c.child.name);
  }
}

// Descartar test para liberar slot
await fetch(`https://api.opositatest.com/api/v2.0/tests/${test.id}/discard`, {
  method: 'PUT', headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' }
});
```

### Paso 5: Scrapear por tema

Para cada tema, crear un test personalizado con `contents: [uuidTema]`:

```javascript
const test = await fetch('https://api.opositatest.com/api/v2.0/tests', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'random',
    oppositionId: 77,
    numberOfQuestions: 100,
    contents: [topicUuid]
  })
}).then(r => r.json());
```

### Paso 6: Obtener preguntas y explicaciones

```javascript
const full = await fetch(`https://api.opositatest.com/api/v2.0/tests/${test.id}?embedded=questions,responses`, {
  headers: { 'Authorization': 'Bearer ' + jwt }
}).then(r => r.json());

// Obtener explicacion de cada pregunta (endpoint separado, 200ms delay)
for (const q of full.questions) {
  const reason = await fetch(`https://api.opositatest.com/api/v2.0/questions/${q.id}/reason`, {
    headers: { 'Authorization': 'Bearer ' + jwt }
  }).then(r => r.json());
  q.explanation = reason.content;
  q.explanationTitle = reason.title;
  await new Promise(r => setTimeout(r, 200));
}

// Descartar test
await fetch(`https://api.opositatest.com/api/v2.0/tests/${test.id}/discard`, {
  method: 'PUT', headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' }
});
```

### Paso 7: Transformar y guardar

```javascript
const preguntas = full.questions.map(q => ({
  id: q.id,
  question: q.declaration,
  explanation: q.explanation,
  explanationTitle: q.explanationTitle,
  correctAnswerId: q.correctAnswerId,
  options: q.answers.map(a => ({
    id: a.id,
    text: a.declaration,
    isCorrect: a.id === q.correctAnswerId
  })),
  correctLetter: ['A','B','C','D'][q.answers.findIndex(a => a.id === q.correctAnswerId)],
  isAnnulled: q.isAnnulled,
  isRepealed: q.isRepealed,
  contents: q.contents
}));
```

---

## Estructura de Pregunta

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | number | Identificador único de la pregunta |
| `declaration` | string | **TEXTO DE LA PREGUNTA** |
| `organization` | object | Info del creador: `{id, name, code}` (siempre "OpositaTest") |
| `correctAnswerId` | number | ID de la respuesta correcta |
| `reason` | string | Explicación de la respuesta (puede estar vacío) |
| `isRepealed` | boolean | **🔥 Si está DEROGADA** (muy importante filtrar) |
| `isAnnulled` | boolean | Si fue anulada en el examen |
| `isDeleted` | boolean | Si está eliminada |
| `contents` | array | **Tema y epígrafe** (ver estructura abajo) |
| `image` | string/null | URL de imagen si tiene |
| `answers` | array | Lista de 4 opciones |
| `answeredId` | number/null | Respuesta del usuario |
| `isDoubtful` | boolean | Marcada como dudosa |
| `isHighlighted` | boolean | Destacada |

### Estructura de Contents (Tema/Epígrafe)

```json
{
  "id": "uuid",
  "name": "Tema 13. Los Cuerpos Generales (I) (PRÓXIMAS CONVOCATORIAS TP TL)",
  "slug": "tema-13-los-cuerpos-generales-i-...",
  "levelName": "Temas",
  "child": {
    "id": "uuid",
    "name": "II. Formas de acceso y promoción interna",
    "slug": "ii-formas-de-acceso-y-promocion-interna",
    "levelName": "Epígrafes",
    "child": null
  }
}
```

### Estructura de Respuesta (Answer)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | Identificador único |
| `declaration` | string | Texto de la opción |

---

## Scripts Disponibles

| Script | Descripción | Output |
|--------|-------------|--------|
| `scripts/extract-jwt.cjs` | Extrae JWT del navegador | `scripts/jwt-token.txt` |
| `scripts/opositatest-tramitacion.cjs` | Scraper Tramitación Procesal | `preguntas-para-subir/tramitacion-procesal/` |
| `scripts/opositatest-auxilio.cjs` | Scraper Auxilio Judicial | `preguntas-para-subir/auxilio-judicial/` |
| `scripts/capture-questions-deep.cjs` | Captura profunda de requests | `scripts/deep-capture.json` |
| `scripts/capture-full-test-flow.cjs` | Captura flujo completo | `scripts/api-capture.json` |

---

## Scraper de Navegador (Método Alternativo)

El script `opositatest-tramitacion.cjs` usa **Playwright** para automatizar el navegador y extraer preguntas directamente de la UI.

### Cómo Funciona

1. **Sesión Persistente**: Usa `.opositatest-session/` para mantener cookies y login
2. **Menú Interactivo**: Comandos para escanear estructura y scrapear por tema
3. **Progreso Guardado**: `scrape-progress-tramitacion.json` para reanudar

### Uso

```bash
node scripts/opositatest-tramitacion.cjs
```

**Comandos disponibles:**
- `escanear` - Ver estructura de temas y progreso
- `1` - Scrapear tema 1
- `1-5` - Scrapear temas 1 al 5
- `todos` - Scrapear todos los temas
- `salir` - Cerrar

### Flujo de Scraping

```
1. Navega a test-configurator
2. Selecciona "Personalizado"
3. Click en "Configurar epígrafes" del tema
4. Selecciona un epígrafe (checkbox)
5. Click "Confirmar" → "Empezar" → "Terminar" → "Sí"
6. Espera resultados con todas las preguntas corregidas
7. Extrae preguntas del DOM
8. Guarda en JSON
9. Repite para siguiente epígrafe
```

### Estadísticas Actuales (Tramitación Procesal)

| Métrica | Valor |
|---------|-------|
| **Archivos JSON** | 182 |
| **Total preguntas** | 8,498 |
| **Temas** | 31 |
| **Estructura** | Tema → Epígrafes |

---

## Estructura de Output JSON

Cada epígrafe se guarda en un archivo JSON independiente:

```
preguntas-para-subir/
└── tramitacion-procesal/
    ├── Tema_1._La_Constitución_española.../
    │   ├── I._La_CE_de_1978.json
    │   ├── II._Derechos_y_deberes_fundamentales.json
    │   └── ...
    ├── Tema_2._Derecho_de_igualdad.../
    │   └── ...
    └── ...
```

### Formato del JSON

```json
{
  "tema": "Tema 1. La Constitución española de 1978",
  "subtema": "I. La CE de 1978",
  "source": "opositatest",
  "scrapedAt": "2026-02-16T08:58:54.114Z",
  "questionCount": 59,
  "questions": [
    {
      "question": "Señale la respuesta incorrecta. El artículo 7 de la CE establece que...",
      "options": [
        { "letter": "A", "text": "El ejercicio de su actividad es libre..." },
        { "letter": "B", "text": "Contribuyen a la defensa y promoción..." },
        { "letter": "C", "text": "Su creación es libre..." },
        { "letter": "D", "text": "Su estructura interna y funcionamiento son libres." }
      ],
      "correctAnswer": "D",
      "explanation": "Constitución Española.\n\nArtículo 7.\n\nLos sindicatos de trabajadores..."
    }
  ]
}
```

### Campos de Pregunta

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `question` | string | Texto de la pregunta |
| `options` | array | 4 opciones con `letter` (A-D) y `text` |
| `correctAnswer` | string | Letra correcta (A, B, C o D) |
| `explanation` | string/null | Explicación legal de la respuesta |

### Diferencias con API

| Aspecto | API | Scraper Navegador |
|---------|-----|-------------------|
| **Velocidad** | Rápido (~1s/pregunta) | Lento (~5s/epígrafe) |
| **Detección** | Posible rate limit | Difícil de detectar |
| **Formato** | UUIDs para todo | Letras A-D directas |
| **Explicaciones** | Campo `reason` | Limpiadas de URLs |
| **Progreso** | Manual | Automático con checkpoint |

---

## Archivo de Progreso

`scripts/scrape-progress-tramitacion.json`:

```json
{
  "temas": [
    {
      "index": 0,
      "title": "Tema 1. La Constitución española...",
      "epigrafesCount": 7,
      "type": "epigrafes"
    }
  ],
  "scrapeados": {
    "Tema 1...::I. La CE de 1978": {
      "done": true,
      "questions": 59,
      "date": "2026-02-16T08:58:54.114Z"
    }
  },
  "lastUpdate": "2026-02-16T10:30:00.000Z"
}
```

Esto permite **reanudar** el scraping desde donde se quedó si se interrumpe.

---

## Auditoría de Seguridad

### Pruebas Realizadas

#### 1. Enumeración de IDs de Oposición
**Objetivo:** Intentar acceder a contenido cambiando `mainContentId` en URL
```
https://aula.opositatest.com/classroom/test-configurator?mainContentId={id}
```
**Resultado:** ✅ El frontend carga pero muestra modal de suscripción. No se exponen preguntas.

#### 2. IDOR (Insecure Direct Object Reference)
**Objetivo:** Crear tests con contenido de oposiciones no suscritas
```javascript
await fetch('https://api.opositatest.com/api/v2.0/exams', {
  method: 'POST',
  body: JSON.stringify({
    oppositionId: 7,  // Suscrito
    contents: ['uuid-de-otra-oposicion']  // No suscrito
  })
});
```
**Resultado:** ✅ **403 Forbidden** - La API valida que el contenido pertenezca a oposición suscrita.

#### 3. Parameter Pollution
**Objetivo:** Bypass mediante parámetros duplicados
```
?oppositionId=7&oppositionId=10
?contents[]=uuid1&contents[]=uuid2
```
**Resultado:** ✅ La API usa el primer valor, no permite bypass.

#### 4. Acceso Directo a Endpoints
```
GET /api/v2.0/questions?filters[contents][]={contentId}
GET /api/v2.0/contents/{id}/questions
```
**Resultado:** ✅ Requiere autenticación y suscripción válida.

#### 5. JWT Analysis
- Usa RS256 (asimétrico) - No modificable sin clave privada
- No contiene información de suscripción
- Expiración ~24 horas

#### 6. Endpoints Admin
```
GET https://admin.opositatest.com/api/v2.0/contents/{id}
```
**Resultado:** ✅ **401 Unauthorized** - Requiere rol de admin.

### Información Expuesta (Sin Suscripción)

| Dato | Endpoint | Riesgo |
|------|----------|--------|
| Estructura de oposiciones | `/api/v2.0/oppositions` | Bajo |
| Lista de temas | `/api/v2.0/oppositions/{id}?embedded=contents` | Bajo |
| Metadatos de contenido | `/api/v2.0/contents/{id}` | Bajo |

### Conclusión de Seguridad

**El sistema de autorización funciona correctamente.** No es posible acceder a preguntas de oposiciones no suscritas mediante:
- ❌ Manipulación de URLs
- ❌ Ataques IDOR
- ❌ Modificación de JWT
- ❌ Parameter pollution
- ❌ Acceso directo a endpoints

Las preguntas solo son accesibles con suscripción válida.

---

## Rate Limiting y Buenas Prácticas

### Rate Limit Detectado

**Error 429 - Too Many Requests:**
- Se activa después de ~400-500 requests rápidos
- Especialmente al llamar al endpoint `/questions/{id}/reason` en bucle

### Recomendaciones

| Operación | Delay Recomendado |
|-----------|-------------------|
| Entre preguntas (explicaciones) | 200ms |
| Entre exámenes | 5000ms |
| Requests normales | 50-100ms |

### Estrategia Anti-Rate-Limit

```javascript
async function getExplanation(questionId, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(`/questions/${questionId}/reason`);

    if (response.status === 429) {
      console.log('Rate limit, esperando 60s...');
      await sleep(60000);  // Esperar 1 minuto
      continue;
    }

    return response.json();
  }
}
```

### Otras Recomendaciones
- Usar sesiones persistentes para evitar re-autenticación
- Los tokens expiran en ~24h, requiere re-extracción periódica
- No hacer más de 100 preguntas por tema en una sola request

---

## Límite de 10 Tests Simultáneos

### Error

```json
{
  "error": {
    "code": "TestCreatedOrInProgressLimitReached",
    "message": "Test created or in progress limit reached",
    "target": "Test",
    "limit": 10
  }
}
```

### Causa

OpositaTest limita a **10 tests guardados por usuario**. Cada vez que se crea un test con `POST /api/v2.0/tests` o `POST /api/v2.0/exams`, se cuenta contra este límite hasta que el test sea:
- Completado (finalized)
- Descartado (deleted)

### UI del Error

Cuando se alcanza el límite, la aplicación muestra un modal:
> **"No puedes iniciar otro test"**
> Has alcanzado el máximo de test guardados, tienes que finalizar o descartar alguno de ellos.
> [Ir a mis test guardados]

### Soluciones

#### 1. Usar Tests Existentes (Recomendado para Scraping)

Si ya tienes un test creado para un examId específico, puedes reutilizarlo:

```javascript
// Obtener lista de tests guardados
const saved = await api('https://api.opositatest.com/api/v2.0/tests/saved?pageSize=50&sort=-createdAt');

// Buscar si ya existe un test para el examen deseado
const existingTest = saved.resources.find(t => t.examId === targetExamId);

if (existingTest) {
  // Usar el test existente en vez de crear uno nuevo
  const test = await api(`https://api.opositatest.com/api/v2.0/tests/${existingTest.id}?embedded=questions,responses`);
  console.log('Reutilizando test existente:', test.questions.length, 'preguntas');
}
```

#### 2. Descartar Tests Via API ✅

```http
PUT https://api.opositatest.com/api/v2.0/tests/{testId}/discard
Authorization: Bearer <JWT>
Content-Type: application/json
```

**Respuesta exitosa:** `204 No Content`

**Ejemplo con curl:**
```bash
curl -X PUT "https://api.opositatest.com/api/v2.0/tests/{testId}/discard" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json"
```

> **IMPORTANTE:** El endpoint es `/tests/{id}/discard` (no `/tests/{id}` con body). El test debe estar en estado `created` o `in_progress` para poder descartarlo.

**Errores comunes:**
- `409 Conflict` - El test ya fue descartado o tiene un estado incompatible
- `405 Method Not Allowed` - Estás usando DELETE en vez de PUT

#### 3. Descartar desde la UI

1. Navegar a `https://aula.opositatest.com/classroom/test/saved-test`
2. Click en la flecha del test → "Descartar Test"

#### 4. Completar Tests Pendientes

Si el test tiene preguntas respondidas, completarlo también libera espacio:

```http
PUT https://api.opositatest.com/api/v2.0/tests/{testId}
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "state": "finished"
}
```

### Script de Limpieza

```javascript
// Limpiar tests antiguos antes de scrapear
async function cleanupTests(api, keepCount = 2) {
  const saved = await api('https://api.opositatest.com/api/v2.0/tests/saved?pageSize=50&sort=-createdAt');

  const testsToDelete = saved.resources.slice(keepCount);

  for (const test of testsToDelete) {
    await api(`https://api.opositatest.com/api/v2.0/tests/${test.id}`, { method: 'DELETE' });
    console.log('Eliminado:', test.id);
    await sleep(500); // Esperar para evitar rate limit
  }

  console.log(`Limpiados ${testsToDelete.length} tests. Quedan ${keepCount}.`);
}
```

### Recomendación para Scraping

Para scripts de scraping que necesitan crear múltiples tests:

1. **Al inicio:** Verificar cuántos tests guardados existen
2. **Si hay espacio:** Crear test, extraer preguntas, eliminar test
3. **Si no hay espacio:** Limpiar tests antiguos primero
4. **Alternativa:** Reutilizar test existente si ya existe para ese examId

```javascript
async function safeCreateTest(examId) {
  // Verificar si ya existe
  const saved = await api('/tests/saved');
  const existing = saved.resources.find(t => t.examId === examId);

  if (existing) {
    console.log('Test existente encontrado:', existing.id);
    return api(`/tests/${existing.id}?embedded=questions,responses`);
  }

  // Verificar espacio
  if (saved.resources.length >= 10) {
    // Eliminar el más antiguo
    await api(`/tests/${saved.resources[saved.resources.length - 1].id}`, { method: 'DELETE' });
  }

  // Crear nuevo test
  return api('/tests', { method: 'POST', body: JSON.stringify({ examId }) });
}
```

---

## Scraping de Convocatorias Anteriores y Supuestos Prácticos

### Tipos de Examen en la API

| Tipo API | Nombre UI | Descripción |
|----------|-----------|-------------|
| `previousCall` | Convocatorias Anteriores | Exámenes oficiales reales |
| `alleged` | Supuesto Práctico | Casos prácticos |
| `random` | Personalizado | Test por temas |
| `official` | Oficial | Simulacro de examen |

### Endpoint para Listar Exámenes

```http
GET https://admin.opositatest.com/api/v2.0/exams?filters[opposition]=7&filters[type]=previousCall
Authorization: Bearer <JWT>
```

**Respuesta:**
```json
{
  "resources": [
    {
      "id": 29734933,
      "title": "Examen Tramitación Procesal Turno Libre, 2023 (OEP 2020, 2021, 2022)",
      "type": "previousCall",
      "editionId": 345,
      "isDemo": false,
      "isIncludedInNormalSubscription": false,
      "permissions": { "isFree": false }
    }
  ],
  "paginator": { "page": 1, "pages": 1, "total": 9 }
}
```

### Flujo para Obtener Preguntas de Convocatorias

```javascript
// 1. Listar exámenes disponibles
const exams = await api('https://admin.opositatest.com/api/v2.0/exams?filters[opposition]=7&filters[type]=previousCall');

// 2. Crear test desde examId
const test = await api('https://api.opositatest.com/api/v2.0/tests', {
  method: 'POST',
  body: JSON.stringify({ examId: 29734933 })
});

// 3. Las preguntas vienen incluidas automáticamente en test.questions
console.log(test.questions.length); // 100 preguntas
```

### Convocatorias Disponibles (Tramitación Procesal) - TODAS CAPTURADAS ✅

| examId | Título | OEP | Preguntas | Explicaciones | Derogadas | Estado |
|--------|--------|-----|-----------|---------------|-----------|--------|
| 709137 | Examen 11 Marzo 2012 | 2011 | 100 | 100 | 25 | ✅ v2 |
| 707425 | Examen 3 Julio 2016 | 2015 | 100 | 100 | 13 | ✅ v2 |
| 1143624 | Examen 12 Mayo 2018 | 2016 | 100 | 99 | 11 | ✅ v2 |
| 7215420 | Examen 2020 | 2017/2018 | 100 | 58 | 15 | ✅ v2 |
| 29734933 | Examen 2023 | 2020/2021/2022 | 100 | 100 | 13 | ✅ v2 |
| 35968319 | Examen Estabilización 2024 | 2021 | 100 | 100 | 13 | ✅ v2 |
| 40195044 | Examen 28 Sep 2024 | 2023 | 100 | 100 | 10 | ✅ v2 |
| 49481489 | Tercer Ejercicio 2024 | 2024 | 19 | 19 | 0 | ✅ v2 |
| 49485348 | Examen 2025 | 2024 | 100 | 100 | 16 | ✅ v2 |

**Total: 9 convocatorias, 819 preguntas, 776 explicaciones, 116 derogadas**

> **Nota:** Todos los archivos usan `source: "opositatest-api-complete-v2"` con epígrafes y explicaciones completas.

### Permisos y Restricciones

| Tipo | Acceso con suscripción básica |
|------|-------------------------------|
| Convocatorias Anteriores | ✅ Todas accesibles (9/9) |
| Supuestos Prácticos | ✅ Los de la oposición suscrita |

> **Nota:** Los supuestos de OTRAS oposiciones (Gestión, Auxilio) devuelven 403.

---

## Script API Scraper

**Archivo:** `scripts/opositatest-api-scraper.cjs`

```bash
node scripts/opositatest-api-scraper.cjs
```

**Características:**
- Scrapea convocatorias anteriores y supuestos prácticos
- Guarda progreso para reanudar
- Captura TODOS los metadatos
- Output: `preguntas-para-subir/tramitacion-procesal/convocatorias-anteriores/`

---

## Estructura JSON Completa (Convocatorias)

### Metadatos del Examen

```json
{
  "metadata": {
    "examId": 7215420,
    "testId": "uuid-del-test",
    "title": "Examen Tramitación Procesal Turno Libre, 2020",
    "type": "previousCall",
    "editionId": 147,
    "isDemo": false,
    "isIncludedInNormalSubscription": false,
    "maxDuration": null,
    "permissions": { "isFree": false }
  },
  "testMetadata": {
    "oppositionId": 7,
    "state": "created",
    "statement": null,
    "createdAt": "2026-02-16T12:52:39+00:00",
    "info": {
      "questionsCount": 100,
      "blankQuestionsCount": 100
    }
  },
  "scrapedAt": "2026-02-16T12:52:39.199Z",
  "source": "opositatest-api",
  "oppositionName": "tramitacion-procesal",
  "questionCount": 100
}
```

### Estructura de Pregunta con Todos los Metadatos

```json
{
  "id": 306914,
  "position": 1,
  "question": "Además del Título Preliminar, la CE de 1978 contiene:",
  "organization": {
    "id": 1,
    "name": "OpositaTest",
    "code": "OPOSITATEST"
  },
  "options": [
    { "id": 1215659, "text": "9 Títulos.", "isCorrect": false },
    { "id": 1215660, "text": "10 Títulos.", "isCorrect": true },
    { "id": 1215661, "text": "11 Títulos.", "isCorrect": false },
    { "id": 1215662, "text": "12 Títulos.", "isCorrect": false }
  ],
  "correctAnswerId": 1215660,
  "correctAnswer": "10 Títulos.",
  "correctLetter": "B",
  "explanation": null,
  "isAnnulled": false,
  "isRepealed": false,
  "isDeleted": false,
  "answeredId": null,
  "isDoubtful": false,
  "isHighlighted": false,
  "image": null,
  "contents": [
    {
      "id": "d801ac95-745b-43f5-a55d-6437cf1fbcde",
      "name": "Tema 1. La Constitución española de 1978",
      "slug": "tema-1-la-constitucion-espanola-de-1978"
    }
  ],
  "rawAnswers": [
    { "id": 1215659, "declaration": "9 Títulos.", "image": null },
    { "id": 1215660, "declaration": "10 Títulos.", "image": null }
  ]
}
```

### Campos de Metadatos por Pregunta

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | number | ID único de la pregunta |
| `position` | number | Posición en el examen (1-100) |
| `question` | string | Texto de la pregunta |
| `organization` | object | Fuente/creador de la pregunta |
| `options` | array | Opciones con `id`, `text`, `isCorrect` |
| `correctAnswerId` | number | ID de la respuesta correcta |
| `correctAnswer` | string | Texto de la respuesta correcta |
| `correctLetter` | string | Letra (A, B, C, D) |
| `explanation` | string/null | Explicación legal |
| `isAnnulled` | boolean | Si fue anulada oficialmente |
| `isRepealed` | boolean | Si está derogada |
| `isDeleted` | boolean | Si fue eliminada |
| `image` | string/null | URL de imagen si tiene |
| `contents` | array | Temas/contenidos asociados |
| `rawAnswers` | array | Respuestas originales con `image` |

---

## Notas Adicionales

1. El navegador detecta automatización (Playwright) y muestra advertencia, pero la funcionalidad sigue operativa
2. Algunas preguntas pueden tener campo `image` con URL a imagen
3. Las preguntas anuladas (`isAnnulled: true`) deben excluirse del import
4. Las preguntas derogadas (`isRepealed: true`) pueden ser útiles para contexto histórico
5. El campo `contents` permite vincular preguntas a temas específicos del temario
6. Los supuestos prácticos (`alleged`) de OTRAS oposiciones requieren permisos premium
7. Los supuestos de la oposición suscrita SÍ son accesibles (ver sección Supuestos Prácticos)

---

## Supuestos Prácticos Capturados

### Disponibilidad

La API lista **todos** los supuestos prácticos de **todas** las oposiciones, incluyendo:
- ✅ Supuestos de oposiciones suscritas → Accesibles
- ❌ Supuestos de otras oposiciones (Gestión, Auxilio) → Error 403

### Identificación de Oposición

Al listar supuestos (`filters[type]=alleged`), verificar el campo `opposition` en cada examen:

```javascript
const supuestos = await api('https://admin.opositatest.com/api/v2.0/exams?filters[type]=alleged');

// Filtrar solo los de Tramitación Procesal (oppositionId: 7)
const tramitacion = supuestos.resources.filter(s => s.oppositionId === 7);
```

### Supuestos Capturados (Tramitación Procesal)

| examId | testId | Título | Preguntas |
|--------|--------|--------|-----------|
| 49478717 | `4e424261-93fa-4f38-838c-6e1302010891` | Supuesto Práctico 2025 (OEP 2024) | 9 |

### Estructura JSON Supuesto Práctico

Los supuestos prácticos incluyen un **statement** (enunciado del caso) que no tienen las convocatorias normales:

```json
{
  "metadata": {
    "examId": 49478717,
    "testId": "4e424261-93fa-4f38-838c-6e1302010891",
    "title": "Supuesto Práctico 2025 (OEP 2024)",
    "type": "alleged"
  },
  "testMetadata": {
    "statement": "SUPUESTO PRÁCTICO\n\nEn una demanda de juicio ordinario...",
    "state": "created"
  },
  "questionCount": 9,
  "questions": [...]
}
```

### Campo Statement

El `statement` contiene el texto completo del caso práctico que el opositor debe leer antes de responder las preguntas. Es un campo **exclusivo** de los supuestos prácticos.

### Ubicación de Archivos

```
preguntas-para-subir/
└── tramitacion-procesal/
    ├── convocatorias-anteriores/   # Exámenes oficiales
    │   ├── Examen_2012_OEP_2011.json
    │   ├── Examen_2016_OEP_2015.json
    │   ├── Examen_2018_OEP_2016.json
    │   ├── Examen_2020_OEP_2017_2018.json
    │   ├── Examen_2023_OEP_2020_2021_2022.json
    │   ├── Examen_Estabilizacion_2024_OEP_2021.json
    │   ├── Examen_28_Sep_2024_OEP_2023.json
    │   ├── Tercer_Ejercicio_2024_OEP_2024.json
    │   └── Examen_2025_OEP_2024.json
    ├── supuestos-practicos/         # Casos prácticos
    │   └── Supuesto_Practico_2025_OEP_2024.json
    └── Tema_*/                      # Preguntas por tema (182 archivos)
```

---

## Resumen Final de Captura (Febrero 2026)

### Estadísticas Totales

| Categoría | Archivos | Preguntas | Explicaciones | Derogadas |
|-----------|----------|-----------|---------------|-----------|
| **Convocatorias Anteriores** | 9 | 819 | 776 | 116 |
| **Supuestos Prácticos** | 1 | 9 | - | - |
| **Preguntas por Temas** | 182 | 8,498 | - | - |
| **TOTAL** | **192** | **9,326** | - | - |

### Estado de Captura

- ✅ **Convocatorias:** 9/9 (100%) - `opositatest-api-complete-v2`
- ✅ **Supuestos Prácticos:** 1/1 disponible para Tramitación
- ✅ **Preguntas por Temas:** Completo

### Metadatos Capturados por Pregunta

| Campo | Convocatorias v2 | Por Temas |
|-------|------------------|-----------|
| Texto pregunta | ✅ `question` | ✅ `question` |
| Opciones A-D | ✅ `options[]` | ✅ `options[]` |
| Respuesta correcta | ✅ `correctLetter` | ✅ `correctAnswer` |
| Explicación | ✅ `explanation` (HTML) | ✅ `explanation` |
| Tema | ✅ `contents[].name` | ✅ En nombre archivo |
| Epígrafe | ✅ `contents[].child.name` | ✅ En nombre archivo |
| Derogada | ✅ `isRepealed` | ❌ No disponible |
| Anulada | ✅ `isAnnulled` | ❌ No disponible |
| ID original | ✅ `id` | ❌ No disponible |

### Endpoints Clave Descubiertos

| Acción | Método | Endpoint |
|--------|--------|----------|
| Crear test | POST | `/api/v2.0/tests` con `{examId}` |
| Obtener preguntas | GET | `/api/v2.0/tests/{id}?embedded=questions,responses` |
| Listar tests guardados | GET | `/api/v2.0/tests/saved?pageSize=25` |
| **Descartar test** | PUT | `/api/v2.0/tests/{id}/discard` |
| Listar exámenes | GET | `admin.opositatest.com/api/v2.0/exams?filters[type]=previousCall`

---

## Hallazgos Recientes (16 Feb 2026)

### Endpoint Correcto para Crear Tests de Convocatorias

```http
POST https://api.opositatest.com/api/v2.0/tests
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "examId": 707425,
  "autoStart": true
}
```

**Importante:** El endpoint es `/tests` (NO `/exams`). El body solo necesita `examId` y `autoStart: true`.

### Estructura REAL de Campos de Pregunta

| Campo API | Tipo | Descripción |
|-----------|------|-------------|
| `declaration` | string | **TEXTO DE LA PREGUNTA** |
| `organization` | object | Info del creador: `{id, name: "OpositaTest", code}` |
| `correctAnswerId` | number | ID de la respuesta correcta |
| `reason` | string | Explicación (⚠️ vacío en la API, ver nota) |
| `isRepealed` | boolean | **🔥 TRUE si está DEROGADA** |
| `isAnnulled` | boolean | Si fue anulada |
| `isDeleted` | boolean | Si está eliminada |
| `contents` | array | Tema y epígrafe (ver estructura) |
| `answers` | array | Opciones: `{id, declaration}` |

### Estructura de Contents (Tema + Epígrafe)

```json
{
  "id": "uuid",
  "name": "Tema 13. Los Cuerpos Generales (I) (PRÓXIMAS CONVOCATORIAS TP TL)",
  "slug": "tema-13-...",
  "levelName": "Temas",
  "child": {
    "id": "uuid",
    "name": "II. Formas de acceso y promoción interna",
    "slug": "ii-formas-de-acceso-y-promocion-interna",
    "levelName": "Epígrafes",
    "child": null
  }
}
```

### ✅ Campos Resueltos

| Campo | Estado | Solución |
|-------|--------|----------|
| `reason` (explicaciones) | ✅ Resuelto | Usar endpoint separado: `GET /questions/{id}/reason` |
| `child` en `contents` | ✅ Completo | Usar `POST /tests` con `{examId, autoStart: true}` |

### Scripts de Captura

**Captura completa (epígrafe + explicaciones):**
```bash
node scripts/recapture-complete.cjs      # Todos los exámenes
node scripts/recapture-remaining.cjs     # Solo los pendientes
```

**Flujo del script:**
1. Crea test con `POST /tests` + `{examId, autoStart: true}`
2. Obtiene preguntas con `GET /tests/{id}?embedded=questions,responses`
3. Para cada pregunta: `GET /questions/{id}/reason` (explicación)
4. Transforma: `declaration` → `question`, incluye `isRepealed`, `contents.child`, `explanation`
5. Descarta test con `PUT /tests/{id}/discard`


### Endpoint de Explicaciones (NUEVO)

```http
GET https://api.opositatest.com/api/v2.0/questions/{questionId}/reason
Authorization: Bearer <JWT>
```

**Respuesta:**
```json
{
  "title": "*Art. 9.2 CE + comentario",
  "content": "<p><strong>Constitución Española.</strong></p><p><strong>Artículo 9.</strong></p>..."
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `title` | string | Título de la explicación |
| `content` | string | Explicación en **HTML** |

**⚠️ Nota:** Este endpoint se llama individualmente por cada pregunta. Para 100 preguntas = 100 requests.

### Script para Obtener Explicaciones

```javascript
async function getExplanation(questionId, jwt) {
  const response = await fetch(
    `https://api.opositatest.com/api/v2.0/questions/${questionId}/reason`,
    { headers: { 'Authorization': `Bearer ${jwt}` } }
  );

  if (response.status === 429) {
    // Rate limit - esperar y reintentar
    await sleep(60000);
    return getExplanation(questionId, jwt);
  }

  return response.json(); // {title, content}
}

// Para cada pregunta del examen (200ms delay recomendado)
for (const q of questions) {
  const reason = await getExplanation(q.id, jwt);
  q.explanation = reason.content;      // HTML con la explicación
  q.explanationTitle = reason.title;   // Título (ej: "*Art. 9.2 CE + comentario")
  await sleep(200); // Delay conservador para evitar 429
}
```

---

## Estructura JSON Final (v2 Completa)

```json
{
  "metadata": {
    "examId": 29734933,
    "testId": "uuid",
    "title": "Examen 2023 (OEP 2020-2022)",
    "type": "previousCall"
  },
  "source": "opositatest-api-complete-v2",
  "questionCount": 100,
  "questions": [
    {
      "id": 306914,
      "position": 1,
      "question": "Además del Título Preliminar, la CE de 1978 contiene:",
      "options": [
        { "id": 1215659, "text": "9 Títulos.", "isCorrect": false },
        { "id": 1215660, "text": "10 Títulos.", "isCorrect": true },
        { "id": 1215661, "text": "11 Títulos.", "isCorrect": false },
        { "id": 1215662, "text": "12 Títulos.", "isCorrect": false }
      ],
      "correctAnswerId": 1215660,
      "correctAnswer": "10 Títulos.",
      "correctLetter": "B",
      "explanation": "<p><strong>Constitución Española.</strong></p>...",
      "explanationTitle": "*Art. 168 CE + comentario",
      "isRepealed": false,
      "isAnnulled": false,
      "contents": [
        {
          "name": "Tema 1. La Constitución española de 1978",
          "child": {
            "name": "I. La CE de 1978: características y estructura",
            "levelName": "Epígrafes"
          }
        }
      ]
    }
  ]
}
```

---

## Crear Tests Personalizados (por tema)

La API para crear tests personalizados usa **dos pasos**:

### Paso 1: Crear examen con `/exams`

```javascript
const exam = await fetch('https://api.opositatest.com/api/v2.0/exams', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'random',
    oppositionId: 77,
    numberOfQuestions: 100,
    contentsRequestedIds: ['uuid-tema-o-bloque']  // UUIDs de temas/bloques a incluir
  })
}).then(r => r.json());
// Devuelve { id: 53849757 } (ID numerico)
```

> **CRITICO:** El campo se llama `contentsRequestedIds` (NO `contents`).
> Si se pasa `contents`, la API lo ignora y devuelve preguntas aleatorias de toda la oposicion.
> Descubierto capturando la peticion real del frontend (DevTools → Network → Carga util).
```

### Paso 2: Crear test desde el examen con `/tests`

```javascript
const test = await fetch('https://api.opositatest.com/api/v2.0/tests', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
  body: JSON.stringify({ examId: exam.id, autoStart: true })
}).then(r => r.json());
// Devuelve { id: 'uuid-test' } (UUID)
```

### Paso 3: Obtener preguntas

```javascript
const full = await fetch('https://api.opositatest.com/api/v2.0/tests/' + test.id + '?embedded=questions,responses', {
  headers: { 'Authorization': 'Bearer ' + jwt }
}).then(r => r.json());
// full.questions contiene todas las preguntas
```

> **IMPORTANTE:** Para convocatorias anteriores, solo se necesita el paso 2 (ya tienen examId).
> Para tests personalizados por tema, se necesitan los 3 pasos.

---

## Preguntas con Imagenes (Psicotecnicos)

Las preguntas psicotecnicas pueden tener imagenes en la pregunta y/o en las respuestas.

### Estructura de imagen en pregunta

```json
{
  "image": {
    "name": "65f2b0c79bb56563643250.png",
    "thumbs": {
      "large": "https://admin.opositatest.com/media/cache/resolve/question_thumb_big/65f2b0c79bb56563643250.png",
      "small": "https://admin.opositatest.com/media/cache/resolve/question_thumb/65f2b0c79bb56563643250.png",
      "maximize": "https://admin.opositatest.com/media/cache/resolve/question_thumb_maximize/65f2b0c79bb56563643250.png",
      "original": "https://admin.opositatest.com/media/cache/resolve/question_thumb_original/65f2b0c79bb56563643250.png"
    }
  }
}
```

### Estructura de imagen en respuesta

```json
{
  "answers": [
    {
      "id": 123,
      "declaration": "Texto opcion",
      "image": {
        "name": "65cc838616ccd300969089.png",
        "thumbs": {
          "large": "https://admin.opositatest.com/media/cache/resolve/answer_thumb_big/...",
          "original": "https://admin.opositatest.com/media/cache/resolve/answer_thumb_original/..."
        }
      }
    }
  ]
}
```

### Descargar imagenes al scrapear

```javascript
const fs = require('fs');
const path = require('path');

async function downloadImage(imageObj, outputDir, prefix) {
  if (!imageObj?.thumbs?.original) return null;
  const url = imageObj.thumbs.original;
  const filename = prefix + '_' + imageObj.name;
  const filepath = path.join(outputDir, filename);

  const response = await fetch(url);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filepath, buffer);
  return filename;
}
```

---

## Oposiciones con Psicotecnicos

Algunas oposiciones incluyen psicotecnicos ademas de temas legislativos.

### Auxiliar Madrid (ID 77) - Estructura completa

```
Bloque I. Organizacion politica (15 temas)
  Tema 1 a 15 (con epigrafes cada uno)

Bloque II. Ofimatica (6 temas)
  Tema 16 a 21

Psicotecnicos (8 bloques, 28 secciones/niveles)
  Capacidad administrativa (4 secciones)
    Pruebas de atencion-percepcion
    Graficos
    Pruebas de clasificacion
    Tablas
  Capacidad ortografica (1 nivel)
    Nivel avanzado
  Pruebas de instrucciones (2 niveles)
    Nivel basico / Nivel avanzado
  Razonamiento numerico (11 secciones)
    Numeros enteros, decimales, fracciones, potencias,
    ecuaciones, porcentajes, reglas de tres,
    sistema sexagesimal, sistema metrico decimal,
    calculo de intervalos, operaciones combinadas
  Razonamiento verbal (3 secciones)
    Sinonimos y antonimos, Analogias verbales,
    Definiciones, Organizacion de frases
  Series alfanumericas (1 nivel)
    Nivel avanzado
  Series de letras (2 niveles)
    Nivel basico / Nivel avanzado
  Series numericas (2 niveles)
    Nivel basico / Nivel avanzado
```

### UUIDs de Contenidos - Auxiliar Madrid

**Bloques principales:**
| UUID | Nombre |
|------|--------|
| `81f567fd-1d58-451c-a8e3-614f062a992d` | Bloque I. Organizacion politica |
| `790aabcc-7555-42db-8d70-9e6fd01903fe` | Psicotecnicos |

**Temas Bloque I:**
| UUID | Tema |
|------|------|
| `89cbb428-4d4e-4fa5-b966-aad962ade051` | Tema 1 - La Constitucion |
| `bf52d81d-ae36-4fc9-9bbf-a217b4f43159` | Tema 2 - Estatuto Autonomia CM |
| `5254fc9f-6ad9-4387-8066-78c9a7942395` | Tema 3 - Ley Gobierno CM |
| `494989ee-189d-471d-85e4-bb9ef753bf93` | Tema 4 - Fuentes del ordenamiento |
| `b41f1ec8-6874-4a20-b7b5-84f597da60b2` | Tema 5 - El acto administrativo |
| `956324ca-c257-4ad6-abb9-a6415e1c2bb9` | Tema 6 - LPAC |
| `abb1b3a1-3801-487f-8fa7-ed238bb643f2` | Tema 7 - Contencioso-Administrativo |
| `71e8de1f-d022-40a1-ada9-a21d177b9bc0` | Tema 8 - Transparencia y Proteccion datos |
| `585f0802-21b5-4979-8e61-44c1b82c6ad7` | Tema 9 - Contratos Sector Publico |
| `0fcf43c0-8a76-4922-8a78-c33318713f2e` | Tema 10 - TREBEP / Funcion Publica CM |
| `3406e652-efa8-4bcc-bae2-e56d1dab58bb` | Tema 11 - Seguridad Social |
| `90b8ac08-0631-4791-8ffd-d815ecc706c2` | Tema 12 - Hacienda publica |
| `265c71dc-4a24-4654-b54d-bdb4f1e13bf2` | Tema 13 - Igualdad de genero |
| `921da396-f876-45db-81db-7afec7b445f7` | Tema 14 - Informacion administrativa |
| `a7155c36-defd-41e3-88b4-bb73b322a80a` | Tema 15 - Documentos administrativos |

**Bloques Psicotecnicos:**
| UUID | Bloque | Secciones |
|------|--------|-----------|
| `5da4c618-4253-4274-86c9-3a0b4f79967d` | Capacidad administrativa | 4 |
| `9f48f8bb-bf2b-4720-96a6-c30c95af8da3` | Capacidad ortografica | 1 |
| `b9361081-2836-4353-ab92-d92211030a75` | Pruebas de instrucciones | 2 |
| `9188b6c9-b57e-4583-80eb-144058c2287c` | Razonamiento numerico | 11 |
| `2be08dd1-2434-4501-a2a9-92933a77a1ad` | Razonamiento verbal | 3 |
| `d01690f1-3c17-430b-ac3e-efc562ef16d6` | Series alfanumericas | 1 |
| `9af7c82b-30ba-43a7-9b71-98e212289638` | Series de letras | 2 |
| `5dc5f4f0-f56c-4c5f-bcd0-d1556bed76b7` | Series numericas | 2 |

---

## Convocatorias por Oposicion

### Tramitacion Procesal (ID 7) - 9 convocatorias

| examId | Titulo | Preguntas |
|--------|--------|-----------|
| 709137 | Examen 11 Marzo 2012 (OEP 2011) | 100 |
| 707425 | Examen 3 Julio 2016 (OEP 2015) | 100 |
| 1143624 | Examen 12 Mayo 2018 (OEP 2016) | 100 |
| 7215420 | Examen 2020 (OEP 2017/2018) | 100 |
| 29734933 | Examen 2023 (OEP 2020-2022) | 100 |
| 35968319 | Examen Estabilizacion 2024 (OEP 2021) | 100 |
| 40195044 | Examen 28 Sep 2024 (OEP 2023) | 100 |
| 49481489 | Tercer Ejercicio 2024 (OEP 2024) | 19 |
| 49485348 | Examen 2025 (OEP 2024) | 100 |

### Auxiliar Madrid (ID 77) - 6 convocatorias

| examId | Titulo | Preguntas | Psicotecnicos |
|--------|--------|-----------|---------------|
| 2584460 | Examen TL 2018 (OEP 2015, 2016) | 45 | No |
| 2977747 | Examen TL 2018 (OEP 2015, 2016) - 2a sesion | 45 | No |
| 23258902 | Examen 1a Sesion TL 2022 (OEP 2017-2019) | ~50 | No |
| 23283175 | Examen 2a Sesion TL 2022 (OEP 2017-2019) | ~50 | No |
| 53041925 | Primer ejercicio Ordinario TL 2023 (OEP 2020-2022) | 58 | Si (3 bloques) |
| 53187191 | Primer ejercicio Extraordinario TL 2023 (OEP 2020-2022) | 58 | Si (3 bloques) |
