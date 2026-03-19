require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.1.2 especialidades reglamentarias
  const exp1 = `**Articulo 1.2 de la Ley 39/2015:**

> "**Solo mediante ley** [...] podran incluirse tramites adicionales o distintos a los contemplados en esta Ley. **Reglamentariamente** podran establecerse especialidades del procedimiento referidas a los **organos competentes**, **plazos** propios del concreto procedimiento por razon de la **materia**, **formas de iniciacion y terminacion**, **publicacion** e **informes** a recabar."

**Por que B es correcta:**
"Formas de iniciacion y terminacion, publicacion e informes a recabar" son todos elementos que **SI** pueden establecerse por **reglamento**. Son un subconjunto de las especialidades que el art. 1.2 permite regular reglamentariamente.

**Por que las demas son incorrectas:**

- **A)** "Tramites adicionales o distintos a los contemplados en la Ley". Falso: los tramites adicionales o distintos **solo pueden establecerse por ley**, no por reglamento. El art. 1.2 lo dice expresamente: "solo mediante ley". La trampa confunde lo que es reglamentario con lo que es legal.

- **C)** "Organos competentes y tramites adicionales o distintos". Falso: mezcla algo que SI es reglamentario (organos competentes) con algo que solo puede ser por ley (tramites adicionales). La mitad de la opcion es correcta, la otra mitad no.

- **D)** "Plazos por razon del **territorio**". Falso: el art. 1.2 dice "plazos propios del concreto procedimiento por razon de la **materia**", no del "territorio". La trampa es cambiar "materia" por "territorio".

**Lo que puede regularse por reglamento (art. 1.2):**
- Organos competentes
- Plazos por razon de la **materia** (no territorio)
- Formas de iniciacion y terminacion
- Publicacion
- Informes a recabar

**Lo que requiere LEY:** tramites adicionales o distintos.

**Clave:** Reglamento = organos, plazos, formas, publicacion, informes. Tramites nuevos = solo por **ley**.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "54d20f0a-cfac-4389-8bbc-ff633b3eb608");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 especialidades reglamento (" + exp1.length + " chars)");

  // #2 - CE art.13.3 extradicion delitos politicos
  const exp2 = `**Articulo 13.3 de la Constitucion Espanola:**

> "La extradicion solo se concedera en cumplimiento de un tratado o de la ley, atendiendo al principio de reciprocidad. Quedan excluidos de la extradicion los **delitos politicos**, no considerandose como tales los **actos de terrorismo**."

**Por que B es correcta (delitos politicos):**
Los **delitos politicos** son los unicos excluidos de la extradicion por la CE. Esto responde a una tradicion constitucional que protege a quienes son perseguidos por razones politicas (exiliados, disidentes). Sin embargo, el articulo anade una excepcion importante: los actos de terrorismo **nunca** se consideran delitos politicos, por lo que SI son extraditables.

**Por que las demas son incorrectas:**

- **A)** "Delitos de genocidio". Falso: el genocidio no esta excluido de la extradicion. Al contrario, los tratados internacionales obligan a la cooperacion en la persecucion del genocidio.

- **C)** "Delitos de asociacion ilicita". Falso: la asociacion ilicita es un delito comun del Codigo Penal, no un delito politico. No tiene ninguna exclusion de extradicion.

- **D)** "Delitos de terrorismo". Falso y trampa frecuente: el art. 13.3 CE dice expresamente que los actos de terrorismo **NO se consideran delitos politicos**. Por tanto, el terrorismo NO esta excluido de la extradicion. Esta es la trampa mas importante de la pregunta.

**Extradicion (art. 13.3 CE):**
- Requisitos: tratado o ley + reciprocidad
- Excluidos: **delitos politicos**
- Pero el terrorismo **NO** es delito politico (si extraditable)

**Clave:** Delitos politicos = excluidos de extradicion. Terrorismo = **NO** es delito politico (es extraditable).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "1a2a2165-8a5b-412c-9f7c-72bcd5655ee1");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.13.3 extradicion (" + exp2.length + " chars)");

  // #3 - CE art.4.1 bandera de Espana
  const exp3 = `**Articulo 4.1 de la Constitucion Espanola:**

> "La bandera de Espana esta formada por tres franjas horizontales, **roja, amarilla y roja**, siendo la **amarilla de doble anchura** que cada una de las rojas."

**Por que D es correcta:**
La bandera tiene el orden **roja-amarilla-roja** (no amarilla-roja-amarilla), y la franja **amarilla** (central) es de **doble anchura** que cada una de las rojas. Es decir, si las rojas miden X, la amarilla mide 2X.

**Por que las demas son incorrectas (cada una invierte un elemento):**

- **A)** "Amarilla, roja y amarilla, siendo las amarillas de doble anchura". Doble error: invierte el **orden** de los colores (pone amarilla-roja-amarilla en vez de roja-amarilla-roja) e invierte la **anchura** (dice que las amarillas son de doble anchura).

- **B)** "Amarilla, roja y amarilla, siendo la roja de doble anchura". Error en el **orden** (amarilla-roja-amarilla). Aunque la anchura ("la roja de doble anchura") tambien es incorrecta porque la ancha es la amarilla.

- **C)** "Roja, amarilla y roja, siendo las rojas de doble anchura". El orden es correcto (roja-amarilla-roja) pero invierte la **anchura**: dice que las rojas son de doble anchura cuando es la **amarilla** la de doble anchura.

**La bandera de Espana (art. 4.1 CE):**
- Tres franjas **horizontales**
- Orden: **roja** - **amarilla** - **roja**
- Franja ancha: la **amarilla** (central) = doble anchura que cada roja

**Clave:** Roja-amarilla-roja, con la **amarilla** de doble anchura. Las trampas invierten el orden de colores o la franja ancha.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "547082cd-a5e7-497f-9bc7-132fd751fea0");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.4.1 bandera (" + exp3.length + " chars)");
})();
