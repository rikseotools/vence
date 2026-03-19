require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 40/2015 art.38.2 sede electrónica responsabilidad actualización
  const exp1 = `**Articulo 38.2 de la Ley 40/2015 (LRJSP) - Sede electronica:**

> "El establecimiento de una sede electronica conlleva la responsabilidad del titular respecto de la **integridad**, **veracidad** y **actualizacion** de la informacion y los servicios a los que pueda accederse a traves de la misma."

**Por que C es correcta (actualizacion):**
El art. 38.2 enumera **tres** responsabilidades del titular de la sede electronica: integridad, veracidad y **actualizacion**. La opcion C recoge la tercera de ellas. Actualizar significa mantener la informacion al dia y vigente.

**Por que las demas son incorrectas (sustituyen terminos del articulo):**

- **A)** "**Validez** de la informacion". Falso: el art. 38.2 dice "**veracidad**", no "validez". Aunque suenen parecidos, son conceptos diferentes. Veracidad = que la informacion sea cierta. Validez = que tenga efectos juridicos. La ley exige veracidad.

- **B)** "**Seguridad** de la informacion". Falso: el art. 38.2 dice "**integridad**", no "seguridad". La integridad se refiere a que la informacion no sea alterada o corrompida. La seguridad es un concepto mas amplio que no aparece en este articulo (aunque se regula en otros, como el Esquema Nacional de Seguridad).

- **D)** "**Simplicidad** de la informacion". Falso: "simplicidad" no aparece en el art. 38.2. El articulo exige integridad, veracidad y actualizacion, no simplicidad.

**Las 3 responsabilidades del titular de la sede electronica (art. 38.2):**
1. **Integridad** (que no se altere la informacion)
2. **Veracidad** (que sea cierta)
3. **Actualizacion** (que este al dia)

**Clave:** Integridad, veracidad y actualizacion. No confundir con "validez" (no es veracidad), "seguridad" (no es integridad) ni "simplicidad" (no existe en el articulo).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "355c7955-a154-4bf2-ab97-20b1a55847d9");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 40/2015 art.38 sede electronica (" + exp1.length + " chars)");

  // #2 - Windows búsqueda clase:=carpeta word
  const exp2 = `**Busqueda avanzada en el Explorador de archivos de Windows - Filtro "clase":**

**Por que D es correcta (clase:=carpeta word):**
El filtro **clase:** permite especificar el **tipo de elemento** que se busca. Para buscar **carpetas** que contengan "Word" en su nombre, se escribe **clase:=carpeta word**. Esto limita los resultados a elementos de tipo "carpeta", excluyendo archivos.

**Sintaxis:** clase:=tipo_de_elemento termino_de_busqueda

**Por que las demas son incorrectas (usan clases diferentes):**

- **A)** "clase:=**programa** word". Falso: **clase:=programa** busca archivos ejecutables o aplicaciones que contengan "word" en su nombre, no carpetas. Devolveria archivos como "Word.exe", no carpetas.

- **B)** "clase:=**fuente** word". Falso: **clase:=fuente** busca archivos de tipografia/fuentes (como .ttf, .otf) que contengan "word" en su nombre. No busca carpetas.

- **C)** "clase:=**desconocido** word". Falso: **clase:=desconocido** busca archivos de tipo no reconocido por Windows. No busca carpetas.

**Algunas clases disponibles en el Explorador de Windows:**

| Clase | Que busca |
|-------|-----------|
| **carpeta** | **Carpetas/directorios** |
| documento | Archivos de documentos |
| imagen | Archivos de imagen |
| musica | Archivos de audio |
| video | Archivos de video |
| programa | Aplicaciones/ejecutables |
| fuente | Archivos de tipografia |

**Clave:** Para buscar carpetas = **clase:=carpeta**. No confundir con "programa" (ejecutables), "fuente" (tipografias) ni "desconocido" (archivos no reconocidos).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "d73b38d8-a097-4074-94a2-7678df74c152");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Windows clase carpeta busqueda (" + exp2.length + " chars)");
})();
