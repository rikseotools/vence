require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.151.1 via rapida autonomia ley organica
  const exp1 = `**Articulo 151.1 de la Constitucion Espanola:**

> "No sera preciso dejar transcurrir el plazo de cinco anos [...] cuando la iniciativa del proceso autonomico sea acordada [...] por las tres cuartas partes de los municipios de cada una de las provincias afectadas que representen, al menos, la mayoria del censo electoral de cada una de ellas y dicha iniciativa sea ratificada mediante referendum [...] en los terminos que establezca una **ley organica**."

**Por que B es correcta (ley organica):**
El art. 151.1 CE establece la llamada "via rapida" de acceso a la autonomia, que permite asumir el maximo nivel competencial sin esperar los 5 anos del art. 148.2. Los terminos del referendum de ratificacion deben regularse por **ley organica**, dada la importancia del proceso (afecta a la estructura territorial del Estado y a derechos fundamentales como el sufragio).

**Por que las demas son incorrectas:**

- **A)** "Un reglamento". Falso: un reglamento es una norma de rango inferior a la ley, aprobada por el poder ejecutivo. Un proceso tan trascendente como la creacion de una Comunidad Autonoma no puede regularse por una norma infralegal.

- **C)** "Una ley ordinaria". Falso: el art. 151.1 dice expresamente "ley **organica**", no ley ordinaria. Las leyes organicas requieren mayoria absoluta del Congreso (art. 81 CE) y se reservan para materias especialmente sensibles.

- **D)** "Un Decreto Ley". Falso: el Decreto Ley es una norma de urgencia del Gobierno (art. 86 CE) que no puede afectar a derechos fundamentales ni al regimen de las CCAA. Regular un referendum autonomico por Decreto Ley seria inconstitucional.

**Via rapida de autonomia (art. 151.1 CE) - requisitos:**
- 3/4 de los **municipios** de cada provincia
- **Mayoria** del censo electoral de cada provincia
- Ratificacion por **referendum** (mayoria absoluta de electores por provincia)
- Regulacion del referendum: **ley organica**

**Clave:** "Ley organica" (no ordinaria, no reglamento, no decreto ley).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "5637bd1b-a65d-4669-b6dd-3e22cc7956d4");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.151 via rapida (" + exp1.length + " chars)");

  // #2 - Informatica: freeware no es amenaza
  const exp2 = `**Conceptos de seguridad informatica:**

Un **freeware** es simplemente un programa de **distribucion gratuita**. El usuario puede descargarlo e instalarlo sin coste. No tiene nada que ver con amenazas informaticas; es un modelo de distribucion de software (como shareware, trial, etc.).

**Por que C es correcta (freeware NO es una amenaza):**
Freeware (del ingles "free" = gratis + "software") solo significa que el programa es gratuito. Ejemplos conocidos: Adobe Acrobat Reader, VLC Media Player, 7-Zip. No implica ninguna actividad maliciosa.

**Por que las demas SI son amenazas informaticas:**

- **A)** "**Troyano**". SI es una amenaza: un troyano es un programa malicioso que se disfraza de software legitimo para enganar al usuario. Una vez instalado, permite al atacante acceder al sistema, robar datos o instalar mas malware. Su nombre viene del Caballo de Troya de la mitologia griega.

- **B)** "**Ransomware**". SI es una amenaza: es un tipo de malware que **cifra** los archivos del usuario y exige un **rescate** (ransom) economico para devolver el acceso. Es una de las amenazas mas daninas actualmente (ej: WannaCry, Petya).

- **D)** "**Spyware**". SI es una amenaza: es software espia que se instala sin consentimiento del usuario para **recopilar informacion** (contrasenas, habitos de navegacion, datos bancarios) y enviarla a terceros.

**Tipos de amenazas vs software no malicioso:**

| Termino | Amenaza | Que hace |
|---------|---------|----------|
| Troyano | SI | Se disfraza de programa legitimo |
| Ransomware | SI | Cifra archivos y pide rescate |
| Spyware | SI | Espia y roba informacion |
| **Freeware** | **NO** | Software gratuito (no malicioso) |

**Clave:** Freeware = gratuito (no malicioso). No confundir con malware, spyware o ransomware.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "97ce1d0d-7bba-45c7-873d-ad741b8d479e");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Informatica freeware (" + exp2.length + " chars)");

  // #3 - Funcionarios desde 2011 Regimen General SS
  const exp3 = `**Disposicion Adicional 3a del RDL 8/2015 (LGSS):**

> "Con efectos de **1 de enero de 2011**, el personal [funcionarial] estara obligatoriamente incluido [...] en el **Regimen General de la Seguridad Social** siempre que el acceso a la condicion de que se trate se produzca **a partir de aquella fecha**, a los exclusivos efectos de lo dispuesto en [la Ley de Clases Pasivas] y en sus disposiciones de desarrollo."

**Por que A es correcta:**
Desde el 1 de enero de 2011, los nuevos funcionarios de carrera civiles del Estado pasan al **Regimen General de la SS** (en materia de pensiones), en lugar de al Regimen de Clases Pasivas. La opcion A reproduce fielmente esta regla: "a partir del 1 de enero de 2011" + "Regimen General" + "a los exclusivos efectos de lo dispuesto en la Ley de Clases Pasivas".

**Por que las demas son incorrectas:**

- **B)** "Estaran incluidos en el ambito [...] del Regimen de **Clases Pasivas**". Falso: es exactamente lo contrario. Los funcionarios que acceden desde 2011 ya **no** entran en Clases Pasivas, sino en el Regimen General. Clases Pasivas queda solo para quienes accedieron **antes** de 2011.

- **C)** "**Podran** estar incluidos en el Regimen General". Falso: cambia "estaran obligatoriamente incluidos" por "podran estar incluidos". La inclusion es **obligatoria**, no opcional. No es una posibilidad, es un mandato legal.

- **D)** "**Todos** los funcionarios de carrera [...] estaran incluidos en Clases Pasivas". Falso: no son "todos"; solo los que accedieron **antes** del 1 de enero de 2011. Los que acceden desde esa fecha van al Regimen General. La trampa es generalizar a "todos" cuando hay una fecha de corte.

**Regimen de pensiones de funcionarios civiles del Estado:**

| Fecha de acceso | Regimen |
|----------------|---------|
| **Antes** del 1/1/2011 | **Clases Pasivas** |
| **Desde** el 1/1/2011 | **Regimen General SS** |

**Clave:** La fecha de corte es el **1 de enero de 2011**. Desde esa fecha = Regimen General (obligatorio, no opcional). Antes = Clases Pasivas.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "d5b5c8fd-7e51-4e1b-8dc3-3a237d983d86");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Funcionarios 2011 Regimen General (" + exp3.length + " chars)");
})();
