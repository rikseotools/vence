require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - TREBEP art.20.3 evaluacion desempeno retribuciones basicas incorrecta
  const exp1 = `**Articulo 20.3 del TREBEP (RDL 5/2015):**

> "Las Administraciones Publicas determinaran los efectos de la evaluacion en la **carrera profesional horizontal**, la **formacion**, la **provision de puestos de trabajo** y en la percepcion de las **retribuciones complementarias** previstas en el articulo 24 del presente Estatuto."

**Por que D es la incorrecta (y por tanto la respuesta):**
La opcion D dice "retribuciones **basicas**". Pero el art. 20.3 dice "retribuciones **complementarias**" (las del art. 24 TREBEP). La evaluacion del desempeno afecta a las **complementarias** (complemento de desempeno, productividad), no a las **basicas** (sueldo base y trienios del art. 22), que dependen del grupo/subgrupo y la antiguedad, no del rendimiento.

**Por que las demas SI estan en el art. 20.3:**

- **A)** "Provision de puestos de trabajo". **SI**: es uno de los cuatro efectos listados en el art. 20.3. La evaluacion puede influir en los concursos y provisiones.

- **B)** "Carrera profesional horizontal". **SI**: es el primer efecto listado. La evaluacion del desempeno es requisito para la progresion en la carrera horizontal.

- **C)** "Formacion". **SI**: es el segundo efecto listado. La evaluacion puede determinar necesidades formativas o el acceso a formacion.

**Los 4 efectos de la evaluacion del desempeno (art. 20.3):**
1. Carrera profesional **horizontal**
2. **Formacion**
3. **Provision** de puestos de trabajo
4. Retribuciones **complementarias** (art. 24)

**Clave:** "Complementarias" (no "basicas"). Las retribuciones basicas (sueldo y trienios) no dependen de la evaluacion del desempeno sino del grupo y la antiguedad.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "24774d69-e50d-4be7-97e5-8a887bccc7b6");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - TREBEP art.20.3 evaluacion (" + exp1.length + " chars)");

  // #2 - CE art.138 solidaridad equilibrio economico
  const exp2 = `**Articulo 138.1 de la Constitucion Espanola:**

> "El Estado garantiza la realizacion efectiva del principio de **solidaridad** consagrado en el articulo 2 de la Constitucion, velando por el establecimiento de un **equilibrio economico, adecuado y justo** entre las diversas partes del territorio espanol, y atendiendo en particular a las circunstancias del hecho insular."

**Por que B es correcta (solidaridad):**
El art. 138.1 CE desarrolla el principio de **solidaridad** del art. 2 CE. El mecanismo concreto para garantizar la solidaridad es el "equilibrio economico, adecuado y justo" entre territorios. La solidaridad interterritorial es un principio estructural del Estado autonomico que busca que unas regiones no se desarrollen a costa de otras.

**Por que las demas son incorrectas:**

- **A)** "Igualdad". Falso: aunque el equilibrio economico suena a igualdad, el art. 138.1 dice expresamente "principio de **solidaridad**", no de igualdad. La igualdad entre espanoles se recoge en el art. 139.1 CE ("todos los espanoles tienen los mismos derechos y obligaciones en cualquier parte del territorio"), que es un articulo diferente.

- **C)** "Justicia". Falso: la justicia es uno de los **valores superiores** del art. 1.1 CE (libertad, justicia, igualdad, pluralismo politico), pero no es el principio que garantiza el art. 138. Aunque la expresion "equilibrio justo" contiene la palabra "justo", el principio garantizado es la solidaridad.

- **D)** "Seguridad". Falso: la seguridad juridica es una garantia del art. 9.3 CE, y la seguridad ciudadana del art. 104 CE. Ninguna tiene relacion con el equilibrio economico territorial del art. 138.

**Solidaridad territorial en la CE:**
- Art. 2: principio de solidaridad entre nacionalidades y regiones
- Art. **138.1**: equilibrio economico para garantizar solidaridad
- Art. 138.2: diferencias entre Estatutos no implican privilegios
- Art. 158.2: Fondo de Compensacion Interterritorial (instrumento concreto)

**Clave:** Equilibrio economico territorial = principio de **solidaridad** (no igualdad, no justicia).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "bfcdbd77-8682-4fe0-9d2e-a3954c13110f");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.138 solidaridad (" + exp2.length + " chars)");
})();
