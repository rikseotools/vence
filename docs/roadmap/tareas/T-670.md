### [T-670] ✅ [HECHA 07/08] INCIDENTE: al corregir un examen el servidor respondía 403 al propio dueño porque esa llamada no adjuntaba Bearer

**Nota de trazabilidad:** la ficha se reservó y la tarea se trabajó, cerró y archivó el mismo día,
pero su cuerpo nunca llegó al markdown (solo existía la fila en `backlog_tasks`). Se escribe ahora
para que el conocimiento no viva únicamente en el `outcome`.

**Qué pasaba.** [T-565] añadió — con razón — una guarda de propiedad en `/api/exam/*`: antes, con
solo el UUID de un test se leían las respuestas de otra persona. Pero las llamadas del navegador iban
sin token, así que el servidor no veía identidad, `callerUserId` salía `null`, el examen SÍ tenía
dueño y la guarda **bloqueaba al propio dueño** con un 403 «No tienes acceso a este recurso». El
usuario lo veía como «no hay conexión».

**Medido:** 190 rechazos en `/api/exam/validate` en 24 h · 20 personas distintas · Emma (premium) lo
intentó **seis veces en 45 minutos**, bajando de 100 preguntas a 25, a 10, a 5 y a 2 por si acaso, y
se fue sin corregir ninguno.

**Dos arreglos complementarios, de dos sesiones distintas:**
- **[T-669]** (otra sesión): mandar la identidad en los CINCO sitios de llamada afectados, con
  `getAuthHeaders()`. No se relajó la guarda.
- **Esta ficha:** cerrar la CLASE. `apiFetch` mandaba todo anónimo salvo que el llamante se acordara
  del Bearer, así que **cualquier otra llamada futura** contra un endpoint con dueño repetiría el
  fallo y no se vería hasta que otro usuario perdiera otro examen. Ahora el puerto de auth
  **registra su proveedor al construirse** (`lib/auth/client.ts`), así que no hay paso de cableado
  que olvidar; no pisa un `Authorization` explícito, nunca bloquea, y **solo adjunta el token a URLs
  nuestras** (con una absoluta le regalaríamos la sesión del usuario a un tercero).

**El intento que se descartó, porque enseña dónde va el seam:** primero se hizo que `apiFetch` fuera
a buscar el token él mismo (`await import('@/lib/auth')`). Funcionaba y estaba mal: un cliente HTTP
genérico que se busca la identidad hace **una llamada de red que nadie ve** — en los tests se comía
el `fetch` mockeado y tumbó **20 pruebas ajenas**. Un seam que rompe a quien no lo usa está en el
sitio equivocado; por eso se inyecta.

**Y el agujero de fondo, que era de VIGILANCIA:** `cobro_bloqueado_auth` ya miraba
`auth_identidad_ajena_rechazada`… pero **solo en rutas de pago**. Por eso 190 rechazos y 20 personas
no dispararon nada y lo acabó contando una usuaria por soporte. Nueva regla hermana
**`bloqueado_en_su_recurso`** (`error`, ≥5 en 15 min; el máximo de un día normal son 9 en una HORA),
excluyendo cobro para no avisar dos veces del mismo hecho.

**Capas:** 5 unit del cliente, guardarraíl de cableado que **ejecuta** (comprueba que pedir el puerto
deja el proveedor puesto, no que los ficheros mencionen la función) y 7 casos de la regla. 93 tests
verdes junto con los de T-669.

**Verificado en producción** (frontend `eb8fc1ff`, backend `165b6e5d`): los rechazos pasaron de 32-71
por HORA a **cero en dos horas**, último a las 19:22; cero `client_error` de ExamLayout y exámenes
completándose.

**⚠️ Discrepancias con los datos de [T-669], sin resolver.** No se pudo avisar a esa sesión (no era
alcanzable por su nombre), así que quedan aquí para quien las lea:
- Dice *«cero en los diez días anteriores»*. La serie de `auth_identidad_ajena_rechazada` **no está a
  cero antes**: 350 eventos y 19 usuarios desde el 30/07, con ~25 el 06/08. En `/api/exam/validate`
  concreto sí puede ser regresión del día, pero el evento no nació hoy.
- Sitúa el primer caso en **07/08 17:34**; los `client_error` de ExamLayout de Emma son de las
  **16:33 UTC**, una hora antes.
