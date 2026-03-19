require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.17.4 habeas corpus puesta disposicion judicial detenida ilegalmente
  const exp1 = `**Articulo 17.4 de la Constitucion Espanola:**

> "La ley regulara un procedimiento de **habeas corpus** para producir la **inmediata puesta a disposicion judicial** de toda persona **detenida ilegalmente**."

**Por que A es correcta:**
El habeas corpus tiene una finalidad muy concreta: que un juez controle inmediatamente la legalidad de una detencion. Solo se activa cuando la detencion es **ilegal**. El resultado es la puesta a disposicion **judicial** (no necesariamente la libertad: el juez decidira si libera o mantiene la detencion).

**Por que las demas son incorrectas (cada una confunde el habeas corpus con otro apartado del art. 17):**

- **B)** "Establecer la duracion maxima que puede tener la detencion preventiva". Falso: esto no es el habeas corpus, sino el contenido del art. **17.2** CE (la detencion preventiva no durara mas de **72 horas**). El habeas corpus no fija plazos, sino que controla la legalidad de la detencion.

- **C)** "Establecer el derecho a ser informada de sus derechos y de las razones de su detencion". Falso: esto es el contenido del art. **17.3** CE (derecho a informacion y asistencia letrada). El habeas corpus no se ocupa de informar al detenido, sino de controlar judicialmente su situacion.

- **D)** "Establecer la inmediata puesta en libertad, o a disposicion judicial, de toda persona detenida". Falso: esta opcion es muy parecida a A pero tiene dos errores: (1) anade "puesta en libertad **o** a disposicion judicial", mezclando el habeas corpus con la regla de las 72 horas del art. 17.2; (2) dice "toda persona detenida" sin el adjetivo "**ilegalmente**". El habeas corpus solo procede contra detenciones **ilegales**, no contra cualquier detencion.

**Los 4 apartados del art. 17 CE:**

| Apartado | Contenido |
|----------|-----------|
| 17.1 | Derecho a la libertad y seguridad |
| 17.2 | Detencion preventiva: max **72 horas** |
| 17.3 | Derecho a **informacion** y **abogado** |
| **17.4** | **Habeas corpus**: disposicion judicial si detencion **ilegal** |

**Clave:** Habeas corpus = disposicion judicial + detenida **ilegalmente**. No confundir con las 72 horas (17.2) ni con los derechos del detenido (17.3).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "579cc486-58f7-462e-9e56-dd4c5a4b9ded");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.17.4 habeas corpus (" + exp1.length + " chars)");
})();
