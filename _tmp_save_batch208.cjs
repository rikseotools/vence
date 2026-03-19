require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 47/2003 art.40 créditos operaciones financieras
  const exp1 = `**Articulo 40.1.c) de la Ley 47/2003 General Presupuestaria - Clasificacion economica:**

> "En los creditos para **operaciones financieras** se distinguiran las de **activos financieros** y las de **pasivos financieros**."

**Por que C es correcta (activos financieros + pasivos financieros):**
El art. 40.1.c) establece que las operaciones financieras comprenden unicamente dos categorias: **activos financieros** (adquisicion de acciones, concesion de prestamos, etc.) y **pasivos financieros** (amortizacion de deuda, devolucion de depositos, etc.). Solo son dos conceptos, nada mas.

**Por que las demas son incorrectas (anaden categorias de otros tipos):**

- **A)** Anade el "**Fondo de Contingencia** de ejecucion presupuestaria". Falso: el Fondo de Contingencia es una categoria **independiente** y separada de las operaciones financieras. El art. 40.1.c) lo trata como un cuarto bloque propio, distinto de las operaciones corrientes, de capital y financieras.

- **B)** Anade "**inversiones reales**". Falso: las inversiones reales pertenecen a las **operaciones de capital**, no a las financieras. "En los creditos para operaciones de capital se distinguiran las inversiones reales y las transferencias de capital."

- **D)** Anade "**inversiones reales**" y "**transferencias de capital**". Falso: ambos conceptos pertenecen integra y exclusivamente a las **operaciones de capital**. Se mezclan dos bloques diferentes (capital + financiero).

**Clasificacion economica completa (art. 40.1.c):**

| Tipo de operacion | Capitulos |
|-------------------|-----------|
| Corrientes | Personal, bienes/servicios, financieros, transferencias corrientes |
| Capital | Inversiones reales, transferencias de capital |
| **Financieras** | **Activos financieros, pasivos financieros** |
| Fondo de Contingencia | Necesidades imprevistas (categoria propia) |

**Clave:** Operaciones financieras = solo activos financieros + pasivos financieros. No incluye el Fondo de Contingencia ni conceptos de operaciones de capital.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "5630b504-cc5f-4761-b59a-85cab4af4cb1");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 47/2003 art.40 op. financieras (" + exp1.length + " chars)");

  // #2 - Access máscara de entrada "L" letra obligatoria
  const exp2 = `**Mascaras de entrada en Microsoft Access:**

**Por que B es correcta (L = letra obligatoria):**
En Access, el caracter **"L"** en una mascara de entrada indica que el usuario **debe** introducir una **letra** (A-Z). Es obligatorio (no admite dejar el campo vacio) y solo acepta caracteres alfabeticos (no numeros ni espacios). Para un campo donde se debe escribir H, M u O, "L" es la mascara correcta porque exige exactamente una letra.

**Por que las demas son incorrectas:**

- **A)** **"?"** (interrogacion). Falso: el signo de interrogacion indica una **letra opcional**. Si el campo fuera opcional, "?" seria valido, pero el enunciado dice "obligatoriamente". La diferencia clave es: "L" = obligatorio, "?" = opcional.

- **C)** **"A"** (mayuscula). Falso: "A" exige un caracter que puede ser **letra o digito**, de forma obligatoria. Aceptaria tanto "H" como "5", lo cual no es correcto si solo queremos letras. "A" es demasiado permisivo para este campo.

- **D)** **"a"** (minuscula). Falso: "a" permite una **letra o digito**, de forma **opcional**. Combina dos problemas: acepta numeros (no deseado) y no es obligatorio (no deseado). Es la opcion mas alejada de lo requerido.

**Resumen de caracteres de mascara en Access:**

| Caracter | Tipo | Obligatorio | Acepta |
|----------|------|-------------|--------|
| **L** | **Letra** | **Si** | **Solo letras** |
| ? | Letra | No (opcional) | Solo letras |
| A | Alfanumerico | Si | Letras o digitos |
| a | Alfanumerico | No (opcional) | Letras o digitos |
| 0 | Digito | Si | Solo digitos (0-9) |
| 9 | Digito | No (opcional) | Solo digitos |

**Clave:** L = letra obligatoria. ? = letra opcional. A = letra o digito obligatorio. a = letra o digito opcional.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "29059763-5e5e-4368-8500-b37b9933531e");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Access mascara L (" + exp2.length + " chars)");

  // #3 - Access FormatoFechaHora función
  const exp3 = `**Funcion FormatoFechaHora en Microsoft Access:**

**Sintaxis:** FormatoFechaHora(fecha, formato_nombrado)

**Por que C es correcta (devuelve expresion con formato de fecha u hora indicado como parametro):**
La funcion **FormatoFechaHora** (FormatDateTime en VBA) recibe una expresion de fecha y, opcionalmente, un parametro que indica el formato deseado. **Devuelve** esa expresion formateada segun el formato que le indiquemos. No convierte tipos de datos; formatea una fecha existente para su presentacion.

**Por que las demas son incorrectas:**

- **A)** "Convierte un valor de **cadena** en una fecha [...]" Falso: FormatoFechaHora no convierte cadenas de texto en fechas. Esa funcion seria **CDate** o **DateValue**. FormatoFechaHora parte de un valor de fecha ya existente y le aplica un formato de presentacion.

- **B)** "Convierte un valor **numerico** en una fecha [...]" Falso: no convierte valores numericos. Aunque internamente las fechas se almacenan como numeros, la funcion no esta disenada para convertir numeros arbitrarios en fechas, sino para formatear fechas existentes.

- **D)** "Devuelve una expresion con el formato de fecha y hora asociada a la **configuracion regional del sistema**." Falso: la funcion permite especificar el formato mediante un parametro. Solo usa la configuracion regional si se omite el parametro de formato (por defecto usa vbGeneralDate). La definicion correcta destaca que el formato **se indica como parametro**, no que depende del sistema.

**Formatos disponibles (segundo parametro):**

| Constante | Valor | Resultado |
|-----------|-------|-----------|
| vbGeneralDate | 0 | Fecha y hora completas (por defecto) |
| vbLongDate | 1 | Fecha en formato largo regional |
| vbShortDate | 2 | Fecha en formato corto regional |
| vbLongTime | 3 | Hora en formato largo regional |
| vbShortTime | 4 | Hora en formato 24h (HH:MM) |

**Clave:** FormatoFechaHora **formatea** una fecha segun el formato que le indiquemos. No convierte cadenas ni numeros, y el formato se elige por parametro, no por configuracion del sistema.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "13179099-2d1b-4248-aefb-e2beb97ab84b");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Access FormatoFechaHora (" + exp3.length + " chars)");
})();
