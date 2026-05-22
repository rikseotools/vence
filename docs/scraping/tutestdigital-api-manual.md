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

## ⚠️ ALERTA DE CALIDAD: Vinculación artículo↔contenido (post-15/04/2026)

Las preguntas de TuTestDigital tienen un **patrón sistemático de desplazamiento de artículos**: el enunciado cita "Según el artículo N" pero el contenido real de la pregunta corresponde al artículo N±1, N±2 o incluso a otro completamente distinto del mismo cuerpo legal.

**Patrones detectados (Aux. Admin. Junta Extremadura, libro 83):**

| Tema | Casos | Ejemplo |
|---|---|---|
| T5 (FP II Ley 13/2015) | 8 mal vinculados | Pregunta cita "art. 136" (Servicio en otras AAPP) pero pregunta sobre servicios especiales (art. 135) |
| T7 (FP IV Ley 13/2015) | 11 mal vinculados | Preguntas sobre violencia de género (arts. 130-132 reales) desplazadas a arts. 129-131 |
| T12 (V Convenio JdE) | 22 mal vinculados | Sistemático +1 en numeración: art. 33 real (clasificación faltas) citado como art. 32 |
| T23 (Decreto 225/2014 AE) | 22 mal vinculados | Pregunta sobre comparecencia electrónica (art. 60) citando art. 61 (Tablón de Anuncios) |

**Patrón "explicación tautológica":** El campo `explanation` que devuelve el scraper **NO cita el texto real del artículo**. Es una reformulación de la opción marcada como correcta presentada como si fuera la ley. Ejemplo:

> Pregunta: *"Según art. 52, ¿qué garantiza el sistema de notificaciones electrónicas?"* (B = "confidencialidad, integridad y disponibilidad")
> Explicación scraper: *"Según el art. 52, el sistema garantiza la confidencialidad, integridad y disponibilidad."*
> **Realidad:** Art. 52 regula el archivo de gestión electrónico (no notificaciones); además la tríada exacta no aparece en NINGÚN artículo del Decreto.

**Implicación crítica:** **NUNCA** insertar preguntas TuTestDigital usando el `art. N` que cita el enunciado o la explicación. Hay que verificar contenido contra contenido real del artículo en BD. Ver flujo "ciclo completo con contexto completo" en `docs/maintenance/importar-preguntas-scrapeadas.md` §10.1.

**Tasa típica de rescate:** 60-95% según el tema. En materias técnicas con citas literales (T22 — definiciones AE), el rescate llega a 100%. En materias transversales (T12, T23 — sistemas, garantías, supletoriedad) baja al 37-67% porque el scraper inventa preguntas plausibles sin base normativa.

**Detección en lote:** comparar el `article_content` real de cada pregunta importada con el contenido de su `correct_option`. Si el texto literal de la opción correcta NO aparece en el `content` del artículo asignado → marcar para revisión.

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

Las preguntas de TuTestDigital incluyen coletillas entre parentesis al final del enunciado que hay que tratar ANTES de insertar en la BD. No todas se eliminan: algunas son instrucciones que forman parte de la pregunta, y otras son referencias a articulos/leyes utiles para vincular la pregunta.

### Tipos de parentesis al final del enunciado

| Tipo | Ejemplo | Accion | Frecuencia |
|------|---------|--------|------------|
| **Etiqueta TEST** | `(TEST ESTATUTO AUTONOMÍA DE LA REGIÓN DE MURCIA:)` | Eliminar | Alta |
| **Nombre del libro** | `(TEST 58 AUXILIARES ADMINISTRATIVOS CARM)` | Eliminar | Alta |
| **Etiqueta de ley** | `(Ley 9/2017)`, `(LEY 31/1995)`, `(Real Decreto 203/2021)` | Extraer como `lawHint`, eliminar del texto | Alta |
| **Etiqueta editorial** | `(D.V.)` | Eliminar | Media |
| **Etiqueta de tema** | `(INFORMÁTICA BÁSICA)`, `(WINDOWS 10)`, `(HOJA DE CÁLCULO: EXCEL)` | Eliminar | Media |
| **Referencia articulo** | `(artículo 13)`, `(art. 140)`, `(art 109)`, `(Artículos 35 y 36)` | Extraer como `articleHint`, eliminar del texto | Media |
| **Instruccion** | `(Señale la respuesta correcta)`, `(indica la opción incorrecta)` | **MANTENER** (es parte de la pregunta) | Baja |
| **Contenido** | `(#VALOR!)`, `(como la fecha actual o el número total de páginas)` | **MANTENER** (es parte de la pregunta) | Rara |

### Patrones que se MANTIENEN (forman parte de la pregunta)

```javascript
const KEEP_PATTERNS = [
  /indica.*respuesta/i,
  /indica.*opci/i,
  /marca.*incorrecta/i,
  /marca.*correcta/i,
  /señala.*incorrecta/i,
  /señala.*correcta/i,
  /elige.*correcta/i,
  /elige.*incorrecta/i,
  /todas son/i,
  /ninguna es/i,
  /cuál es correcta/i,
  /cuál es incorrecta/i,
  /cuál no es/i,
  /cuál sí es/i,
  /es falsa/i,
  /es verdadera/i,
  /es incorrecta/i,
  /es correcta/i,
  /^#/,                    // errores de hoja de calculo: (#VALOR!), (#REF!), (#N/A)
  /fecha actual/i,         // contenido explicativo que forma parte de la pregunta
  /número total de/i,      // idem
];
```

### Patrones que se EXTRAEN como hint (utiles para vincular)

Al importar, antes de eliminar la coletilla, extraer la informacion como hint:

```javascript
// Referencia a ley → guardar como lawHint
/ley|decreto|real decreto|orgánica|\d+\/\d{4}/i
// Ejemplos: (Ley 39/2015), (Real Decreto 203/2021), (LEY 31/1995)

// Referencia a articulo → guardar como articleHint
/art[íi]culos?\s+\d+|^art\.?\s+\d+/i
// Ejemplos: (artículo 13), (art. 140), (art 109), (Artículos 35 y 36)
```

### Funcion de limpieza completa

```javascript
function cleanQuestion(text) {
  if (!text) return text;

  // Ver si hay parentesis al final
  const match = text.match(/^([\s\S]*?)\s*\(([^)]+)\)\s*$/);
  if (!match) return text.trim();

  const before = match[1];
  const inside = match[2];

  // Si el contenido del parentesis es una instruccion o contenido → mantener
  if (KEEP_PATTERNS.some(p => p.test(inside))) {
    return text.trim();
  }

  // Si no es una instruccion, es una etiqueta → eliminar y limpiar recursivo
  // (por si hay varias coletillas anidadas)
  return cleanQuestion(before.trim());
}
```

### Extraccion de hints al importar

La limpieza durante el scraping elimina las coletillas. Pero al **importar** en la BD, se debe extraer la informacion util ANTES de limpiar:

```javascript
function parseQuestion(rawText) {
  const match = rawText.match(/^([\s\S]*?)\s*\(([^)]+)\)\s*$/);
  if (!match) return { question: rawText.trim(), lawHint: null, articleHint: null };

  const inside = match[2];

  // Instrucciones → mantener, no extraer
  if (KEEP_PATTERNS.some(p => p.test(inside))) {
    return { question: rawText.trim(), lawHint: null, articleHint: null };
  }

  // Referencia a ley
  if (/ley|decreto|real decreto|orgánica|\d+\/\d{4}/i.test(inside)) {
    return { question: cleanQuestion(rawText), lawHint: inside, articleHint: null };
  }

  // Referencia a articulo
  if (/art[íi]culos?\s+\d+|^art\.?\s+\d+/i.test(inside)) {
    return { question: cleanQuestion(rawText), lawHint: null, articleHint: inside };
  }

  // Etiqueta sin valor → limpiar sin guardar
  return { question: cleanQuestion(rawText), lawHint: null, articleHint: null };
}
```

### Aplicar durante el scraping

La limpieza se aplica al transformar las preguntas, ANTES de guardar el JSON. Ver `scripts/tutestdigital-scraper-completo.cjs` que ya incluye `cleanQuestion()` con todos los patrones.

### Incidente (Abril 2026)

Las 26 preguntas del T2 (Estatuto de Murcia) se importaron sin limpiar. 19 de 26 tenian `(TEST ESTATUTO AUTONOMÍA DE LA REGIÓN DE MURCIA:)` al final del enunciado. Se corrigio post-importacion con UPDATE masivo, pero lo correcto es limpiar en origen.

---

## Basura SIN paréntesis al final del enunciado (Abril 2026)

`cleanQuestion()` solo detecta coletillas entre `(...)`. Pero hay preguntas donde el scraper concatena la etiqueta del libro al final del enunciado **sin paréntesis**. Ejemplos reales:

```
"Según el artículo 9, ¿qué se entiende por entidad colaboradora...? TEST LEY 9/2007 DE SUBVENCIONES DE GALICIA"
"De acuerdo con el artículo 21.3, el plazo para... será de: TEST LEY 9/2007 DE SUBVENCIONES DE GALICIA"
```

### Patrones a limpiar sin paréntesis

Añadir al pipeline de limpieza ANTES de `cleanQuestion()`:

```javascript
const INLINE_JUNK_PATTERNS = [
  /\s+TEST\s+(?:LEY|REAL DECRETO|LEY ORGÁNICA|ESTATUTO|DECRETO|RDL)\b[^\n]*$/i,
  /\s+TEST\s+\d+\s+(?:AUXILIAR|ADMINISTRATIVO|OPOSICI)[^\n]*$/i,
  /\s+TEMARIO\s+(?:OFICIAL|ADMINISTRATIVO|AUXILIAR)[^\n]*$/i,
  /\s+\(D\.V\.\)\s*$/i,
  /\s+EXAMEN\s+\d{4}[^\n]*$/i,
];

function stripInlineJunk(text) {
  let cleaned = text;
  for (const p of INLINE_JUNK_PATTERNS) cleaned = cleaned.replace(p, '');
  return cleaned.trim();
}
```

### Orden de aplicación en el pipeline

```javascript
const raw = q.question;
const noJunk = stripInlineJunk(raw);        // 1) quitar basura sin paréntesis
const parsed = parseQuestion(noJunk);       // 2) extraer hints + aplicar cleanQuestion
const contextualized = ensureLawContext(parsed.question, lawName); // 3) ver sección siguiente
```

---

## Contextualización de ley tras la limpieza (Abril 2026)

**Problema:** al eliminar `(TEST LEY 9/2007 DE SUBVENCIONES DE GALICIA)` o variantes sin paréntesis, muchas preguntas quedan con referencias tipo *"Según el artículo 9, ¿qué se entiende…?"* sin mencionar de qué ley hablan. El opositor se queda sin contexto.

### Detección

Tras limpiar, una pregunta queda "ambigua" si:

1. Contiene el patrón `/según el art[íi]culo \d+/i` o similar, **Y**
2. No menciona explícitamente la ley (ni por short_name ni por nombre completo), **Y**
3. No contiene otro contextualizador inequívoco (p.ej. `"Xunta de Galicia"`, `"Consejo de la Xunta"`, `"Registro Público de Subvenciones"`)

### Solución: inyectar la ley explícitamente

Al importar, cuando la pregunta se clasifica como ambigua, reescribir injectando la ley en la primera cita de artículo. **Dos trampas que evitar:**

1. **Contracción `de + el` → `del`**: si `lawFullName` empieza por `el` (ej: "el Real Decreto Legislativo 2/2015"), el resultado ingenuo es "... artículo N **de el** Real Decreto Legislativo ..." — agramatical. Hay que contraer a `del`.
2. **Fallback silencioso**: si no hay un punto de inyección claro ("Según el art. N..."), no prepender ciegamente la ley al principio — queda feo ("el Real Decreto... <pregunta>"). Mejor marcar `needs_manual_rewrite: true` y procesar aparte.

```javascript
function ensureLawContext(text, lawFullName) {
  // 1) Ya menciona la ley → no tocar
  const mentionsLawRegex = new RegExp(lawFullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (mentionsLawRegex.test(text)) return { text, needs_manual_rewrite: false };

  // 2) Preposición correcta según género de la ley
  // lawFullName = "el Real Decreto..." → "del Real Decreto..."
  // lawFullName = "la Ley 7/2023..."   → "de la Ley..."
  // lawFullName = "los Tratados..."    → "de los Tratados..."
  const prep = lawFullName.startsWith('el ')  ? 'del ' + lawFullName.slice(3)
             : lawFullName.startsWith('la ')  ? 'de ' + lawFullName
             : lawFullName.startsWith('los ') ? 'de ' + lawFullName
             : lawFullName.startsWith('las ') ? 'de ' + lawFullName
             : 'de ' + lawFullName

  // 3) Buscar punto de inyección: primera "según/de acuerdo con/conforme a/a tenor de el art. N"
  const patterns = [
    /((?:Seg[uú]n|De acuerdo con|Conforme a|A tenor de|A efectos de)(?:\s+lo dispuesto en)?(?:\s+el)?\s+[Aa]rt[íi]culos?\s+\d+(?:\.\d+)?(?:\s+(?:bis|ter))?)/,
    /^([Aa]rt[íi]culo\s+\d+(?:\.\d+)?)/, // "Artículo N ..." al principio
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const idx = m.index + m[0].length;
      // No inyectar si lo siguiente ya es "del", "de la", "de lo", "de la constituci"
      const after = text.slice(idx, idx + 25);
      if (/^\s+(del|de la|de los|de las|de lo)/i.test(after)) continue;
      return { text: text.slice(0, idx) + ' ' + prep + text.slice(idx), needs_manual_rewrite: false };
    }
  }

  // 4) NO hay punto de inyección claro → NO prependerla al principio.
  // Mejor devolver el texto original y marcarlo para revisión manual.
  // El pipeline debería reformular estas preguntas con "Según el artículo <N> <prep>, <cuerpo>"
  // usando el artículo vinculado (primary_article_id.article_number).
  return { text, needs_manual_rewrite: true };
}
```

**Tratamiento del `needs_manual_rewrite` en el pipeline:**

```javascript
const result = ensureLawContext(raw, lawFullName);
if (result.needs_manual_rewrite) {
  // Reformular usando el artículo vinculado del scope
  const art = primaryArticleNumber; // del primary_article_id ya mapeado
  finalText = `Según el artículo ${art} ${prep}, ${result.text.charAt(0).toLowerCase() + result.text.slice(1)}`;
}
```

### Ejemplo real

**Antes (tras `stripInlineJunk`):**
> "Según el artículo 9, ¿qué se entiende por entidad colaboradora en la gestión de subvenciones?"

**Después de `ensureLawContext(..., 'Ley 9/2007, de 13 de junio, de subvenciones de Galicia')`:**
> "Según el artículo 9 de la Ley 9/2007, de 13 de junio, de subvenciones de Galicia, ¿qué se entiende por entidad colaboradora en la gestión de subvenciones?"

### Casos que no se pueden autorreparar

- Preguntas que dicen solo *"De acuerdo con lo previsto en la presente ley…"* sin mencionar el número de artículo → requieren reescritura manual porque la regex no tiene punto de inserción obvio.
- Preguntas con múltiples leyes implícitas (raro) → revisar a mano durante la verificación.

### Incidente (11/04/2026 — C1 T12 Subvenciones Galicia)

De 24 preguntas importadas del tema T12, 7 tenían `TEST LEY 9/2007 DE SUBVENCIONES DE GALICIA` al final **sin paréntesis**. `cleanQuestion()` no las tocó. Tras un post-fix manual con `stripInlineJunk` + `ensureLawContext`, las 7 quedaron reescritas y contextualizadas. Desde esa fecha, el pipeline de C1 Galicia aplica ambos pasos en orden.

### Incidente (11/04/2026 — C1 T18 Estatuto de los Trabajadores)

Primera aplicación completa del pipeline con los 3 pasos. Dos bugs adicionales detectados en `ensureLawContext`:

1. **Gramática "de el"**: con `lawFullName = "el Real Decreto Legislativo 2/2015"`, el resultado era `"artículo N de el Real Decreto Legislativo..."`. Afectó a 6 preguntas importadas antes del fix, y también a preguntas previas de otros imports Galicia (TUE, TFUE, DL 1/1999, RDL 1/2013, RDL 8/2015). Corregido con la contracción `de + el → del`.

2. **Fallback silencioso**: cuando la pregunta del source NO empieza con "Según el artículo N", `ensureLawContext` prependía ciegamente `"el Real Decreto Legislativo 2/2015, del Estatuto de los Trabajadores. <cuerpo>"` al principio — agramatical y sin mencionar el artículo. Afectó a 7 preguntas del T18. Fix: devolver `needs_manual_rewrite: true` y que el pipeline reformule usando el número de artículo vinculado.

3. **Bonus — explicaciones copia del artículo**: 30 de 34 preguntas "perfect" tenían explicaciones que solo transcribían el texto del artículo sin análisis por opción. Los verificadores anteriores las marcaron como `perfect` porque `explanation_ok` era demasiado laxo. Ver `docs/maintenance/revisar-preguntas-con-agente.md §8.1` para el criterio estricto post-11/04/2026.

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
