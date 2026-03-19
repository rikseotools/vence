require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - RD 1708/2011 art.9 archivos oficina funciones
  const exp1 = `**Articulo 9 del RD 1708/2011** (Archivos de oficina o de gestion):

Los archivos de oficina custodian documentos en **fase de tramitacion** o sometidos a continua utilizacion. Sus funciones principales son:

> a) **Apoyar la gestion administrativa**.
> b) Reunir, organizar, conservar y custodiar la documentacion en fase de tramitacion.
> c) Transferir la documentacion al archivo central una vez finalizada su tramitacion.

**Por que A es correcta:**
"Apoyar la gestion administrativa" es la funcion **principal** de los archivos de oficina (art. 9.a). Al estar vinculados directamente a las unidades administrativas, su razon de ser es servir de soporte a la gestion diaria.

**Por que las demas son incorrectas:**

- **B)** "Describir las fracciones de serie conforme a normas internacionales". Falso para archivos de oficina: esta funcion corresponde a los **archivos centrales** o **intermedios**, que son los que realizan la descripcion archivistica normalizada.

- **C)** "Identificacion de series y cuadro de clasificacion". Falso para archivos de oficina: la identificacion de series y la elaboracion del cuadro de clasificacion es funcion del **archivo central** del Departamento (art. 10 del RD 1708/2011).

- **D)** "Proporcionar al archivo intermedio las descripciones de transferencias". Falso para archivos de oficina: las transferencias se hacen al **archivo central**, no al intermedio. Ademas, la descripcion tecnica no corresponde a los archivos de oficina.

**Clave:** Archivos de oficina = **gestion administrativa**. Las funciones tecnicas (descripcion, identificacion, clasificacion) corresponden a niveles superiores (central, intermedio).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "49cb7ec5-3db4-43b0-87d7-9b373fdf891f");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - RD 1708 archivos oficina (" + exp1.length + " chars)");

  // #2 - LO 3/1981 art.35 personal Defensor del Pueblo
  const exp2 = `**Articulo 35.1 de la LO 3/1981** (Personal del Defensor del Pueblo):

> "Las personas que se encuentren al servicio del Defensor del Pueblo, y mientras permanezcan en el mismo, se consideraran como persona al servicio de **las Cortes**."

**Por que A es correcta:**
El personal del Defensor del Pueblo se considera personal al servicio de **las Cortes** (Congreso y Senado). Esto tiene logica constitucional: el Defensor del Pueblo es un **comisionado de las Cortes Generales** (art. 54 CE), designado por ellas para la defensa de los derechos fundamentales. Su personal tiene, por tanto, la misma consideracion que el personal de las Camaras.

**Por que las demas son incorrectas:**

- **B)** "Ministerio de Justicia". Falso: el Defensor del Pueblo no depende del Ministerio de Justicia ni del Gobierno. Es un organo **independiente** vinculado a las Cortes.

- **C)** "Poder Judicial". Falso: aunque el Defensor supervisa la Administracion, no forma parte del Poder Judicial. Su personal no se equipara a personal judicial.

- **D)** "El Gobierno". Falso: el Defensor del Pueblo es precisamente un organo de control **frente al** Gobierno. Seria contradictorio que su personal dependiera del organismo que controla.

**Clave:** Defensor del Pueblo = comisionado de las **Cortes** (art. 54 CE). Su personal = al servicio de las **Cortes**.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "f6c98a56-3eb7-4d49-9182-1eaaf2e657ee");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LO 3/1981 personal DP (" + exp2.length + " chars)");
})();
