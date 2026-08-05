# Impugnación 744f0db0-27ec-4cc1-80bd-6332877bad70 — análisis y borrador (w2, 05/08/2026)

> ⚠️ **Nota de proceso**: `node scripts/backlog.cjs borrador --para … --texto …` (el comando que el
> encargo de este trabajador da como paso obligatorio) **no existe en el repo** — no hay subcomando
> `borrador` en `scripts/backlog.cjs` ni en `scripts/impugnaciones/cola.cjs`. Dejo el análisis y el
> mensaje propuesto en este fichero y lo señalo con `backlog.cjs preguntar` porque no tengo otra vía
> para ponerlo donde Manuel lo vea sin escribir directamente en `question_disputes.admin_response`
> (que el manual prohíbe fuera del endpoint `/resolve`, §15). También me falta credencial de escritura
> en la BD de negocio (`DATABASE_URL` de este trabajador solo tiene SELECT/UPDATE en 4 tablas de
> coordinación; `VENCE_LECTOR_URL` es solo lectura) — así que tampoco puedo aplicar yo la corrección
> ni el `aplicar-explicacion.ts`. Dejo el texto ya listo para que quien cierre solo tenga que aplicarlo.

## 1. Datos

- **Dispute:** `744f0db0-27ec-4cc1-80bd-6332877bad70` · tipo `otro` · creada 2026-08-05T10:33:36Z
- **Usuario:** `4e700733-cf8f-4645-b932-9ff84746f7e9` (no he podido obtener el nombre real: `user_profiles`
  no está en el alcance de ninguna de mis dos credenciales — es dato personal a propósito).
- **Descripción de la impugnación:** *"Se encuentra en el artículo 27.1, no en el 27.3."*
- **Pregunta:** `1707bb9d-2d57-4654-97eb-bc14905b8333` (activa, `lifecycle_state=approved`, difficulty `easy`)
  > Según lo dispuesto en la Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de
  > las Administraciones Públicas, las copias auténticas de documentos privados surten únicamente:
  - A) Efectos administrativos. **← correct_option = 0, marcada correcta**
  - B) Efectos favorables al interesado.
  - C) Efectos a partir de la fecha en que el interesado las solicita.
  - D) Efectos previstos en el artículo 85 de la Ley 39/2015.
- **Artículo vinculado (`primary_article_id`):** `95f7742c-0c2e-40ec-bbde-ac1db59bcc0d` — Ley 39/2015,
  **artículo 27** completo ("Validez y eficacia de las copias realizadas por las Administraciones
  Públicas"), con los apartados 1-6 en el `content`. **El vínculo al artículo es CORRECTO** — no hace
  falta re-vincular, el artículo 27 entero (que incluye el apartado 1) es el que corresponde.

## 2. Verificación de cada opción

| Opción | Fundamento legal | ¿Correcta? |
|---|---|---|
| A | Art. 27.1 in fine: «Las copias auténticas de documentos privados surten únicamente efectos administrativos.» | ✅ |
| B | Ningún apartado del art. 27 condiciona los efectos a que sean "favorables al interesado" | ❌ |
| C | Ningún apartado vincula la eficacia a la fecha de solicitud | ❌ |
| D | Art. 85 Ley 39/2015 = "Terminación en los procedimientos sancionadores" (verificado en BD), materia ajena | ❌ |

**La respuesta marcada (A) es correcta.** El único defecto es de CITA: la explicación dice
"artículo 27.3" cuando la frase citada está en el **artículo 27.1**.

## 3. Verificación contra fuente oficial (BOE)

Consolidado: `https://www.boe.es/buscar/act.php?id=BOE-A-2015-10565#a27` (y ELI:
`https://www.boe.es/eli/es/l/2015/10/01/39/con`).

Apartado 1 del art. 27, texto oficial (confirmado también contra nuestro propio `articles.content`,
que lo transcribe igual):

> «Cada Administración Pública determinará los órganos que tengan atribuidas las competencias de
> expedición de copias auténticas de los documentos públicos administrativos o privados.
>
> Las copias auténticas de documentos privados surten únicamente efectos administrativos. Las copias
> auténticas realizadas por una Administración Pública tendrán validez en las restantes
> Administraciones. […]»

El apartado 3 del art. 27 es otra materia (requisitos técnicos ENI/ENS para garantizar identidad y
contenido de las copias electrónicas/papel — metadatos, digitalización, CSV). **No** contiene la
frase de "efectos administrativos".

**Veredicto: la impugnación PROCEDE.** El usuario tiene razón: la cita correcta es 27.1, no 27.3.

## 4. ¿Es sistémico?

Medido por SQL contra `questions.explanation` (VENCE_LECTOR_URL, banco activo completo):

```sql
SELECT count(*) FROM questions
 WHERE explanation ILIKE '%27.3%' AND explanation ILIKE '%efectos administrativos%';
-- → 1 (solo esta pregunta)
```

Y entre las 74 preguntas activas vinculadas a este mismo artículo (`primary_article_id =
95f7742c-…`), solo esta cita el art. 27.3 junto con "efectos administrativos"; el resto de menciones
a "27.3" en esas 74 corresponde correctamente a la materia de digitalización/metadatos (apartado 3
real). **Aislado: no hay más casos.** No abro ficha de backlog.

## 5. Corrección propuesta (para aplicar con `aplicar-explicacion.ts` antes de cerrar)

Solo cambia el número de apartado citado (27.3 → 27.1); el resto del análisis por opción ya es
correcto y ya sigue el formato §5.1 (negrita cerrada tras el paréntesis, así que es transcribible).

```
La respuesta correcta es **A) Efectos administrativos**.

Según el artículo 27.1 de la Ley 39/2015, «las copias auténticas de documentos privados surten
únicamente efectos administrativos».

**A)** CORRECTA — El precepto lo dice literalmente: surten únicamente efectos administrativos.

**B)** INCORRECTA — La Ley no condiciona sus efectos a que sean «favorables al interesado».

**C)** INCORRECTA — La eficacia no se vincula a la fecha en que el interesado las solicita.

**D)** INCORRECTA — El art. 85 de la Ley 39/2015 regula la terminación en los procedimientos
sancionadores, materia ajena a las copias auténticas.
```

> Nota: `explanation_data` de esta pregunta está a `NULL` (no estructurada aún) — es un hueco previo
> a esta impugnación, no algo que yo haya tocado. El gate de cierre (§ manual, "El cierre EXIGE que
> la explicación esté adaptada") va a pedir pasar esto por `aplicar-explicacion.ts --apply` de todos
> modos para poder cerrar en `resolved`. El texto de arriba ya viene en el formato que ese script
> espera (negrita `**A)**` seguida del veredicto, no `**A) CORRECTA**`).

## 6. Borrador del mensaje al usuario (pendiente de nombre real + OK de Manuel)

> Sin acceso a `user_profiles` no puedo poner el nombre. Quien cierre lo tiene a mano
> (`SELECT full_name FROM user_profiles WHERE id='4e700733-cf8f-4645-b932-9ff84746f7e9'`) — sustituir
> `[Nombre]` por el primer nombre, o dejar "Hola," si es claramente ficticio.

```
Hola [Nombre],

Tenías razón. Ya está corregida: la respuesta se apoya en el artículo 27.1 de la Ley 39/2015, no en
el 27.3.

Muchas gracias.

Equipo de Vence
```

- No paga recompensa a menos que el usuario sea premium y el tipo de impugnación puntúe — comprobar
  al cerrar (`reward_submissions` / plan_type, que tampoco puedo consultar yo).
- Cerrar como `resolved` vía `/api/v2/dispute/resolve` únicamente, tras aplicar la explicación
  corregida y con el `--sistemico "aislado: …"` (ver §4 arriba, ya trae la cifra).
