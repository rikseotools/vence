require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Informatica hardware complementario vs basico
  const exp1 = `**Clasificacion del hardware segun su utilidad:**

> **Hardware basico:** conjunto de componentes **necesarios** para otorgar la funcionalidad minima a un ordenador (placa base, procesador, memoria RAM, fuente de alimentacion).
>
> **Hardware complementario:** elementos utilizados para realizar **funciones especificas** que **no son estrictamente necesarias** para el funcionamiento del ordenador, pero que mejoran sus prestaciones (impresora, escaner, altavoces, webcam, etc.).

**Por que B es correcta (Hardware complementario):**
La definicion de la pregunta ("funciones especificas, no estrictamente necesarias, que mejoran las prestaciones del hardware basico") coincide exactamente con la definicion de **hardware complementario**. Sin el hardware complementario, el ordenador funciona; con el, se amplian sus capacidades.

**Por que las demas son incorrectas (denominaciones inventadas o erroneas):**

- **A)** "Hardware integrador". Falso: no existe la categoria "hardware integrador" en la clasificacion estandar de hardware. Es un termino inventado que suena tecnico pero no tiene significado real en informatica.

- **C)** "Hardware de gestion". Falso: tampoco existe esta categoria. "Gestion" es un termino asociado al software (programas de gestion), no a la clasificacion del hardware.

- **D)** "Hardware de procesamiento". Falso: el procesamiento (CPU, memoria RAM) forma parte del **hardware basico**, ya que es imprescindible para que el ordenador funcione. No se refiere a los componentes opcionales que describe la pregunta.

**Clave:** Basico = imprescindible para funcionar. Complementario = funciones adicionales, no estrictamente necesarias. "Integrador" y "de gestion" no existen como categorias de hardware.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "cda61abb-cdd7-49f4-b244-9f1258b8b33c");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Hardware complementario (" + exp1.length + " chars)");

  // #2 - CE art.69.2 senadores provincia sufragio secreto
  const exp2 = `**Articulo 69.2 de la Constitucion Espanola:**

> "En cada provincia se elegiran cuatro Senadores por sufragio universal, libre, igual, directo y **secreto** por los votantes de **cada una de ellas**, en los terminos que senale una ley organica."

**Por que B es correcta:**
La opcion B reproduce fielmente el art. 69.2: sufragio "universal, libre, igual, directo y **secreto**" y "por los votantes de **cada una de ellas**" (refiriendose a las provincias). Cada palabra coincide con el texto constitucional.

**Por que las demas son incorrectas (cambios de palabras):**

- **A)** Cambia "por los votantes de **cada una de ellas**" (provincias) por "por los votantes de **cada Comunidad Autonoma**". Falso: el art. 69.2 habla de **provincias**, no de Comunidades Autonomas. Los 4 senadores se eligen por provincia. Los senadores designados por CCAA se regulan en el art. 69.**5** (por las Asambleas Legislativas autonómicas), no en el 69.2.

- **C)** Cambia "**secreto**" por "**publico**". Falso: el sufragio en Espana es siempre **secreto** (art. 69.2 para senadores, art. 68.1 para diputados). El voto publico seria contrario al principio democratico de libertad de voto.

- **D)** Contiene **dos errores**: (1) cambia "secreto" por "**publico**", y (2) cambia "cada una de ellas" por "cada **Comunidad Autonoma**". Combina las trampas de A y C en una sola opcion.

**Senadores en la CE (art. 69):**

| Tipo | Eleccion | Numero |
|------|----------|--------|
| Provinciales (art. 69.2) | Sufragio directo y **secreto** por **provincia** | 4 por provincia |
| Insulares (art. 69.3) | Sufragio directo | 3 islas mayores, 1 menores |
| Autonomicos (art. 69.5) | Designados por Asambleas de CCAA | 1 + 1 por millon |

**Clave:** Secreto (no publico), por provincia (no por Comunidad Autonoma). El art. 69.2 regula senadores provinciales, no autonomicos.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "e54fc5ee-ef28-4c7e-a256-73746e81ab88");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.69.2 senadores secreto (" + exp2.length + " chars)");

  // #3 - CE Titulo VIII Organizacion Territorial del Estado
  const exp3 = `**Titulo VIII de la Constitucion Espanola: "De la Organizacion Territorial del Estado"**

> Arts. 137-158: Principios generales, Administracion Local y Comunidades Autonomas.

**Por que A es correcta (Titulo VIII):**
El Titulo VIII CE (arts. 137-158) regula la **Organizacion Territorial del Estado**: municipios, provincias y Comunidades Autonomas. Contiene tres capitulos:
- Cap. I: Principios generales (arts. 137-139)
- Cap. II: Administracion Local (arts. 140-142)
- Cap. III: Comunidades Autonomas (arts. 143-158)

**Por que las demas son incorrectas (titulos diferentes):**

- **B)** "Titulo VII". Falso: el Titulo VII se titula "**Economia y Hacienda**" (arts. 128-136). Regula la riqueza del pais, la planificacion economica, los Presupuestos Generales del Estado y el Tribunal de Cuentas. Es el titulo inmediatamente anterior al VIII.

- **C)** "Titulo V". Falso: el Titulo V se titula "**De las relaciones entre el Gobierno y las Cortes Generales**" (arts. 108-116). Regula la responsabilidad del Gobierno, la cuestion de confianza, la mocion de censura y los estados excepcionales.

- **D)** "Titulo VI". Falso: el Titulo VI se titula "**Del Poder Judicial**" (arts. 117-127). Regula la justicia, los jueces, el CGPJ, el jurado y el Ministerio Fiscal.

**Titulos de la CE (V-VIII):**

| Titulo | Nombre | Articulos |
|--------|--------|-----------|
| V | Relaciones Gobierno-Cortes | 108-116 |
| VI | Poder Judicial | 117-127 |
| VII | Economia y Hacienda | 128-136 |
| **VIII** | **Organizacion Territorial** | **137-158** |

**Clave:** Organizacion Territorial = Titulo VIII. No confundir con Economia (VII), Poder Judicial (VI) ni Relaciones Gobierno-Cortes (V).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "47e7a7e4-36c1-44f3-a522-8fe109cbec49");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE Titulo VIII Org Territorial (" + exp3.length + " chars)");
})();
