# Manual de API de TuTestDigital

> **Fecha:** Abril 2026
> **Propósito:** Documentación de endpoints, flujos de scraping y estructura de datos de tutestdigital.es

---

## Notas Importantes (Lecciones Aprendidas)

1. **Funciona con `node fetch` y `curl`**: A diferencia de OpositaTest, no hay protección especial contra herramientas de línea de comando.
2. **El endpoint `/api/Books/{id}` devuelve TODAS las preguntas con respuestas correctas**: No hay validación server-side — `esCorrecta: true/false` viene directamente en las opciones.
3. **JWT expira en ~1 hora** (`exp - iat = 3600s`). Algoritmo **HS256** (simétrico, más simple que OpositaTest que usa RS256).
4. **No hay paginación**: El endpoint del libro devuelve todas las preguntas de golpe (955 preguntas = ~1.5MB JSON).
5. **Los exámenes son efímeros**: Se crean con `plantear`, se entregan con `entregar`. Las preguntas se devuelven al plantear, no hay endpoint para recuperar un examen en curso.
6. **Hay test gratuito** (`/api/Temas/free-test`) con libro 13 (Constitución Española).
7. **API .NET** (issuer: `TuTestOnline.Api`, audience: `TuTestOnline.Frontend`).
8. **El endpoint `/api/Users/me` devuelve el passwordHash** — vulnerabilidad grave de seguridad.

---

## Arquitectura

Arquitectura simple con frontend SPA (Vite + Vue 3) y backend .NET:

| Servicio | URL Base | Función |
|----------|----------|---------|
| **Backend API** | `back.tutestdigital.es` | API REST (.NET) |
| **Frontend** | `tutestdigital.es` | SPA Vue 3 (Vite build) |

### URLs Principales del Frontend

| URL | Función |
|-----|---------|
| `/libro/{bookId}` | Vista del libro (modo práctica por temas) |
| `/examen/{examenId}` | Realizar examen con temporizador |
| `/test-gratuito` | Test gratuito (Constitución Española) |
| `/tienda` | Tienda de libros/suscripciones |
| `/perfil` | Perfil de usuario y estadísticas |

---

## Autenticación

### JWT Bearer Token

Todas las peticiones autenticadas requieren header:
```
Authorization: Bearer <JWT_TOKEN>
```

El token JWT:
- Algoritmo: **HS256** (simétrico)
- Expira en **~1 hora** (3600 segundos)
- Contiene: `nameid`, `sub`, `unique_name`, `email`, `session_id`
- Issuer: `TuTestOnline.Api`
- Audience: `TuTestOnline.Frontend`

### Extraer JWT

#### Método: Manual desde DevTools (RECOMENDADO)

1. Abrir tutestdigital.es en Chrome y loguearse
2. F12 (DevTools) → pestaña **Network** → filtro **Fetch/XHR**
3. Recargar la página (F5)
4. Click en cualquier petición a `back.tutestdigital` (ej: `me`, `Books`)
5. Panel derecho → **Encabezados de solicitud** → copiar valor de `Authorization` (sin "Bearer ")
6. Guardar en `scripts/jwt-tutestdigital.txt`

```bash
echo 'eyJ0eXAi...' > scripts/jwt-tutestdigital.txt
```

### Login por API

```javascript
const response = await fetch('https://back.tutestdigital.es/api/Users/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'usuario', password: 'contraseña' })
});
const data = await response.json();
// data contiene el JWT
```

---

## Endpoints Principales

### 1. Obtener Libro Completo (con TODAS las preguntas)

**⚡ ENDPOINT PRINCIPAL PARA SCRAPING** — Un solo request devuelve todas las preguntas con respuestas correctas.

```http
GET https://back.tutestdigital.es/api/Books/{bookId}
Authorization: Bearer <JWT>
```

**Respuesta (200):**
```json
{
  "id": 44,
  "titulo": "TEST 58 AUXILIARES ADMINISTRATIVOS CARM",
  "descripcion": "956 PREGUNTAS TIPO TEST",
  "portadaUrl": "/images/portadas/qu445vwx.cuq.png",
  "fechaCreacion": "2026-04-07T17:06:28Z",
  "libroPreguntas": [
    {
      "libroId": 44,
      "preguntaId": 23,
      "pregunta": {
        "id": 23,
        "enunciado": "Según el Título Preliminar de la CE...",
        "explicacionCorrecta": "España se constituye en un Estado social y democrático de Derecho.",
        "opciones": [
          { "id": 89, "texto": "Social y limitado de derecho.", "esCorrecta": false, "preguntaId": 23 },
          { "id": 90, "texto": "Social y Monárquico.", "esCorrecta": false, "preguntaId": 23 },
          { "id": 91, "texto": "Individual y democrático de derecho.", "esCorrecta": false, "preguntaId": 23 },
          { "id": 92, "texto": "Social y democrático de derecho.", "esCorrecta": true, "preguntaId": 23 }
        ],
        "libroPreguntas": [],
        "numeroLibrosVinculados": 54
      },
      "orden": 1
    }
  ]
}
```

> **NOTA:** Cada pregunta incluye `numeroLibrosVinculados` que indica en cuántos libros aparece (ej: 54 = pregunta muy reutilizada).

### 2. Obtener Temas de un Libro

```http
GET https://back.tutestdigital.es/api/Temas/book/{bookId}
Authorization: Bearer <JWT>
```

**Respuesta (200):**
```json
{
  "libroId": 44,
  "titulo": "TEST 58 AUXILIARES ADMINISTRATIVOS CARM",
  "portadaUrl": "/images/portadas/...",
  "temas": [
    {
      "id": 431,
      "libroId": 44,
      "titulo": "Tema 1.- Constitución Española...",
      "ordenDesde": 1,
      "ordenHasta": 185
    }
  ]
}
```

Los campos `ordenDesde` y `ordenHasta` indican qué preguntas del libro pertenecen al tema (por posición, no por ID).

### 3. Obtener Preguntas de un Tema

```http
GET https://back.tutestdigital.es/api/Temas/{temaId}/libro/{bookId}/preguntas
Authorization: Bearer <JWT>
```

**Respuesta (200):** Array de preguntas con la misma estructura que en el libro pero con campo `orden`:
```json
[
  {
    "id": 23,
    "enunciado": "Según el Título Preliminar...",
    "explicacionCorrecta": "España se constituye en...",
    "orden": 1,
    "opciones": [
      { "texto": "Social y limitado de derecho.", "esCorrecta": false },
      { "texto": "Social y democrático de derecho.", "esCorrecta": true }
    ]
  }
]
```

> **NOTA:** En este endpoint las opciones NO incluyen `id` ni `preguntaId`, solo `texto` y `esCorrecta`.

### 4. Plantear Examen (crear test temporizado)

```http
POST https://back.tutestdigital.es/api/examen/plantear
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "bookId": 44,
  "temaId": 431,
  "numeroPreguntas": 30,
  "duracion": 30
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `bookId` | number | ID del libro |
| `temaId` | number/null | ID del tema (null = todo el libro) |
| `numeroPreguntas` | number | Cantidad de preguntas |
| `duracion` | number | Minutos de duración del examen |

**Respuesta (200):**
```json
{
  "examen": {
    "id": 1806,
    "userId": 290,
    "bookId": 44,
    "temaId": 431,
    "puntuacion": 0,
    "numeroPreguntas": 10,
    "duracion": 10,
    "fechaCreacion": null
  },
  "preguntas": [
    {
      "id": 95,
      "enunciado": "¿Qué artículos componen el Título I?",
      "explicacionCorrecta": "El Título I comprende del art. 10 al 55.",
      "orden": 43,
      "opciones": [
        { "texto": "Del artículo 9 al 55.", "esCorrecta": false },
        { "texto": "Del artículo 10 al 55.", "esCorrecta": true }
      ]
    }
  ]
}
```

> **NOTA:** Las preguntas se seleccionan aleatoriamente del tema/libro y vienen CON la respuesta correcta.

### 5. Entregar Examen (registrar resultado)

```http
POST https://back.tutestdigital.es/api/examen/entregar
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "examenId": 1806,
  "correctas": 8,
  "totales": 10
}
```

**Respuesta (200):**
```json
{
  "id": 1806,
  "userId": 290,
  "bookId": 44,
  "temaId": 431,
  "puntuacion": 80.0,
  "numeroPreguntas": 10,
  "duracion": 10,
  "fechaCreacion": "2026-04-07T17:08:57"
}
```

> **NOTA:** `puntuacion` = porcentaje (correctas/totales * 100). La corrección es 100% client-side.

### 6. Historial de Exámenes

```http
GET https://back.tutestdigital.es/api/examen/mis/historico
Authorization: Bearer <JWT>
```

**Respuesta (200):**
```json
{
  "totalExamenes": 2,
  "examenes": [
    {
      "id": 1805,
      "bookId": 44,
      "libroTitulo": "TEST 58 AUXILIARES ADMINISTRATIVOS CARM",
      "temaId": 431,
      "temaTitulo": "Tema 1.- Constitución Española...",
      "puntuacion": 0,
      "numeroPreguntas": 30,
      "duracion": 30,
      "fechaCreacion": "2026-04-07T17:05:39"
    }
  ],
  "resumenRespuestas": []
}
```

### 7. Registrar Respuesta (modo práctica)

```http
POST https://back.tutestdigital.es/api/users/me/answer
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "bookId": 44,
  "temaId": 431,
  "questionId": 23,
  "isCorrect": true
}
```

**Respuesta (200):**
```json
{
  "saved": true,
  "progress": 0.54,
  "stats": {
    "correctTema": 1,
    "correctLibro": 1
  }
}
```

### 8. Progreso por Temas

```http
GET https://back.tutestdigital.es/api/users/me/books/{bookId}/temas/progress
Authorization: Bearer <JWT>
```

### 9. Progreso de un Tema Específico

```http
GET https://back.tutestdigital.es/api/users/me/books/{bookId}/temas/{temaId}/progress
Authorization: Bearer <JWT>
```

**Respuesta (200):**
```json
{
  "bookId": 44,
  "temaId": 431,
  "progress": 0.54,
  "updatedAt": "2026-04-07T17:10:00"
}
```

### 10. Respuestas Correctas de un Tema

```http
GET https://back.tutestdigital.es/api/users/me/books/{bookId}/temas/{temaId}/answers/correct
Authorization: Bearer <JWT>
```

### 11. Favoritos

```http
GET https://back.tutestdigital.es/api/Users/me/favorites
GET https://back.tutestdigital.es/api/Users/me/favorites/count
GET https://back.tutestdigital.es/api/Users/me/favorites/{bookId}/{questionId}
POST https://back.tutestdigital.es/api/Users/me/favorites  (body: {bookId, questionId})
DELETE https://back.tutestdigital.es/api/Users/me/favorites/{bookId}/{questionId}
```

### 12. Test Gratuito (sin autenticación de pago)

```http
GET https://back.tutestdigital.es/api/Temas/free-test
```

Devuelve la estructura del libro gratuito (ID 13: "TEST INTERACTIVO LA CONSTITUCIÓN ESPAÑOLA DE 1978") con sus temas.

```http
GET https://back.tutestdigital.es/api/Temas/free-test/{temaId}/preguntas
```

Devuelve las preguntas del tema gratuito.

---

## Endpoints de Usuarios

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/Users/login` | POST | Login (usuario/contraseña) |
| `/api/Users/logout` | POST | Logout |
| `/api/Users/me` | GET | Datos del usuario actual |
| `/api/Users/register` | POST | Registro |
| `/api/Users/me/profile` | PUT | Actualizar perfil |
| `/api/Users/me/change-password` | POST | Cambiar contraseña |
| `/api/Users/forgot-password` | POST | Recuperar contraseña |
| `/api/Users/reset-password` | POST | Reset contraseña con token |
| `/api/Users/validate-reset-token?token={t}` | GET | Validar token de reset |

---

## Endpoints Admin (requiere `tipo: 1`)

Los usuarios admin (`tipo: 1` en la respuesta de `/me`) tienen acceso a endpoints adicionales:

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/Books/listado` | POST | Listar todos los libros |
| `/api/Books` | POST | Crear libro |
| `/api/Books/{id}` | DELETE | Eliminar libro |
| `/api/Books/portada` | POST | Subir portada (multipart/form-data) |
| `/api/Books/checkTest` | POST | Verificar test (multipart/form-data) |
| `/api/Books/postTest` | POST | Importar test desde archivo |
| `/api/Books/autonumerar` | POST | Autonumerar preguntas |
| `/api/Temas` | POST | Crear tema |
| `/api/Temas/{id}` | PUT/DELETE | Editar/eliminar tema |
| `/api/product/*` | Varios | Gestión de productos y suscripciones |
| `/api/subscripcion` | GET | Gestión de suscripciones |

---

## IDs de Libros Conocidos

| ID | Libro | Preguntas | Temas |
|----|-------|-----------|-------|
| 13 | TEST INTERACTIVO LA CONSTITUCIÓN ESPAÑOLA DE 1978 (GRATUITO) | ~400+ | 12 |
| 44 | TEST 58 AUXILIARES ADMINISTRATIVOS CARM | 955 | 16 |

### Descubrir Libros

No hay endpoint público para listar libros. Opciones:
1. **Admin:** `POST /api/Books/listado` (requiere `tipo: 1`)
2. **Fuerza bruta:** Probar `GET /api/Books/{id}` con IDs incrementales
3. **Frontend:** Los libros se muestran en `/tienda` — capturar requests

---

## Estructura de Datos

### Pregunta

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | number | Identificador único de la pregunta |
| `enunciado` | string | Texto de la pregunta |
| `explicacionCorrecta` | string/null | Explicación de la respuesta correcta |
| `opciones` | array | 4 opciones con `texto` y `esCorrecta` |
| `orden` | number | Posición dentro del libro |
| `numeroLibrosVinculados` | number | En cuántos libros aparece esta pregunta |

### Opción

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | number | ID de la opción (solo en endpoint `/api/Books/{id}`) |
| `texto` | string | Texto de la opción |
| `esCorrecta` | boolean | Si es la respuesta correcta |
| `preguntaId` | number | ID de la pregunta padre (solo en `/api/Books/{id}`) |

### Tema

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | number | ID del tema |
| `libroId` | number | ID del libro al que pertenece |
| `titulo` | string | Nombre del tema |
| `ordenDesde` | number | Primera pregunta del tema (por orden) |
| `ordenHasta` | number | Última pregunta del tema (por orden) |

### Examen

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | number | ID del examen |
| `userId` | number | ID del usuario |
| `bookId` | number | ID del libro |
| `temaId` | number/null | ID del tema (null = todo el libro) |
| `puntuacion` | number | Porcentaje de aciertos (0-100) |
| `numeroPreguntas` | number | Total de preguntas |
| `duracion` | number | Minutos |
| `fechaCreacion` | string | Fecha ISO |

---

## Flujo Completo de Scraping

### Método 1: Endpoint directo (RECOMENDADO)

El scraping es trivial porque `/api/Books/{id}` devuelve todo:

```javascript
const jwt = require('fs').readFileSync('scripts/jwt-tutestdigital.txt', 'utf-8').trim();

const response = await fetch('https://back.tutestdigital.es/api/Books/44', {
  headers: { 'Authorization': 'Bearer ' + jwt }
});
const book = await response.json();

console.log('Libro:', book.titulo);
console.log('Total preguntas:', book.libroPreguntas.length);

// Transformar al formato estándar
const preguntas = book.libroPreguntas.map(lp => {
  const q = lp.pregunta;
  const correctIdx = q.opciones.findIndex(o => o.esCorrecta);
  return {
    id: q.id,
    question: q.enunciado,
    explanation: q.explicacionCorrecta,
    options: q.opciones.map((o, i) => ({
      letter: ['A', 'B', 'C', 'D'][i],
      text: o.texto,
      isCorrect: o.esCorrecta
    })),
    correctAnswer: ['A', 'B', 'C', 'D'][correctIdx],
    orden: lp.orden,
    linkedBooks: q.numeroLibrosVinculados
  };
});

require('fs').writeFileSync(
  'preguntas-para-subir/tutestdigital/libro-44.json',
  JSON.stringify({ libro: book.titulo, source: 'tutestdigital', questions: preguntas }, null, 2)
);
```

### Método 2: Por temas (si se quiere estructura)

```javascript
const jwt = require('fs').readFileSync('scripts/jwt-tutestdigital.txt', 'utf-8').trim();
const h = { 'Authorization': 'Bearer ' + jwt };

// 1. Obtener temas
const temas = await fetch('https://back.tutestdigital.es/api/Temas/book/44', { headers: h }).then(r => r.json());

// 2. Para cada tema, obtener preguntas
for (const tema of temas.temas) {
  const preguntas = await fetch(
    `https://back.tutestdigital.es/api/Temas/${tema.id}/libro/44/preguntas`,
    { headers: h }
  ).then(r => r.json());
  
  console.log(`${tema.titulo}: ${preguntas.length} preguntas`);
  
  // Guardar por tema
  require('fs').writeFileSync(
    `preguntas-para-subir/tutestdigital/tema-${tema.id}.json`,
    JSON.stringify({
      tema: tema.titulo,
      temaId: tema.id,
      source: 'tutestdigital',
      questions: preguntas
    }, null, 2)
  );
  
  await new Promise(r => setTimeout(r, 200)); // Cortesía
}
```

---

## Limpieza de Enunciados (OBLIGATORIO antes de importar)

Las preguntas de TuTestDigital incluyen basura en los enunciados que hay que limpiar ANTES de insertar en la BD:

### Problemas detectados

| Patrón | Ejemplo | Acción |
|--------|---------|--------|
| **Coletilla de tema entre paréntesis al final** | `...son: (TEST ESTATUTO AUTONOMÍA DE LA REGIÓN DE MURCIA:)` | Eliminar |
| **Coletilla genérica de test al final** | `...son: (TEST CONSTITUCIÓN ESPAÑOLA)` | Eliminar |
| **Nombre del libro al final** | `...corresponde: (TEST 58 AUXILIARES ADMINISTRATIVOS CARM)` | Eliminar |

### Función de limpieza

```javascript
function cleanQuestionText(text) {
  return text
    // Eliminar coletillas entre paréntesis al final tipo (TEST ...)
    .replace(/\s*\(TEST\s+[^)]+\)\s*$/gi, '')
    .trim();
}
```

### Aplicar durante el scraping

La limpieza se debe aplicar al transformar las preguntas, ANTES de guardar el JSON:

```javascript
const questions = preguntas.map(q => ({
  question: cleanQuestionText(q.enunciado),  // ← limpiar aquí
  options: q.opciones.map((o, i) => ({
    letter: ['A', 'B', 'C', 'D'][i],
    text: o.texto
  })),
  // ...
}));
```

### Incidente (Abril 2026)

Las 26 preguntas del T2 (Estatuto de Murcia) se importaron sin limpiar. 19 de 26 tenían `(TEST ESTATUTO AUTONOMÍA DE LA REGIÓN DE MURCIA:)` al final del enunciado. Se corrigió post-importación con UPDATE masivo, pero lo correcto es limpiar en origen.

---

## Diferencias con OpositaTest

| Aspecto | OpositaTest | TuTestDigital |
|---------|-------------|---------------|
| **Scraping** | Crear test → obtener preguntas → descartar | Un GET al libro devuelve TODO |
| **Respuestas** | `correctAnswerId` (referencia a UUID) | `esCorrecta: true/false` directo |
| **Explicaciones** | Endpoint separado `/questions/{id}/reason` | Incluidas en la pregunta (`explicacionCorrecta`) |
| **Temas/Epígrafes** | 2 niveles (tema → epígrafe) | 1 nivel (tema, sin epígrafes) |
| **Validación** | Server-side (no envía respuesta hasta responder) | Client-side (todas las respuestas se envían) |
| **Exámenes** | Test persistente con UUID | Examen efímero (crear → entregar puntuación) |
| **JWT** | RS256, ~24h | HS256, ~1h |
| **Preguntas con imagen** | Campo `image` con URL | No detectadas en libro 44 |
| **Paginación** | No | No |
| **Protección** | Rate limiting posible | Sin protección aparente |
| **Cobertura explicaciones** | ~100% | ~88% (839/955 en libro 44) |

---

## Formato de Output para Importación

Para mantener compatibilidad con el proceso de importación existente, transformar al formato estándar:

```json
{
  "tema": "Tema 1.- Constitución Española de 1978",
  "subtema": null,
  "source": "tutestdigital",
  "questionCount": 185,
  "questions": [
    {
      "question": "Según el Título Preliminar de la CE...",
      "options": [
        { "letter": "A", "text": "Social y limitado de derecho." },
        { "letter": "B", "text": "Social y Monárquico." },
        { "letter": "C", "text": "Individual y democrático de derecho." },
        { "letter": "D", "text": "Social y democrático de derecho." }
      ],
      "correctAnswer": "D",
      "explanation": "España se constituye en un Estado social y democrático de Derecho."
    }
  ]
}
```

---

## Datos del Libro 44 (Aux Administrativos CARM)

| Dato | Valor |
|------|-------|
| **Título** | TEST 58 AUXILIARES ADMINISTRATIVOS CARM |
| **Total preguntas** | 955 |
| **Temas** | 16 |
| **Con explicación** | 839 (88%) |
| **Sin explicación** | 116 (12%) |
| **Rango IDs** | 23 - 22912 |

### Temas del libro 44

| ID | Preg | Título |
|----|------|--------|
| 431 | 185 | Tema 1: Constitución Española (Título Preliminar, Derechos fundamentales) |
| 432 | 26 | Tema 2: Estatuto de Autonomía de Murcia |
| 433 | 51 | Tema 3: Presidente, Consejo de Gobierno de Murcia |
| 434 | 15 | Tema 4: Régimen Jurídico del Sector Público |
| 435 | 65 | Tema 5: Disposiciones y actos administrativos |
| 436 | 163 | Tema 6: Procedimiento administrativo |
| 437 | 42 | Tema 7: Revisión actos vía administrativa |
| 438 | 52 | Tema 8: EBEP |
| 439 | 125 | Tema 9: Contratos del Sector Público |
| 440 | 12 | Tema 10: Hacienda de la Región de Murcia |
| 441 | 37 | Tema 11: Sede electrónica, identificación |
| 442 | 32 | Tema 12: Información administrativa, atención ciudadano |
| 443 | 8 | Tema 13: Archivos y Patrimonio Documental Murcia |
| 444 | 65 | Tema 14: Documentos administrativos |
| 445 | 34 | Tema 15: PRL |
| 446 | 44 | Tema 16: Igualdad y transparencia |

---

## Notas de Seguridad (hallazgos)

1. **passwordHash expuesto** en `/api/Users/me` — el endpoint devuelve el hash bcrypt/argon2 del password del usuario.
2. **Corrección 100% client-side** — las respuestas correctas se envían al cliente antes de responder. No hay validación server-side.
3. **Sin rate limiting aparente** — no se detectó throttling durante las pruebas.
4. **CORS permisivo** — `access-control-allow-origin: https://tutestdigital.es` (al menos restringido al frontend).
