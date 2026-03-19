require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.1 valores superiores (democracia no es valor)
  const exp1 = `**Articulo 1.1 de la Constitucion Espanola:**

> "Espana se constituye en un Estado social y democratico de Derecho, que propugna como valores superiores de su ordenamiento juridico la **libertad**, la **justicia**, la **igualdad** y el **pluralismo politico**."

**Por que C es la INCORRECTA:**
"Democracia" NO es uno de los cuatro valores superiores del art. 1.1 CE. La palabra "democratico" aparece en el articulo, pero como adjetivo del tipo de Estado ("Estado social y **democratico** de Derecho"), no como valor superior del ordenamiento juridico.

**Los cuatro valores superiores son exactamente:**
1. Libertad
2. Justicia
3. Igualdad
4. Pluralismo politico

**Por que las demas son correctas (SI son valores superiores):**

- **A)** "Libertad". SI: es el primer valor superior enumerado en el art. 1.1.
- **B)** "Justicia". SI: es el segundo valor superior enumerado en el art. 1.1.
- **D)** "Igualdad". SI: es el tercer valor superior enumerado en el art. 1.1.

**Truco de examen:** Esta pregunta explota la confusion entre "Estado democratico" (forma de Estado) y los valores superiores (libertad, justicia, igualdad, pluralismo politico). "Democracia" o "democratico" esta en el articulo, pero no como valor superior. El cuarto valor es "pluralismo politico", no "democracia".`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "a98aea34-eb97-43c8-965f-4eeb38e64323");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.1 valores democracia (" + exp1.length + " chars)");

  // #2 - RD 203/2021 art.30 funcionario habilitado
  const exp2 = `**Articulo 30.1 del RD 203/2021** (Funcionario publico habilitado):

> "El funcionario habilitado **entregara al interesado toda la documentacion acreditativa** del tramite realizado, asi como una **copia del documento de consentimiento expreso** cumplimentado y firmado, cuyo formulario estara disponible en el **Punto de Acceso General Electronico** de la respectiva Administracion."

**Por que C es correcta:**
La opcion C reproduce fielmente lo que el art. 30.1 obliga a hacer al funcionario habilitado: entregar documentacion acreditativa del tramite + copia del consentimiento expreso firmado, disponible en el PAGe.

**Por que las demas son incorrectas:**

- **A)** Mezcla conceptos de sede electronica (art. 11 - informacion visible, sello electronico) con la funcion del funcionario habilitado. El funcionario no "aporta informacion obligatoria de la sede" ni "facilita verificacion de sello electronico"; eso corresponde a la propia sede.

- **B)** Mezcla conceptos del Esquema Nacional de Interoperabilidad y certificados cualificados de autenticacion (art. 9 RD 203/2021) con la funcion del funcionario habilitado. El funcionario usa su propio sistema de firma para actuar en nombre del interesado, no le "da acceso a sistemas de identificacion".

- **D)** Describe funciones de gestion tecnica y regulacion ("determinar actuaciones y procedimientos validos", "caracteristicas tecnicas del sistema") que corresponden a la Administracion como organizacion, no al funcionario habilitado en el acto de asistir al interesado.

**Proceso del art. 30.1:**
1. El interesado se identifica ante el funcionario
2. Presta consentimiento expreso (constancia escrita)
3. El funcionario firma electronicamente en su nombre
4. Entrega documentacion + copia del consentimiento`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "1bf4961c-8591-4598-b5c5-55429fc1effb");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - RD 203/2021 art.30 funcionario (" + exp2.length + " chars)");
})();
