# Impugnación 1aac9e3c-1509-4a61-90b3-d150e43630eb (w2, 05/08/2026)

- **Pregunta:** `396b3825-0f35-4c4a-b5e8-04ccf0e3bd4c` — tutela judicial del derecho a la igualdad
  (art. 12.1 LO 3/2007), clave A) art. 53.2 CE, incluso tras la terminación de la relación.
- **Usuario:** `5f7cef26-8b65-4bba-b421-189b7ccc1f3c` — oposición `ordenanza_ayuntamiento_cordoba`,
  plan `free` (vía `flota_dispute_contexto`; `user_profiles` no accesible con ninguna de las dos
  credenciales del trabajador → **nombre real pendiente**, rellenar antes de enviar).
- **Motivo:** `otro` — *"no corresponde al temario"*.

## Regla previa OBLIGATORIA (queja de temario)

`npm run epigrafe:revision -- ordenanza_ayuntamiento_cordoba --pregunta 396b3825-...`:

```
temas: 10 · Paso 1 pendiente: 0 · filas rotas: 0 · Paso 2 sellado fuera del pipeline: 0
temas que SIRVEN la pregunta: T3
⚠️ [paso2_pendiente] T3 (Igualdad efectiva y violencia de género): Paso 2 en `never_verified` — deuda declarada, no falso verde.
✅ se puede responder: lo que sirve esta pregunta está en orden
```

Verde (exit 0). El Paso 2 (verificación scope↔epígrafe) de ese tema está `never_verified`, pero es
deuda declarada, no un falso verde — no bloquea responder.

## Verificación contra `topic_scope`

Tema 3 del Bloque I ("Igualdad efectiva y violencia de género") de `ordenanza_ayuntamiento_cordoba`:
- `description`: *"Igualdad efectiva de mujeres y hombres. Políticas públicas. Protección integral
  contra la violencia de género."*
- `topic_scope` incluye **LO 3/2007** arts. `1,3,4,5,6,7,8,10,11,12,14,15` — **el art. 12 está
  explícitamente en el scope**, y también LO 1/2004 (violencia de género).

La pregunta cuelga de LO 3/2007 art. 12, que está dentro del scope de ese mismo tema por su propio
epígrafe. No hay ambigüedad de "está en otro tema": es el único tema de la oposición que sirve esta
pregunta (comprobado por el propio `epigrafe:revision`).

## Verificación contra fuente oficial (BOE)

`https://www.boe.es/buscar/act.php?id=BOE-A-2007-6115` (LO 3/2007), art. 12.1 — texto íntegro,
verificado con `WebFetch` directo a la ficha consolidada del BOE:

> «Cualquier persona podrá recabar de los tribunales la tutela del derecho a la igualdad entre
> mujeres y hombres, de acuerdo con lo establecido en el artículo 53.2 de la Constitución, incluso
> tras la terminación de la relación en la que supuestamente se ha producido la discriminación.»

Coincide literalmente con el enunciado y la clave A de la pregunta. Ancla comprobada con `curl` +
grep de `id="a12"`: existe y precede exactamente al bloque de ese artículo (no es un ancla que
"cuela" apuntando a otro sitio, comprobado igual que exige §7.3.quater).

## Veredicto

**RECHAZAR (`rejected`).** La pregunta sí pertenece al temario (Tema 3 del Bloque I) y la clave es
correcta y literal. No hay fallo nuestro que corregir en el contenido.

## Checklist

1. ¿Clave correcta? ✅ (verificado contra BOE)
2. ¿Artículo vinculado responde literalmente? ✅ (cita exacta)
3. ¿Pregunta bien formulada? ✅
4. ¿Explicación mejorable? Ya está en formato estructurado §5.1 (check automático 🟢) — no hace
   falta tocarla.
4.bis ¿Es sistémico? **Aislado.** Es la única impugnación abierta sobre esta `question_id`
   (comprobado en `question_disputes`). Hay otras ~40 impugnaciones recientes de tipo "fuera de
   temario" en el sistema, pero de usuarios y oposiciones distintas — no comparten causa con esta
   (cada una hay que juzgarla contra el `topic_scope` de SU oposición). No se abre ficha: el scope
   de este tema concreto es correcto por construcción y coincide con su propio epígrafe.
5. Clasificación: `tema_incorrecto` (aunque el motivo del formulario fue "otro").
6. ¿Oficial? No (`is_official_exam=false`) — de todas formas no hace falta tocar nada, ya está bien.
7. N/A (no se toca la explicación).
8. Borrador abajo.
9. Pendiente de aprobación — el trabajador NO cierra.

## Borrador de respuesta (pendiente de nombre real + OK de Manuel)

> Sin acceso a `user_profiles` no puedo poner el nombre. Quien cierre lo tiene a mano en el panel
> admin — sustituir `[Nombre]` por el nombre real, o dejar "Hola," si es claramente ficticio.

```
Hola [Nombre],

Esta pregunta sí corresponde a tu temario: pertenece al Tema 3 del Bloque I, "Igualdad efectiva y
violencia de género", que incluye expresamente la Ley Orgánica 3/2007, de 22 de marzo, para la
igualdad efectiva de mujeres y hombres.

La pregunta reproduce el artículo 12.1 de esa ley:

"Cualquier persona podrá recabar de los tribunales la tutela del derecho a la igualdad entre
mujeres y hombres, de acuerdo con lo establecido en el artículo 53.2 de la Constitución, incluso
tras la terminación de la relación en la que supuestamente se ha producido la discriminación."

Puedes comprobarlo aquí: https://www.boe.es/buscar/act.php?id=BOE-A-2007-6115#a12

Es posible que no esperaras encontrar esta ley dentro de tu temario si venías centrando el estudio
en la Constitución o la Administración Local, pero el Tema 3 la incluye de forma expresa, junto con
la Ley Orgánica 1/2004 de protección integral contra la violencia de género.

Muchas gracias.

Equipo de Vence
```

**No he tocado el dispute ni la BD de negocio.** Soy un worker de flota: solo lectura de negocio
(`VENCE_LECTOR_URL`), coordinación en `DATABASE_URL`. El cierre (`cerrar.ts` → `/api/v2/dispute/resolve`)
lo hace quien apruebe este borrador.
