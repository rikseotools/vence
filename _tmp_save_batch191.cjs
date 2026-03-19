require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.1.2 soberanía nacional reside en el pueblo español
  const exp1 = `**Articulo 1.2 de la Constitucion Espanola - Soberania nacional:**

> "La **soberania nacional** reside en el **pueblo espanol**, del que emanan los poderes del Estado."

**Por que C es correcta (en el pueblo espanol):**
El art. 1.2 CE consagra el principio de **soberania popular**: el poder supremo reside en el conjunto de los ciudadanos espanoles. Todos los poderes del Estado (legislativo, ejecutivo y judicial) emanan del pueblo y derivan su legitimidad de el. Es un principio fundamental de la democracia.

**Por que las demas son incorrectas:**

- **A)** "En el **poder judicial**." Falso: el poder judicial administra justicia (art. 117 CE), pero no es titular de la soberania. Como los demas poderes del Estado, el poder judicial **emana** del pueblo, no al reves.

- **B)** "En el **Rey**." Falso: en la Monarquia parlamentaria espanola (art. 1.3 CE), el Rey es el Jefe del Estado y simbolo de su unidad (art. 56), pero la soberania **no** reside en el. A diferencia de las monarquias absolutas, en las monarquias parlamentarias la soberania es popular, no regia.

- **D)** "En las **Cortes Generales**." Falso: las Cortes Generales **representan** al pueblo espanol (art. 66.1 CE), pero la soberania reside en el pueblo, no en sus representantes. Las Cortes ejercen el poder legislativo por delegacion del pueblo, pero el titular de la soberania es el pueblo mismo.

**Articulo 1 CE completo:**
- 1.1: Estado social y democratico de Derecho (valores: libertad, justicia, igualdad, pluralismo politico)
- **1.2: Soberania en el pueblo espanol**
- 1.3: Monarquia parlamentaria

**Clave:** La soberania reside en el **pueblo**, no en el Rey (Monarquia absoluta), ni en las Cortes (soberania parlamentaria), ni en el poder judicial.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "73972e8f-4167-43d9-b9e8-f919289d1cbc");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.1.2 soberania pueblo (" + exp1.length + " chars)");

  // #2 - CE art.4 bandera de España artículo 4
  const exp2 = `**Articulo 4 de la Constitucion Espanola - Bandera de Espana:**

> Art. 4.1: "La **bandera de Espana** esta formada por tres franjas horizontales, roja, amarilla y roja, siendo la amarilla de **doble anchura** que cada una de las rojas."
>
> Art. 4.2: "Los Estatutos podran reconocer banderas y ensenas propias de las Comunidades Autonomas. Estas se utilizaran **junto a la bandera de Espana** en sus edificios publicos y en sus actos oficiales."

**Por que B es correcta (articulo 4):**
El art. 4 CE es el que regula la bandera de Espana, describiendo sus colores y proporciones, y estableciendo que las banderas autonomicas se usaran junto a la nacional.

**Por que las demas son incorrectas (corresponden a otros articulos del Titulo Preliminar):**

- **A)** "Articulo **5**." Falso: el art. 5 CE establece que "La capital del Estado es la villa de **Madrid**". No regula la bandera.

- **C)** "Articulo **3**." Falso: el art. 3 CE regula las **lenguas** oficiales. El art. 3.1 establece el castellano como lengua oficial del Estado y el art. 3.2 reconoce la cooficialidad de las demas lenguas espanolas en las respectivas CCAA.

- **D)** "Articulo **2**." Falso: el art. 2 CE consagra la **unidad de la Nacion** espanola, el derecho a la **autonomia** de las nacionalidades y regiones, y la **solidaridad** entre ellas. No trata sobre la bandera.

**Titulo Preliminar - Primeros articulos de la CE:**

| Art. | Contenido |
|------|-----------|
| 1 | Estado social y democratico, soberania, Monarquia parlamentaria |
| 2 | Unidad de la Nacion, autonomia, solidaridad |
| 3 | Lenguas oficiales |
| **4** | **Bandera de Espana** |
| 5 | Capital: Madrid |

**Clave:** Bandera = art. 4. Lenguas = art. 3. Capital = art. 5. No confundir estos tres articulos del Titulo Preliminar.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "1bdd455f-ff02-4aa6-b13b-55fdec052c40");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.4 bandera (" + exp2.length + " chars)");

  // #3 - Unidades de almacenamiento mayor Yottabyte
  const exp3 = `**Unidades de almacenamiento informatico - Orden de mayor a menor:**

**Por que B es correcta (1 YB - Yottabyte):**
El **Yottabyte** (YB) es la mayor unidad de almacenamiento de las opciones presentadas. Equivale a 1.024 Zettabytes, o aproximadamente 10^24 bytes. Es la unidad mas grande del sistema internacional de prefijos aplicados a bytes.

**Por que las demas son menores (en orden descendente):**

- **A)** "1 **ZB** (Zettabyte)." Es la segunda mayor. 1 ZB = 1.024 EB. Es menor que 1 YB. La relacion es: 1 YB = **1.024 ZB**.

- **C)** "1 **EB** (Exabyte)." Es la tercera mayor. 1 EB = 1.024 PB. Es mucho menor que 1 YB. La relacion es: 1 YB = 1.024 x 1.024 EB = 1.048.576 EB.

- **D)** "1 **TB** (Terabyte)." Es la menor de las opciones. 1 TB = 1.024 GB. Es la unidad mas comun en discos duros domesticos. Esta muy lejos del YB.

**Escala de unidades de almacenamiento (cada una = 1.024 de la anterior):**

| Unidad | Abreviatura | Equivalencia |
|--------|-------------|-------------|
| Byte | B | 8 bits |
| Kilobyte | KB | 1.024 B |
| Megabyte | MB | 1.024 KB |
| Gigabyte | GB | 1.024 MB |
| **Terabyte** | **TB** | 1.024 GB |
| Petabyte | PB | 1.024 TB |
| **Exabyte** | **EB** | 1.024 PB |
| **Zettabyte** | **ZB** | 1.024 EB |
| **Yottabyte** | **YB** | **1.024 ZB** |

**Clave:** El orden de menor a mayor es: TB < EB < ZB < **YB**. Mnemotecnia de los grandes: "Todo Es Zen y Ya" (Tera, Exa, Zetta, Yotta).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "e1c7b20b-45a5-4d68-a8e8-5955f5f0a48a");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Unidades almacenamiento YB (" + exp3.length + " chars)");
})();
