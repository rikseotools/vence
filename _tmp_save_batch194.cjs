require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Petabyte sigue al Terabyte en jerarquía de almacenamiento
  const exp1 = `**Jerarquia de unidades de almacenamiento informatico:**

**Por que D es correcta (Petabyte):**
El **Petabyte** (PB) es la unidad que sigue inmediatamente al Terabyte (TB) en la jerarquia de almacenamiento. La relacion es: **1 PB = 1.024 TB**. Cada nivel multiplica por 1.024 el anterior.

**Por que las demas son incorrectas:**

- **A)** "**Gigabyte** (GB)." Falso: el Gigabyte esta **por debajo** del Terabyte, no por encima. 1 TB = 1.024 GB. El Gigabyte precede al Terabyte, no le sigue.

- **B)** "**Exabyte** (EB)." Falso: el Exabyte esta dos niveles por encima del Terabyte, no uno. La secuencia correcta es TB > **PB** > EB. El Exabyte sigue al Petabyte, no al Terabyte.

- **C)** "**Zettabyte** (ZB)." Falso: el Zettabyte esta tres niveles por encima del Terabyte. La secuencia es TB > PB > EB > **ZB**. Esta aun mas lejos.

**Orden de unidades (de menor a mayor):**

| Posicion | Unidad | Equivalencia |
|----------|--------|-------------|
| 1 | Byte (B) | 8 bits |
| 2 | Kilobyte (KB) | 1.024 B |
| 3 | Megabyte (MB) | 1.024 KB |
| 4 | Gigabyte (GB) | 1.024 MB |
| 5 | **Terabyte (TB)** | 1.024 GB |
| **6** | **Petabyte (PB)** | **1.024 TB** |
| 7 | Exabyte (EB) | 1.024 PB |
| 8 | Zettabyte (ZB) | 1.024 EB |
| 9 | Yottabyte (YB) | 1.024 ZB |

**Clave:** Despues del Terabyte viene el **Petabyte**. Mnemotecnia: "Kuantos Mega Gigas Tiene el Peta" (KB, MB, GB, TB, PB).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "06d639ec-d410-47df-be26-d73676840f9f");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Petabyte sigue TB (" + exp1.length + " chars)");

  // #2 - Byte = 8 bits (unos o ceros)
  const exp2 = `**Unidad basica de informacion: el byte:**

**Por que A es correcta (8):**
Un **byte** esta compuesto por **8 bits**. Cada bit puede ser un 1 o un 0, por lo que un byte contiene en total **8 unos o ceros**. Con 8 bits se pueden representar 2^8 = **256 combinaciones** diferentes (del 00000000 al 11111111), lo que permite codificar un caracter alfanumerico.

**Por que las demas son incorrectas:**

- **B)** "**4**." Falso: 4 bits no forman un byte, sino un **nibble** (o cuarteto). Un nibble es medio byte y puede representar 16 combinaciones (0-15), lo que corresponde a un digito hexadecimal.

- **C)** "**10**." Falso: 10 bits no corresponden a ninguna unidad estandar de almacenamiento. Un byte son exactamente 8 bits, no 10. Se trabaja en potencias de 2, no en base 10.

- **D)** "**2**." Falso: 2 bits solo permitirian 4 combinaciones (00, 01, 10, 11), insuficiente para representar un caracter. Un byte necesita 8 bits para sus 256 combinaciones.

**Relacion bit-byte:**

| Unidad | Bits | Combinaciones posibles |
|--------|------|----------------------|
| 1 bit | 1 | 2 (0 o 1) |
| 1 nibble | 4 | 16 |
| **1 byte** | **8** | **256** |
| 1 word (16 bits) | 16 | 65.536 |

**Clave:** 1 byte = **8 bits** = 8 unos o ceros. Es la unidad basica de almacenamiento y puede representar un caracter (letra, numero o simbolo).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "ce57c64b-177d-4828-a59c-0d5f47113c0b");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Byte 8 bits (" + exp2.length + " chars)");

  // #3 - LBRL art.36 Diputación competencias INCORRECTA (50.000 vs 20.000)
  const exp3 = `**Articulo 36.1 de la Ley 7/1985 (LBRL) - Competencias de la Diputacion Provincial:**

> Art. 36.1: "Son competencias propias de la Diputacion [...]: [...]
> g) La prestacion de los servicios de administracion electronica y la contratacion centralizada en los municipios con poblacion inferior a **20.000 habitantes**."

**Por que C es la afirmacion INCORRECTA (y por tanto la respuesta):**
La opcion C dice "municipios con poblacion inferior a **50.000** habitantes", pero el art. 36.1.g) dice **20.000** habitantes. La trampa sustituye el umbral correcto (20.000) por uno mayor (50.000). La competencia de administracion electronica y contratacion centralizada de la Diputacion se dirige a los municipios mas pequenos (< 20.000), no a los medianos.

**Por que las demas SI son correctas:**

- **A)** "La cooperacion en el fomento del desarrollo economico y social y en la planificacion en el territorio provincial." **Correcto**: corresponde al art. 36.1.d) LBRL. Es una competencia de impulso y coordinacion en el ambito provincial.

- **B)** "Asistencia en la prestacion de servicios de gestion de la recaudacion tributaria [...] municipios con poblacion inferior a **20.000** habitantes." **Correcto**: corresponde al art. 36.1.c) LBRL. La asistencia en recaudacion tributaria para municipios pequenos.

- **D)** "La coordinacion mediante convenio [...] del servicio de mantenimiento y limpieza de los consultorios medicos en los municipios con poblacion inferior a **5.000** habitantes." **Correcto**: corresponde al art. 36.1.h) LBRL. Competencia especifica para consultorios medicos en los municipios mas pequenos.

**Umbrales de poblacion en competencias de la Diputacion (art. 36.1):**

| Competencia | Umbral |
|-------------|--------|
| Recaudacion tributaria | < **20.000** hab. |
| Administracion electronica y contratacion centralizada | < **20.000** hab. (no 50.000) |
| Consultorios medicos | < **5.000** hab. |

**Clave:** La trampa esta en el umbral: **20.000** (correcto) vs 50.000 (incorrecto). La Diputacion asiste a municipios de menos de 20.000, no de 50.000.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "374a87c9-031d-4f9c-8190-cf538d93d2f1");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LBRL art.36 Diputacion (" + exp3.length + " chars)");
})();
