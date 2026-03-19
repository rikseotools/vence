require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - RD 1708/2011 art.11 AGA es archivo intermedio
  const exp1 = `**Articulo 11 del RD 1708/2011:**

> "El Archivo General de la Administracion, es el **archivo intermedio** de la Administracion General del Estado, segun la normativa vigente."

**Por que D es correcta (archivo intermedio):**
El AGA (Archivo General de la Administracion, ubicado en Alcala de Henares) es el **archivo intermedio** de la AGE. Custodia los documentos que ya no estan en fase activa pero que aun no han alcanzado su valor historico. Los documentos llegan al AGA desde los archivos centrales de los ministerios y permanecen alli hasta que se decide su conservacion permanente (pasan al Archivo Historico Nacional) o su eliminacion.

**Por que las demas son incorrectas (confunden los tipos de archivo):**

- **A)** "El archivo **historico** de la AGE". Falso: el archivo historico de la AGE es el **Archivo Historico Nacional** (AHN), no el AGA. El AHN custodia documentos de conservacion permanente con valor historico, investigativo y cultural.

- **B)** "El archivo general o **central** de los Ministerios". Falso: los archivos centrales son propios de cada ministerio (art. 10 RD 1708/2011). Cada ministerio tiene su propio archivo central. El AGA recibe documentos de todos los archivos centrales ministeriales, pero no es un archivo central.

- **C)** "El archivo de **oficina o de gestion** de la AGE". Falso: los archivos de oficina o gestion son los de cada unidad administrativa (art. 9 RD 1708/2011). Son la primera fase del ciclo documental, donde los documentos estan en uso diario.

**Sistema de Archivos de la AGE (ciclo vital):**

| Fase | Archivo | Ejemplo |
|------|---------|---------|
| 1. Gestion | Archivo de oficina | Cada unidad administrativa |
| 2. Central | Archivo central | Uno por ministerio |
| 3. **Intermedio** | **AGA** (Alcala de Henares) | Unico para toda la AGE |
| 4. Historico | Archivo Historico Nacional | Conservacion permanente |

**Clave:** AGA = archivo **intermedio** (no historico, no central, no de gestion).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "1a7bf717-c2b5-4be7-b65b-a3196b876c08");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - RD 1708/2011 AGA intermedio (" + exp1.length + " chars)");

  // #2 - LBRL art.16 padron municipal vecindad civil no obligatoria
  const exp2 = `**Articulo 16.2 de la LBRL (Ley 7/1985):**

> "La inscripcion en el Padron municipal contendra como obligatorios **solo** los siguientes datos: a) Nombre y apellidos. b) Sexo. c) Domicilio habitual. d) Nacionalidad. e) Lugar y fecha de nacimiento. f) Numero de DNI o documento equivalente para extranjeros. g) Certificado o titulo escolar o academico. h) Datos necesarios para el Censo Electoral."

**Por que D es la incorrecta (y por tanto la respuesta):**
La opcion D dice que "la **vecindad civil** debe constar obligatoriamente". Pero la vecindad civil (que determina el derecho foral aplicable: derecho comun, catalan, aragones, etc.) **no aparece** en la lista cerrada del art. 16.2 LBRL. La palabra "solo" indica que la lista es taxativa: no se puede exigir ningun dato adicional como obligatorio.

**Por que las demas SI son correctas:**

- **A)** "Es un registro administrativo". **SI**: el art. 16.1 lo define expresamente como "registro administrativo donde constan los vecinos de un municipio".

- **B)** "La inscripcion solo surtira efecto por el tiempo que subsista el hecho que la motivo". **SI**: el art. 16.1 lo establece expresamente. Si dejas de residir en un municipio, la inscripcion deja de surtir efecto.

- **C)** "Las certificaciones tendran caracter de documento publico y fehaciente para todos los efectos administrativos". **SI**: el art. 16.1 lo establece expresamente.

**Datos obligatorios del Padron (art. 16.2 LBRL):**
1. Nombre y apellidos
2. Sexo
3. Domicilio habitual
4. Nacionalidad
5. Lugar y fecha de nacimiento
6. DNI/documento extranjero
7. Titulo escolar/academico
8. Datos para Censo Electoral

**NO es obligatorio:** vecindad civil, profesion, estado civil, religion, etc.

**Clave:** La vecindad civil **no** es dato obligatorio del padron. La lista del art. 16.2 es cerrada ("solo los siguientes datos").`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "59cb74ea-6147-4b33-8dfd-803608dc6691");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LBRL art.16 padron municipal (" + exp2.length + " chars)");
})();
