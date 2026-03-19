require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Encabezados y pies de pagina en procesadores de texto:**

Un **encabezado** es una zona especial en la parte superior de cada pagina donde se puede insertar texto, imagenes o campos (como numero de pagina, fecha, etc.) que se **repiten automaticamente en todas las paginas** del documento (o de una seccion).

**Por que D es correcta:**
Si el texto "Informacion sobre Sepulveda" se repite en **todas las paginas**, se encuentra en el **encabezado** (o eventualmente en el pie de pagina). El encabezado es el unico elemento disenado para mostrar contenido repetido automaticamente en cada pagina.

**Por que las demas son incorrectas:**

- **A)** "Seccion". Una seccion es una division del documento que permite aplicar formatos diferentes (orientacion, margenes, columnas) a distintas partes. No es una ubicacion donde se coloca texto repetitivo. Las secciones contienen encabezados, pero no son encabezados.

- **B)** "Tabulacion". Una tabulacion es un punto de alineacion dentro de un parrafo (tabulador). Sirve para alinear texto en columnas dentro del cuerpo del documento. No tiene relacion con la repeticion de texto en todas las paginas.

- **C)** "Justificado". Es un tipo de **alineacion de parrafo** (junto con izquierda, centrada y derecha). El texto justificado se extiende de margen a margen. Es un formato visual, no una ubicacion del documento.

**Clave:** Si un texto aparece en todas las paginas, esta en el encabezado o pie de pagina. Se accede desde **Insertar > Encabezado y pie de pagina** (Word) o **Insertar > Encabezamiento y pie de pagina** (LibreOffice Writer).`;

  const { error } = await supabase.from("questions").update({ explanation }).eq("id", "1bf4604f-8d24-4377-a702-e8ba71f1b415");
  if (error) console.error("Error:", error);
  else console.log("OK - Procesadores texto encabezado (" + explanation.length + " chars)");
})();
