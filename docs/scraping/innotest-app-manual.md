# Manual de Scraping — InnoTest (Apps Android)

> **Fecha:** 17 Abril 2026
> **Estado:** ✅ API **mapeada, probada y scrapeada**. 13,609 preguntas descargadas (98.9% cobertura) + 1,145 imágenes + 170 artículos.
> **Developer:** INNOTEST IBERICA S.L.
> **Backend real:** `https://server2.innotest.app/api-apps-nuevas/Api/public/` (apps móviles) / `https://server.innotest.app/api-apps-nuevas/Api/public/` (web)
> **Web:** `https://web.innotest.app` (Angular, login solo vía QR desde app móvil)

---

## 1. Resumen ejecutivo

InnoTest publica **una app Android nativa por oposición** (Java/Kotlin, no React Native). Todas comparten el **mismo backend** en `core.innotest.app` — analizar una app basta para mapear la API completa.

**Apps analizadas:**
| App | Package | Versión | Tamaño |
|-----|---------|---------|--------|
| Policía Nacional | `innotest.policianacional` | 3.2.0 | 92 MB |
| Guardia Civil | `innotest.testguardiacivil2018` | 4.3.2 | 87 MB |
| Correos | `innotest.correos` | 2.2.0 | 96 MB |
| Inst. Penitenciarias | `innotest.institucionespenitenciarias` | 2.1.4 | 86 MB |

**Otras apps del mismo developer (no analizadas, mismo backend):**
| App | Package |
|-----|---------|
| Auxiliar Adtvo Estado | `innotest.aux_adm_estado` |
| Administrativo Estado | `innotest.administrativo_estado` |
| Constitución Española | `innotest.constitucion1978` |
| Justicia | `innotest.adjudicial` |

**Hallazgos clave:**
- Backend unificado: `core.innotest.app` (producción) / `dev.core.innotest.app` (desarrollo)
- API REST con rutas en español, 52+ endpoints
- Auth por token (probablemente Firebase Auth → token propio)
- Endpoints parametrizados con `{oposicionID}`, `{usuarioID}`, `{invitadoID}` (modo invitado)
- CDN de imágenes: `cdn.innotest.app` y `web.innotest.app/recursos/imagenes/`
- Servidor legacy: `server.innotest.app/api-apps-nuevas/Api/public/` (apps antiguas)
- API de desarrollo expuesta: `dev.core.innotest.app`

---

## 2. Información de las apps

| Campo | Valor |
|-------|-------|
| Framework | Android nativo (Java/Kotlin) |
| Motor JS | No aplica (no es híbrida) |
| DEX files | 8-9 (classes.dex a classes9.dex, ~60 MB total) |
| Assets JS | Solo WebView de comparación (`info.js`, `generar.js`) |
| Auth | Firebase Auth (Google, Facebook, email) + token propio |
| Push | OneSignal + HMS (Huawei) |
| Analytics | Firebase Analytics + Facebook SDK |
| Ads | AdMob (Google Mobile Ads) |
| Chat soporte | Tawk.to (`618a374b6885f60a50baf5e5`) |

---

## 3. Análisis estático del APK (procedimiento)

```bash
# 1. Descargar XAPK desde APKCombo
#    https://apkcombo.com/innotest-policia-nacional/innotest.policianacional/

# 2. Extraer XAPK (es un ZIP)
mkdir -p /tmp/innotest-analysis && cd /tmp/innotest-analysis
unzip -q ~/Descargas/InnoTest*.xapk

# 3. Extraer APK principal
mkdir apk && cd apk
unzip -q ../innotest.policianacional.apk

# 4. Los endpoints están en los DEX files (código Java/Kotlin compilado)
# A diferencia de React Native, NO hay bundle JS — todo está en bytecode Dalvik
strings -n 4 classes*.dex | grep -P '^api/v[0-9]' | sort -u

# 5. Buscar URLs base
strings -n 10 classes*.dex | grep -oP 'https?://[a-zA-Z0-9._/:-]+' | sort -u | grep innotest
```

**Nota:** Las apps Android nativas almacenan los strings de endpoints directamente en los DEX files como constantes de compilación. A diferencia de React Native/Cordova, los endpoints están en texto plano sin ofuscación, lo que hace el mapeo trivial con `strings`.

---

## 4. Arquitectura

### Dominios descubiertos

| Dominio | Función | Estado |
|---------|---------|--------|
| `server2.innotest.app` | **API real de las apps móviles** (Apache/2.4.52 Debian, PHP 7.3) | ✅ Verificado |
| `server.innotest.app` | **API de la web** (Apache/2.4.29 Ubuntu, Varnish cache delante) | ✅ Verificado |
| `core.innotest.app` | Dominio en el código — cert self-signed, 404 en todo | ❌ No funciona |
| `dev.core.innotest.app` | Dominio dev — mismo problema que core | ❌ No funciona |
| `cdn.innotest.app` | CDN de assets | — |
| `web.innotest.app` | Frontend web (Angular) | ✅ |
| `web.innotest.app:3000` / `:3001` | Frontend dev (en código, no accesible) | ❌ |
| `innotest.es` | Web corporativa | ✅ |

**IMPORTANTE:** Las apps móviles usan `server2.innotest.app`. La web usa `server.innotest.app`. Son servidores diferentes con bases de datos de tokens separadas — un token de uno NO funciona en el otro.

### URLs de recursos

| URL | Contenido |
|-----|-----------|
| `server.innotest.app/recursos/` | Recursos generales |
| `server.innotest.app/recursos/imagenes/` | Imágenes de preguntas |
| `web.innotest.app/recursos/imagenes/` | Mirror de imágenes |
| `web.innotest.app/suscripcion/?token=` | Página de suscripción (con token de usuario) |

### API legacy

```
https://server.innotest.app/api-apps-nuevas/Api/public/          # producción
https://server.innotest.app/api-apps-nuevas-desarrollo/Api/public/ # desarrollo
https://server.innotest.app/api-apps-nuevas/Api/public/api_host  # endpoint para obtener host actual
```

El endpoint `api_host` sugiere que la URL base de la API se obtiene dinámicamente — probablemente devuelve `core.innotest.app` como host actual.

---

## 5. Autenticación

Firebase Auth como provider (Google, Facebook, email). Tras autenticarse con Firebase, se obtiene un token propio del backend de InnoTest.

Entidades de auth detectadas:
- `LoginEntity(token=...)` — token de login
- `LoginActivoEntity(token=...)` — token de sesión activa
- `TokenLoginEntity(token_type=...)` — tipo de token
- `TokenModel(token_type=...)` — modelo de token

Endpoints de auth:
```
POST api/v1/iniciosesion          # Login
POST api/v1/comprobarsesion       # Verificar sesión activa
POST api/v1/confirmacionemail     # Confirmar email
POST api/v1/preinicio             # Pre-inicio (obtener config)
```

---

## 6. Endpoints Completos

### Tests y Preguntas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| — | `api/v1/preguntastest` | Obtener preguntas de un test |
| — | `api/v1/preguntashistorial` | Obtener preguntas del historial |
| — | `api/v1/testaleatoriobloque` | Crear test aleatorio por bloque |
| — | `api/v1/infotest/{testID}` | Información de un test |
| — | `api/v1/repetir/{testHistorialID}` | Repetir un test del historial |
| — | `api/v1/puntuacion/{testHistorialID}` | Puntuación de un test |
| — | `api/v2/configurartest` | Configurar test personalizado |
| — | `api/v2/repaso/{testHistorialID}` | Modo repaso de un test |
| — | `api/v2/tests/{typeID}/oposicion/{oposicionID}/bloque/{bloqueID}/tipo/{tipo}` | Tests por tipo y bloque |
| — | `api/v2/preguntas/{preguntaID}/oposicion/{oposicionID}/usuario/{usuarioID}/invitado/{invitadoID}` | Detalle de pregunta |
| — | `api/v4/preguntas/create/moderacion-pregunta` | Crear pregunta (moderación) |
| — | `api/v4/tests/show/detalles-tests-usuario/{usuarioID}/{oposicion}/{bloqueID}` | Detalles de tests del usuario |

### Estadísticas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| — | `api/v1/estadisticas/{estadisticaID}/oposicion/{oposicionID}/usuario/{usuarioID}/invitado/{invitadoID}/bloque/{bloqueID}/bloquetest/{bloqueTestId}` | Estadísticas por bloque |
| — | `api/v1/estadisticastests/{estadisticaID}/oposicion/{oposicionID}/usuario/{usuarioID}/invitado/{invitadoID}/bloque/{bloqueID}` | Estadísticas de tests |
| — | `api/v1/estadisticas/{usuarioID}/invitado/{invitadoID}/oposicion/{oposicionID}/bloque/{bloqueID}/test/{estadisticaID}` | Estadísticas individuales |

### Rankings

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| — | `api/v2/ranking/generarRanking` | Generar ranking |
| — | `api/v2/ranking/obtenerCantidadIntentosPorTestID/usuarioID/{usuarioID}/oposicionID/{oposicionID}/bloqueID/{bloqueID}/testID/{testID}` | Intentos por test |
| — | `api/v2/ranking/obtenerDetallesPosicionUsuarioRanking/registros_por_pagina/{registrosPorPagina}/usuario/{usuario}/oposicion/{oposicion}/bloque/{bloque}` | Posición del usuario |
| — | `api/v2/ranking/obtenerListadoPosicionesRanking/registros_por_pagina/{registrosPorPagina}/pagina/{pagina}/usuario/{usuario}/oposicion/{oposicion}/bloque/{bloqueID}` | Listado de rankings |
| — | `api/v2/ranking/obtenerListadoPosicionesRanking/buscar/{nombreUsuario}/registros_por_pagina/{registrosPorPagina}/pagina/{pagina}/usuario/{usuario}/oposicion/{oposicion}/bloque/{bloqueID}` | Buscar usuario en ranking |

### Usuario y Perfil

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| — | `api/v1/iniciosesion` | Login |
| — | `api/v1/comprobarsesion` | Verificar sesión |
| — | `api/v1/confirmacionemail` | Confirmar email |
| — | `api/v1/preinicio` | Pre-inicio (config) |
| — | `api/v1/usuarios/editarperfil` | Editar perfil (v1) |
| — | `api/v1/usuarios/editarperfil/{oposicionID}` | Editar perfil por opo |
| — | `api/v1/usuarios/perfil/{oposicionID}/usuario/{usuarioID}` | Ver perfil |
| — | `api/v4/usuarios/editarperfil` | Editar perfil (v4) |
| — | `api/v4/usuarios/datos/{oposicionID}/usuario/{usuarioID}/deviceCharID/{deviceID}` | Datos de usuario |
| — | `api/v1/usuarios/vinculacionkey/{usuarioID}` | Clave de vinculación |
| — | `api/v1/usuarios/{usuarioID}/app/{appID}/oposicion/{oposicionID}/dispositivo/{dispositivoID}` | Registro de usuario |
| — | `api/v1/usuario/accion/{accion}/usuario/{usuarioID}/invitado/{invitadoID}/oposicion/{oposicionID}` | Acción de usuario |

### Dispositivos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| — | `api/v1/dispositivos/{deviceID}` | Info de dispositivo |
| — | `api/v1/dispositivos/{devicecharID}/oposicion/{oposicionID}` | Dispositivo por opo |
| — | `api/v1/dispositivos/cerrar-sesion/{deviceId}` | Cerrar sesión |
| — | `api/v1/dispositivo/usuario/{usuarioID}/oposicion/{oposicionID}` | Dispositivo de usuario |
| — | `api/v1/dispositivos/{oposicionID}/usuario/{usuarioID}/invitado/{invitadoID}` | Dispositivo con invitado |

### Favoritas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| — | `api/v1/usuarios/favorita` | Listar favoritas |
| — | `api/v1/usuarios/favorita/{idFavorita}` | Detalle de favorita |
| — | `api/v1/usuarios/favorita/{usuarioID}/invitado/{invitadoID}/oposicion/{oposicionID}/bloque/{bloqueID}/pregunta/{preguntaID}` | Marcar/desmarcar favorita |
| — | `api/v2/usuarios/favorita/{oposicionID}/usuario/{usuarioID}/invitado/{invitadoID}/bloque/{bloqueID}` | Favoritas por bloque |

### Suscripciones

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| — | `api/v1/suscripcion/oposicion/{oposicionID}/usuario/{id}` | Estado de suscripción |
| — | `api/v2/suscripcion/oposicion/{oposicionId}/usuario/{userId}` | Suscripción v2 |
| — | `api/v2/suscripcion/{suscripcionID}` | Detalle de suscripción |
| — | `api/v2/suscripcion/historial/oposicion/{oposicionId}/usuario/{userId}` | Historial de suscripción |
| — | `api/v2/suscripcion/pagos/{subscriptionId}/porpagina/{perPage}/pagina/{numberPage}` | Pagos de suscripción |
| — | `api/v1/desuscripcionestiposmotivo` | Motivos de cancelación |
| — | `api/v2/promociones/usuarios` | Promociones |
| — | `api/v4/redeemcode/validate` | Validar código de redención |

### Contenido y Estructura

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| — | `api/v1/esquemas` | Listar esquemas (estructura de temas) |
| — | `api/v1/esquemasbuscador` | Buscar en esquemas |
| — | `api/v1/iniciobloque/usuario/{usuarioID}/invitado/{invitadoID}/bloque/{bloqueID}/oposicion/{oposicionID}/tipo/{tipo}` | Iniciar bloque |
| — | `api/v1/oposicionesotras` | Otras oposiciones disponibles |
| — | `api/v1/oposicionesotrasusuarios` | Oposiciones de otros usuarios |
| — | `api/v1/oposicionesselectorce` | Selector de oposiciones CE |
| — | `api/v1/oposiciones/obtener-selector-oposiciones/{verticalID}` | Selector por vertical |
| — | `api/v1/selectorrespuestasce` | Selector de respuestas CE |
| — | `api/v1/configuracion/pdfconstitucion` | PDF de Constitución |

### Blog y Recursos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| — | `api/v1/blog/page/{page}/oposicion/{oposicionID}/usuario/{usuarioID}/invitado/{invitadoID}` | Posts del blog |
| — | `api/v1/recursos/{oposicionID}` | Recursos por oposición |
| — | `api/v1/recursosapp/{oposicionID}/usuario/{usuarioID}/pantalla/18` | Recursos de la app |
| — | `api/v1/audios` | Listar audios |
| — | `api/v1/audiosbuscador` | Buscar audios |

### Notas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| — | `api/v1/notas` | Listar notas |
| — | `api/v1/notas/{notaID}` | Detalle de nota |
| — | `api/v1/notas/descargar` | Descargar notas |
| — | `api/v1/notas/oposicion/{oposicionID}/usuario/{usuarioID}` | Notas por opo |
| — | `api/v1/notas/filtro/porpagina/{porpagina}/pagina/{pagina}` | Notas paginadas |
| — | `api/v1/notas/incrementarvisualizacion` | Incrementar vistas |
| — | `api/v1/notas/etiquetas` | Etiquetas de notas |
| — | `api/v1/notas/etiquetas/{notaID}` | Etiquetas de una nota |
| — | `api/v1/notas/etiquetas/oposicion/{oposicionID}/nota/{notaID}/etiqueta/{etiquetaID}` | Gestionar etiqueta |
| — | `api/v1/notas/obteneretiquetas/oposicion/{oposicionID}/usuario/{usuarioID}/porpagina/5/pagina/1` | Listar etiquetas |
| — | `api/v1/notasfijadas` | Notas fijadas |

### Soporte y Otros

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| — | `api/v1/tickets` | Listar tickets |
| — | `api/v1/tickets/{id}` | Detalle de ticket |
| — | `api/v1/tickets/{oposicionID}/usuario/{usuarioID}/invitado/{invitadoID}/bloque/{bloqueID}` | Crear ticket por bloque |
| — | `api/v1/getallfaqs/{oposicionID}` | FAQs por oposición |
| — | `api/v1/tablon/{oposicionID}/usuario/{usuarioID}/invitado/{invitadoID}/convocatoria/{convocatoria}` | Tablón de anuncios |
| — | `api/v1/tablonleido` | Marcar tablón como leído |
| — | `api/v1/sendevent` | Enviar evento de analytics |
| — | `api/v1/permisos` | Permisos |
| — | `api/v1/menuajustes/oposicion/{oposicionID}` | Menú de ajustes |
| — | `api/v1/prehome/oposicion/{oposicionID}/usuario/{usuarioID}/dispositivo/{deviceID}/keyentry/{keyentry}` | Pre-home |
| — | `api/v1/plan/{planID}/usuario/{usuarioID}/oposicion/{oposicionID}/dispositivo/{deviceID}/keyEntry/{keyEntry}` | Plan de estudio |
| — | `api/v1/plan/{planID}/usuario/{usuarioID}/oposicion/{oposicionID}/dispositivo/{deviceID}` | Plan de estudio (sin key) |
| — | `api/v1/usoweb/usuario/{usuarioID}/invitado/{invitadoID}/oposicion/{oposicionID}` | Uso web |
| — | `api/v1/solicitarborrado/oposicion/{oposicionID}/usuario/{usuarioID}/invitado/{invitadoID}` | Solicitar borrado de datos |
| — | `api/v2/solicitaracceso` | Solicitar acceso |
| — | `api/v2/responderavisorgpd` | Responder aviso RGPD |
| — | `api/v2/responderconfiguracionnotificacionesusuario` | Config notificaciones |

### Geolocalización

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| — | `api/v1/provincias` | Listar provincias |
| — | `api/v1/municipios` | Listar municipios |
| — | `api/v2/municipios/{provinciaID}` | Municipios por provincia |
| — | `api/v1/sindicatos` | Listar sindicatos |
| — | `api/v1/vias` | Listar vías |
| — | `api/v1/academias/{oposicionID}/provincia/{provinciaID}` | Academias por opo y provincia |

### Historial

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| — | `api/v1/historial/{historialID}` | Detalle de historial |
| — | `api/v2/historial/{oposicionID}/usuario/{usuarioID}/invitado/{invitadoID}/porpagina/{porpagina}/pagina/{pagina}/ranking_evaluacion_tipoID/{ranking_evaluacion_tipoID}` | Historial paginado |

---

## 7. Modelo de datos (campos detectados en entidades)

De las entidades Kotlin serializadas en los DEX:

### Pregunta
- `preguntaID`
- `bloqueID`
- `bloque_tema`
- `contestacion` (respuesta del usuario)
- `contestadas`
- `contadorNoContestadas`

### Test
- `testID`
- `testHistorialID`
- `bloque_testID`
- `cantidad_preguntas_tests`
- `cantidad_tests_realizados`
- `cantidad_tests_no_realizados`
- `cantidad_tests_total`
- `cantidad_intentos_tests_realizados`

### Bloque (tema)
- `bloqueID`
- `bloque` (nombre)
- `bloqueTemas` / `bloque_temas`
- `bloqueMenu`
- `bloqueHipervinculo`
- `bloqueado` (requiere suscripción)
- `bloqueo`

### Estadísticas
- `estadisticas_globales`
- `estadisticasGlobalMes`
- `estadisticasMes`
- `evaluacion_ranking`
- `borrado_estadisticas`
- `configurar_ranking`

### Suscripción
- `suscripcionID`
- `desuscripcion`
- `desuscripcionPendiente`

### Evaluación
- `EvaluationTestsBySubject(bloque=...)`

---

## 8. Flujo de Scraping VERIFICADO (Abril 2026)

### Login desde PC

```javascript
const BASE = "https://server2.innotest.app/api-apps-nuevas/Api/public";

async function login() {
  const r = await fetch(BASE + "/base/login", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      devicecharID: "17cbd1ff86ca70b8",   // ID del dispositivo (fijo)
      email: "manueltrader@gmail.com",
      identificador: "android_co",         // identificador de la app de Correos
      keyentry: 1699,                      // clave de entrada
      metodo_login: 1,                     // 1=Google
      modelo: "Samsung SM-S926B",
      notification: 0,
      oposicionID: 5,                      // 5=Correos
      pushID: "7abf9ed8-3b88-40e9-8c19-c2771d66b468",
      secret: "lkkjlW0lMexBHItdFuQSnnKnEhPuT1dtapHWK2ir",  // OAuth client secret
      simulacion: 0,
      source: 1,
      vos: "16"                            // versión OS
    })
  });
  return (await r.json()).data.token.access_token;
}
```

**IMPORTANTE:** El token se invalida cuando se hace un nuevo login. Hacer login + peticiones en la misma ejecución. No guardar el token para uso posterior.

### Identificadores por app

| App | identificador | oposicionID |
|-----|---------------|-------------|
| Correos | `android_co` | 5 |
| Policía Nacional | `android_pn` (probable) | 2 |
| Guardia Civil | `android_gc` (probable) | 16 |
| Inst. Penitenciarias | `android_ip` (probable) | ? |

### Obtener preguntas con respuestas

```javascript
// Después del login, en la misma ejecución:
const h = {"Authorization": "Bearer " + token, "Content-Type": "application/json"};

const r = await fetch(BASE + "/api/v1/preguntastest", {
  method: "POST", headers: h,
  body: JSON.stringify({
    bloqueID: 2,                                    // 2=Conocimientos, 4=Psicotécnicos, 5=Ex.Oficiales
    bloque_tema: [{
      bloque_testID: 785,                           // ID del sub-tema
      etiquetas: [],
      nombre: "",
      orden: 1,
      premium: false,
      testID: 316758                                // ID del tema padre
    }],
    deviceID: 499578,                               // dispositivo ID del login
    dificultades: [4],                              // 1=fácil, 2=media, 3=difícil, 4=aleatoria
    evaluacion_ranking: 0,
    invitadoID: 499578,
    limite: 10,                                     // número de preguntas (10, 20, 50, 100)
    modoCorreccion: 1,                              // 1=Estudio, 2=Examen
    oposicionID: "5",
    ponderado: false,
    testID: [0],
    test_tipoID: 2,                                 // 2=por temas
    tiempo: 9,                                      // minutos
    tipo: 1,
    usuarioID: 3313000
  })
});
const d = await r.json();
// d.data.preguntas[] → array de preguntas con respuestas
```

### Estructura de pregunta (respuesta de la API)

```json
{
  "id": 75802,
  "testID": 316758,
  "bloque_testID": 785,
  "enunciado": "Texto de la pregunta...",
  "nombre": "Simulacro Reparto 2023 (2)",
  "tipoPregunta": "normal",
  "multiple": false,
  "feedback": "HTML con explicación y citas legales",
  "tema": "Bloque 1.1. Correos: marco normativo...",
  "referencia": "Bloque 1.1... | Simulacro Reparto 2023",
  "bloqueID": "2",
  "image": "",
  "respuestas": [
    {"id": 7114049, "respuesta": "Texto opción A", "correcta": 0, "orden": "A)"},
    {"id": 7114050, "respuesta": "Texto opción B", "correcta": 0, "orden": "B)"},
    {"id": 7114051, "respuesta": "Texto opción C", "correcta": 0, "orden": "C)"},
    {"id": 7114052, "respuesta": "Texto opción D", "correcta": 1, "orden": "D)"}
  ],
  "articulo": {
    "id": 40274,
    "leyID": 153,
    "articulo": "23",
    "denominacion": "Condiciones de recogida...",
    "texto": "HTML con texto completo del artículo",
    "nombre_btn": "Ver Art 23",
    "titulo": "Artículo 23 Del servicio postal universal..."
  },
  "favorita": false,
  "notas_publicas": [],
  "notas_privadas": []
}
```

**SIN protección anti-scraping:** `correcta: 1` viene directamente en la respuesta. No hay que responder la pregunta para obtener la correcta (a diferencia de OpositaTest).

### Obtener estructura de temas

```javascript
// Listar temas de un bloque (para obtener testID y bloque_testID)
const r = await fetch(BASE + "/api/v2/tests/2/oposicion/5/bloque/2/tipo/1", {headers: h});
// Devuelve lista de temas con sus IDs
```

### Header obligatorio: `deviceID`

Todos los endpoints (excepto login) requieren el header `deviceID`:

```javascript
const h = {
  "Authorization": "Bearer " + token,
  "Content-Type": "application/json",
  "deviceID": "499578"   // ← OBLIGATORIO
};
```

Sin este header, la API devuelve `{"error": "No se ha recibido el deviceID"}`.

### Obtener estructura de temas

```javascript
// GET /api/v2/tests/2/oposicion/{opoID}/bloque/{bloqueID}/tipo/1
// El primer param (2) es el ID del bloqueMenu "Temas"
// Devuelve array con grupo "Temario" que contiene todos los temas
const r = await fetch(BASE + "/api/v2/tests/2/oposicion/5/bloque/2/tipo/1", {headers: h});
const d = await r.json();
// d.data[0].temas[] → array de temas con testID, bloqueTemas[], count_preguntas
```

### Datos verificados (Correos, oposición 5)

| Campo | Valor |
|-------|-------|
| Usuario ID | 3313000 |
| Dispositivo ID / Invitado ID | 499578 |
| Oposición ID | 5 |
| Bloques | 2 (Conocimientos), 4 (Psicotécnicos), 5 (Ex. Oficiales) |
| Suscripción | Premium hasta 2026-05-17 |
| Servidor | `server2.innotest.app` |
| **Total preguntas** | **8,708** (solo Conocimientos) + 220 (Test específicos) |

### Estructura de temas Correos (8,708 preguntas)

| Tema | Nombre | Preguntas | testID | Sub-bloques |
|------|--------|-----------|--------|-------------|
| 1 | Correos: marco normativo y organización | 813 | 316758 | 4 (btID 785-788) |
| 2 | Experiencia de personas en Correos | 368 | 316759 | 2 (btID 789-790) |
| 3 | Productos y servicios I | 2,042 | 316760 | 4 (btID 791-794) |
| 4 | Productos y servicios II | 1,064 | 316761 | 4 (btID 795-798) |
| 5 | Nuevas líneas de negocio | 126 | 316762 | 0 |
| 6 | Herramientas | 507 | 316763 | 4 (btID 799-802) |
| 7 | Procesos operativos I: Admisión | 766 | 316764 | 3 (btID 803-805) |
| 8 | Procesos operativos II: Tratamiento y Transporte | 533 | 316765 | 3 (btID 806-808) |
| 9 | Procesos operativos III: Distribución y Entrega | 794 | 316766 | 3 (btID 809-811) |
| 10 | El cliente | 584 | 316767 | 2 (btID 812-813) |
| 11 | Internacionalización y Aduanas | 150 | 316768 | 0 |
| 12 | Normas de cumplimiento | 961 | 316769 | 4 (btID 814-817) |

### Otros endpoints verificados

| Endpoint | Método | Resultado |
|----------|--------|-----------|
| `/api/v1/oposicionesotras` | GET | ✅ 34 oposiciones disponibles |
| `/api/v1/esquemas` | GET | ✅ 12 esquemas (articulado) |
| `/api/v2/configurartest` | POST | ✅ Config slider (10/20/50/100 preguntas) |
| `/api/v1/preguntastest` | POST | ✅ Preguntas con respuestas correctas |
| `/api/v2/tests/{type}/oposicion/{id}/bloque/{id}/tipo/{tipo}` | GET | ✅ Lista de temas |
| `/api/v4/tests/show/detalles-tests-usuario/{user}/{opo}/{bloque}` | GET | ✅ Detalles tests |
| `/api/v1/iniciobloque/usuario/{u}/invitado/{i}/bloque/{b}/oposicion/{o}/tipo/{t}` | GET | ✅ Iniciar bloque |

---

## 9. Hallazgos de seguridad

### Respuesta correcta sin protección
A diferencia de OpositaTest (que oculta `correctAnswerId` hasta que el usuario responde), InnoTest devuelve `"correcta": 1` directamente en la respuesta de `preguntastest`. No hay protección anti-scraping.

### Login sin Firebase Auth real
El login de la app (`POST /base/login`) usa un `secret` de OAuth client fijo (hardcodeado en la app) + email. No requiere Firebase ID Token — el `metodo_login: 1` (Google) se acepta sin verificar el token de Google. Se puede hacer login directamente vía API sin Firebase.

### Token se invalida en cada login
Cada `POST /base/login` genera un token nuevo e invalida el anterior. No se pueden reutilizar tokens guardados — hay que hacer login fresco antes de cada sesión de scraping.

### Servidores separados web/app
`server.innotest.app` (web) y `server2.innotest.app` (apps) tienen bases de datos de tokens separadas. Un token de uno no funciona en el otro.

### `secret` de OAuth expuesto en logs
El `secret` del cliente OAuth (`lkkjlW0lMexBHItdFuQSnnKnEhPuT1dtapHWK2ir`) se envía en texto plano en el body del login y es visible en `adb logcat`.

### IDs parametrizados en URL
Todos los IDs van en la URL (no en body ni headers), lo que facilita la enumeración.

### Endpoint `api_host` público
`GET /api-apps-nuevas/Api/public/api_host` devuelve la configuración de servidores sin autenticación.

---

## 10. Próximos pasos

### Para scraping completo de Correos (suscripción activa hasta 2026-05-17)

1. **Obtener lista de temas** — `GET /api/v2/tests/{type}/oposicion/5/bloque/2/tipo/1` → testID y bloque_testID de cada tema
2. **Para cada tema** — `POST /api/v1/preguntastest` con `limite: 100` → máximo de preguntas por tema
3. **Repetir con diferentes bloques** — bloqueID 2 (Conocimientos), 4 (Psicotécnicos), 5 (Ex. Oficiales)
4. **Deduplicar** por `pregunta.id` (pueden repetirse entre tests)
5. **Hacer login fresco** antes de cada batch (token se invalida)

### Acceso cross-oposición: NO

La suscripción es **por oposición**. Con la cuenta de Correos (opoID 5) no se puede acceder a temas de otras oposiciones — el servidor devuelve error 500 interno. Cada oposición requiere:
1. Instalar la app correspondiente en el móvil
2. Registrarse / comprar suscripción
3. Capturar `secret`, `identificador`, `keyentry` y `devicecharID` con `adb logcat`

### Credenciales por app (capturadas)

| App | identificador | oposicionID | secret | keyentry |
|-----|---------------|-------------|--------|----------|
| Correos | `android_co` | 5 | `lkkjlW0lMexBHItdFuQSnnKnEhPuT1dtapHWK2ir` | 1699 |
| Policía Nacional | `android_pn` (probable) | 2 | `lkkjlW0lMexBHItdFuQSnnKnEhPuT1dtapHWK2ir` (probable, mismo secret) | 1725 |
| Guardia Civil | ? | 16 | ? | ? |
| Aux Admin Estado | ? | ? | ? | ? |

### Catálogo de oposiciones en InnoTest (34 disponibles)

| ID | Oposición |
|----|-----------|
| 2541 | Administrativo de las Corporaciones Locales |
| 2523 | Agente de Hacienda Pública |
| 2542 | **Auxiliar Administrativo de Ayuntamiento/Estado** |
| 2518 | Auxiliar de Justicia |
| 2516 | Ayudante de Instituciones Penitenciarias |
| 2519 | Cuerpo de Auxilio Judicial |
| 2520 | Cuerpo de Tramitación Procesal y Administrativa |
| 2524 | Gestión Administración Civil del Estado |
| 2521 | Gestión Procesal y Administrativa |
| 2522 | Técnico Auxiliar de Informática Administración del Estado |
| 2525 | Técnicos de Hacienda |
| ... | (34 en total, incluye sanidad, educación, policía, bomberos) |

### Contenido total disponible (Correos, oposición 5)

| Tipo | Cantidad | Endpoint |
|------|----------|----------|
| **Preguntas Conocimientos** | **8,708** (12 temas) | `POST /api/v1/preguntastest` |
| **Preguntas Psicotécnicos** | **5,043** (4 categorías) | `POST /api/v1/preguntastest` (bloqueID=4) |
| **Test específicos** | **220** (11 tests) | `POST /api/v1/preguntastest` |
| **Recursos/PDFs** | **60** (manuales, leyes, fichas) | `GET /api/v1/recursos/5` |
| **Esquemas (articulado)** | **12** (Constitución completa) | `GET /api/v1/esquemas` |
| **TOTAL PREGUNTAS** | **13,971** | |

#### Psicotécnicos (5,043 preguntas)

| Categoría | Preguntas | testID |
|-----------|-----------|--------|
| Aptitudes verbales | 1,883 | 316237 |
| Aptitudes numéricas | 803 | 316238 |
| Aptitudes administrativas | 716 | 316239 |
| Razonamiento | 1,641 | 316240 |

#### Recursos/PDFs destacados

- Leyes completas: Constitución, Ley 39/2015, LOPD, Ley Igualdad, PRL, Ley Postal...
- Fichas de productos: Western Union, Citypaq, Paq Ligero, Carta Ordinaria...
- Protocolos operativos: admisión, PDA, distribución...
- Convenio colectivo de Correos

Las URLs de descarga son relativas a `server.innotest.app/recursos/` o `web.innotest.app/recursos/`.

### Ventajas vs OpositaTest
- **Respuesta correcta visible** — no hay anti-scraping, `correcta: 1` directo
- **Feedback/explicación incluido** — HTML con citas legales
- **Artículo de referencia** — texto completo del artículo vinculado
- **Login replicable** — funciona desde cualquier PC sin proxy ni emulador
- **Endpoints en español** — fácil de entender
- **Sin Cloudflare/Varnish** en server2 — peticiones directas al Apache
- **Recursos descargables** — PDFs de leyes y manuales
- **Psicotécnicos incluidos** — 5,043 preguntas adicionales

---

## 11. Aprendizajes del scraping (Abril 2026)

### Resultado del scraping de Correos

| Contenido | Descargado | Disponible | Cobertura |
|-----------|------------|------------|-----------|
| Conocimientos | 8,567 | 8,708 | 98.4% |
| Psicotécnicos | 5,042 | 5,043 | 99.98% |
| Esquemas (articulado) | 170 artículos | 170 | 100% |
| Imágenes | 1,145 | 1,145 | 100% |
| Recursos/PDFs | catálogo (60) | 60 | 0% (404) |
| **TOTAL** | **13,609** | **13,751** | **98.9%** |

Script: `scripts/scrape-innotest-correos.cjs`
Output: `preguntas-para-subir/innotest-correos/`

### Lecciones aprendidas

#### 1. Token se invalida en cada login
Cada `POST /base/login` genera un token nuevo e invalida el anterior. No se pueden guardar tokens para reutilizar. El script debe hacer **login → peticiones → login → peticiones** en la misma ejecución.

#### 2. Header `deviceID` obligatorio
Todos los endpoints (excepto login) requieren el header `deviceID: {valor}`. Sin él devuelve `{"error": "No se ha recibido el deviceID"}`. Esto no se descubrió en el análisis estático del APK — solo se vio al interceptar tráfico real con `adb logcat`.

#### 3. Temas sin sub-bloques: body diferente
Los temas que tienen `bloqueTemas: []` (vacío) necesitan un body diferente en `preguntastest`:
- **Con sub-bloques:** `bloque_tema: [{bloque_testID: btID, testID: testID}]` + `testID: [0]`
- **Sin sub-bloques:** omitir `bloque_tema` y poner `testID: [testID]`

Si se pone `bloque_testID: 0`, la API devuelve un error envuelto en 200.

#### 4. Pedir por sub-bloque maximiza cobertura
El endpoint `preguntastest` aleatoriza las preguntas. Pidiendo el mismo tema/bloque varias veces, se obtienen preguntas diferentes. Pero al pedir el pool general, se satura ~500 preguntas. Pidiendo **por sub-bloque individualmente** se accede a particiones diferentes del pool, aumentando la cobertura del 62% al 100% (caso Aptitudes Numéricas: 3 sub-bloques × 500 = cubrió las 803 disponibles).

#### 5. `limite=500` es el máximo práctico
La API acepta `limite: 500` sin problemas. Con `limite: 100` se necesitan muchos más batches y re-logins. Usar 500 minimiza el número de peticiones.

#### 6. Servidor web ≠ servidor app
`server.innotest.app` (web, Apache/Ubuntu, Varnish cache) y `server2.innotest.app` (apps, Apache/Debian, directo) son servidores diferentes:
- Tokens de uno NO funcionan en el otro
- El login da token válido solo en `server2`
- Las imágenes se descargan sin auth desde `server.innotest.app/recursos/imagenes/`
- Los PDFs dan 404 desde ambos (probablemente requieren auth de sesión de la app)

#### 7. Imágenes accesibles sin auth
Las imágenes de preguntas están en `https://server.innotest.app/recursos/imagenes/{path}` y son accesibles **sin autenticación**. El path viene en el campo `image` de cada pregunta (ej: `conocimientos/final/82706/pregunta.png`). Nombrar el archivo como `{questionId}_{basename}` para vincular fácilmente.

#### 8. `adb logcat` es la mejor herramienta
Para apps nativas Android con certificate pinning o auth compleja:
1. HTTP Toolkit / mitmproxy **no funcionan** (SYSTEM TRUST DISABLED)
2. Emulador ARM en host x86 **no funciona** (QEMU2 no soporta ARM64)
3. `adb logcat` captura TODO el tráfico OkHttp (requests, responses, bodies, headers) sin necesidad de proxy ni certificados

Flujo recomendado:
```bash
# 1. Conectar móvil por USB con depuración USB activada
adb devices

# 2. Limpiar logs
adb logcat -c

# 3. Usar la app en el móvil

# 4. Capturar tráfico
adb logcat -d | grep 'okhttp.OkHttpClient'
```

#### 9. Samsung Galaxy: desactivar Auto Blocker
En Samsung, la depuración USB está bloqueada por **Auto Blocker** (Ajustes → Seguridad → Bloqueador automático). Hay que desactivarlo antes de poder activar depuración USB.

#### 10. Fedora: reglas udev para ADB
En Fedora, `adb` no detecta el dispositivo sin reglas udev:
```bash
sudo sh -c 'echo "SUBSYSTEM==\"usb\", ATTR{idVendor}==\"04e8\", MODE=\"0666\", GROUP=\"plugdev\"" > /etc/udev/rules.d/51-android.rules && udevadm control --reload-rules && udevadm trigger'
# Luego desconectar y reconectar el cable USB
# Y reiniciar adb: adb kill-server && adb start-server
```

#### 11. El `secret` de OAuth es fijo por app
El campo `secret` del login (`lkkjlW0lMexBHItdFuQSnnKnEhPuT1dtapHWK2ir`) es el client secret de Laravel Passport. Es fijo para todas las instancias de la misma app. Se captura una vez con `adb logcat` y se reutiliza siempre.

#### 12. Preguntas duplicadas entre batches
Al pedir preguntas múltiples veces, la API aleatoriza el orden pero puede devolver preguntas repetidas. Usar un `Map` por `question.id` para deduplicar. Condición de parada: 2 batches consecutivos con 0 preguntas nuevas, o cobertura ≥ 95%.

### Archivos generados

```
preguntas-para-subir/innotest-correos/
├── conocimientos/
│   ├── _temas.json                              # Estructura de temas
│   ├── tema1_correos-marco-normativo-y-organizacion.json   # 783q
│   ├── tema2_experiencia-de-personas-en-correos.json       # 364q
│   ├── tema3_productos-y-servicios-i.json                  # 2008q
│   ├── tema4_productos-y-servicios-ii.json                 # 1023q
│   ├── tema5_nuevas-lineas-de-negocio.json                 # 122q
│   ├── tema6_herramientas.json                             # 500q
│   ├── tema7_procesos-operativos-i-admision.json           # 759q
│   ├── tema8_procesos-operativos-ii-tratamiento-y-transporte.json  # 530q
│   ├── tema9_procesos-operativos-iii-distribucion-y-entrega.json   # 793q
│   ├── tema10_el-cliente.json                              # 582q
│   ├── tema11_internacionalizacion-y-aduanas.json          # 147q
│   └── tema12_normas-de-cumplimiento.json                  # 956q
├── psicotecnicos/
│   ├── _temas.json
│   ├── tema1_aptitudes-verbales.json           # 1883q
│   ├── tema2_aptitudes-numericas.json          # 803q
│   ├── tema3_aptitudes-administrativas.json    # 716q
│   └── tema4_razonamiento.json                 # 1640q
├── esquemas/
│   └── esquemas_completos.json                 # 170 artículos Constitución
├── imagenes/
│   └── {questionId}_pregunta.png               # 1,145 imágenes
└── recursos/
    └── _catalogo.json                          # Catálogo de 60 PDFs (no descargados)
```
