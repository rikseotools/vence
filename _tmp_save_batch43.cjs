require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LBRL art.121 plazo 6 meses gran poblacion
  const exp1 = `**Articulo 121.2 de la Ley 7/1985 (LBRL)** - Municipios de gran poblacion:

> "Cuando un municipio [...] alcance la poblacion requerida [...], la nueva corporacion dispondra de un plazo maximo de **seis meses** desde su constitucion para adaptar su organizacion al contenido de las disposiciones de este Titulo."

**Por que A es correcta (6 meses):**
El art. 121.2 LBRL establece un plazo maximo de **6 meses** desde la constitucion de la nueva corporacion para que el municipio adapte su organizacion al regimen de gran poblacion (Titulo X LBRL). Este plazo empieza a contar desde la constitucion del Ayuntamiento, no desde que se alcanza la poblacion.

**Por que las demas son incorrectas:**

- **B)** "3 meses". Falso: el plazo es de 6 meses, no 3. Tres meses seria un plazo excesivamente corto para reorganizar la estructura municipal.

- **C)** "12 meses". Falso: el plazo es de 6 meses, no 12 (un ano).

- **D)** "10 meses". Falso: el plazo es de 6 meses, no 10.

**Municipios de gran poblacion (art. 121 LBRL):**
- Mas de 250.000 habitantes
- Capitales de provincia con mas de 175.000 hab.
- Capitales de provincia, autonomicas o sedes de instituciones autonomicas
- Mas de 75.000 hab. con circunstancias especiales (aprobado por las Cortes)
- **Plazo de adaptacion: 6 meses**`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "d9c72ecc-03b4-4c44-9e2f-09a0e5789c72");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LBRL art.121 gran poblacion (" + exp1.length + " chars)");

  // #2 - CE art.167 reforma mayoria de edad - 3/5
  const exp2 = `**Articulo 12 de la CE:** "Los espanoles son mayores de edad a los **dieciocho anos**."

**La clave esta en DONDE se ubica el art. 12 dentro de la Constitucion:**

| Parte de la CE | Procedimiento de reforma | Mayoria |
|----------------|------------------------|---------|
| Titulo Preliminar (arts. 1-9) | **Agravado** (art. 168) | **2/3** + disolucion + referendum |
| Titulo I, Cap. II, Seccion 1a (arts. 15-29) | **Agravado** (art. 168) | **2/3** + disolucion + referendum |
| Titulo II - La Corona (arts. 56-65) | **Agravado** (art. 168) | **2/3** + disolucion + referendum |
| **Resto de la CE** | **Ordinario** (art. 167) | **3/5** |

**Por que D es correcta (3/5):**
El art. 12 CE (mayoria de edad) esta en el **Capitulo I** del Titulo I ("De los espanoles y los extranjeros", arts. 11-13). Este Capitulo **NO** esta protegido por el procedimiento agravado del art. 168, que solo cubre el Capitulo II, Seccion 1a. Por tanto, su reforma sigue el procedimiento **ordinario** del art. 167: **mayoria de 3/5** de cada Camara.

**Por que las demas son incorrectas:**

- **A)** "Mayoria simple". Falso: la reforma constitucional nunca se aprueba por mayoria simple. El minimo es 3/5 (art. 167).

- **B)** "Mayoria de 2/3". Falso: seria necesaria 2/3 si el art. 12 estuviera en el Titulo Preliminar, la Seccion 1a del Cap. II del Titulo I, o el Titulo II. Pero el art. 12 esta en el Capitulo I del Titulo I, que usa el procedimiento ordinario.

- **C)** "Mayoria absoluta". Falso como requisito principal. La mayoria absoluta solo aparece como alternativa subsidiaria en el art. 167.2 (si no se logra 3/5, y solo en el Senado, con 2/3 del Congreso).

**Clave:** No confundir Capitulo I (arts. 11-13, reforma ordinaria 3/5) con Capitulo II Seccion 1a (arts. 15-29, reforma agravada 2/3).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "3bb5925b-3e51-4593-9870-aa081939ed9a");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.167 reforma mayoria edad (" + exp2.length + " chars)");
})();
