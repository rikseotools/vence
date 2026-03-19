require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.66.1 contenido solicitudes firma representante
  const exp1 = `**Articulo 66.1 de la Ley 39/2015 (LPAC) - Contenido de las solicitudes:**

> Art. 66.1: "Las solicitudes deberan contener:
> a) Nombre y apellidos del interesado y, en su caso, de la persona que lo represente.
> b) Identificacion del medio electronico, o en su defecto, lugar fisico para la notificacion.
> c) Hechos, razones y peticion en que se concrete, con toda claridad, la solicitud.
> d) Lugar y fecha.
> **e) Firma del solicitante o acreditacion de la autenticidad de su voluntad expresada por cualquier medio.**
> f) Organo, centro o unidad administrativa a la que se dirige y su correspondiente codigo de identificacion."

**Por que B es la que NO figura (y por tanto la respuesta):**
La opcion B dice "Firma del solicitante o **de su representante** o acreditacion...". El art. 66.1.e dice solo "Firma del **solicitante** o acreditacion...", sin mencionar expresamente al representante en este apartado. La trampa anade "de su representante", que no aparece en la letra e).

**Por que las demas SI figuran en el art. 66.1:**

- **A)** "Hechos, razones y peticion en que se concrete, con toda claridad, la solicitud." **Correcto**: reproduce literalmente el art. 66.1.c). Es uno de los contenidos obligatorios.

- **C)** "Nombre y apellidos del interesado y, en su caso, de la persona que lo represente." **Correcto**: reproduce literalmente el art. 66.1.a). Es el primer dato obligatorio de la solicitud.

- **D)** "Organo, centro o unidad administrativa a la que se dirige y su correspondiente codigo de identificacion." **Correcto**: reproduce literalmente el art. 66.1.f). Identifica el destinatario de la solicitud.

**Contenido obligatorio de las solicitudes (art. 66.1):**
1. **Nombre y apellidos** del interesado (y representante)
2. **Medio de notificacion** (electronico o fisico)
3. **Hechos, razones y peticion**
4. **Lugar y fecha**
5. **Firma del solicitante** (no del representante)
6. **Organo** al que se dirige con codigo

**Clave:** La firma es del "solicitante", no del "representante". Es un detalle sutil pero determinante en esta pregunta.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "f900c83e-7369-40a4-a796-d5b6dceec72c");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 art.66 solicitudes (" + exp1.length + " chars)");

  // #2 - CE art.57.1 sucesión trono orden preferencia línea anterior
  const exp2 = `**Articulo 57.1 de la Constitucion Espanola - Sucesion al trono:**

> "La sucesion en el trono seguira el orden regular de primogenitura y representacion, siendo preferida siempre **la linea anterior a las posteriores**; en la misma linea, el grado mas proximo al mas remoto; en el mismo grado, el varon a la mujer, y en el mismo sexo, la persona de mas edad a la de menos."

**Por que B es correcta (la linea anterior a las posteriores):**
La pregunta pide que se identifique el criterio que se aplica **en primer lugar**. El art. 57.1 establece un orden jerarquico de preferencias: primero se compara la **linea** (anterior sobre posteriores), despues el **grado**, luego el **sexo**, y finalmente la **edad**. La linea es el primer criterio.

**Por que las demas no son el primer criterio (son criterios subsidiarios):**

- **A)** "En la misma linea, el grado mas proximo al mas remoto." **Es correcto como regla**, pero es el **segundo** criterio, no el primero. Solo se aplica cuando dos candidatos pertenecen a la **misma linea**. Primero se compara la linea.

- **D)** "En el mismo grado, el varon a la mujer." **Es correcto como regla**, pero es el **tercer** criterio. Solo se aplica cuando dos candidatos estan en la misma linea y el mismo grado. Es la preferencia de sexo (nota: esta regla ha sido criticada como anacronismo constitucional).

- **C)** "En el mismo sexo, la persona de mas edad a la de menos." **Es correcto como regla**, pero es el **cuarto** y ultimo criterio. Solo se aplica cuando coinciden linea, grado y sexo.

**Orden jerarquico de preferencia en la sucesion (art. 57.1):**

| Orden | Criterio | Regla |
|-------|----------|-------|
| **1.o** | **Linea** | Anterior sobre posteriores |
| 2.o | Grado | Mas proximo sobre mas remoto |
| 3.o | Sexo | Varon sobre mujer |
| 4.o | Edad | Mayor sobre menor |

**Clave:** El primer criterio es siempre la **linea** (anterior sobre posteriores). Los demas se aplican subsidiariamente cuando coincide el criterio anterior.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "215bcfb4-fe91-4e21-a2ff-c715018cd73d");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.57 sucesion trono (" + exp2.length + " chars)");

  // #3 - CE art.82 delegación legislativa no cabe en materias de LO (art.81)
  const exp3 = `**Articulos 81 y 82 de la Constitucion Espanola - Delegacion legislativa:**

> Art. 82.1: "Las Cortes Generales podran delegar en el Gobierno la potestad de dictar normas con rango de ley sobre materias determinadas **no incluidas en el articulo anterior**."

> Art. 81.1: "Son leyes organicas las relativas al desarrollo de los **derechos fundamentales y de las libertades publicas**, las que aprueben los Estatutos de Autonomia y el regimen electoral general y las demas previstas en la Constitucion."

**Por que A es correcta (iniciativa legislativa popular):**
La **iniciativa legislativa popular** esta regulada en el art. 87.3 CE, que la excluye expresamente de materias propias de ley organica, tributarias, internacionales y de prerrogativa de gracia. Pero precisamente por ser una materia conectada a derechos fundamentales (participacion politica, art. 23 CE), su regulacion requiere ley organica (LO 3/1984). Al ser materia de ley organica, **no puede ser delegada** al Gobierno (art. 82.1: materias "no incluidas en el articulo anterior").

**Por que las demas SI pueden ser objeto de delegacion:**

- **B)** "Contratacion publica." **Si delegable**: la contratacion publica no es materia de ley organica. Se regula por ley ordinaria (Ley 9/2017, LCSP). El Gobierno podria recibir delegacion para legislar sobre ella.

- **C)** "Materia portuaria." **Si delegable**: los puertos no son materia reservada a ley organica. Se regulan por legislacion ordinaria (RDL 2/2011, Ley de Puertos del Estado). Es delegable.

- **D)** "Estatuto de los trabajadores." **Si delegable**: la legislacion laboral no es materia de ley organica. De hecho, el actual Estatuto de los Trabajadores (RDL 2/2015) es un texto refundido aprobado por el Gobierno precisamente mediante delegacion legislativa de las Cortes.

**Materias excluidas de la delegacion legislativa (art. 82.1 + 81):**
- Derechos fundamentales y libertades publicas
- Estatutos de Autonomia
- Regimen electoral general
- Demas materias reservadas a ley organica por la CE

**Clave:** No se puede delegar lo que requiere ley organica. La iniciativa legislativa popular conecta con derechos fundamentales (art. 23 CE) y se regula por LO 3/1984, por lo que esta excluida de delegacion.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "35137ed8-29aa-454e-81d0-eb8cde9582cb");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.82 delegacion legislativa (" + exp3.length + " chars)");
})();
