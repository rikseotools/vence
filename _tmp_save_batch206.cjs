require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Word Normal.dotm plantilla predeterminada idioma
  const exp1 = `**Word 365 - Plantilla Normal.dotm:**

**Por que D es correcta (Normal.dotm):**
La plantilla **Normal.dotm** es la plantilla global predeterminada de Word. Cada vez que se crea un documento en blanco, Word aplica la configuracion almacenada en Normal.dotm. Al predeterminar el idioma por defecto (Revisar > Idioma > Establecer idioma de correccion > "Predeterminar"), el cambio se guarda en esta plantilla, de modo que todos los documentos nuevos usaran ese idioma.

Cualquier cambio en formatos predeterminados (fuente, espaciado, margenes, idioma) se almacena en Normal.dotm si se pulsa "Predeterminar" o "Establecer como predeterminado".

**Por que las demas son incorrectas:**

- **A)** "**Documento1.dotx**." Falso: "Documento1" es el nombre temporal que Word asigna a un documento nuevo aun no guardado, no una plantilla. No existe una plantilla llamada Documento1.dotx en el sistema de plantillas de Word.

- **B)** "**Settings.dotx**." Falso: no existe una plantilla estandar llamada Settings.dotx en Word. Las configuraciones predeterminadas se guardan en Normal.dotm, no en un archivo separado de ajustes.

- **C)** "**Default.dotx**." Falso: aunque el nombre sugiere "predeterminada", no existe una plantilla estandar llamada Default.dotx en Word. La plantilla por defecto se llama **Normal.dotm** (con extension .dotm porque puede contener macros).

**Sobre Normal.dotm:**
- Extension **.dotm** (plantilla con macros habilitadas)
- Ubicacion tipica: %appdata%\\Microsoft\\Templates\\
- Se carga automaticamente al abrir Word
- Todos los estilos, macros y configuraciones predeterminadas se almacenan aqui

**Clave:** Normal.dotm es la unica plantilla global de Word. Todo cambio "predeterminado" (idioma, fuente, margenes) se guarda ahi.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "5f511dd7-a191-4214-b1de-451d8de3678d");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Word Normal.dotm (" + exp1.length + " chars)");

  // #2 - Excel 365 opciones de inmovilización, cuál es FALSA
  const exp2 = `**Excel 365 - Opciones de inmovilizacion (Vista > Inmovilizar paneles):**

**Por que A es la opcion FALSA (y por tanto la respuesta correcta):**
"**Inmovilizar celdas seleccionadas**" no existe como opcion en Excel 365. No se pueden inmovilizar celdas individuales. La inmovilizacion siempre funciona por filas y columnas completas (o la primera fila/columna).

**Las tres opciones reales de inmovilizacion en Excel 365:**

- **B)** "Inmovilizar **fila superior**." **Existe**: congela la primera fila visible para que permanezca fija al desplazarse verticalmente. Util para mantener siempre visibles los encabezados de columna.

- **C)** "Inmovilizar **paneles**." **Existe**: congela las filas por encima y las columnas a la izquierda de la celda activa. Es la opcion mas flexible, ya que permite fijar tanto filas como columnas simultaneamente segun la posicion del cursor.

- **D)** "Inmovilizar **primera columna**." **Existe**: congela la primera columna visible (A) para que permanezca fija al desplazarse horizontalmente. Util cuando la columna A contiene identificadores o nombres.

**Opciones de inmovilizacion (Vista > Inmovilizar paneles):**

| Opcion | Que congela | Existe |
|--------|------------|--------|
| Inmovilizar paneles | Filas arriba + columnas a la izquierda del cursor | Si |
| Inmovilizar fila superior | Solo la primera fila | Si |
| Inmovilizar primera columna | Solo la primera columna | Si |
| ~~Inmovilizar celdas seleccionadas~~ | - | **No existe** |

**Clave:** Excel inmoviliza filas y columnas completas, no celdas individuales. Las tres opciones son: paneles, fila superior y primera columna.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "f9ffc55d-546c-49c3-800c-cda14d022598");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Excel inmovilizacion (" + exp2.length + " chars)");

  // #3 - Ley 7/1985 art.33 OEP NO corresponde al Pleno Diputación
  const exp3 = `**Articulo 33.2 de la Ley 7/1985 (LBRL) - Competencias del Pleno de la Diputacion:**

> Art. 33.2.f): "La aprobacion de la **plantilla de personal**, la relacion de puestos de trabajo, la fijacion de la cuantia de las **retribuciones complementarias** fijas y periodicas de los funcionarios, y el numero y regimen del **personal eventual**."

**Por que D es correcta (la OEP NO corresponde al Pleno):**
La **Oferta de Empleo Publico** (OEP) no aparece entre las competencias del Pleno en el art. 33.2 LBRL. La aprobacion de la OEP corresponde al **Presidente de la Diputacion** (art. 34.1.h LBRL), no al Pleno. El Pleno aprueba la plantilla de personal (cuantos puestos hay), pero la OEP (que plazas se convocan) es competencia presidencial.

**Por que las demas SI corresponden al Pleno (art. 33.2):**

- **A)** "La fijacion de la cuantia de las **retribuciones complementarias** fijas y periodicas de los funcionarios." **Si corresponde al Pleno**: recogido expresamente en el art. 33.2.f). El Pleno decide cuanto cobran los funcionarios en complementos.

- **B)** "La aprobacion y modificacion de los **Presupuestos**." **Si corresponde al Pleno**: recogido en el art. 33.2.c). Los presupuestos son una competencia plenaria clasica e indelegable.

- **C)** "La aprobacion de la **plantilla de personal**." **Si corresponde al Pleno**: recogido en el art. 33.2.f). La plantilla (estructura de puestos) la aprueba el Pleno.

**Competencias del Pleno en materia de personal (art. 33.2.f):**

| Materia | Organo competente |
|---------|-------------------|
| Plantilla de personal | **Pleno** (art. 33.2.f) |
| Relacion de puestos de trabajo | **Pleno** (art. 33.2.f) |
| Retribuciones complementarias | **Pleno** (art. 33.2.f) |
| Personal eventual (numero y regimen) | **Pleno** (art. 33.2.f) |
| **Oferta de Empleo Publico** | **Presidente** (art. 34.1.h) |

**Clave:** Plantilla de personal = Pleno. Oferta de Empleo Publico (OEP) = Presidente. No confundir ambos conceptos.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "2c9c60b3-0d34-4bb9-b579-c12b3aa3954b");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LBRL art.33 OEP no Pleno (" + exp3.length + " chars)");
})();
