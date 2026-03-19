require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Secciones y orientacion de pagina en Word:**

En Word, las **secciones** permiten que distintas partes de un documento tengan configuraciones de pagina independientes (margenes, orientacion, encabezados, etc.). Cada seccion puede tener su propia orientacion sin afectar a las demas.

**Por que A es correcta:**
Si cambiamos la orientacion en la segunda seccion (por ejemplo, de vertical a horizontal), **solo esa seccion adopta la nueva orientacion**. Las demas secciones no se ven afectadas. Ademas, si no se ha desvinculado la opcion "Vincular al anterior" en los encabezados/pies de pagina, estos **se mantienen iguales** a los de la seccion anterior aunque la orientacion sea diferente.

**Por que las demas son incorrectas:**

- **B)** "La orientacion solo afecta al contenido, no a los margenes". Falso: cambiar la orientacion afecta a **toda la pagina**, incluyendo los margenes. Al pasar de vertical a horizontal, los margenes se adaptan a la nueva disposicion de la pagina.

- **C)** "Todas las secciones cambian automaticamente a la misma orientacion". Falso: ese es precisamente el proposito de las secciones. Si todas cambiaran juntas, no tendria sentido dividir el documento en secciones. Cada seccion es independiente.

- **D)** "Word obliga a desvincular los encabezados antes de aplicar la orientacion". Falso: Word permite cambiar la orientacion sin desvincular encabezados. La desvinculacion es opcional y solo necesaria si se quieren encabezados **diferentes** en cada seccion.

**Clave:** Seccion = configuracion de pagina independiente. Cambiar orientacion en una seccion no afecta a las demas. Los encabezados vinculados se mantienen aunque cambie la orientacion.`;

  const { error } = await supabase.from("questions").update({ explanation }).eq("id", "38d7d19f-be6d-4f89-bf5c-f5fc73152a69");
  if (error) console.error("Error:", error);
  else console.log("OK - Word secciones orientacion (" + explanation.length + " chars)");
})();
