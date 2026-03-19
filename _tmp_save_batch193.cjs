require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.121 recurso de alzada resuelve superior jerárquico
  const exp1 = `**Articulo 121.1 de la Ley 39/2015 (LPAC) - Recurso de alzada:**

> "Las resoluciones y actos [...] cuando no pongan fin a la via administrativa, podran ser recurridos en alzada ante el **organo superior jerarquico** del que los dicto."

**Por que D es correcta (superior jerarquico):**
El recurso de alzada se interpone ante y se resuelve por el **organo superior jerarquico** del que dicto el acto impugnado. Es la esencia del recurso de alzada: un organo de rango superior revisa la decision del inferior. Por eso se llama "alzada" (se sube un nivel en la jerarquia).

**Por que las demas son incorrectas:**

- **A)** "El organo **inferior** del que dicto el acto." Falso: un organo inferior no puede revisar las decisiones de un organo superior. La jerarquia administrativa funciona de arriba abajo, no al reves.

- **B)** "El organo **ante el que se interponga** el recurso." Falso: el recurso puede interponerse ante el propio organo que dicto el acto o ante el superior (art. 121.2), pero la competencia para **resolver** corresponde siempre al superior jerarquico. La interposicion y la resolucion pueden ser ante organos distintos.

- **C)** "El organo **que dicto el acto** que se impugna." Falso: si el mismo organo que dicto el acto lo revisara, seria un recurso de **reposicion** (art. 123), no de alzada. La diferencia clave entre alzada y reposicion es precisamente quien resuelve: alzada = superior, reposicion = el mismo organo.

**Recursos administrativos - Quien resuelve:**

| Recurso | Quien resuelve | Articulo |
|---------|---------------|----------|
| **Alzada** | **Superior jerarquico** | Art. 121 |
| Reposicion | El mismo organo que dicto el acto | Art. 123 |
| Extraordinario de revision | El mismo organo que dicto el acto | Art. 125 |

**Clave:** Alzada = resuelve el **superior**. Reposicion = resuelve el **mismo** organo. No confundir ambos recursos.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "3786df64-4056-4c75-a875-a9addd3d2c10");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 art.121 alzada (" + exp1.length + " chars)");

  // #2 - LCSP art.232.1 clasificación obras - B mezcla conceptos
  const exp2 = `**Articulo 232.1 de la Ley 9/2017 (LCSP) - Clasificacion de obras:**

> Art. 232.1: "Se clasificaran las obras, segun su objeto y naturaleza, en los grupos siguientes:
> a) Obras de **primer establecimiento, reforma, restauracion, rehabilitacion o gran reparacion**.
> b) Obras de **reparacion simple**.
> c) Obras de **conservacion y mantenimiento**.
> d) Obras de **demolicion**."

**Por que B es la respuesta (NO es un grupo de clasificacion):**
La opcion B dice "Obras de **demolicion, reforma o gran reparacion**", mezclando la letra d) (demolicion) con parte de la letra a) (reforma y gran reparacion). Esa combinacion no existe como grupo en el art. 232.1. La demolicion es un grupo separado (letra d), y la reforma y gran reparacion pertenecen a otro grupo distinto (letra a).

**Por que las demas SI son grupos del art. 232.1:**

- **A)** "Obras de **reparacion simple**." **Correcto**: corresponde a la letra b) del art. 232.1. Son obras necesarias para enmendar un menoscabo producido por causas fortuitas o accidentales.

- **C)** "Obras de **primer establecimiento, reforma, restauracion, rehabilitacion o gran reparacion**." **Correcto**: corresponde a la letra a) del art. 232.1. Es el grupo mas amplio, que incluye la creacion de nuevos inmuebles y las obras mayores.

- **D)** "Obras de **conservacion y mantenimiento**." **Correcto**: corresponde a la letra c) del art. 232.1. Son las obras necesarias para mantener el bien inmueble en las condiciones adecuadas para su uso.

**Los 4 grupos de obras (art. 232.1 LCSP):**

| Letra | Grupo |
|-------|-------|
| a) | Primer establecimiento, reforma, restauracion, rehabilitacion o gran reparacion |
| b) | Reparacion simple |
| c) | Conservacion y mantenimiento |
| d) | Demolicion |

**Clave:** La demolicion es un grupo **separado** (letra d). No se mezcla con reforma ni gran reparacion (que estan en la letra a).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "514bb932-eade-42f4-929d-f146e4f1f0b5");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LCSP art.232 clasificacion obras (" + exp2.length + " chars)");

  // #3 - RD 208/1996 art.3.3 información particular por unidades de gestión
  const exp3 = `**Articulo 3.3 del RD 208/1996 - Informacion particular:**

> Art. 3.3: "La informacion particular sera aportada por las **unidades de gestion** de la Administracion General del Estado."

**Por que A es correcta (unidades de gestion):**
El art. 3.3 atribuye la funcion de proporcionar informacion particular (la relativa al estado de procedimientos concretos en tramitacion) a las **unidades de gestion**, que son las que tramitan directamente los expedientes y conocen su estado.

**Por que las demas son incorrectas:**

- **B)** "Unidades de **atencion personalizada** al ciudadano." Falso: las oficinas de atencion personalizada pueden colaborar con las unidades de gestion, pero la responsabilidad principal de aportar la informacion particular corresponde a las unidades de gestion, no a las de atencion personalizada.

- **C)** "Unidades de **direccion**." Falso: las unidades de direccion no son las encargadas de aportar informacion particular. Su funcion es dirigir y coordinar, no gestionar expedientes individuales ni informar sobre su estado.

- **D)** "Unidades de **informacion administrativa**." Falso: las unidades de informacion administrativa se encargan de la **informacion general** (sobre procedimientos, requisitos, horarios, etc.), no de la informacion particular. La informacion particular requiere acceso al expediente concreto, que esta en las unidades de gestion.

**Tipos de informacion administrativa (RD 208/1996):**

| Tipo | Que es | Quien la aporta |
|------|--------|----------------|
| **General** | Requisitos, procedimientos, horarios | Unidades de **informacion administrativa** |
| **Particular** | Estado de expedientes concretos | Unidades de **gestion** |

**Clave:** Informacion particular = unidades de **gestion** (las que tramitan los expedientes). Informacion general = unidades de **informacion administrativa**.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "61d3901c-60cb-4678-80da-80ef504a37ca");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - RD 208/1996 info particular (" + exp3.length + " chars)");
})();
