require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Articulo 598.9 de la LO 6/1985 (LOPJ)** (Competencias de la Presidencia del CGPJ):

> **598.9:** "Realizar la propuesta del Magistrado, de las Salas Segunda o Tercera del Tribunal Supremo, **competente para conocer de la autorizacion** de las actividades del Centro Nacional de Inteligencia que afecten a los derechos fundamentales reconocidos en el **articulo 18.2 y 3** de la Constitucion."

Los derechos afectados son:
- **Art. 18.2 CE:** Inviolabilidad del domicilio (entrada y registro)
- **Art. 18.3 CE:** Secreto de las comunicaciones (postales, telefonicas, telegraficas)

**Por que D es correcta:**
El competente es **un Magistrado del Tribunal Supremo** (de la Sala 2a -Penal- o 3a -Contencioso-Administrativo-), propuesto por el Presidente del CGPJ. Es un Magistrado individual, no un organo colegiado ni el Presidente.

**Por que las demas son incorrectas:**

- **A)** "Un Juzgado de lo Contencioso-Administrativo". Falso: los Juzgados de lo Contencioso son organos de primera instancia. Para las actividades del CNI que afectan a derechos fundamentales, la competencia esta atribuida a un nivel mucho mas alto: el Tribunal Supremo.

- **B)** "El Presidente del Tribunal Supremo y del CGPJ". Falso: el Presidente **propone** al Magistrado competente (art. 598.9), pero no es el quien autoriza las actividades. Hay que distinguir entre quien propone y quien decide.

- **C)** "El Consejo de Ministros". Falso: se trata de una autorizacion judicial, no gubernativa. Aunque el CNI depende del Gobierno, cuando sus actividades afectan a derechos fundamentales del art. 18 CE, necesitan autorizacion **judicial**, no politica.

**Clave para recordar:**
- CNI + derechos del art. 18.2 y 18.3 CE = autorizacion de un **Magistrado del TS**
- El Presidente del CGPJ solo **propone**, no autoriza`;

  const { error } = await supabase.from("questions").update({ explanation }).eq("id", "5f20bc12-0aaa-48ec-abdd-6ca20ecdbcc1");
  if (error) console.error("Error:", error);
  else console.log("OK - LOPJ art.598 CNI (" + explanation.length + " chars)");
})();
