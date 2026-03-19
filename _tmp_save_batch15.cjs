require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 40/2015 art.4 proporcionalidad
  const exp1 = `**Articulo 4.1 de la Ley 40/2015** (Principios de intervencion):

> "Las Administraciones Publicas que [...] establezcan medidas que limiten el ejercicio de derechos individuales [...] deberan aplicar el **principio de proporcionalidad** y elegir la **medida menos restrictiva**, **motivar su necesidad** para la proteccion del interes publico asi como **justificar su adecuacion** para lograr los fines que se persiguen."

**Por que B es correcta:**
La opcion B recoge fielmente los tres requisitos del art. 4.1: (1) motivar la necesidad de la medida, (2) justificar que es adecuada para el fin perseguido, y (3) elegir la menos restrictiva. Es el principio de proporcionalidad aplicado a la actividad administrativa.

**Por que las demas son incorrectas:**

- **A)** "Principios de eficacia, eficiencia y economia". Estos son principios presupuestarios y de gestion (art. 7 Ley 47/2003 LGP), no los que rigen la limitacion de derechos. El art. 4 exige proporcionalidad, necesidad y adecuacion.

- **C)** "Acuerdo motivado tras comprobar, verificar, investigar e inspeccionar". Describe una actividad de inspeccion o comprobacion (mas propia del art. 18 de la Ley 39/2015 sobre comprobacion e investigacion), no el criterio para elegir entre medidas restrictivas.

- **D)** "Cualquier medida, sin discriminacion". Falso: no puede optar por "cualquier" medida. El art. 4.1 obliga a elegir la **menos restrictiva**. La no discriminacion es un requisito adicional, pero no sustituye la obligacion de proporcionalidad.

**Triple test del art. 4.1:** Necesidad + Adecuacion + Menor restriccion.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "a8024178-27ff-4ad6-9aca-1a98d0b7c4a6");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 40/2015 art.4 proporcionalidad (" + exp1.length + " chars)");

  // #2 - CE art.105 acceso archivos incorrecta
  const exp2 = `**Articulo 105.b) de la Constitucion Espanola:**

> "La ley regulara [...] el acceso de los ciudadanos a los archivos y registros administrativos, **salvo** en lo que afecte a la **seguridad y defensa del Estado**, la **averiguacion de los delitos** y la **intimidad de las personas**."

**Por que C es la INCORRECTA:**
"La gestion publica" NO aparece como excepcion en el art. 105.b). Las unicas tres excepciones al acceso son: (1) seguridad y defensa del Estado, (2) averiguacion de delitos, y (3) intimidad de las personas. Son solo tres, y hay que memorizarlas.

**Por que las demas son correctas (SI son excepciones):**

- **A)** "Averiguacion de los delitos". SI es excepcion: el art. 105.b) la menciona expresamente. Logico: no se puede dar acceso a informacion que pueda entorpecer una investigacion penal.

- **B)** "Seguridad y defensa del Estado". SI es excepcion: el art. 105.b) la menciona expresamente. Protege informacion clasificada y de defensa nacional.

- **D)** "Intimidad de las personas". SI es excepcion: el art. 105.b) la menciona expresamente. Protege datos personales e intimidad (conecta con el art. 18 CE).

**Las 3 excepciones del art. 105.b):**
1. Seguridad y defensa del Estado
2. Averiguacion de los delitos
3. Intimidad de las personas

**Truco:** "Gestion publica" suena plausible pero no esta en la lista. El acceso a archivos es la regla general; las excepciones son solo tres y tasadas.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "f53cf40a-29f0-4d1c-9e5b-a6ec24804703");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.105 archivos (" + exp2.length + " chars)");

  // #3 - Ley 50/1997 art.15 suplencia Secretarios Estado
  const exp3 = `**Articulo 15 de la Ley 50/1997** (Suplencia de los Secretarios de Estado):

> "La suplencia de los Secretarios de Estado se determinara segun el **orden de precedencia** que se derive del **Real Decreto de estructura organica** del Ministerio."

**Por que A es correcta:**
El art. 15 establece un criterio claro: la suplencia sigue el orden de precedencia del RD de estructura organica del Ministerio. No designa un organo concreto como suplente, sino que remite al organigrama ministerial.

**Por que las demas son incorrectas:**

- **B)** "Suplidos por los Subsecretarios del Departamento". Falso: aunque el Subsecretario es un alto cargo del Ministerio, el art. 15 no le asigna automaticamente la suplencia. El criterio es el orden de precedencia del RD de estructura, que puede variar segun el Ministerio.

- **C)** "Suplidos por el Ministro del Departamento". Falso: el Ministro es el superior jerarquico del Secretario de Estado, no su suplente. La suplencia opera entre organos del mismo rango o inferior, no hacia arriba en la jerarquia.

- **D)** "Nombrados y separados por RD del Presidente del Gobierno". Aunque esta afirmacion es verdadera (art. 14 Ley 50/1997), **no responde a la pregunta** sobre suplencia. La pregunta es sobre quien suple al Secretario de Estado, no sobre su nombramiento.

**Clave:** Suplencia de Secretarios de Estado = orden de precedencia del RD de estructura organica del Ministerio.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "614ab88d-8fc2-4637-9401-d5110df5c116");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Ley 50/1997 art.15 suplencia (" + exp3.length + " chars)");
})();
