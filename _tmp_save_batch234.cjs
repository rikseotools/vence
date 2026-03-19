require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.9.3 principios (variante con D correcta)
  const exp1 = `**Articulo 9.3 de la Constitucion Espanola - Principios constitucionales:**

> "La Constitucion garantiza el principio de **legalidad**, la **jerarquia normativa**, la **publicidad de las normas**, la **irretroactividad** de las disposiciones sancionadoras no favorables o restrictivas de derechos individuales, la **seguridad juridica**, la **responsabilidad** y la **interdiccion de la arbitrariedad** de los poderes publicos."

**Por que D es correcta (publicidad, legalidad y responsabilidad):**
Los tres principios de la opcion D (**publicidad de las normas**, **legalidad** y **responsabilidad**) aparecen expresamente entre los 7 principios del art. 9.3 CE. Todos son literales del texto constitucional.

**Por que las demas son incorrectas (incluyen principios ajenos al art. 9.3):**

- **A)** "Jerarquia normativa, **igualdad** y seguridad juridica." Falso: jerarquia normativa y seguridad juridica si estan en el art. 9.3, pero "**igualdad**" no. La igualdad se consagra en el art. 14 CE como derecho fundamental, no como principio del 9.3.

- **B)** "Legalidad, **igualdad** e irretroactividad." Falso: legalidad e irretroactividad si estan en el 9.3, pero "**igualdad**" no, por la misma razon que A.

- **C)** "**Libertad**, seguridad juridica e interdiccion de la arbitrariedad." Falso: seguridad juridica e interdiccion de la arbitrariedad si estan en el 9.3, pero "**libertad**" no es uno de los 7 principios. La libertad es un valor superior del art. 1.1 CE, no un principio del 9.3.

**Los 7 principios del art. 9.3 CE:**

| N.o | Principio |
|-----|-----------|
| 1 | **Legalidad** |
| 2 | **Jerarquia normativa** |
| 3 | **Publicidad de las normas** |
| 4 | **Irretroactividad** (sancionadoras no favorables) |
| 5 | **Seguridad juridica** |
| 6 | **Responsabilidad** |
| 7 | **Interdiccion de la arbitrariedad** |

**NO estan en el 9.3:** libertad, igualdad, justicia, pluralismo politico (art. 1.1 CE = valores superiores).

**Clave:** La trampa clasica es incluir "igualdad" o "libertad" entre los principios del 9.3. Recordar: el art. 9.3 tiene 7 principios y ninguno es "igualdad" ni "libertad".`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "60029e45-64e7-40bb-afb1-ed619e0ecdd3");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.9.3 principios variante (" + exp1.length + " chars)");

  // #2 - CE art.2 autonomía a nacionalidades y regiones
  const exp2 = `**Articulo 2 de la Constitucion Espanola:**

> "La Constitucion [...] reconoce y garantiza el derecho a la autonomia de las **nacionalidades y regiones** que la integran y la solidaridad entre todas ellas."

**Por que A es correcta (nacionalidades y regiones):**
El art. 2 CE reconoce el derecho a la autonomia de las **nacionalidades y regiones**. Estas son las dos palabras literales que usa la Constitucion. Es importante notar que la CE no habla de "Comunidades Autonomas" en este articulo, sino de "nacionalidades y regiones", que es un concepto previo a la constitucion de las CCAA como entidades politico-administrativas.

**Por que las demas son incorrectas (usan terminos diferentes):**

- **B)** "A las **Comunidades Autonomas**." Falso: el art. 2 CE no menciona las "Comunidades Autonomas". Estas se regulan en el Titulo VIII (arts. 143 y ss.), pero el art. 2 usa los terminos "nacionalidades y regiones". Las CCAA son la forma juridica que adoptan las nacionalidades y regiones al ejercer su derecho a la autonomia.

- **C)** "A las **Regiones y Comunidades Autonomas**." Falso: mezcla un termino correcto ("regiones") con uno incorrecto ("Comunidades Autonomas"). El art. 2 dice "nacionalidades y regiones", no "regiones y CCAA".

- **D)** "A las **Provincias y Regiones**." Falso: sustituye "nacionalidades" por "provincias". El art. 2 no menciona las provincias. Las provincias tienen autonomia para la gestion de sus intereses (art. 137 CE), pero el derecho a la autonomia del art. 2 se predica de "nacionalidades y regiones".

**Terminologia del art. 2 CE:**

| Termino en el art. 2 | Lo que NO dice |
|----------------------|----------------|
| **Nacionalidades** | No dice "Comunidades Autonomas" |
| **Regiones** | No dice "Provincias" |

**Clave:** Art. 2 CE = "nacionalidades y regiones" (literal). No confundir con "Comunidades Autonomas" (Titulo VIII) ni con "provincias" (art. 137).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "056ae265-9271-4758-bc53-9d806d35afd3");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.2 nacionalidades regiones (" + exp2.length + " chars)");

  // #3 - CE art.2 "reconoce y garantiza" vs "fundamenta"
  const exp3 = `**Articulo 2 de la Constitucion Espanola:**

> "La Constitucion **se fundamenta** en la indisoluble unidad de la Nacion espanola [...] y **reconoce y garantiza** el derecho a la autonomia de las nacionalidades y regiones que la integran y la solidaridad entre todas ellas."

**Por que A es correcta ("se reconoce y se garantiza"):**
El art. 2 CE utiliza dos verbos para referirse al derecho a la autonomia: **reconoce** y **garantiza**. La opcion A reproduce fielmente esta formulacion. El articulo no dice que la autonomia sea un "fundamento" de la Constitucion, sino que la Constitucion la **reconoce y garantiza**.

**Por que las demas son incorrectas (confunden "fundamentar" con "reconocer/garantizar"):**

- **B)** "Es un **fundamento** de la Constitucion." Falso: lo que **fundamenta** la Constitucion es "la indisoluble unidad de la Nacion espanola". El derecho a la autonomia no es el fundamento, sino algo que la Constitucion **reconoce y garantiza**. La diferencia es crucial: el fundamento (unidad) y el reconocimiento (autonomia) son conceptos distintos dentro del mismo articulo.

- **C)** "Es un **fundamento** de la Constitucion y **se garantiza**." Falso: combina dos verbos de forma incorrecta. El derecho a la autonomia no es un "fundamento" (eso es la unidad nacional). Y aunque si "se garantiza", al anadir "es un fundamento" la opcion se vuelve incorrecta.

- **D)** "Es un **fundamento** de la Constitucion y **se reconoce**." Falso: mismo error que C. El derecho a la autonomia no es un "fundamento" de la Constitucion. Aunque "se reconoce" es parcialmente correcto, la primera parte invalida la opcion.

**Estructura del art. 2 CE:**

| Elemento | Verbo | Contenido |
|----------|-------|-----------|
| Fundamento | "Se **fundamenta** en..." | Unidad de la Nacion espanola |
| Reconocimiento | "**Reconoce y garantiza**..." | Derecho a la autonomia |
| Solidaridad | "...y la **solidaridad**" | Entre nacionalidades y regiones |

**Clave:** La Constitucion se FUNDAMENTA en la unidad. RECONOCE Y GARANTIZA la autonomia. No confundir el fundamento (unidad) con el reconocimiento (autonomia).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "b554d66f-8b94-4a5c-a72a-7c2f25cad5e8");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.2 reconoce y garantiza (" + exp3.length + " chars)");
})();
