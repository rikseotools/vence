require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Concepto 221 Suministros, limpieza y aseo NO
  const exp1 = `**Clasificacion economica del presupuesto - Concepto 221: Suministros:**

> Concepto 221 (Art. 22): Suministros. Incluye: energia electrica (00), agua (01), gas (02), combustible (03), vestuario (04), alimentacion (05), productos farmaceuticos (06), suministros militares/policiales (07), material deportivo/didactico (08), repuestos de maquinaria (11), material electronico (12), etc.

**Por que A es correcta (limpieza y aseo NO se imputa al Concepto 221):**
Los gastos de **limpieza y aseo** no son suministros. Se imputan al **Concepto 227** (Trabajos realizados por otras empresas y profesionales), ya que la limpieza es un servicio contratado con empresas externas, no un bien consumible. Los suministros del Concepto 221 son bienes que se adquieren y consumen (energia, agua, gas, alimentos, etc.).

**Por que las demas SI se imputan al Concepto 221:**

- **B)** "**Gas**." **Si es suministro**: subconcepto 221.02. El gas natural para calefaccion e instalaciones es un suministro basico.

- **C)** "**Energia electrica**." **Si es suministro**: subconcepto 221.00. El consumo electrico de edificios publicos es el primer suministro del concepto.

- **D)** "**Agua**." **Si es suministro**: subconcepto 221.01. El abastecimiento de agua es un suministro esencial.

**Principales subconceptos del 221 (Suministros):**

| Subconcepto | Gasto |
|-------------|-------|
| 00 | Energia electrica |
| 01 | Agua |
| 02 | Gas |
| 03 | Combustible |
| 04 | Vestuario |
| 05 | Alimentacion |
| ~~Limpieza~~ | ~~No es suministro~~ (va al Concepto 227) |

**Clave:** Suministros = bienes que se consumen (energia, agua, gas). Limpieza y aseo = servicio contratado (Concepto 227, no 221).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "c909668d-8d21-4dae-80f6-b3c69ab49c42");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Concepto 221 limpieza no suministro (" + exp1.length + " chars)");

  // #2 - RGPD art.14 datos no del interesado, INCORRECTA "sin base jurídica"
  const exp2 = `**Articulo 14 del RGPD (UE 2016/679) - Informacion cuando los datos no se obtienen del interesado:**

> Art. 14.1.c): "Los **fines del tratamiento** a que se destinan los datos personales, **asi como la base juridica** del tratamiento."

**Por que C es la afirmacion INCORRECTA (y por tanto la respuesta):**
La opcion C dice que se facilitaran "los fines del tratamiento [...] **sin necesidad de facilitar la base juridica** del tratamiento." Falso: el art. 14.1.c) RGPD exige informar tanto de los fines **como de la base juridica**. No se puede omitir la base juridica. Las dos informaciones van juntas ("asi como") y son igualmente obligatorias.

**Por que las demas SI son correctas (art. 14.1):**

- **A)** "Los datos de contacto del **delegado de proteccion de datos**." **Correcto**: el art. 14.1.b) exige facilitar los datos de contacto del DPD, en su caso.

- **B)** "La intencion del responsable de **transferir datos a un tercer pais** u organizacion internacional." **Correcto**: el art. 14.1.f) exige informar sobre transferencias internacionales, incluyendo la existencia o ausencia de decision de adecuacion de la Comision.

- **D)** "Los **destinatarios** o las categorias de destinatarios de los datos personales." **Correcto**: el art. 14.1.e) exige facilitar esta informacion.

**Informacion obligatoria del art. 14.1 RGPD (datos no del interesado):**

| Letra | Contenido |
|-------|-----------|
| a) | Identidad y datos de contacto del responsable |
| b) | Datos de contacto del DPD |
| **c)** | **Fines del tratamiento + base juridica** (ambos) |
| d) | Categorias de datos personales |
| e) | Destinatarios o categorias de destinatarios |
| f) | Transferencias internacionales |

**Clave:** Art. 14.1.c) exige informar de los fines **Y** de la base juridica. No se puede dar uno sin el otro. La opcion C miente al decir "sin necesidad de facilitar la base juridica".`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "889c4a26-49a1-4bfb-a1ca-7305cdaf63ea");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - RGPD art.14 base juridica (" + exp2.length + " chars)");
})();
