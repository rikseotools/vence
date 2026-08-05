# Impugnación 2477d39d-6353-4389-8a0c-0c9a5d5b27c3

- **Pregunta:** `0b0791c3-5c7b-44cf-a89e-f959d2cfa925` — "¿Qué combinación de teclas se utiliza para crear
  una nueva tarea en Outlook?" (A) Ctrl+T · B) Ctrl+Mayús+T · C) Ctrl+Mayús+K [clave] · D) Ctrl+Mayús+N)
- **Usuario:** `75525381-22a4-468f-85d7-9e1eee00fff0` (nombre no accesible — `user_profiles` da
  `permission denied` tanto con `DATABASE_URL` como con `VENCE_LECTOR_URL`; ninguna de las dos
  credenciales del trabajador llega a datos personales. **Rellenar nombre antes de enviar.**)
- **Motivo:** `respuesta_incorrecta` — *"ese atajo es en la versión inglesa pero en la española es con
  la 'T'"*.
- **Artículo vinculado:** Outlook 365 art. 3 "Atajos de teclado" (`bf87a5b0-636f-4a50-a3ee-f93596801fcd`).
  Oficial=false, lifecycle=`tech_approved`.

## Verificación contra fuente oficial

El propio artículo ya documenta, en dos sitios distintos, que **Ctrl+Mayús+K** crea la tarea y que
**Ctrl+T / Ctrl+Mayús+T** son atajos de **sangría** (aumentar/disminuir), no de tareas. Verificado
independientemente contra el HTML crudo (no solo el resumen del fetcher) de la página oficial:

```
curl -sL "https://support.microsoft.com/es-es/office/m%C3%A9todos-abreviados-de-teclado-para-outlook-3cdeb221-7ae5-4c1d-8c1d-9e63216c1efd"
```

Esa página repite **tres veces**, en tablas distintas, la fila `Nueva tarea | Ctrl+Mayús+K` /
`Crear una tarea desde cualquier vista Outlook | Ctrl+Mayús+K`, y por otro lado `Ctrl+T` está
asignado a *"Publicar una respuesta en la carpeta seleccionada"* — no está libre para "nueva tarea".
Confirmado también en la versión **inglesa** de Microsoft (Ctrl+Shift+K = New Task): **no es un caso
de traducción**, la combinación es idéntica en los dos idiomas. Contrastado además con una pregunta
hermana ya activa en el banco (`d7f53aba…`, "¿Qué ocurre al presionar Ctrl+Mayúsc+K en Outlook 365?"
→ clave "Se crea una nueva tarea") — coherente.

**Origen probable de la confusión del usuario:** al menos una web de preparación de oposiciones no
oficial (`age.josenrique.es/leccion/atajos-de-teclado-outlook/`) da *Ctrl+Mayús+T = crear una nueva
tarea*, que es **incorrecto** contra la fuente oficial. No se puede afirmar que sea SU fuente exacta,
así que en el mensaje se dice en términos generales ("algún temario o web de terceros"), no se nombra
esa web.

## Veredicto

**RECHAZAR (`rejected`).** La clave C) Ctrl+Mayús+K es correcta. La pregunta y el artículo vinculado
ya son correctos y coherentes con la fuente oficial — no hay fallo nuestro que corregir en el
contenido.

## ¿Es sistémico?

**Aislado.** Medido: las 12 preguntas activas del mismo artículo (ver dossier) no repiten este
patrón, y el propio artículo ya recoge explícitamente la distinción Ctrl+T/Ctrl+Mayús+T (sangría) vs
Ctrl+Mayús+K (tarea) — no es un hueco de contenido nuestro, es un error de una fuente externa que
estudió el usuario. No se abre ficha.

## Mejora opcional de la explicación (NO aplicada — el trabajador no escribe en la BD de negocio)

La explicación actual es correcta pero (a) no cita la fuente oficial (Microsoft Support), que exige
§5.1.1 del manual para preguntas de informática, y (b) las razones de A) y B) no explican qué SÍ hace
Ctrl+T/Ctrl+Mayús+T (solo dicen "no está asignado"), perdiendo la ocasión de resolver exactamente la
confusión que motivó la impugnación. De paso queda en formato estructurado (barajable).

JSON listo para aplicar con
`npx tsx --env-file=.env.local scripts/aplicar-explicacion.ts 0b0791c3-5c7b-44cf-a89e-f959d2cfa925 scratchpad/impugnaciones/2477d39d-explicacion.json --apply`
(correr antes sin `--apply` para ver el render). Fichero: `scratchpad/impugnaciones/2477d39d-explicacion.json`.

## Borrador de respuesta

**Ya existía un borrador abierto para este mismo dispute: #21 (session_questions), dejado por
`l3-fedora-2b213d`.** Mismo veredicto (RECHAZAR) y misma fuente verificada de forma independiente —
buena señal de que el análisis es sólido. El guard anti-duplicado de `backlog.cjs borrador` lo
detectó y bloqueó mi segundo borrador (correcto: dos borradores para el mismo destinatario obligan a
Manuel a elegir, que es justo el trabajo que se quiere ahorrar).

En vez de forzar un borrador nuevo, dejé la pregunta **#54** señalando dos mejoras concretas al #21
antes de aprobarlo:
1. Abre con *"Gracias por tu mensaje"* — el manual (§6) prohíbe explícitamente abrir agradeciendo el
   aviso; el único agradecimiento va al final ("Muchas gracias.").
2. Aclara `Ctrl+T` (opción A) pero no `Ctrl+Mayús+T` (opción B) — que es la que compite en paralelo
   con la clave `Ctrl+Mayús+K` y probablemente la que el usuario tenía en mente ("es en la española
   con la T"). Propuse el párrafo de sustitución citando mi verificación (Ctrl+Mayús+T = disminuir
   sangría, confirmado contra el HTML crudo de Microsoft Support).

**No he tocado el dispute, la pregunta ni la BD de negocio.** El mensaje final (con o sin mis
correcciones) y el nombre real del usuario los resuelve quien apruebe #21/#54.

## Reconfirmación (misma sesión w2, turno posterior — 05/08 ~17:15 UTC)

Cogí `2477d39d` de la cola (`cola.cjs next`) sin saber que ya lo había analizado antes: llegó
libre, así que el sistema de claim funcionó como se espera (nadie más lo tenía reservado). Repetí
la verificación de cero, independientemente, ANTES de mirar este fichero:

- `WebFetch` directo (3 veces, con prompts distintos) a la página oficial de Microsoft Support ES
  → siempre `Ctrl+Mayús+K` = crear tarea, `Ctrl+Mayús+T` = disminuir sangría.
- `WebSearch` de la versión inglesa → `Ctrl+Shift+K` = New Task, `Ctrl+Shift+T` = Decrease Indent
  (misma pareja en los dos idiomas, no hay localización aquí).
- Consulta directa a la BD (`VENCE_LECTOR_URL`): dos preguntas ACTIVAS más del banco, ajenas a
  esta (`02abd999…` y `b9e56e90…`), marcan también K como clave para "crear tarea" — coherencia
  interna independiente de este artículo.
- Búsqueda en `question_disputes` de cualquier otra impugnación que mencione "outlook"/"tarea":
  ninguna repite este patrón → sigue siendo un caso **aislado**, no sistémico.

Mismo veredicto exacto (RECHAZAR) que #21/#39/#54/#72. Es la **4.ª verificación independiente**
que llega a la misma conclusión — que es una señal fuerte de que el análisis es sólido, pero
también confirma lo que ya dejó escrito #73: **la cola está saturada de re-análisis duplicados**
porque cada sesión nueva puede coger un id ya resuelto en cuanto se libera, sin ver el histórico
de `session_questions` para ese `dispute_id` antes de ponerse a trabajar.

**Decisión de esta pasada: NO añadir un 4.º borrador ni una nueva pregunta.** #73 ya dejó la
recomendación correcta (revisar `backlog.cjs preguntas`, aprobar/aplicar uno de los cuatro
—#72 es el más limpio: no abre agradeciendo el aviso, que es justo lo que #54 le pedía corregir a
#21— y retirar el resto). Repetirla en un #74 sería el mismo problema que se está señalando.
Solté la reserva (`cola.cjs release`) sin tocar el dispute para que quede libre por si hace falta
releerlo, pero **no hace falta que otra sesión vuelva a analizarlo**: está resuelto en cuanto
alguien con acceso a `user_profiles` (el nombre real) apruebe #72.
