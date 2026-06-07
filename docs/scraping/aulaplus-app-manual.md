# Manual de Scraping — Aula Plus (App Android)

> **Fecha:** 16 Abril 2026
> **Estado:** ✅ API **completamente mapeada** + scrape COMPLETO (139.106 preguntas en `preguntas-para-subir/aula-plus/raw/`, 464 páginas).
> **App objetivo:** `com.aulaplus` — https://play.google.com/store/apps/details?id=com.aulaplus
> **Backend real:** `https://app.aulaplusformacion.es/api` (API Platform + Symfony, JWT auth)

> **📦 Importación a BD (verificado 2026-06-03): ✅ PARCIAL.**
> - **Sanitaria / TCAE:** importada (verificación clínica FASE 2, ~17.546 preguntas re-vinculadas; `docs/roadmap/fase2-verificacion-preguntas-alteradas.md`).
> - **Rama AUXILIAR ADMINISTRATIVO (branch id 6, 11.281 preg.): ❌ NO importada** (0/8 de la muestra en BD). Es el material para **SMS** (origin 18 Región de Murcia → 555 preg.) y **CLM** (origin 12 Castilla-La Mancha → 981 preg.). Solo ~1% trae explicación → al importar hay que vincular artículo + redactar explicación con agentes (pipeline `docs/maintenance/importar-preguntas-scrapeadas.md`).
> - Tabla de estado completa por proveedor en `roadmap-proveedores-preguntas-scraping.md`.

---

## 1. Resumen ejecutivo

Aula Plus es una app Android **React Native / Expo** (detectable por los schemes `exp+aulaplus` y `aulaplus` en el manifest, y la presencia de `libreactnative.so` + `libhermesvm.so` en las libs nativas).

**Backend descubierto:** Symfony 5.x + API Platform en `app.aulaplusformacion.es`. Auth JWT con `/api/login_check` (formato JSON `{email, password}`). **139,106 preguntas** en total, la mayoría de oposiciones sanitarias (enfermería, EIR, celador, matrona, aux enfermería) y una rama de auxiliar administrativo de sanidad.

### Las dos rutas intentadas

**❌ APPROACH 1: Emulador + mitmproxy (FALLÓ)** — §3 a §9

Intento clásico de MITM sobre emulador Android. La combinación de **Hermes (motor JS de React Native) + Houdini (traducción ARM→x86)** causa SIGILL en el hilo JavaScript al arrancar la app. Emulador ARM64 nativo ya no existe (Google lo retiró en emulator 31.x+).

Conclusión: **este camino no funciona** para apps React Native compiladas solo para ARM64 en emuladores x86. Sí serviría con móvil real, pero el usuario no quiso tocar su móvil.

**✅ APPROACH 2: Análisis estático del APK (ÉXITO)** — §12 a §13

Sin ejecutar nada, se extrae el bundle JavaScript del APK, se pasa por `strings` para sacar URLs y endpoints, y se prueba directamente con `curl` contra el backend. **Funciona perfecto** para apps Expo/RN porque:

1. El bundle JS contiene **todos los endpoints** hardcodeados como strings
2. La API REST es accesible desde cualquier cliente HTTP con el JWT correcto
3. No necesitas el dispositivo ni el emulador para nada

**Esta es la ruta que funcionó y la que debería usarse por defecto para cualquier app RN/Expo.**

### Resumen de hallazgos clave

**Backend:**
- **API Base:** `https://app.aulaplusformacion.es/api`
- **Auth:** `POST /api/login_check` con `{email, password}` → devuelve JWT RS256 (expira ~10 días)
- **Stack:** Symfony 5.x + API Platform + LexikJWTAuthenticationBundle + Doctrine ORM (PHP 7.4, nginx, Plesk)
- **Formato:** JSON-LD / Hydra (auto-docs en `/api/docs.jsonld`)

**Volumen:**
- **139,106 preguntas** en total
- **2,685 subjects** (temas específicos)
- **168 broadSubjects** (temas transversales)
- **18 branches** (ENFERMERÍA, AUX ADMIN, CELADOR, etc.) — 8 públicos, 10 privados
- **39 origins** (CCAA + organismos especiales)
- **8 examiners** (Ministerios, Servicios de Salud, etc.)

**Paginación / Rate:**
- 300 items/página máx → **464 páginas** para todo el dataset
- ~2.8s por página → **25-35 min** de scraping con delays
- No hay rate limiting detectado

**Recursos:**
- **Imágenes:** `https://app.aulaplusformacion.es/images/questions/{filename}` (mismo path para `questionImageName` y `feedbackImageName`)
- **1,060 preguntas con imagen** en el enunciado (0.8%)

**Organización (5 ejes ortogonales):**
- `subject` + `subject.branch` + `subject.broadSubject` (tema)
- `origin` (CCAA), `year`, `testType`, `testVersion` (convocatoria)

**Reconstrucción de oposición oficial:** `branch × origin × year × testType × testVersion`. Ejemplo: "ENFERMERÍA SERMAS Madrid 2023 Turno Libre Versión Única".

**Cobertura por branch (datos clave para Vence):**
- **ENFERMERÍA:** ~33K preguntas, 45% con explicación, todas las CCAA
- **AUX ADMIN:** ~22K preguntas, **solo 1% con explicación**, **SIN Madrid** (solo CLM/País Vasco)
- **EIR:** ~29K preguntas, 33% son simulacros AulaPlus (no oficiales)

**Vinculación con leyes/artículos:** **NO existe en metadata**. Hay que inferirla post-scraping desde `subject.name` + explicaciones (cuando existen) + IA para el resto.

**Fuga de seguridad detectada:** modo debug Symfony activado → paths internos del servidor + stack traces en respuestas de error.

**Para escribir el scraper: ir directamente a §12 y §13.** Las secciones 3-11 son referencia histórica de por qué la vía del emulador no funciona con apps RN.

---

## 2. Información de la app

| Campo | Valor |
|-------|-------|
| Package name | `com.aulaplus` |
| Main activity | `com.aulaplus/.MainActivity` |
| Schemes (deep link) | `aulaplus://`, `exp+aulaplus://` |
| Framework | React Native con Expo |
| JS engine | Hermes (libhermesvm.so, libhermestooling.so) |
| Tamaño (XAPK v13) | 42.8 MB |
| ABI disponibles | `arm64-v8a` únicamente (no hay x86_64) |
| Fuente APK | https://apkpure.com/es/aula-plus/com.aulaplus |

**El hecho de que solo se publique en arm64-v8a** es lo que obliga a usar traducción ARM en emuladores x86 — y lo que hace que Hermes crashee.

---

## 3. Pre-requisitos (Fedora 43)

### 3.1 Instalar mitmproxy

**No está en los repos de Fedora 43.** Usar pipx:

```bash
sudo dnf install -y pipx
pipx ensurepath
pipx install mitmproxy
```

Verificar:
```bash
mitmproxy --version   # >= 12.x
```

La primera ejecución genera los certificados en `~/.mitmproxy/`:
```bash
mitmdump &
sleep 2
kill %1
ls ~/.mitmproxy/
# mitmproxy-ca.pem, mitmproxy-ca-cert.pem, etc.
```

### 3.2 Instalar Android SDK (sin Android Studio)

No necesitas el IDE. Solo command-line tools + emulator:

```bash
sudo dnf install -y qemu-kvm libvirt-daemon-kvm qt5-qtbase qt5-qtsvg mesa-libGL

mkdir -p ~/Android/Sdk && cd ~/Android/Sdk
wget "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
unzip commandlinetools-linux-11076708_latest.zip
mkdir -p cmdline-tools/latest
mv cmdline-tools/bin cmdline-tools/lib cmdline-tools/NOTICE.txt cmdline-tools/source.properties cmdline-tools/latest/
rm commandlinetools-linux-11076708_latest.zip
```

Añadir al `~/.bashrc`:
```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
```

Instalar paquetes:
```bash
yes | sdkmanager --licenses > /dev/null
sdkmanager "platform-tools" "emulator" "platforms;android-30" \
           "system-images;android-30;google_apis;x86_64"
```

**IMPORTANTE:** usar `google_apis`, **NO** `google_apis_playstore` (las imágenes con Play Store no permiten `adb root`/`-writable-system`).

---

## 4. Setup del emulador

### 4.1 Crear AVD

```bash
avdmanager create avd -n aula_plus -k "system-images;android-30;google_apis;x86_64" -d "pixel_5"
```

### 4.2 Lanzar mitmweb + emulador

**Flags críticos en Fedora Wayland:**

- `QT_QPA_PLATFORM=xcb` — fuerza Qt a usar X11 via XWayland (Qt nativo de Wayland no funciona con el emulator)
- `-gpu host` — usa la GPU del host vía OpenGL (más estable que `swiftshader_indirect`)
- `-no-snapshot-load -no-snapshot-save` — arranque limpio cada vez
- **NO usar `-http-proxy`** — está roto, valida la conectividad desde el host y siempre falla

```bash
export QT_QPA_PLATFORM=xcb

# Terminal 1: mitmweb
mitmweb --listen-port 8080 --web-port 8081 --web-host 127.0.0.1 &

# Terminal 2: emulador
emulator -avd aula_plus \
  -no-snapshot-load \
  -no-snapshot-save \
  -gpu host \
  -no-boot-anim &

# Esperar boot
adb wait-for-device
while [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" != "1" ]; do sleep 3; done
```

### 4.3 Configurar proxy

Vía `adb shell settings`, no vía flag del emulator:

```bash
adb shell settings put global http_proxy 10.0.2.2:8080
adb shell settings get global http_proxy  # verifica: 10.0.2.2:8080
```

`10.0.2.2` es el alias especial del emulador hacia el host (tu Fedora).

**Aviso:** el setting se resetea a `null` a veces tras reboots o AVD reset. Reaplicar siempre después de relanzar emulador.

### 4.4 Instalar cert de mitmproxy como USER cert

**NO intentes system cert.** Es tentador (muchos manuales lo recomiendan) pero en la práctica, con esta imagen de Android 11:

- `adb disable-verity` + `adb reboot` **corrompe el AVD** frecuentemente (queda en estado `offline` y no arranca)
- `mount -t tmpfs` sobre `/system/etc/security/cacerts` **NO propaga** a otros mount namespaces → Chrome y otras apps no ven el cert
- `/apex/com.android.conscrypt/cacerts/` no existe en esta imagen

**Método que SÍ funciona:** user cert via UI de Settings.

```bash
# Push cert al sdcard (nombre .crt para que Android lo reconozca como CA)
cp ~/.mitmproxy/mitmproxy-ca-cert.pem /tmp/mitmproxy.crt
adb push /tmp/mitmproxy.crt /sdcard/mitmproxy.crt
```

En el emulador:
1. **Settings → Security → Encryption & credentials → Install a certificate → CA certificate**
2. Aviso rojo "Your data won't be private" → **Install anyway**
3. Configurar PIN si no hay (Android lo exige antes de instalar CAs)
4. Picker de archivos → tapar menú hamburguesa (≡) → seleccionar `sdk_gphone_x86_64` → tocar `mitmproxy.crt`
5. Confirmación: "CA certificate installed"

### 4.5 Verificar TLS interception

En Chrome del emulador, navegar a cualquier sitio HTTPS (ej. `https://sede.dgt.gob.es/es/multas/`).

En mitmweb (`http://127.0.0.1:8081` en tu Fedora), debe aparecer el flujo **con `https://` en el Path** y headers/body descifrados.

**Si solo ves HTTP (`generate_204`, gstatic)** y **NO** HTTPS:
- Chrome puede estar usando QUIC (HTTP/3 sobre UDP) que bypassa el proxy
- Workaround: `chrome://flags` → "Experimental QUIC protocol" → Disabled → Relaunch

Para apps normales (no Chrome) esto NO es un problema — React Native / OkHttp no usan QUIC.

---

## 5. Instalación de Aula Plus

### 5.1 Descargar XAPK

Desde **tu Fedora** (no desde el emulador), ir a https://apkpure.com/es/aula-plus/com.aulaplus y descargar la última versión (XAPK).

Formato XAPK = ZIP con:
- `com.aulaplus.apk` — base APK (19 MB)
- `config.arm64_v8a.apk` — native libs ARM64 (22 MB)
- `config.{xx}.apk` — splits de idioma (ar, de, en, es, fr, hi, in, it, ja, ko, my, pt, ru, th, tr, vi, zh)
- `config.xhdpi.apk` — recursos de densidad
- `icon.png`, `manifest.json`

### 5.2 Extraer e instalar

```bash
EXTRACT=/tmp/aulaplus-extract
rm -rf "$EXTRACT"
mkdir -p "$EXTRACT"
unzip -q ~/Descargas/Aulaplus_*.xapk -d "$EXTRACT"

# Primer intento (NO funciona bien con apps arm64-only en emulador x86)
adb install-multiple -r "$EXTRACT"/*.apk
```

**Problema conocido:** `install-multiple` con un emulador x86_64 y APK que solo tiene libs arm64 instala bien los APKs pero **no extrae las libs nativas** a `/data/app/.../lib/arm64/`. Resultado: al abrir la app, crash con `SoLoaderDSONotFoundError: couldn't find DSO to load: libreactnative.so`.

### 5.3 Forzar extracción manual de libs ARM64

Incluso con `pm install-create --abi arm64-v8a`, a veces no extrae. Solución: extraer las .so del split_config.arm64_v8a.apk y pushearlas manualmente al directorio `lib/arm64/` de la app.

```bash
# Extraer libs
mkdir -p /tmp/arm64libs && cd /tmp/arm64libs
unzip -q "$EXTRACT"/config.arm64_v8a.apk 'lib/arm64-v8a/*'

# Obtener ruta exacta de la app (tiene hashes aleatorios)
APP_PATH=$(adb shell pm path com.aulaplus | head -1 | sed 's/package://' | xargs dirname)
# Ejemplo: /data/app/~~5dooj4GRHec0xBIh3RwACA==/com.aulaplus-FHwTS_vZxv8H4nqx1o5AxA==

LIB_DIR="${APP_PATH}/lib/arm64"

adb root
adb shell "mkdir -p \"${LIB_DIR}\""
adb push lib/arm64-v8a/. "${LIB_DIR}/"
adb shell "chmod 755 \"${LIB_DIR}\""
adb shell "chmod 644 \"${LIB_DIR}\"/*.so"
adb shell "chown root:root \"${LIB_DIR}\" \"${LIB_DIR}\"/*.so"

# Verificar
adb shell "ls \"${LIB_DIR}\" | wc -l"  # debe devolver 24
```

Tras esto, `libreactnative.so` está en su sitio. La app ya no crashea por lib missing. Pero…

---

## 6. EL BLOQUEADOR: Hermes + ARM translation → SIGILL

Tras instalar todas las libs correctamente, la app:
1. Muestra splash screen brevemente
2. Se cierra sin diálogo de error

Logcat muestra:

```
F libc    : Fatal signal 4 (SIGILL), code -6 (SI_TKILL) in tid 8663 (mqt_v_js), pid 8623 (com.aulaplus)
F DEBUG   : pid: 8623, tid: 8663, name: mqt_v_js  >>> com.aulaplus <<<
W ActivityTaskManager: Force finishing activity com.aulaplus/.MainActivity
I ActivityManager: Process com.aulaplus (pid 8623) has died
```

**Qué significa:**

- `mqt_v_js` es el hilo JavaScript de React Native
- `SIGILL` = instrucción ilegal de CPU
- **Hermes** (JS engine de RN) emite código nativo ARM para el intérprete JS
- La capa **Houdini** (traducción ARM→x86 del emulador Android) **no soporta todas** las instrucciones que usa Hermes
- Al ejecutar ciertas instrucciones, el emulador aborta con SIGILL

**No hay workaround conocido** para este caso específico. Es una limitación fundamental de la traducción binaria en Houdini con Hermes.

### 6.1 Cosas que NO resuelven el problema

- Usar `-gpu swiftshader_indirect` (el crash es en CPU, no GPU)
- Actualizar emulator a la última versión
- Imagen Android 12 (API 31) o 13 (API 33) — mismo problema, Houdini no se ha mejorado
- Cambiar a Hermes en modo "no-JIT" — no se puede, la app viene precompilada
- Frida bypass — no aplica, no es pinning

### 6.2 Confirmación de que es esto

- `adb shell getprop ro.product.cpu.abilist` → `x86_64,x86,arm64-v8a,armeabi-v7a,armeabi` ✅ traducción activa
- Chrome (app sin Hermes) funciona perfecto
- Apps Java nativas de Android funcionan
- Solo las apps React Native + Hermes arm64-only crashean así

---

## 7. Rutas alternativas al emulador

### 7.1 Dispositivo Android real (RECOMENDADO)

Setup ~5 minutos si tienes móvil:

1. En el móvil: **Settings → Wi-Fi → red actual (long press) → Modify → Advanced → Proxy → Manual**
   - Host: IP local de tu PC (ej. `192.168.1.100`)
   - Port: `8080`
2. En tu PC: `mitmweb --listen-port 8080 --listen-host 0.0.0.0` (escucha en todas las interfaces, no solo 127.0.0.1)
3. En el móvil, navegar a `http://mitm.it` → descargar y instalar cert (Android ≤13) o seguir instrucciones
4. Instalar Aula Plus desde Play Store
5. Abrir y usar → mitmweb captura el tráfico

**Ventajas:**
- Funciona 100%, sin problemas de ABI/traducción
- Setup trivial
- La app se comporta exactamente como para un usuario real

**Desventajas:**
- Hace falta un móvil tuyo
- El tráfico pasa por tu red local (comprueba que el PC tiene puerto 8080 abierto en firewall local)

### 7.2 Emulador ARM64 nativo — ❌ YA NO FUNCIONA (abril 2026)

**Google eliminó el soporte de imágenes ARM64 en hosts x86_64** a partir de emulator 31.x+.

Con emulator 36.5.10 (el que viene actualmente con el SDK), lanzar un AVD con imagen `system-images;android-30;google_apis;arm64-v8a` en un host x86_64 da:

```
FATAL | Avd's CPU Architecture 'arm64' is not supported by the QEMU2 emulator on x86_64 host.
        System image must match the host architecture.
```

**Esta ruta ya no es viable.** Para emular ARM solo queda:

- **Instalar un emulator antiguo** (30.1.x o anterior) manualmente → no recomendado, roto con SDK actual y sin actualizaciones de seguridad
- **Genymotion** (comercial, free tier) — tiene su propio hipervisor y a veces soporta ARM apps
- **Descartar emulador** y usar dispositivo real (§7.1) o web (§7.3)

**Si apareciera un bug fix o workaround futuro**, actualizar esta sección.

### 7.3 Versión web de Aula Plus

**Comprobar primero:** https://aulaplus.es o https://www.aulaplus.es

Si tienen panel web con login y tests, scrapear la web con el mismo approach que OpositaTest (F12 → Network → capturar API) es **muchísimo más simple** que pelear con la app Android.

---

## 7.bis Gotchas prácticos (tropiezos operativos que nos pasaron)

Estos son los problemas no-técnicos (de UX, parsing, quoting) que nos costaron tiempo en esta sesión. **Léelos antes de empezar** para no repetirlos.

### 7.bis.1 Terminal corta URLs al pegarlas

Al pegar comandos largos con URLs de Google (`https://dl.google.com/...`) en la terminal, el terminal **introduce saltos de línea en medio de la URL** cuando llega al ancho de la ventana. Resultado: `wget` recibe una URL truncada + bash interpreta el resto como un comando nuevo.

**Síntoma típico:**
```
HTTP ERROR response 404  [https://dl.google.com/android/repository/commandlineto
bash: ols-linux-11076708_latest.zip: instrucción no encontrada
```

**Fix:** Meter los comandos largos en un **script** (`bash /tmp/xxx.sh`) o usar una variable:
```bash
URL='https://dl.google.com/.../file.zip'
wget "$URL"
```

**Regla general:** cualquier URL + comando que pase de 80 chars, mejor por script.

### 7.bis.2 Paths de Android con `~~` y `==` rompen el paste

Los paths de Android 11+ incluyen caracteres como `~~xxx==` y `com.aulaplus-xxx==`. Al pegarlos en la terminal:

- bash los puede cortar por el `~~` o por espacios que introduce el terminal-wrap
- el path largo se divide en "comando + argumentos aleatorios"
- `ls /data/app/...` termina listando `/` y el path como comando separado

**Fix:** usar `pm path com.paquete` para obtener el path y guardarlo en variable:

```bash
APP_PATH=$(adb shell pm path com.aulaplus | head -1 | sed 's/package://' | xargs dirname | tr -d '\r')
# Ahora $APP_PATH es usable sin problemas
adb shell "ls \"${APP_PATH}\""   # comillas dobles obligatorias
```

### 7.bis.3 `pm install-create` devuelve ID entre corchetes

El output es `Success: created install session [1041855541]`. Si parseas con `grep -oE '[0-9]+$'` **no captura nada** (el número no está al final, hay un `]` después).

**Regex correcto:**
```bash
SESSION=$(adb shell pm install-create --abi arm64-v8a -r 2>&1 | sed -n 's/.*\[\([0-9]*\)\].*/\1/p')
```

### 7.bis.4 `/sdcard/Download/` da "Operation not permitted"

En Android 10+ con scoped storage, `adb push /tmp/file /sdcard/Download/file` falla con `Operation not permitted` aunque Download/ exista. `adb push /tmp/file /sdcard/file` (raíz de sdcard) **sí funciona**.

**Fix:** pushear a `/sdcard/` directamente. El picker de Settings encuentra los archivos ahí igual (aparece bajo "sdk_gphone_x86_64").

### 7.bis.5 El setting `http_proxy` se resetea a `null`

Entre reboots, recreaciones de AVD, o sin razón aparente, `settings get global http_proxy` devuelve `null` después de haberlo puesto.

**Síntoma:** el proxy deja de capturar tráfico y no sabes por qué.

**Fix:** verificar SIEMPRE después de cualquier reboot o reset:
```bash
adb shell settings get global http_proxy
# Si no sale "10.0.2.2:8080", reaplicar:
adb shell settings put global http_proxy 10.0.2.2:8080
```

### 7.bis.6 `adb devices` atascado en `offline` = AVD corrupto

Tras ciertas operaciones (especialmente `adb disable-verity` + `adb reboot`), el emulador queda en estado:

```
emulator-5554    offline
```

indefinidamente. Intentar `adb kill-server && adb start-server` **no lo arregla**. El emulador ha quedado corrupto.

**Síntoma confirmatorio:** el proceso `qemu-system-x86_64` sigue vivo pero la ventana se congela (gris o pantalla vieja).

**Único fix fiable:**
1. `pkill -9 -f qemu-system-x86_64`
2. `rm -rf /run/user/1000/avd/running/*`
3. `avdmanager delete avd -n aula_plus`
4. Recrear AVD desde cero
5. Relanzar emulador

**Para evitarlo de raíz:** NO usar `-writable-system` si no vas a instalar system cert. Trabajar con user cert siempre que sea posible (§4.4).

### 7.bis.7 Chrome cachea certs al arrancar

Si instalas el cert de mitmproxy **después** de que Chrome esté abierto/cargado, Chrome sigue usando el trust store viejo y da `ERR_CERT_AUTHORITY_INVALID`.

**Fix:**
```bash
adb shell am force-stop com.android.chrome
adb shell am force-stop com.google.android.webview
```

Después reabrir Chrome desde cero.

### 7.bis.8 QUIC hace que mitmweb parezca que no captura nada

Chrome por defecto usa **HTTP/3 (QUIC sobre UDP)** para muchos sitios. QUIC **bypassa el proxy HTTP** completamente. Resultado: Chrome carga HTTPS con padlock verde (trust real, no mitm) y mitmweb no ve esas peticiones.

**Confusión típica:**
- Visitas `https://github.com`, carga con candado
- mitmweb solo muestra `http://gstatic.com/generate_204` y poco más
- Parece que TLS interception no funciona — pero SÍ funciona para apps normales

**Fix (solo para diagnosticar con Chrome):**
- `chrome://flags` → "Experimental QUIC protocol" → Disabled → Relaunch

**Apps normales (React Native, OkHttp, retrofit, etc.) NO usan QUIC.** Son TCP y sí pasan por el proxy sin este workaround.

### 7.bis.9 `Aulaplus keeps stopping` puede ser 2 bugs distintos

El mismo popup genérico engloba:

1. **Lib missing** (`libreactnative.so` no se extrajo) → logcat muestra `SoLoaderDSONotFoundError`. Arreglable (§5.3).
2. **SIGILL en Hermes** (traducción ARM falla) → logcat muestra `Fatal signal 4 (SIGILL)` en thread `mqt_v_js`. **No arreglable** en emulador x86_64.

**Diagnóstico obligatorio:**
```bash
adb logcat -c                     # limpiar buffer
# ahora abrir la app y que crashee
adb logcat -d | grep -iE "fatal|soloader|sigill|mqt_v_js" | tail -30
```

### 7.bis.10 Primer boot del emulador tarda 2-3 min, posteriores <1 min

Es normal. No matar por impaciencia. El script debe esperar con loop:

```bash
for i in $(seq 1 60); do
  [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1" ] && break
  sleep 3
done
```

Si tras 3 minutos sigue gris Y el proceso `qemu-system-x86_64` vive → probablemente AVD corrupto, aplicar §7.bis.6.

Si el proceso ya no existe → murió silenciosamente, revisar `tail -50 /tmp/emulator.log`.

---

## 8. Lecciones aprendidas (aplicables a futuras apps Android)

### 8.1 Flags del emulator que valen la pena

| Flag | Para qué |
|------|----------|
| `QT_QPA_PLATFORM=xcb` (env) | Forzar XWayland en Fedora/GNOME Wayland |
| `-gpu host` | Usar GPU real del host, más estable |
| `-no-snapshot-load -no-snapshot-save` | Arranque limpio, evitar estados zombie |
| `-no-boot-anim` | Ahorra tiempo de boot |

### 8.2 Flags que NO usar

| Flag | Por qué |
|------|---------|
| `-http-proxy http://10.0.2.2:8080` | Roto: valida conectividad desde host, siempre falla |
| `-writable-system` | Necesita `disable-verity` + reboot, que frecuentemente rompe el AVD |
| `-gpu swiftshader_indirect` | Más lento y con bugs de rendering |

### 8.3 Certificado CA: evitar el camino del sistema

El approach "instalar como system cert en `/system/etc/security/cacerts/`" es:

1. Frágil (requiere `disable-verity` + reboot que rompe AVDs)
2. No propaga bien (namespaces distintos no ven tmpfs mounts)
3. Innecesario si la app acepta user certs (la mayoría de apps RN/Expo sí)

**Default: user cert via Settings UI.** Solo bajar a system cert si la app explícitamente rechaza user certs (network_security_config).

### 8.4 XAPK = ZIP

Un XAPK es solo un ZIP con split APKs. `unzip` lo extrae directamente.
`adb install-multiple *.apk` lo instala.

### 8.5 Split APKs arm64-only en emulador x86_64

**Síntoma:** `install-multiple` exit 0, app crashea al abrir con `SoLoaderDSONotFoundError`.

**Causa:** PackageManager elige x86_64 como ABI primaria (primero en abilist) pero no hay libs x86_64 → las libs arm64 del split no se extraen a `/data/app/.../lib/arm64/`.

**Fix:** extraer manualmente las .so del split y pushearlas con `adb push` + chmod + chown.

### 8.6 React Native + ARM emulator = ruleta

**Hermes (JS engine default en RN ≥ 0.70)** puede crashear con SIGILL en Houdini.
**JSC (JavaScriptCore, engine alternativo)** suele tener menos problemas pero si el dev compiló con Hermes no hay vuelta atrás.

**Detectar RN**: `exp+{package}` scheme (Expo) o `com.facebook.react.*` en logs.

**Detectar Hermes**: `libhermesvm.so` presente en las libs nativas del APK.

---

## 9. Scripts reutilizables

Los siguientes scripts se probaron en esta sesión y funcionaron (hasta el punto del bloqueador Hermes):

### 9.1 Setup completo

<details>
<summary>install-android-sdk.sh (ejecutar una vez)</summary>

```bash
#!/bin/bash
set -e
cd ~/Android/Sdk
wget -q --show-progress "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
unzip -q commandlinetools-linux-11076708_latest.zip
mkdir -p cmdline-tools/latest
mv cmdline-tools/bin cmdline-tools/latest/
mv cmdline-tools/lib cmdline-tools/latest/
mv cmdline-tools/NOTICE.txt cmdline-tools/latest/
mv cmdline-tools/source.properties cmdline-tools/latest/
rm commandlinetools-linux-11076708_latest.zip
```
</details>

<details>
<summary>create-avd.sh</summary>

```bash
#!/bin/bash
set -e
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator

# Limpiar previos
pkill -9 -f qemu-system-x86_64 2>/dev/null || true
adb kill-server 2>/dev/null || true
avdmanager delete avd -n aula_plus 2>/dev/null || true
rm -rf ~/.android/avd/aula_plus.avd ~/.android/avd/aula_plus.ini

echo "no" | avdmanager create avd -n aula_plus \
  -k "system-images;android-30;google_apis;x86_64" -d "pixel_5"
```
</details>

<details>
<summary>launch.sh (lanzar mitmweb + emulador + proxy + cert)</summary>

```bash
#!/bin/bash
set -e
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
export QT_QPA_PLATFORM=xcb

# mitmweb
if ! pgrep -f mitmweb > /dev/null; then
  nohup mitmweb --listen-port 8080 --web-port 8081 --web-host 127.0.0.1 > /tmp/mitmweb.log 2>&1 &
  sleep 2
fi

# Emulador
nohup emulator -avd aula_plus \
  -no-snapshot-load -no-snapshot-save \
  -gpu host -no-boot-anim \
  > /tmp/emulator.log 2>&1 &
sleep 10

# Esperar boot
adb start-server
adb wait-for-device
for i in $(seq 1 60); do
  [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1" ] && break
  sleep 3
done

# Proxy
adb shell settings put global http_proxy 10.0.2.2:8080

# Cert al sdcard (para instalar via UI)
cp ~/.mitmproxy/mitmproxy-ca-cert.pem /tmp/mitmproxy.crt
adb push /tmp/mitmproxy.crt /sdcard/mitmproxy.crt

echo "✅ Emulador listo. mitmweb en http://127.0.0.1:8081"
echo "   Abre Settings → Security → Install certificate → CA certificate"
echo "   Seleccionar /sdcard/mitmproxy.crt"
```
</details>

<details>
<summary>install-aulaplus.sh (NO FUNCIONA para ejecutar la app, pero instala los APKs)</summary>

```bash
#!/bin/bash
set -e
export PATH=$PATH:$HOME/Android/Sdk/platform-tools

XAPK=~/Descargas/Aulaplus_13.0.0_APKPure.xapk
EXTRACT=/tmp/aulaplus-extract

rm -rf "$EXTRACT" && mkdir -p "$EXTRACT"
unzip -q "$XAPK" -d "$EXTRACT"

adb install-multiple -r "$EXTRACT"/*.apk

# Fix manual de libs nativas arm64
adb root
mkdir -p /tmp/arm64libs && cd /tmp/arm64libs
unzip -qo "$EXTRACT"/config.arm64_v8a.apk 'lib/arm64-v8a/*'

APP_PATH=$(adb shell pm path com.aulaplus | head -1 | sed 's/package://' | xargs dirname | tr -d '\r')
LIB_DIR="${APP_PATH}/lib/arm64"
adb shell "mkdir -p \"${LIB_DIR}\""
adb push lib/arm64-v8a/. "${LIB_DIR}/"
adb shell "chmod 755 \"${LIB_DIR}\""
adb shell "chmod 644 \"${LIB_DIR}\"/*.so"
adb shell "chown root:root \"${LIB_DIR}\" \"${LIB_DIR}\"/*.so"

echo "✅ APK + libs instaladas."
echo "⚠️  La app crasheará con SIGILL al abrir (Hermes + ARM translation incompatible)"
echo "   Usar dispositivo Android real o emulador ARM64 nativo"
```
</details>

---

## 10. Próximos pasos

Si algún día se quiere scrapear Aula Plus, el roadmap es:

1. **Verificar si existe versión web** (`aulaplus.es`, panel de estudiante o similar)
   - Si sí → seguir el approach de `opositatest-api-manual.md` (mitmproxy vía navegador, capturar JWT, replicar endpoints)
   - Si no → paso 2

2. **Conectar móvil Android real con mitmproxy** (§7.1)
   - Setup rápido
   - La app funcionará sin los problemas de emulador

3. **Identificar dominio API**
   - Abrir la app, loguearse, hacer un test
   - En mitmweb filtrar por dominios no-Google
   - Probable: `api.aulaplus.es`, `aulaplus-api.com`, o similar
   - Verificar si usa JWT (Authorization: Bearer), session cookies, etc.

4. **Replicar en Node**
   - Mismo patrón que `scripts/opositatest-api-scraper.cjs`
   - Endpoints típicos: login, listar temas, obtener preguntas por tema, obtener explicaciones

5. **Guardar output en `preguntas-para-subir/aula-plus/`**
   - Estructura JSON estándar (ver `docs/maintenance/importar-preguntas-scrapeadas.md`)
   - Pasar por el pipeline de limpieza + duplicados + verificación con agentes

---

## 11. Estado de la sesión (16/04/2026)

**Approach 1 (emulador):** bloqueado por Hermes + ARM translation. Toda la infraestructura (mitmproxy, cert, proxy) quedó probada y funcionando para Chrome — inservible para la app.

**Approach 2 (análisis estático):** ✅ éxito completo. API mapeada, credentials probadas, endpoints documentados. Siguiente paso es escribir el scraper Node.

---

## 12. APPROACH 2: Análisis estático del APK (LA RUTA QUE FUNCIONÓ)

> **Aplicable a cualquier app Android Expo/React Native.**
> Para apps nativas (Java/Kotlin) es más complejo — requiere `jadx`/`apktool` y leer Smali.

### 12.1 Por qué funciona para Expo/React Native

En las apps RN, el código de la lógica de negocio está en **JavaScript empaquetado** como bundle Metro/Hermes. Ese bundle contiene:

- **URLs hardcodeadas** de la API
- **Paths de endpoints** (literalmente strings tipo `/api/login_check`)
- Error messages
- Configuración de Expo (API keys, project IDs, etc.)

El código nativo en la APK solo es el "shell" (React Native runtime, plugins nativos de Expo, etc.). La **inteligencia de la app está en el JS**. Y ese JS se puede **leer con `strings`** incluso si está compilado a Hermes bytecode — porque los strings constantes se guardan en la string table del bytecode en texto plano.

**Consecuencia práctica:** no hace falta ejecutar la app. Extraes el bundle, lo pasas por `strings`, y tienes un inventario completo de todos los endpoints.

### 12.2 Extraer el JS bundle del APK

El bundle vive en `assets/index.android.bundle` dentro del APK principal (la base, no los splits).

```bash
# Si aún tienes el XAPK extraído en /tmp/aulaplus-extract/
mkdir -p /tmp/aulaplus-analysis
cd /tmp/aulaplus-analysis
unzip -o -q /tmp/aulaplus-extract/com.aulaplus.apk \
  assets/index.android.bundle \
  assets/app.config \
  assets/app.manifest \
  assets/expo-root.pem

ls -lh assets/
# -rw-r--r-- 1 user user  961  app.config          ← Expo app config (nombre, scheme, iOS/Android bundleId, etc.)
# -rw-r--r-- 1 user user  18K  app.manifest        ← Expo manifest (permisos, plugins)
# -rw-r--r-- 1 user user 1.3K  expo-root.pem       ← Cert raíz de Expo para OTA updates
# -rw-r--r-- 1 user user 3.6M  index.android.bundle ← **EL PREMIO**: código JS
```

**`app.config` es ORO**:

```json
{
  "name": "Aulaplus",
  "slug": "Aulaplus",
  "version": "13.0.0",
  "scheme": "aulaplus",
  "ios": {"bundleIdentifier": "com.limenius.aulaplus"},  ← Empresa: Limenius
  "android": {"package": "com.aulaplus", "versionCode": 15},
  "web": {"bundler": "metro", "output": "static"},       ← Hay versión WEB compilada
  "platforms": ["ios", "android", "web"],
  "extra": {"eas": {"projectId": "49c1c946-75bd-433f-8784-99cd795c1273"}},
  "sdkVersion": "55.0.0"
}
```

Información útil derivada:
- **Desarrollador:** Limenius (conocida consultora Symfony española). Esto ya indica que el backend será Symfony/API Platform.
- **Multiplataforma:** hay build web, lo que casi garantiza una REST API (no apis RPC exclusivas de móvil)
- **Expo SDK 55:** moderno, usa Hermes por defecto

### 12.3 Identificar Hermes vs plain JS

```bash
file /tmp/aulaplus-analysis/assets/index.android.bundle
# → Hermes JavaScript bytecode, version 96
```

Dos casos:

**Caso A — Plain JS bundle (Metro, sin Hermes):**
- `file` devuelve `ASCII text` o `Unicode text`
- Ya es texto legible, puedes `grep` directamente

**Caso B — Hermes bytecode (lo habitual en RN ≥ 0.70):**
- `file` devuelve `Hermes JavaScript bytecode`
- Binario, pero los strings constantes siguen estando en texto plano en la string table
- Usar `strings` extrae todo lo útil

En nuestro caso (Aula Plus): **Hermes version 96** (corresponde a Hermes shipped with React Native 0.76+). Vamos a por `strings`.

### 12.4 Extraer strings del bytecode Hermes

```bash
cd /tmp/aulaplus-analysis/assets
strings -n 8 index.android.bundle > all-strings.txt
wc -l all-strings.txt   # → 910 líneas
```

El flag `-n 8` filtra a strings de al menos 8 caracteres (elimina basura). Ajustable: con `-n 5` sacas más ruido pero captas nombres cortos.

**Dato importante:** el bytecode concatena strings adyacentes. Es frecuente encontrar cosas tipo:

```
/api/user_answers/api/login_check
/api/users/api/origins
```

Lo que son en realidad DOS strings (`/api/user_answers` + `/api/login_check`) pegados en la extracción. Al analizar los resultados hay que **cortar por prefijos `/api/`** y separar manualmente cuando detectes concatenaciones.

### 12.5 Identificar URLs y endpoints

```bash
# URLs completas (protocolo + dominio)
grep -oE 'https?://[a-zA-Z0-9.-]+(\.[a-z]{2,}|:[0-9]+)[a-zA-Z0-9/_.-]*' all-strings.txt | sort -u

# Rutas /api/*
grep -oE '/api/[a-z_]+(/[a-z_]+)*' all-strings.txt | sort -u

# Strings con 'token' 'auth' 'login'
grep -iE "login|auth|token|jwt|bearer" all-strings.txt | head -20
```

En el bundle de Aula Plus encontramos:

**Dominios:**
- `https://app.aulaplusformacion.es` ← API (destino principal)
- `https://aulaplusformacion.es/mi-cuenta/lost-password` ← web para reset de password
- `https://aulaplusformacion.es/tienda` ← tienda (WooCommerce probablemente)
- `https://u.expo.dev/49c1c946-75bd-433f-8784-99cd795c1273` ← OTA updates de Expo
- `https://classic-assets.eascdn.net/~assets/` ← CDN de assets de Expo

**Endpoints `/api/*` encontrados en el bundle:**

```
/api/answers
/api/branches
/api/broad_subjects
/api/challenges
/api/challenge_questions
/api/courses
/api/course_contacts
/api/examiners
/api/legislation_branches
/api/login_check              ← LOGIN
/api/origins
/api/questions                ← PREGUNTAS (core)
/api/question_levels
/api/rehearsals               ← tests/simulacros
/api/subjects
/api/test_types
/api/test_versions
/api/users
/api/user_answers
/api/user_tests
```

Vistos separando los strings concatenados manualmente.

### 12.6 Descubrir el endpoint de login

El primer descubrimiento fue confuso: probando `/api/login_check` con POST vacío → **404**. Pero eso era porque estaba enviando body mal formado.

Proceso que seguimos:

**Paso 1 — Probar sin body:**
```bash
curl -s -X POST https://app.aulaplusformacion.es/api/login_check
# → 404
```

**Paso 2 — Probar con JSON `{"username":"x","password":"y"}`:**
```bash
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"username":"test","password":"wrong"}' \
  https://app.aulaplusformacion.es/api/login_check
# → {"code":400,"detail":"The key \"email\" must be provided."}
```

**Dato clave**: el error dice que espera `"email"`, no `"username"`. El patrón de error también filtró el path interno:

```
/var/www/vhosts/app.aulaplusformacion.es/app-backend/vendor/symfony/security-http/Firewall/UsernamePasswordJsonAuthenticationListener.php
```

Confirma:
- Stack **Symfony + API Platform**
- Hosting **Plesk** (por el path `/var/www/vhosts/`)
- Directorio del backend: `/app-backend`
- Auth listener: `UsernamePasswordJsonAuthenticationListener` (Symfony's JSON auth firewall)

**Paso 3 — Probar con `{email, password}`:**
```bash
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"email":"test@test.es","password":"wrong"}' \
  https://app.aulaplusformacion.es/api/login_check
# → {"code":401,"message":"Invalid credentials."}
```

Si devuelve 401 con "Invalid credentials", el endpoint funciona. Solo faltan credenciales correctas.

### 12.7 Login real y estructura del JWT

Con credenciales válidas:

```bash
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"email":"real@email.es","password":"real_pass"}' \
  https://app.aulaplusformacion.es/api/login_check
```

Respuesta:

```json
{
  "token": "eyJ0eXAi...RS256JWT...",
  "id": 17931
}
```

Decodificando el JWT (header y payload son base64 URL-safe, separados por `.`):

```json
// Header
{"typ":"JWT","alg":"RS256"}

// Payload
{
  "iat": 1776332557,            // issued at
  "exp": 1777196557,            // expires at (iat + 10 días aprox)
  "roles": ["ROLE_USER"],       // Symfony roles
  "email": "manueltrader@gmail.com"
}
```

**Uso del token:** todos los demás endpoints requieren `Authorization: Bearer <token>`.

**Expiración:** ~10 días. Para scraping largo → **re-login al detectar 401**.

### 12.8 Explorar la API con JSON-LD / Hydra

API Platform expone documentación auto-generada en `/api/docs.jsonld` (formato JSON-LD/Hydra) y `/api/docs.json` (OpenAPI 3).

**Ambos requieren JWT** (están detrás del firewall):

```bash
TOKEN=$(cat /tmp/aulaplus-jwt.txt)
curl -s -H "Authorization: Bearer $TOKEN" \
  https://app.aulaplusformacion.es/api/docs.jsonld
```

De ese docs se extrae el schema **completo de cada entidad**. Ejemplo para `Question`:

```jsonld
{
  "@id": "#Question",
  "@type": "hydra:Class",
  "hydra:supportedProperty": [
    {"hydra:property": {"rdfs:label": "text", "range": "xmls:string"}},
    {"hydra:property": {"rdfs:label": "subject", "range": "#Subject"}},
    {"hydra:property": {"rdfs:label": "answers", "range": "#Answer"}},
    {"hydra:property": {"rdfs:label": "questionFeedback", "range": "xmls:string"}},
    {"hydra:property": {"rdfs:label": "level", "range": "#QuestionLevel"}},
    {"hydra:property": {"rdfs:label": "testType", "range": "#TestType"}},
    {"hydra:property": {"rdfs:label": "testVersion", "range": "#TestVersion"}},
    {"hydra:property": {"rdfs:label": "examiner", "range": "#Examiner"}},
    {"hydra:property": {"rdfs:label": "numQuestion", "range": "xmls:integer"}},
    {"hydra:property": {"rdfs:label": "canceled", "range": "xmls:boolean"}},
    {"hydra:property": {"rdfs:label": "branch", "range": "#Branch"}},
    {"hydra:property": {"rdfs:label": "questionImageName", "range": "xmls:string"}},
    {"hydra:property": {"rdfs:label": "feedbackImageName", "range": "xmls:string"}},
    {"hydra:property": {"rdfs:label": "nombreImagenPregunta", "range": "xmls:string"}},
    {"hydra:property": {"rdfs:label": "legislationBranch", "range": "#LegislationBranch"}},
    {"hydra:property": {"rdfs:label": "isClinicalCase", "range": "xmls:boolean"}},
    {"hydra:property": {"rdfs:label": "isScales", "range": "xmls:boolean"}},
    {"hydra:property": {"rdfs:label": "origin", "range": "#Origin"}},
    {"hydra:property": {"rdfs:label": "estrategia", "range": "#Estrategia"}},
    {"hydra:property": {"rdfs:label": "year", "range": "xmls:string"}}
  ]
}
```

**Truco:** en la listing `GET /api/questions?page=1&itemsPerPage=300`, los objetos traen **todos los campos del schema** (no solo un subset). Por eso no hace falta hacer GET individual por ID — con la pagination recorres todo.

### 12.9 Descubrir pattern de URL de imágenes

Los strings del bundle **no revelaron directamente** el path de las imágenes (no hay hardcoded `/images/...` visible). Hay que probar manualmente.

Proceso: tomar un `imageName` real que veamos en una pregunta y probar rutas comunes:

```bash
BASE="https://app.aulaplusformacion.es"
for P in \
  "/uploads/questions/Maslow.png" \
  "/uploads/Maslow.png" \
  "/media/questions/Maslow.png" \
  "/images/questions/Maslow.png" \
  "/images/Maslow.png"
do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$BASE$P")
  echo "  $CODE $P"
done
```

Resultado:
```
  404 /uploads/questions/Maslow.png
  404 /uploads/Maslow.png
  404 /media/questions/Maslow.png
  200 /images/questions/Maslow.png      ← ENCONTRADO
  404 /images/Maslow.png
```

**Confirmación adicional:** la imagen Maslow.png tiene `feedbackImageName` en BD, pero está servida en `/images/questions/` — o sea, **ambos tipos de imagen (questionImageName y feedbackImageName) se sirven del mismo directorio**. Aula Plus no separa por tipo en el filesystem.

**URL encoding:** imágenes con caracteres especiales (`ñ`, tildes) pueden dar 404 si el archivo en disco tiene encoding diferente al de la BD. Ejemplo: `Grupos-sanguíneos.jpg` registrado en BD → 404 al servirse (bug de ellos, no nuestro). **El scraper debe contemplar fallos 404 y no abortar.**

### 12.10 Modelo de datos completo (Question)

Ejemplo real de una pregunta (de la listing, con TODOS los campos):

```json
{
  "@id": "/api/questions/425",
  "@type": "Question",
  "id": 425,
  "created": "2018-01-10T10:49:19+00:00",
  "updated": "2026-04-15T18:44:45+00:00",
  "text": "Entre la clínica de intoxicación aguda por cocaína o sus derivados, podemos encontrar:",
  "year": "2003",
  "numQuestion": null,
  "canceled": false,
  "isClinicalCase": false,
  "isScales": false,
  "questionImageName": null,
  "feedbackImageName": null,
  "nombreImagenPregunta": null,
  "questionFeedback": null,           // explicación en texto plano
  "subject": {
    "@id": "/api/subjects/21",
    "id": 21,
    "name": "28. SALUD MENTAL",
    "displayableName": "SALUD MENTAL",
    "numQuestionsStudents": "746",
    "numQuestionsNonStudents": "0",
    "branch": {
      "@id": "/api/branches/1",
      "id": 1,
      "name": "ENFERMERÍA",
      "isPublic": true,
      "showFeedback": true
    },
    "isPublic": true,
    "onlyStudents": true,
    "originMandatory": false,
    "origin": null,
    "children": [],
    "broadSubject": null,
    "levelsForBroadSubject": [],
    "legislationBranch": {
      "@id": "/api/legislation_branches/76",
      "id": 76,
      "name": "-",
      "hasOfficialRehearsals": true
    },
    "hasParent": false
  },
  "origin": {
    "@id": "/api/origins/18",
    "id": 18,
    "name": "Región de Murcia",
    "isPublic": true,
    "onlyStudents": false
  },
  "estrategia": {"@id":"/api/estrategias/1","id":1,"name":"Sin estrategia"},
  "level": null,               // QuestionLevel (dificultad)
  "testType": null,            // TestType (tipo de examen)
  "testVersion": null,         // TestVersion (convocatoria específica)
  "examiner": null,            // Examiner (organismo convocante)
  "branch": null,              // Branch a nivel de pregunta (generalmente null, usa subject.branch)
  "legislationBranch": null,   // LegislationBranch a nivel pregunta
  "answers": [
    {
      "@id": "/api/answers/1697",
      "@type": "Answer",
      "id": 1697,
      "text": "Bradicardia.",
      "isCorrect": false,       // ⭐ la respuesta correcta viene marcada directamente
      "feedback": null,         // explicación por respuesta (casi siempre null)
      "imageName": null         // imagen por respuesta (muy raro)
    },
    {"id":1698,"text":"Hipotensión.","isCorrect":false,"feedback":null,"imageName":null},
    {"id":1699,"text":"Euforia seguida de depresión.","isCorrect":true,"feedback":null,"imageName":null},
    {"id":1700,"text":"Todas las anteriores.","isCorrect":false,"feedback":null,"imageName":null}
  ]
}
```

**Puntos críticos del modelo:**

- `isCorrect` **viene marcado directamente** en cada answer. No hace falta endpoint de validación (a diferencia de OpositaTest/TuTestDigital que sí lo requerían).
- `answers[]` **siempre tiene 4 elementos** en la muestra examinada (preguntas tipo test convencional).
- `questionFeedback` y `answer.feedback` son campos para explicación, **la mayoría están en null**. Las pocas explicaciones existentes están en texto plano (no HTML).
- Imágenes: 3 campos distintos pero redundantes:
  - `questionImageName` — imagen del enunciado
  - `feedbackImageName` — imagen de la explicación
  - `nombreImagenPregunta` — campo legacy, **siempre null** en las muestras. Probablemente residuo de migración.
- `subject.branch` es la categorización principal. `question.branch` a nivel de pregunta suele estar en null.
- `origin` indica la CA/organismo original (ej. "Región de Murcia", "Ministerio de Sanidad").
- `year` es el año de la convocatoria original donde apareció la pregunta.
- `canceled: true` → pregunta anulada oficialmente. Igual que `isRepealed`/`isAnnulled` en OpositaTest. **Excluir en la importación.**

### 12.11 Volumen, paginación y rate limits

```bash
# Primer check del volumen total
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://app.aulaplusformacion.es/api/questions?page=1&itemsPerPage=1" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print('Total:', d['hydra:totalItems']); print('Last page URL:', d.get('hydra:view',{}).get('hydra:last'))"
# → Total: 139106
# → Last page URL: /api/questions?itemsPerPage=1&page=464
```

Confusion aparente: total 139106 pero última página 464 con itemsPerPage=1. **API Platform capa a 300 items/página independientemente del `itemsPerPage` solicitado**. 300 × 464 = 139,200 ≈ 139,106 (última página parcial).

**Resumen:**
- `itemsPerPage` máximo efectivo = **300**
- Total páginas con 300/page = **~464**
- Tiempo por petición de 300 items = **~2.8 segundos** (respuesta grande, ~1MB)
- Total sin delays: **464 × 2.8s ≈ 21 min**
- Con delay conservador de 500ms entre páginas: **~25 min**
- Con delay de 1s: **~30 min**

**Rate limits:** no detectamos 429 en las pruebas. API Platform no suele traer rate limiting por defecto. Aun así, **usar delays** por cortesía y para no levantar alertas.

### 12.12 Filtros disponibles (API Platform)

API Platform soporta filtros en la query string. Los detectados:

**Filtros que funcionan:**

- `?pagination=false` — **⚠️ PELIGROSO**, devuelve TODO. En `/api/questions` causa **OOM del servidor** (`Allowed memory size of 1073741824 bytes exhausted`). Bug de ellos, nunca usar.
- `?itemsPerPage=300` — tamaño de página (max 300)
- `?page=N` — página N
- `?order[field]=asc|desc` — ordenación
- `?field=value` — filtro exacto (ej. `?year=2023`)
- `?exists[questionImageName]=true` — solo preguntas con campo no-null

**Filtros que NO funcionan:**

- `?subject.branch.id=6` — teóricamente API Platform permite filtros por relaciones anidadas, pero en este backend está deshabilitado → ignora el filtro y devuelve todas las preguntas.
- `?exists[questionFeedback]=true` — ignorado, devuelve todas
- `?exists[feedbackImageName]=true` — ignorado, devuelve todas

**Funciona solo para `questionImageName`:**
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://app.aulaplusformacion.es/api/questions?exists%5BquestionImageName%5D=true&page=1&itemsPerPage=1" | \
  python3 -c "import sys,json; print('Total con imagen:', json.load(sys.stdin)['hydra:totalItems'])"
# → Total con imagen: 1060
```

**Conclusión:** para filtrar por branch, feedback, etc. hay que **descargar todo y filtrar cliente-side** al procesar los JSONs.

### 12.13 Fugas de seguridad / debug info detectados

Durante el análisis se observaron varias cosas que **no deberían estar en producción** por parte de Aula Plus. Son útiles para nosotros en el mapeo pero indican un fallo de configuración del backend.

**1. Symfony Debug Mode activo en producción.**

Las respuestas de error incluyen full stack traces:

```json
{
  "type": "https://tools.ietf.org/html/rfc2616#section-10",
  "title": "An error occurred",
  "status": 400,
  "detail": "The key \"email\" must be provided.",
  "class": "Symfony\\Component\\HttpKernel\\Exception\\BadRequestHttpException",
  "trace": [
    {"file": "/var/www/vhosts/app.aulaplusformacion.es/app-backend/vendor/symfony/security-http/Firewall/UsernamePasswordJsonAuthenticationListener.php", "line": 114},
    ...
  ]
}
```

Expone:
- Hosting: Plesk (`/var/www/vhosts/`)
- Nombre del directorio: `app-backend`
- Versiones de librerías Symfony

**2. Headers de debug.**

Todas las respuestas incluyen:
- `x-debug-token: 52151b` — Web Profiler token
- `x-previous-debug-token: 1a17c9`

Estos tokens permiten acceder al profiler en dev/stage. En producción deberían estar deshabilitados.

**3. `/api/docs.jsonld` y `/api/docs.json` accesibles.**

API Platform expone documentación auto-generada. Requiere autenticación, lo cual es el comportamiento correcto en la mayoría de casos, pero habitualmente se restringe a usuarios admin o se desactiva en producción.

**4. OOM con `pagination=false`.**

`GET /api/questions?pagination=false` causa `Allowed memory size of 1073741824 bytes exhausted`. El backend tiene límite de 1GB PHP y sin pagination intenta cargar 139K preguntas en RAM. **Es un DoS trivial** — si alguien hiciera 50 peticiones concurrentes con `pagination=false`, el servidor caería.

**5. PHP 7.4.33 (EOL).**

Header `x-powered-by: PHP/7.4.33`. PHP 7.4 alcanzó End of Life en **noviembre 2022**. No recibe parches de seguridad desde hace >3 años.

**Responsabilidad ética:** estos hallazgos se usan solo para entender la superficie de la API y poder replicar peticiones como cliente legítimo. **No explotar el OOM ni hacer scraping masivo con `pagination=false`**. El scraper debe paginar respetuosamente.

---

## 13. API Reference completa

Referencia rápida para escribir el scraper. Todos los endpoints son sobre `https://app.aulaplusformacion.es`.

### 13.1 Autenticación

**Login:**

```http
POST /api/login_check
Content-Type: application/json

{"email": "usuario@dominio.com", "password": "contraseña"}
```

Respuesta 200:
```json
{"token": "eyJ0eX...", "id": 17931}
```

Errores:
- `400` con `"detail":"The key \"email\" must be provided."` → body mal formado
- `401` con `"message":"Invalid credentials."` → email/password incorrectos

**Uso del token:**

```http
GET /api/questions
Authorization: Bearer eyJ0eX...
Accept: application/ld+json
```

**Expiración:** 10 días (864000 s). Cuando recibas 401 en una petición válida → re-login automático.

### 13.2 Endpoints principales

Todos están bajo `/api/`. Todos requieren auth JWT. Respuestas en formato `application/ld+json` (JSON-LD con contexto Hydra) por defecto.

| Endpoint | Método | Volumen | Uso |
|----------|--------|---------|-----|
| `/login_check` | POST | - | Auth |
| `/questions` | GET | 139,106 | Preguntas completas con answers embebidas ⭐ |
| `/questions/{id}` | GET | - | Detalle individual (no hace falta si usas listing) |
| `/answers` | GET | ~556K | No útil standalone, ya vienen en `/questions` |
| `/subjects` | GET | 2,685 | Materias (con branch embebido) |
| `/branches` | GET | 18 | Ramas principales |
| `/examiners` | GET | 8 | Organismos convocantes |
| `/origins` | GET | ~20 | CCAA/ministerios de origen |
| `/legislation_branches` | GET | ~80 | Áreas legislativas |
| `/test_types` | GET | - | Tipos de examen |
| `/test_versions` | GET | - | Convocatorias específicas |
| `/question_levels` | GET | - | Niveles de dificultad |
| `/courses` | GET | ~5 | Cursos contratados por el usuario |
| `/users/{id}` | GET | - | Perfil del usuario |
| `/rehearsals` | GET | - | Simulacros disponibles |
| `/user_tests` | GET | - | Tests realizados por el usuario |
| `/user_answers` | GET | - | Respuestas del usuario |
| `/challenges` | GET | - | Retos (competición) |
| `/docs.jsonld` | GET | - | Schema auto-generado (muy útil) |
| `/docs.json` | GET | - | OpenAPI 3 spec |

### 13.3 Paginación

```http
GET /api/questions?page=1&itemsPerPage=300
```

Respuesta:
```json
{
  "@context": "/api/contexts/Question",
  "@id": "/api/questions",
  "@type": "hydra:Collection",
  "hydra:totalItems": 139106,
  "hydra:member": [ /* 300 questions */ ],
  "hydra:view": {
    "@id": "/api/questions?itemsPerPage=300&page=1",
    "@type": "hydra:PartialCollectionView",
    "hydra:first": "/api/questions?itemsPerPage=300&page=1",
    "hydra:last": "/api/questions?itemsPerPage=300&page=464",
    "hydra:next": "/api/questions?itemsPerPage=300&page=2"
  }
}
```

**Paginar consumiendo `hydra:next` es la forma segura**: te da la URL exacta de la siguiente página.

### 13.4 Branches (18 total)

```
ID  | Nombre                          | isPublic
----+---------------------------------+---------
1   | ENFERMERÍA                      | true
2   | MATRONA                         | true
3   | EIR                             | true
4   | CELADOR                         | true
5   | AUXILIAR ENFERMERÍA             | true
6   | AUXILIAR ADMINISTRATIVO         | true   ← sanitario, NO gen admin
7   | MIR                             | false
8   | ENFERMERÍA SALUD MENTAL         | false
9   | ENFERMERÍA TRABAJO              | false
10  | ENFERMERÍA URGENCIAS            | false
11  | ENFERMERÍA SUBINSPECCIÓN        | false
12  | ENFERMERÍA VÍA EXCEPCIONAL      | false
13  | LEGISLACIÓN                     | true
14  | ENFERMERÍA PEDIÁTRICA           | false
15  | ENFERMERÍA COMUNITARIA          | true
16  | ENFERMERÍA GERIÁTRICA           | false
23  | ENFERMERÍA BANCO DE SANGRE      | false
24  | ENFERMERÍA SALUD PÚBLICA        | false
```

Nota: Aula Plus **no cubre oposiciones administrativas generales** (Aux Admin del Estado, AGE, etc). Su "Aux Administrativo" es para **administrativos en el ámbito sanitario** (servicios de salud, hospitales).

### 13.5 Examiners (8 total)

```
ID | Nombre
---+---------------------------------------
1  | Ministerio de Sanidad
2  | Ministerio de la Defensa
3  | Servicios de Salud
4  | Comunidad Autónoma
5  | Ayuntamiento
6  | Hospitales con Concesiones Administrativas
7  | Instituciones Penitenciarias
8  | Cuerpos del Estado
```

### 13.6 Descarga de imágenes

**URL pattern:**

```
https://app.aulaplusformacion.es/images/questions/{imageName}
```

Donde `{imageName}` es el valor de `questionImageName` **o** `feedbackImageName` (mismo directorio).

**No requiere autenticación JWT** para descargar imágenes (servidas como estáticas por nginx).

**URL encoding:** filenames con caracteres especiales (`ñ`, tildes) requieren URL-encode. Algunos imageNames en BD no tienen archivo real en disco → **404 aceptable, no abortar**.

**Content-types vistos:** `image/png`, `image/jpeg`.

**Volumen:** 1,060 preguntas con `questionImageName` no-null. Feedback images sin contador preciso pero son rarísimas (<0.1% en muestreo).

### 13.7 Respuesta a `isCorrect` — diferencia crítica con otros scrapers

A diferencia de OpositaTest/TuTestDigital donde `correctAnswerId` viene por separado y hay que matchear, aquí:

```json
"answers": [
  {"id": 1697, "text": "Bradicardia.",       "isCorrect": false},
  {"id": 1699, "text": "Euforia seguida...", "isCorrect": true}    ← directo
]
```

**Implicación:** el scraper es más simple. No hace falta llamada adicional para "reason/correct". Toda la info está en el listing.

---

### 13.8 Modelo completo de organización (cómo se agrupan las preguntas)

Aula Plus organiza las preguntas en **5 ejes ortogonales**. Cada pregunta lleva TODOS los ejes embebidos.

```
Question
├── subject (Subject)                ← TEMA específico (2,685 posibilidades)
│   ├── branch (Branch)              ← PROFESIÓN (18 posibilidades)
│   ├── broadSubject (BroadSubject)  ← TEMA transversal (168, opcional, 56% coverage)
│   └── legislationBranch            ← CATEGORÍA PROFESIONAL (166, casi siempre '-')
├── origin (Origin)                   ← CCAA/organismo (39 posibilidades)
├── examiner (Examiner)               ← TIPO organismo (8 posibilidades)
├── year                              ← AÑO convocatoria
├── testType (TestType)               ← TURNO (5 posibilidades)
├── testVersion (TestVersion)         ← VERSIÓN del examen (6 posibilidades)
└── answers[]                         ← RESPUESTAS con isCorrect
```

**Una "oposición" real (ej. Enfermería SERMAS Madrid 2023 Turno Libre)** = combinación filtrada:

```
branch.name    = "ENFERMERÍA"
origin.name    = "Madrid"
year           = "2023"
testType.name  = "Turno libre"
testVersion.name = "Versión única"
```

**Un tema oficial del temario BOE** no existe como campo, pero se puede inferir:
- `subject.name` (muchas veces traduce al tema oficial, ej. "01. CONSTITUCIÓN ESPAÑOLA")
- `subject.broadSubject.name` (transversal, más limpio)
- Sin embargo, **no es mapping 1:1 con el temario BOE de cada convocatoria**. Si quieres alinear con el temario oficial de Madrid 2023 AUX ADMIN, toca mapping manual.

### 13.9 Subjects, BroadSubjects y LegislationBranches

**Subjects (2,685 total)** — Son los "temas" que Aula Plus asocia a las preguntas. Muchos tienen:

- Prefijo numérico reflejando el orden del temario: `"01. CONSTITUCIÓN ESPAÑOLA"`, `"14. LEY PRESUPUESTARIA"`
- Prefijo de CCAA: `"TEMA 21 ANDALUCÍA CCAA+SALUD..."` (específico de una convocatoria)
- Prefijo `ZZ`: preguntas marcadas como "aparcadas" o de exámenes especiales: `"zz Examen final 03"`

Cada subject pertenece a UN único `branch`. No hay subjects multi-branch.

**BroadSubjects (168 total)** — Taxonomía **transversal** que agrupa subjects similares a través de branches.

Ejemplos:
- `"01. Constitución Española"` (broad) agrupa múltiples subjects sobre Constitución de distintos branches
- `"02. Ley General de Sanidad"` (broad) agrupa preguntas sobre Ley 14/1986 estén donde estén
- `"NAV 1. Ley de Reintegración..."` (broad) agrupa subjects de Navarra
- Ejemplo concreto observado: subject `"44. LEY PREVENCIÓN DE RIESGOS LABORALES"` (ENFERMERÍA) → broadSubject `"10. Ley de Prevención de Riesgos Laborales"`

**Cobertura de broadSubject por branch:**

| Branch | Subjects con broadSubject |
|--------|---------------------------|
| LEGISLACIÓN | 166/281 (59%) |
| ENFERMERÍA | 155/285 (54%) |
| AUX ENFERMERÍA | 155/255 (61%) |
| MATRONA | 153/263 (58%) |
| CELADOR | 148/200 (74%) |
| AUX ADMIN | **48/261 (18%)** ← bajo |
| AUX ENF SALUD MENTAL | 46/? |
| EIR | 1/70 |
| MIR | 1/39 |

**LegislationBranches (166 total)** — a pesar del nombre, son **categorías profesionales/puestos**, no leyes:

- Analista de Laboratorio, FEA Digestivo, FEA Médico de Familia
- Cocinero, Electricistas, Fontaneros, Calefactores (personal no sanitario de hospitales)
- Técnico de la Función Admin Jurídica, Técnico Anatomía Patológica
- Trabajador Social, Fisioterapeuta, Telefonista

**Este campo está a `-` (null) en la mayoría de subjects.** Solo 45 subjects del branch LEGISLACIÓN tienen `legislationBranch` asignado. Para los demás branches siempre es `-`.

**Conclusión:** `legislationBranch` es casi inútil para nosotros. Lo ignoramos.

### 13.10 Distribución real de datos (medida en samples)

**Questions por branch (estimado extrapolando sample de 3000-6000):**

| Branch | ~% total | ~preguntas |
|--------|---------|-----------|
| ENFERMERÍA | 24% | ~33,000 |
| AUX ENFERMERÍA | 22% | ~31,000 |
| EIR | 21% | ~29,000 |
| CELADOR | 16% | ~22,000 |
| AUX ADMIN | 16% | ~22,000 |
| resto | ~1-2% | ~2,000 |

**`questionFeedback` coverage (%questions con explicación) — varía MUCHÍSIMO por branch:**

| Branch | Feedback % (sample) | Observación |
|--------|---------------------|-------------|
| ENFERMERÍA | **~45%** | muy bien documentado |
| AUX ADMIN | **~1%** | casi sin explicaciones |
| LEGISLACIÓN | — | no muestreado explícitamente |
| otros | — | pendientes de medir |

**Implicación:** si decides importar a Vence, las preguntas de AUX ADMIN necesitarán **generar explicaciones desde cero con IA** (prácticamente ninguna viene). ENFERMERÍA ya trae la mitad con explicación útil.

### 13.11 Cómo reconstruir una oposición oficial específica

El scraper baja todo. Tras el scraping, un post-proceso reagrupa en carpetas por oposición.

**Pseudo-código para reagrupar:**

```javascript
for (const page of allPages) {
  for (const q of page['hydra:member']) {
    const branch = q.subject?.branch?.name
    const origin = q.origin?.name || 'SIN_ORIGIN'
    const year = q.year || 'SIN_YEAR'
    const testType = q.testType?.name || 'SIN_TEST_TYPE'
    const testVersion = q.testVersion?.name || 'SIN_VERSION'

    // Descartar simulacros internos AulaPlus si solo quieres oficiales
    if (origin === 'AULAPLUS') continue

    const key = `${branch}/${origin}_${year}_${testType}_${testVersion}`
    addToBucket(key, q)
  }
}
```

**Salida esperada:**

```
structured/
├── ENFERMERIA/
│   ├── Madrid_2023_TurnoLibre_VersionUnica.json
│   ├── Madrid_2023_PromocionInterna_VersionUnica.json
│   ├── Cantabria_2021_TurnoLibre_VersionUnica.json
│   └── ...
├── AUXILIAR_ENFERMERIA/
│   ├── Aragon_2004_TurnoLibre.json
│   ├── Baleares_2021_TurnoLibre.json
│   └── ...
├── AUXILIAR_ADMINISTRATIVO/
│   ├── CastillaLaMancha_2009_TurnoLibre.json
│   ├── PaisVasco_2018_TurnoLibre.json
│   └── (Madrid NO existe — Aula Plus no lo cubre)
└── ...
```

### 13.12 Pregunta oficial vs simulacro AulaPlus

**Indicador principal:** `origin.name`.

- `origin.name === "AULAPLUS"` → **simulacro interno** (preparatorio, no examen real)
- `origin.name === "AULAPLUS"` + branch EIR → es típico en EIR (148 de 580 sample = 33%)
- `origin.name === <cualquier CCAA>` → **examen oficial** de esa CCAA en ese año

**Otros indicadores:**

- `year` normalmente presente en oficiales
- `testType` usado en ambos casos
- Los simulacros suelen tener `year: null` o años recientes

**Ejemplo contraste:**

```json
// OFICIAL (AUX ENFERMERÍA Navarra 1999)
{
  "id": 34507,
  "text": "Una Necrosis del Miocardio recibe el nombre de:",
  "year": "1999",
  "origin": {"name": "Navarra"},
  "testType": {"name": "Turno libre"},
  "testVersion": {"name": "Versión única"}
}

// SIMULACRO (EIR típico)
{
  "year": null,
  "origin": {"name": "AULAPLUS"},
  "testType": {"name": "Turno libre"}
}
```

### 13.13 Vinculación con leyes/artículos — NO EXISTE en metadata

**Aula Plus NO tiene campo que vincule pregunta → ley/artículo concreto.**

- `legislationBranch` a nivel pregunta = siempre null
- `legislationBranch` a nivel subject = `-` en 261/261 subjects de AUX ADMIN
- `broadSubject` agrupa temas (Ley de Igualdad, Constitución) pero no baja al nivel de ARTÍCULO

**Para vincular preguntas a artículos (como hace Vence):**

1. **Inferir ley desde `subject.name`:**
   - `"02. PROCEDIMIENTO ADMINISTRATIVO COMÚN"` → Ley 39/2015
   - `"05. ESTATUTO MARCO..."` → Ley 55/2003
   - `"10. LEY GENERAL DE SANIDAD"` → Ley 14/1986
   - `"15. LEY DE CONTRATOS DEL SECTOR PÚBLICO"` → Ley 9/2017
   - Tabla de mapeo manual necesaria

2. **Extraer artículo de `questionFeedback` (cuando existe):**

   Ejemplo real observado:
   ```
   Artículo 122. Plazos.
   1. El plazo para la interposición del recurso de alzada será de un mes...
   ```
   Regex: `/Art[íi]culo\s+(\d+)(?:\.(\d+))?/i` → extrae "122" y opcionalmente sub-apartado.

3. **Si NO hay questionFeedback (muy común en AUX ADMIN):**
   - Pasar enunciado + respuesta correcta por IA (Claude/GPT)
   - Pedir: "¿A qué artículo de [ley inferida] se refiere esta pregunta?"
   - Validar contra contenido real del artículo en Vence

**Conclusión:** la vinculación pregunta → artículo es **post-proceso que requiere trabajo adicional**. El scraper captura toda la info disponible, pero el "mapping a ley/artículo" es responsabilidad nuestra (igual que con OpositaTest/TuTestDigital).

### 13.14 Caveats importantes descubiertos

Durante el análisis se detectaron varios "gotchas" que afectan a la usabilidad del dataset para Vence:

**1. AUX ADMIN Madrid NO existe en Aula Plus.**

Sample grande de AUX ADMIN (183 preguntas): 169 CLM + 14 País Vasco + 0 Madrid. El branch AUX ADMIN de Aula Plus **se centra en Castilla-La Mancha**, con presencia residual de otras CCAA. Para AUX ADMIN Madrid hay que tirar de otras fuentes (OpositaTest, TuTestDigital).

**2. AUX ADMIN tiene MUY pocas explicaciones.**

~1% de preguntas AUX ADMIN tienen `questionFeedback`. Vs ~45% en ENFERMERÍA. Si quieres importar AUX ADMIN a Vence, el grueso de explicaciones se generan con IA.

**3. `estrategia` es uniformemente `"Sin estrategia"`.**

En todas las muestras de AUX ADMIN: 450/450 = `estrategia.name: "Sin estrategia"`. Parece ser un campo administrativo interno de Aula Plus, no útil para filtrado ni clasificación.

**4. Todas las AUX ADMIN sampleadas son `testType: "Turno libre"`.**

No hay "Promoción interna" ni otras categorías en el sample. Aula Plus AUX ADMIN parece enfocarse solo en turno libre.

**5. Los subjects específicos de CCAA tienen nombres largos y poco estructurados.**

Ej. `"TEMA 77 ANDALUCÍA SALUD. LA ADMINISTRACIÓN ELECTRÓNICA..."`. Los nombres **parten del temario oficial de esa CCAA**, pero ni Aula Plus ni nosotros tenemos un mapeo directo entre estos subjects y el temario BOE. Requiere mapeo manual.

**6. El campo `nombreImagenPregunta` es siempre null en las muestras.**

Parece ser un campo legacy (español, vs. `questionImageName` en inglés). El scraper lo captura por completitud pero puede ignorarse en post-proceso.

**7. `subject.numQuestionsStudents` indica volumen por subject.**

Ejemplo: `{name: "02. BIOÉTICA", numQuestionsStudents: "415"}`. Útil para saber antes del scraping cuántas preguntas caen en cada subject sin tener que contarlas manualmente.

---

## 14. Próximos pasos (scraper)

**Lo que falta:**

1. **Escribir `scripts/aulaplus-api-scraper.cjs`** con:
   - Login via `/api/login_check`
   - Re-login automático al detectar 401 (token expirado)
   - Loop por páginas 1 → 464 de `/api/questions?itemsPerPage=300`
   - Delay 500ms entre páginas
   - Progress file `scrape-progress.json` para reanudar
   - Guardar cada página como `raw/page_NNN.json`
   - **Descargar imágenes** (cualquier `questionImageName` o `feedbackImageName` no-null)
   - Paralelizar descarga de imágenes (3-5 concurrent)
   - Skip imágenes ya descargadas
   - **Capturar taxonomías** también: `/api/branches`, `/api/subjects`, `/api/examiners`, `/api/origins`, `/api/legislation_branches` → `metadata/*.json`

2. **Estructura de output:**

```
preguntas-para-subir/aula-plus/
├── raw/                          # 464 archivos, una página cada uno
│   ├── page_001.json
│   ├── page_002.json
│   └── ...
├── images/                        # ~1,060 imágenes
│   ├── Maslow.png
│   ├── AuxAdmtvExtremaduraN.3preg67.jpg
│   └── ...
├── metadata/
│   ├── branches.json
│   ├── subjects.json
│   ├── examiners.json
│   ├── origins.json
│   └── legislation_branches.json
└── scrape-progress.json
```

3. **Pipeline de importación (futuro, cuando decidas expandir Vence a sanidad):**
   - Filtrar preguntas por branch relevante (ej. solo ENFERMERÍA si Vence añade esa oposición)
   - Pasar por detector de duplicados contra preguntas existentes en Vence
   - Reescribir explicaciones con agentes (la mayoría vienen vacías)
   - Verificar artículos / fuentes
   - Mismo flow que `docs/maintenance/importar-preguntas-scrapeadas.md`

**Tiempos estimados:**

- Escribir scraper: 1-2h
- Ejecutar scraping completo: 25-35 min
- Post-proceso (limpieza, dedupe, verificación): depende del volumen final importado

---

## 15. Cheatsheet de análisis estático para OTRA app RN/Expo

Receta de 10 minutos para mapear cualquier app React Native / Expo:

```bash
# 1. Descargar APK/XAPK (APKPure, APKMirror)
# 2. Extraer
mkdir -p /tmp/app-analysis && cd /tmp/app-analysis
unzip -q /path/to/app.xapk              # si es XAPK
unzip -q app.apk assets/index.android.bundle assets/app.config

# 3. Identificar formato
file assets/index.android.bundle

# 4. Extraer strings
strings -n 8 assets/index.android.bundle > all-strings.txt

# 5. Mapear endpoints
grep -oE 'https?://[a-zA-Z0-9.-]+\.[a-z]{2,}[a-zA-Z0-9/_.-]*' all-strings.txt | sort -u
grep -oE '/api/[a-z_]+(/[a-z_]+)*' all-strings.txt | sort -u

# 6. Probar login con curl (probar /login, /api/login, /api/login_check, /api/auth/login, /api/authentication_token, etc.)
for URL in /login /api/login /api/login_check /api/auth /api/authentication_token; do
  curl -s -o /dev/null -w "%{http_code} $URL\n" -X POST "https://api.de.la.app$URL"
done

# 7. Con credenciales, explorar /api/docs.jsonld si usa API Platform (Hydra)
curl -H "Authorization: Bearer $TOKEN" https://api.de.la.app/api/docs.jsonld

# 8. Documentar endpoints, schema, paginación, filtros
```

Si la app NO es RN/Expo (app nativa Java/Kotlin), la receta es distinta:
- Usar `jadx-gui` para decompilar a Java legible
- Buscar strings en el código Java decompilado
- Identificar clases que extienden Retrofit/OkHttp
- Leer las anotaciones `@GET`, `@POST` para endpoints
