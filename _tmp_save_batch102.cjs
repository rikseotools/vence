require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - RD 1708/2011 art.12 AHN conservacion largo plazo
  const exp1 = `**Articulo 12.2 del RD 1708/2011** (Funciones del Archivo Historico Nacional):

Entre las funciones del AHN se incluye "establecer y valorar las estrategias que se pueden aplicar para la **conservacion a largo plazo** de los documentos y ficheros electronicos recibidos, tales como procedimientos de **emulacion, migracion y conversion de formatos**."

**Por que D es correcta (Archivo Historico Nacional):**
El AHN custodia documentos de **conservacion permanente**, por lo que necesita estrategias de **largo plazo** para preservar documentos electronicos. La emulacion, migracion y conversion de formatos son tecnicas para asegurar que los documentos electronicos sigan siendo legibles y accesibles a lo largo de decadas o siglos.

**Atencion:** Esta es una trampa clasica, porque existe una funcion MUY similar en el AGA (art. 11), pero referida a la conservacion a **medio plazo**. La diferencia clave es:
- AGA (intermedio): conservacion a **medio plazo**
- AHN (historico): conservacion a **largo plazo**

**Por que las demas son incorrectas:**

- **A)** "Archivos de oficina o de gestion". Falso: los archivos de gestion (art. 9) manejan documentos en fase activa. No les corresponde establecer estrategias de conservacion a largo plazo de documentos electronicos.

- **B)** "Archivo General de la Administracion (AGA)". Falso y trampa principal: el AGA tiene una funcion similar pero de conservacion a **medio plazo** (art. 11, funcion 5a). La pregunta pide **largo plazo**, que corresponde al AHN.

- **C)** "Archivo Central". Falso: los archivos centrales (art. 10) custodian documentos tras la tramitacion, pero no son responsables de estrategias de conservacion electronica a largo plazo.

**Conservacion de documentos electronicos:**

| Archivo | Plazo de conservacion |
|---------|----------------------|
| AGA (intermedio) | **Medio** plazo |
| **AHN** (historico) | **Largo** plazo |

**Clave:** "Largo plazo" = AHN (historico). "Medio plazo" = AGA (intermedio). La trampa es confundirlos.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "18069917-15ae-4071-b4c9-bf12a04d86dc");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - RD 1708/2011 AHN largo plazo (" + exp1.length + " chars)");

  // #2 - LOTC art.2.2 reglamentos TC aprobados por el Pleno
  const exp2 = `**Articulo 2.2 de la LOTC:**

> "El Tribunal Constitucional podra dictar **reglamentos** sobre su propio funcionamiento y organizacion, asi como sobre el regimen de su personal y servicios [...]. Estos reglamentos, que deberan ser aprobados por el **Tribunal en Pleno**, se publicaran en el BOE, autorizados por su Presidente."

**Por que D es correcta (el Pleno):**
Los reglamentos internos del TC deben ser aprobados por el **Pleno** (los 12 Magistrados reunidos). Esto tiene logica: los reglamentos son normas generales que afectan al funcionamiento de todo el Tribunal, por lo que su aprobacion requiere el organo de mayor rango y representatividad.

**Por que las demas son incorrectas:**

- **A)** "Cada una de las Salas". Falso: las Salas (Primera y Segunda, cada una con 6 Magistrados) conocen de recursos de amparo y otras competencias jurisdiccionales, pero no aprueban reglamentos internos. Los reglamentos son competencia del Pleno.

- **B)** "El Vicepresidente". Falso: el Vicepresidente preside la Sala Segunda y sustituye al Presidente en caso necesario (art. 16 LOTC), pero no aprueba reglamentos. Es una funcion colegiada del Pleno, no individual.

- **C)** "El Presidente". Falso: el Presidente **autoriza** la publicacion de los reglamentos en el BOE (art. 2.2 in fine), pero no los aprueba. La aprobacion es del Pleno; el Presidente solo firma la publicacion. No confundir "aprobar" (Pleno) con "autorizar la publicacion" (Presidente).

**Reglamentos del TC (art. 2.2 LOTC):**
- **Aprobacion:** Pleno (12 Magistrados)
- **Autorizacion de publicacion:** Presidente
- **Publicacion:** BOE
- Ambito: funcionamiento, organizacion, personal, servicios

**Clave:** El Pleno **aprueba**; el Presidente solo **autoriza la publicacion** en el BOE. No confundir ambas funciones.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "210839ad-dff2-4d05-a436-eccaa1da2795");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LOTC art.2.2 reglamentos Pleno (" + exp2.length + " chars)");
})();
